import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { listLeads, updateLeadStatus, type Lead } from "@/lib/leads.functions";
import { LEAD_STATUSES, LEAD_STATUS_LABEL, planName, type LeadStatus } from "@/lib/plans";

/** Owner console: every demo / sales / pricing request submitted from the site. */
export function RequestsPanel() {
  const fetchLeads = useServerFn(listLeads);
  const setStatus = useServerFn(updateLeadStatus);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | LeadStatus>("all");

  const leads = useQuery({ queryKey: ["sales-leads"], queryFn: () => fetchLeads({}) });

  const mutation = useMutation({
    mutationFn: (input: { id: string; status: LeadStatus }) => setStatus({ data: input }),
    onSuccess: () => {
      toast.success("Request updated");
      qc.invalidateQueries({ queryKey: ["sales-leads"] });
    },
    onError: () => toast.error("Could not update this request"),
  });

  const rows = useMemo<Lead[]>(() => {
    const all = leads.data ?? [];
    return filter === "all" ? all : all.filter((lead) => lead.status === filter);
  }, [leads.data, filter]);

  if (leads.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading requests…
      </div>
    );
  }

  const counts = (leads.data ?? []).reduce<Record<string, number>>((acc, lead) => {
    acc[lead.status] = (acc[lead.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {(["all", ...LEAD_STATUSES] as const).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-transform active:scale-95 ${
              filter === key ? "bg-primary text-primary-foreground" : "bg-secondary"
            }`}
          >
            {key === "all" ? "All" : LEAD_STATUS_LABEL[key]}
            <span className="ml-1.5 opacity-70">
              {key === "all" ? (leads.data ?? []).length : (counts[key] ?? 0)}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-[0.7rem] tracking-wide uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Requester</th>
              <th className="px-4 py-3 font-semibold">Organization</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Size</th>
              <th className="px-4 py-3 font-semibold">Received</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No requests here yet.
                </td>
              </tr>
            )}
            {rows.map((lead) => (
              <tr key={lead.id} className="border-b border-border/60 align-top last:border-0">
                <td className="px-4 py-3">
                  <span className="block font-semibold">{lead.name}</span>
                  <span className="block text-xs text-muted-foreground">{lead.email}</span>
                  <span className="block text-xs text-muted-foreground">{lead.phone}</span>
                  {lead.message ? (
                    <p className="mt-1 max-w-sm text-xs text-muted-foreground">{lead.message}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <span className="block">{lead.organization}</span>
                  <span className="block text-xs text-muted-foreground">
                    {lead.role} · {lead.country}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">{planName(lead.plan)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {lead.teachers ?? "—"} teachers · {lead.students ?? "—"} students
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(lead.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={lead.status}
                    onChange={(e) =>
                      mutation.mutate({ id: lead.id, status: e.target.value as LeadStatus })
                    }
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold"
                  >
                    {LEAD_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {LEAD_STATUS_LABEL[status]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
