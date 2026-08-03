import { Activity } from "lucide-react";
import type { QuestionGroup, ResponseRow, Session } from "@/lib/dashboard-data";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-secondary px-3 py-3">
      <p className="text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function LiveStats({
  session,
  responses,
  groups,
}: {
  session: Session | null;
  responses: ResponseRow[];
  groups: QuestionGroup[];
}) {
  const questions = groups.flatMap((g) => g.questions);
  const participants = new Set(responses.map((r) => r.student_label)).size;
  const correct = responses.filter((r) => r.is_correct).length;
  const accuracy = responses.length ? Math.round((correct / responses.length) * 100) : 0;
  const elapsed = session
    ? Math.max(0, Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000))
    : 0;

  const perQuestion = questions
    .map((q) => {
      const rows = responses.filter((r) => r.question_id === q.id);
      const ok = rows.filter((r) => r.is_correct).length;
      return {
        id: q.id,
        prompt: q.prompt,
        total: rows.length,
        pct: rows.length ? Math.round((ok / rows.length) * 100) : 0,
      };
    })
    .filter((q) => q.total > 0);

  return (
    <div className="panel sticky top-6 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold">Live statistics</h3>
        {session ? (
          <span className="inline-flex items-center gap-2 text-xs font-medium text-success">
            <span className="live-dot" /> Live
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Idle</span>
        )}
      </div>

      {!session ? (
        <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
          <Activity className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Start a session to collect responses and see participation update in real time.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat label="Students" value={String(participants)} hint="answered so far" />
            <Stat label="Responses" value={String(responses.length)} />
            <Stat label="Accuracy" value={`${accuracy}%`} hint={`${correct} correct`} />
            <Stat label="Elapsed" value={`${elapsed}m`} hint="since start" />
          </div>

          <div className="mt-5">
            <p className="text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
              Per question
            </p>
            {perQuestion.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Waiting for the first answer…
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {perQuestion.map((q) => (
                  <li key={q.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-xs font-medium">{q.prompt}</p>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {q.pct}% · {q.total}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-accent transition-[width] duration-500"
                        style={{ width: `${q.pct}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
