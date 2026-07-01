import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Zap, ArrowLeft, Loader2, Calendar, Star, X, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  listPipeline, changeStatus, removeFromPipeline,
  STATUS_LABELS, PIPELINE_STATUSES,
  type CompanyWithState, type CompanyStatus,
} from "@/lib/companies-client";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "Pipeline — Prospector AI" }] }),
  component: PipelinePage,
});

const STATUS_COLORS: Record<CompanyStatus, string> = {
  never_prospected: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  prospecting: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  contacted: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  replied: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  meeting: "border-purple-500/40 bg-purple-500/10 text-purple-300",
  proposal: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300",
  negotiating: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  client: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  lost: "border-red-500/40 bg-red-500/10 text-red-300",
  archived: "border-neutral-500/40 bg-neutral-500/10 text-neutral-300",
};

function PipelinePage() {
  const [companies, setCompanies] = useState<CompanyWithState[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      setCompanies(await listPipeline());
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const columns = useMemo(() => {
    const cols: Record<CompanyStatus, CompanyWithState[]> = {
      never_prospected: [], prospecting: [], contacted: [], replied: [],
      meeting: [], proposal: [], negotiating: [], client: [], lost: [], archived: [],
    };
    for (const c of companies) {
      const s = c.user_state?.status ?? "prospecting";
      cols[s].push(c);
    }
    return cols;
  }, [companies]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const handleStatus = async (c: CompanyWithState, to: CompanyStatus) => {
    try {
      await changeStatus(c.id, c.user_state?.status ?? null, to);
      toast.success(`Moved to ${STATUS_LABELS[to]}`);
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleRemove = async (c: CompanyWithState) => {
    if (!confirm("Remove from Pipeline? (Company stays in Base)")) return;
    try {
      await removeFromPipeline(c.id);
      refresh();
    } catch (e) { toast.error((e as Error).message); }
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
            <span className="text-xs text-muted-foreground">/ Pipeline</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/base"><Button variant="ghost" size="sm" className="h-9 rounded-lg text-xs"><Database className="mr-1 h-3.5 w-3.5" /> Base</Button></Link>
            <Link to="/"><Button variant="ghost" size="sm" className="h-9 rounded-lg text-xs"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Prospect</Button></Link>
            <Button variant="ghost" size="sm" onClick={signOut} className="h-9 rounded-lg text-xs">Sign out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">
          Pipeline Comercial <span className="ml-2 text-sm font-normal text-muted-foreground">{companies.length} negócios ativos</span>
        </h1>
        {loading ? (
          <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : companies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 py-24 text-center">
            <p className="text-sm text-muted-foreground">Nenhum negócio no pipeline. Vá para <Link to="/base" className="text-primary underline">Base de Empresas</Link> e clique em "Adicionar ao Pipeline".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {PIPELINE_STATUSES.map((status) => (
              <div key={status} className="rounded-2xl border border-border bg-card/40 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase ${STATUS_COLORS[status]}`}>
                    {STATUS_LABELS[status]}
                  </div>
                  <span className="text-xs text-muted-foreground">{columns[status].length}</span>
                </div>
                <div className="space-y-2">
                  {columns[status].map((c) => (
                    <PipelineCard key={c.id} c={c} onStatus={(to) => handleStatus(c, to)} onRemove={() => handleRemove(c)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function PipelineCard({ c, onStatus, onRemove }: {
  c: CompanyWithState;
  onStatus: (to: CompanyStatus) => void;
  onRemove: () => void;
}) {
  const overdue = c.user_state?.next_followup_at && new Date(c.user_state.next_followup_at) < new Date();
  return (
    <div className="group rounded-xl border border-border bg-background/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{c.name}</div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.city}, {c.country}</div>
        </div>
        <button onClick={onRemove} className="opacity-0 transition group-hover:opacity-100" aria-label="Remove">
          <X className="h-3.5 w-3.5 text-muted-foreground hover:text-red-400" />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {c.rating?.toFixed(1) ?? "—"}</span>
        {c.user_state?.next_followup_at && (
          <span className={`inline-flex items-center gap-1 ${overdue ? "text-red-400" : ""}`}>
            <Calendar className="h-3 w-3" /> {new Date(c.user_state.next_followup_at).toLocaleDateString()}
          </span>
        )}
      </div>
      <select
        value={c.user_state?.status ?? "prospecting"}
        onChange={(e) => onStatus(e.target.value as CompanyStatus)}
        className="mt-2 w-full rounded-md border border-border bg-background px-1.5 py-1 text-[11px]"
      >
        {PIPELINE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
      </select>
    </div>
  );
}