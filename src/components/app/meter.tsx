import { cn } from "@/lib/utils";
import { formatTakaShort } from "@/lib/money";

export type MeterSegment = {
  label: string;
  value: number;
  /** A `--viz-*` token name, e.g. "monthly". */
  tone: "monthly" | "onetime" | "good" | "warning" | "critical";
};

const FILL: Record<MeterSegment["tone"], string> = {
  monthly: "bg-viz-monthly",
  onetime: "bg-viz-onetime",
  good: "bg-viz-good",
  warning: "bg-viz-warning",
  critical: "bg-viz-critical",
};

const DOT: Record<MeterSegment["tone"], string> = FILL;

/**
 * A stacked progress meter. The unfilled remainder is the track, so the whole
 * bar reads as "of the target" rather than "of what has been paid".
 * Segments are separated by a 2px surface gap rather than a border.
 */
export function Meter({
  segments,
  target,
  height = "md",
  className,
}: {
  segments: MeterSegment[];
  target: number;
  height?: "sm" | "md" | "lg";
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const scale = target > 0 ? Math.max(target, total) : total || 1;
  const heights = { sm: "h-2", md: "h-3", lg: "h-5" };

  return (
    <div
      className={cn("bg-viz-track w-full overflow-hidden rounded-full", heights[height], className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={Math.round(total)}
      aria-valuetext={`${formatTakaShort(total)} of ${formatTakaShort(target)}`}
    >
      <div className="flex h-full w-full">
        {segments.map((segment, index) =>
          segment.value <= 0 ? null : (
            <div
              key={segment.label}
              className={cn(
                "h-full first:rounded-l-full",
                FILL[segment.tone],
                // 2px of surface separates touching segments.
                index > 0 && "ml-0.5",
              )}
              style={{ width: `${(segment.value / scale) * 100}%` }}
            />
          ),
        )}
      </div>
    </div>
  );
}

/** Legend row for a meter — identity never rests on colour alone. */
export function MeterLegend({ segments }: { segments: MeterSegment[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {segments.map((segment) => (
        <li key={segment.label} className="flex items-center gap-1.5 text-xs">
          <span className={cn("size-2.5 shrink-0 rounded-full", DOT[segment.tone])} aria-hidden />
          <span className="text-muted-foreground">{segment.label}</span>
          <span className="font-medium tabular-nums">{formatTakaShort(segment.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Circular completion dial for a single percentage — used where the headline is
 * one number rather than a comparison.
 */
export function ProgressRing({
  value,
  label,
  sublabel,
  size = 132,
  tone = "monthly",
}: {
  value: number;
  label: string;
  sublabel?: string;
  size?: number;
  tone?: MeterSegment["tone"];
}) {
  const pct = Math.max(0, Math.min(1, value));
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeColor = `var(--viz-${tone === "onetime" ? "onetime" : tone})`;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--viz-track)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-semibold">{label}</span>
        {sublabel ? (
          <span className="text-muted-foreground mt-0.5 text-xs">{sublabel}</span>
        ) : null}
      </div>
    </div>
  );
}
