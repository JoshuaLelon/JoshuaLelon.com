/**
 * Estimate reading time in whole minutes from a post's markdown body.
 * Uses the conventional 200 words-per-minute, with a 1-minute floor.
 */
export function getReadingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
