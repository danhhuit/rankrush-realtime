import type { GeneratedQuestion } from "./quiz-generator.js";

function normalizedWords(value: string) {
  return new Set(
    (value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("vi-VN")
      .match(/[\p{L}\p{N}]{3,}/gu) || [])
      .filter(
        (word) =>
          ![
            "cau",
            "hoi",
            "nao",
            "dieu",
            "sau",
            "day",
            "what",
            "which",
            "following",
          ].includes(word),
      ),
  );
}

export function questionSimilarity(left: string, right: string) {
  const a = normalizedWords(left);
  const b = normalizedWords(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((word) => b.has(word)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / Math.max(1, union);
}

export function findDuplicateQuestionIndexes(
  questions: Pick<GeneratedQuestion, "prompt">[],
  threshold = 0.72,
) {
  const duplicates = new Set<number>();
  for (let index = 0; index < questions.length; index += 1) {
    for (let previous = 0; previous < index; previous += 1) {
      if (
        questionSimilarity(
          questions[index]!.prompt,
          questions[previous]!.prompt,
        ) >= threshold
      ) {
        duplicates.add(index);
        break;
      }
    }
  }
  return [...duplicates];
}
