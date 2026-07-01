import { useEffect, useState } from "react";
import { History, RefreshCw, X, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listSearchHistory, deleteSearchHistory, type SearchHistoryRow } from "@/lib/search-history.functions";
import { toast } from "sonner";

interface Props {
  onOpen: (row: SearchHistoryRow) => void;
  onRefresh: (row: SearchHistoryRow) => void;
  refreshToken: number;
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export function RecentSearches({ onOpen, onRefresh, refreshToken }: Props) {
  const [items, setItems] = useState<SearchHistoryRow[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listSearchHistory()
      .then((r) => { if (!cancelled) setItems(r.items); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [refreshToken]);

  const handleDelete = async (id: string) => {
    await deleteSearchHistory({ data: { id } });
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("Search removed from history.");
  };

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Recent searches</span>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="grid gap-2 border-t border-border/60 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((row) => (
            <div
              key={row.id}
              className="group rounded-xl border border-border/60 bg-background/40 p-3 transition hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {row.niche}
                    <span className="text-muted-foreground"> • {row.country}</span>
                    {row.city && <span className="text-muted-foreground"> • {row.city}</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {row.result_count.toLocaleString()} companies · {relative(row.updated_at)}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(row.id)}
                  className="opacity-0 transition group-hover:opacity-100"
                  aria-label="Delete"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              <div className="mt-3 flex gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onOpen(row)}
                  className="h-7 flex-1 rounded-md text-[11px]"
                >
                  <FolderOpen className="mr-1 h-3 w-3" /> Open
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRefresh(row)}
                  className="h-7 rounded-md text-[11px]"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}