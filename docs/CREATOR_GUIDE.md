# Creator Guide

How to build a Wanderlearn course end to end: media → destinations → scenes → tours → lessons → blocks → publish.

Intended audience: creators and teachers. Assumes you have a Wanderlearn account promoted to the `creator` (or `teacher`) role. If you don't, an admin has to promote you first; see [ADMIN_GUIDE.md](ADMIN_GUIDE.md) §User roles.

---

## 0. Mental model

Wanderlearn's content model has five layers. Build them bottom-up the first time; after that you can revisit any layer without redoing the others.

```
course
 └── lesson (ordered)
      └── content block (ordered)
           ├── text            : markdown passage
           ├── photo_360       : single 360° photo, standalone viewer
           ├── video_360       : single 360° video, standalone viewer
           ├── video           : standard video with HLS + fallback
           ├── virtual_tour    : multi-scene tour of a destination
           └── quiz            : multiple-choice check

destination (real place)
 └── scene (360° vantage point inside a place)
      ├── hotspots (clickable callouts)
      └── scene links (navigable paths to other scenes)
```

A **virtual_tour** block in a lesson pulls in every scene at a destination you own, with their hotspots and links, as one navigable experience. That's how a single lesson becomes an explorable museum gallery, trail, or workshop.

---

## 1. Getting set up as a creator

1. Sign up at [/en/sign-up](/en/sign-up). Magic-link email arrives; click through.
2. Ask an admin (BAM) to promote your role to `creator` or `teacher`. See [ADMIN_GUIDE.md](ADMIN_GUIDE.md) §User roles.
3. Sign in. Your nav gains a **Creator** link pointing at [/en/creator/courses](/en/creator/courses).
4. Your top-level creator surfaces:
   - [/en/creator/media](/en/creator/media): your media library
   - [/en/creator/destinations](/en/creator/destinations): real places you've documented
   - [/en/creator/courses](/en/creator/courses): courses you've built

---

## 2. Uploading media to the library

[/en/creator/media](/en/creator/media) is the root of every file you'll use.

**Supported kinds:**

| Kind | What it's for | Max size |
|---|---|---|
| `image` | Course cover images, destination heroes, non-360° photos | 50 MB |
| `audio` | Hotspot narration, podcast-style lesson clips | 500 MB |
| `standard_video` | Flat video for `video` blocks | 2 GB |
| `photo_360` | Equirectangular 360° stills for `photo_360` blocks or scenes | 100 MB |
| `video_360` | Equirectangular 360° video for `video_360` blocks or scenes | 5 GB |
| `drone_video` | Aerial footage | 5 GB |
| `transcript` | .vtt or .srt file attached to a video | 5 MB |
| `screenshot` | Attachments for support threads (upload via support flow, not here) | 5 MB |
| `screen_recording` | Same; support flow | 150 MB |

**To upload:**

1. Open [/en/creator/media](/en/creator/media).
2. Click **Upload a new file**.
3. Pick the **Kind** (most important step; affects how Wanderlearn processes and delivers the file).
4. Choose the file.
5. Watch the progress bar. Uploads go direct to Cloudinary (never through Wanderlearn's server).
6. On completion the file appears in the library with status `processing` → `ready` within seconds to minutes depending on size.

**Naming and tagging.** Click a file in the library to edit:
- **Display name**: how the file shows up when you pick it for a block or scene. Use descriptive names ("MUCHO ground floor, entrance hall" beats "IMG_3291.jpg").
- **Description**: optional long-form. Useful for yourself, also searchable.
- **Tags**: free-form, comma-separated. Useful for filtering your own library later.

**Linking a transcript to a video.** Open any `standard_video` or `video_360` in the library. There's a field called **Transcript**. Pick a `transcript` kind file from your library. This link is what the publish gate checks: courses with video blocks whose media has no linked transcript cannot be submitted for review.

**Replacing vs deleting.** Editing a file's display name or tags is safe. Deleting a file shows a reference blocker if it's used anywhere; you'll see which destinations, scenes, or courses reference it before you can delete.

**Previewing a file.** Every row in the library now has a **Preview** button alongside Edit and Delete. Click it and an inline dialog opens with the right player for the kind:

- Images and screenshots show in a lightbox.
- Audio and standard/drone video get inline `controls`.
- 360° photos and videos open inside the immersive viewer so you can spin around and verify the source is genuinely equirectangular before you drop it into a scene or lesson.
- Transcripts open in a new tab.

The Preview button is disabled while a file is still uploading or processing; once its status flips to Ready, the button activates.

### 360° media guidelines

For 360° photos and videos to render correctly in the viewer:

- **Equirectangular projection** (2:1 aspect ratio). Most consumer 360° cameras (Insta360, GoPro Max, Ricoh Theta) export this by default.
- **Photo minimum resolution**: 4K (4096×2048) looks ok; 6K (6144×3072) looks good; 8K looks great. Below 2K looks pixelated when the viewer zooms in.
- **Video frame rate**: 30 fps is safe. Higher frame rates work if Cloudinary's transcode handles them.
- **Video length**: keep under 3 minutes for a block. Longer videos are better split across multiple lesson blocks for pacing.
- **Format**: MP4 (H.264) for video, JPG or PNG for photos. Cloudinary will re-encode on delivery.

---

## 3. Creating a destination

A **destination** is a real place. MUCHO Museo del Chocolate. The Louvre. A specific tidepool at low tide. One destination can host many scenes.

1. Open [/en/creator/destinations](/en/creator/destinations).
2. Click **New destination**.
3. Fill in:
   - **Name** (required): the place's real name
   - **Slug** (optional, auto-generated from name): lowercase, dashes, used in URLs
   - **Country** and **City** (optional but recommended for browsing)
   - **Latitude** and **Longitude** (optional, decimal degrees, positive for N/E, negative for S/W). Enables future "show on map" features.
   - **Website** (optional): the place's real URL
   - **Description** (optional): short prose about the place
4. Save.
5. On the destination detail page, you can now set a **hero image**: a 2D photo or 360° photo from your media library that represents the destination in cards and headers.

### Sharing a destination's tour publicly

Every destination has a **public / private** toggle on its detail page. Default is private.

1. Open [/en/creator/destinations/&lt;id&gt;](/en/creator/destinations).
2. Scroll to the **Public tour link** section. The status pill reads **Private** on fresh destinations.
3. Click **Toggle**. The pill flips to **Public** and a shareable URL appears (`/en/tours/<slug>`).
4. Click **Copy link** to copy the URL.

When a destination is public, anyone with the URL sees the full immersive tour (every scene you've added, with hotspots and scene links) without signing in. Private destinations 404 for visitors; the URL doesn't leak the name.

On individual scene pages (`/en/creator/destinations/<id>/scenes/<sceneId>`) the same copy-link block appears. The copied URL is the **deep link** to that specific scene: `/en/tours/<slug>?scene=<sceneId>`. Shares cleanly in iMessage, Slack, social, etc.: a branded 1200×630 Open Graph preview renders the destination name and description.

Turn the toggle off any time to retract public access.

---

## 4. Creating scenes at a destination

A **scene** is one 360° vantage point inside a destination. Stand in MUCHO's entrance hall, take a 360° photo → that's one scene. Walk to the tasting room, take another → second scene.


1. Open your destination at [/en/creator/destinations/&lt;id&gt;](/en/creator/destinations).
2. Click **New scene**.
3. Fill in:
   - **Name** (required): what this vantage point is, e.g. "Ground floor entrance"
   - **Caption** (optional): a sentence learners see under the viewer
   - **Panorama** (required): pick a `photo_360` or `video_360` from your media library. Must be `ready` status.
4. Save. The scene's immersive view opens in the PSV viewer for verification.

**Video 360° scenes** work the same way; the learner viewer plays the video with play/pause/volume controls inside the 360° environment.

### Setting the start view direction

By default, the 360° viewer opens at the camera's native north. Often that's not the angle you want a learner to land on (e.g., you want them facing the main artifact, not the back wall).

1. On the scene edit page, scroll to the **Start view** section below the viewer.
2. Rotate the viewer to the angle you want to be the first thing learners see.
3. Click **Use current view**. The yaw + pitch fields populate with PSV's coordinates for that direction (radians; yaw ≈ east-west, pitch ≈ up-down).
4. Click **Save start view**. Status flips to "✓ Start view saved."

You can also type yaw/pitch numbers directly if you have exact values. **Clear** resets the scene to PSV's default north.

When a learner opens the tour (either via a lesson's `virtual_tour` block or via a shareable link), the initial orientation is exactly what you saved. If they navigate to a linked scene, that scene's own start view fires, so each scene can point somewhere meaningful.

### Choosing a 2D poster (thumbnail)

Every scene has a **2D poster**: a flat image that shows up in three situations.

- Thumbnail wherever the scene is listed (destination page, search, picker grids)
- 2D fallback if the immersive viewer can't load (ancient browsers, slow connections, some a11y contexts)
- Link-preview image for shareable tour URLs

For a photo_360 scene, Wanderlearn automatically uses the panorama itself as the poster. For a video_360 scene there's no sensible default; you need to pick one, or accept a Cloudinary-derived still frame.

1. On the scene edit page, below the panorama picker, find the **2D poster / thumbnail** section.
2. Click any tile in the grid to select it. Options come from your media library: kinds `image`, `photo_360`, and `screenshot` are eligible.
3. Click **Save poster**. Click **Clear selection** to go back to the derived default.

No poster candidates? Upload an image or screenshot to your media library first. The picker then lists it.

---

## 5. Adding hotspots to a scene

A **hotspot** is a clickable marker inside the 360° view. Click it and a panel opens with text, optional audio, or a link. This is how you turn a 360° photo into a guided walkthrough.

1. Open a scene's edit page at [/en/creator/destinations/&lt;dest-id&gt;/scenes/&lt;scene-id&gt;/edit](/en/creator/destinations).
2. Below the viewer, find the **Hotspots** section.
3. Click inside the 360° viewer at the point you want the hotspot. A temporary crosshair appears.
4. Click **Add hotspot at crosshair**.
5. Fill in the form:
   - **Local key**: short identifier, unique within this scene (e.g. `cacao-pod`)
   - **Title**: what the hotspot tooltip says on hover
   - **Content HTML**: what the panel shows when clicked (supports basic HTML: `<p>`, `<strong>`, `<a>`, `<img>`)
   - **Audio** (optional): pick an `audio` kind file from your library for narration
   - **External URL** (optional): a click-through to an outside resource
6. Save. Repeat for each point of interest.

To reposition a hotspot later, delete it and re-click the new location. (Drag-to-move is not in Phase 1.)

---

## 6. Adding scene links (to navigate between scenes)

A **scene link** is a clickable path from one scene to another. Learners click it and the viewer transitions to the linked scene. This is how you build a tour that lets someone walk from the entrance hall to the tasting room without leaving the viewer.

1. In the scene's edit page, find the **Scene links** section.
2. Click inside the 360° viewer at the direction the linked scene is (e.g. the doorway leading to the next room).
3. Click **Add link at crosshair**.
4. Pick the destination scene from the dropdown. Only scenes at the same destination you own are eligible.
5. Optional: give the link a name learners see on hover.
6. Save.

Scene links are one-way. If you want bidirectional (A → B and B → A), create both links on their respective scenes.

### Constraint: photo and video scenes can't share a single tour

PSV binds one renderer per viewer instance: photo scenes and video scenes can't coexist in the same immersive walkthrough. If your destination mixes both kinds, the viewer renders only the photo scenes and silently hides the video ones.

The creator UI surfaces an amber banner on the destination view page AND the scene edit page when it detects a mixed destination. The banner text: "This destination has both 360° photos and 360° videos. In the immersive viewer, only the photo scenes render." The viewer still works; only the videos are hidden.

Options:
- Keep them together if you want the photo tour only and are OK with the videos being reachable some other way.
- Split the videos into their own destination for the best result. Two destinations, two tours, two sharable URLs.

---

## 7. Creating a course

A **course** is what learners enroll in. It owns metadata, a price, and a list of lessons.

1. Open [/en/creator/courses](/en/creator/courses).
2. Click **New course**.
3. Fill in:
   - **Title** (required)
   - **Slug** (auto-generated): used in URLs
   - **Subtitle**: one-line pitch, shows on the course card
   - **Description**: longer prose, shown on the course detail page
   - **Destination** (optional but recommended): the real place this course is anchored to. Picks from destinations you own.
   - **Price (cents)**: enter `0` for free. Wanderlearn uses **per-course pricing**, not subscriptions. The course card and course detail page show this price with Stripe's live fee calculator on the edit page.
   - **Default locale**: `en` or `es`. The language the source content is written in; translations overlay on top.
4. Save. You're now on the course detail page.

**Course status** lives in four states:
- `draft`: you're still building. Invisible to learners.
- `in_review`: submitted for admin approval. Still invisible to learners.
- `published`: live, learners can enroll and take.
- `unpublished`: was published, now hidden. Re-submittable.

You start at `draft`. The path to `published` goes through the publish gate, covered in §11.

---

## 8. Adding lessons to a course

A **lesson** is the unit learners mark complete. Lessons are ordered within a course.

1. On the course detail page, click **New lesson**.
2. Fill in:
   - **Title** (required)
   - **Slug** (auto-generated): used in URLs
   - **Summary**: one or two sentences shown on the course detail page lesson list
   - **Is free preview**: if checked, the lesson is viewable without enrollment. Useful for giving learners a taste of paid courses before they commit.
   - **Estimated minutes**: rough time to complete. Shown to learners on the detail page.
   - **Status**: `draft` or `published`. A lesson in `draft` status is hidden from learners even if the course is published.
3. Save.

Lessons are ordered by their `order_index`, set on create and reorderable via the move-up / move-down controls on the course detail page.

---

## 9. Adding content blocks to a lesson

This is where the teaching actually happens. Open a lesson, click one of the **Add block** buttons. Each block type has its own editor.

### text block

Markdown passage. Supports:
- Headings: `##` through `######`
- Emphasis: `*italic*`, `**bold**`
- Lists: `-` or `1.`
- Links: `[text](url)`
- Code: `` `inline` `` or triple-backtick fenced
- Images: `![alt](url)` (use Cloudinary URLs from your media library)

No HTML allowed; it's stripped at render time.

### photo_360 block

Single 360° photo, standalone viewer. The learner rotates to look around.

- Pick a `photo_360` from your library (must be `ready`)
- Optional caption
- Renders as a PSV panorama inside the lesson

### video_360 block

Single 360° video, standalone viewer.

- Pick a `video_360` from your library (must be `ready`)
- Optional caption
- Publish gate requires a linked **transcript** on the media; see §2.

### video block

Standard (flat) video with Cloudinary HLS + fallback.

- Pick a `standard_video` or `drone_video` from your library (must be `ready`)
- Optional caption
- Publish gate requires a linked **transcript**.

### virtual_tour block

The big one. Pulls in every scene at a destination you own, with their hotspots and scene links, into one multi-scene navigable tour.

- Pick a **destination** (from your owned destinations)
- Optionally pick a **starting scene** (otherwise the tour starts at the destination's first scene)
- Optional caption
- Renders the full PSV tour with node transitions

If you add or remove scenes at the destination later, the block automatically reflects those changes; no need to re-edit the block.

### quiz block

Multiple-choice check, usually at the end of a lesson or section.

- **Title** (optional): heading above the quiz
- **Pass threshold (%)**: default 70. Learners see their score and a pass/fail badge on submit.
- **Questions**: one or more. Each question has:
  - Question text
  - 2–8 options, one marked as correct
  - Optional explanation shown after submit

Quiz state is session-local in Phase 1; scores aren't recorded to the DB. The pass-threshold check is for the learner's feedback, not gate-keeping the rest of the lesson.

---

## 10. Transcripts and accessibility

The publish gate (§11) enforces:

- **Every `video` and `video_360` block** → the referenced media must have a `transcript_media_id` linked (a `transcript` kind file attached in the media library).
- **Every `photo_360` and `video_360` block** → the media must be `ready` status. The 2D fallback is auto-derived by the renderer (Cloudinary `so_0` transform for video).

Transcripts are non-negotiable for public launch. If you don't have a transcript, write one and upload as a `transcript` kind file. See STYLE_GUIDE §2 for the accessibility commitment.

---

## 11. Translations

If your course's default locale is `en` and you want Spanish (or any other supported locale) learners to see translated content, you have two routes:

**Route A: CSV seed (for MUCHO and other seeded courses).**

Edit `scripts/seed-data/mucho.<locale>.csv` (or the equivalent for other courses), filling the `value` column with human translations. Then run `pnpm db:seed` locally against whichever DB you want to update. See [scripts/seed-data/README.md](../scripts/seed-data/README.md) for format.

**Route B: In-app translation editor (recommended for non-seeded courses).**

1. On the course detail page, find the **Translations** section.
2. Click **Translate to Spanish** (or whichever locale is offered).
3. A side-by-side editor opens with source on the left, translation on the right for:
   - Course title, subtitle, description
   - Each lesson's title and summary
   - Each text block's markdown
4. Save each section independently as you translate.
5. Media-block captions, virtual-tour captions, and quiz strings don't have in-app editors yet; that's a follow-up branch.

Empty translation fields fall back to the source locale automatically, so partial translations are safe.

**Per the no-AI-content rule: don't use AI to translate.** Human translators only. A poorly-translated page is worse than none.

---

## 12. Submitting a course for review

When the course looks good:

1. Go to the course detail page.
2. Scroll to the **Publish** section at the bottom.
3. Review the **Publish checklist**: green means all checks pass; amber means a violation:
   - `no_lessons`: add at least one lesson
   - `lesson_empty`: add at least one block to each lesson
   - `video_missing_transcript`: link a transcript to any video-block media in your library
   - `media_not_ready`: wait for Cloudinary processing to finish, or swap the media
   - `media_missing`: media was deleted; edit the block and pick new media
4. When clean, click **Submit for review**. Status changes to `in_review`.
5. An admin is notified. Once approved, status becomes `published` and learners can enroll.

If `reviewRequired` is false on your course (admin-only field), submit-for-review goes directly to `published` without a review step.

---

## 13. What happens after publishing

- Free courses: appear in [/en/courses](/en/courses). Anyone signed in can enroll with one click.
- Paid courses: same catalog presence, but the enroll button routes through Stripe Checkout. On successful payment, Wanderlearn creates an `enrollments` row and emails a receipt via Mailgun.
- Learners who complete every lesson in the course get a download button for a PDF certificate on the course detail page.

---

## 14. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "This 360° photo isn't available" banner | Media deleted, or status not yet `ready` | Open the block editor, swap the media |
| "This video's transcript isn't linked" warning at block edit | Publish gate blocker | Open the media library, attach a `transcript` file to the video |
| Block save spins forever and nothing happens | Network flake or auth session expired | Refresh, sign back in if prompted, retry |
| Virtual tour shows a single scene even though I have multiple | Other scenes are at a different destination, or the tour block references a destination with only one scene | Verify scenes are all at the same destination and you own all of them |
| PSV viewer shows a black screen | 360° media isn't equirectangular, or Cloudinary hasn't finished transcoding | Verify the camera's export settings; wait for `ready` status |
| Submit for review button stays disabled | Publish checklist has unresolved violations; see above table |

For anything unlisted: open a support thread at [/en/support/new](/en/support/new). Admins see it within a working day.

---

## 15. What's on the roadmap (not yet)

Honest list so you don't wait for features that haven't shipped:

- **Membership / subscription pricing**: Phase 2. Today's model is per-course only.
- **Non-text block translation**: media captions, virtual-tour captions, quiz strings. Follow-up branch.
- **Drag-to-reorder hotspots and blocks**: Phase 2.
- **Video audio descriptions**: publish-gate enforcement only after a usable audio-description track authoring flow exists.
- **Bulk media upload**: current flow is one file at a time.
- **Analytics dashboard** for creators: PostHog wiring is pending event-taxonomy decisions; no creator-facing numbers yet.
- **Separate profile / card thumbnails** for destinations and courses: today each uses one image for both detail-page hero AND narrow-card thumbnail. Post-launch polish.
- **Mixed photo+video in one tour**: a PSV architectural limit. Would require a custom adapter; not on the immediate roadmap.

Shipped recently (so you're not waiting on these):

- **Offline mode.** Service worker caches the app shell, lesson content, and Cloudinary posters; progress writes queue offline and sync on reconnect. Per-course "Save for offline" toggle on the course detail page.
- **Public shareable tour links.** Destination `public/private` toggle + `/en/tours/<slug>?scene=<id>` deep links. Branded Open Graph previews so shares look right in iMessage/Slack.
- **Scene start orientation.** Per-scene yaw/pitch you set from the editor.
- **Scene 2D poster picker.** Explicit thumbnail control per scene.
- **Media library inline preview.** Click **Preview** on any row to see the asset in the right player without leaving the page.
- **Mobile nav menu.** All nav links + sign-in + locale switcher reachable under 640px via a burger dialog.

---

## When in doubt

- Ask in the support thread.
- Don't invent features; read [plans/00-wanderlearn-phase-1-mvp.md](../plans/00-wanderlearn-phase-1-mvp.md) to see what Phase 1 actually covers.
- Don't use AI to write lesson text or translate it. Every word comes from a human who stood in the place or speaks the language. That's the differentiator.
