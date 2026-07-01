import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Business } from "./mock-businesses";
import { placesTextSearch, toBusiness } from "./prospector-core";

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
      const places = await placesTextSearch(query);
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

export const generatePitch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PitchInput.parse(d))
  .handler(async ({ data }): Promise<{ pitch: string; error?: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { pitch: "", error: "AI not configured." };

    const system = "You are an expert cold-outreach copywriter for a web-design freelancer. Write concise, friendly, human-sounding pitches (max 130 words) in the language of the target country. Highlight the business's strengths, then propose a modern website. End with a soft CTA question. Return plain text only, no markdown.";
    const user = `Business: ${data.name}
Category: ${data.category}
Location: ${data.city}, ${data.country}
Rating: ${data.rating.toFixed(1)} (${data.reviewsCount} reviews)
Current website: ${data.hasWebsite ? data.website : "None"}

Write a cold email pitch selling them a professional website.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (res.status === 429) return { pitch: "", error: "Rate limit — try again in a moment." };
      if (res.status === 402) return { pitch: "", error: "AI credits exhausted." };
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("[pitch] AI error", res.status, body);
        return { pitch: "", error: `AI error (${res.status}).` };
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const pitch = json.choices?.[0]?.message?.content?.trim() ?? "";
      if (!pitch) return { pitch: "", error: "Empty response from AI." };
      return { pitch };
    } catch (err) {
      console.error("[pitch] network error", err);
      return { pitch: "", error: "Network error contacting AI." };
    }
  });