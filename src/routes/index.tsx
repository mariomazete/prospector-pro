import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  const [quick, setQuick] = useState<QuickFilterState>({
    noWebsite: false,
    minRating45: false,
    minReviews50: false,
    highOpportunity: false,
  });

  const handleSearch = async (v: SearchValues) => {
    setLoading(true);
    setSearched(true);
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
