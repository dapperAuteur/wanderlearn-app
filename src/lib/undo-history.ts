/**
 * Undo and redo for an editor's state, as plain data (improvement 42).
 *
 * Pure: the caller passes the clock, so the grouping is testable. A "group" names a run
 * of changes that should undo as one step, such as every frame of one drag or every
 * value a slider passes through: changes in the same group, each within GROUP_WINDOW_MS
 * of the last, replace the newest step instead of adding one.
 */

/** Most steps kept. Older ones fall off the bottom. */
export const UNDO_LIMIT = 100;
/** How long a group stays open after its last change. */
export const GROUP_WINDOW_MS = 1000;

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** The open group, or null when the next change starts a new step. */
  group: string | null;
  /** When the open group last changed. */
  at: number;
}

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], group: null, at: 0 };
}

export interface RecordOptions {
  now: number;
  /** Changes in the same group, close together, undo as one step. */
  group?: string | null;
  /** Close the group after this change, so the next one starts a new step (a drag's end). */
  seal?: boolean;
}

export function record<T>(history: History<T>, next: T, options: RecordOptions): History<T> {
  const group = options.group ?? null;
  const sealedGroup = options.seal ? null : group;
  if (Object.is(next, history.present)) {
    return options.seal && history.group === group ? { ...history, group: null } : history;
  }
  const joins = group !== null && history.group === group && options.now - history.at <= GROUP_WINDOW_MS;
  if (joins) {
    return { ...history, present: next, future: [], group: sealedGroup, at: options.now };
  }
  return {
    past: [...history.past, history.present].slice(-UNDO_LIMIT),
    present: next,
    future: [],
    group: sealedGroup,
    at: options.now,
  };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

export function undo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    group: null,
    at: 0,
  };
}

export function redo<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;
  return {
    past: [...history.past, history.present].slice(-UNDO_LIMIT),
    present: history.future[0],
    future: history.future.slice(1),
    group: null,
    at: 0,
  };
}
