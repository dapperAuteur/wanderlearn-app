"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { ANALYTICS_APP } from "./events";

/**
 * Initialises PostHog once, in the browser, and only when a key is configured.
 *
 * Keyless is a first-class state, not a failure: local dev, previews, and any deploy
 * before BAM sets the env vars all render normally with capture simply switched off.
 * Every helper in ./capture no-ops when this never ran.
 *
 * Privacy posture, deliberate and set here rather than in the dashboard so it is
 * reviewable in the diff:
 *
 * - `autocapture: false` — autocapture records every click and keystroke, which on this
 *   app means the support form, the sign-in form, and creator media names. People typed
 *   those expecting us to have them, not a third-party vendor. We send a named list
 *   instead (see ./events).
 * - `disable_session_recording: true` — same objection, larger. Needs its own decision
 *   before it goes near a learner surface.
 * - `persistence: "memory"` — no cookie, no localStorage. Analytics identity lives for
 *   one page session and then is gone, which is why this ships without a consent
 *   banner. Nearly every question in the taxonomy ("which scenes get reached", "where
 *   do tours lose people") is answerable within a session. The cost is that returning
 *   visitors count again, so treat unique counts as sessions, not people.
 *
 *   If BAM later wants cross-session identity, this becomes `localStorage+cookie` AND
 *   a consent gate has to land in the same change. Do not switch one without the other.
 * - `capture_pageview: false` — Next's client router does not do full page loads, so
 *   PostHog's automatic pageview would fire once and then lie. Route-level events are
 *   explicit in the taxonomy instead.
 */
export function PostHogProvider({
  apiKey,
  apiHost,
}: {
  apiKey: string | null;
  apiHost: string;
}) {
  useEffect(() => {
    if (!apiKey) return;
    if (posthog.__loaded) return;

    posthog.init(apiKey, {
      api_host: apiHost,
      autocapture: false,
      disable_session_recording: true,
      persistence: "memory",
      capture_pageview: false,
      capture_pageleave: false,
      // Shared WitUS project: every Wanderlearn event carries `app` so the other
      // ecosystem apps' data stays separable in the same project.
      loaded: (ph) => {
        ph.register({ app: ANALYTICS_APP });
      },
    });
  }, [apiKey, apiHost]);

  return null;
}
