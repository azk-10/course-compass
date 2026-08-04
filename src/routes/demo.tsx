import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Activity,
  Ban,
  Compass,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  Volume2,
  Wrench,
} from "lucide-react";

import {
  ChatTabList,
  RawChatList,
  type ChatTab,
} from "@/components/dashboard/RawChatPanel";
import { ThreadBoard } from "@/components/dashboard/ThreadBoard";
import {
  MAX_RETAINED,
  SOCKET_AUDIENCE_LIMIT,
  flushIntervalFor,
  pollIntervalFor,
} from "@/lib/live-transport";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { buildStats } from "@/lib/threads";
import {
  DEMO_COURSE,
  DEMO_ORG,
  DEMO_TEACHER,
  burst,
  clone,
  createDemoState,
  pollBurst,
  tick,
  type BurstKind,
  type DemoState,
} from "@/lib/demo-engine";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Live Demo — AI Classroom Chat by Course Compass" },
      {
        name: "description",
        content:
          "Run a real 1000-student lecture in your browser: watch AI merge Urdu and English questions, filter spam and surface audio issues live.",
      },
      { property: "og:title", content: "Live Demo — AI Classroom Chat" },
      {
        property: "og:description",
        content:
          "An interactive simulation of a live class: automatic merging, classification, spam filtering and thread priority in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DemoPage,
});

const SIZES = [50, 100, 250, 500, 750, 1000];

const CONTROLS: { key: BurstKind | "poll"; label: string; icon: typeof Sparkles; count: number }[] =
  [
    { key: "question", label: "Question storm", icon: Sparkles, count: 24 },
    { key: "answer", label: "Answers", icon: Activity, count: 18 },
    { key: "spam", label: "Spam", icon: Ban, count: 14 },
    { key: "technical", label: "Audio issues", icon: Volume2, count: 12 },
    { key: "poll", label: "Poll responses", icon: Gauge, count: 60 },
  ];

function DemoPage() {
  const stateRef = useRef<DemoState>(createDemoState(250));
  const [view, setView] = useState<DemoState>(() => clone(stateRef.current));
  const [live, setLive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [tab, setTab] = useState<ChatTab>("topics");
  const [compare, setCompare] = useState(false);
  const [dev, setDev] = useState(false);
  const [reducedMotion, setReducedMotion] = useReducedMotion();
  const [announcement, setAnnouncement] = useState("");

  const mainRef = useRef<HTMLElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const lastAnnounced = useRef(0);

  const sync = useCallback(() => setView(clone(stateRef.current)), []);

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  // One interval drives the whole simulation; it stops on pause and unmount.
  // Reduced motion slows the cadence so the feed does not thrash.
  useEffect(() => {
    if (!live || paused) return;
    const id = window.setInterval(
      () => {
        tick(stateRef.current);
        sync();
      },
      reducedMotion ? 1600 : 700,
    );
    return () => window.clearInterval(id);
  }, [live, paused, sync, reducedMotion]);

  const stats = useMemo(
    () =>
      buildStats({
        threads: view.threads,
        participants: view.participants,
        votes: view.votes,
        feedback: view.feedback,
        threshold: 75,
      }),
    [view],
  );

  const unresolved = stats.filter(
    (item) => item.category !== "spam" && item.health !== "settled",
  ).length;

  // Periodic, throttled screen-reader summary of the live class.
  useEffect(() => {
    if (!live || paused) return;
    const now = Date.now();
    if (now - lastAnnounced.current < 15000) return;
    lastAnnounced.current = now;
    setAnnouncement(
      `${view.studentsOnline} students online, ${view.totalMessages} messages, ${unresolved} open topics.`,
    );
  }, [view.studentsOnline, view.totalMessages, unresolved, live, paused]);

  const runControl = useCallback(
    (key: BurstKind | "poll", count: number, label: string) => {
      if (key === "poll") pollBurst(stateRef.current, count);
      else burst(stateRef.current, key, count);
      sync();
      announce(`Generated ${count} ${label.toLowerCase()} messages.`);
    },
    [sync, announce],
  );

  const reset = useCallback(() => {
    stateRef.current = createDemoState(view.targetStudents);
    setLive(false);
    setPaused(false);
    sync();
    announce("Demo reset. Session stopped.");
    window.requestAnimationFrame(() => startRef.current?.focus());
  }, [view.targetStudents, sync, announce]);

  const togglePause = useCallback(() => {
    setPaused((value) => {
      announce(value ? "Simulation resumed." : "Simulation paused.");
      return !value;
    });
  }, [announce]);

  const setSize = (size: number) => {
    stateRef.current.targetStudents = size;
    sync();
  };

  const startSession = useCallback(() => {
    setLive(true);
    setPaused(false);
    announce("Live session started. Simulated students are joining.");
    window.requestAnimationFrame(() => mainRef.current?.focus());
  }, [announce]);

  // Keyboard shortcuts, ignored while typing in a field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      if (!live) {
        if (key === "s") {
          event.preventDefault();
          startSession();
        }
        return;
      }
      if (key === "p") {
        event.preventDefault();
        togglePause();
      } else if (key === "r") {
        event.preventDefault();
        reset();
      } else if (key === "c") {
        event.preventDefault();
        setCompare((value) => {
          announce(value ? "Showing AI classroom view." : "Showing Zoom comparison view.");
          return !value;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [live, startSession, togglePause, reset, announce]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#demo-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-foreground"
      >
        Skip to demo content
      </a>

      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>

      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back
        </Link>
        <span className="flex items-center gap-2 font-display text-sm font-semibold">
          <Compass className="size-4 text-accent" aria-hidden="true" /> {DEMO_ORG}
        </span>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {DEMO_TEACHER} · {DEMO_COURSE}
        </span>
        <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
          <span
            className={`size-2 rounded-full bg-accent ${reducedMotion ? "" : "animate-pulse"}`}
            aria-hidden="true"
          />
          {live ? "Live session" : "Not started"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums">
          <Users className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Students online:</span> {view.studentsOnline}
        </span>
      </header>

      {!live ? (
        <main
          id="demo-main"
          ref={mainRef}
          tabIndex={-1}
          className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-20 text-center outline-none"
        >
          <h1 className="max-w-2xl font-display text-4xl leading-tight font-semibold">
            The teacher clicks one button. The AI does the rest.
          </h1>
          <p className="max-w-xl text-sm/7 text-muted-foreground">
            This is the real product running against a simulated class of {view.targetStudents}{" "}
            students — same classification, same auto-merge, same thread priority. Nothing is
            pre-recorded.
          </p>
          <button
            ref={startRef}
            onClick={startSession}
            className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[var(--shadow-lift)] transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
          >
            Start Session
          </button>
          <ClassSizeSlider value={view.targetStudents} onChange={setSize} />
          <MotionToggle value={reducedMotion} onChange={setReducedMotion} />
          <p className="text-[11px] text-muted-foreground">
            Keyboard: <kbd>S</kbd> start · <kbd>P</kbd> pause · <kbd>R</kbd> reset · <kbd>C</kbd>{" "}
            compare
          </p>
        </main>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[13rem_minmax(0,1fr)_20rem]">
          <div className="border-b border-sidebar-border bg-sidebar py-3 text-sidebar-foreground lg:border-r lg:border-b-0">
            <ChatTabList
              messages={view.messages}
              tab={tab}
              onChange={setTab}
              threadCount={unresolved}
              sessionKey="demo"
            />
          </div>


          <main
            id="demo-main"
            ref={mainRef}
            tabIndex={-1}
            aria-label={compare ? "Zoom versus AI comparison" : "Live classroom feed"}
            className="flex min-h-0 flex-col outline-none"
          >
            {compare ? (
              <ComparisonView view={view} />
            ) : tab === "topics" ? (
              <ThreadBoard stats={stats} messages={view.messages} />
            ) : (
              <RawChatList messages={view.messages} tab={tab} />
            )}
          </main>

          <aside
            aria-label="Demo controls and live statistics"
            className="min-h-0 space-y-3 overflow-y-auto border-t border-border p-4 lg:border-t-0 lg:border-l"
          >
            <section className="panel p-4" aria-labelledby="demo-live-class">
              <h2 id="demo-live-class" className="font-display text-sm font-semibold">
                Live class
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Stat label="Students" value={view.studentsOnline} />
                <Stat label="Messages" value={view.totalMessages} />
                <Stat label="Topics" value={unresolved} />
                <Stat label="Spam hidden" value={view.counts.spam} />
                <Stat label="Questions" value={view.counts.question} />
                <Stat label="Audio issues" value={view.counts.technical} />
              </dl>
              {view.pollResponses.yes + view.pollResponses.no > 0 && (
                <p className="mt-3 flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-2 text-[11px]">
                  <Wrench className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  “Can you hear the teacher?” —{" "}
                  <span className="font-semibold text-accent">
                    {Math.round(
                      (view.pollResponses.yes / (view.pollResponses.yes + view.pollResponses.no)) *
                        100,
                    )}
                    % yes
                  </span>
                </p>
              )}
            </section>

            <section className="panel p-4" aria-labelledby="demo-controls">
              <h2 id="demo-controls" className="font-display text-sm font-semibold">
                Demo controls
              </h2>
              <div className="mt-3 grid gap-1.5">
                {CONTROLS.map(({ key, label, icon: Icon, count }) => (
                  <button
                    key={key}
                    onClick={() => runControl(key, count, label)}
                    aria-label={`Generate ${count} ${label.toLowerCase()} messages`}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ring-1 ring-border transition-colors hover:bg-muted active:scale-[0.97]"
                  >
                    <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" /> Generate{" "}
                    {label}
                  </button>
                ))}
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  <button
                    onClick={togglePause}
                    aria-pressed={paused}
                    aria-keyshortcuts="p"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ring-1 ring-border transition-colors hover:bg-muted active:scale-[0.97]"
                  >
                    {paused ? (
                      <Play className="size-3.5" aria-hidden="true" />
                    ) : (
                      <Pause className="size-3.5" aria-hidden="true" />
                    )}
                    {paused ? "Resume" : "Pause"}
                  </button>
                  <button
                    onClick={reset}
                    aria-keyshortcuts="r"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ring-1 ring-border transition-colors hover:bg-muted active:scale-[0.97]"
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" /> Reset
                  </button>
                </div>
              </div>
            </section>

            <section className="panel p-4" aria-labelledby="demo-stress">
              <h2 id="demo-stress" className="font-display text-sm font-semibold">
                Stress test
              </h2>
              <ClassSizeSlider value={view.targetStudents} onChange={setSize} />
              <button
                onClick={() => {
                  burst(stateRef.current, "question", Math.round(view.targetStudents / 2));
                  burst(stateRef.current, "answer", Math.round(view.targetStudents / 5));
                  burst(stateRef.current, "spam", Math.round(view.targetStudents / 6));
                  sync();
                  announce(`Flooded the class with ${view.targetStudents} simultaneous students.`);
                }}
                className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.97]"
              >
                Flood {view.targetStudents} students at once
              </button>
            </section>

            <LoadPanel audience={view.targetStudents} messageCount={view.messages.length} />

            <label className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
              <span>Compare with Zoom chat</span>
              <input
                type="checkbox"
                checked={compare}
                aria-keyshortcuts="c"
                onChange={(event) => setCompare(event.target.checked)}
                className="size-4 accent-[var(--accent)]"
              />
            </label>

            <MotionToggle value={reducedMotion} onChange={setReducedMotion} inline />

            <label className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
              <span>Developer mode</span>
              <input
                type="checkbox"
                checked={dev}
                onChange={(event) => setDev(event.target.checked)}
                className="size-4 accent-[var(--accent)]"
              />
            </label>

            {dev && (
              <div
                className="panel space-y-1 p-4 font-mono text-[11px] text-muted-foreground"
                aria-label="Developer metrics"
                role="group"
              >
                <p>merge confidence · {view.metrics.lastConfidence.toFixed(2)}</p>
                <p>
                  merged / processed · {view.metrics.merged}/{view.metrics.processed}
                </p>
                <p>merge time · {view.metrics.lastMergeMs.toFixed(2)} ms</p>
                <p>avg merge time · {view.metrics.avgMergeMs.toFixed(2)} ms</p>
                <p>db latency · {view.metrics.dbLatencyMs} ms</p>
                <p>realtime latency · {view.metrics.realtimeLatencyMs} ms</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function MotionToggle({
  value,
  onChange,
  inline,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  inline?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs ${
        inline ? "" : "w-full max-w-sm"
      }`}
    >
      <span>Reduce motion</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-[var(--accent)]"
      />
    </label>
  );
}


function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2.5 py-2">
      <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="font-display text-lg font-semibold tabular-nums text-accent">{value}</dd>
    </div>
  );
}

function ClassSizeSlider({ value, onChange }: { value: number; onChange: (size: number) => void }) {
  const index = Math.max(0, SIZES.indexOf(value));
  return (
    <div className="mt-3 w-full max-w-sm">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Class size</span>
        <span className="font-semibold tabular-nums text-accent">{value} students</span>
      </div>
      <input
        type="range"
        min={0}
        max={SIZES.length - 1}
        step={1}
        value={index}
        aria-label="Simulated class size"
        onChange={(event) => onChange(SIZES[Number(event.target.value)] ?? 250)}
        className="mt-2 w-full accent-[var(--accent)]"
      />
    </div>
  );
}

function ComparisonView({ view }: { view: DemoState }) {
  const questions = view.counts.question;
  const technical = view.counts.technical;
  const answers = view.counts.answer;

  return (
    <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:p-6 lg:grid-cols-2">
      <section className="panel flex min-h-0 flex-col p-4">
        <h2 className="font-display text-sm font-semibold text-muted-foreground">Zoom chat</h2>
        <ul className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto text-sm">
          {view.zoom.map((item) => (
            <li key={item.id} className="truncate text-muted-foreground">
              <span className="font-medium text-foreground/70">{item.label}:</span> {item.body}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {view.totalMessages} unread messages scrolling past the teacher.
        </p>
      </section>

      <section className="panel flex min-h-0 flex-col p-4">
        <h2 className="font-display text-sm font-semibold text-accent">AI Classroom Chat</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <CompareRow title="Question 5" count={questions} />
          <CompareRow title="Momentum formula" count={answers} />
          <CompareRow title="Audio issue" count={technical} />
          <li className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Spam hidden · {view.counts.spam} messages filtered automatically
          </li>
        </ul>
      </section>
    </div>
  );
}

function CompareRow({ title, count }: { title: string; count: number }) {
  return (
    <li className="rounded-lg bg-secondary px-3 py-2">
      <p className="font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">Messages: {count}</p>
    </li>
  );
}

/**
 * Load proof: runs the production transport policy against the simulated class
 * size and measures what the browser is actually doing while it renders.
 */
function LoadPanel({ audience, messageCount }: { audience: number; messageCount: number }) {
  const [fps, setFps] = useState(60);
  const [worstFrame, setWorstFrame] = useState(0);
  const [rate, setRate] = useState(0);
  const lastCount = useRef(messageCount);

  useEffect(() => {
    let frames = 0;
    let worst = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (time: number) => {
      const delta = time - last;
      last = time;
      frames += 1;
      if (delta > worst) worst = delta;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const timer = setInterval(() => {
      setFps(frames);
      setWorstFrame(Math.round(worst));
      frames = 0;
      worst = 0;
    }, 1_000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setRate(Math.max(0, messageCount - lastCount.current));
      lastCount.current = messageCount;
    }, 1_000);
    return () => clearInterval(timer);
  }, [messageCount]);

  const mode = audience > SOCKET_AUDIENCE_LIMIT ? "polling" : "socket";
  const queueDepth = Math.round(rate * 1.5);

  return (
    <div className="panel space-y-2 p-4">
      <h2 className="font-display text-sm font-semibold">Load path</h2>
      <dl className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-muted-foreground">
        <dt>transport</dt>
        <dd className="text-right text-foreground">{mode}</dd>
        <dt>{mode === "polling" ? "poll every" : "socket"}</dt>
        <dd className="text-right text-foreground">
          {mode === "polling" ? `${pollIntervalFor(audience)} ms ±25%` : "live"}
        </dd>
        <dt>flush every</dt>
        <dd className="text-right text-foreground">{flushIntervalFor(queueDepth)} ms</dd>
        <dt>queue depth</dt>
        <dd className="text-right text-foreground">{queueDepth}</dd>
        <dt>msgs / sec</dt>
        <dd className="text-right text-foreground">{rate}</dd>
        <dt>retained</dt>
        <dd className="text-right text-foreground">
          {Math.min(messageCount, MAX_RETAINED)} / {MAX_RETAINED}
        </dd>
        <dt>frames / sec</dt>
        <dd className="text-right text-foreground">{fps}</dd>
        <dt>worst frame</dt>
        <dd className="text-right text-foreground">{worstFrame} ms</dd>
      </dl>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Above {SOCKET_AUDIENCE_LIMIT} students the app drops the websocket and reads the feed with
        jittered incremental polls, then coalesces every burst into one render.
      </p>
    </div>
  );
}
