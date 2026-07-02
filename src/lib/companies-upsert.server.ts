import type { Business } from "./mock-businesses";
import { calcOpportunityScore } from "./mock-businesses";

/**
 * Auto-save businesses into the global companies base.
 * Server-only. Uses admin client to bypass RLS for public/streaming ingest.
 * Idempotent via place_id — updates non-null fields, preserves first_seen_at,
 * increments search_appearances, and logs each appearance in company_searches.
 */
export async function upsertCompaniesFromBusinesses(
  businesses: Business[],
  origin: { country: string; city?: string | null; niche: string; userId?: string | null },
): Promise<{ saved: number; error?: string }> {
  const uniqueBusinesses = Array.from(
    new Map(businesses.filter((b) => b.id).map((b) => [b.id, b])).values(),
  );
  if (uniqueBusinesses.length === 0) return { saved: 0 };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rows = uniqueBusinesses.map((b) => {
      const score = calcOpportunityScore(b);
      return {
        place_id: b.id,
        name: b.name,
        category: b.category,
        country: b.country,
        city: b.city,
        address: b.address,
        phone: b.phone || null,
        website: b.website,
        maps_url: b.mapsUrl,
        rating: b.rating,
        reviews_count: b.reviewsCount,
        photos: b.photos as unknown as never,
        reviews: b.reviews as unknown as never,
        utc_offset_minutes: b.utcOffsetMinutes,
        open_now: b.openNow,
        opportunity_score: score,
        temperature:
          score >= 85 ? "hot" : score >= 65 ? "warm" : "cold",
        ai_summary: b.aiSummary.join("\n"),
        last_updated_at: new Date().toISOString(),
      };
    });

    // Fetch existing to know which are truly new + get their ids
    const placeIds = rows.map((r) => r.place_id);
    const { data: existing } = await supabaseAdmin
      .from("companies")
      .select("id, place_id, search_appearances")
      .in("place_id", placeIds);
    const existingMap = new Map(
      (existing ?? []).map((e) => [e.place_id, e]),
    );

    // Upsert. For existing rows, bump search_appearances; for new rows it defaults to 1.
    const payload = rows.map((r) => {
      const prev = existingMap.get(r.place_id);
      return prev
        ? { ...r, search_appearances: (prev.search_appearances ?? 1) + 1 }
        : r;
    });

    const { data: upserted, error } = await supabaseAdmin
      .from("companies")
      .upsert(payload, { onConflict: "place_id" })
      .select("id, place_id");
    if (error) {
      console.error("[companies] upsert error", error);
      return { saved: 0, error: error.message };
    }

    // Log search appearances
    if (upserted?.length) {
      const searchRows = upserted.map((u) => ({
        company_id: u.id,
        user_id: origin.userId ?? null,
        niche: origin.niche,
        country: origin.country,
        city: origin.city ?? null,
      }));
      const { error: searchError } = await supabaseAdmin.from("company_searches").insert(searchRows);
      if (searchError) console.error("[companies] search log error", searchError);
    }
    return { saved: upserted?.length ?? 0 };
  } catch (err) {
    console.error("[companies] upsert failed", err);
    return { saved: 0, error: err instanceof Error ? err.message : "Failed to save companies" };
  }
}
