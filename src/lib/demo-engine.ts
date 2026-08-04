import { localClassify, isAudioIssue, toCategory, type Category } from "@/lib/classify";
import { textSimilarity } from "@/lib/grouping";
import type { ChatMessage } from "@/lib/live-chat";
import type { FeedbackRow, Thread, ThreadRow } from "@/lib/threads";

/**
 * A completely local classroom simulation. It runs the *same* classification,
 * similarity and thread-statistics logic as the live product, so what a visitor
 * sees in the demo is exactly what a teacher gets in a real session — only the
 * students are synthetic and nothing touches the database.
 */

export const DEMO_ORG = "Demo Academy";
export const DEMO_TEACHER = "Sarah Ahmed";
export const DEMO_COURSE = "Physics Crash Course";
export const DEMO_SESSION_ID = "demo-session";

export const DEMO_NAMES = [
  "Ahmed",
  "Ali",
  "Ayesha",
  "Fatima",
  "Hamza",
  "Usman",
  "Hassan",
  "Maryam",
  "Zain",
  "Hira",
  "Bilal",
  "Sana",
  "Areeba",
  "Danish",
  "Emily",
  "Noah",
  "Zoya",
  "Ibrahim",
  "Laiba",
  "Rohan",
];

export const POOLS = {
  question: [
    "Question 5",
    "Q5",
    "Question five",
    "Please explain Q5",
    "Question no. 5",
    "sawal number panch",
    "سوال نمبر پانچ",
    "Momentum formula",
    "momentum ka formula kya hai",
    "What is the momentum formula?",
    "Sir repeat",
    "sir dobara samjha dein",
    "Can you explain elastic collision?",
    "Why is momentum conserved?",
  ],
  answer: [
    "Answer is B",
    "39",
    "Thirty nine",
    "39N",
    "Momentum = mv",
    "p = m v",
    "B",
    "its 39 newton",
  ],
  technical: [
    "Can't hear",
    "Voice issue",
    "awaz nahi aa rahi",
    "Lag",
    "Screen froze",
    "screen share not visible",
    "audio cutting",
    "sir mic mute hai",
  ],
  spam: [
    "😂😂😂",
    "hello",
    "hi",
    "Sir",
    "asalamualaikum",
    "!!!!!",
    "www.freenotes.example",
  ],
  general: [
    "whats up",
    "all good?",
    "thanks sir",
    "kaise ho",
    "how are you",
  ],
} as const;

export type BurstKind = keyof typeof POOLS;

export type DemoMetrics = {
  processed: number;
  merged: number;
  lastMergeMs: number;
  avgMergeMs: number;
  dbLatencyMs: number;
  realtimeLatencyMs: number;
  lastConfidence: number;
};

export type DemoState = {
  studentsOnline: number;
  targetStudents: number;
  messages: ChatMessage[];
  threads: Thread[];
  participants: ThreadRow[];
  votes: ThreadRow[];
  feedback: FeedbackRow[];
  zoom: { id: string; label: string; body: string }[];
  counts: Record<Category, number>;
  totalMessages: number;
  pollResponses: { yes: number; no: number };
  metrics: DemoMetrics;
};

const MAX_MESSAGES = 320;
const MAX_ZOOM = 60;

let seq = 0;
const uid = (prefix: string) => `${prefix}-${(seq += 1)}`;

export const pick = <T,>(list: readonly T[]): T =>
  list[Math.floor(Math.random() * list.length)] as T;

export function createDemoState(target = 250): DemoState {
  seq = 0;
  return {
    studentsOnline: 0,
    targetStudents: target,
    messages: [],
    threads: [],
    participants: [],
    votes: [],
    feedback: [],
    zoom: [],
    counts: { question: 0, answer: 0, technical: 0, general: 0, spam: 0 },
    totalMessages: 0,
    pollResponses: { yes: 0, no: 0 },
    metrics: {
      processed: 0,
      merged: 0,
      lastMergeMs: 0,
      avgMergeMs: 0,
      dbLatencyMs: 24,
      realtimeLatencyMs: 41,
      lastConfidence: 0,
    },
  };
}

function titleFor(body: string, category: Category): string {
  const clean = body.trim().replace(/\s+/g, " ");
  if (category === "technical") return isAudioIssue(clean) ? "Audio issue" : "Technical issue";
  if (category === "spam") return "Filtered chatter";
  if (category === "general") return "Off-topic chat";
  const short = clean.length > 46 ? `${clean.slice(0, 46)}…` : clean;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

/** Runs one message through classification + auto-merge, mutating the state. */
export function ingest(state: DemoState, body: string, label: string): void {
  const started =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const { category, confidence } = localClassify(body);
  const now = new Date().toISOString();

  // Auto-merge against the live threads of the same category.
  let thread =
    state.threads
      .filter((item) => item.category === category && item.status !== "archived")
      .map((item) => ({ item, score: textSimilarity(body, item.title) }))
      .filter((entry) => entry.score >= 0.45)
      .sort((a, b) => b.score - a.score)[0]?.item ?? null;

  const mergedIntoExisting = Boolean(thread);
  if (!thread) {
    thread = {
      id: uid("thread"),
      session_id: DEMO_SESSION_ID,
      course_id: "demo-course",
      teacher_id: "demo-teacher",
      title: titleFor(body, category),
      status: "open",
      category,
      created_at: now,
      last_activity_at: now,
    };
    state.threads = [...state.threads, thread];
  } else {
    thread.last_activity_at = now;
  }

  const message: ChatMessage = {
    id: uid("msg"),
    session_id: DEMO_SESSION_ID,
    course_id: "demo-course",
    student_id: null,
    thread_id: thread.id,
    sender_label: label,
    is_teacher: false,
    message_type: "chat",
    category,
    confidence,
    body,
    created_at: now,
  };

  state.messages = [...state.messages, message].slice(-MAX_MESSAGES);
  state.totalMessages += 1;
  state.counts[category] += 1;

  if (!state.participants.some((row) => row.thread_id === thread.id && row.student_label === label)) {
    state.participants = [
      ...state.participants,
      { id: uid("p"), thread_id: thread.id, student_label: label },
    ];
  }

  // Peer signals: upvotes and "got it" / "still confused" feedback.
  if (category === "question" || category === "technical") {
    if (Math.random() < 0.55) {
      state.votes = [...state.votes, { id: uid("v"), thread_id: thread.id, student_label: label }];
    }
    if (Math.random() < 0.4) {
      state.feedback = [
        ...state.feedback,
        {
          id: uid("f"),
          thread_id: thread.id,
          student_label: label,
          state: Math.random() < 0.55 ? "resolved" : "need_help",
        },
      ];
    }
  }

  state.zoom = [
    ...state.zoom,
    { id: uid("z"), label, body },
  ].slice(-MAX_ZOOM);

  const elapsed =
    (typeof performance !== "undefined" ? performance.now() : Date.now()) - started;
  const metrics = state.metrics;
  metrics.processed += 1;
  if (mergedIntoExisting) metrics.merged += 1;
  metrics.lastMergeMs = Number(elapsed.toFixed(2));
  metrics.avgMergeMs = Number(
    ((metrics.avgMergeMs * (metrics.processed - 1) + elapsed) / metrics.processed).toFixed(2),
  );
  metrics.lastConfidence = confidence;
  metrics.dbLatencyMs = 18 + Math.round(Math.random() * 22);
  metrics.realtimeLatencyMs = 28 + Math.round(Math.random() * 34);
}

/** Sends a burst of messages of one kind. */
export function burst(state: DemoState, kind: BurstKind, count: number): void {
  for (let index = 0; index < count; index += 1) {
    ingest(state, pick(POOLS[kind]), pick(DEMO_NAMES));
  }
}

/** Classroom-wide poll answers, used by the "Generate poll responses" control. */
export function pollBurst(state: DemoState, count: number): void {
  for (let index = 0; index < count; index += 1) {
    if (Math.random() < 0.72) state.pollResponses.yes += 1;
    else state.pollResponses.no += 1;
  }
}

/** One simulation frame: students trickle in and a few messages arrive. */
export function tick(state: DemoState): void {
  if (state.studentsOnline < state.targetStudents) {
    const gap = state.targetStudents - state.studentsOnline;
    state.studentsOnline = Math.min(
      state.targetStudents,
      state.studentsOnline + Math.max(1, Math.ceil(gap * 0.28)),
    );
  } else if (state.studentsOnline > state.targetStudents) {
    state.studentsOnline = state.targetStudents;
  }

  // Traffic scales with class size, the way it does in a real lecture.
  const load = Math.max(1, Math.round(state.studentsOnline / 160));
  const weights: [BurstKind, number][] = [
    ["question", 0.42],
    ["answer", 0.2],
    ["technical", 0.14],
    ["spam", 0.14],
    ["general", 0.1],
  ];

  for (let index = 0; index < load; index += 1) {
    const roll = Math.random();
    let acc = 0;
    for (const [kind, weight] of weights) {
      acc += weight;
      if (roll <= acc) {
        ingest(state, pick(POOLS[kind]), pick(DEMO_NAMES));
        break;
      }
    }
  }

  // Threads that reached consensus quietly archive themselves.
  for (const thread of state.threads) {
    if (thread.status === "archived") continue;
    const answered = state.feedback.filter((row) => row.thread_id === thread.id);
    const ok = answered.filter((row) => row.state === "resolved").length;
    if (answered.length >= 6 && ok / answered.length >= 0.75) thread.status = "archived";
  }
}

export function clone(state: DemoState): DemoState {
  return {
    ...state,
    counts: { ...state.counts },
    metrics: { ...state.metrics },
    pollResponses: { ...state.pollResponses },
    threads: state.threads.map((thread) => ({ ...thread })),
  };
}

export { toCategory };
