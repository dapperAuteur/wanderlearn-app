/**
 * The event taxonomy, as types.
 *
 * Analytics tools cannot retroactively merge `scene_view` and `scene_viewed` into one
 * series, so a typo here is permanent data damage rather than a bug you fix. Putting
 * the names and their payloads in one typed map means a call site cannot invent a name
 * or forget a property — `tsc` refuses.
 *
 * Agreed with BAM 2026-07-28 (see plans/runbooks/02-posthog-setup.md). Adding an event
 * is cheap; renaming one is not. Prefer adding a property to an existing event over
 * minting a near-duplicate name.
 *
 * NOT captured, deliberately: anything from /creator or /admin beyond the five creator
 * events below, anything carrying a learner's name, email, or typed content (ids and
 * slugs only), and support message bodies.
 */

/** Distinguishes Wanderlearn's events inside the shared WitUS project. */
export const ANALYTICS_APP = "wanderlearn" as const;

export type AnalyticsEvents = {
  // ---- Tour + scene. The set that answers "what do visitors actually use?" ----
  tour_opened: {
    destination_slug: string;
    /** How the visitor arrived, so we can tell the globe from an embed. */
    entry: "direct" | "globe" | "embed" | "course";
  };
  scene_viewed: {
    destination_slug: string;
    scene_id: string;
    /** Position in the visit, not in the tour: 1 is wherever they started. */
    index: number;
  };
  scene_link_followed: {
    destination_slug: string;
    from_scene_id: string;
    to_scene_id: string;
    /**
     * "link" = the visitor clicked a scene-link arrow; "jump" = any other
     * navigation that changes scenes (the tour-map pin, gallery). Property
     * rather than a new event per the header rule — both are traversals,
     * distinguished by mechanism.
     */
    via: "link" | "jump";
  };
  hotspot_opened: {
    destination_slug: string;
    scene_id: string;
    hotspot_id: string;
    hotspot_type: "content" | "external" | "cross_tour";
  };
  tour_exited: {
    destination_slug: string;
    scenes_viewed: number;
    duration_ms: number;
  };
  embed_loaded: {
    destination_slug: string;
    /** Host only, never the full partner URL. */
    referrer_host: string | null;
  };
  /**
   * A tour link left the app to be shared. Added at BAM's request 2026-07-28.
   *
   * `method` matters more than the count: "copy the public link" and "copy the embed
   * snippet" are different intentions, and embed shares are the ones that predict
   * partner-site traffic.
   */
  tour_shared: {
    destination_slug: string;
    method: "public_link" | "embed_code" | "scene_link";
    /** Where the share happened from. Creator studio vs the public tour page. */
    surface: "creator" | "public";
  };

  // ---- Course + learner ----
  course_view: { course_slug: string };
  enroll_free_success: { course_slug: string };
  checkout_started: { course_slug: string; price_cents: number };
  checkout_completed: { course_slug: string; price_cents: number };
  lesson_started: { course_slug: string; lesson_slug: string };
  lesson_completed: { course_slug: string; lesson_slug: string };
  certificate_downloaded: { course_slug: string };

  // ---- Creator + support ----
  scene_created: { destination_slug: string; bulk: boolean };
  media_uploaded: { kind: string };
  /** Tells us whether the corrected size limits are right, instead of guessing again. */
  media_upload_failed: { kind: string; reason: "too_large" | "wrong_kind" | "provider_error" };
  tour_published: { destination_slug: string };
  support_thread_opened: { category: string };
};

export type AnalyticsEventName = keyof AnalyticsEvents;
