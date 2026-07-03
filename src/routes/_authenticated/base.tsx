import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Zap, ArrowLeft, Loader2, Search, Heart, Bookmark, Star, Globe, Phone,
  MapPin, Database as DatabaseIcon, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { whatsappLink } from "@/lib/whatsapp";
import {
  listCompanies, listFacets, addToPipeline, removeFromPipeline,
  toggleFavorite, STATUS_LABELS, companyToBusiness,
  type CompanyWithState, type CompanyStatus, type CompanyFilters,
} from "@/lib/companies-client";
import { BusinessModal } from "@/components/prospector/BusinessModal";
import { prospectorStore, useProspectorStore } from "@/lib/prospector-store";

export const Route = createFileRoute("/_authenticated/base")({
  head: () => ({ meta: [{ title: "Base de Empresas — Prospector AI" }] }),
  component: BasePage,
});

const PAGE_SIZE = 50;

function BasePage() {
  const store = useProspectorStore();
  const [rows, setRows] = useState<CompanyWithState[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [facets, setFacets] = useState<{ countries: string[]; categories: string[] }>({ countries: [], categories: [] });
  const [filters, setFilters] = useState<CompanyFilters>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await listCompanies({ ...filters, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      const visible = filters.inPipelineOnly
        ? res.rows
        : res.rows.filter((c) => !c.user_state?.in_pipeline);
      setRows(visible);
      setTotal(res.total - (res.rows.length - visible.length));
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoading(false); }
  };

  useEffect(() => { listFacets().then(setFacets).catch(() => {}); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const update = (patch: Partial<CompanyFilters>) => {
    setPage(0);
    setFilters((f) => ({ ...f, ...patch }));
  };

  const handlePipeline = async (c: CompanyWithState) => {
    try {
      if (c.user_state?.in_pipeline) {
        await removeFromPipeline(c.id);
        toast.success("Removido do Pipeline");
      } else {
        await addToPipeline(c.id);
        toast.success("Adicionado ao Pipeline");
      }
      load();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleFav = async (c: CompanyWithState) => {
    try {
      await toggleFavorite(c.id, !c.user_state?.favorite);
      load();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-blue-700">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-semibold tracking-tight">PROSPECTOR AI</span>
            </Link>
            <span className="text-xs text-muted-foreground">/ Base</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/crm"><Button variant="ghost" size="sm" className="h-9 rounded-lg text-xs">Pipeline</Button></Link>
            <Link to="/"><Button variant="ghost" size="sm" className="h-9 rounded-lg text-xs"><ArrowLeft className="mr-1 h-3.5 w-3.5" /> Prospect</Button></Link>
            <Button variant="ghost" size="sm" onClick={signOut} className="h-9 rounded-lg text-xs">Sign out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="mb-4 flex items-center gap-3">
          <DatabaseIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Base de Empresas</h1>
          <span className="text-sm text-muted-foreground">{total.toLocaleString()} empresas</span>
        </div>

        <div className="mb-4 rounded-2xl border border-border bg-card/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filtros
          </div>
          <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nome…"
                defaultValue={filters.search ?? ""}
                onChange={(e) => update({ search: e.target.value || undefined })}
                className="h-9 pl-8"
              />
            </div>
            <Select value={filters.country ?? "all"} onValueChange={(v) => update({ country: v === "all" ? null : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="País" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos países</SelectItem>
                {facets.countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.category ?? "all"} onValueChange={(v) => update({ category: v === "all" ? null : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {facets.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select
              value={filters.hasWebsite === true ? "yes" : filters.hasWebsite === false ? "no" : "any"}
              onValueChange={(v) => update({ hasWebsite: v === "yes" ? true : v === "no" ? false : null })}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Website" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Website: qualquer</SelectItem>
                <SelectItem value="no">Sem website</SelectItem>
                <SelectItem value="yes">Com website</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.minScore ? String(filters.minScore) : "0"}
              onValueChange={(v) => update({ minScore: v === "0" ? null : Number(v) })}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Score mínimo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Score: qualquer</SelectItem>
                <SelectItem value="60">Score ≥ 60</SelectItem>
                <SelectItem value="75">Score ≥ 75</SelectItem>
                <SelectItem value="85">Score ≥ 85 (Hot)</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={
                filters.favoritesOnly ? "fav"
                : filters.neverProspectedOnly ? "never"
                : filters.inPipelineOnly ? "pipeline"
                : filters.whatsappOnly ? "whatsapp"
                : filters.status ?? "all"
              }
              onValueChange={(v) => update({
                favoritesOnly: v === "fav",
                neverProspectedOnly: v === "never",
                inPipelineOnly: v === "pipeline",
                whatsappOnly: v === "whatsapp",
                status: v === "all" || v === "fav" || v === "never" || v === "pipeline" || v === "whatsapp" ? null : (v as CompanyStatus),
              })}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="fav">⭐ Favoritos</SelectItem>
                <SelectItem value="never">Nunca prospectadas</SelectItem>
                <SelectItem value="pipeline">No Pipeline</SelectItem>
                <SelectItem value="whatsapp">📱 Só WhatsApp</SelectItem>
                {(Object.keys(STATUS_LABELS) as CompanyStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 py-24 text-center text-sm text-muted-foreground">
            Nenhuma empresa encontrada. Faça uma pesquisa em <Link to="/" className="text-primary underline">Prospect</Link> para começar a alimentar a base.
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-background/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="w-[26%] px-3 py-2.5 text-left">Empresa</th>
                    <th className="w-[14%] px-3 py-2.5 text-left">Categoria</th>
                    <th className="w-[16%] px-3 py-2.5 text-left">Localização</th>
                    <th className="w-[8%] px-3 py-2.5 text-left">Rating</th>
                    <th className="w-[8%] px-3 py-2.5 text-left">Score</th>
                    <th className="w-[12%] px-3 py-2.5 text-left">Status</th>
                    <th className="w-[8%] px-3 py-2.5 text-left">Contato</th>
                    <th className="w-[8%] px-3 py-2.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => prospectorStore.set({ activeBusiness: companyToBusiness(c) })}
                      className="cursor-pointer border-t border-border/60 hover:bg-background/40"
                    >
                      <td className="truncate px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); handleFav(c); }} className="shrink-0">
                            <Heart className={`h-3.5 w-3.5 ${c.user_state?.favorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                          </button>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{c.name}</div>
                            {c.website ? (
                              <a href={c.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="truncate text-[11px] text-primary hover:underline">
                                {c.website.replace(/https?:\/\//, "")}
                              </a>
                            ) : <span className="text-[11px] text-red-400">Sem website</span>}
                          </div>
                        </div>
                      </td>
                      <td className="truncate px-3 py-2.5 text-muted-foreground">{c.category ?? "—"}</td>
                      <td className="truncate px-3 py-2.5 text-muted-foreground">{c.city}, {c.country}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {c.rating?.toFixed(1) ?? "—"}</span>
                        <span className="ml-1 text-[10px] text-muted-foreground">({c.reviews_count ?? 0})</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${
                          (c.opportunity_score ?? 0) >= 85 ? "bg-red-500/10 text-red-400"
                          : (c.opportunity_score ?? 0) >= 65 ? "bg-amber-500/10 text-amber-400"
                          : "bg-slate-500/10 text-slate-400"
                        }`}>{c.opportunity_score ?? 0}</span>
                      </td>
                      <td className="truncate px-3 py-2.5 text-xs text-muted-foreground">
                        {STATUS_LABELS[c.user_state?.status ?? "never_prospected"]}
                      </td>
                      <td className="truncate px-3 py-2.5 text-muted-foreground">
                        <div className="flex gap-2">
                          {c.phone && (() => {
                            const wa = whatsappLink(c.phone);
                            return wa ? (
                              <a
                                href={wa}
                                target="_blank"
                                rel="noreferrer"
                                title="WhatsApp"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Phone className="h-3.5 w-3.5 text-emerald-400 hover:text-emerald-300" />
                              </a>
                            ) : (
                              <a href={`tel:${c.phone}`} title="Ligar" onClick={(e) => e.stopPropagation()}>
                                <Phone className="h-3.5 w-3.5 hover:text-primary" />
                              </a>
                            );
                          })()}
                          {c.website && <a href={c.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><Globe className="h-3.5 w-3.5 hover:text-primary" /></a>}
                          {c.maps_url && <a href={c.maps_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><MapPin className="h-3.5 w-3.5 hover:text-primary" /></a>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          size="sm"
                          variant={c.user_state?.in_pipeline ? "outline" : "default"}
                          onClick={(e) => { e.stopPropagation(); handlePipeline(c); }}
                          className="h-7 rounded-lg px-2 text-[11px]"
                        >
                          <Bookmark className="mr-1 h-3 w-3" />
                          {c.user_state?.in_pipeline ? "No Pipeline" : "Pipeline"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <div>Página {page + 1} de {totalPages}</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="h-8 rounded-lg">Anterior</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="h-8 rounded-lg">Próxima</Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <BusinessModal
        business={store.activeBusiness}
        onClose={() => { prospectorStore.set({ activeBusiness: null }); load(); }}
      />
    </div>
  );
}