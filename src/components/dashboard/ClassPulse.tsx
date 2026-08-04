import { Activity } from "lucide-react";

import { REACTIONS, reactionShares, type SessionReaction } from "@/lib/moderation";

/** What share of the class just acknowledged — the teacher's temperature check. */
export function ClassPulse({ reactions }: { reactions: SessionReaction[] }) {
  const shares = reactionShares(reactions);
  const total = shares.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Activity className="size-4 text-muted-foreground" /> Class pulse
        </h3>
        <span className="text-xs text-muted-foreground">{total} in last 3 min</span>
      </div>

      {total === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No reactions yet — students can tap Yes, Repeat or Understood while you teach.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {shares
            .filter((share) => share.count > 0)
            .sort((a, b) => b.count - a.count)
            .map((share) => {
              const meta = REACTIONS.find((item) => item.kind === share.kind)!;
              return (
                <li key={share.kind}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">
                      {meta.emoji} {meta.label}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {share.pct}% · {share.count}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                      style={{ width: `${share.pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
