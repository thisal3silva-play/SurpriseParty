import { readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

const stephQuestionSchema = z.object({
  question: z.string().trim().min(1),
  answer: z.boolean(),
});

const triviaQuestionSchema = z.object({
  question: z.string().trim().min(1),
  options: z.array(z.string().trim().min(1)).min(2).max(6),
  answer: z.number().int().nonnegative(),
}).refine(({ answer, options }) => answer < options.length, {
  message: "answer must be the zero-based index of an option",
  path: ["answer"],
});

export type StephQuestion = z.infer<typeof stephQuestionSchema>;
export type TriviaQuestion = z.infer<typeof triviaQuestionSchema>;

export const STEPH_QUESTIONS = loadQuestionFile(
  "steph-did-that.json",
  z.array(stephQuestionSchema).min(1),
);

export const TRIVIA_QUESTIONS = loadQuestionFile(
  "birthday-trivia.json",
  z.array(triviaQuestionSchema).min(1),
);

function loadQuestionFile<T>(filename: string, schema: z.ZodType<T>): T {
  const path = join(process.cwd(), "content", "questions", filename);

  try {
    return schema.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = error.issues
        .map((issue) => `${issue.path.join(".") || "file"}: ${issue.message}`)
        .join("; ");
      throw new Error(`Invalid question file ${filename}: ${details}`);
    }
    throw new Error(`Could not load question file ${filename}.`, { cause: error });
  }
}
