"use client";

import { useState, useTransition } from "react";
import { removePlaceMark } from "@/lib/actions/place-marks";

export function RemoveMarkButton({
  markId,
  label,
  placeName,
}: {
  markId: string;
  label: string;
  placeName: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await removePlaceMark(markId);
            setFailed(!res.ok);
          })
        }
        className="mt-3 inline-flex min-h-11 items-center text-sm underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        <span aria-hidden="true">{label}</span>
        {/* Names the place: a list of identical "Remove" links is unusable
            with a screen reader. */}
        <span className="sr-only">{`${label}: ${placeName ?? ""}`}</span>
      </button>
      <p aria-live="polite" className="text-sm text-muted">
        {failed ? "—" : ""}
      </p>
    </>
  );
}
