import { describe, expect, it } from "vitest";
import { buildPassport, type PassportInput } from "./passport";

const D = (iso: string) => new Date(iso);

function input(over: Partial<PassportInput> = {}): PassportInput {
  return {
    enrollments: [{ id: "e1", courseId: "c1", revokedAt: null }],
    courses: [{ id: "c1", slug: "mucho", title: "MUCHO" }],
    lessons: [
      { id: "l1", courseId: "c1" },
      { id: "l2", courseId: "c1" },
    ],
    progress: [
      { enrollmentId: "e1", lessonId: "l1", status: "completed", completedAt: D("2026-01-02") },
      { enrollmentId: "e1", lessonId: "l2", status: "completed", completedAt: D("2026-01-05") },
    ],
    courseDestinations: [{ courseId: "c1", destinationId: "d1" }],
    destinations: [
      { id: "d1", slug: "mucho-museo", name: "MUCHO", city: "Mexico City", country: "Mexico" },
    ],
    ...over,
  };
}

describe("buildPassport", () => {
  it("stamps a place when every published lesson of its course is done", () => {
    const p = buildPassport(input());
    expect(p.counts).toEqual({ places: 1, stamped: 1, inProgress: 0 });
    expect(p.entries[0]?.stamped).toBe(true);
    expect(p.entries[0]?.stampedAt).toEqual(D("2026-01-05"));
  });

  it("does not stamp a place whose course is unfinished, but still lists it", () => {
    const p = buildPassport(
      input({
        progress: [
          { enrollmentId: "e1", lessonId: "l1", status: "completed", completedAt: D("2026-01-02") },
        ],
      }),
    );
    expect(p.counts).toEqual({ places: 1, stamped: 0, inProgress: 1 });
    expect(p.entries[0]?.courses[0]).toMatchObject({ lessonsCompleted: 1, lessonsTotal: 2 });
  });

  it("refuses to stamp a course with no published lessons", () => {
    // `[].every(...)` is true, so the naive check stamps anyone who enrolls in
    // an empty course. The certificate route rejects these outright; the
    // passport has to agree or the two disagree about the same fact.
    const p = buildPassport(input({ lessons: [], progress: [] }));
    expect(p.entries[0]?.stamped).toBe(false);
    expect(p.counts.stamped).toBe(0);
  });

  it("ignores a revoked enrollment entirely", () => {
    const p = buildPassport(
      input({ enrollments: [{ id: "e1", courseId: "c1", revokedAt: D("2026-02-01") }] }),
    );
    expect(p.entries).toHaveLength(0);
    expect(p.counts.places).toBe(0);
  });

  it("counts a place ONCE when two finished courses share it", () => {
    const p = buildPassport({
      enrollments: [
        { id: "e1", courseId: "c1", revokedAt: null },
        { id: "e2", courseId: "c2", revokedAt: null },
      ],
      courses: [
        { id: "c1", slug: "a", title: "Cacao" },
        { id: "c2", slug: "b", title: "Bean to Bar" },
      ],
      lessons: [
        { id: "l1", courseId: "c1" },
        { id: "l2", courseId: "c2" },
      ],
      progress: [
        { enrollmentId: "e1", lessonId: "l1", status: "completed", completedAt: D("2026-03-01") },
        { enrollmentId: "e2", lessonId: "l2", status: "completed", completedAt: D("2026-04-01") },
      ],
      courseDestinations: [
        { courseId: "c1", destinationId: "d1" },
        { courseId: "c2", destinationId: "d1" },
      ],
      destinations: [{ id: "d1", slug: "m", name: "MUCHO", city: null, country: null }],
    });
    expect(p.counts.places).toBe(1);
    expect(p.entries[0]?.courses).toHaveLength(2);
    // Earliest, not latest: finishing a second course about the same museum
    // does not re-date the first visit.
    expect(p.entries[0]?.stampedAt).toEqual(D("2026-03-01"));
  });

  it("keeps the course finished when its completion date is unknown", () => {
    const p = buildPassport(
      input({
        progress: [
          { enrollmentId: "e1", lessonId: "l1", status: "completed", completedAt: null },
          { enrollmentId: "e1", lessonId: "l2", status: "completed", completedAt: null },
        ],
      }),
    );
    expect(p.entries[0]?.stamped).toBe(true);
    // Unknown rather than invented. An older progress row may predate the
    // column being written.
    expect(p.entries[0]?.stampedAt).toBeNull();
  });

  it("does not count another learner's progress rows", () => {
    const p = buildPassport(
      input({
        progress: [
          { enrollmentId: "e1", lessonId: "l1", status: "completed", completedAt: D("2026-01-02") },
          { enrollmentId: "SOMEONE-ELSE", lessonId: "l2", status: "completed", completedAt: D("2026-01-03") },
        ],
      }),
    );
    expect(p.entries[0]?.stamped).toBe(false);
  });

  it("ignores in-progress rows when deciding completion", () => {
    const p = buildPassport(
      input({
        progress: [
          { enrollmentId: "e1", lessonId: "l1", status: "completed", completedAt: D("2026-01-02") },
          { enrollmentId: "e1", lessonId: "l2", status: "in_progress", completedAt: null },
        ],
      }),
    );
    expect(p.entries[0]?.stamped).toBe(false);
  });

  it("orders stamped places before unstamped ones", () => {
    const p = buildPassport({
      enrollments: [
        { id: "e1", courseId: "c1", revokedAt: null },
        { id: "e2", courseId: "c2", revokedAt: null },
      ],
      courses: [
        { id: "c1", slug: "a", title: "A" },
        { id: "c2", slug: "b", title: "B" },
      ],
      lessons: [
        { id: "l1", courseId: "c1" },
        { id: "l2", courseId: "c2" },
      ],
      progress: [
        { enrollmentId: "e2", lessonId: "l2", status: "completed", completedAt: D("2026-05-01") },
      ],
      courseDestinations: [
        { courseId: "c1", destinationId: "d1" },
        { courseId: "c2", destinationId: "d2" },
      ],
      destinations: [
        { id: "d1", slug: "aa", name: "Alpha", city: null, country: null },
        { id: "d2", slug: "bb", name: "Beta", city: null, country: null },
      ],
    });
    expect(p.entries.map((e) => e.name)).toEqual(["Beta", "Alpha"]);
    expect(p.counts).toEqual({ places: 2, stamped: 1, inProgress: 1 });
  });

  it("skips a place whose destination row is not available", () => {
    // Unpublished or deleted between the two reads. Dropping it is right —
    // linking to a 404 from a passport is worse than an absent line.
    const p = buildPassport(input({ destinations: [] }));
    expect(p.entries).toHaveLength(0);
  });

  it("never reports a total that sums places and stamps", () => {
    const p = buildPassport(input());
    expect(Object.keys(p.counts).sort()).toEqual(["inProgress", "places", "stamped"]);
    expect(p.counts.places).toBe(p.counts.stamped + p.counts.inProgress);
  });
});
