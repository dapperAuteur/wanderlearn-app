"use client";

import { useCallback, useEffect, useRef } from "react";

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
 * Playback is triggered by a click, so browser autoplay policy allows it even
 * when the ambient bed was never started — which is exactly why the mute check
 * has to be deliberate rather than inherited from whether the bed is playing.
 */
export function useTransitionAudio() {
  const currentRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    const el = currentRef.current;
    if (!el) return;
    el.pause();
    // Release the decoded stream; pausing alone leaves it around.
    el.src = "";
    currentRef.current = null;
  }, []);

  const play = useCallback(
    (url: string | null) => {
      if (!url) return;
      stop();
      const el = new Audio(url);
      // Quieter than the ambient bed's 0.55: a transition is punctuation, not
      // the scene. At parity it reads as an interruption.
      el.volume = 0.4;
      currentRef.current = el;
      el.addEventListener("ended", () => {
        if (currentRef.current === el) currentRef.current = null;
      });
      // A rejected play() is not an error worth surfacing — an autoplay refusal
      // or a missing file should cost the visitor nothing.
      void el.play().catch(() => {});
    },
    [stop],
  );

  // Leaving the tour mid-sound must not leave audio playing.
  useEffect(() => stop, [stop]);

  return { play, stop };
}
