"use client";

import { useOnlineStatus } from "@/lib/use-online-status";

type Dict = {
  offlineTitle: string;
  offlineBody: string;
};

export function OfflineBanner({ dict }: { dict: Dict }) {
  const online = useOnlineStatus();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none sticky top-0 z-40"
    >
      {online ? null : (
        <div className="pointer-events-auto border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-900 backdrop-blur sm:px-6 dark:bg-amber-500/20 dark:text-amber-100">
          <p className="mx-auto flex max-w-3xl flex-wrap items-baseline gap-x-2">
            <strong className="font-semibold">{dict.offlineTitle}</strong>
            <span>{dict.offlineBody}</span>
          </p>
        </div>
      )}
    </div>
  );
}
