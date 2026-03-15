/**
 * Extract a JSON object from text that may contain surrounding prose.
 * Matches the first `{...}` block in the text.
 *
 * @param text - Raw text potentially containing JSON
 * @param fallback - Value to return if extraction or parsing fails
 * @returns Parsed JSON object or the fallback value
 */
export function extractJson<T>(text: string, fallback: T): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return fallback;
  }
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return fallback;
  }
}
