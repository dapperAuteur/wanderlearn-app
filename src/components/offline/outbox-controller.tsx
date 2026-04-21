"use client";

import { useEffect } from "react";
import { drainOutbox } from "@/lib/offline-outbox";

// Mounts inside the learner flow and drains any queued progress writes:
// - Once on mount (catches writes that queued while the tab was closed).
// - On every window `online` event (back on network after being offline).
// No UI — this is a side-effect-only component. Add it anywhere inside
// the signed-in learner tree.
export function OutboxController() {
  useEffect(() => {
    let cancelled = false;

    async function tryDrain() {
      if (cancelled) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return;
      }
      try {
        await drainOutbox();
      } catch (err) {
        console.error("[offline] drainOutbox failed", err);
      }
    }

    void tryDrain();

    function handleOnline() {
      void tryDrain();
    }
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return null;
}
