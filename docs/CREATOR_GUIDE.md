# Creator Guide

How to build a Wanderlearn course end to end: media → destinations → scenes → tours → lessons → blocks → publish.

Intended audience: creators and teachers. Assumes you have a Wanderlearn account promoted to the `creator` (or `teacher`) role. If you don't, an admin has to promote you first; see [ADMIN_GUIDE.md](ADMIN_GUIDE.md) §User roles.

Prefer short task recipes over this long guide? In-app help exists at `/help`: searchable step-by-step articles with video walkthroughs for the most common creator and partner tasks. Reach it from **Help** in the top navigation, from the Help Center link in the footer, or from the round **Get help** button in the corner of any page, which offers the articles before the support form.

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
| `image` | Course cover images, destination heroes, non-360° photos | 10 MB |
| `audio` | Hotspot narration, podcast-style lesson clips | 10 MB |
| `standard_video` | Flat video for `video` blocks | 100 MB |
| `photo_360` | Equirectangular 360° stills for `photo_360` blocks or scenes | 10 MB, max 25 megapixels |
| `video_360` | Equirectangular 360° video for `video_360` blocks or scenes | 100 MB |
| `drone_video` | Aerial footage | 100 MB |
| `transcript` | .vtt or .srt file attached to a video | 10 MB |
| `screenshot` | Attachments for support threads (upload via support flow, not here) | 10 MB |
| `screen_recording` | Same; support flow | 100 MB |

**Preparing 360° video.** 100 MB is a real constraint on Insta360 X5 footage — a few minutes of 8K equirectangular runs well past it. Trim to the section you actually need and export at a lower bitrate before uploading, rather than discovering the limit after a long transfer.

**Preparing 360° stills.** Use 6K equirectangular (6144 × 3072, 18.9 MP) rather than 8K. A 2:1 image at 8K is 33.5 MP and exceeds the 25-megapixel ceiling, so it will be rejected however small the file is.

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

### Deleting a file that is in use

Wanderlearn refuses to delete a file something still points at, rather than letting a tour break quietly. When that happens the message names what is holding it, and gives you a way through instead of a dead end.

For a scene, it says which scene and **how the scene uses the file**: its panorama, its 2D poster, or its ambient sound.

- **If nothing links to that scene**, a *Delete scene "X" and this file* button appears. It removes the scene, tells you it did, and then completes the file delete you asked for. You end up back at the media list with a confirmation.
- **If the scene is connected to others**, no delete button appears, because removing it would strand the arrows pointing at it. Instead the connections are listed by name and direction, like `"Bell" → "West Crossroads"`, with a button through to that destination's Connections page. Clear them there, then delete.

If a second scene still holds the file, the remaining blockers come back with a note confirming the first one went, so you can see progress rather than wondering whether anything happened.

Destinations and courses can block a delete too, when the file is a destination hero or a course cover. Those are listed the same way; swap the image on that item first.

### Uploading without leaving the page

The Media page is not the only way in. Two places embed the same uploader, so you do not have to break your flow:

- **New scene page**: an *Upload new 360 file* panel above the panorama list, narrowed to 360 photo and 360 video.
- **Destination page**: an *Upload new files to this tour* panel in the Destination media library, with all kinds available.

Both write to the same library as the Media page. When a file reaches **Ready**, the page refreshes and the file appears in the picker below it, so you can upload and use it in one sitting. On the New scene page the file you just uploaded is selected for you as soon as it finishes processing.

Uploading from inside a destination also **assigns the file to that tour**. One exception, and it is the first upload to a brand new tour: a destination needs at least one scene before media can be assigned to it, because contributing a scene is how the app establishes that the tour is yours to manage. The panel says so when it happens, and it resolves itself the moment you create a scene from the file, since a file a scene uses counts as that tour's media regardless.

After uploading 360 files on the destination page, it offers to **create a scene from each one**, which runs the same bulk creation as the Bulk scene creator lower down. Only 360 photos and 360 videos trigger the offer.

### Organizing media by tour

Every tour (destination) has its own media library, so each site's files stay separate from every other site's. Three tools on [/en/creator/media](/en/creator/media) keep the global library organized by tour:

- **Tour filter chips** at the top of the library: **All media**, one chip per tour, and **Not in any tour**. Pick a tour to see only that tour's files; pick **Not in any tour** to find files that still need a home. The search box respects the active filter.
- **Bulk add to a tour**: select files with the checkboxes (or **Select all visible**), pick a tour from the dropdown in the toolbar, and click **Add to tour**. Files still processing, or files you don't own, are skipped and counted in the result message rather than failing the whole batch.
- **Auto-add scene media to tours**: one click promotes every panorama and poster already used in a scene into that scene's tour library. It is additive and safe to run repeatedly; duplicates are ignored. Run this once to backfill an existing account, then again any time after building scenes from unassigned files.

The per-tour view of the same library also lives on each destination's detail page under **Destination media**, where you can add or remove individual files (see §3).

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
   - **Description** (optional): short prose about the place Supports light formatting: `**bold**`, `*italic*`, `[link](https://example.com)`, and `- ` bullet lists. Nothing else renders — headings and images are stripped so cards and page hierarchy stay consistent.
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

### Choosing where the public tour starts

When a destination has two or more scenes, visitors hitting `/en/tours/<slug>` see a **scene chooser grid** before the viewer mounts — each scene gets a card with its poster, name, and caption, and clicking a card opens the tour at that scene. Single-scene destinations skip the grid and jump straight into the viewer.

By default, scenes are ordered oldest-first in the grid. The oldest scene is also the implicit "start" if a visitor uses an embed or a link without `?scene=`. That's often not the right first impression — you'd rather they land in the lobby than the parking lot.

To set a different default:

1. On the destination detail page, scroll to **Default start scene** (between **Public tour link** and **Destination media**).
2. Pick a scene from the dropdown — or leave on **Auto (oldest scene)** to keep the implicit default.
3. Click **Save**.

After saving, the chosen scene:

- Sorts **first** in the visitor's scene chooser grid and gets a **Recommended** pill.
- Becomes the default for any link that doesn't pin `?scene=<id>` — including the destination's iframe embed and OG previews.

Visitors who land via a deep link (`/en/tours/<slug>?scene=<id>`) bypass the chooser entirely and open straight at the pinned scene; the recommended default doesn't override an explicit link.

To clear the override, set the dropdown back to **Auto** and save. The grid reverts to oldest-first with no recommendation.

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

### Fixing a tilted horizon

If the tripod wasn't perfectly level — or the drone was hovering with a slight roll — the panorama will show a tilted horizon. The ground plane leans, verticals look wrong, and the tour feels unprofessional. Up to about ±5° you can correct it in-app without re-shooting.

1. On the scene detail page (`/en/creator/destinations/<dest-id>/scenes/<scene-id>`), the **Horizon rotation** panel sits right below the immersive viewer.
2. Drag the slider left or right. The viewer above updates **in real time** as you drag — the horizon tilts so you can find the right angle by eye. The numeric readout shows the exact value in degrees (−15.0° to +15.0°, in 0.1° steps).
3. Click **Save rotation** when the horizon looks level. The saved value persists for everyone viewing this scene.

If you change your mind before saving, drag back to the original angle (or click **Reset to 0°** to snap back to no correction) — nothing is written until you save.

A few notes:

- **Live preview is local.** Dragging the slider only changes the viewer on this scene's edit page. Other learners don't see your unsaved changes; the public tour shows the last saved value until you save again.
- **Range is intentional.** ±15° is the clamp. Anything beyond that is a capture problem (a tripod that fell sideways, a heavily-banked drone shot) and should be re-shot, not corrected.
- **Per-scene, not per-tour.** Each scene stores its own offset. Hopping between scenes inside the viewer applies each scene's correction independently — so a perfectly-level scene next to a tilted one will both render correct after saving the latter.
- **Hotspots and scene links rotate with the panorama.** Pin placement and link arrows you saved before correcting the horizon stay anchored to the same world point — they tilt with the ground plane. If you correct a significant tilt and a hotspot looks misplaced, re-pin it.
- **Drone video scenes:** the correction applies the same way as photo scenes. The roll is baked into the viewer's sphere correction, not into the source video file.

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

### Adding ambient sound to a scene

Every scene can carry one looping **ambient bed**: room tone, birdsong, the hum of a gallery, the sound of the place. It plays while the visitor stands there and crossfades into the next scene's sound when they walk. It is the sound of being somewhere, not a narration track.

This is a different thing from a hotspot's audio. A hotspot clip plays because the visitor clicked a marker and asked for it. An ambient bed plays because they arrived.

1. Upload the recording to your media library with kind **Audio**.
2. On the scene edit page, find the **Ambient sound** section and click **Change sound**.
3. The list opens filtered to this tour's audio, with **All my media** one click away. Each row has a player, so you can hear a file before choosing it.
4. Select one and click **Save sound**. **Remove sound** takes it back off.

Three things worth knowing:

- **Visitors hear nothing until they turn sound on.** The viewer shows a sound button only when the tour actually has audio, and it starts off. That is not timidity: browsers refuse to play audio until the visitor has interacted with the page, and the accessibility standard we publish against requires a control for any audio that runs past three seconds. The one button satisfies both.
- **Record something that loops.** A clip with a car door slam at the end will slam every thirty seconds forever. Steady room tone, thirty seconds to two minutes, is what you want.
- **Capture it on site.** The 360° camera records audio while you shoot, so you usually already have the room. This is also the honest version: it is the sound of that place, not a library sample of a place like it.

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

Scene links are one-way in the data, but you rarely create them one at a time: the Connections page's *Also create the return connection* box is ticked by default, so adding A → B gives you B → A as well. Untick it for a deliberate one-way route, like a door that only opens outward.

### Linking out to another creator's tour

A hotspot can send a visitor into a different tour entirely, but only if that tour's owner has agreed. Consent is off by default and lives in two places:

1. **Your account-wide default.** On your account page, the **External linking** section controls whether other creators may link to your destinations at all. It ships **Off**. Turn it on only if you want your tours surfaced inside someone else's experience.
2. **A per-destination override.** Each destination's edit page can override the account default in either direction, so you can open up one tour without opening up all of them.

Only destinations whose owner has opted in appear in the **Target tour** dropdown when you build a *Link to another tour* hotspot. If a tour you expected is missing from that list, the answer is almost always that its owner has not opted in, not that something is broken.

Separately, a destination can name a **next destination**: a "Continue to ..." card shown at the end of the tour. Same consent rule applies to the target.

### Handing a destination to someone else

The **Transfer your content at this destination** panel on the destination page moves the scenes you created there, and the panoramas and posters they reference, to another account.

1. The person receiving it must already have a Wanderlearn account. Transfer matches on email address and fails with "No user found with that email" if they have not signed up yet.
2. Enter their email and click **Transfer**.
3. Ownership of your scenes at that destination, and of the media those scenes use, moves to them.

Use this when a museum takes over its own tour after training, which is the case it was built for. Treat it as a one-way door: getting the content back means the new owner transferring it to you.

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
   - **Description**: longer prose, shown on the course detail page Supports light formatting: `**bold**`, `*italic*`, `[link](https://example.com)`, and `- ` bullet lists. Nothing else renders — headings and images are stripped so cards and page hierarchy stay consistent.
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

**Private preview links.** In the Public tour link section: create a preview link to show a
private tour to a client before launch (no account needed on their side). *Replace link*
invalidates every previously sent copy; *Disable* turns the door off entirely. Preview access
renders a visible "private preview" notice and is never indexed.

**Connections page.** Every path between scenes, one screen: open the destination and click
*Connections*. Adding a connection creates the return trip too unless you untick it, and new
connections are invisible to visitors until you place their arrow (the *Needs placement* chip
jumps you straight into click-to-place). Badges flag orphans (nothing leads there), dead ends
(no way out), and unreachable scenes (cannot be walked to from the start).

**Tour map.** On the same page: pick a floor-plan image (upload right there — the box only
accepts flat images) or a built-in grid/blank background, then place scenes three ways: click the
map, type exact percent fields, or select a pin and step it with the direction buttons. Selecting
a pin also lets you move it with the arrow keys (hold Shift for a bigger step), and *Previous
scene* / *Next scene* cycle the selection so you never have to hunt for a small pin. Nudges save
once you pause, not once per press. *Arrange scenes automatically* drafts a layout from your
connections — treat it as a draft on a real floor plan, because it lays scenes out by how many
doors they are from the start, not by where the rooms actually are.

Moving a pin never changes a connection. Pin position and connection are separate data, so you
can rearrange the whole map without touching a single link or arrow.
Visitors get a corner mini-map that follows them and jumps scenes on tap; scenes appear on it
only once placed. Images uploaded before dimension capture (mid-2026) need one re-upload before
they can be a map. The visitor mini-map is supplementary — keyboard and screen-reader users keep
full navigation through the scene chooser and link arrows.

**Arrival heading (per link).** A scene has one start view, but the direction a visitor
should face on arrival belongs to the route they travelled, not the room they land in.
Set it on the scene visitors arrive AT: open that scene's editor, find *How visitors
arrive here*, aim the viewer, and click *Capture current view* on the row for the scene
they came from. Unset falls back to the scene's own start view. Without this, every
route into a room faces the same way and walking a corridor backwards spins the view —
which reads as teleporting. See the in-app article at `/help/set-arrival-view`.

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

## 9b. Hunts: turning a tour into a game

A **hunt** is an ordered path through a destination's scenes that a visitor plays. Each stop stays shut until it is opened, and you choose how: freely once the previous stop is done, by typing a right answer, by holding a key found elsewhere, or by physically standing in the place.

Open it from the **Hunts** button on a destination, between *Connections* and *New scene*. You need at least one scene first, because every stop sits in a scene.

### Building one

1. Under **New hunt**, give it a title and an introduction, then **Create hunt**.
2. **Add a stop**: a title, the scene the visitor is standing in, a **Clue** (shown before it opens) and a **Reveal** (shown after). The Reveal is where the teaching goes.
3. Pick **How it opens**. An answer stop takes a comma-separated list of accepted answers, and case, accents and stray spaces are already forgiven. A key stop takes required keys. An arrival stop takes an **Unlock radius (metres)**, default 40.
4. Every stop, whatever kind, can **grant a key** when it opens.
5. Reorder with **Move up** / **Move down**. Order is load-bearing: a key only counts as obtainable if something *earlier* grants it, so moving a stop can make a working hunt unfinishable.

### The publish gate

**Before you publish** separates errors from warnings. Errors mean a visitor cannot finish and they hold the Publish button down: no stops, an arrival stop whose scene has no coordinates, or a stop needing a key nothing earlier grants. Warnings never block: a radius under 25 m, a scene reused by two stops, an arrival stop with the remote fallback off.

The second badge, **Playable anywhere** or **On site**, is derived from the stops rather than set by you, so it can never promise something the stops contradict.

### Location, and what leaves the visitor's phone

This is the part institutions ask about, so it is worth stating exactly.

The visitor's position is read by their own browser, on their own device, and only after they press **Use my location**. The distance to the stop and the decision about whether they are close enough are both computed in the page. When a stop opens, the request carries the hunt ID, the stop ID, an opaque random token, the typed answer if there was one, and a flag if the remote fallback was used. **There is no latitude or longitude field in that request, and no column in the database could hold one.**

Two honest consequences: someone could record an unlock without walking anywhere, which is the right trade for a teaching game and the wrong one for a prize; and because no position is stored, there can be no trail, heatmap, or report of how close people got.

The radius is widened by the phone's own accuracy estimate rather than ignoring it, which is why 40 m is the default and anything under 25 m warns. Consumer GPS is routinely 5 to 20 m out, worse between tall buildings.

**Leave the remote fallback on.** It is in Hunt settings, on by default, and it is an accessibility setting: with it off, nobody with a mobility limitation and nobody outside the area can finish.

### Keys, and what you can actually set today

Keys are one mechanic behind three shapes: an **easter egg** is a hotspot hidden until the visitor holds a key, a **locked door or maze** is a scene link that renders no arrow until they do, and a **clue chain** is one hidden thing granting a key that opens a gate elsewhere. Locked things are absent rather than greyed out.

**Today you can only set keys on hunt stops.** The viewer honours keys on hotspots and scene links and the publish checks already expect them, but the hotspot editor has no key fields, so easter eggs and locked doors cannot be switched on from the studio yet. Plan around stop-to-stop chains until that lands.

Keys are not security. Gating on links is deliberately not enforced server-side, because a hunt is a game and someone reading the page source can reach a locked scene. Anything that genuinely must not be reachable belongs behind the destination's privacy controls.

### Sharing a hunt

Nothing links to it automatically. A published hunt lives at the tour's address plus `/hunt/` and its slug, and the slug is frozen at creation, so renaming the hunt does not change the URL. The destination must be public: a hunt on a private tour returns Not found even for someone holding a preview link.

---

## 10. Transcripts and accessibility

The publish gate (§11) enforces:

- **Every `video` and `video_360` block** → the referenced media must have a `transcript_media_id` linked (a `transcript` kind file attached in the media library).
  Why it is a gate and not a nag: without a transcript, deaf and hard-of-hearing visitors cannot use the video at all. See [Why transcripts matter](TRANSCRIPTS.md) for the full case, including what a transcript does for search and for translation cost.
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
- **Analytics dashboard** for creators: tour, scene, hotspot, and share events are captured, but there is no creator-facing dashboard yet — the numbers live in PostHog and only admins can see them.
- **Mixed photo+video in one tour**: a PSV architectural limit. Would require a custom adapter; not on the immediate roadmap.
- **Keys on hotspots and scene links**: the tour viewer already honours them and the hunt publish checks already expect them, but there are no fields for them in the hotspot or scene-link editors. So easter eggs and locked doors cannot be switched on from the studio yet. Stop-to-stop key chains inside a hunt do work. See §9b.
- **Inline upload in the scene editor**: the New scene page and the destination media library both have an uploader; *Change panorama* and *Change poster* on the scene edit page still do not.

Shipped recently (so you're not waiting on these):

- **Default start scene per destination.** Pick which scene the public tour opens on; visitors see a scene-chooser grid before the viewer when there are 2+ scenes. See §3.
- **Horizon rotation per scene.** Slider to correct tilted panoramas without re-shooting. ±15° range, applied via PSV sphere correction. See §4.
- **Offline mode.** Service worker caches the app shell, lesson content, and Cloudinary posters; progress writes queue offline and sync on reconnect. Per-course "Save for offline" toggle on the course detail page.
- **Public shareable tour links.** Destination `public/private` toggle + `/en/tours/<slug>?scene=<id>` deep links. Branded Open Graph previews so shares look right in iMessage/Slack.
- **Scene start orientation.** Per-scene yaw/pitch you set from the editor.
- **Scene 2D poster picker.** Explicit thumbnail control per scene.
- **Media library inline preview.** Click **Preview** on any row to see the asset in the right player without leaving the page.
- **Mobile nav menu.** All nav links + sign-in + locale switcher reachable under 640px via a burger dialog.
- **Bulk media upload.** Up to 5 files per batch, 10 for admins, with Insta360 `.insp` and `.insv` detected and rewrapped automatically. See §2.
- **Separate hero and profile images.** Destinations and courses carry a wide hero for the detail page and a separate square-ish image for narrow cards, each with its own picker. See §3.
- **Connections page.** The whole scene graph on one keyboard-accessible screen, with return links created by default and orphan / dead-end / unreachable badges. See §6.
- **Tour map.** A floor plan per destination with numbered scene pins, placed by click, percent field, or arrow buttons and arrow keys, plus a you-are-here mini-map for visitors. See §6.
- **Hunts.** Ordered stops through a tour that open freely, on a typed answer, on keys, or on the visitor arriving in person, with publish checks that block an unfinishable hunt. See §9b.
- **Ambient sound per scene.** A looping bed that crossfades as visitors walk, off until they press the sound button. See §4.
- **Upload without leaving the page.** Uploaders on the New scene page and the destination media library. Files uploaded inside a destination are assigned to it, the New scene form selects the file you just uploaded, and the destination page offers to create a scene from each new 360 file. See §2.

---

## When in doubt

- Ask in the support thread.
- Don't invent features; read [plans/00-wanderlearn-phase-1-mvp.md](../plans/00-wanderlearn-phase-1-mvp.md) to see what Phase 1 actually covers.
- Don't use AI to write lesson text or translate it. Every word comes from a human who stood in the place or speaks the language. That's the differentiator.
