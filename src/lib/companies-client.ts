import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
export type UserCompanyState = Database["public"]["Tables"]["user_company_state"]["Row"];
export type CompanyEvent = Database["public"]["Tables"]["company_events"]["Row"];
export type CompanyStatus = Database["public"]["Enums"]["company_status"];
export type TimelineKind = Database["public"]["Enums"]["timeline_kind"];

export interface CompanyWithState extends CompanyRow {
  user_state: UserCompanyState | null;
}

export const STATUS_LABELS: Record<CompanyStatus, string> = {
  never_prospected: "Never prospected",
  prospecting: "Prospecting",
  contacted: "Contacted",
  replied: "Replied",
  meeting: "Meeting",
  proposal: "Proposal",
  negotiating: "Negotiating",
  client: "Client",
  lost: "Lost",
  archived: "Archived",
};

export const PIPELINE_STATUSES: CompanyStatus[] = [
  "prospecting", "contacted", "replied", "meeting",
  "proposal", "negotiating", "client", "lost",
];

export interface CompanyFilters {
  search?: string;
  country?: string | null;
  city?: string | null;
  category?: string | null;
  minScore?: number | null;
  hasWebsite?: boolean | null;   // null=any, true=has, false=none
  favoritesOnly?: boolean;
  neverProspectedOnly?: boolean;
  inPipelineOnly?: boolean;
  status?: CompanyStatus | null;
  limit?: number;
  offset?: number;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

/** List companies with per-user state joined. */
export async function listCompanies(f: CompanyFilters = {}): Promise<{ rows: CompanyWithState[]; total: number }> {
  const userId = await currentUserId();
  let q = supabase
    .from("companies")
    .select("*, user_state:user_company_state!left(*)", { count: "exact" })
    .eq("user_company_state.user_id", userId);

  if (f.search) q = q.ilike("name", `%${f.search}%`);
  if (f.country) q = q.eq("country", f.country);
  if (f.city) q = q.eq("city", f.city);
  if (f.category) q = q.eq("category", f.category);
  if (typeof f.minScore === "number") q = q.gte("opportunity_score", f.minScore);
  if (f.hasWebsite === true) q = q.not("website", "is", null);
  if (f.hasWebsite === false) q = q.is("website", null);

  q = q.order("opportunity_score", { ascending: false, nullsFirst: false });
  const limit = f.limit ?? 50;
  const offset = f.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;

  let rows = ((data ?? []) as unknown as Array<CompanyRow & { user_state: UserCompanyState[] | null }>).map((r) => ({
    ...r,
    state: r.user_state && r.user_state.length > 0 ? r.state[0] : null,
  })) as CompanyWithState[];

  // Client-side filters that depend on state
  if (f.favoritesOnly) rows = rows.filter((r) => r.user_state?.favorite);
  if (f.neverProspectedOnly) rows = rows.filter((r) => !r.user_state || r.user_state.status === "never_prospected");
  if (f.inPipelineOnly) rows = rows.filter((r) => r.user_state?.in_pipeline);
  if (f.status) rows = rows.filter((r) => (r.user_state?.status ?? "never_prospected") === f.status);

  return { rows, total: count ?? rows.length };
}

/** List pipeline entries only. */
export async function listPipeline(): Promise<CompanyWithState[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("user_company_state")
    .select("*, company:companies(*)")
    .eq("user_id", userId)
    .eq("in_pipeline", true)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Array<UserCompanyState & { company: CompanyRow }>).map((s) => ({
    ...s.company,
    user_state: { ...s, company: undefined } as unknown as UserCompanyState,
  }));
}

/** Get or create the user_company_state row for this company. */
async function ensureState(companyId: string): Promise<UserCompanyState> {
  const userId = await currentUserId();
  const { data: existing } = await supabase
    .from("user_company_state")
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase
    .from("user_company_state")
    .insert({ user_id: userId, company_id: companyId })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function addToPipeline(companyId: string): Promise<void> {
  await ensureState(companyId);
  const userId = await currentUserId();
  const { error } = await supabase
    .from("user_company_state")
    .update({
      in_pipeline: true,
      pipeline_added_at: new Date().toISOString(),
      status: "prospecting",
    })
    .eq("user_id", userId)
    .eq("company_id", companyId);
  if (error) throw error;
  await addEvent(companyId, "note", "Added to pipeline");
}

export async function removeFromPipeline(companyId: string): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("user_company_state")
    .update({ in_pipeline: false })
    .eq("user_id", userId)
    .eq("company_id", companyId);
  if (error) throw error;
}

export async function toggleFavorite(companyId: string, next: boolean): Promise<void> {
  await ensureState(companyId);
  const userId = await currentUserId();
  const { error } = await supabase
    .from("user_company_state")
    .update({ favorite: next })
    .eq("user_id", userId)
    .eq("company_id", companyId);
  if (error) throw error;
}

export async function changeStatus(companyId: string, from: CompanyStatus | null, to: CompanyStatus): Promise<void> {
  await ensureState(companyId);
  const userId = await currentUserId();
  const { error } = await supabase
    .from("user_company_state")
    .update({ status: to })
    .eq("user_id", userId)
    .eq("company_id", companyId);
  if (error) throw error;
  await addEvent(companyId, "status_change", `${from ?? "never_prospected"} → ${to}`);
}

export async function updateStateMeta(
  companyId: string,
  patch: Partial<Pick<UserCompanyState, "tags" | "notes" | "next_followup_at">>,
): Promise<void> {
  await ensureState(companyId);
  const userId = await currentUserId();
  const { error } = await supabase
    .from("user_company_state")
    .update(patch)
    .eq("user_id", userId)
    .eq("company_id", companyId);
  if (error) throw error;
}

export async function listEvents(companyId: string): Promise<CompanyEvent[]> {
  const { data, error } = await supabase
    .from("company_events")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addEvent(companyId: string, kind: TimelineKind, content: string): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase.from("company_events").insert({
    company_id: companyId, user_id: userId, kind, content,
  });
  if (error) throw error;
}

export async function findCompanyByPlaceId(placeId: string): Promise<CompanyWithState | null> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("companies")
    .select("*, user_state:user_company_state!left(*)")
    .eq("place_id", placeId)
    .eq("user_company_state.user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as CompanyRow & { user_state: UserCompanyState[] | null };
  return { ...row, state: row.state && row.state.length > 0 ? row.state[0] : null };
}

/** Distinct filter facets. */
export async function listFacets(): Promise<{ countries: string[]; categories: string[] }> {
  const { data } = await supabase
    .from("companies")
    .select("country, category")
    .limit(2000);
  const countries = new Set<string>();
  const categories = new Set<string>();
  for (const r of data ?? []) {
    if (r.country) countries.add(r.country);
    if (r.category) categories.add(r.category);
  }
  return {
    countries: Array.from(countries).sort(),
    categories: Array.from(categories).sort(),
  };
}