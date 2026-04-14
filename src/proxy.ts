import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const session = getSessionCookie(request);
  if (session) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const firstSegment = pathname.split("/")[1] ?? "en";
  const url = request.nextUrl.clone();
  url.pathname = `/${firstSegment}/sign-in`;
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/:lang(en|es)/admin/:path*",
    "/:lang(en|es)/creator/:path*",
    "/:lang(en|es)/learner/:path*",
    "/:lang(en|es)/support/:path*",
  ],
};
