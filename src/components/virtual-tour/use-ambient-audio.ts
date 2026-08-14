"use client";

import { useEffect, useRef } from "react";

const FADE_MS = 900;
const FADE_STEP_MS = 50;
const TARGET_VOLUME = 0.55;

/**
 * Crossfading ambient audio bed, one track per scene.
 *
 * Three rules drive the shape of this:
 *
 * 1. **It never starts on its own.** Browsers block autoplay without a user
 *    gesture, and WCAG 1.4.2 requires a control for any audio that runs past
 *    three seconds. Both point the same way: sound is off until the visitor
 *    turns it on, and the toggle is the gesture that unblocks playback.
 * 2. **It crossfades rather than cuts.** A hard cut between two room tones
 *    reads as a bug. Walking between rooms should sound like walking.
 * 3. **Only one fade runs at a time.** Changing scenes mid-fade is the normal
 *    case, not the edge case, so every entry point cancels the fade in flight
 *    and releases the element it was fading. Otherwise a visitor who clicks
 *    through four rooms quickly ends up with four tracks playing at once.
 */
export function useAmbientAudio({
  url,
  enabled,
}: {
  url: string | undefined;
  enabled: boolean;
}) {
  const currentRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (fadeRef.current) {
      clearInterval(fadeRef.current);
      fadeRef.current = null;
    }

    const outgoing = currentRef.current;

    // Nothing to play, or sound is off: fade whatever is running down to silence
    // and release it. Pausing without releasing leaves a decoded stream around.
    if (!enabled || !url) {
      currentRef.current = null;
      currentUrlRef.current = undefined;
      if (!outgoing) return;
      fadeRef.current = fadeOut(outgoing, () => {
        fadeRef.current = null;
      });
      return;
    }

    // Same scene, already playing: leave it alone. Re-creating the element here
    // would restart the loop on every unrelated re-render.
    if (outgoing && currentUrlRef.current === url) return;

    const incoming = new Audio(url);
    incoming.loop = true;
    incoming.volume = 0;
    incoming.preload = "auto";
    currentRef.current = incoming;
    currentUrlRef.current = url;

    // play() rejects when the browser has no user activation yet. That is an
    // expected state, not an error worth surfacing: the visitor simply has not
    // pressed the sound button, and the next press will succeed.
    void incoming.play().catch(() => {});

    let elapsed = 0;
    const outgoingStart = outgoing?.volume ?? 0;
    fadeRef.current = setInterval(() => {
      elapsed += FADE_STEP_MS;
      const t = Math.min(1, elapsed / FADE_MS);
      incoming.volume = TARGET_VOLUME * t;
      if (outgoing) outgoing.volume = Math.max(0, outgoingStart * (1 - t));
      if (t >= 1) {
        if (fadeRef.current) clearInterval(fadeRef.current);
        fadeRef.current = null;
        if (outgoing) {
          outgoing.pause();
          outgoing.src = "";
        }
      }
    }, FADE_STEP_MS);
  }, [url, enabled]);

  // Leaving the page must stop the sound. Without this the element keeps playing
  // after the viewer unmounts, which on a single-page navigation means audio
  // from a tour the visitor has already left.
  useEffect(
    () => () => {
      if (fadeRef.current) clearInterval(fadeRef.current);
      const el = currentRef.current;
      if (el) {
        el.pause();
        el.src = "";
      }
      currentRef.current = null;
    },
    [],
  );
}

function fadeOut(el: HTMLAudioElement, done: () => void) {
  let elapsed = 0;
  const start = el.volume;
  const timer = setInterval(() => {
    elapsed += FADE_STEP_MS;
    const t = Math.min(1, elapsed / FADE_MS);
    el.volume = Math.max(0, start * (1 - t));
    if (t >= 1) {
      clearInterval(timer);
      el.pause();
      el.src = "";
      done();
    }
  }, FADE_STEP_MS);
  return timer;
}
