import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Zap, ArrowLeft, Loader2, Trash2, Calendar, Phone, Globe, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  listLeads, updateLead, deleteLead, listEvents, addEvent, changeStatus,
  STATUS_LABELS, STATUS_ORDER,
  type Lead, type LeadEvent, type LeadStatus, type TimelineKind,
} from "@/lib/leads-client";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM — Prospector AI" }] }),
  component: CrmPage,
});

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  contacted: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  negotiating: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  won: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  lost: "border-red-500/40 bg-red-500/10 text-red-300",
};

function CrmPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Lead | null>(null);

  const refresh = async () => {
    try {
      setLeads(await listLeads());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const columns = useMemo(() => {
    const cols: Record<LeadStatus, Lead[]> = { new: [], contacted: [], negotiating: [], won: [], lost: [] };
    for (const l of leads) cols[l.status].push(l);
    return cols;
  }, [leads]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-blue-700">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-semibold tracking-tight">PROSPECTOR AI</span>
            </Link>
            <span className="text-xs text-muted-foreground">/ CRM</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/"><Button variant="ghost" size="sm" className="h-9 rounded-lg text-xs"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Prospect</Button></Link>
            <Button variant="ghost" size="sm" onClick={signOut} className="h-9 rounded-lg text-xs">Sign out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Pipeline <span className="ml-2 text-sm font-normal text-muted-foreground">{leads.length} leads</span></h1>
        {loading ? (
          <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : leads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 py-24 text-center">
            <p className="text-sm text-muted-foreground">No leads yet. Go to <Link to="/" className="text-primary underline">Prospect</Link> and click "Save to CRM" on any business.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {STATUS_ORDER.map((status) => (
              <div key={status} className="rounded-2xl border border-border bg-card/40 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[status]}`}>
                    {STATUS_LABELS[status]}
                  </div>
                  <span className="text-xs text-muted-foreground">{columns[status].length}</span>
                </div>
                <div className="space-y-2">
                  {columns[status].map((l) => (
                    <LeadCard key={l.id} lead={l} onClick={() => setActive(l)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <LeadDrawer lead={active} onClose={() => setActive(null)} onChanged={refresh} />
    </div>
  );
}

function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const overdue = lead.next_followup_at && new Date(lead.next_followup_at) < new Date();
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-border bg-background/60 p-3 text-left transition hover:border-primary/60"
    >
      <div className="truncate text-sm font-medium">{lead.name}</div>
      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{lead.city}, {lead.country}</div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {lead.rating?.toFixed(1) ?? "—"}</span>
        {lead.next_followup_at && (
          <span className={`inline-flex items-center gap-1 ${overdue ? "text-red-400" : ""}`}>
            <Calendar className="h-3 w-3" /> {new Date(lead.next_followup_at).toLocaleDateString()}
          </span>
        )}
      </div>
      {lead.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">{t}</span>
          ))}
        </div>
      )}
    </button>
  );
}

function LeadDrawer({ lead, onClose, onChanged }: { lead: Lead | null; onClose: () => void; onChanged: () => void }) {
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<TimelineKind>("note");
  const [tags, setTags] = useState("");
  const [followup, setFollowup] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setTags(lead.tags.join(", "));
    setFollowup(lead.next_followup_at ? lead.next_followup_at.slice(0, 16) : "");
    listEvents(lead.id).then(setEvents).catch(() => setEvents([]));
  }, [lead]);

  if (!lead) return null;

  const handleStatus = async (to: LeadStatus) => {
    try {
      await changeStatus(lead.id, lead.status, to);
      toast.success(`Moved to ${STATUS_LABELS[to]}`);
      setEvents(await listEvents(lead.id));
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleAddEvent = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await addEvent(lead.id, kind, note.trim());
      setNote("");
      setEvents(await listEvents(lead.id));
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleSaveMeta = async () => {
    setSaving(true);
    try {
      await updateLead(lead.id, {
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        next_followup_at: followup ? new Date(followup).toISOString() : null,
      });
      toast.success("Saved");
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this lead?")) return;
    try {
      await deleteLead(lead.id);
      toast.success("Deleted");
      onClose();
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-border bg-card p-0">
        <div className="border-b border-border p-6">
          <DialogHeader>
            <DialogTitle className="text-xl">{lead.name}</DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">{lead.category} · {lead.city}, {lead.country}</p>
          </DialogHeader>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            {lead.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.phone}</span>}
            {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><Globe className="h-3 w-3" /> Website</a>}
            {lead.maps_url && <a href={lead.maps_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><MapPin className="h-3 w-3" /> Maps</a>}
          </div>
        </div>

        <div className="space-y-5 p-6">
          <section>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => s !== lead.status && handleStatus(s)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                    s === lead.status ? STATUS_COLORS[s] + " ring-1 ring-primary/60" : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tags (comma separated)</label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="hot, no-website, referral" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Next follow-up</label>
              <Input type="datetime-local" value={followup} onChange={(e) => setFollowup(e.target.value)} className="mt-1" />
            </div>
            <Button onClick={handleSaveMeta} disabled={saving} size="sm" className="sm:col-span-2 rounded-lg bg-primary hover:bg-primary/90">
              {saving ? "Saving…" : "Save tags & follow-up"}
            </Button>
          </section>

          <section>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Add to timeline</div>
            <div className="flex gap-2">
              <Select value={kind} onValueChange={(v) => setKind(v as TimelineKind)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["note", "call", "email", "whatsapp", "meeting", "pitch", "followup"] as TimelineKind[]).map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened?" rows={2} className="flex-1" />
            </div>
            <Button onClick={handleAddEvent} disabled={saving || !note.trim()} size="sm" className="mt-2 rounded-lg bg-primary hover:bg-primary/90">Add event</Button>
          </section>

          <section>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Timeline</div>
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground">No events yet.</p>
            ) : (
              <ol className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="rounded-lg border border-border bg-background/40 p-3">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="uppercase tracking-wider">{e.kind.replace("_", " ")}</span>
                      <span>{new Date(e.created_at).toLocaleString()}</span>
                    </div>
                    {e.content && <div className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{e.content}</div>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="flex justify-end border-t border-border pt-4">
            <Button variant="ghost" size="sm" onClick={handleDelete} className="rounded-lg text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300">
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete lead
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}