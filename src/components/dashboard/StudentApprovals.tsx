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
