import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  MapPin, Phone, Globe, Clock, Sparkles, Copy, Check, Star, ExternalLink,
} from "lucide-react";
import type { Business } from "@/lib/mock-businesses";
import { calcOpportunityScore } from "@/lib/mock-businesses";
import { OpportunityBadge } from "./OpportunityBadge";

interface Props {
  business: Business | null;
  onClose: () => void;
}

function generatePitch(b: Business): string {
  return `Hello ${b.name} team,

I noticed you have ${b.reviewsCount}+ Google reviews and a ${b.rating.toFixed(1)}-star reputation in ${b.city}. That's impressive social proof.

However, ${b.website ? "your current website doesn't fully showcase your reputation" : "your business still doesn't have a professional website"}. Today, most customers search online before making a decision — a modern site builds trust, simplifies communication, and brings in more clients on autopilot.

I build fast, mobile-first websites integrated with WhatsApp, Google Maps, and lead automation. I'd love to send you a free concept showing exactly how your business website could look.

Would you be open to a quick look?`;
}

export function BusinessModal({ business, onClose }: Props) {
  const [pitch, setPitch] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!business) return null;
  const score = calcOpportunityScore(business);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setPitch(generatePitch(business));
      setGenerating(false);
    }, 900);
  };

  const handleCopy = () => {
    if (!pitch) return;
    navigator.clipboard.writeText(pitch);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={!!business} onOpenChange={(o) => { if (!o) { onClose(); setPitch(null); } }}>
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
              <OpportunityBadge score={score} />
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-6 p-6">
          {/* Info grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Address" value={business.address} />
            <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={business.phone} />
            <InfoRow
              icon={<Globe className="h-3.5 w-3.5" />}
              label="Website"
              value={business.website ?? "No website"}
              href={business.website ?? undefined}
            />
            <InfoRow icon={<Clock className="h-3.5 w-3.5" />} label="Hours" value={business.hours} />
            <InfoRow
              icon={<ExternalLink className="h-3.5 w-3.5" />}
              label="Google Maps"
              value="Open in Maps"
              href={business.mapsUrl}
            />
            <InfoRow icon={<Star className="h-3.5 w-3.5" />} label="Rating" value={`${business.rating.toFixed(1)} (${business.reviewsCount} reviews)`} />
          </div>

          {/* Photos */}
          <section>
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Photos</h4>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {business.photos.slice(0, 6).map((p, i) => (
                <img
                  key={i}
                  src={p}
                  alt=""
                  loading="lazy"
                  className="h-28 w-40 shrink-0 rounded-xl border border-border object-cover"
                />
              ))}
            </div>
          </section>

          {/* AI summary */}
          <section className="rounded-xl border border-border bg-background/40 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> AI Review Summary
            </div>
            <ul className="space-y-1.5 text-sm text-foreground/90">
              {business.aiSummary.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  {s}
                </li>
              ))}
            </ul>
          </section>

          {/* Reviews */}
          <section>
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Top Reviews</h4>
            <div className="space-y-2">
              {business.reviews.map((r, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-background/40 p-3 text-sm"
                >
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

          {/* AI pitch */}
          <section className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" /> AI Pitch
              </div>
              {!pitch ? (
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="h-8 rounded-lg bg-primary text-xs hover:bg-primary/90"
                >
                  {generating ? "Generating…" : "Generate Pitch"}
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={handleCopy} className="h-8 rounded-lg text-xs">
                  {copied ? <><Check className="mr-1 h-3.5 w-3.5" /> Copied</> : <><Copy className="mr-1 h-3.5 w-3.5" /> Copy</>}
                </Button>
              )}
            </div>
            {pitch ? (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">{pitch}</pre>
            ) : (
              <p className="text-xs text-muted-foreground">
                Generate a personalized outreach message powered by AI — tailored to this business's reviews and signals.
              </p>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
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