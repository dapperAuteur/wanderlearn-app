"use client";

/**
 * A fixed set of `Audio` elements, unlocked once and reused for the whole visit.
 *
 * iOS Safari grants permission to play to a **specific media element** that was
 * played during a user gesture, not to the page. Everything else here follows
 * from that.
 *
 * Both audio hooks used to construct a fresh `new Audio(url)` per scene, inside
 * an effect. On desktop and Android that is fine. On iOS it never plays: by the
 * time PSV has loaded the next panorama and the effect runs, the tap that was
 * meant to authorise it is long over, and the rejection is swallowed on purpose
 * so a silent bed cannot break a tour. Confirmed on an iPhone 8, 2026-08-30 —
 * silent after every scene change, arrow taps, map pins and the Back button
 * alike, fast or slow. Not a timing window: a fresh element is simply never
 * authorised.
 *
 * So: create the elements up front, play a few milliseconds of silence through
 * each one during a real gesture, and from then on only ever change `.src`.
 * Permission survives `src` changes, which is what makes reuse work.
 *
 * Sized by what plays at once — two for the ambient crossfade, one for the
 * transition one-shot. Growing the pool on demand would defeat its purpose,
 * since a late element is an unauthorised one.
 */

/**
 * ~1ms of silence: a real 60-byte WAV, generated and round-tripped through
 * Python's `wave` module rather than copied from a snippet. An element playing
 * a file the browser cannot decode is not an unlocked element.
 */
const SILENCE =
  "data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YRAAAAAAAAAAAAAAAAAAAAAAAAAA";

export interface AudioPool {
  /**
   * Authorise every element. Call from inside a real user gesture — a click or
   * pointerdown handler, synchronously. Cheap and idempotent, so calling it on
   * every interaction is fine and is what the viewer does.
   */
  unlock(): void;
  /**
   * A free element to play through, or null when every one is spoken for.
   *
   * Null means "do not play". Falling back to `new Audio` would be silent on
   * iOS, and silence that happens only under load is harder to diagnose than
   * silence that always happens.
   *
   * An element stays held until `release`, which for the ambient bed is when
   * its fade finishes — so the element being faded out is never handed to the
   * fade that is replacing it. That guarantee lives here, in the busy set,
   * rather than in an `exclude` argument each caller has to remember.
   */
  acquire(): HTMLAudioElement | null;
  /** Return an element to the pool, stopped and emptied. */
  release(el: HTMLAudioElement | null): void;
  /** Stop everything and drop the decoded streams. For viewer teardown. */
  dispose(): void;
}

/**
 * A pool that does nothing, for the server render.
 *
 * The viewer is a client component but still renders once on the server, where
 * `new Audio()` does not exist. Returning this instead of guarding at every
 * call site keeps the hooks free of "if we are on a server" branches.
 */
const NO_AUDIO_POOL: AudioPool = {
  unlock() {},
  acquire: () => null,
  release() {},
  dispose() {},
};

export function createAudioPool(size: number): AudioPool {
  if (typeof window === "undefined") return NO_AUDIO_POOL;
  const elements: HTMLAudioElement[] = [];
  const busy = new Set<HTMLAudioElement>();
  let unlocked = false;

  for (let i = 0; i < size; i += 1) {
    const el = new Audio();
    el.preload = "auto";
    // Muted playback is exempt from autoplay policy in some browsers, which
    // would make the unlock pass without actually authorising anything. Keep
    // them audible and rely on the silent file for inaudibility.
    el.volume = 0;
    elements.push(el);
  }

  return {
    unlock() {
      if (unlocked) return;
      unlocked = true;
      for (const el of elements) {
        try {
          el.src = SILENCE;
          const p = el.play();
          // Older Safari returns undefined rather than a promise.
          void Promise.resolve(p)
            .then(() => {
              el.pause();
              el.currentTime = 0;
            })
            .catch(() => {
              // A refused unlock leaves the element no worse than before, and
              // there is nothing useful to tell a visitor who has not asked
              // for sound. The next gesture tries again — except it will not,
              // because `unlocked` is already set. That is deliberate: if the
              // first genuine gesture is refused, something other than
              // activation is wrong, and retrying on every tap would mean
              // firing play() at a device that keeps saying no.
            });
        } catch {
          // Assigning src can throw on a detached element mid-teardown.
        }
      }
    },

    acquire() {
      for (const el of elements) {
        if (busy.has(el)) continue;
        busy.add(el);
        el.pause();
        el.loop = false;
        el.volume = 0;
        try {
          el.currentTime = 0;
        } catch {
          // Not seekable until metadata loads; harmless, the new src resets it.
        }
        return el;
      }
      return null;
    },

    release(el) {
      if (!el) return;
      busy.delete(el);
      el.pause();
      // Pausing alone leaves the decoded stream around.
      el.src = "";
    },

    dispose() {
      for (const el of elements) {
        el.pause();
        el.src = "";
      }
      busy.clear();
    },
  };
}
