import { describe, expect, it } from "vitest";
import { findNarrativeLines } from "./editorial-contract";

const long = (s: string) => s.padEnd(160, " and more detail besides");

describe("findNarrativeLines", () => {
  it("flags a long declarative bullet — the shape narration would take", () => {
    const md = `# Front Door Outside\n\n- ${long("The morning light falls across the threshold in a way that makes the whole room feel like it is waiting for you.")}\n`;
    expect(findNarrativeLines(md)).toHaveLength(1);
  });

  it("does not flag a long QUESTION, however long-winded", () => {
    const md = `- ${long("What did it take to get this shot, and who else was in the room while you were setting up")}?\n`;
    expect(findNarrativeLines(md)).toEqual([]);
  });

  it("does not flag short bullets", () => {
    expect(findNarrativeLines("- What did you notice here?\n- Who else was present?")).toEqual([]);
  });

  it("ignores headings and prose paragraphs, which are not the contract", () => {
    // The contract is about the bulleted questions. A heading is structure and
    // a paragraph is the model explaining itself — neither is narration BAM
    // could mistake for his own line.
    const md = `# A Scene\n\n${long("This is an ordinary paragraph of explanation")}\n`;
    expect(findNarrativeLines(md)).toEqual([]);
  });

  it("reports 1-indexed line numbers so the warning can be acted on", () => {
    const md = `# Heading\n\n- short one?\n- ${long("A long declarative statement about the place")}\n`;
    expect(findNarrativeLines(md)[0]?.line).toBe(4);
  });

  it("handles asterisk bullets as well as hyphens", () => {
    const md = `* ${long("A long declarative statement about the place")}\n`;
    expect(findNarrativeLines(md)).toHaveLength(1);
  });

  it("returns nothing for an empty sheet rather than throwing", () => {
    expect(findNarrativeLines("")).toEqual([]);
  });
});
