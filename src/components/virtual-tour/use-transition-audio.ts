"use client";

import { useCallback, useEffect, useRef } from "react";

import type { AudioPool } from "./audio-pool";

/**
 * One-shot transition sounds, played over the ambient bed.
 *
 * Separate from `useAmbientAudio` because the two behave oppositely: the bed
 * loops and crossfades, this fires once and gets out of the way. Trying to
 * serve both from one hook produced the sort of mode flag that makes each
 * behaviour harder to reason about.
 *
 * Two rules:
 *
 * 1. **It never stacks.** Clicking quickly through four rooms is normal, not
 *    an edge case. Each play stops whatever is still sounding — four
 *    overlapping footsteps read as a bug, not as walking.
 * 2. **It respects mute.** The caller resolves that (see
 *    src/lib/transition-audio.ts), but this refuses a null url anyway, so a
 *    future caller that forgets cannot make noise at a muted visitor.
 *
 * The mute check is deliberate rather than inherited from whether the bed is
 * playing, because a transition sound can be the first audio of a visit.
 *
 * It plays through the shared pool for the same reason the bed does. The
 * original note here claimed the click that starts a walk authorises the
 * sound — it does not. PSV loads the next panorama first, so by the time this
 * runs the activation is spent, and on iOS a fresh element is silent.
 */
export function useTransitionAudio(pool: AudioPool) {
  const currentRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    const el = currentRef.current;
    if (!el) return;
    pool.release(el);
    currentRef.current = null;
  }, [pool]);

  const play = useCallback(
    (url: string | null) => {
      if (!url) return;
      stop();
      const el = pool.acquire();
      // No free element: the bed is crossfading and holds both. Skipping the
      // punctuation is better than cutting the bed short for it.
      if (!el) return;
      el.src = url;
      // Quieter than the ambient bed's 0.55: a transition is punctuation, not
      // the scene. At parity it reads as an interruption.
      el.volume = 0.4;
      currentRef.current = el;
      el.addEventListener("ended", () => {
        if (currentRef.current === el) {
          currentRef.current = null;
          // Back to the pool, or a one-shot would hold an element for the rest
          // of the visit and starve the crossfade.
          pool.release(el);
        }
      });
      // A rejected play() is not an error worth surfacing — an autoplay refusal
      // or a missing file should cost the visitor nothing.
      void el.play().catch(() => {});
    },
    [stop, pool],
  );

  // Leaving the tour mid-sound must not leave audio playing.
  useEffect(() => stop, [stop]);

  return { play, stop };
}
