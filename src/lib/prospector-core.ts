import { buildAiSummary, type Business, type Review } from "./mock-businesses";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

interface PlacesPhoto { name: string }
interface PlacesReview {
  authorAttribution?: { displayName?: string };
  rating?: number;
  text?: { text?: string };
}
interface PlacesTimePoint { day?: number; hour?: number; minute?: number }
interface PlacesPeriod { open?: PlacesTimePoint; close?: PlacesTimePoint }
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
  regularOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean; periods?: PlacesPeriod[] };
  photos?: PlacesPhoto[];
  reviews?: PlacesReview[];
  primaryTypeDisplayName?: { text?: string };
  utcOffsetMinutes?: number;
}

export function gatewayHeaders(extra?: Record<string, string>) {
  const lov = process.env.LOVABLE_API_KEY;
  const gm = process.env.GOOGLE_MAPS_API_KEY;
  if (!lov || !gm) throw new Error("Missing Google Maps connector credentials");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": gm,
    ...extra,
  };
}

export async function resolvePhotoUrl(photoName: string, maxHeightPx = 800): Promise<string | null> {
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

const FIELD_MASK = [
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
  "places.regularOpeningHours.periods",
  "places.photos",
  "places.reviews",
  "places.primaryTypeDisplayName",
  "places.utcOffsetMinutes",
].join(",");

/** Cache TTL for search results (must match DB default). */
const CACHE_TTL_DAYS = 14;

function cacheKey(country: string, city: string, niche: string) {
  return `${country.toLowerCase()}::${city.toLowerCase()}::${niche.toLowerCase()}`;
}

export async function getCachedPlaces(
  country: string, city: string, niche: string,
): Promise<PlaceResult[] | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("prospector_cache")
      .select("payload, expires_at")
      .eq("cache_key", cacheKey(country, city, niche))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    return (data?.payload as unknown as PlaceResult[]) ?? null;
  } catch {
    return null;
  }
}

export async function setCachedPlaces(
  country: string, city: string, niche: string, places: PlaceResult[],
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expires = new Date(Date.now() + CACHE_TTL_DAYS * 86400_000).toISOString();
    await supabaseAdmin.from("prospector_cache").upsert({
      cache_key: cacheKey(country, city, niche),
      country, city, niche,
      payload: places as unknown as never,
      expires_at: expires,
    }, { onConflict: "cache_key" });
  } catch {
    // Cache is best-effort
  }
}

/** Text search with pagination (up to 3 pages = 60 results max per query). */
export async function placesTextSearch(query: string): Promise<PlaceResult[]> {
  const places: PlaceResult[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 3; i++) {
    const body: Record<string, unknown> = { textQuery: query, pageSize: 20 };
    if (pageToken) body.pageToken = pageToken;
    const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
      method: "POST",
      headers: gatewayHeaders({
        "Content-Type": "application/json",
        "X-Goog-FieldMask": `${FIELD_MASK},nextPageToken`,
      }),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      if (i === 0) throw new Error(`Places error ${res.status}`);
      break;
    }
    const json = (await res.json()) as { places?: PlaceResult[]; nextPageToken?: string };
    if (json.places) places.push(...json.places);
    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return places;
}

export async function toBusiness(
  p: PlaceResult,
  country: string,
  fallbackCity: string,
  fallbackNiche: string,
  withPhoto = true,
): Promise<Business> {
  const firstPhoto = withPhoto && p.photos?.[0]?.name
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
    category: p.primaryTypeDisplayName?.text ?? fallbackNiche,
    country,
    city: fallbackCity || (p.formattedAddress?.split(",").slice(-2, -1)[0]?.trim() ?? ""),
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
    openNow: typeof p.regularOpeningHours?.openNow === "boolean" ? p.regularOpeningHours.openNow : null,
  };
}

/** Run a small async pool with fixed concurrency. */
export async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await worker(items[i], i);
      } catch (err) {
        // Store as-is; caller decides
        results[i] = err as R;
      }
    }
  }
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}