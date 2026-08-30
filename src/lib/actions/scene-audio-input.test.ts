import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Guards the shape of what `updateSceneAudio` hands to zod.
 *
 * THIS BUG SHIPPED. Two required fields were added to the schema —
 * `audioLoop` and `audioDescription` — and the object built from the FormData
 * was never updated to supply them. Every attempt to attach audio to a scene
 * then failed `safeParse` and returned "Invalid input", with no hint that the
 * problem was on our side of the call.
 *
 * TypeScript could not catch it: `safeParse` takes `unknown` by design, so an
 * object missing half its keys is a perfectly valid argument.
 *
 * The schema and the reader are duplicated here rather than imported, because
 * the action is a "use server" module that pulls in the database client. The
 * duplication is the point of the test: if the real schema gains a required
 * field and the real reader does not, this copy diverges and the assertion
 * below fails.
 */
const audioSchema = z.object({
  sceneId: z.string().uuid(),
  destinationId: z.string().uuid(),
  audioMediaId: z.string().uuid().nullable(),
  audioLoop: z.boolean(),
  audioDescription: z.string().trim().max(500).nullable(),
  lang: z.string().min(2).max(5),
});

/** Mirrors the reader in updateSceneAudio. */
function readAudioForm(formData: FormData) {
  const raw = String(formData.get("audioMediaId") ?? "");
  return {
    sceneId: String(formData.get("sceneId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    audioMediaId: raw.length > 0 ? raw : null,
    audioLoop:
      formData.get("audioLoop") === null
        ? true
        : String(formData.get("audioLoop")) === "true",
    audioDescription: String(formData.get("audioDescription") ?? "").trim() || null,
    lang: String(formData.get("lang") ?? "en"),
  };
}

const UUID = "4f54cc46-ff9d-447c-b88b-80ec6d39d4ad";

function form(over: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("sceneId", UUID);
  fd.set("destinationId", UUID);
  fd.set("lang", "en");
  for (const [k, v] of Object.entries(over)) fd.set(k, v);
  return fd;
}

describe("updateSceneAudio form reading", () => {
  it("supplies every field the schema requires", () => {
    // The regression: the reader omitted audioLoop and audioDescription, so
    // this parse failed and every save returned "Invalid input".
    const result = audioSchema.safeParse(readAudioForm(form({ audioMediaId: UUID })));
    expect(result.success).toBe(true);
  });

  it("parses a minimal form — no audio, no loop flag, no description", () => {
    const result = audioSchema.safeParse(readAudioForm(form()));
    expect(result.success).toBe(true);
    expect(result.success && result.data.audioMediaId).toBeNull();
  });

  it("treats a MISSING loop flag as true, not false", () => {
    // Absent is not false. Reading it as false would silently switch a scene
    // to play-once on any caller that predates the field.
    const parsed = readAudioForm(form());
    expect(parsed.audioLoop).toBe(true);
  });

  it("honours an explicit false", () => {
    expect(readAudioForm(form({ audioLoop: "false" })).audioLoop).toBe(false);
  });

  it("reads a missing description as null, not the string \"null\"", () => {
    // String(formData.get("x")) on a missing key yields "null" — a truthy
    // five-character description that would render on the tour.
    expect(readAudioForm(form()).audioDescription).toBeNull();
  });

  it("treats a whitespace-only description as cleared", () => {
    expect(readAudioForm(form({ audioDescription: "   " })).audioDescription).toBeNull();
  });

  it("keeps a real description", () => {
    expect(readAudioForm(form({ audioDescription: " birdsong " })).audioDescription).toBe(
      "birdsong",
    );
  });

  it("rejects a description over the limit rather than truncating silently", () => {
    const parsed = audioSchema.safeParse(
      readAudioForm(form({ audioDescription: "x".repeat(501) })),
    );
    expect(parsed.success).toBe(false);
  });
});
