import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";

import { pageMeta } from "@/lib/seo";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { listLeads, updateLeadStatus, type Lead } from "@/lib/leads.functions";
import { LEAD_STATUSES, LEAD_STATUS_LABEL, planName, type LeadStatus } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/admin/leads")({
  head: () => ({
    meta: [
      { title: "Sales leads — Course Compass" },
      { name: "description", content: "Internal lead management for the Course Compass team." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const fetchLeads = useServerFn(listLeads);
  const setStatus = useServerFn(updateLeadStatus);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | LeadStatus>("all");

  const isAdmin = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) return false;
      return Boolean(data);
    },
  });

  const leads = useQuery({
    queryKey: ["sales-leads"],
    queryFn: () => fetchLeads({}),
    enabled: isAdmin.data === true,
  });

  const mutation = useMutation({
    mutationFn: (input: { id: string; status: LeadStatus }) => setStatus({ data: input }),
    onSuccess: () => {
      toast.success("Lead updated");
      queryClient.invalidateQueries({ queryKey: ["sales-leads"] });
    },
    onError: () => toast.error("Could not update this lead"),
  });

  const rows = useMemo<Lead[]>(() => {
    const all = leads.data ?? [];
    return filter === "all" ? all : all.filter((lead) => lead.status === filter);
  }, [leads.data, filter]);

  if (isAdmin.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (!isAdmin.data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-4 text-lg font-bold">Administrators only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This page is restricted to the Course Compass sales team.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Sales leads</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {leads.data ? `${leads.data.length} total requests` : "Loading requests…"}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {(["all", ...LEAD_STATUSES] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors active:scale-95 ${
                  filter === value
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {value === "all" ? "All" : LEAD_STATUS_LABEL[value]}
              </button>
            ))}
          </div>
        </header>

        {leads.isLoading ? (
          <p className="mt-10 text-sm text-muted-foreground">Loading leads…</p>
        ) : leads.isError ? (
          <p role="alert" className="mt-10 text-sm text-destructive">
            Could not load leads.{" "}
            <button
              type="button"
              onClick={() => leads.refetch()}
              className="font-semibold underline underline-offset-4"
            >
              Retry
            </button>
          </p>
        ) : rows.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">No requests in this view yet.</p>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-5xl text-left text-sm">
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {[
                    "Name",
                    "Organization",
                    "Plan",
                    "Country",
                    "Teachers",
                    "Students",
                    "Email",
                    "Phone",
                    "Submitted",
                    "Status",
                  ].map((head) => (
                    <th key={head} scope="col" className="px-3 py-2.5 font-semibold">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((lead) => (
                  <tr key={lead.id} className="border-t border-border align-top">
                    <td className="px-3 py-3 font-medium">
                      {lead.name}
                      <span className="block text-xs text-muted-foreground">{lead.role}</span>
                    </td>
                    <td className="px-3 py-3">{lead.organization}</td>
                    <td className="px-3 py-3">{planName(lead.plan)}</td>
                    <td className="px-3 py-3">{lead.country}</td>
                    <td className="px-3 py-3">{lead.teachers ?? "—"}</td>
                    <td className="px-3 py-3">{lead.students ?? "—"}</td>
                    <td className="px-3 py-3">
                      <a
                        href={`mailto:${lead.email}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {lead.email}
                      </a>
                    </td>
                    <td className="px-3 py-3">{lead.phone}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3">
                      <label className="sr-only" htmlFor={`status-${lead.id}`}>
                        Status for {lead.name}
                      </label>
                      <select
                        id={`status-${lead.id}`}
                        value={lead.status}
                        disabled={mutation.isPending}
                        onChange={(event) =>
                          mutation.mutate({
                            id: lead.id,
                            status: event.target.value as LeadStatus,
                          })
                        }
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
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
        )}
      </div>
    </div>
  );
}
