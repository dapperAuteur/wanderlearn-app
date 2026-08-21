import { describe, expect, it } from "vitest";
import { walkOrderFromStart } from "./tour-graph";

/**
 * These exist because the bug they cover shipped to a screenshot before anyone
 * noticed: the Patina Gallery tour starts at "Front Door Outside", the ninth
 * scene by creation date, so a rail numbered by array position opened with
 * "Stop 9 of 9 — 8 left". The ordering is pure, so it is cheap to pin down.
 */
describe("walkOrderFromStart", () => {
  const link = (from: string, to: string) => ({
    fromSceneId: from,
    toSceneId: to,
    placed: true,
  });

  it("puts the start scene first even when it was created last", () => {
    const order = walkOrderFromStart({
      sceneIds: ["a", "b", "start"],
      links: [link("start", "a"), link("a", "b")],
      startSceneId: "start",
    });
    expect(order).toEqual(["start", "a", "b"]);
  });

  it("walks breadth-first, in link declaration order", () => {
    const order = walkOrderFromStart({
      sceneIds: ["s", "l", "r", "ll", "rr"],
      links: [link("s", "l"), link("s", "r"), link("l", "ll"), link("r", "rr")],
      startSceneId: "s",
    });
    expect(order).toEqual(["s", "l", "r", "ll", "rr"]);
  });

  it("appends unreachable scenes rather than dropping them", () => {
    // `orphan` is a creator bug that analyzeTourGraph reports separately, but a
    // visitor must still be able to reach it — and a total that silently
    // excluded it would be a lie.
    const order = walkOrderFromStart({
      sceneIds: ["s", "a", "orphan"],
      links: [link("s", "a")],
      startSceneId: "s",
    });
    expect(order).toEqual(["s", "a", "orphan"]);
    expect(order).toHaveLength(3);
  });

  it("terminates on a cycle", () => {
    const order = walkOrderFromStart({
      sceneIds: ["a", "b", "c"],
      links: [link("a", "b"), link("b", "c"), link("c", "a")],
      startSceneId: "a",
    });
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("ignores links pointing outside the tour", () => {
    // Cross-tour links carry a target in another destination; traversing one
    // would put a scene id in the rail that the viewer has no node for.
    const order = walkOrderFromStart({
      sceneIds: ["a", "b"],
      links: [link("a", "b"), link("a", "somewhere-else")],
      startSceneId: "a",
    });
    expect(order).toEqual(["a", "b"]);
  });

  it("returns every scene in original order when there is no start", () => {
    const order = walkOrderFromStart({
      sceneIds: ["a", "b"],
      links: [],
      startSceneId: null,
    });
    expect(order).toEqual(["a", "b"]);
  });

  it("survives a start id that is not in the scene list", () => {
    // assembleTour drops scenes whose media is not ready, which can orphan a
    // defaultStartSceneId that still points at one of them.
    const order = walkOrderFromStart({
      sceneIds: ["a", "b"],
      links: [link("a", "b")],
      startSceneId: "deleted",
    });
    expect(order).toEqual(["a", "b"]);
  });

  it("does not duplicate a scene reachable by two paths", () => {
    const order = walkOrderFromStart({
      sceneIds: ["s", "l", "r", "end"],
      links: [link("s", "l"), link("s", "r"), link("l", "end"), link("r", "end")],
      startSceneId: "s",
    });
    expect(order).toEqual(["s", "l", "r", "end"]);
    expect(new Set(order).size).toBe(order.length);
  });
});
