import { describe, expect, it } from "vitest";
import { createTourVisit, createTourVisitAndCheckOpen } from "./tour-visit";

/**
 * The completion metric these guard is the one the passport benchmarks read
 * ("≥ 40% of tours completed"), so a quietly wrong number here would be worse
 * than no number — it would be a number BAM shows partners.
 *
 * Both rules covered below were real defects, not hypotheticals. The viewer's
 * scene set started empty, so the opening scene never counted: every visit was
 * undercounted by one and completion could never be reached at all.
 */
describe("createTourVisit", () => {
  it("counts the opening scene as seen", () => {
    // The bug: an empty set here means a 3-scene tour reports 2 after walking
    // the whole thing, and never completes.
    const visit = createTourVisit("start", 3);
    expect(visit.scenesViewed()).toBe(1);
  });

  it("completes on arrival at the last unseen scene", () => {
    const visit = createTourVisit("start", 3);
    expect(visit.markVisited("b")).toBe(false);
    expect(visit.markVisited("c")).toBe(true);
    expect(visit.scenesViewed()).toBe(3);
  });

  it("reports completion exactly once, however long the visitor keeps walking", () => {
    const visit = createTourVisit("start", 2);
    expect(visit.markVisited("b")).toBe(true);
    // Walking back and forth after finishing is ordinary behaviour; without
    // the guard each of these would count as another completed tour.
    expect(visit.markVisited("start")).toBe(false);
    expect(visit.markVisited("b")).toBe(false);
    expect(visit.markVisited("start")).toBe(false);
  });

  it("does not double-count a scene the visitor revisits", () => {
    const visit = createTourVisit("start", 3);
    visit.markVisited("b");
    visit.markVisited("b");
    visit.markVisited("start");
    expect(visit.scenesViewed()).toBe(2);
  });

  it("does not complete early when scenes are revisited instead of explored", () => {
    const visit = createTourVisit("start", 4);
    expect(visit.markVisited("b")).toBe(false);
    expect(visit.markVisited("b")).toBe(false);
    expect(visit.markVisited("start")).toBe(false);
    expect(visit.scenesViewed()).toBe(2);
  });

  it("still completes when the visitor reaches scenes by rail jump rather than in order", () => {
    // The stop rail lets anyone jump anywhere, so arrivals need not be adjacent.
    const visit = createTourVisit("start", 3);
    expect(visit.markVisited("c")).toBe(false);
    expect(visit.markVisited("b")).toBe(true);
  });
});

describe("createTourVisitAndCheckOpen", () => {
  it("reports a single-scene tour as complete at open", () => {
    // Truthful but trivial: there is no later scene change to notice it on, so
    // it has to be resolved at creation. Consumers filter these out of any
    // completion RATE via scenes_total >= 2 — see the note in events.ts.
    const { completeAtOpen } = createTourVisitAndCheckOpen("only", 1);
    expect(completeAtOpen).toBe(true);
  });

  it("does not report a multi-scene tour as complete at open", () => {
    const { completeAtOpen } = createTourVisitAndCheckOpen("start", 2);
    expect(completeAtOpen).toBe(false);
  });

  it("does not re-report completion later for a single-scene tour", () => {
    const { visit, completeAtOpen } = createTourVisitAndCheckOpen("only", 1);
    expect(completeAtOpen).toBe(true);
    expect(visit.markVisited("only")).toBe(false);
  });
});
