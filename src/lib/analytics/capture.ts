"use client";

import posthog from "posthog-js";
import type { AnalyticsEvents, AnalyticsEventName } from "./events";

/**
 * The only way to send an event.
 *
 * Typed against the taxonomy, so a call site cannot invent a name or omit a property.
 * Silently no-ops when PostHog was never initialised (no key configured), which keeps
 * every call site free of `if (analyticsEnabled)` noise.
 *
 * Never throws. An analytics failure must not break a tour — this is instrumentation,
 * not a feature, and a visitor should never see a broken viewer because a capture
 * request failed.
 */
export function capture<E extends AnalyticsEventName>(
  event: E,
  properties: AnalyticsEvents[E],
): void {
  try {
    if (!posthog.__loaded) return;
    posthog.capture(event, properties);
  } catch {
    // Deliberately swallowed. See above.
  }
}
