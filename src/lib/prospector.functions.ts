import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildAiSummary, type Business, type Review } from "./mock-businesses";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

const SearchInput = z.object({
  country: z.string().min(1),
  city: z.string().optional().default(""),
  niche: z.string().min(1),
});

interface PlacesPhoto { name: string; widthPx?: number; heightPx?: number }
interface PlacesReview {
  authorAttribution?: { displayName?: string };
  rating?: number;
  text?: { text?: string };
}
interface PlaceResult {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: PlacesPhoto[];
  reviews?: PlacesReview[];
  primaryTypeDisplayName?: { text?: string };
  utcOffsetMinutes?: number;
}

function gatewayHeaders(extra?: Record<string, string>) {
  const lov = process.env.LOVABLE_API_KEY;
  const gm = process.env.GOOGLE_MAPS_API_KEY;
  if (!lov || !gm) throw new Error("Missing Google Maps connector credentials");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": gm,
    ...extra,
  };
}

async function resolvePhotoUrl(photoName: string, maxHeightPx = 800): Promise<string | null> {
  try {
    const res = await fetch(
      `${GATEWAY}/places/v1/${photoName}/media?maxHeightPx=${maxHeightPx}&skipHttpRedirect=true`,
      { headers: gatewayHeaders() },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { photoUri?: string };
    return data.photoUri ?? null;
  } catch {
    return null;
  }
}

export const searchBusinesses = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data }): Promise<{ businesses: Business[]; error?: string }> => {
    const city = data.city?.trim() ?? "";
    const query = city
      ? `${data.niche} in ${city}, ${data.country}`
      : `${data.niche} in ${data.country}`;

    const fieldMask = [
      "places.id",
      "places.displayName",
      "places.formattedAddress",
      "places.internationalPhoneNumber",
      "places.nationalPhoneNumber",
      "places.websiteUri",
      "places.rating",
      "places.userRatingCount",
      "places.googleMapsUri",
      "places.regularOpeningHours",
      "places.photos",
      "places.reviews",
      "places.primaryTypeDisplayName",
      "places.utcOffsetMinutes",
    ].join(",");

    // Places API text search caps at 20 per page, max 3 pages (60 results).
    // Paginate to maximize coverage, especially for country-wide searches.
    const places: PlaceResult[] = [];
    let pageToken: string | undefined;
    try {
      for (let i = 0; i < 3; i++) {
        const body: Record<string, unknown> = { textQuery: query, pageSize: 20 };
        if (pageToken) body.pageToken = pageToken;
        const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
          method: "POST",
          headers: gatewayHeaders({
            "Content-Type": "application/json",
            "X-Goog-FieldMask": `${fieldMask},nextPageToken`,
          }),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          console.error("[prospector] Places error", res.status, txt);
          if (i === 0) return { businesses: [], error: `Google Places error (${res.status}).` };
          break;
        }
        const json = (await res.json()) as { places?: PlaceResult[]; nextPageToken?: string };
        if (json.places) places.push(...json.places);
        if (!json.nextPageToken) break;
        pageToken = json.nextPageToken;
        // nextPageToken needs a short delay before it becomes valid
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error("[prospector] network error", err);
      if (places.length === 0) return { businesses: [], error: "Network error contacting Google Places." };
    }

    // Resolve first photo per business in parallel (cap cost)
    const results = await Promise.all(
      places.map(async (p): Promise<Business> => {
        const firstPhoto = p.photos?.[0]?.name
          ? await resolvePhotoUrl(p.photos[0].name)
          : null;

        const reviews: Review[] = (p.reviews ?? []).slice(0, 3).map((r) => {
          const rating = r.rating ?? 5;
          return {
            author: r.authorAttribution?.displayName ?? "Anonymous",
            rating,
            text: r.text?.text ?? "",
            sentiment: rating >= 4 ? "positive" : "negative",
          };
        });

        const rating = p.rating ?? 0;
        const reviewsCount = p.userRatingCount ?? 0;
        const website = p.websiteUri ?? null;

        return {
          id: p.id,
          name: p.displayName?.text ?? "Unknown",
          category: p.primaryTypeDisplayName?.text ?? data.niche,
          country: data.country,
          city: city || (p.formattedAddress?.split(",").slice(-2, -1)[0]?.trim() ?? ""),
          address: p.formattedAddress ?? "",
          phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? "",
          website,
          rating,
          reviewsCount,
          photos: firstPhoto ? [firstPhoto] : [],
          hours: p.regularOpeningHours?.weekdayDescriptions?.[0] ?? "Hours not available",
          mapsUrl: p.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.displayName?.text ?? "")}`,
          isLocal: true,
          reviews,
          aiSummary: buildAiSummary({ website, rating, reviewsCount }),
          utcOffsetMinutes: typeof p.utcOffsetMinutes === "number" ? p.utcOffsetMinutes : null,
        };
      }),
    );

    return { businesses: results };
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