import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Business } from "./mock-businesses";
import { placesTextSearch, toBusiness, getCachedPlaces, setCachedPlaces } from "./prospector-core";

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
      const results = await Promise.all(
        places.map((p) => toBusiness(p, data.country, city, data.niche)),
      );
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
    const system = `You are a senior B2B sales copywriter selling professional websites to local businesses. Write in the primary language of ${data.country}. Return STRICT JSON with exactly three keys: "formal", "consultive", "whatsapp". No markdown, no extra text.
- formal: polished cold email for clinics/lawyers/accountants (max 130 words).
- consultive: warmer, advisory tone building authority (max 130 words).
- whatsapp: short natural WhatsApp message ready to send (max 60 words, use line breaks, no emojis overload).
Each ends with a soft CTA question.`;
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
    const system = `You are a senior sales strategist for a web-design & digital agency. Analyze the business and respond in the primary language of ${data.country}. Return STRICT JSON matching this TypeScript type — no markdown, no commentary:
{
  "scoreReasons": { "positives": string[], "negatives": string[], "warnings": string[] },
  "attackPlan": {
    "conversionChance": number,               // 0-100
    "bestServices": string[],                 // 3-6 items
    "bestApproach": string,                   // 2-3 sentences
    "bestHours": string[],                    // e.g. ["09:00–11:00","14:00–17:00"]
    "bestChannel": { "name": string, "reason": string, "stars": number }, // stars 1-5
    "objections": { "question": string, "answer": string }[] // 3-4 items
  },
  "reviewIntel": { "praised": string[], "complained": string[] },
  "businessInsights": string[],               // 4-6 short bullets
  "recommendedServices": string[],            // Website, SEO, Google Ads, CRM, WhatsApp Automation, GBP Optimization, etc.
  "summary": string                           // one dense paragraph, sales-manager style
}
Keep every string concise. No emojis.`;
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