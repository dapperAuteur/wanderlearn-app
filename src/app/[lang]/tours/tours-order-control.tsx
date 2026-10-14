"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCustomToursOrder, setToursOrder } from "@/lib/actions/tours-order";
import type { Locale } from "@/lib/locales";
import { TOURS_ORDERS, type ToursOrder } from "@/lib/tours-order";

export type ToursOrderDict = {
  summary: string;
  orderLabel: string;
  orders: Record<ToursOrder, string>;
  customHelp: string;
  moveUpLabel: string;
  moveDownLabel: string;
  moveUpCta: string;
  moveDownCta: string;
  savedLabel: string;
  genericError: string;
};

const BUTTON =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-black/15 px-3 text-sm font-semibold hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5";

/**
 * Admin-only panel on /[lang]/tours: choose how the cards are ordered, and in
 * custom mode move tours up and down. Every change saves at once and the page
 * re-renders in the new order, which is the preview.
 */
export function ToursOrderControl({
  lang,
  order,
  tours,
  dict,
}: {
  lang: Locale;
  order: ToursOrder;
  /** Public tours in their current display order. */
  tours: { id: string; name: string }[];
  dict: ToursOrderDict;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  function run(action: () => Promise<{ ok: boolean }>) {
    setStatus("idle");
    startTransition(async () => {
      const result = await action();
      setStatus(result.ok ? "saved" : "error");
      if (result.ok) router.refresh();
    });
  }

  function move(index: number, delta: -1 | 1) {
    const ids = tours.map((t) => t.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    run(() => saveCustomToursOrder({ orderedIds: ids, lang }));
  }

  return (
    <details className="mt-8 rounded-lg border border-black/15 p-4 dark:border-white/20">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">
        {dict.summary}
      </summary>
      <label className="mt-3 flex flex-col gap-1 text-sm sm:max-w-xs">
        <span className="font-medium">{dict.orderLabel}</span>
        <select
          value={order}
          disabled={pending}
          onChange={(event) =>
            run(() =>
              setToursOrder({
                order: event.target.value as ToursOrder,
                seedIds: tours.map((t) => t.id),
                lang,
              }),
            )
          }
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base dark:border-white/20"
        >
          {TOURS_ORDERS.map((value) => (
            <option key={value} value={value}>
              {dict.orders[value]}
            </option>
          ))}
        </select>
      </label>
      {order === "custom" ? (
        <>
          <p className="mt-3 text-xs text-muted">{dict.customHelp}</p>
          <ol className="mt-2 flex flex-col gap-2">
            {tours.map((tour, index) => (
              <li
                key={tour.id}
                className="flex items-center justify-between gap-2 rounded-md border border-black/10 p-2 text-sm dark:border-white/15"
              >
                <span className="min-w-0 truncate">
                  {index + 1}. {tour.name}
                </span>
                <span className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={pending || index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={dict.moveUpLabel.replace("{name}", tour.name)}
                    className={BUTTON}
                  >
                    {dict.moveUpCta}
                  </button>
                  <button
                    type="button"
                    disabled={pending || index === tours.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={dict.moveDownLabel.replace("{name}", tour.name)}
                    className={BUTTON}
                  >
                    {dict.moveDownCta}
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
      <div role="status" aria-live="polite">
        {status === "saved" ? <p className="mt-2 text-sm">{dict.savedLabel}</p> : null}
      </div>
      {status === "error" ? (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {dict.genericError}
        </p>
      ) : null}
    </details>
  );
}
