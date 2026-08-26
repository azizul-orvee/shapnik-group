"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "@/components/app/chart-frame";
import { formatTakaShort, TAKA } from "@/lib/money";

export type PacePoint = {
  label: string;
  paid: number | null;
  target: number;
};

function compact(value: number) {
  if (Math.abs(value) >= 1000) return `${TAKA}${Math.round(value / 1000)}k`;
  return `${TAKA}${value}`;
}

function PaceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: PacePoint }>;
  label?: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const behind = row.paid !== null ? row.paid - row.target : null;

  return (
    <div className="bg-popover text-popover-foreground min-w-44 rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium">{label}</p>
      <ul className="space-y-1">
        <li className="flex items-center gap-2">
          <span className="bg-viz-monthly size-2 shrink-0 rounded-full" aria-hidden />
          <span className="text-muted-foreground">Paid so far</span>
          <span className="ml-auto font-medium tabular-nums">
            {row.paid === null ? "—" : formatTakaShort(row.paid)}
          </span>
        </li>
        <li className="flex items-center gap-2">
          <span
            className="border-muted-foreground size-2 shrink-0 rounded-full border-2"
            aria-hidden
          />
          <span className="text-muted-foreground">Target pace</span>
          <span className="ml-auto font-medium tabular-nums">{formatTakaShort(row.target)}</span>
        </li>
        {behind !== null ? (
          <li className="text-muted-foreground mt-1 border-t pt-1.5">
            {behind >= 0
              ? `${formatTakaShort(behind)} ahead of pace`
              : `${formatTakaShort(Math.abs(behind))} behind pace`}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/**
 * Cumulative amount paid against what is owed as the year progresses. Both
 * series are taka on one axis — never a second scale.
 */
export function PaceChart({ data }: { data: PacePoint[] }) {
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <li className="flex items-center gap-1.5">
          <span className="bg-viz-monthly size-2.5 rounded-full" aria-hidden />
          <span className="text-muted-foreground">Paid so far</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="border-muted-foreground size-2.5 rounded-full border-2" aria-hidden />
          <span className="text-muted-foreground">Target pace</span>
        </li>
      </ul>

      <ChartFrame>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="paceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--viz-monthly)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--viz-monthly)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              tickFormatter={compact}
            />
            <Tooltip cursor={{ stroke: "var(--viz-grid)" }} content={<PaceTooltip />} />
            <Line
              isAnimationActive={false}
              type="monotone"
              dataKey="target"
              stroke="var(--color-muted-foreground)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={false}
            />
            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey="paid"
              stroke="var(--viz-monthly)"
              strokeWidth={2}
              fill="url(#paceFill)"
              connectNulls={false}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--viz-surface)" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
