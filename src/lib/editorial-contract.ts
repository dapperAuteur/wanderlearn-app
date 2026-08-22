/**
 * The tripwire for the editorial generator's one real failure mode.
 *
 * `scripts/gen-editorial-prompts.ts` asks a model for QUESTIONS a narrator
 * might answer — never narration, never suggested wording. The whole value of
 * the tool is that BAM's voice stays his; a model that helpfully drafts a line
 * has defeated the point, and it would do so invisibly, because a well-written
 * line looks like a good result.
 *
 * A system prompt is an instruction, not a guarantee. This is the cheap check
 * that runs on the output afterwards, so a drift in model behaviour surfaces
 * as a warning on the console rather than as a sentence BAM reads aloud
 * without noticing it was not his.
 *
 * Deliberately a WARNING and not a hard failure: this is a heuristic, it will
 * have false positives, and destroying a usable sheet over one long bullet
 * would be worse than asking someone to look. It lives here rather than in the
 * script so it can be tested.
 */

/** A bullet long enough to be prose, with no question in it. */
const PROSE_BULLET_MIN_LENGTH = 140;

export type EditorialWarning = { line: number; reason: string };

export function findNarrativeLines(markdown: string): EditorialWarning[] {
  const warnings: EditorialWarning[] = [];
  markdown.split("\n").forEach((raw, i) => {
    const trimmed = raw.trim();
    if (!/^[-*]\s+/.test(trimmed)) return;
    const body = trimmed.replace(/^[-*]\s+/, "").trim();
    if (body.length <= PROSE_BULLET_MIN_LENGTH) return;
    // A question mark anywhere means it is still asking something, however
    // long-winded. Narration does not ask.
    if (body.includes("?")) return;
    warnings.push({
      line: i + 1,
      reason: "long declarative bullet — check it is not narration",
    });
  });
  return warnings;
}
