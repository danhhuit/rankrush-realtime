export function calculateScore(
  timeLimitSec: number,
  responseMs: number,
  correct: boolean,
  doublePoints = false,
) {
  if (!correct) return 0;
  const durationMs = Math.max(1, timeLimitSec * 1000);
  const elapsedRatio = Math.min(1, Math.max(0, responseMs / durationMs));
  const points = Math.max(100, 1_000 - Math.floor(elapsedRatio * 10) * 100);
  return points * (doublePoints ? 2 : 1);
}

export function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase("vi-VN").replace(/\s+/g, " ");
}
