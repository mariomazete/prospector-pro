import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Business } from "@/lib/mock-businesses";

export interface SearchHistoryRow {
  id: string;
  niche: string;
  country: string;
  city: string | null;
  place_ids: string[];
  result_count: number;
  filters: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const SaveInput = z.object({
  niche: z.string().min(1),
  country: z.string().min(1),
  city: z.string().nullable().optional(),
  placeIds: z.array(z.string()),
  filters: z.record(z.string(), z.unknown()).optional().default({}),
});

export const saveSearchHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ data, context }): Promise<{ id?: string; error?: string }> => {
    const city = data.city?.trim() || null;
    // Manual upsert on (user_id, niche, country, coalesce(city,'')) — unique index exists.
    const { data: existing } = await context.supabase
      .from("search_history")
      .select("id")
      .eq("user_id", context.userId)
      .eq("niche", data.niche)
      .eq("country", data.country)
      .is("city", city === null ? null : (undefined as never));
    // The .is() trick above only handles null; do a second query for non-null match.
    let rowId = existing?.[0]?.id ?? null;
    if (!rowId && city !== null) {
      const { data: match } = await context.supabase
        .from("search_history")
        .select("id")
        .eq("user_id", context.userId)
        .eq("niche", data.niche)
        .eq("country", data.country)
        .eq("city", city)
        .maybeSingle();
      rowId = match?.id ?? null;
    }
    if (rowId) {
      const { error } = await context.supabase
        .from("search_history")
        .update({
          place_ids: data.placeIds,
          result_count: data.placeIds.length,
          filters: data.filters,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rowId);
      if (error) return { error: error.message };
      return { id: rowId };
    }
    const { data: inserted, error } = await context.supabase
      .from("search_history")
      .insert({
        user_id: context.userId,
        niche: data.niche,
        country: data.country,
        city,
        place_ids: data.placeIds,
        result_count: data.placeIds.length,
        filters: data.filters,
      })
      .select("id")
      .single();
    if (error || !inserted) return { error: error?.message ?? "insert failed" };
    return { id: inserted.id };
  });

export const listSearchHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: SearchHistoryRow[] }> => {
    const { data } = await context.supabase
      .from("search_history")
      .select("id,niche,country,city,place_ids,result_count,filters,created_at,updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(30);
    return { items: (data ?? []) as unknown as SearchHistoryRow[] };
  });

export const deleteSearchHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    await context.supabase.from("search_history").delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

export const loadSearchHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ businesses: Business[]; row?: SearchHistoryRow; error?: string }> => {
    const { data: row, error } = await context.supabase
      .from("search_history")
      .select("id,niche,country,city,place_ids,result_count,filters,created_at,updated_at")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !row) return { businesses: [], error: "Not found" };
    const placeIds = (row.place_ids ?? []) as string[];
    if (placeIds.length === 0) return { businesses: [], row: row as unknown as SearchHistoryRow };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: companies } = await supabaseAdmin
      .from("companies")
      .select("*")
      .in("place_id", placeIds);
    const businesses: Business[] = (companies ?? []).map((c) => {
      const photos = Array.isArray(c.photos) ? (c.photos as unknown as string[]) : [];
      const reviews = Array.isArray(c.reviews) ? (c.reviews as unknown as Business["reviews"]) : [];
      return {
        id: c.place_id,
        name: c.name,
        category: c.category ?? "",
        country: c.country ?? "",
        city: c.city ?? "",
        address: c.address ?? "",
        phone: c.phone ?? "",
        website: c.website,
        rating: Number(c.rating ?? 0),
        reviewsCount: c.reviews_count ?? 0,
        photos,
        hours: "",
        mapsUrl: c.maps_url ?? "",
        reviews,
        aiSummary: (c.ai_summary ?? "").split("\n").filter(Boolean),
        isLocal: false,
        utcOffsetMinutes: c.utc_offset_minutes ?? null,
        openNow: c.open_now ?? null,
      };
    });
    return { businesses, row: row as unknown as SearchHistoryRow };
  });