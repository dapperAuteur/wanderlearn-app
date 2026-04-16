"use client";

import { useTransition } from "react";
import type { Locale } from "@/lib/locales";
import { createCheckoutSession } from "@/lib/actions/checkout";

type Dict = {
  buyCta: string;
  redirectingLabel: string;
  errorGeneric: string;
  errorNotConfigured: string;
};

export function BuyButton({
  courseId,
  lang,
  priceLabel,
  dict,
}: {
  courseId: string;
  lang: Locale;
  priceLabel: string;
  dict: Dict;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    const formData = new FormData();
    formData.set("courseId", courseId);
    formData.set("lang", lang);
    startTransition(async () => {
      const result = await createCheckoutSession(formData);
      if (!result.ok) {
        window.alert(
          result.code === "stripe_not_configured" ? dict.errorNotConfigured : dict.errorGeneric,
        );
        return;
      }
      window.location.href = result.data.url;
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
    >
      {pending ? dict.redirectingLabel : `${dict.buyCta} · ${priceLabel}`}
    </button>
  );
}
