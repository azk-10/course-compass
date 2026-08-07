import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  Hourglass,
  LogOut,
  RefreshCw,
  ShieldX,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { OrganizationPicker } from "@/components/org/OrganizationPicker";
import { PLANS } from "@/lib/plans";
import {
  fetchOrganization,
  leaveOrganization,
  requestOrganizationJoin,
  type Organization,
  type TeacherProfile,
} from "@/lib/org";

/**
 * Gate shown to a teacher whose organization request has not been decided yet
 * (or was rejected). It names the organization, polls for the owner's decision
 * and lets the teacher switch organization or go independent instead.
 */
export function PendingApproval({
  profile,
  onRefresh,
  onSignOut,
}: {
  profile: TeacherProfile;
  onRefresh: () => void;
  onSignOut: () => void;
}) {
  const queryClient = useQueryClient();
  const rejected = profile.approval_status === "rejected";
  const [switching, setSwitching] = useState(false);
  const [pick, setPick] = useState<Organization | null>(null);
  const [independent, setIndependent] = useState(false);

  const orgQuery = useQuery({
    queryKey: ["organization", profile.organization_id],
    queryFn: () => fetchOrganization(profile.organization_id!),
    enabled: !!profile.organization_id,
    // Keep checking for the owner's decision while this screen is open.
    refetchInterval: rejected ? false : 15_000,
  });

  const hasOrg = !!profile.organization_id;
  const reviewer = hasOrg ? (orgQuery.data?.name ?? "your organization") : "the Course Compass team";
  const orgName = reviewer;

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    onRefresh();
  };

  const joinMutation = useMutation({
    mutationFn: (orgId: string) => requestOrganizationJoin(orgId),
    onSuccess: () => {
      setSwitching(false);
      setPick(null);
      toast.success("Request sent — the owner will review it.");
      refreshAll();
    },
    onError: () => toast.error("Could not send the request"),
  });

  const leaveMutation = useMutation({
    mutationFn: leaveOrganization,
    onSuccess: () => {
      toast.success("You are now an independent teacher.");
      refreshAll();
    },
    onError: () => toast.error("Could not update your account"),
  });

  const busy = joinMutation.isPending || leaveMutation.isPending;

  return (
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className="panel w-full max-w-lg p-8">
        <div className="flex items-center gap-3">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-full ${
              rejected ? "bg-destructive/10 text-destructive" : "bg-accent/15 text-accent"
            }`}
          >
            {rejected ? (
              <ShieldX className="size-5" />
            ) : (
              <Hourglass className="size-5 animate-pulse" />
            )}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold">
              {rejected ? "Request not approved" : "Waiting for approval"}
            </h1>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Building2 className="size-3.5 shrink-0" />
              {hasOrg && orgQuery.isLoading ? "Loading organization…" : orgName}
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm/6 text-muted-foreground">
          {rejected
            ? `${hasOrg ? `The owner of ${orgName}` : "The Course Compass team"} did not approve this account. Ask for another review, or pick a different organization.`
            : `Your account request was sent to ${hasOrg ? `the owner of ${orgName}` : "the Course Compass team"}. Nothing unlocks until it is approved — courses and live sessions stay locked. This page checks automatically.`}
        </p>

        {!rejected && (
          <ol className="mt-6 space-y-3">
            <Step done label="Account created" detail={profile.email ?? "Your teacher account"} />
            <Step done label="Request sent" detail={`Delivered to ${orgName}`} />
            <Step
              label="Approval"
              detail="Pending — you will get access the moment it is approved"
            />
          </ol>
        )}

        <div className="mt-6 rounded-lg border border-border bg-secondary/40 p-4">
          <p className="text-sm font-semibold">Pick your subscription while you wait</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Approval and a plan go together — tell us which one you want and we set it up the moment
            your account is approved.
          </p>
          <div className="mt-3 grid gap-2">
            {PLANS.map((plan) => (
              <Link
                key={plan.id}
                to="/contact"
                search={{ plan: plan.id }}
                className="group flex items-center justify-between gap-3 rounded-lg border border-input bg-card px-3 py-2.5 text-sm transition-colors hover:bg-secondary"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{plan.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {plan.audience}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold">
                  {plan.price}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>

        {switching ? (
          <div className="mt-6 rounded-lg border border-border p-4">
            <p className="text-xs font-medium text-muted-foreground">Choose a different option</p>
            <div className="mt-2">
              <OrganizationPicker
                value={pick}
                onSelect={(next) => {
                  setPick(next);
                  if (next) setIndependent(false);
                }}
                independent={independent}
                onIndependent={(next) => {
                  setIndependent(next);
                  if (next) setPick(null);
                }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                disabled={busy || (!pick && !independent)}
                onClick={() => {
                  if (independent) leaveMutation.mutate();
                  else if (pick) joinMutation.mutate(pick.id);
                }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {independent ? "Request review without an organization" : "Send request"}
              </button>
              <button
                onClick={() => setSwitching(false)}
                className="rounded-lg border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={refreshAll}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <RefreshCw className="size-3.5" /> Check again
            </button>
            <button
              onClick={() => setSwitching(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <UserRound className="size-3.5" /> Change organization
            </button>
            <button
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <LogOut className="size-3.5" /> Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({ done, label, detail }: { done?: boolean; label: string; detail: string }) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-1 size-2.5 shrink-0 rounded-full ${done ? "bg-accent" : "bg-border ring-2 ring-accent/30"}`}
      />
      <span className="min-w-0">
        <span className={`block text-sm font-medium ${done ? "" : "text-muted-foreground"}`}>
          {label}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
    </li>
  );
}
