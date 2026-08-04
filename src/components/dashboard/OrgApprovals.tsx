import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Mail, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import {
  fetchOrgTeachers,
  setTeacherApproval,
  type Organization,
  type TeacherProfile,
} from "@/lib/org";

/**
 * Shown to the owner of an organization: every teacher who signed up under it,
 * pending ones first, so the owner approves people before they can teach.
 */
export function OrgApprovals({ organization }: { organization: Organization }) {
  const queryClient = useQueryClient();
  const teachersQuery = useQuery({
    queryKey: ["org-teachers", organization.id],
    queryFn: () => fetchOrgTeachers(organization.id),
    refetchInterval: 30_000,
  });

  const decide = useMutation({
    mutationFn: (input: { id: string; status: "approved" | "rejected" }) =>
      setTeacherApproval(input.id, input.status),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ["org-teachers", organization.id] });
      toast.success(input.status === "approved" ? "Teacher approved" : "Request rejected");
    },
    onError: () => toast.error("Could not update the teacher"),
  });

  const teachers = (teachersQuery.data ?? []).filter((t) => t.role !== "owner");
  const pending = teachers.filter((t) => t.approval_status === "pending");
  const rest = teachers.filter((t) => t.approval_status !== "pending");

  return (
    <section className="panel mt-10 p-5">
      <p className="flex items-center gap-1.5 text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
        <Building2 className="size-3.5" /> {organization.name} — teachers
      </p>

      {pending.length === 0 && rest.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          No teachers yet. Share your organization name — teachers pick it when they sign up.
        </p>
      )}

      {pending.length > 0 && (
        <ul className="mt-4 space-y-2">
          {pending.map((teacher) => (
            <li
              key={teacher.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <TeacherIdentity teacher={teacher} />
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => decide.mutate({ id: teacher.id, status: "approved" })}
                  disabled={decide.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                >
                  <Check className="size-3.5" /> Approve
                </button>
                <button
                  onClick={() => decide.mutate({ id: teacher.id, status: "rejected" })}
                  disabled={decide.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-60"
                >
                  <X className="size-3.5" /> Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rest.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {rest.map((teacher) => (
            <li
              key={teacher.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border px-4 py-2.5"
            >
              <TeacherIdentity teacher={teacher} />
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                {teacher.approval_status === "approved" ? (
                  <>
                    <ShieldCheck className="size-3.5 text-success" /> Approved
                  </>
                ) : (
                  <>
                    <X className="size-3.5 text-destructive" /> Rejected
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TeacherIdentity({ teacher }: { teacher: TeacherProfile }) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-sm font-medium">
        {teacher.display_name ?? "Teacher"}
      </span>
      {teacher.email && (
        <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <Mail className="size-3" /> {teacher.email}
        </span>
      )}
    </span>
  );
}
