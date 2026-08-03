import { MessageSquare, ListChecks, Square } from "lucide-react";
import { useState } from "react";

import type { AnswerType, Session, SessionMode } from "@/lib/dashboard-data";

const ANSWER_TYPES: { value: AnswerType; label: string }[] = [
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "number", label: "Number" },
  { value: "short_text", label: "Short text" },
  { value: "formula", label: "Formula" },
];

export function ModeControls({
  session,
  onMode,
  onQuiz,
  onEnd,
  busy,
}: {
  session: Session;
  onMode: (mode: SessionMode) => void;
  onQuiz: (input: { prompt: string; answerType: AnswerType; options: string[] }) => void;
  onEnd: () => void;
  busy: boolean;
}) {
  const [prompt, setPrompt] = useState(session.quiz_prompt ?? "");
  const [answerType, setAnswerType] = useState<AnswerType>(
    (session.quiz_answer_type as AnswerType) ?? "multiple_choice",
  );
  const [options, setOptions] = useState(session.quiz_options.join(", ") || "A, B, C, D");
  const quizMode = session.mode === "quiz";

  return (
    <div className="border-t border-border bg-card px-4 py-3 sm:px-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ModeButton
            active={!quizMode}
            icon={<MessageSquare className="size-4" />}
            label="Question Mode"
            onClick={() => onMode("question")}
            disabled={busy}
          />
          <ModeButton
            active={quizMode}
            icon={<ListChecks className="size-4" />}
            label="Quiz Mode"
            onClick={() => onMode("quiz")}
            disabled={busy}
          />
        </div>
        <button
          onClick={onEnd}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-60"
        >
          <Square className="size-4" /> End Session
        </button>
      </div>

      {quizMode && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!prompt.trim()) return;
            onQuiz({
              prompt: prompt.trim(),
              answerType,
              options:
                answerType === "multiple_choice"
                  ? options
                      .split(",")
                      .map((option) => option.trim())
                      .filter(Boolean)
                  : [],
            });
          }}
          className="mt-3 grid gap-2 rounded-lg bg-secondary p-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"
        >
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask the class a question…"
            maxLength={300}
            className="h-9 min-w-0 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
          />
          <select
            value={answerType}
            onChange={(event) => setAnswerType(event.target.value as AnswerType)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-accent"
          >
            {ANSWER_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!prompt.trim() || busy}
            className="h-9 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-60"
          >
            Push question
          </button>
          {answerType === "multiple_choice" && (
            <input
              value={options}
              onChange={(event) => setOptions(event.target.value)}
              placeholder="Options, comma separated"
              className="h-9 min-w-0 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent sm:col-span-3"
            />
          )}
        </form>
      )}
    </div>
  );
}

function ModeButton({
  active,
  icon,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
        active
          ? "bg-accent text-accent-foreground"
          : "border border-input text-foreground hover:bg-secondary"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
