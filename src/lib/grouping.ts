import type { ChatMessage } from "@/lib/live-chat";

/**
 * Derived grouping layer. Raw messages are never mutated — every group keeps
 * pointers to the original rows so the teacher can act on classroom intent
 * instead of reading an individual chat feed.
 */
export type MessageGroup = {
  /** Stable key for the merged intent. */
  key: string;
  /** Human label shown on the card. */
  label: string;
  /** Distinct student count. */
  students: number;
  /** Distinct example phrasings, most representative first. */
  examples: string[];
  /** All raw messages merged into this group. */
  messages: ChatMessage[];
  /** Message the teacher pins to broadcast this group. */
  representativeId: string;
  lastAt: string;
};

const NUMBER_WORDS: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fifty: "50",
  sixty: "60",
  seventy: "70",
  eighty: "80",
  ninety: "90",
  hundred: "100",
};

const STOPWORDS = new Set([
  "a",
  "again",
  "an",
  "and",
  "any",
  "are",
  "can",
  "cant",
  "could",
  "did",
  "do",
  "dont",
  "for",
  "get",
  "got",
  "hi",
  "how",
  "i",
  "in",
  "is",
  "it",
  "its",
  "just",
  "kindly",
  "ma'am",
  "maam",
  "me",
  "my",
  "no",
  "not",
  "of",
  "ok",
  "on",
  "once",
  "one",
  "please",
  "plz",
  "pls",
  "sir",
  "so",
  "that",
  "the",
  "this",
  "to",
  "understand",
  "understood",
  "us",
  "was",
  "we",
  "what",
  "whats",
  "why",
  "will",
  "with",
  "you",
  "your",
]);

const SYNONYMS: Record<string, string> = {
  q: "question",
  ques: "question",
  qn: "question",
  eq: "formula",
  equation: "formula",
  formulae: "formula",
  formulas: "formula",
  repeat: "explain",
  redo: "explain",
  rexplain: "explain",
  reexplain: "explain",
  clarify: "explain",
  solve: "explain",
  audio: "voice",
  sound: "voice",
  mic: "voice",
  microphone: "voice",
  hear: "voice",
  hearing: "voice",
  inaudible: "voice",
  breaking: "voice",
  lag: "voice",
  laggy: "voice",
  screen: "share",
  slide: "share",
  slides: "share",
};

function baseNormalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9+×*/=().\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  const flat = baseNormalize(text)
    // "q5" / "q 5" / "question five" all collapse to "question 5"
    .replace(/\bq\s*\.?\s*(\d+)/g, "question $1")
    .replace(/\bquestion\s+([a-z]+)/g, (match, word: string) =>
      NUMBER_WORDS[word] ? `question ${NUMBER_WORDS[word]}` : match,
    );

  return flat
    .split(/[\s().]+/)
    .map((token) => token.replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .map((token) => NUMBER_WORDS[token] ?? token)
    .map((token) => SYNONYMS[token] ?? token)
    .filter((token) => !STOPWORDS.has(token));
}

function titleCase(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/* ------------------------------- questions -------------------------------- */

/** Signature of a message: an intent key when recognisable, else its token set. */
function questionSignature(body: string): { key: string | null; label: string | null; set: Set<string> } {
  const list = tokens(body);
  const set = new Set(list);

  const questionIndex = list.indexOf("question");
  const number = questionIndex >= 0 ? list.slice(questionIndex + 1).find((t) => /^\d+$/.test(t)) : undefined;
  if (number) {
    const part = /part\s*\(?([a-d])\)?/.exec(baseNormalize(body))?.[1];
    return part
      ? { key: `q${number}-${part}`, label: `Question ${number}, part (${part})`, set }
      : { key: `q${number}`, label: `Explain Question ${number}`, set };
  }
  if (set.has("voice")) return { key: "voice", label: "Voice issues", set };
  if (set.has("share")) return { key: "share", label: "Screen sharing issues", set };
  if (set.has("formula")) {
    const topic = list.find((t) => t !== "formula" && !/^\d+$/.test(t));
    return topic
      ? { key: `formula-${topic}`, label: `${titleCase(topic)} formula`, set }
      : { key: "formula", label: "Formula asked", set };
  }
  return { key: null, label: null, set };
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const value of a) if (b.has(value)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/* --------------------------------- answers -------------------------------- */

const FORMULA_WORDS: Record<string, string> = {
  force: "f",
  mass: "m",
  acceleration: "a",
  velocity: "v",
  momentum: "p",
  energy: "e",
  time: "t",
  distance: "d",
  speed: "v",
  work: "w",
  power: "p",
  times: "*",
  into: "*",
  by: "/",
  over: "/",
};

/** Canonical form of an answer so "39", "Thirty Nine" and "039" merge. */
export function answerKey(body: string): string {
  const raw = baseNormalize(body);

  // formulas / equations
  if (raw.includes("=")) {
    const compact = raw
      .split(/\s+/)
      .map((word) => FORMULA_WORDS[word] ?? word)
      .join(" ")
      .replace(/[×x]/g, "*")
      .replace(/\s+/g, "");
    const sides = compact.split("=").map((side) => [...side.replace(/[*]/g, "")].sort().join(""));
    return `f:${sides.sort().join("=")}`;
  }

  // number words → digits ("thirty-nine" / "thirty nine" → 39)
  const words = raw.split(/[\s-]+/).filter(Boolean);
  if (words.length && words.every((word) => NUMBER_WORDS[word] || /^\d+$/.test(word))) {
    const values = words.map((word) => Number(NUMBER_WORDS[word] ?? word));
    const total = values.reduce((sum, value) => (value >= 100 ? sum * value : sum + value), 0);
    if (Number.isFinite(total)) return `n:${total}`;
  }
  const numeric = raw.replace(/[^0-9.]/g, "");
  if (numeric && /^[0-9.\s]+$/.test(raw)) return `n:${Number(numeric)}`;

  const text = words.map((word) => FORMULA_WORDS[word] ?? word).join("");
  return `t:${text}`;
}

/* --------------------------------- grouping -------------------------------- */

function build(key: string, label: string, messages: ChatMessage[]): MessageGroup {
  const sorted = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const seen = new Set<string>();
  const examples: string[] = [];
  const counts = new Map<string, number>();
  for (const message of sorted) {
    const normalized = baseNormalize(message.body);
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      examples.push(message.body.trim());
    }
  }
  const students = new Set(sorted.map((m) => m.student_id ?? m.sender_label)).size;
  const popular = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const last = sorted[sorted.length - 1]!;
  const representative = sorted.find((m) => baseNormalize(m.body) === popular) ?? last;

  return {
    key,
    label,
    students,
    examples: examples.slice(0, 6),
    messages: sorted,
    representativeId: representative.id,
    lastAt: last.created_at,
  };
}

/** Merges natural-language questions into discussion cards. */
export function groupQuestions(messages: ChatMessage[]): MessageGroup[] {
  const buckets: { key: string; label: string; set: Set<string>; items: ChatMessage[] }[] = [];

  for (const message of messages) {
    if (message.is_teacher || message.message_type === "answer") continue;
    const { key, label, set } = questionSignature(message.body);

    if (key) {
      const existing = buckets.find((bucket) => bucket.key === key);
      if (existing) existing.items.push(message);
      else buckets.push({ key, label: label!, set, items: [message] });
      continue;
    }

    // Fuzzy fallback for free-form phrasing.
    let best: (typeof buckets)[number] | null = null;
    let bestScore = 0;
    for (const bucket of buckets) {
      if (bucket.key.startsWith("q") && !bucket.key.startsWith("free:")) continue;
      const score = jaccard(set, bucket.set);
      if (score > bestScore) {
        bestScore = score;
        best = bucket;
      }
    }
    if (best && bestScore >= 0.5) {
      best.items.push(message);
      for (const token of set) best.set.add(token);
    } else {
      buckets.push({
        key: `free:${[...set].sort().join("-") || message.id}`,
        label: titleCase(message.body.trim().slice(0, 60)),
        set,
        items: [message],
      });
    }
  }

  return buckets
    .map((bucket) => build(bucket.key, bucket.label, bucket.items))
    .sort((a, b) => b.students - a.students || b.lastAt.localeCompare(a.lastAt));
}

/** Merges submitted answers into equivalent-value cards. */
export function groupAnswers(messages: ChatMessage[]): MessageGroup[] {
  const buckets = new Map<string, ChatMessage[]>();
  for (const message of messages) {
    if (message.is_teacher || message.message_type !== "answer") continue;
    const key = answerKey(message.body);
    buckets.set(key, [...(buckets.get(key) ?? []), message]);
  }
  return [...buckets.entries()]
    .map(([key, items]) => {
      const group = build(key, "", items);
      return { ...group, label: group.examples[0] ?? "—" };
    })
    .sort((a, b) => b.students - a.students || b.lastAt.localeCompare(a.lastAt));
}
