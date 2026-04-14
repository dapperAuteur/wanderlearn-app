import "server-only";
import type { Locale } from "@/lib/locales";

const loaders = {
  en: () => import("./dictionaries/en.json").then((m) => m.default),
  es: () => import("./dictionaries/es.json").then((m) => m.default),
} satisfies Record<Locale, () => Promise<Dictionary>>;

export type Dictionary = typeof import("./dictionaries/en.json");

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return loaders[locale]();
}
