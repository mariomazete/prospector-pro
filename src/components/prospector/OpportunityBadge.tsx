interface Props {
  score: number;
}

export function OpportunityBadge({ score }: Props) {
  const tone =
    score >= 80
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : score >= 50
        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
        : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
  return (
    <div className="flex items-center gap-2">
      <div className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-semibold tabular-nums ${tone}`}>
        <span>{score}</span>
        <span className="opacity-50">/100</span>
      </div>
    </div>
  );
}