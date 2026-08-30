/**
 * How long a sound description should be, and how to count it.
 *
 * The description is printed over the panorama in a box capped at 28rem
 * (448px) at `text-xs` — see the overlay in virtual-tour-viewer.tsx. At 12px
 * that is roughly 70 characters a line, so about 140 characters is two lines:
 * enough to say what the sound is, short enough to read without taking the
 * photograph away from the visitor.
 *
 * It is a recommendation and nothing more. A description that needs 200
 * characters to be accurate is better than a wrong one that fits, and this
 * text is a WCAG 1.2.1 alternative before it is a caption. The hard cap exists
 * only to stop a pasted transcript.
 */
export const DESCRIPTION_RECOMMENDED = 140;
export const DESCRIPTION_MAX = 500;

/**
 * The length that will actually be stored.
 *
 * Trimmed, because the save action trims before writing. Counting raw input
 * would tell a creator they had used 140 characters and then store 137, and
 * the count that matters is the one that ends up on the panorama.
 */
export function descriptionLength(value: string): number {
  return value.trim().length;
}
