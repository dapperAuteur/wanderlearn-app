"use client";

import { useEffect, useState } from "react";
import { subscribeOutbox } from "@/lib/offline-outbox";
import { useOnlineStatus } from "@/lib/use-online-status";

type Dict = {
  waitingOne: string;
  waitingMany: string;
  syncingOne: string;
  syncingMany: string;
};

export function PendingWritesIndicator({ dict }: { dict: Dict }) {
  const online = useOnlineStatus();
  const [count, setCount] = useState(0);

  useEffect(() => subscribeOutbox(setCount), []);

  if (count === 0) return null;

  const template = online
    ? count === 1
      ? dict.syncingOne
      : dict.syncingMany
    : count === 1
      ? dict.waitingOne
      : dict.waitingMany;
  const label = template.replace("{count}", String(count));

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-3 inline-flex items-center gap-2 rounded-md border border-black/10 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-200"
    >
      <span
        aria-hidden="true"
        className={
          online
            ? "h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500 motion-reduce:animate-none"
            : "h-1.5 w-1.5 rounded-full bg-zinc-400"
        }
      />
      {label}
    </div>
  );
}
