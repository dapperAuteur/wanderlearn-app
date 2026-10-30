/**
 * better-auth 1.7 compatibility shim. The WitUS IdP registers this app's OAuth redirect URI as
 * /api/auth/oauth2/callback/witus (the ecosystem-wide better-auth 1.6 path, exact-match
 * validated), while better-auth 1.7's genericOAuth handles callbacks at the core
 * /api/auth/callback/:id. The IdP sends the browser here; this forwards code/state intact.
 * Same shim as vogoat. Relative Location so the browser stays on the host it arrived on.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const providerId = url.pathname.split("/").filter(Boolean).pop() ?? "";
  return new Response(null, {
    status: 307,
    headers: { location: `/api/auth/callback/${encodeURIComponent(providerId)}${url.search}` },
  });
}
