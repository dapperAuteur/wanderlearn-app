-- Per-enrollment flag used by the "Save for offline" toggle on the course
-- detail page. When non-null, the learner has asked for this course's
-- assets to be aggressively pre-cached by the service worker. Toggling
-- off clears the column back to NULL and the SW uncaches the course.
ALTER TABLE "enrollments"
ADD COLUMN "offline_enabled_at" timestamp with time zone;
