import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAudioPool } from "./audio-pool";

class FakeAudio {
  src = "";
  volume = 1;
  loop = false;
  currentTime = 0;
  preload = "";
  played: string[] = [];
  paused = 0;
  play = vi.fn(() => {
    this.played.push(this.src);
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused += 1;
  });
  addEventListener = vi.fn();
}

let made: FakeAudio[] = [];

beforeEach(() => {
  made = [];
  // The pool returns a no-op on the server, so a browser has to exist before
  // any of this means anything. No jsdom in this project; a bare object is
  // enough, since the pool only ever asks whether `window` is defined.
  vi.stubGlobal("window", {});
  vi.stubGlobal(
    "Audio",
    class {
      constructor() {
        const a = new FakeAudio();
        made.push(a);
        return a as unknown as HTMLAudioElement;
      }
    },
  );
});

describe("createAudioPool", () => {
  it("builds every element up front, before any scene change", () => {
    // The whole point: an element created later is an element iOS will not
    // play, because it was not authorised by the gesture.
    createAudioPool(3);
    expect(made).toHaveLength(3);
  });

  it("plays and pauses each element on unlock", () => {
    const pool = createAudioPool(2);
    pool.unlock();
    for (const el of made) {
      expect(el.play).toHaveBeenCalledTimes(1);
      expect(el.played[0]).toMatch(/^data:audio\/wav;base64,/);
    }
  });

  it("unlocks once, however many gestures arrive", () => {
    // Bound to pointerdown on the whole viewer, so this runs on every touch.
    const pool = createAudioPool(2);
    pool.unlock();
    pool.unlock();
    pool.unlock();
    for (const el of made) expect(el.play).toHaveBeenCalledTimes(1);
  });

  it("hands back the same elements over and over", () => {
    // The property that fixes the bug. Walking six scenes must never produce a
    // seventh element.
    const pool = createAudioPool(2);
    const seen = new Set<unknown>();
    for (let i = 0; i < 6; i += 1) {
      const el = pool.acquire();
      seen.add(el);
      pool.release(el);
    }
    expect(seen.size).toBe(1);
    expect(made).toHaveLength(2);
  });

  it("never hands out an element that is already playing", () => {
    // This is what keeps a crossfade from cutting its own outgoing source: the
    // fading element is still held, so it cannot be handed to the fade that is
    // replacing it.
    const pool = createAudioPool(2);
    const outgoing = pool.acquire();
    const incoming = pool.acquire();
    expect(incoming).not.toBe(outgoing);
    expect(incoming).not.toBeNull();
  });

  it("returns null rather than creating an element when all are busy", () => {
    // A fallback `new Audio()` here would be silent on iOS — and only
    // sometimes, which is harder to diagnose than always.
    const pool = createAudioPool(2);
    pool.acquire();
    pool.acquire();
    expect(pool.acquire()).toBeNull();
    expect(made).toHaveLength(2);
  });

  it("frees an element on release", () => {
    const pool = createAudioPool(1);
    const first = pool.acquire();
    expect(pool.acquire()).toBeNull();
    pool.release(first);
    expect(pool.acquire()).toBe(first);
  });

  it("stops and empties an element on release, so no stream is left decoding", () => {
    const pool = createAudioPool(1);
    const el = pool.acquire() as unknown as FakeAudio;
    el.src = "https://example.test/room.mp3";
    pool.release(el as unknown as HTMLAudioElement);
    expect(el.paused).toBeGreaterThan(0);
    expect(el.src).toBe("");
  });

  it("resets loop and volume on acquire, so a bed does not inherit a one-shot's settings", () => {
    const pool = createAudioPool(1);
    const el = pool.acquire() as unknown as FakeAudio;
    el.loop = true;
    el.volume = 0.9;
    pool.release(el as unknown as HTMLAudioElement);
    const again = pool.acquire() as unknown as FakeAudio;
    expect(again.loop).toBe(false);
    expect(again.volume).toBe(0);
  });

  it("tolerates release(null)", () => {
    const pool = createAudioPool(1);
    expect(() => pool.release(null)).not.toThrow();
  });

  it("stops everything on dispose", () => {
    const pool = createAudioPool(2);
    pool.acquire();
    pool.dispose();
    for (const el of made) expect(el.paused).toBeGreaterThan(0);
    // And the pool is usable again rather than wedged: dispose frees the busy
    // set, so a remounted viewer is not starved.
    expect(pool.acquire()).not.toBeNull();
  });
});
