import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface QuickFilterState {
  noWebsite: boolean;
  minRating45: boolean;
  minReviews50: boolean;
  highOpportunity: boolean;
  hasWhatsapp: boolean;
}

interface Props {
  value: QuickFilterState;
  onChange: (v: QuickFilterState) => void;
  total: number;
  filtered: number;
}

const items: { key: keyof QuickFilterState; label: string }[] = [
  { key: "noWebsite", label: "Only businesses without websites" },
  { key: "minRating45", label: "Minimum rating 4.5" },
  { key: "minReviews50", label: "Minimum 50 reviews" },
  { key: "highOpportunity", label: "Only high opportunity (>80)" },
  { key: "hasWhatsapp", label: "Only with WhatsApp" },
];

export function QuickFilters({ value, onChange, total, filtered }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card/60 px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {items.map((it) => (
          <div key={it.key} className="flex items-center gap-2">
            <Checkbox
              id={it.key}
              checked={value[it.key]}
              onCheckedChange={(c) =>
                onChange({ ...value, [it.key]: Boolean(c) })
              }
            />
            <Label htmlFor={it.key} className="cursor-pointer text-sm text-foreground/90">
              {it.label}
            </Label>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{filtered}</span> / {total} results
      </div>
    </div>
  );
}