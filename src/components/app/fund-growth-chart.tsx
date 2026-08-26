"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "@/components/app/chart-frame";
import { formatMonthKeyShort } from "@/lib/dates";
import { formatTakaShort, TAKA } from "@/lib/money";
import type { FundGrowthPoint } from "@/server/fund";

function compact(value: number) {
  if (Math.abs(value) >= 100_000) return `${TAKA}${(value / 1000).toFixed(0)}k`;
  return `${TAKA}${value.toLocaleString("en-IN")}`;
}

export function FundGrowthChart({ data }: { data: FundGrowthPoint[] }) {
  const points = data.map((point) => ({
    ...point,
    label: formatMonthKeyShort(point.monthKey),
  }));

  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fundFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickFormatter={compact}
          />
          <Tooltip
            cursor={{ stroke: "var(--color-border)" }}
            contentStyle={{
              background: "var(--color-popover)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius)",
              fontSize: 12,
              color: "var(--color-popover-foreground)",
            }}
            formatter={(value) => [formatTakaShort(Number(value)), "Fund balance"]}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="balance"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#fundFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
