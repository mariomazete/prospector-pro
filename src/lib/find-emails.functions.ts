import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  companyId: z.string().uuid().optional(),
  website: z.string().url().nullable().optional(),
  /** Fallback search context when the business has no website. */
  name: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

// Common contact pages worth probing beyond the homepage.
const CONTACT_PATHS = ["", "/contact", "/contato", "/contacto", "/contact-us", "/about", "/sobre", "/quem-somos"];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}/g;

// Filter obvious junk / tracking / asset e-mails.
const JUNK_LOCAL = /^(?:noreply|no-reply|do-not-reply|donotreply|postmaster|mailer-daemon|abuse|privacy|dmarc|dpo|sentry|wixpress|example|test|user|name|email|your|admin@localhost)/i;
const JUNK_DOMAIN = /(?:sentry\.io|wixpress\.com|example\.com|localhost|domain\.com|email\.com|test\.com|godaddy|whoisguard|whoisprivacy|cloudflare|godotenv|sentry-next|u2f\.demo)/i;
const IMAGE_EXT_RE = /\.(?:png|jpe?g|gif|svg|webp|ico|css|js|woff2?|ttf|otf)$/i;

async function fetchText(url: string, ms = 8000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; ProspectorBot/1.0; +https://thegodsthings.com)",
        "accept": "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html") && !ct.includes("text")) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

function extractEmails(html: string): string[] {
  const out = new Set<string>();
  // mailto: links first
  for (const m of html.matchAll(/mailto:([^"'<>\s?]+)/gi)) {
    out.add(m[1].toLowerCase());
  }
  // plain-text pattern
  const stripped = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ");
  for (const m of stripped.matchAll(EMAIL_RE)) {
    out.add(m[0].toLowerCase());
  }
  // obfuscation: "name (at) domain.com" -> normalize
  const deobf = stripped
    .replace(/\s*\(?\s*(?:at|arroba|@)\s*\)?\s*/gi, "@")
    .replace(/\s*\(?\s*(?:dot|ponto|\.)\s*\)?\s*/gi, ".");
  for (const m of deobf.matchAll(EMAIL_RE)) {
    out.add(m[0].toLowerCase());
  }
  return Array.from(out).filter((e) => {
    const [local, domain] = e.split("@");
    if (!local || !domain) return false;
    if (IMAGE_EXT_RE.test(e)) return false;
    if (JUNK_LOCAL.test(local)) return false;
    if (JUNK_DOMAIN.test(domain)) return false;
    if (e.length > 80) return false;
    return true;
  });
}

function sameOriginUrl(base: string, path: string): string | null {
  try {
    const u = new URL(path, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Fallback: query DuckDuckGo's HTML endpoint (no API key required) for
 * "<name> <city> email contato", pull the top result URLs, then let the
 * caller scrape each page for e-mails. Ignores social/aggregator homepages
 * that never expose contact info in HTML.
 */
async function webSearchUrls(query: string, limit = 5): Promise<string[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchText(url, 10000);
  if (!html) return [];
  const out: string[] = [];
  for (const m of html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"/gi)) {
    let href = m[1];
    // DDG wraps outbound links in a redirect; unwrap `uddg` param.
    try {
      const parsed = new URL(href, "https://duckduckgo.com");
      const uddg = parsed.searchParams.get("uddg");
      if (uddg) href = decodeURIComponent(uddg);
    } catch { continue; }
    if (!/^https?:\/\//i.test(href)) continue;
    if (/facebook\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com\/company|youtube\.com/i.test(href)) continue;
    if (!out.includes(href)) out.push(href);
    if (out.length >= limit) break;
  }
  return out;
}

export const findBusinessEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }) => {
    const found = new Set<string>();
    let source: "website" | "web-search" = "website";

    // 1. If we have a website, try it first (homepage + common contact pages).
    if (data.website) {
      const base = data.website.replace(/\/$/, "");
      const urls: string[] = [];
      for (const p of CONTACT_PATHS) {
        const u = sameOriginUrl(base + "/", p.replace(/^\//, ""));
        if (u && !urls.includes(u)) urls.push(u);
      }
      const results = await Promise.all(urls.slice(0, 6).map((u) => fetchText(u)));
      for (const html of results) {
        for (const e of extractEmails(html)) found.add(e);
        if (found.size >= 8) break;
      }
      if (found.size === 0 && results[0]) {
        const hrefs = Array.from(results[0].matchAll(/href=["']([^"']+)["']/gi))
          .map((m) => sameOriginUrl(base + "/", m[1]))
          .filter((u): u is string => !!u && /contact|contato|contacto|about|sobre/i.test(u))
          .slice(0, 3);
        const more = await Promise.all(hrefs.map((u) => fetchText(u)));
        for (const html of more) for (const e of extractEmails(html)) found.add(e);
      }
    }

    // 2. Fallback (or additional coverage): web search by business name.
    //    Used when there is no website OR the website yielded nothing.
    if (found.size === 0 && data.name) {
      source = "web-search";
      const parts = [data.name, data.city, data.country].filter(Boolean).join(" ");
      const query = `${parts} email contato`;
      const hits = await webSearchUrls(query, 5);
      const pages = await Promise.all(hits.map((u) => fetchText(u, 6000)));
      for (const html of pages) {
        for (const e of extractEmails(html)) found.add(e);
        if (found.size >= 5) break;
      }
    }

    const emails = Array.from(found).slice(0, 5);

    if (data.companyId && emails.length > 0) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("companies").update({ emails }).eq("id", data.companyId);
      } catch {
        // best-effort cache
      }
    }

    return { emails, source };
  });
