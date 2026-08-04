import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { isSmallTalk, localClassify, toCategory, type Category } from "@/lib/classify";
import { textSimilarity } from "@/lib/grouping";

const JudgeInput = z.object({
  draft: z.string().min(1).max(1000),
  candidates: z.array(z.object({ id: z.string(), title: z.string(), category: z.string() })).max(8),
});

export type Verdict = {
  category: Category;
  confidence: number;
  threadId: string | null;
  title: string | null;
};

/** Hard latency budget: the student must never wait for the judge. */
const BUDGET_MS = 450;

/**
 * One silent AI pass per message: it classifies the intent (question, answer,
 * technical issue, general talk or spam) and decides whether the message is the
 * SAME thing as an existing thread (typo, rephrase, shorthand) or something new.
 * Merging is deliberately conservative so the teacher never untangles a bad merge.
 *
 * Speed matters more than perfection here: the call runs on a fast lite model
 * with a tight token cap and is aborted after {@link BUDGET_MS}. If it does not
 * answer in time we fall back to the instant local classifier plus a
 * similarity match, so a send always resolves in well under half a second.
 */
export const classifyMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => JudgeInput.parse(input))
  .handler(async ({ data }): Promise<Verdict> => {
    const fallback = (): Verdict => {
      const local = localClassify(data.draft);
      const best = data.candidates
        .filter((c) => toCategory(c.category) === local.category)
        .map((c) => ({ id: c.id, score: textSimilarity(data.draft, c.title) }))
        .sort((a, b) => b.score - a.score)[0];
      return {
        ...local,
        threadId: best && best.score >= 0.62 ? best.id : null,
        title: null,
      };
    };

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return fallback();

    const gateway = createLovableAiGatewayProvider(key);
    const list = data.candidates.length
      ? data.candidates.map((c, i) => `${i + 1}. [${c.id}] (${c.category}) ${c.title}`).join("\n")
      : "(none)";

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3.1-flash-lite"),
        abortSignal: AbortSignal.timeout(BUDGET_MS),
        maxOutputTokens: 120,
        temperature: 0,
        maxRetries: 0,
        output: Output.object({
          schema: z.object({
            category: z.enum(["question", "answer", "technical", "general", "spam"]),
            confidence: z.number(),
            threadId: z.string().nullable(),
            title: z.string().nullable(),
          }),
        }),
        system:
          'You silently organise the live chat of a very large online class. Answer instantly and briefly. Students write in English, Urdu or Roman Urdu (Urdu in English letters: "sawal 5 samjha dain" = "explain question 5", "awaz nahi aa rahi" = "cannot hear you") and mix languages. Read for meaning; script, spelling and language are never reasons to treat two messages differently.\n\n1) CLASSIFY into one category: "question" (asks the teacher to explain the LESSON), "answer" (replies to the teacher: a number, formula, letter or short phrase), "technical" (audio, video, screen share, lag, internet), "general" (off-topic: social small talk and anything not about the lesson), "spam" (junk, random letters, emoji spam, ads, abuse). Give confidence 0-1; use below 0.5 only when torn between question and answer. Technical and spam are always >= 0.5.\n\nIMPORTANT: social small talk in question form is NEVER "question". "how are you?", "what\'s up?", "all good?", "kaise ho?", "kya haal hai?", "sab theek?", "thanks sir", "hope you are well" and similar greetings, well-wishes or personal chatter are always "general" (off-topic), even with a question mark. Only lesson/subject/course-related asks count as "question".\n\n2) MERGE: threadId = an existing thread saying the SAME thing, else null. Typos, shorthand (q5 = question 5) and rephrasings are the same; different question numbers, topics or follow-ups are not. Same category only. Unsure means null.\n\n3) TITLE: max 6 English words describing the intent.',
        prompt: `New message: "${data.draft}"\n\nExisting threads:\n${list}\n\nReturn JSON with category, confidence, threadId and title.`,
      });

      const category = isSmallTalk(data.draft) ? "general" : toCategory(output.category);
      const match = data.candidates.find((c) => c.id === output.threadId);
      return {
        category,
        confidence: Math.min(1, Math.max(0, output.confidence)),
        threadId: match && toCategory(match.category) === category ? match.id : null,
        title: output.title?.slice(0, 80) ?? null,
      };
    } catch {
      return fallback();
    }
  });
