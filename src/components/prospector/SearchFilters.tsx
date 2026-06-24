import { useState } from "react";
import { Search, MapPin, Globe, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES, NICHES } from "@/lib/mock-businesses";

export interface SearchValues {
  country: string;
  city: string;
  niche: string;
}

interface Props {
  onSearch: (v: SearchValues) => void;
  loading: boolean;
}

export function SearchFilters({ onSearch, loading }: Props) {
  const [country, setCountry] = useState("Portugal");
  const [city, setCity] = useState("Lisbon");
  const [niche, setNiche] = useState("Pet Shop");

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Globe className="h-3.5 w-3.5" /> Country
          </Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="h-11 rounded-xl bg-input/40 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> City
          </Label>
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Lisbon, Madrid, Miami…"
            className="h-11 rounded-xl bg-input/40 border-border"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5" /> Niche
          </Label>
          <Select value={niche} onValueChange={setNiche}>
            <SelectTrigger className="h-11 rounded-xl bg-input/40 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NICHES.map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => onSearch({ country, city, niche })}
          disabled={loading}
          className="h-11 rounded-xl bg-primary px-6 font-medium text-primary-foreground shadow-[0_4px_20px_-4px_rgba(59,130,246,0.5)] transition hover:bg-primary/90"
        >
          <Search className="mr-2 h-4 w-4" />
          {loading ? "Searching…" : "Search Businesses"}
        </Button>
      </div>
    </div>
  );
}