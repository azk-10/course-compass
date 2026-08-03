import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { localClassify, toCategory, type Category } from "@/lib/classify";

const JudgeInput = z.object({
  draft: z.string().min(1).max(1000),
  candidates: z
    .array(z.object({ id: z.string(), title: z.string(), category: z.string() }))
    .max(8),
});

export type Verdict = {
  category: Category;
  confidence: number;
  threadId: string | null;
  title: string | null;
};

/**
 * One silent AI pass per message: it classifies the intent (question, answer,
 * technical issue, general talk or spam) and decides whether the message is the
 * SAME thing as an existing thread (typo, rephrase, shorthand) or something new.
 * Merging is deliberately conservative so the teacher never untangles a bad merge.
 */
export const classifyMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => JudgeInput.parse(input))
  .handler(async ({ data }): Promise<Verdict> => {
    const fallback = (): Verdict => {
      const local = localClassify(data.draft);
      return { ...local, threadId: null, title: null };
    };

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return fallback();

    const gateway = createLovableAiGatewayProvider(key);
    const list = data.candidates.length
      ? data.candidates.map((c, i) => `${i + 1}. [${c.id}] (${c.category}) ${c.title}`).join("\n")
      : "(none)";

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3.6-flash"),
        output: Output.object({
          schema: z.object({
            category: z.enum(["question", "answer", "technical", "general", "spam"]),
            confidence: z.number(),
            threadId: z.string().nullable(),
            title: z.string().nullable(),
          }),
        }),
        system:
          'You silently organise the live chat of a very large online class. Students write in English, in Urdu, or in Roman Urdu (Urdu typed with English letters, e.g. "sawal 5 samjha dain" = "explain question 5", "awaz nahi aa rahi" = "cannot hear you", "dobara samjhao" = "explain again"), and often mix languages in one sentence. Translate every message to its English meaning first, then work only from meaning — language, script, transliteration spelling variants and code-switching are NEVER reasons to treat two messages differently.\n\n1) CLASSIFY the message into exactly one category:\n- "question": the student asks the teacher to explain or clarify something.\n- "answer": the student is answering a question the teacher asked (a number, a formula, a multiple-choice letter, a short phrase).\n- "technical": audio, video, screen-share, lag or internet problems.\n- "general": classroom-relevant talk that is neither a question nor an answer (thanks, acknowledgement, a comment about the lecture).\n- "spam": repeated junk, random letters, emoji spam, off-topic chatter between students, bare greetings with no classroom value, advertisements, profanity or abuse.\nReturn "confidence" between 0 and 1 for that classification. Use a value below 0.5 ONLY when you genuinely cannot tell whether the message is a question or an answer. Technical issues and spam must always be confident (>= 0.5).\n\n2) MERGE: return threadId = the id of an existing thread that asks/says the SAME thing, or null. Spelling mistakes, shorthand (q5 = question 5), abbreviations and rephrasings count as the same. Different question numbers, different topics, different parts of a question, or a follow-up asking something new are NOT the same. Only merge into a thread of the same category. When unsure, do not merge.\n\n3) TITLE: a short neutral title (max 6 words), always written in English, describing this message\'s intent. It is used only when nothing matches.',
        prompt: `New message: "${data.draft}"\n\nExisting threads:\n${list}\n\nReturn JSON with category, confidence, threadId and title.`,
      });

      const match = data.candidates.find((c) => c.id === output.threadId);
      return {
        category: toCategory(output.category),
        confidence: Math.min(1, Math.max(0, output.confidence)),
        threadId: match?.id ?? null,
        title: output.title?.slice(0, 80) ?? null,
      };
    } catch {
      return fallback();
    }
  });
