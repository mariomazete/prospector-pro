import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Sparkles, Download, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchFilters, type SearchValues } from "@/components/prospector/SearchFilters";
import { QuickFilters, type QuickFilterState } from "@/components/prospector/QuickFilters";
import { ResultsTable } from "@/components/prospector/ResultsTable";
import { BusinessModal } from "@/components/prospector/BusinessModal";
import {
  calcOpportunityScore,
  type Business,
} from "@/lib/mock-businesses";
import { searchBusinesses } from "@/lib/prospector.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prospector AI — Find businesses with website opportunities" },
      { name: "description", content: "Find local businesses worldwide with high potential to buy a professional website." },
      { property: "og:title", content: "Prospector AI" },
      { property: "og:description", content: "Find businesses with website opportunities worldwide." },
    ],
  }),
  component: Index,
});

function Index() {
  const [results, setResults] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [active, setActive] = useState<Business | null>(null);
  const [progress, setProgress] = useState<{
    country: string;
    currentCity: string;
    processed: number;
    total: number;
    found: number;
    dupes: number;
    errored: number;
    startedAt: number;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [quick, setQuick] = useState<QuickFilterState>({
    noWebsite: false,
    minRating45: false,
    minReviews50: false,
    highOpportunity: false,
  });

  const handleSearch = async (v: SearchValues) => {
    setLoading(true);
    setSearched(true);
    setProgress(null);
    setResults([]);
    const city = v.city.trim();

    if (!city) {
      // Country-wide streaming scan
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch("/api/public/prospector-stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ country: v.country, niche: v.niche }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const msg = await res.text().catch(() => "");
          toast.error(msg || `Scan failed (${res.status}).`);
          setLoading(false);
          return;
        }
        const seenIds = new Set<string>();
        const collected: Business[] = [];
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        const startedAt = Date.now();
        setProgress({
          country: v.country, currentCity: "…", processed: 0, total: 0,
          found: 0, dupes: 0, errored: 0, startedAt,
        });
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            let ev: {
              type: string;
              city?: string;
              totalCities?: number;
              processed?: number;
              found?: number;
              dupes?: number;
              errored?: number;
              businesses?: Business[];
            };
            try { ev = JSON.parse(line); } catch { continue; }
            if (ev.type === "start") {
              setProgress((p) => p && { ...p, total: ev.totalCities ?? 0 });
            } else if (ev.type === "city_start") {
              setProgress((p) => p && { ...p, currentCity: ev.city ?? p.currentCity });
            } else if (ev.type === "city_done" || ev.type === "city_error") {
              if (ev.businesses?.length) {
                for (const b of ev.businesses) {
                  if (!seenIds.has(b.id)) {
                    seenIds.add(b.id);
                    collected.push(b);
                  }
                }
                setResults([...collected].sort(
                  (a, b) => calcOpportunityScore(b) - calcOpportunityScore(a),
                ));
              }
              setProgress((p) => p && {
                ...p,
                processed: ev.processed ?? p.processed,
                total: ev.totalCities ?? p.total,
                found: ev.found ?? p.found,
                dupes: ev.dupes ?? p.dupes,
                errored: ev.errored ?? p.errored,
              });
            } else if (ev.type === "done") {
              toast.success(
                `Scan complete — ${ev.found ?? collected.length} businesses across ${ev.processed} cities.`,
              );
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error(err);
          toast.error("National scan failed.");
        }
      } finally {
        abortRef.current = null;
        setLoading(false);
      }
      return;
    }

    try {
      const res = await searchBusinesses({ data: v });
      if (res.error) toast.error(res.error);
      const sorted = [...res.businesses].sort(
        (a, b) => calcOpportunityScore(b) - calcOpportunityScore(a),
      );
      setResults(sorted);
      if (!res.error && sorted.length === 0) toast("No results found for this query.");
    } catch (err) {
      console.error(err);
      toast.error("Search failed. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const cancelScan = () => {
    abortRef.current?.abort();
  };

  const filtered = useMemo(() => {
    return results.filter((b) => {
      if (quick.noWebsite && b.website) return false;
      if (quick.minRating45 && b.rating < 4.5) return false;
      if (quick.minReviews50 && b.reviewsCount < 50) return false;
      if (quick.highOpportunity && calcOpportunityScore(b) <= 80) return false;
      return true;
    });
  }, [results, quick]);

  const handleExport = () => {
    const rows = [
      ["Company", "Phone", "Website", "City", "Country", "Rating", "Reviews", "Score"],
      ...filtered.map((b) => [
        b.name, b.phone, b.website ?? "", b.city, b.country,
        b.rating.toFixed(1), String(b.reviewsCount), String(calcOpportunityScore(b)),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospector-ai-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-blue-700 shadow-[0_4px_20px_-4px_rgba(59,130,246,0.6)]">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold tracking-tight">PROSPECTOR AI</span>
              <span className="hidden text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">Private</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              disabled={filtered.length === 0}
              className="h-9 rounded-lg text-xs"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Hero */}
        <section className="mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            AI-powered prospecting
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Find businesses with website opportunities
            <span className="ml-2 bg-gradient-to-r from-primary to-blue-300 bg-clip-text text-transparent">worldwide</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Discover local businesses with strong reputation but missing or outdated websites — your highest-converting leads.
          </p>
        </section>

        {/* Filters */}
        <div className="space-y-3">
          <SearchFilters onSearch={handleSearch} loading={loading} />
          {progress && (
            <ScanProgress progress={progress} loading={loading} onCancel={cancelScan} />
          )}
          {searched && (
            <QuickFilters
              value={quick}
              onChange={setQuick}
              total={results.length}
              filtered={filtered.length}
            />
          )}
        </div>

        {/* Results */}
        <div className="mt-6">
          {!searched ? (
            <EmptyState />
          ) : (
            <ResultsTable data={filtered} loading={loading} onView={setActive} />
          )}
        </div>
      </main>

      <BusinessModal business={active} onClose={() => setActive(null)} />
    </div>
  );
}

function ScanProgress({
  progress, loading, onCancel,
}: {
  progress: {
    country: string; currentCity: string; processed: number; total: number;
    found: number; dupes: number; errored: number; startedAt: number;
  };
  loading: boolean;
  onCancel: () => void;
}) {
  const pct = progress.total > 0 ? Math.min(100, (progress.processed / progress.total) * 100) : 0;
  const elapsed = (Date.now() - progress.startedAt) / 1000;
  const rate = progress.processed > 0 ? elapsed / progress.processed : 0;
  const remainingSec = rate * Math.max(0, progress.total - progress.processed);
  const eta = remainingSec > 60
    ? `${Math.ceil(remainingSec / 60)} min`
    : `${Math.ceil(remainingSec)}s`;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Scanning {progress.country}
          </div>
          <div className="mt-1 truncate text-sm font-medium">
            {loading ? `Current city: ${progress.currentCity}` : "Scan complete"}
          </div>
        </div>
        {loading && (
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 rounded-lg text-xs">
            Cancel
          </Button>
        )}
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-input/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-blue-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-5">
        <Stat label="Cities" value={`${progress.processed}/${progress.total}`} />
        <Stat label="Found" value={String(progress.found)} />
        <Stat label="Duplicates" value={String(progress.dupes)} />
        <Stat label="Errors" value={String(progress.errored)} />
        <Stat label="ETA" value={loading ? eta : "—"} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">{label}</div>
      <div className="text-xs font-medium text-foreground">{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 py-24 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <h3 className="text-base font-medium">Start your first search</h3>
      <p className="max-w-sm text-xs text-muted-foreground">
        Pick a country, city and niche above. Prospector AI will return up to 100 businesses ranked by opportunity score.
      </p>
    </div>
  );
}
