import { useState } from "react";
import { Check, ChevronDown, Mail, Phone, UserPlus, X } from "lucide-react";
import type { Enrollment } from "@/lib/dashboard-data";

export function StudentApprovals({
  enrollments,
  pendingId,
  onDecide,
}: {
  enrollments: Enrollment[];
  pendingId: string | null;
  onDecide: (id: string, status: "approved" | "declined") => void;
}) {
  const pending = enrollments.filter((e) => e.status === "pending");
  const approved = enrollments.filter((e) => e.status === "approved");

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold">Students</h3>
        <span className="text-xs text-muted-foreground">
          {approved.length} approved · {pending.length} pending
        </span>
      </div>

      {pending.length === 0 && approved.length === 0 ? (
        <div className="mt-5 flex flex-col items-center gap-2 py-6 text-center">
          <UserPlus className="size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No join requests yet. Students request access from the student page.
          </p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <ul className="mt-4 space-y-2">
              {pending.map((enrollment) => (
                <PendingRow
                  key={enrollment.id}
                  enrollment={enrollment}
                  busy={pendingId === enrollment.id}
                  onDecide={onDecide}
                />
              ))}
            </ul>
          )}

          {approved.length > 0 && (
            <div className="mt-4">
              <p className="text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
                Approved
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {approved.map((enrollment) => (
                  <span
                    key={enrollment.id}
                    className="rounded-full bg-secondary px-2.5 py-1 text-xs"
                  >
                    {enrollment.student_label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Teachers approve on the name alone; contact details expand only if needed. */
function PendingRow({
  enrollment,
  busy,
  onDecide,
}: {
  enrollment: Enrollment;
  busy: boolean;
  onDecide: (id: string, status: "approved" | "declined") => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-lg bg-secondary px-3 py-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <button
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 items-center gap-1.5 text-left"
        >
          <ChevronDown
            className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
          />
          <span className="truncate text-sm font-medium">{enrollment.student_label}</span>
        </button>
        <span className="flex shrink-0 gap-1.5">
          <button
            onClick={() => onDecide(enrollment.id, "approved")}
            disabled={busy}
            aria-label={`Approve ${enrollment.student_label}`}
            className="rounded-md bg-success/15 p-1.5 text-success transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            <Check className="size-4" />
          </button>
          <button
            onClick={() => onDecide(enrollment.id, "declined")}
            disabled={busy}
            aria-label={`Decline ${enrollment.student_label}`}
            className="rounded-md bg-destructive/10 p-1.5 text-destructive transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </span>
      </div>

      {open && (
        <dl className="mt-2 space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Mail className="size-3.5 shrink-0" />
            <span className="truncate">{enrollment.student_email ?? "No email given"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Phone className="size-3.5 shrink-0" />
            <span className="truncate">{enrollment.student_phone ?? "No phone given"}</span>
          </div>
        </dl>
      )}
    </li>
  );
}
