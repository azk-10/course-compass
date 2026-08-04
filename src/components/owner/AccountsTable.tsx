import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Ban, Infinity as InfinityIcon, Loader2, LogOut, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteUser,
  forceLogout,
  listAccounts,
  resetUserPassword,
  setAccountStatus,
  updateSubscription,
  type OwnerAccount,
} from "@/lib/owner.functions";
import { money } from "@/lib/billing";

type Kind = "teacher" | "academy" | "student";

const PLAN_OPTIONS = ["teacher", "academy", "enterprise"];

export function AccountsTable({ kind }: { kind: Kind }) {
  const fetchAccounts = useServerFn(listAccounts);
  const patchSub = useServerFn(updateSubscription);
  const patchStatus = useServerFn(setAccountStatus);
  const logout = useServerFn(forceLogout);
  const remove = useServerFn(deleteUser);
  const resetPassword = useServerFn(resetUserPassword);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const accounts = useQuery({
    queryKey: ["owner-accounts", kind],
    queryFn: () => fetchAccounts({ data: { kind } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["owner-accounts", kind] });

  const mutate = useMutation({
    mutationFn: (input: { userId: string } & Record<string, unknown>) =>
      patchSub({ data: input as never }),
    onSuccess: () => {
      toast.success("Subscription updated — it will show on the next invoice");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const rows = useMemo(() => {
    const all = accounts.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((a) =>
      [a.email, a.displayName, a.organizationName].some((v) => v?.toLowerCase().includes(needle)),
    );
  }, [accounts.data, q]);

  if (accounts.isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading accounts…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="flex max-w-sm items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${kind}s…`}
          className="w-full bg-transparent text-sm outline-none"
          aria-label={`Search ${kind}s`}
        />
      </label>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-[0.7rem] tracking-wide uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Account</th>
              {kind !== "student" && <th className="px-4 py-3 font-semibold">Plan</th>}
              {kind !== "student" && <th className="px-4 py-3 font-semibold">Capacity</th>}
              {kind !== "student" && <th className="px-4 py-3 font-semibold">AI usage</th>}
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No {kind} accounts yet.
                </td>
              </tr>
            )}
            {rows.map((a) => (
              <AccountRow
                key={a.userId}
                account={a}
                kind={kind}
                expanded={open === a.userId}
                onToggle={() => setOpen(open === a.userId ? null : a.userId)}
                onPatch={(patch) => mutate.mutate({ userId: a.userId, ...patch })}
                onStatus={async (status) => {
                  await patchStatus({ data: { userId: a.userId, status } });
                  toast.success(`Account ${status}`);
                  invalidate();
                }}
                onLogout={async () => {
                  await logout({ data: { userId: a.userId } });
                  toast.success("Signed out of all devices");
                }}
                onReset={async () => {
                  if (!a.email) {
                    toast.error("This account has no email on file");
                    return;
                  }
                  await resetPassword({ data: { email: a.email } });
                  toast.success("Password reset link generated");
                }}
                onDelete={async () => {
                  if (!confirm(`Permanently delete ${a.email ?? "this account"}?`)) return;
                  await remove({ data: { userId: a.userId } });
                  toast.success("Account deleted");
                  invalidate();
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type RowProps = {
  account: OwnerAccount;
  kind: Kind;
  expanded: boolean;
  onToggle: () => void;
  onPatch: (patch: Record<string, unknown>) => void;
  onStatus: (status: "active" | "suspended" | "banned") => void | Promise<void>;
  onLogout: () => void | Promise<void>;
  onReset: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
};

function AccountRow({
  account: a,
  kind,
  expanded,
  onToggle,
  onPatch,
  onStatus,
  onLogout,
  onReset,
  onDelete,
}: RowProps) {
  const usedPct = a.unlimitedAi
    ? 0
    : Math.min(100, Math.round((a.aiMessagesUsed / Math.max(1, a.aiMessagesAllowed)) * 100));

  return (
    <>
      <tr className="border-b border-border/60 last:border-0 hover:bg-secondary/40">
        <td className="px-4 py-3">
          <button onClick={onToggle} className="text-left">
            <span className="block font-semibold">{a.displayName ?? "—"}</span>
            <span className="block text-xs text-muted-foreground">{a.email}</span>
            {a.organizationName && (
              <span className="block text-xs text-muted-foreground">{a.organizationName}</span>
            )}
          </button>
        </td>
        {kind !== "student" && (
          <td className="px-4 py-3">
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold capitalize">
              {a.isFree ? "free" : (a.planId ?? "none")}
            </span>
          </td>
        )}
        {kind !== "student" && (
          <td className="px-4 py-3 text-xs text-muted-foreground">
            {a.unlimitedClasses ? "∞" : `${a.classesUsed}/${a.classesAllowed}`} classes ·{" "}
            {a.unlimitedStudents ? "∞" : `${a.studentsUsed}/${a.studentsAllowed}`} students
          </td>
        )}
        {kind !== "student" && (
          <td className="px-4 py-3 text-xs">
            {a.unlimitedAi ? (
              <span className="inline-flex items-center gap-1 font-semibold">
                <InfinityIcon className="size-3.5" /> Unlimited
              </span>
            ) : (
              <>
                <span className={usedPct >= 100 ? "font-bold text-destructive" : ""}>
                  {a.aiMessagesUsed.toLocaleString()} / {a.aiMessagesAllowed.toLocaleString()}
                </span>
                <span className="mt-1 block h-1 w-24 rounded-full bg-secondary">
                  <span
                    className="block h-1 rounded-full bg-primary"
                    style={{ width: `${usedPct}%` }}
                  />
                </span>
              </>
            )}
          </td>
        )}
        <td className="px-4 py-3">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
              a.accountStatus === "active"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : "bg-destructive/15 text-destructive"
            }`}
          >
            {a.accountStatus}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="inline-flex gap-1">
            <IconBtn label="Force logout" onClick={onLogout}>
              <LogOut className="size-3.5" />
            </IconBtn>
            <IconBtn
              label={a.accountStatus === "active" ? "Suspend" : "Reactivate"}
              onClick={() => onStatus(a.accountStatus === "active" ? "suspended" : "active")}
            >
              <Ban className="size-3.5" />
            </IconBtn>
            <IconBtn label="Delete" onClick={onDelete} danger>
              <Trash2 className="size-3.5" />
            </IconBtn>
            <button
              onClick={onToggle}
              className="rounded-md border border-border px-2 py-1 text-xs font-semibold transition-transform hover:bg-secondary active:scale-95"
            >
              {expanded ? "Close" : "Manage"}
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-border bg-secondary/30">
          <td colSpan={6} className="px-4 py-5">
            {kind === "student" ? (
              <div className="flex flex-wrap gap-2 text-sm">
                <button onClick={onReset} className="chip-btn">
                  Send password reset
                </button>
                <span className="text-xs text-muted-foreground">
                  Students are always free — they never receive an invoice.
                </span>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-3">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold tracking-wide uppercase text-muted-foreground">
                    Plan
                  </h4>
                  <select
                    value={a.planId ?? "teacher"}
                    onChange={(e) => onPatch({ planId: e.target.value })}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                    aria-label="Plan"
                  >
                    {PLAN_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <select
                    value={a.status ?? "active"}
                    onChange={(e) => onPatch({ status: e.target.value })}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                    aria-label="Subscription status"
                  >
                    {["active", "suspended", "expired", "pending"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <Toggle
                    label="Free subscription"
                    checked={a.isFree}
                    onChange={(v) => onPatch({ isFree: v })}
                  />
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold tracking-wide uppercase text-muted-foreground">
                    Limits
                  </h4>
                  <NumberField
                    label="Classes"
                    value={a.classesAllowed}
                    onCommit={(v) => onPatch({ classesAllowed: v })}
                  />
                  {kind === "academy" && (
                    <NumberField
                      label="Teachers"
                      value={a.teachersAllowed}
                      onCommit={(v) => onPatch({ teachersAllowed: v })}
                    />
                  )}
                  <NumberField
                    label="Students"
                    value={a.studentsAllowed}
                    onCommit={(v) => onPatch({ studentsAllowed: v })}
                  />
                  <NumberField
                    label="AI messages / month"
                    value={a.aiMessagesAllowed}
                    onCommit={(v) => onPatch({ aiMessagesAllowed: v })}
                  />
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold tracking-wide uppercase text-muted-foreground">
                    Unlimited overrides
                  </h4>
                  <Toggle
                    label="Unlimited AI"
                    checked={a.unlimitedAi}
                    onChange={(v) => onPatch({ unlimitedAi: v })}
                  />
                  <Toggle
                    label="Unlimited students"
                    checked={a.unlimitedStudents}
                    onChange={(v) => onPatch({ unlimitedStudents: v })}
                  />
                  <Toggle
                    label="Unlimited classes"
                    checked={a.unlimitedClasses}
                    onChange={(v) => onPatch({ unlimitedClasses: v })}
                  />
                  {kind === "academy" && (
                    <Toggle
                      label="Unlimited teachers"
                      checked={a.unlimitedTeachers}
                      onChange={(v) => onPatch({ unlimitedTeachers: v })}
                    />
                  )}
                  <button onClick={onReset} className="chip-btn w-full">
                    Send password reset
                  </button>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void | Promise<void>;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-md border border-border p-1.5 transition-transform hover:bg-secondary active:scale-90 ${
        danger ? "text-destructive" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[hsl(var(--primary))]"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [local, setLocal] = useState(String(value));
  return (
    <label className="block text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const next = Number(local);
          if (Number.isFinite(next) && next !== value) onCommit(Math.max(0, Math.round(next)));
        }}
        className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
      />
    </label>
  );
}

export { money };
