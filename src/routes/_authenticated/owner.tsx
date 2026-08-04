import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Activity,
  Building2,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  Settings2,
  ShieldAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { pageMeta } from "@/lib/seo";
import { money } from "@/lib/billing";
import { useIsPlatformOwner } from "@/lib/use-owner";
import { getOwnerStats, listAccounts, resetUsage } from "@/lib/owner.functions";
import { AccountsTable } from "@/components/owner/AccountsTable";
import { AiAnalyticsPanel } from "@/components/owner/AiAnalyticsPanel";
import { BillingTable } from "@/components/owner/BillingTable";
import { SettingsPanel } from "@/components/owner/SettingsPanel";

export const Route = createFileRoute("/_authenticated/owner")({
  head: () =>
    pageMeta({
      title: "Owner console",
      description: "Internal Course Compass platform administration.",
      path: "/owner",
      noindex: true,
    }),
  component: OwnerConsole,
});

const SECTIONS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "teachers", label: "Teachers", icon: GraduationCap },
  { id: "academies", label: "Academies", icon: Building2 },
  { id: "students", label: "Students", icon: Users },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "usage", label: "AI usage", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings2 },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function OwnerConsole() {
  const owner = useIsPlatformOwner();
  const [section, setSection] = useState<SectionId>("dashboard");

  if (owner.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (!owner.data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-4 text-lg font-bold">Restricted</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This console is reserved for the platform owner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="paper-ink flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-card/60 p-4 lg:flex">
        <p className="px-2 text-[0.7rem] font-bold tracking-[0.18em] uppercase text-muted-foreground">
          Owner console
        </p>
        <nav className="mt-4 space-y-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-transform active:scale-[0.97] ${
                section === s.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              }`}
            >
              <s.icon className="size-4" aria-hidden="true" />
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 px-5 py-6 lg:px-8">
        <div className="mb-5 flex gap-2 overflow-x-auto lg:hidden">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-transform active:scale-95 ${
                section === s.id ? "bg-primary text-primary-foreground" : "bg-secondary"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <h1 className="text-2xl font-extrabold">
          {SECTIONS.find((s) => s.id === section)?.label}
        </h1>

        <div className="mt-6">
          {section === "dashboard" && <DashboardSection />}
          {section === "teachers" && <AccountsTable kind="teacher" />}
          {section === "academies" && <AccountsTable kind="academy" />}
          {section === "students" && <AccountsTable kind="student" />}
          {section === "billing" && <BillingTable />}
          {section === "usage" && <UsageSection />}
          {section === "settings" && <SettingsPanel />}
        </div>
      </main>
    </div>
  );
}

function DashboardSection() {
  const fetchStats = useServerFn(getOwnerStats);
  const stats = useQuery({ queryKey: ["owner-stats"], queryFn: () => fetchStats({}) });

  if (stats.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading metrics…
      </div>
    );
  }
  const s = stats.data;
  if (!s) return <p className="text-sm text-muted-foreground">No data yet.</p>;

  const cards = [
    { label: "Monthly revenue", value: money(s.monthlyRevenueCents), accent: true },
    { label: "Active subscriptions", value: s.activeSubs },
    { label: "Suspended / expired", value: s.suspendedSubs },
    { label: "Teachers", value: s.teachers },
    { label: "Academies", value: s.academies },
    { label: "Students", value: s.students },
    { label: "Organizations", value: s.organizations },
    { label: "Pending approvals", value: s.pendingApprovals },
    { label: "AI messages this month", value: s.aiMessagesThisMonth.toLocaleString() },
    { label: "Estimated AI cost", value: money(s.aiCostEstimateCents) },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-xl border p-4 transition-transform hover:-translate-y-0.5 ${
            c.accent ? "border-foreground/30 bg-card shadow-md" : "border-border bg-card"
          }`}
        >
          <p className="text-xs tracking-wide uppercase text-muted-foreground">{c.label}</p>
          <p className="font-paper-display mt-2 text-2xl font-bold">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function UsageSection() {
  const fetchAccounts = useServerFn(listAccounts);
  const reset = useServerFn(resetUsage);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const teachers = useQuery({
    queryKey: ["owner-accounts", "teacher"],
    queryFn: () => fetchAccounts({ data: { kind: "teacher" as const } }),
  });
  const academies = useQuery({
    queryKey: ["owner-accounts", "academy"],
    queryFn: () => fetchAccounts({ data: { kind: "academy" as const } }),
  });

  const rows = [...(teachers.data ?? []), ...(academies.data ?? [])]
    .filter((a) => a.subscriptionId)
    .sort((a, b) => b.aiMessagesUsed - a.aiMessagesUsed);

  if (teachers.isLoading || academies.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading usage…
      </div>
    );
  }

  const total = rows.reduce((sum, r) => sum + r.aiMessagesUsed, 0);

  return (
    <div className="space-y-8">
      <AiAnalyticsPanel />

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs tracking-wide uppercase text-muted-foreground">
          Total AI messages this month
        </p>
        <p className="font-paper-display mt-1 text-2xl font-bold">{total.toLocaleString()}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-[0.7rem] tracking-wide uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Account</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Messages</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  No AI usage recorded yet this month.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const over = !r.unlimitedAi && r.aiMessagesUsed >= r.aiMessagesAllowed;
              return (
                <tr key={r.userId} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <span className="block font-semibold">{r.displayName ?? "—"}</span>
                    <span className="block text-xs text-muted-foreground">{r.email}</span>
                  </td>
                  <td className="px-4 py-3 text-xs capitalize">{r.planId}</td>
                  <td className={`px-4 py-3 text-sm ${over ? "font-bold text-destructive" : ""}`}>
                    {r.aiMessagesUsed.toLocaleString()} /{" "}
                    {r.unlimitedAi ? "∞" : r.aiMessagesAllowed.toLocaleString()}
                    {over && <span className="ml-2 text-xs">limit reached</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={async () => {
                        await reset({ data: { subscriptionId: r.subscriptionId! } });
                        toast.success("Usage reset for this month");
                        qc.invalidateQueries({ queryKey: ["owner-accounts"] });
                      }}
                      className="rounded-md border border-border px-2 py-1 text-xs font-semibold transition-transform hover:bg-secondary active:scale-95"
                    >
                      Reset usage
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => navigate({ to: "/admin/leads" })}
        className="text-xs font-semibold text-muted-foreground underline"
      >
        Open sales lead pipeline
      </button>
    </div>
  );
}
