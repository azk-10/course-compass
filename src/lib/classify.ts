/**
 * Message categories. Every incoming message is classified automatically in the
 * background — students never have to label their own messages unless the AI is
 * genuinely unsure between a question and an answer.
 */
export type Category = "question" | "answer" | "technical" | "general" | "spam";

export const CATEGORIES: Category[] = ["question", "answer", "technical", "general", "spam"];

export const CATEGORY_META: Record<
  Category,
  { label: string; dot: string; text: string; chip: string }
> = {
  question: {
    label: "Question",
    dot: "bg-success",
    text: "text-success",
    chip: "bg-success/15 text-success",
  },
  answer: {
    label: "Answer",
    dot: "bg-info",
    text: "text-info",
    chip: "bg-info/15 text-info",
  },
  technical: {
    label: "Technical issue",
    dot: "bg-warning",
    text: "text-warning",
    chip: "bg-warning/15 text-warning",
  },
  general: {
    label: "General",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    chip: "bg-secondary text-muted-foreground",
  },
  spam: {
    label: "Spam",
    dot: "bg-destructive",
    text: "text-destructive",
    chip: "bg-destructive/15 text-destructive",
  },
};

export function toCategory(value: string | null | undefined): Category {
  return CATEGORIES.includes(value as Category) ? (value as Category) : "general";
}

/* ------------------------------- audio health ------------------------------- */

const AUDIO_WORDS = [
  "hear",
  "hearing",
  "audio",
  "voice",
  "sound",
  "mic",
  "microphone",
  "mute",
  "muted",
  "inaudible",
  "listen",
  // Roman Urdu
  "awaz",
  "awaaz",
  "aawaz",
  "sunai",
  "sunayi",
  "suna",
];

/** True when a technical-issue message is about audio specifically. */
export function isAudioIssue(text: string): boolean {
  const flat = text.toLowerCase();
  return AUDIO_WORDS.some((word) => new RegExp(`\\b${word}`).test(flat));
}

/* ------------------------------ offline fallback ---------------------------- */

const TECH_WORDS = [
  ...AUDIO_WORDS,
  "screen",
  "share",
  "sharing",
  "frozen",
  "freeze",
  "lag",
  "lagging",
  "laggy",
  "internet",
  "buffering",
  "disconnect",
  "slides",
];

const SPAM_PATTERNS = [
  /^(hi+|hello+|hey+|salam|asalam[ou]?\s*alaikum|good\s*(morning|evening|night))\b[\s!.]*$/i,
  /^[^a-z0-9]{2,}$/iu,
  /^(.)\1{4,}$/i,
  /(https?:\/\/|www\.)/i,
];

/** Heuristic used when the AI is unavailable — never blocks the student. */
export function localClassify(body: string): { category: Category; confidence: number } {
  const text = body.trim();
  const flat = text.toLowerCase();

  if (SPAM_PATTERNS.some((pattern) => pattern.test(text))) {
    return { category: "spam", confidence: 0.8 };
  }
  if (TECH_WORDS.some((word) => new RegExp(`\\b${word}`).test(flat))) {
    return { category: "technical", confidence: 0.7 };
  }
  if (
    text.includes("?") ||
    /\b(what|why|how|when|explain|samjh|samjha|sawal|dobara|question|q\d)\b/i.test(flat)
  ) {
    return { category: "question", confidence: 0.7 };
  }
  if (/^[\d\s.,/*+=x-]+$/.test(text) || text.split(/\s+/).length <= 3) {
    return { category: "answer", confidence: 0.45 };
  }
  return { category: "general", confidence: 0.5 };
}
