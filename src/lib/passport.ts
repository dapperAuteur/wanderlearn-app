/**
 * Builds a learner's passport from the rows that actually exist.
 *
 * WHAT A STAMP CAN HONESTLY MEAN. Nothing in the schema joins a user to a
 * tour: `userId` appears on enrollments, purchases, reviews and support
 * threads, and nowhere else. Tours are viewed signed-out by design, and
 * `hunt_progress` is keyed by an opaque `visitorKey` that is deliberately not
 * joinable to a person. So "tours taken" is not a fact the database holds.
 *
 * What it does hold is which COURSES someone finished, and `course_destinations`
 * says which place each course is built around. That is the stamp: you
 * completed the course about this place. It is a narrower claim than "you
 * toured here", and it is a true one.
 *
 * THE ROW IS THE PLACE, NOT THE COURSE. Two courses about the same museum are
 * one entry with two lines under it, never two entries. Counting them twice
 * would inflate the passport, and an inflated record discredits every other
 * number on the page — the same reason the stop rail refuses to guess.
 *
 * COUNTS NEVER SUM ACROSS KINDS. "3 places · 2 stamped" is two facts about the
 * same three rows. There is deliberately no single total, because a total that
 * added places to stamps would be meaningless and would look authoritative.
 */

export type PassportCourseRef = {
  slug: string;
  title: string;
  lessonsTotal: number;
  lessonsCompleted: number;
  completed: boolean;
  /** Latest lesson completion for this course, or null if unfinished. */
  completedAt: Date | null;
};

export type PassportEntry = {
  destinationId: string;
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  /** True when at least one course about this place is finished. */
  stamped: boolean;
  /** When the FIRST course about this place was finished. Null when unstamped. */
  stampedAt: Date | null;
  /** Every enrolled course about this place, finished or not. */
  courses: PassportCourseRef[];
};

export type PassportInput = {
  enrollments: { id: string; courseId: string; revokedAt: Date | null }[];
  courses: { id: string; slug: string; title: string }[];
  /** PUBLISHED lessons only. A draft lesson must not gate a stamp. */
  lessons: { id: string; courseId: string }[];
  progress: { enrollmentId: string; lessonId: string; status: string; completedAt: Date | null }[];
  courseDestinations: { courseId: string; destinationId: string }[];
  destinations: {
    id: string;
    slug: string;
    name: string;
    city: string | null;
    country: string | null;
  }[];
};

export type Passport = {
  entries: PassportEntry[];
  counts: { places: number; stamped: number; inProgress: number };
};

export function buildPassport(input: PassportInput): Passport {
  const activeEnrollments = input.enrollments.filter((e) => e.revokedAt === null);
  const courseById = new Map(input.courses.map((c) => [c.id, c]));
  const destinationById = new Map(input.destinations.map((d) => [d.id, d]));

  const lessonsByCourse = new Map<string, string[]>();
  for (const l of input.lessons) {
    const list = lessonsByCourse.get(l.courseId);
    if (list) list.push(l.id);
    else lessonsByCourse.set(l.courseId, [l.id]);
  }

  const completedByEnrollment = new Map<string, Map<string, Date | null>>();
  for (const p of input.progress) {
    if (p.status !== "completed") continue;
    let m = completedByEnrollment.get(p.enrollmentId);
    if (!m) {
      m = new Map();
      completedByEnrollment.set(p.enrollmentId, m);
    }
    m.set(p.lessonId, p.completedAt);
  }

  // course id -> its computed state for this learner
  const courseState = new Map<string, PassportCourseRef>();
  for (const e of activeEnrollments) {
    const course = courseById.get(e.courseId);
    if (!course) continue;
    const lessonIds = lessonsByCourse.get(e.courseId) ?? [];
    const done = completedByEnrollment.get(e.id) ?? new Map<string, Date | null>();
    const lessonsCompleted = lessonIds.filter((id) => done.has(id)).length;

    // A course with no published lessons is NOT complete. `every` on an empty
    // array is true, which would stamp a learner for enrolling in an empty
    // course — the same trap as a one-scene tour reporting itself finished.
    // The certificate route refuses these outright ("no_lessons"), so the
    // passport must agree with it or the two disagree about the same fact.
    const completed = lessonIds.length > 0 && lessonsCompleted === lessonIds.length;

    let completedAt: Date | null = null;
    if (completed) {
      for (const id of lessonIds) {
        const at = done.get(id) ?? null;
        // A completed row with a null completedAt is possible (older rows
        // predate the column being set). Treat the course as finished but its
        // date as unknown rather than inventing one.
        if (at && (!completedAt || at > completedAt)) completedAt = at;
      }
    }

    courseState.set(e.courseId, {
      slug: course.slug,
      title: course.title,
      lessonsTotal: lessonIds.length,
      lessonsCompleted,
      completed,
      completedAt,
    });
  }

  const byDestination = new Map<string, PassportEntry>();
  for (const cd of input.courseDestinations) {
    const state = courseState.get(cd.courseId);
    if (!state) continue; // not enrolled, or enrollment revoked
    const dest = destinationById.get(cd.destinationId);
    if (!dest) continue; // unpublished or deleted place

    let entry = byDestination.get(dest.id);
    if (!entry) {
      entry = {
        destinationId: dest.id,
        slug: dest.slug,
        name: dest.name,
        city: dest.city,
        country: dest.country,
        stamped: false,
        stampedAt: null,
        courses: [],
      };
      byDestination.set(dest.id, entry);
    }
    entry.courses.push(state);
    if (state.completed) {
      entry.stamped = true;
      // EARLIEST completion, not latest: the stamp records when you first
      // earned this place. Finishing a second course about the same museum
      // does not re-date the first visit.
      if (state.completedAt && (!entry.stampedAt || state.completedAt < entry.stampedAt)) {
        entry.stampedAt = state.completedAt;
      }
    }
  }

  const entries = [...byDestination.values()].sort((a, b) => {
    // Stamped first, then most recent stamp, then alphabetical. An unstamped
    // place is an invitation rather than a failure, so it still appears.
    if (a.stamped !== b.stamped) return a.stamped ? -1 : 1;
    if (a.stampedAt && b.stampedAt) return b.stampedAt.getTime() - a.stampedAt.getTime();
    if (a.stampedAt) return -1;
    if (b.stampedAt) return 1;
    return a.name.localeCompare(b.name);
  });
  for (const e of entries) e.courses.sort((x, y) => x.title.localeCompare(y.title));

  return {
    entries,
    counts: {
      places: entries.length,
      stamped: entries.filter((e) => e.stamped).length,
      inProgress: entries.filter((e) => !e.stamped).length,
    },
  };
}
