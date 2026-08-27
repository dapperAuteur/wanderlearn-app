/**
 * Which transition sound plays when a visitor walks from one scene to another.
 *
 * A FOURTH AUDIO ROLE, with its own column, deliberately. The app already has
 * three and they are not interchangeable:
 *
 *   1. `scenes.audioMediaId`   — the ambient bed. Loops, crossfades between
 *                                scenes, sets the room.
 *   2. `sceneHotspots.audioMediaId` — deliberate trigger. Plays because the
 *                                visitor clicked a thing.
 *   3. (reserved) narration    — the plan's note: voiceover needs its own slot
 *                                rather than overloading the ambient column.
 *   4. transition audio        — this. A one-shot on movement.
 *
 * Overloading any of the others would mean a creator could not have a room
 * tone AND a footstep, which is the obvious thing to want.
 *
 * RESOLUTION: the specific beats the general. A tour sets one sound for every
 * doorway; a link can override it for a particular one — a heavy door, stairs,
 * stepping outside. That is BAM's spec: "per tour and per link, let user
 * choose. they may set a per tour sound then over ride specific links with a
 * per link sound."
 *
 * `null` at the link level means "no override, use the tour's". A creator who
 * wants SILENCE on one link needs that to be expressible too, which a plain
 * null cannot say — see `TransitionAudioChoice`.
 */

/**
 * What a link says about its transition sound.
 *
 * Three states, not two. "Inherit" and "deliberately silent" are different
 * intentions and a nullable media id can only express one of them, so silence
 * is its own value. Without this, a creator could never mute a single doorway
 * in a tour that has a default.
 */
export type TransitionAudioChoice =
  | { kind: "inherit" }
  | { kind: "silent" }
  | { kind: "override"; url: string };

export function transitionAudioChoiceFor(link: {
  transitionAudioUrl: string | null;
  transitionAudioSilent: boolean;
}): TransitionAudioChoice {
  // Silence wins over an override that is also set: the flag is the explicit
  // instruction and a stale url beneath it should not resurrect sound.
  if (link.transitionAudioSilent) return { kind: "silent" };
  if (link.transitionAudioUrl) return { kind: "override", url: link.transitionAudioUrl };
  return { kind: "inherit" };
}

/**
 * The URL to play for one traversal, or null for silence.
 *
 * `soundEnabled` is checked HERE rather than at the call site so there is one
 * place that can get it wrong. A transition sound is triggered by a click, so
 * browsers would happily play it even while the ambient bed is muted — firing
 * audio at someone who explicitly muted is the worst behaviour available.
 */
export function resolveTransitionAudioUrl(input: {
  link: { transitionAudioUrl: string | null; transitionAudioSilent: boolean } | null;
  tourDefaultUrl: string | null;
  soundEnabled: boolean;
}): string | null {
  if (!input.soundEnabled) return null;
  if (input.link) {
    const choice = transitionAudioChoiceFor(input.link);
    if (choice.kind === "silent") return null;
    if (choice.kind === "override") return choice.url;
  }
  return input.tourDefaultUrl ?? null;
}
