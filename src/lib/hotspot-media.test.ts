import { describe, expect, it } from "vitest";
import { hotspotMediaProblem, isVttUrl } from "./hotspot-media";

describe("hotspotMediaProblem", () => {
  const ok = { status: "ready", alt: null, hasTranscript: false };

  it("accepts an image with alt text", () => {
    expect(hotspotMediaProblem({ ...ok, kind: "image", alt: "The original 1910 doorway" })).toBeNull();
  });

  it("refuses an image without alt text (blank counts as missing)", () => {
    expect(hotspotMediaProblem({ ...ok, kind: "image" })).toBe("alt_required");
    expect(hotspotMediaProblem({ ...ok, kind: "image", alt: "   " })).toBe("alt_required");
  });

  it("refuses a flat video without a transcript, accepts it with one", () => {
    expect(hotspotMediaProblem({ ...ok, kind: "standard_video" })).toBe("transcript_required");
    expect(hotspotMediaProblem({ ...ok, kind: "drone_video", hasTranscript: true })).toBeNull();
  });

  it("refuses 360 media, audio and unfinished uploads", () => {
    expect(hotspotMediaProblem({ ...ok, kind: "photo_360", alt: "x" })).toBe("media_kind");
    expect(hotspotMediaProblem({ ...ok, kind: "audio" })).toBe("media_kind");
    expect(hotspotMediaProblem({ ...ok, kind: "image", alt: "x", status: "processing" })).toBe("media_not_ready");
  });
});

describe("isVttUrl", () => {
  it.each([
    ["https://res.cloudinary.com/x/raw/upload/v1/talk.vtt", true],
    ["https://res.cloudinary.com/x/raw/upload/v1/TALK.VTT?a=1", true],
    ["https://res.cloudinary.com/x/raw/upload/v1/talk.srt", false],
    [null, false],
    ["not a url", false],
  ])("%s → %s", (url, expected) => expect(isVttUrl(url)).toBe(expected));
});
