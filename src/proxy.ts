import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale } from "@/lib/locales";

const PROTECTED_SEGMENTS = ["learner", "creator", "admin", "support"] as const;

function pickLocale(request: NextRequest): string {
  const header = request.headers.get("accept-language") ?? "";
  const preferred = header
    .split(",")
    .map((part) => part.split(";")[0]!.trim().toLowerCase())
    .map((tag) => tag.split("-")[0]!);
  for (const tag of preferred) {
    if (hasLocale(tag)) return tag;
  }
  return defaultLocale;
}

function isProtected(pathAfterLocale: string): boolean {
  const segment = pathAfterLocale.split("/").filter(Boolean)[0];
  return segment ? (PROTECTED_SEGMENTS as readonly string[]).includes(segment) : false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split("/")[1];

  if (firstSegment && hasLocale(firstSegment)) {
    const pathAfterLocale = pathname.slice(firstSegment.length + 1) || "/";
    if (isProtected(pathAfterLocale)) {
      const session = getSessionCookie(request);
      if (!session) {
        const url = request.nextUrl.clone();
        url.pathname = `/${firstSegment}/sign-in`;
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  const locale = pickLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|api/|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\..*).*)"],
};
