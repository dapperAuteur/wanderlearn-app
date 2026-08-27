import { describe, expect, it } from "vitest";
import { resolveTransitionAudioUrl, transitionAudioChoiceFor } from "./transition-audio";

const link = (over: Partial<{ transitionAudioUrl: string | null; transitionAudioSilent: boolean }> = {}) => ({
  transitionAudioUrl: null,
  transitionAudioSilent: false,
  ...over,
});

describe("transitionAudioChoiceFor", () => {
  it("inherits when the link says nothing", () => {
    expect(transitionAudioChoiceFor(link())).toEqual({ kind: "inherit" });
  });

  it("overrides when the link has its own sound", () => {
    expect(transitionAudioChoiceFor(link({ transitionAudioUrl: "/door.mp3" }))).toEqual({
      kind: "override",
      url: "/door.mp3",
    });
  });

  it("treats explicit silence as its own state, not as inherit", () => {
    // The whole reason silence is a flag: a creator muting one doorway in a
    // tour that has a default cannot express that with a null media id.
    expect(transitionAudioChoiceFor(link({ transitionAudioSilent: true }))).toEqual({
      kind: "silent",
    });
  });

  it("lets silence win over a leftover override url", () => {
    expect(
      transitionAudioChoiceFor(link({ transitionAudioUrl: "/old.mp3", transitionAudioSilent: true })),
    ).toEqual({ kind: "silent" });
  });
});

describe("resolveTransitionAudioUrl", () => {
  it("plays the tour default when the link says nothing", () => {
    expect(
      resolveTransitionAudioUrl({ link: link(), tourDefaultUrl: "/step.mp3", soundEnabled: true }),
    ).toBe("/step.mp3");
  });

  it("plays the link's own sound instead of the tour default", () => {
    expect(
      resolveTransitionAudioUrl({
        link: link({ transitionAudioUrl: "/heavy-door.mp3" }),
        tourDefaultUrl: "/step.mp3",
        soundEnabled: true,
      }),
    ).toBe("/heavy-door.mp3");
  });

  it("plays nothing on a link the creator silenced, even with a tour default", () => {
    expect(
      resolveTransitionAudioUrl({
        link: link({ transitionAudioSilent: true }),
        tourDefaultUrl: "/step.mp3",
        soundEnabled: true,
      }),
    ).toBeNull();
  });

  it("plays NOTHING when the visitor has muted, whatever is configured", () => {
    // A click would let the browser play this even with the ambient bed off.
    // Firing sound at someone who muted is the worst behaviour available.
    expect(
      resolveTransitionAudioUrl({
        link: link({ transitionAudioUrl: "/heavy-door.mp3" }),
        tourDefaultUrl: "/step.mp3",
        soundEnabled: false,
      }),
    ).toBeNull();
  });

  it("plays nothing when neither level is configured", () => {
    expect(
      resolveTransitionAudioUrl({ link: link(), tourDefaultUrl: null, soundEnabled: true }),
    ).toBeNull();
  });

  it("falls back to the tour default when the traversed link is unknown", () => {
    // Rail jumps and map-pin clicks change scene without traversing a link.
    expect(
      resolveTransitionAudioUrl({ link: null, tourDefaultUrl: "/step.mp3", soundEnabled: true }),
    ).toBe("/step.mp3");
  });

  it("plays nothing on an unknown link when muted", () => {
    expect(
      resolveTransitionAudioUrl({ link: null, tourDefaultUrl: "/step.mp3", soundEnabled: false }),
    ).toBeNull();
  });
});
