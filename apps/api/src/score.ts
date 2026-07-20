export function calculateScore(basePoints: number, timeLimitSec: number, responseMs: number, correct: boolean, speedScoring = true) {
  if (!correct) return 0;
  if (!speedScoring) return basePoints;
  const maxBonus = Math.round(basePoints * 2 / 3);
  const elapsedRatio = Math.min(1, Math.max(0, responseMs / (timeLimitSec * 1000)));
  return basePoints + Math.max(0, Math.floor(maxBonus * (1 - elapsedRatio)));
}

export function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase("vi-VN").replace(/\s+/g, " ");
}
