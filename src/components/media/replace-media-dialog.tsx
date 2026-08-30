"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { replaceMediaAcrossSlots } from "@/lib/actions/media";
import type { PlannedUse } from "@/lib/media-replace-plan";
import type { Locale } from "@/lib/locales";

export type ReplaceMediaDict = {
  heading: string;
  intro: string;
  usedNowhere: string;
  allCta: string;
  noneCta: string;
  ineligibleNote: string;
  replaceCta: string;
  replacingLabel: string;
  cancelCta: string;
  successLabel: string;
  genericError: string;
  slotLabels: Record<string, string>;
};

/**
 * Choose which uses of a file to point at a different one.
 *
 * WHY A CHECKLIST RATHER THAN A SWITCH. A file can occupy several slots at
 * once — one image is routinely a scene's panorama, that same scene's poster,
 * AND a tour's hero. 80 files in production are in more than one kind of slot.
 * "Replace everywhere" would change things the creator was not looking at;
 * "replace here only" cannot express what they usually want. So: show every
 * place, let them pick.
 *
 * INELIGIBLE SLOTS ARE SHOWN, NOT HIDDEN. A slot the new file cannot fill —
 * a pin icon that must be flat when the replacement is a 360 photo — stays
 * visible, disabled, with the reason beside it. Hiding it would make the list
 * silently shorter than the creator expects and leave them wondering whether
 * the app had forgotten a use.
 */
export function ReplaceMediaDialog({
  fromMediaId,
  toMediaId,
  planned,
  lang,
  dict,
  onDone,
}: {
  fromMediaId: string;
  toMediaId: string;
  /** Every use of the ORIGINAL file, each already marked eligible or not. */
  planned: PlannedUse[];
  lang: Locale;
  dict: ReplaceMediaDict;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejected, setRejected] = useState<{ slot: string; label: string; reason: string }[]>([]);

  const eligible = planned.filter((p) => p.eligible);
  const keyOf = (p: { slot: string; rowId: string }) => `${p.slot}::${p.rowId}`;
  // Pre-ticked. The common case is "yes, everywhere it can go" — starting
  // empty would make the ordinary action the one needing the most clicks.
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(eligible.map(keyOf)),
  );

  function apply() {
    setError(null);
    setRejected([]);
    const selections = eligible
      .filter((p) => chosen.has(keyOf(p)))
      .map((p) => ({ slot: p.slot, rowId: p.rowId }));
    if (selections.length === 0) return;
    startTransition(async () => {
      const result = await replaceMediaAcrossSlots({
        fromMediaId,
        toMediaId,
        selections,
        lang,
      });
      if (!result.ok) {
        setError(result.error || dict.genericError);
        // The action refuses the whole call rather than half-applying, and
        // names what it rejected — show those rather than a count.
        setRejected(result.ineligible ?? []);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  if (planned.length === 0) {
    return <p className="text-sm text-muted">{dict.usedNowhere}</p>;
  }

  return (
    <section className="rounded-md border border-black/15 p-3 dark:border-white/20">
      <h4 className="text-sm font-semibold">{dict.heading}</h4>
      <p className="mt-1 text-xs text-muted">{dict.intro}</p>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setChosen(new Set(eligible.map(keyOf)))}
          className="inline-flex min-h-11 items-center rounded-md border border-black/15 px-3 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          {dict.allCta}
        </button>
        <button
          type="button"
          onClick={() => setChosen(new Set())}
          className="inline-flex min-h-11 items-center rounded-md border border-black/15 px-3 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          {dict.noneCta}
        </button>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {planned.map((p) => {
          const key = keyOf(p);
          return (
            <li key={key}>
              <label
                className={`flex items-start gap-2 text-sm ${p.eligible ? "" : "opacity-70"}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0"
                  checked={p.eligible && chosen.has(key)}
                  disabled={!p.eligible || pending}
                  onChange={(e) =>
                    setChosen((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(key);
                      else next.delete(key);
                      return next;
                    })
                  }
                />
                <span className="min-w-0">
                  <span className="font-medium">{dict.slotLabels[p.slot] ?? p.slot}</span>{" "}
                  <span className="text-muted">— {p.label}</span>
                  {/* The reason, beside the thing it explains. */}
                  {!p.eligible && p.reason ? (
                    <span className="block text-xs text-muted">{p.reason}</span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {planned.some((p) => !p.eligible) ? (
        <p className="mt-2 text-xs text-muted">{dict.ineligibleNote}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={apply}
          disabled={pending || chosen.size === 0}
          className="inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-60"
        >
          {pending ? dict.replacingLabel : dict.replaceCta}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-md border border-black/20 px-4 text-sm hover:bg-black/5 disabled:opacity-60 dark:border-white/25 dark:hover:bg-white/10"
        >
          {dict.cancelCta}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {rejected.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-1">
          {rejected.map((r) => (
            <li key={`${r.slot}-${r.label}`} className="text-xs text-muted">
              {dict.slotLabels[r.slot] ?? r.slot} — {r.label}: {r.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
