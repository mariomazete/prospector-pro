import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { calcOpportunityScore, type Business } from "./mock-businesses";
import { placesTextSearch, toBusiness, getCachedPlaces, setCachedPlaces } from "./prospector-core";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type CompanyInsert = Database["public"]["Tables"]["companies"]["Insert"];

const BusinessSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  country: z.string(),
  city: z.string(),
  address: z.string(),
  phone: z.string(),
  website: z.string().nullable(),
  rating: z.number(),
  reviewsCount: z.number(),
  photos: z.array(z.string()),
  hours: z.string(),
  mapsUrl: z.string(),
  reviews: z.array(z.object({
    author: z.string(), rating: z.number(), text: z.string(),
    sentiment: z.enum(["positive", "negative"]),
  })),
  aiSummary: z.array(z.string()),
  isLocal: z.boolean(),
  utcOffsetMinutes: z.number().nullable().optional(),
  openNow: z.boolean().nullable().optional(),
});

export const ensureCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BusinessSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ id?: string; error?: string }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const business = data as unknown as Business;
      const score = calcOpportunityScore(business);
      const { data: row, error } = await supabaseAdmin
        .from("companies")
        .upsert({
          place_id: business.id,
          name: business.name,
          category: business.category,
          country: business.country,
          city: business.city,
          address: business.address,
          phone: business.phone || null,
          website: business.website,
          maps_url: business.mapsUrl,
          rating: business.rating,
          reviews_count: business.reviewsCount,
          photos: business.photos as CompanyInsert["photos"],
          reviews: business.reviews as unknown as CompanyInsert["reviews"],
          utc_offset_minutes: business.utcOffsetMinutes ?? null,
          open_now: business.openNow ?? null,
          opportunity_score: score,
          temperature: score >= 85 ? "hot" : score >= 65 ? "warm" : "cold",
          ai_summary: business.aiSummary.join("\n"),
          last_updated_at: new Date().toISOString(),
        }, { onConflict: "place_id" })
        .select("id")
        .single();
      if (error || !row) {
        console.error("[ensureCompany] upsert error", error);
        return { error: "Failed to save company." };
      }
      await supabaseAdmin.from("company_searches").insert({
        company_id: row.id,
        user_id: context.userId,
        niche: business.category || "Unknown",
        country: business.country || "Unknown",
        city: business.city || null,
      });
      return { id: row.id };
    } catch (err) {
      console.error("[ensureCompany]", err);
      return { error: "Failed to save company." };
    }
  });

const SearchInput = z.object({
  country: z.string().min(1),
  city: z.string().optional().default(""),
  niche: z.string().min(1),
});

export const searchBusinesses = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data }): Promise<{ businesses: Business[]; error?: string }> => {
    const city = data.city?.trim() ?? "";
    const query = city
      ? `${data.niche} in ${city}, ${data.country}`
      : `${data.niche} in ${data.country}`;
    try {
      let places = await getCachedPlaces(data.country, city, data.niche);
      if (!places) {
        places = await placesTextSearch(query);
        if (places.length) await setCachedPlaces(data.country, city, data.niche, places);
      }
      const uniquePlaces = Array.from(
        new Map(places.filter((p) => p.id).map((p) => [p.id, p])).values(),
      );
      const results = await Promise.all(
        uniquePlaces.map((p) => toBusiness(p, data.country, city, data.niche)),
      );
      // Persist every result before responding so the Base is immediately durable.
      const { upsertCompaniesFromBusinesses } = await import("./companies-upsert.server");
      const saved = await upsertCompaniesFromBusinesses(results, {
        country: data.country, city, niche: data.niche,
      });
      if (saved.error) console.error("[prospector] base save error", saved.error);
      return { businesses: results };
    } catch (err) {
      console.error("[prospector] search error", err);
      return { businesses: [], error: "Failed to reach Google Places." };
    }
  });

const PitchInput = z.object({
  name: z.string(),
  city: z.string(),
  country: z.string(),
  category: z.string(),
  rating: z.number(),
  reviewsCount: z.number(),
  hasWebsite: z.boolean(),
  website: z.string().nullable(),
});

async function callAI(system: string, user: string, expectJson: boolean): Promise<{ text: string; error?: string }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { text: "", error: "AI not configured." };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        ...(expectJson ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (res.status === 429) return { text: "", error: "Rate limit — try again in a moment." };
    if (res.status === 402) return { text: "", error: "AI credits exhausted." };
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[ai] error", res.status, body);
      return { text: "", error: `AI error (${res.status}).` };
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { text: "", error: "Empty response from AI." };
    return { text };
  } catch (err) {
    console.error("[ai] network error", err);
    return { text: "", error: "Network error contacting AI." };
  }
}

export interface PitchSet {
  formal: string;
  consultive: string;
  whatsapp: string;
}

export const generatePitch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PitchInput.parse(d))
  .handler(async ({ data }): Promise<{ pitches?: PitchSet; error?: string }> => {
    const system = `You are Mário, founder of "Maga Digital Solutions" — a world-class B2B prospecting, consultive-sales and copywriting specialist. Maga Digital builds websites, landing pages, SEO, integrations, AI automation, chatbots, CRMs and custom web systems for companies worldwide.

LANGUAGE: detect the country ("${data.country}") and ALWAYS write in the local language (Brasil → PT-BR, Portugal → PT-PT, USA → EN, Spain → ES, France → FR, Germany → DE, Italy → IT, Netherlands → NL, etc.). Never mix languages.

STYLE (all three variants):
- Sound 100% human, as if Mário spent several minutes studying THIS specific business. Never sound AI-generated, never generic, never aggressive, never pushy, no fake urgency, no manipulative triggers, no hype, no emoji spam.
- Tone: human, consultive, polite, professional, natural, trust-building.
- Personalize with specific details from the business (name, city, category, rating, reviews, website status). Each message must be unique.
- If the business has NO website: focus on credibility, digital presence, trust, client acquisition, easier contact, professional positioning.
- If it HAS a website: never say it is bad — talk about modernization, UX, SEO, conversion, speed, ranking, automations, AI integration.
- Goal is NOT to sell immediately — spark enough curiosity for the prospect to want a personalized demo.

Return STRICT JSON with exactly three keys: "formal", "consultive", "whatsapp". No markdown, no commentary.
- "whatsapp" (MAIN): max 150 words, feels handwritten. Structure: 1) greeting (see GREETING RULE below), 2) "O meu nome é Mário e sou fundador da Maga Digital Solutions" (localized), 3) show real analysis with a specific insight, 4) one personalized growth opportunity, 5) quick note on how a professional website / solution helps THIS business, 6) soft invite to a demo built inspired by their company ("sem qualquer compromisso"), 7) cordial closing. Use line breaks. No emoji overload.

GREETING RULE (applies to all three variants):
- If a real contact person name is provided in the input, use it naturally: "Olá, Maria!" or "Boa tarde, Sr. João!".
- If NO contact name is provided, NEVER invent one and NEVER use the business name as if it were a person. Use a neutral greeting only: "Olá!", "Bom dia!", "Boa tarde!" or "Boa noite!" (localized to the country's language).
- "formal": polished cold email version of the same idea (max 130 words), same Mário/Maga voice, soft CTA question.
- "consultive": warmer advisory variant (max 130 words) that builds authority before the CTA question.`;
    const user = `Business: ${data.name}
Category: ${data.category}
Location: ${data.city}, ${data.country}
Rating: ${data.rating.toFixed(1)} (${data.reviewsCount} reviews)
Current website: ${data.hasWebsite ? data.website : "None"}`;
    const { text, error } = await callAI(system, user, true);
    if (error) return { error };
    try {
      const parsed = JSON.parse(text) as PitchSet;
      if (!parsed.formal || !parsed.consultive || !parsed.whatsapp) {
        return { error: "Malformed AI response." };
      }
      return { pitches: parsed };
    } catch {
      return { error: "Could not parse AI response." };
    }
  });

export interface DeepAnalysis {
  scoreReasons: { positives: string[]; negatives: string[]; warnings: string[] };
  attackPlan: {
    conversionChance: number;
    bestServices: string[];
    bestApproach: string;
    bestHours: string[];
    bestChannel: { name: string; reason: string; stars: number };
    objections: { question: string; answer: string }[];
  };
  reviewIntel: { praised: string[]; complained: string[] };
  businessInsights: string[];
  recommendedServices: string[];
  summary: string;
}

const AnalyzeInput = PitchInput.extend({
  reviews: z.array(z.string()).default([]),
});

export const analyzeBusiness = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AnalyzeInput.parse(d))
  .handler(async ({ data }): Promise<{ analysis?: DeepAnalysis; error?: string }> => {
    const system = `You are Mário, founder of "Maga Digital Solutions", a world-class specialist in B2B prospecting, consultive sales, copywriting, digital marketing, consumer behavior and brand positioning. Maga Digital delivers websites, landing pages, SEO, integrations, AI automation, chatbots, CRMs and custom web systems.

Analyze THIS specific business deeply and uniquely — never generic, never invent data, never criticize or belittle the company. Detect the country ("${data.country}") and write EVERY string field in the local language of that country. Consider local purchasing power, competition and market when reasoning about services and approach.

Return STRICT JSON matching this TypeScript type — no markdown, no commentary:
{
  "scoreReasons": { "positives": string[], "negatives": string[], "warnings": string[] },
  "attackPlan": {
    "conversionChance": number,               // 0-100, realistic closing probability
    "bestServices": string[],                 // 3-6 items, prioritized for THIS business
    "bestApproach": string,                   // 2-3 sentences: best commercial angle (credibility / SEO / AI / automation / conversion / positioning...)
    "bestHours": string[],                    // local timezone windows, e.g. ["09:00–11:00","14:00–17:00"]
    "bestChannel": { "name": string, "reason": string, "stars": number }, // stars 1-5
    "objections": { "question": string, "answer": string }[] // exactly the 3 most likely objections + a natural, non-pushy answer to each
  },
  "reviewIntel": { "praised": string[], "complained": string[] },
  "businessInsights": string[],               // 4-6 short bullets: real opportunities, pains, improvement points, what generates most value for this type of company
  "recommendedServices": string[],            // upsell products with highest close probability: SEO, Google Business, Landing Page, Chatbot IA, WhatsApp IA, CRM, Integrations, Online Booking, Automations...
  "summary": string                           // one dense paragraph, sales-manager style, covering: is it worth prospecting (yes/no + why), potential score 0-10, response probability %, estimated close probability %, suggested website price range for the local market (minimum / ideal / premium) and a recommended monthly fee (hosting, domain, SSL, backups, support, small edits) in the local currency.
}
Every string must be concrete, personalized to THIS business, and in the local language. No emojis, no filler, no invented facts.`;
    const user = `Business: ${data.name}
Category: ${data.category}
Location: ${data.city}, ${data.country}
Rating: ${data.rating.toFixed(1)} (${data.reviewsCount} reviews)
Website: ${data.hasWebsite ? data.website : "NONE"}
Sample reviews:
${data.reviews.slice(0, 5).map((r, i) => `${i + 1}. ${r}`).join("\n") || "(none available)"}`;
    const { text, error } = await callAI(system, user, true);
    if (error) return { error };
    try {
      const parsed = JSON.parse(text) as DeepAnalysis;
      return { analysis: parsed };
    } catch {
      return { error: "Could not parse AI response." };
    }
  });