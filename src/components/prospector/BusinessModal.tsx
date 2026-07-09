import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin, Phone, Globe, Clock, Sparkles, Copy, Check, Star, ExternalLink,
  Target, TrendingUp, MessageSquare, ThumbsUp, ThumbsDown, AlertTriangle,
  Lightbulb, Loader2, RefreshCw, Mail,
} from "lucide-react";
import type { Business, HoursPeriod } from "@/lib/mock-businesses";
import { calcOpportunityScore } from "@/lib/mock-businesses";
import { OpportunityBadge } from "./OpportunityBadge";
import { generatePitch, analyzeBusiness, ensureCompany, type DeepAnalysis, type PitchSet } from "@/lib/prospector.functions";
import { findBusinessEmails } from "@/lib/find-emails.functions";
import {
  addToPipeline, findCompanyByPlaceId, toggleFavorite,
  changeStatus, updateStateMeta, listEvents, addEvent,
  updateCompanyAi, companyAiFromRow,
  STATUS_LABELS, type CompanyStatus, type CompanyEvent, type UserCompanyState,
} from "@/lib/companies-client";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { Bookmark, Heart, Calendar, Tag, History } from "lucide-react";
import { toast } from "sonner";

const AI_CACHE_KEY = "prospector-ai:ai-cache:v1";
type AICacheEntry = { pitches?: PitchSet | null; analysis?: DeepAnalysis | null };

/**
 * Compute whether the business is open *right now* using its structured weekly
 * periods (from Google Places) + its UTC offset. Handles periods that wrap
 * past midnight (close.day > open.day) and 24h periods (missing close).
 */
function computeOpenNow(
  periods: HoursPeriod[] | null,
  utcOffsetMinutes: number | null,
  nowMs: number,
): boolean | null {
  if (!periods || periods.length === 0 || typeof utcOffsetMinutes !== "number") return null;
  const local = new Date(nowMs + utcOffsetMinutes * 60_000);
  // Use UTC getters because we've already shifted the timestamp into local wall-clock.
  const nowMin = local.getUTCDay() * 1440 + local.getUTCHours() * 60 + local.getUTCMinutes();
  const WEEK = 7 * 1440;
  for (const p of periods) {
    const openMin = p.open.day * 1440 + p.open.hour * 60 + p.open.minute;
    if (!p.close) return true; // open 24/7 (per Places convention when close is missing)
    let closeMin = p.close.day * 1440 + p.close.hour * 60 + p.close.minute;
    if (closeMin <= openMin) closeMin += WEEK; // wraps past week end
    const n = nowMin < openMin ? nowMin + WEEK : nowMin;
    if (n >= openMin && n < closeMin) return true;
  }
  return false;
}

function readAICache(): Record<string, AICacheEntry> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.sessionStorage.getItem(AI_CACHE_KEY) ?? "{}"); } catch { return {}; }
}
function writeAICache(id: string, patch: AICacheEntry) {
  if (typeof window === "undefined") return;
  try {
    const all = readAICache();
    all[id] = { ...all[id], ...patch };
    window.sessionStorage.setItem(AI_CACHE_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

interface Props {
  business: Business | null;
  onClose: () => void;
}

export function BusinessModal({ business, onClose }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [addingPipeline, setAddingPipeline] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [inPipeline, setInPipeline] = useState(false);
  const [status, setStatus] = useState<CompanyStatus>("never_prospected");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [followup, setFollowup] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [events, setEvents] = useState<CompanyEvent[]>([]);
  const [pitches, setPitches] = useState<PitchSet | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [analysis, setAnalysis] = useState<DeepAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [findingEmails, setFindingEmails] = useState(false);

  useEffect(() => {
    if (!business) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [business]);

  useEffect(() => {
    const cached = business ? readAICache()[business.id] : undefined;
    setPitches(cached?.pitches ?? null);
    setAnalysis(cached?.analysis ?? null);
    setFavorite(false);
    setCompanyId(null);
    setInPipeline(false);
    setStatus("never_prospected");
    setNotes("");
    setTagsInput("");
    setFollowup("");
    setEvents([]);
    setEmails(business?.emails ?? []);
    if (business && user) {
      (async () => {
        try {
          let c = await findCompanyByPlaceId(business.id);
          if (!c) {
            const res = await ensureCompany({ data: business });
            if (res.id) c = await findCompanyByPlaceId(business.id);
          }
          if (!c) return;
          setCompanyId(c.id);
          applyState(c.user_state ?? null);
          if (c.emails && c.emails.length > 0) setEmails(c.emails);
          const persistedAi = companyAiFromRow(c);
          if (persistedAi.pitches) {
            setPitches(persistedAi.pitches);
            writeAICache(business.id, { pitches: persistedAi.pitches });
          }
          if (persistedAi.analysis) {
            setAnalysis(persistedAi.analysis);
            writeAICache(business.id, { analysis: persistedAi.analysis });
          }
          try { setEvents(await listEvents(c.id)); } catch {}
        } catch {}
      })();
    }
  }, [business, user]);

  function applyState(s: UserCompanyState | null) {
    setFavorite(!!s?.favorite);
    setInPipeline(!!s?.in_pipeline);
    setStatus((s?.status as CompanyStatus) ?? "never_prospected");
    setNotes(s?.notes ?? "");
    setTagsInput((s?.tags ?? []).join(", "));
    setFollowup(s?.next_followup_at ? s.next_followup_at.slice(0, 16) : "");
  }

  const refreshEvents = async (id: string) => {
    try { setEvents(await listEvents(id)); } catch {}
  };

  const ensurePersistedCompanyId = async (): Promise<string | null> => {
    if (companyId) return companyId;
    if (!business || !user) return null;
    const res = await ensureCompany({ data: business });
    if (!res.id) throw new Error(res.error ?? "Failed to save company.");
    setCompanyId(res.id);
    return res.id;
  };

  if (!business) return null;
  const score = calcOpportunityScore(business);
  const localTime =
    typeof business.utcOffsetMinutes === "number"
      ? new Date(now + business.utcOffsetMinutes * 60_000).toISOString().slice(11, 16)
      : null;

  const openNowLive = computeOpenNow(business.hoursPeriods ?? null, business.utcOffsetMinutes ?? null, now);

  const handleFindEmails = async () => {
    if (!business.website) {
      toast.error("Este lead não tem site cadastrado.");
      return;
    }
    setFindingEmails(true);
    try {
      const res = await findBusinessEmails({
        data: { website: business.website, companyId: companyId ?? undefined },
      });
      if (res.emails.length === 0) {
        toast.info("Nenhum e-mail público encontrado no site.");
      } else {
        toast.success(`Encontrado(s) ${res.emails.length} e-mail(s).`);
      }
      setEmails(res.emails);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao buscar e-mails.");
    } finally {
      setFindingEmails(false);
    }
  };

  const payload = {
    name: business.name,
    city: business.city,
    country: business.country,
    category: business.category,
    rating: business.rating,
    reviewsCount: business.reviewsCount,
    hasWebsite: !!business.website,
    website: business.website,
    utcOffsetMinutes: business.utcOffsetMinutes ?? null,
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await generatePitch({ data: payload });
      if (res.error || !res.pitches) toast.error(res.error ?? "No pitch");
      else {
        setPitches(res.pitches);
        writeAICache(business.id, { pitches: res.pitches });
        const persistedCompanyId = await ensurePersistedCompanyId();
        if (persistedCompanyId) {
          await updateCompanyAi(persistedCompanyId, { pitches: res.pitches });
          await addEvent(persistedCompanyId, "pitch", "AI pitches generated (Formal / Consultive / WhatsApp)").catch(() => {});
          refreshEvents(persistedCompanyId);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate pitch.");
    } finally {
      setGenerating(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await analyzeBusiness({
        data: { ...payload, reviews: business.reviews.map((r) => r.text) },
      });
      if (res.error || !res.analysis) toast.error(res.error ?? "No analysis");
      else {
        setAnalysis(res.analysis);
        writeAICache(business.id, { analysis: res.analysis });
        const persistedCompanyId = await ensurePersistedCompanyId();
        if (persistedCompanyId) {
          await updateCompanyAi(persistedCompanyId, { analysis: res.analysis });
          await addEvent(persistedCompanyId, "discovery", "AI sales strategy generated").catch(() => {});
          refreshEvents(persistedCompanyId);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to analyze.");
    } finally {
      setAnalyzing(false);
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const sendWhatsApp = async (
    phone: string | null | undefined,
    message: string,
    variant: "formal" | "consultive" | "whatsapp",
  ) => {
    if (!phone) {
      toast.error("No phone number available.");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (!digits) {
      toast.error("Invalid phone number.");
      return;
    }
    // Open the WhatsApp desktop app via its protocol handler.
    // This avoids opening a new browser tab and does not reload web.whatsapp.com.
    const url = `whatsapp://send?phone=${digits}&text=${encodeURIComponent(message)}`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();

    toast.success("Abrindo o WhatsApp…");
    try {
      const id = await ensurePersistedCompanyId();
      if (id) {
        const label = variant === "whatsapp" ? "WhatsApp" : variant === "formal" ? "Formal" : "Consultive";
        await addEvent(id, "pitch", `WhatsApp opened using the ${label} pitch.`).catch(() => {});
        refreshEvents(id);
      }
    } catch { /* non-blocking */ }
  };

  const handleAddToPipeline = async () => {
    if (!user) {
      toast("Sign in to add to pipeline");
      navigate({ to: "/auth" });
      return;
    }
    setAddingPipeline(true);
    try {
      let id = companyId;
      if (!id) {
        const res = await ensureCompany({ data: business });
        if (!res.id) throw new Error(res.error ?? "Failed to save");
        id = res.id;
        setCompanyId(id);
      }
      await addToPipeline(id);
      setInPipeline(true);
      setStatus("prospecting");
      refreshEvents(id);
      toast.success("Added to Pipeline");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAddingPipeline(false);
    }
  };

  const handleStatusChange = async (to: CompanyStatus) => {
    if (!companyId) return;
    const prev = status;
    setStatus(to);
    try {
      await changeStatus(companyId, prev, to);
      if (to !== "never_prospected" && !inPipeline) setInPipeline(true);
      refreshEvents(companyId);
    } catch (e) {
      setStatus(prev);
      toast.error((e as Error).message);
    }
  };

  const handleSaveMeta = async () => {
    if (!companyId) return;
    setSavingMeta(true);
    try {
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      await updateStateMeta(companyId, {
        notes: notes || null,
        tags,
        next_followup_at: followup ? new Date(followup).toISOString() : null,
      });
      if (notes.trim()) await addEvent(companyId, "note", notes.trim()).catch(() => {});
      if (followup) await addEvent(companyId, "followup", `Follow-up scheduled for ${new Date(followup).toLocaleString()}`).catch(() => {});
      refreshEvents(companyId);
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingMeta(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user) { navigate({ to: "/auth" }); return; }
    let id = companyId;
    if (!id) {
      try {
        const res = await ensureCompany({ data: business });
        if (!res.id) return;
        id = res.id;
        setCompanyId(id);
      } catch { return; }
    }
    const next = !favorite;
    setFavorite(next);
    try {
      await toggleFavorite(id, next);
    } catch (e) {
      setFavorite(!next);
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={!!business} onOpenChange={(o) => { if (!o) { onClose(); } }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border-border bg-card p-0">
        <div className="border-b border-border p-6">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="text-xl font-semibold">{business.name}</DialogTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {business.category} · {business.city}, {business.country}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <OpportunityBadge score={score} />
                {openNowLive !== null && (
                  <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                    openNowLive
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-red-500/30 bg-red-500/10 text-red-400"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${openNowLive ? "bg-emerald-400" : "bg-red-400"}`} />
                    {openNowLive ? "Open now" : "Closed"}
                  </div>
                )}
                {localTime && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary tabular-nums">
                    <Clock className="h-3 w-3" />
                    <span>{localTime}</span>
                    <span className="text-[10px] font-normal text-primary/70">local</span>
                  </div>
                )}
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleToggleFavorite}
                    className="h-8 w-8 rounded-lg p-0"
                    aria-label="Toggle favorite"
                  >
                    <Heart className={`h-4 w-4 ${favorite ? "fill-red-500 text-red-500" : ""}`} />
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddToPipeline}
                    disabled={addingPipeline || inPipeline}
                    className="h-8 rounded-lg bg-primary text-xs hover:bg-primary/90"
                  >
                    <Bookmark className="mr-1 h-3.5 w-3.5" />
                    {inPipeline ? "In Pipeline" : addingPipeline ? "Adding…" : "Add to Pipeline"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Address" value={business.address} />
            <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={business.phone} />
            <InfoRow icon={<Globe className="h-3.5 w-3.5" />} label="Website" value={business.website ?? "No website"} href={business.website ?? undefined} />
            <InfoRow icon={<Clock className="h-3.5 w-3.5" />} label="Hours" value={business.hours} />
            <InfoRow icon={<ExternalLink className="h-3.5 w-3.5" />} label="Google Maps" value="Open in Maps" href={business.mapsUrl} />
            <InfoRow icon={<Star className="h-3.5 w-3.5" />} label="Rating" value={`${business.rating.toFixed(1)} (${business.reviewsCount} reviews)`} />
          </div>

          {user && companyId && (
            <section className="rounded-xl border border-border bg-background/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Bookmark className="h-3.5 w-3.5 text-primary" /> CRM
                </h4>
                <div className="w-56">
                  <Select value={status} onValueChange={(v) => handleStatusChange(v as CompanyStatus)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABELS) as CompanyStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    <Tag className="h-3 w-3" /> Tags (comma-separated)
                  </label>
                  <input
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="hot lead, needs-website, follow-up"
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Next follow-up
                  </label>
                  <input
                    type="datetime-local"
                    value={followup}
                    onChange={(e) => setFollowup(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Notes</label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this lead…"
                    rows={3}
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={handleSaveMeta} disabled={savingMeta} className="h-8 rounded-lg text-xs">
                  {savingMeta ? "Saving…" : "Save"}
                </Button>
              </div>
            </section>
          )}

          {!analysis ? (
            <section className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-5 text-center">
              <div className="mb-2 flex items-center justify-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> AI Sales Strategy
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Get a full commercial analysis: score reasons, attack plan, best channel, objections & recommended services.
              </p>
              <Button size="sm" onClick={handleAnalyze} disabled={analyzing} className="rounded-lg bg-primary text-xs hover:bg-primary/90">
                {analyzing ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Analyzing…</> : "Analyze with AI"}
              </Button>
            </section>
          ) : (
            <AnalysisView a={analysis} />
          )}

          {business.photos.length > 0 && (
            <section>
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Photos</h4>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {business.photos.slice(0, 6).map((p, i) => (
                  <img key={i} src={p} alt="" loading="lazy" className="h-28 w-40 shrink-0 rounded-xl border border-border object-cover" />
                ))}
              </div>
            </section>
          )}

          {business.reviews.length > 0 && (
            <section>
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Top Reviews</h4>
              <div className="space-y-2">
                {business.reviews.map((r, i) => (
                  <div key={i} className="rounded-xl border border-border bg-background/40 p-3 text-sm">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="font-medium">{r.author}</div>
                      <div className="inline-flex items-center gap-1 text-xs">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {r.rating}
                      </div>
                    </div>
                    <p className="text-muted-foreground">{r.text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" /> AI Pitch Generator
              </div>
              <Button size="sm" onClick={handleGenerate} disabled={generating} className="h-8 rounded-lg bg-primary text-xs hover:bg-primary/90">
                {generating ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Generating…</> : pitches ? "Regenerate" : "Generate 3 pitches"}
              </Button>
            </div>
            {pitches ? (
              <Tabs defaultValue="formal">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="formal">Formal</TabsTrigger>
                  <TabsTrigger value="consultive">Consultive</TabsTrigger>
                  <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                </TabsList>
                {(["formal", "consultive", "whatsapp"] as const).map((k) => (
                  <TabsContent key={k} value={k} className="mt-3">
                    <div className="rounded-lg border border-border bg-background/60 p-3">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">{pitches[k]}</pre>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => copy(pitches[k], k)} className="h-7 rounded-lg text-xs">
                          {copiedKey === k ? <><Check className="mr-1 h-3.5 w-3.5" /> Copied</> : <><Copy className="mr-1 h-3.5 w-3.5" /> Copy</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => sendWhatsApp(business.phone, pitches[k], k)}
                          disabled={!business.phone}
                          title={business.phone ? "Open the installed WhatsApp app with this pitch" : "No phone available"}
                          className="h-7 rounded-lg text-xs text-emerald-400 hover:text-emerald-300"
                        >
                          <MessageSquare className="mr-1 h-3.5 w-3.5" /> Send WhatsApp
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled
                          title="Coming soon"
                          className="h-7 rounded-lg text-xs opacity-60"
                        >
                          <Mail className="mr-1 h-3.5 w-3.5" /> Email
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleGenerate}
                          disabled={generating}
                          className="h-7 rounded-lg text-xs"
                        >
                          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} /> Regenerate
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <p className="text-xs text-muted-foreground">
                Get 3 tailored versions (Formal, Consultive, WhatsApp) ready to send.
              </p>
            )}
          </section>

          {user && companyId && (
            <section className="rounded-xl border border-border bg-background/40 p-4">
              <h4 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <History className="h-3.5 w-3.5 text-primary" /> Timeline
                <span className="ml-auto text-[10px] normal-case tracking-normal">{events.length} events</span>
              </h4>
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground">No activity yet.</p>
              ) : (
                <ol className="space-y-2 border-l border-border pl-3">
                  {events.map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[15px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-primary/90">
                          {e.kind.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(e.created_at).toLocaleString()}
                        </span>
                      </div>
                      {e.content && <p className="mt-0.5 text-sm text-foreground/90">{e.content}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnalysisView({ a }: { a: DeepAnalysis }) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-background/40 p-4">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Target className="h-3.5 w-3.5 text-primary" /> Why this score
        </h4>
        <div className="grid gap-2 sm:grid-cols-3">
          <ReasonList icon={<ThumbsUp className="h-3 w-3 text-emerald-400" />} items={a.scoreReasons.positives} tone="emerald" />
          <ReasonList icon={<ThumbsDown className="h-3 w-3 text-red-400" />} items={a.scoreReasons.negatives} tone="red" />
          <ReasonList icon={<AlertTriangle className="h-3 w-3 text-amber-400" />} items={a.scoreReasons.warnings} tone="amber" />
        </div>
      </section>

      <section className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-primary" /> Attack Plan
          </h4>
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 tabular-nums">
            {a.attackPlan.conversionChance}% conversion
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <PlanBlock label="Best services">
            <div className="flex flex-wrap gap-1.5">
              {a.attackPlan.bestServices.map((s) => (
                <span key={s} className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary">{s}</span>
              ))}
            </div>
          </PlanBlock>
          <PlanBlock label="Best channel">
            <div className="text-sm font-medium">{a.attackPlan.bestChannel.name}</div>
            <div className="text-xs text-amber-400">{"★".repeat(a.attackPlan.bestChannel.stars)}{"☆".repeat(Math.max(0, 5 - a.attackPlan.bestChannel.stars))}</div>
            <p className="text-xs text-muted-foreground">{a.attackPlan.bestChannel.reason}</p>
          </PlanBlock>
          <PlanBlock label="Best hours">
            <div className="flex flex-wrap gap-1.5">
              {a.attackPlan.bestHours.map((h) => (
                <span key={h} className="rounded-md border border-border bg-background/60 px-2 py-0.5 text-xs">{h}</span>
              ))}
            </div>
          </PlanBlock>
          <PlanBlock label="Best approach">
            <p className="text-xs text-foreground/90">{a.attackPlan.bestApproach}</p>
          </PlanBlock>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" /> Objections & Responses
          </div>
          <div className="space-y-2">
            {a.attackPlan.objections.map((o, i) => (
              <div key={i} className="rounded-lg border border-border bg-background/60 p-3">
                <div className="mb-1 text-sm font-medium text-foreground/90">"{o.question}"</div>
                <div className="text-xs text-muted-foreground">→ {o.answer}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-xl border border-border bg-background/40 p-4">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Customers praise</h4>
          <ul className="space-y-1 text-sm">
            {a.reviewIntel.praised.map((s, i) => <li key={i} className="text-emerald-300/90">✓ {s}</li>)}
          </ul>
          <h4 className="mb-2 mt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Customers complain</h4>
          <ul className="space-y-1 text-sm">
            {a.reviewIntel.complained.map((s, i) => <li key={i} className="text-red-300/90">✗ {s}</li>)}
          </ul>
        </section>
        <section className="rounded-xl border border-border bg-background/40 p-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5 text-amber-400" /> Business insights
          </h4>
          <ul className="space-y-1 text-sm text-foreground/90">
            {a.businessInsights.map((s, i) => <li key={i}>• {s}</li>)}
          </ul>
          <h4 className="mb-2 mt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Recommended services</h4>
          <div className="flex flex-wrap gap-1.5">
            {a.recommendedServices.map((s) => (
              <span key={s} className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary">{s}</span>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-gradient-to-br from-primary/10 to-transparent p-4">
        <h4 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> AI recommendation
        </h4>
        <p className="text-sm leading-relaxed text-foreground/90">{a.summary}</p>
      </section>
    </div>
  );
}

function ReasonList({ icon, items, tone }: { icon: React.ReactNode; items: string[]; tone: "emerald" | "red" | "amber" }) {
  const color = tone === "emerald" ? "text-emerald-300/90" : tone === "red" ? "text-red-300/90" : "text-amber-300/90";
  return (
    <ul className="space-y-1 text-xs">
      {items.map((s, i) => (
        <li key={i} className={`flex items-start gap-1.5 ${color}`}>
          <span className="mt-0.5">{icon}</span>
          <span>{s}</span>
        </li>
      ))}
    </ul>
  );
}

function PlanBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function InfoRow({
  icon, label, value, href,
}: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="block truncate text-sm text-primary hover:underline">
          {value}
        </a>
      ) : (
        <div className="truncate text-sm text-foreground/90">{value}</div>
      )}
    </div>
  );
}