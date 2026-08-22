/**
 * Fetch the poster ourselves rather than handing Satori a URL.
 *
 * Satori resolves `<img src>` during render, which happens OUTSIDE the
 * try/catch below — so a URL that 404s or hangs does not fall back to the
 * text-only card, it throws and takes the whole route down. The result is a
 * 500 on the one route whose entire job is to return a picture, which is
 * strictly worse than the plainer card the fallback exists to provide.
 *
 * That is not hypothetical. `posterUrlFor` builds an image URL from whatever
 * media id it is given, and not every media kind is an image: a `transcript`
 * asset yields a URL that returns 404. Nothing upstream checks the kind.
 *
 * Fetching here makes the failure path the same as every other one — return
 * null, render the text card — and bounds the latency, which an inline
 * `<img>` does not.
 */
export async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    // OG images are generated while a crawler waits; a slow poster must not
    // hold the card hostage. Two and a half seconds is generous for a CDN
    // image and still well inside every unfurler's patience.
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    // A 404 from Cloudinary comes back as image/gif, so status alone is not
    // enough of a check to be worth trusting on its own.
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    // Timeout, DNS, TLS, aborted socket — all the same answer.
    return null;
  }
}
