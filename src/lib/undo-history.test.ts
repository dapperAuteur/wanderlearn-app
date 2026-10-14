import { describe, expect, it } from "vitest";
import {
  GROUP_WINDOW_MS,
  UNDO_LIMIT,
  canRedo,
  canUndo,
  createHistory,
  record,
  redo,
  undo,
} from "./undo-history";

describe("undo history", () => {
  it("undoes and redoes single changes in order", () => {
    let h = createHistory(0);
    h = record(h, 1, { now: 0 });
    h = record(h, 2, { now: 10 });
    expect(canUndo(h)).toBe(true);
    expect(canRedo(h)).toBe(false);
    h = undo(h);
    expect(h.present).toBe(1);
    h = undo(h);
    expect(h.present).toBe(0);
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    expect(h.present).toBe(1);
    expect(canRedo(h)).toBe(true);
  });

  it("forgets the redo trail once something new happens", () => {
    let h = record(record(createHistory("a"), "b", { now: 0 }), "c", { now: 1 });
    h = undo(h);
    h = record(h, "d", { now: 2 });
    expect(h.present).toBe("d");
    expect(canRedo(h)).toBe(false);
    expect(undo(h).present).toBe("b");
  });

  it("merges a run of changes in one group into one step", () => {
    let h = createHistory(0);
    for (let i = 1; i <= 30; i++) h = record(h, i, { now: i * 16, group: "drag:a" });
    expect(h.present).toBe(30);
    expect(h.past).toEqual([0]);
    expect(undo(h).present).toBe(0);
  });

  it("starts a new step after the group goes quiet, or for another group", () => {
    let h = record(createHistory(0), 1, { now: 0, group: "w:a" });
    h = record(h, 2, { now: GROUP_WINDOW_MS + 1, group: "w:a" });
    expect(h.past).toEqual([0, 1]);
    h = record(h, 3, { now: GROUP_WINDOW_MS + 2, group: "h:a" });
    expect(h.past).toEqual([0, 1, 2]);
  });

  it("closes a group when sealed, so the next drag is its own step", () => {
    let h = record(createHistory(0), 1, { now: 0, group: "drag:a" });
    h = record(h, 2, { now: 10, group: "drag:a", seal: true });
    h = record(h, 3, { now: 20, group: "drag:a" });
    expect(h.past).toEqual([0, 2]);
  });

  it("ignores a change that changes nothing", () => {
    const h = createHistory({ n: 1 });
    expect(record(h, h.present, { now: 0 })).toBe(h);
  });

  it("keeps at most UNDO_LIMIT steps", () => {
    let h = createHistory(0);
    for (let i = 1; i <= UNDO_LIMIT + 20; i++) h = record(h, i, { now: i });
    expect(h.past).toHaveLength(UNDO_LIMIT);
    expect(h.past[0]).toBe(20);
  });

  it("undo and redo with nothing to do return the same history", () => {
    const h = createHistory(0);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });
});
