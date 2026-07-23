import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function ReputationBadge({
  ratingAvg = 0,
  ratingCount = 0,
  reputationScore,
  className,
  compact = false,
}: {
  ratingAvg?: number;
  ratingCount?: number;
  reputationScore?: number;
  className?: string;
  compact?: boolean;
}) {
  const score =
    typeof reputationScore === "number"
      ? reputationScore
      : Math.min(
          100,
          Math.round(ratingAvg * 18 + Math.min(ratingCount, 40) * 0.5),
        );

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] text-zinc-600",
        className,
      )}
    >
      <Star className="size-3.5 fill-amber-400 text-amber-400" />
      <span className="font-medium text-zinc-900">
        {ratingAvg > 0 ? ratingAvg.toFixed(1) : "—"}
      </span>
      {!compact && (
        <>
          <span className="text-zinc-400">·</span>
          <span>{ratingCount} avaliações</span>
          <span className="text-zinc-400">·</span>
          <span>Rep. {score}</span>
        </>
      )}
    </div>
  );
}
