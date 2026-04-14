"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/locales";

export function LangAttribute({ lang }: { lang: Locale }) {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);
  return null;
}
