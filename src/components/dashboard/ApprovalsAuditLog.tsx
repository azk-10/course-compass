import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, History, LogOut, Send, X } from "lucide-react";

import { fetchApprovalEvents, type ApprovalEvent, type Organization } from "@/lib/org";

type Filter = "all" | "requested" | "approved" | "rejected" | "withdrawn";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

const META: Record<
  ApprovalEvent["action"],
  { label: string; icon: typeof Check; tone: string }
> = {
  requested: { label: "Requested access", icon: Send, tone: "text-primary" },
  approved: { label: "Approved", icon: Check, tone: "text-success" },
  rejected: { label: "Rejected", icon: X, tone: "text-destructive" },
  withdrawn: { label: "Withdrew request", icon: LogOut, tone: "text-muted-foreground" },
};

function formatWhen(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Read-only history: who asked to join, when, and how the owner decided. */
export function ApprovalsAuditLog({ organization }: { organization: Organization }) {
  const [filter, setFilter] = useState<Filter>("all");
  const eventsQuery = useQuery({
    queryKey: ["org-approval-events", organization.id],
    queryFn: () => fetchApprovalEvents(organization.id),
    refetchInterval: 30_000,
  });

  const events = useMemo(() => {
    const all = eventsQuery.data ?? [];
    return filter === "all" ? all : all.filter((event) => event.action === filter);
  }, [eventsQuery.data, filter]);

  return (
    <section className="panel mt-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
          <History className="size-3.5" /> Approvals audit log
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`rounded-full px-2.5 py-1 text-[0.7rem] font-medium transition-colors ${
                filter === option.value
                  ? "bg-primary text-primary-foreground"
                  : "border border-input text-muted-foreground hover:bg-secondary"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {eventsQuery.isLoading && (
        <p className="mt-3 text-sm text-muted-foreground">Loading history…</p>
      )}

      {!eventsQuery.isLoading && events.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing recorded yet. Join requests and your decisions will appear here automatically.
        </p>
      )}

      {events.length > 0 && (
        <ol className="mt-4 space-y-1.5">
          {events.map((event) => {
            const meta = META[event.action];
            const Icon = meta.icon;
            const byOwner = event.actor_id !== null && event.actor_id !== event.teacher_id;
            return (
              <li
                key={event.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border px-4 py-2.5"
              >
                <Icon className={`size-4 shrink-0 ${meta.tone}`} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {event.teacher_name ?? event.teacher_email ?? "Teacher"}
                    <span className="ml-2 font-normal text-muted-foreground">{meta.label}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {event.teacher_email ?? "No email on file"}
                    {byOwner ? " · decided by an organization owner" : ""}
                  </span>
                </span>
                <time
                  dateTime={event.created_at}
                  className="shrink-0 text-xs whitespace-nowrap text-muted-foreground"
                >
                  {formatWhen(event.created_at)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
