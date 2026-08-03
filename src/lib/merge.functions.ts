import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const JudgeInput = z.object({
  draft: z.string().min(1).max(1000),
  candidates: z
    .array(z.object({ id: z.string(), title: z.string() }))
    .max(8),
});

/**
 * Decides whether a new student message is the SAME question as an existing
 * thread (typo, rephrase, shorthand) or a genuinely different one. Merging is
 * deliberately conservative so the teacher never has to untangle a bad merge.
 */
export const judgeMerge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => JudgeInput.parse(input))
  .handler(async ({ data }) => {
    if (data.candidates.length === 0) return { threadId: null as string | null, title: null as string | null };

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { threadId: null as string | null, title: null as string | null };

    const gateway = createLovableAiGatewayProvider(key);
    const list = data.candidates.map((c, i) => `${i + 1}. [${c.id}] ${c.title}`).join("\n");

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3.6-flash"),
        output: Output.object({
          schema: z.object({
            threadId: z.string().nullable(),
            title: z.string().nullable(),
          }),
        }),
        system:
          "You merge live-class chat messages into discussion threads. Merge ONLY when the new message asks for the same thing as an existing thread — spelling mistakes, shorthand (q5 = question 5), abbreviations and rephrasings count as the same. Different question numbers, different topics, different parts of a question, or a follow-up asking something new are NOT the same. When unsure, do not merge. Return threadId = the id of the matching thread or null. Also return a short neutral thread title (max 6 words) describing the new message's intent, used only when nothing matches.",
        prompt: `New message: "${data.draft}"\n\nExisting threads:\n${list}\n\nReturn JSON with threadId and title.`,
      });

      const match = data.candidates.find((c) => c.id === output.threadId);
      return { threadId: match?.id ?? null, title: output.title?.slice(0, 80) ?? null };
    } catch {
      return { threadId: null as string | null, title: null as string | null };
    }
  });
