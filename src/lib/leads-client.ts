import { supabase } from "@/integrations/supabase/client";
import type { Business } from "./mock-businesses";

export type LeadStatus = "new" | "contacted" | "negotiating" | "won" | "lost";
export type TimelineKind =
  | "note" | "status_change" | "followup"
  | "call" | "email" | "whatsapp" | "meeting" | "pitch";

export interface Lead {
  id: string;
  place_id: string;
  name: string;
  category: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews_count: number | null;
  maps_url: string | null;
  status: LeadStatus;
  tags: string[];
  next_followup_at: string | null;
  notes: string | null;
  snapshot: unknown;
  created_at: string;
  updated_at: string;
}

export interface LeadEvent {
  id: string;
  lead_id: string;
  kind: TimelineKind;
  content: string | null;
  meta: unknown;
  created_at: string;
}

export async function listLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Lead[];
}

export async function saveBusinessAsLead(b: Business): Promise<Lead> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("Not signed in");
  const payload = {
    user_id: user.id,
    place_id: b.id,
    name: b.name,
    category: b.category,
    country: b.country,
    city: b.city,
    address: b.address,
    phone: b.phone || null,
    website: b.website,
    rating: b.rating,
    reviews_count: b.reviewsCount,
    maps_url: b.mapsUrl,
    snapshot: b as unknown as never,
  };
  const { data, error } = await supabase
    .from("leads")
    .upsert(payload, { onConflict: "user_id,place_id" })
    .select()
    .single();
  if (error) throw error;
  return data as Lead;
}

export async function updateLead(id: string, patch: Partial<Pick<Lead, "status" | "tags" | "next_followup_at" | "notes">>): Promise<void> {
  const { error } = await supabase.from("leads").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
}

export async function listEvents(leadId: string): Promise<LeadEvent[]> {
  const { data, error } = await supabase
    .from("lead_events")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeadEvent[];
}

export async function addEvent(leadId: string, kind: TimelineKind, content: string, meta?: unknown): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase.from("lead_events").insert({
    lead_id: leadId, user_id: user.id, kind, content,
    meta: (meta ?? null) as unknown as never,
  });
  if (error) throw error;
}

export async function changeStatus(leadId: string, from: LeadStatus, to: LeadStatus): Promise<void> {
  await updateLead(leadId, { status: to });
  await addEvent(leadId, "status_change", `${from} → ${to}`);
}

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
};

export const STATUS_ORDER: LeadStatus[] = ["new", "contacted", "negotiating", "won", "lost"];