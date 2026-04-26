# Embed a tour

Drop a Wanderlearn 360° tour into a WordPress post, a Squarespace page, a Weebly section, a Webflow CMS item, or any HTML or React project. The embed loads the same immersive viewer learners see at `/tours/<slug>`, with no Wanderlearn nav or footer.

Embeds work for any destination you've toggled to public on the destination page. Private destinations cannot be embedded; the iframe will return a 404.

## 1. Get your embed code

1. Open the destination in the creator UI: [/en/creator/destinations](/en/creator/destinations) and pick the destination you want to embed.
2. Confirm the **Public tour link** section shows **Public**. If it shows Private, toggle it on first.
3. Scroll to the **Embed this tour** section. You'll see a live preview, a few options, and a code snippet.
4. Adjust the options (described below), then click **Copy embed code**.

## 2. Available options

Each option appears as a control above the snippet, and is encoded as a query string on the iframe `src` URL. You can also edit the URL by hand if your tooling needs it.

| Option | Default | What it does |
|---|---|---|
| Theme | Light | Page background and the attribution chip color. Pick **Dark** if your host page is dark. |
| Accent color | Use destination's saved colors | Override the arrow and pin colors for this embed only. The preset palette matches the creator-UI picker. |
| Hide attribution | Off | Strips the small "Powered by Wanderlearn" link in the corner. Use only when you've cleared this with us. |
| Width | `100%` | Iframe width. Accepts CSS units or a pixel number. |
| Height | `600` | Iframe height in pixels. |

The "accent color" picker only affects the embed. The destination's saved colors stay as you set them on the creator UI; pick **Use destination's saved colors** to match.

## 3. Where to paste it

### WordPress (Block Editor / Gutenberg)

1. In the post or page, click the **+ Add block** button.
2. Search for **Custom HTML** and add the block.
3. Paste your iframe snippet.
4. Click **Preview** to confirm. The viewer renders inline.

If you're using the Classic Editor, switch to the **Text** tab and paste there.

### Squarespace

1. Open the page editor and click **+** between sections.
2. Pick the **Code** block (under "More").
3. Paste the iframe snippet.
4. Save and reload the page in a new tab to confirm.

### Weebly

1. Drag the **Embed Code** element into the section where you want the tour.
2. Click the placeholder, then click **Edit Custom HTML**.
3. Paste the iframe snippet.
4. Click outside the element to apply.

### Webflow

1. Drag an **Embed** element from the Add panel onto the page.
2. Paste the iframe snippet into the dialog.
3. Click **Save & Close**, then publish.

### Plain HTML

Paste the iframe snippet anywhere inside your page's `<body>`. No JavaScript required.

### React / Next.js

The iframe is a standard HTML element and works as JSX without modification. If you want to size it responsively, wrap it in a container with `aspect-video` (or your own ratio class):

```tsx
<div className="relative aspect-video w-full">
  <iframe
    src="https://wanderlearn.witus.online/embed/tours/<your-slug>"
    title="<destination> virtual tour"
    allow="fullscreen; gyroscope; accelerometer"
    allowFullScreen
    loading="lazy"
    className="absolute inset-0 h-full w-full"
  />
</div>
```

A standalone npm component (`@wanderlearn/embed`) is on the roadmap for after the iframe path proves stable.

## 4. Sizing and responsiveness

The iframe defaults to `100%` width and a fixed pixel height. For a fully responsive ratio, wrap the iframe in a container with `position: relative; padding-bottom: 56.25%;` (16:9) and set the iframe to `position: absolute; inset: 0; width: 100%; height: 100%;`. The Tailwind `aspect-video` class above does the same.

For mobile, a fixed `600px` height usually works, but tours read better with at least `400px` of vertical space.

## 5. Deep-linking to a specific scene

If you want the embed to open at a particular vantage point inside the destination, append `&scene=<sceneId>` to the iframe `src`. Get scene IDs from the creator UI: open the scene and look at the URL.

```
https://wanderlearn.witus.online/embed/tours/mucho-museo-del-chocolate?scene=<scene-uuid>
```

This matches the deep-link pattern on the public tour route.

## 6. Privacy and analytics

The embed runs in your visitors' browsers and loads:

- The Wanderlearn HTML page itself (one request)
- 360° media from Cloudinary (CDN, lazy-loaded)
- A small icon and CSS bundle

Wanderlearn does not set tracking cookies on the embed surface. If your host page uses cookies or analytics, those continue to work; the iframe is sandboxed by the browser's standard same-origin rules.

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Iframe shows a 404 page | Destination is private, or slug is wrong | Toggle the destination to public, double-check the slug in the URL |
| Iframe shows a blank loader | Browser is blocking the iframe (CSP on host site) | Check the host's CSP `frame-src` directive; ensure `wanderlearn.witus.online` is allowed |
| Tour loads but mobile gyroscope doesn't work | `allow` attribute on the iframe is missing | Make sure `allow="fullscreen; gyroscope; accelerometer"` is on the iframe (the snippet generator includes it) |
| Embed colors look wrong | Browser cached an older version | Hard reload the host page; also confirm the **accent** option in the snippet generator |

For anything unlisted, open a support thread at [/en/support/new](/en/support/new).

## 8. Roadmap

- **npm package** with a typed React component (`@wanderlearn/embed`). Same iframe under the hood, with a friendlier API and ratio-aware sizing.
- **Custom branding** for partner sites: replace the "Powered by Wanderlearn" link with a partner attribution. Currently a v2/paid-tier feature; reach out if your use case warrants it.
- **Resize-on-content** so the iframe height adapts automatically.

These are not in the current build. The iframe path documented above is what ships today.
