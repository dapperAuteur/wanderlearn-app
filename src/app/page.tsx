import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { defaultLocale, hasLocale } from "@/lib/locales";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const h = await headers();
  const acceptLanguage = h.get("accept-language") ?? "";
  const preferred = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0]!.trim().toLowerCase())
    .map((tag) => tag.split("-")[0]!);

  for (const tag of preferred) {
    if (hasLocale(tag)) {
      redirect(`/${tag}`);
    }
  }

  redirect(`/${defaultLocale}`);
}
