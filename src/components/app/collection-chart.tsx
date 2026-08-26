"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "@/components/app/chart-frame";
import type { MonthBar } from "@/server/progress";

type Row = MonthBar & { rate: number };

type ShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: Row;
};

/** Recharts clones element-form shapes with untyped props; the function form is
 * the supported path, so both shapes are plain renderers called from `shape`. */

/** Rounded top only on the segment that actually caps the stack; square at the baseline. */
function roundedTopPath(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height);
  return [
    `M${x},${y + height}`,
    `L${x},${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `L${x + width - r},${y}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `L${x + width},${y + height}`,
    "Z",
  ].join(" ");
}

function PaidShape({ x = 0, y = 0, width = 0, height = 0, fill, payload }: ShapeProps) {
  if (height <= 0) return null;
  // Only cap the paid segment when nothing is stacked on top of it.
  const capped = (payload?.pending ?? 0) === 0;
  return capped ? (
    <path d={roundedTopPath(x, y, width, height, 4)} fill={fill} />
  ) : (
    <rect x={x} y={y} width={width} height={height} fill={fill} />
  );
}

function PendingShape({ x = 0, y = 0, width = 0, height = 0, fill, payload }: ShapeProps) {
  if (height <= 0) return null;
  // 2px of surface separates this from the paid segment below it.
  const gap = (payload?.paid ?? 0) > 0 ? 2 : 0;
  const h = Math.max(0, height - gap);
  if (h <= 0) return null;
  return <path d={roundedTopPath(x, y, width, h, 4)} fill={fill} />;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Row }>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <div className="bg-popover text-popover-foreground min-w-40 rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium">{row.label}</p>
      {row.future && row.paid === 0 ? (
        <p className="text-muted-foreground">Not due yet</p>
      ) : (
        <ul className="space-y-1">
          <li className="flex items-center gap-2">
            <span className="bg-viz-good size-2 shrink-0 rounded-full" aria-hidden />
            <span className="text-muted-foreground">Paid</span>
            <span className="ml-auto font-medium tabular-nums">{row.paid}</span>
          </li>
          {row.future ? null : (
            <li className="flex items-center gap-2">
              <span className="bg-viz-warning size-2 shrink-0 rounded-full" aria-hidden />
              <span className="text-muted-foreground">Pending</span>
              <span className="ml-auto font-medium tabular-nums">{row.pending}</span>
            </li>
          )}
          <li className="text-muted-foreground mt-1 border-t pt-1.5">
            {row.future
              ? `Paid ahead · ${row.paid} of ${row.expected} members`
              : `${Math.round(row.rate * 100)}% of ${row.expected} members`}
          </li>
        </ul>
      )}
    </div>
  );
}

/**
 * Members paid vs pending for each month of the year. Two genuine states, so
 * both carry a legend entry; months that have not started yet render empty
 * rather than as a misleading pile of "pending".
 */
export function CollectionChart({ data }: { data: MonthBar[] }) {
  const rows: Row[] = data.map((row) => ({
    ...row,
    rate: row.expected === 0 ? 0 : row.paid / row.expected,
  }));
  const maxMembers = Math.max(...rows.map((r) => r.expected), 1);

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <li className="flex items-center gap-1.5">
          <span className="bg-viz-good size-2.5 rounded-full" aria-hidden />
          <span className="text-muted-foreground">Paid</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="bg-viz-warning size-2.5 rounded-full" aria-hidden />
          <span className="text-muted-foreground">Pending</span>
        </li>
        <li className="text-muted-foreground/70 ml-auto text-[11px]">
          Months ahead of today show only what has been paid in advance.
        </li>
      </ul>

      <ChartFrame>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
            barCategoryGap="24%"
          >
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              interval={0}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              allowDecimals={false}
              domain={[0, maxMembers]}
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            />
            <Tooltip
              cursor={{ fill: "var(--viz-track)", opacity: 0.45 }}
              content={<ChartTooltip />}
            />
            <Bar
              dataKey="paid"
              stackId="members"
              fill="var(--viz-good)"
              maxBarSize={24}
              isAnimationActive={false}
              shape={(props: ShapeProps) => <PaidShape {...props} />}
            />
            <Bar
              dataKey="pending"
              stackId="members"
              fill="var(--viz-warning)"
              maxBarSize={24}
              isAnimationActive={false}
              shape={(props: ShapeProps) => <PendingShape {...props} />}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
