import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { listInvoices, updateInvoice } from "@/lib/owner.functions";
import { money, periodLabel } from "@/lib/billing";

const STATUSES = ["draft", "pending", "paid", "failed", "overdue", "waived", "refunded"] as const;

export function BillingTable() {
  const fetchInvoices = useServerFn(listInvoices);
  const patch = useServerFn(updateInvoice);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const invoices = useQuery({ queryKey: ["owner-invoices"], queryFn: () => fetchInvoices({}) });

  const mutate = useMutation({
    mutationFn: (input: { id: string; status?: string; discountCents?: number }) =>
      patch({ data: input as never }),
    onSuccess: () => {
      toast.success("Invoice updated");
      qc.invalidateQueries({ queryKey: ["owner-invoices"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  if (invoices.isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading invoices…
      </div>
    );
  }

  const rows = (invoices.data ?? []).filter((i) => filter === "all" || i.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["all", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-transform active:scale-95 ${
              filter === s ? "bg-primary text-primary-foreground" : "bg-secondary"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-[0.7rem] tracking-wide uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Period</th>
              <th className="px-4 py-3 font-semibold">Breakdown</th>
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No invoices for this filter yet.
                </td>
              </tr>
            )}
            {rows.map((inv) => (
              <tr key={inv.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <span className="block font-semibold">{inv.customer ?? "—"}</span>
                  <span className="block text-xs text-muted-foreground">{inv.email}</span>
                  <span className="text-xs capitalize text-muted-foreground">{inv.planId}</span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {periodLabel(inv.periodStart, inv.periodEnd)}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  <div>Base {money(inv.baseCents)}</div>
                  {inv.extraClasses > 0 && (
                    <div>
                      {inv.extraClasses} extra classes {money(inv.extraClassesCents)}
                    </div>
                  )}
                  {inv.extraTeachers > 0 && (
                    <div>
                      {inv.extraTeachers} extra teachers {money(inv.extraTeachersCents)}
                    </div>
                  )}
                  {inv.extraStudentBlocks > 0 && (
                    <div>
                      {inv.extraStudentBlocks} × 10 students {money(inv.extraStudentsCents)}
                    </div>
                  )}
                  {inv.discountCents > 0 && <div>Discount −{money(inv.discountCents)}</div>}
                </td>
                <td className="px-4 py-3 font-bold">{money(inv.totalCents)}</td>
                <td className="px-4 py-3">
                  <select
                    value={inv.status}
                    onChange={(e) => mutate.mutate({ id: inv.id, status: e.target.value })}
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs capitalize"
                    aria-label="Invoice status"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const input = prompt("Discount in dollars", "0");
                      if (input === null) return;
                      const dollars = Number(input);
                      if (!Number.isFinite(dollars) || dollars < 0) {
                        toast.error("Invalid amount");
                        return;
                      }
                      mutate.mutate({ id: inv.id, discountCents: Math.round(dollars * 100) });
                    }}
                    className="mt-1 block text-[0.7rem] font-semibold text-muted-foreground underline"
                  >
                    Adjust discount
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
