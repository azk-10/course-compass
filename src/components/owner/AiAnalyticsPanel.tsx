import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getAiAnalytics } from "@/lib/owner.functions";

const RANGES = [
  { days: 1, label: "24 hours" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

const AXIS = { fontSize: 11, stroke: "hsl(var(--muted-foreground))" };

/** Owner-only: Gemini requests, tokens and credit spend over time. */
export function AiAnalyticsPanel() {
  const fetchAnalytics = useServerFn(getAiAnalytics);
  const [days, setDays] = useState<number>(30);

  const analytics = useQuery({
    queryKey: ["owner-ai-analytics", days],
    queryFn: () => fetchAnalytics({ data: { days } }),
    refetchInterval: 60_000,
  });

  if (analytics.isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading AI analytics…
      </div>
    );
  }

  const data = analytics.data;
  if (!data) return <p className="text-sm text-muted-foreground">No AI analytics yet.</p>;

  const label = (bucket: string) =>
    days <= 2 ? bucket.slice(11) : bucket.slice(5).replace("-", "/");
  const points = data.points.map((p) => ({ ...p, label: label(p.bucket) }));

  const cards = [
    { label: "Requests", value: data.totals.requests.toLocaleString() },
    {
      label: "Tokens",
      value: (data.totals.inputTokens + data.totals.outputTokens).toLocaleString(),
      sub: `${data.totals.inputTokens.toLocaleString()} in · ${data.totals.outputTokens.toLocaleString()} out`,
    },
    { label: "Credits spent", value: data.totals.credits.toFixed(3), accent: true },
    { label: "Avg latency", value: `${data.totals.avgDurationMs} ms` },
    {
      label: "AI success rate",
      value: `${data.totals.successRate}%`,
      sub: `${data.totals.fallbacks.toLocaleString()} local fallbacks`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-transform active:scale-95 ${
              days === r.days ? "bg-primary text-primary-foreground" : "bg-secondary"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-xl border p-4 transition-transform hover:-translate-y-0.5 ${
              c.accent ? "border-foreground/30 bg-card shadow-md" : "border-border bg-card"
            }`}
          >
            <p className="text-xs tracking-wide uppercase text-muted-foreground">{c.label}</p>
            <p className="font-paper-display mt-2 text-2xl font-bold">{c.value}</p>
            {c.sub && <p className="mt-1 text-[0.7rem] text-muted-foreground">{c.sub}</p>}
          </div>
        ))}
      </div>

      {points.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No AI requests recorded in this window yet. Merge activity in a live session will appear
          here within a minute.
        </p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Requests over time" hint="Each merge/classify call to Gemini.">
            <AreaChart data={points}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={AXIS} />
              <YAxis tick={AXIS} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="requests"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.18}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartCard>

          <ChartCard title="Credits spent" hint="Estimated Lovable credits per bucket.">
            <BarChart data={points}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={AXIS} />
              <YAxis tick={AXIS} width={62} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="credits" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Tokens" hint="Prompt vs completion tokens.">
            <AreaChart data={points}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={AXIS} />
              <YAxis tick={AXIS} width={62} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="inputTokens"
                stackId="tokens"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
              />
              <Area
                type="monotone"
                dataKey="outputTokens"
                stackId="tokens"
                stroke="hsl(var(--muted-foreground))"
                fill="hsl(var(--muted-foreground))"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ChartCard>

          <ChartCard title="Latency & fallbacks" hint="Average ms per call and local fallbacks.">
            <LineChart data={points}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={AXIS} />
              <YAxis tick={AXIS} width={52} />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="avgDurationMs"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="fallbacks"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartCard>
        </div>
      )}

      {data.byModel.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-[0.7rem] tracking-wide uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Model</th>
                <th className="px-4 py-3 font-semibold">Requests</th>
                <th className="px-4 py-3 font-semibold">Credits</th>
              </tr>
            </thead>
            <tbody>
              {data.byModel.map((m) => (
                <tr key={m.model} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-semibold">{m.model}</td>
                  <td className="px-4 py-3">{m.requests.toLocaleString()}</td>
                  <td className="px-4 py-3">{m.credits.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ChartCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactElement;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="mt-4 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

type TooltipEntry = { name?: string | number; value?: number | string; color?: string };

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-bold">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.name)} style={{ color: entry.color }}>
          {String(entry.name)}:{" "}
          {typeof entry.value === "number"
            ? entry.value >= 1
              ? entry.value.toLocaleString()
              : entry.value.toFixed(4)
            : String(entry.value ?? "")}
        </p>
      ))}
    </div>
  );
}
