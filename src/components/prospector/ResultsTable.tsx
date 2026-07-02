import { useEffect, useMemo } from "react";
import { Star, ExternalLink, Eye, Image as ImageIcon, Phone, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Business } from "@/lib/mock-businesses";
import { calcOpportunityScore } from "@/lib/mock-businesses";
import { OpportunityBadge } from "./OpportunityBadge";

const PAGE_SIZE = 50;

interface Props {
  data: Business[];
  loading: boolean;
  onView: (b: Business) => void;
  page: number;
  onPageChange: (page: number) => void;
}

export function ResultsTable({ data, loading, onView, page, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));

  useEffect(() => { if (page > totalPages) onPageChange(totalPages); }, [page, totalPages, onPageChange]);

  const pageData = useMemo(
    () => data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [data, page],
  );

  if (loading) return <TableSkeleton />;

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card py-20 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-muted">
          <Eye className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-medium text-foreground">No results</h3>
        <p className="text-xs text-muted-foreground">
          Try adjusting your filters or running a new search.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div>
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col />
            <col className="w-20" />
            <col className="w-20" />
            <col className="w-24" />
            <col className="w-40" />
            <col className="w-20" />
            <col className="w-32" />
            <col className="w-28" />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-card/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-2 py-3 font-medium">Rating</th>
              <th className="px-2 py-3 font-medium">Reviews</th>
              <th className="px-2 py-3 font-medium">Website</th>
              <th className="px-2 py-3 font-medium">Phone</th>
              <th className="px-2 py-3 font-medium">Photos</th>
              <th className="px-2 py-3 font-medium">Opportunity</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((b) => {
              const score = calcOpportunityScore(b);
              return (
                <tr
                  key={b.id}
                  onClick={() => onView(b)}
                  className="cursor-pointer border-b border-border/60 transition hover:bg-accent/40"
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                        {b.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-foreground">{b.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{b.category} · {b.city}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3.5">
                    <div className="inline-flex items-center gap-1 text-foreground">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="tabular-nums">{b.rating.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3.5 tabular-nums text-muted-foreground">{b.reviewsCount}</td>
                  <td className="px-2 py-3.5">
                    {b.website ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                        Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-400">
                        None
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3.5">
                    <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate tabular-nums">{b.phone || "—"}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3.5">
                    <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ImageIcon className="h-3.5 w-3.5" />
                      {b.photos.length}
                    </div>
                  </td>
                  <td className="px-2 py-3.5">
                    <OpportunityBadge score={score} />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div
                      className="inline-flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-lg text-xs"
                        onClick={() => onView(b)}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" /> View
                      </Button>
                      {b.website && (
                        <a
                          href={b.website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center rounded-lg px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 border-t border-border bg-card/50 px-4 py-3 text-xs text-muted-foreground">
          <div>
            Showing <span className="text-foreground">{(page - 1) * PAGE_SIZE + 1}</span>–
            <span className="text-foreground">{Math.min(page * PAGE_SIZE, data.length)}</span> of{" "}
            <span className="text-foreground">{data.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg text-xs"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>
            <span className="tabular-nums">
              Page <span className="text-foreground">{page}</span> / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg text-xs"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="divide-y divide-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}