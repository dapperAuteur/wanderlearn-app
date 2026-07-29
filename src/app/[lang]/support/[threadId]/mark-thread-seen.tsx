"use client";

import { useEffect, useRef } from "react";
import { markThreadSeen } from "@/lib/actions/support";
import type { Locale } from "@/lib/locales";

/**
 * Marks a thread's messages seen once the user has actually opened it.
 *
 * `markThreadSeen` and the `seen_by_user_at` column both shipped with the support
 * schema, but nothing ever called the action — so the column was permanently null and
 * the data was inert. That did not matter until the unread badge started reading it;
 * without this the badge would count every admin reply ever sent and never clear.
 *
 * Renders nothing. A client effect rather than a call during the page's server render,
 * because a write during render is a side effect Next may run more than once, and
 * because "seen" should mean the page actually reached a browser.
 */
export function MarkThreadSeen({ threadId, lang }: { threadId: string; lang: Locale }) {
  const sent = useRef(false);

  useEffect(() => {
    // Effects run twice in React Strict Mode; the write is idempotent but there is no
    // reason to send it twice.
    if (sent.current) return;
    sent.current = true;

    const form = new FormData();
    form.set("threadId", threadId);
    form.set("lang", lang);
    // Fire and forget. Failing to mark as read must never block reading the thread.
    void markThreadSeen(form).catch(() => {});
  }, [threadId, lang]);

  return null;
}
