# 01 — Media CRUD + Discovery (search, tags, names)

> Status: **Backlog**. Split into two tracks — the **P1-blocking** track lands before MVP launch (2026-06-11); the **post-launch** track lands in Phase 2.
> Parent plan: [00-wanderlearn-phase-1-mvp.md](00-wanderlearn-phase-1-mvp.md). Supersedes nothing.

## 1. Context

The MVP's media library today is a single flat list of uploads, keyed by Cloudinary public ID. Creators can't rename files, can't delete bad uploads, and can't tell two similar 360 panoramas apart without opening them. Destinations and scenes have the same "just a list" problem — fine at 5 rows, unusable at 50. PRD amendments call for creator tooling to scale past a single flagship course, and BAM flagged this directly after building the MUCHO seed.

Two distinct problems that share infrastructure:

1. **CRUD gaps** — no rename, no delete, no replace, no link-to-destination affordance. These block launch because creators can't fix their own mistakes mid-build.
2. **Discovery** — fuzzy search, tagging, filtering, sort. These don't block launch (MUCHO has ~30 assets total) but become painful fast as the library grows. Post-launch work.

## 2. Scope

### In — P1-blocking (before 2026-06-11)

- **Display name on media** — optional human-readable label, editable from the library row. Defaults to the uploaded filename on upload.
- **Description on media** — optional longer text, shown on hover / detail.
- **Delete media** — soft delete by default (sets `media_assets.status = 'deleted'`), hard delete from Cloudinary on confirm-twice. Blocks deletion if the asset is referenced by a live scene/destination/lesson (shows which).
- **Replace media on a destination / scene** — swap the `heroMediaId` / `panoramaMediaId` pointer without recreating the destination or scene. Old asset stays (or is deleted on confirm).
- **Library row UI** — name, kind badge, size, thumbnail (for images / 360 photos / video posters), created date, edit + delete buttons. Mobile-first, keyboard-operable, WCAG 2.1 AA.
- **Dictionary entries** in EN + ES for every label, button, confirm prompt, and error.

### In — Post-launch (Phase 2)

- **Tags on media** — free-form tag list per asset (`{ "jungle", "exterior", "morning" }`). Stored as `text[]` on `media_assets`. Creator-scoped, not shared across users.
- **Fuzzy search on media** — search by name, description, tag, filename, kind. Uses `pg_trgm` GIN index (no external search service).
- **Fuzzy search on destinations** — name, slug, city, country, description.
- **Fuzzy search on scenes** — name, caption, parent destination name.
- **Filters + sort** — filter media library by kind, status, tag, date range; sort by created / name / size.
- **Destinations/scenes list UI** — pagination or infinite scroll when >20 rows. Visual card grid alternative to the current list.
- **Global creator search** — one search bar in the creator nav that searches across destinations, scenes, and media.

### Out

- Full-text search across course content, lesson transcripts, or learner-facing catalog (that's a separate plan — learner-side discovery, not creator tooling).
- Cross-creator shared tag taxonomies.
- AI-generated tags, captions, or descriptions (violates no-AI-content rule).
- Bulk operations (bulk tag, bulk delete, bulk move) — if creators ask for it post-launch, add a `02-media-bulk-ops.md` plan.
- Version history on media (replace-in-place is destructive).

## 3. Data model changes

### P1 track

```ts
// src/db/schema/media.ts — additions to mediaAssets
displayName: text("display_name"),        // null → fall back to metadata.filename
description: text("description"),
deletedAt: timestamp("deleted_at", { withTimezone: true }),  // soft delete
```

Add `"deleted"` to the `mediaStatus` enum. Update `listMediaForOwner` to filter out soft-deleted rows by default, with an `includeDeleted` flag for an admin "trash" view later.

### Phase 2 track

```ts
// src/db/schema/media.ts — additions
tags: text("tags").array().notNull().default(sql`'{}'`),
searchVector: ...  // optional — pg_trgm uses GIN on expression, not a stored column
```

Migration adds:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX media_assets_name_trgm ON media_assets USING gin (display_name gin_trgm_ops);
CREATE INDEX media_assets_desc_trgm ON media_assets USING gin (description gin_trgm_ops);
CREATE INDEX media_assets_tags_gin ON media_assets USING gin (tags);
-- Same pattern for destinations and scenes:
CREATE INDEX destinations_name_trgm ON destinations USING gin (name gin_trgm_ops);
CREATE INDEX scenes_name_trgm ON scenes USING gin (name gin_trgm_ops);
```

`pg_trgm` is available on Neon. Query shape: `WHERE display_name % $1 OR display_name ILIKE $1 || '%' ORDER BY similarity(display_name, $1) DESC`.

## 4. API / server actions

### P1 track

- `updateMedia({ id, displayName?, description? })` — server action, zod-validated, owner-scoped.
- `deleteMedia({ id, hardDelete })` — server action. Soft delete sets `deletedAt` + `status='deleted'`. Hard delete calls Cloudinary `api.delete_resources([publicId], { resource_type })` then removes the DB row. Refuses if any `scenes.panorama_media_id`, `destinations.hero_media_id`, or `content_blocks.media_id` reference it — returns the blockers so the UI can show "used by: scene X, lesson Y".
- `replaceDestinationHeroMedia({ destinationId, mediaId })` — updates `destinations.hero_media_id`. No new file upload path; the caller already picked an existing asset.
- `replaceScenePanorama({ sceneId, mediaId })` — same shape, updates `scenes.panorama_media_id`. Requires the new asset to be `kind='photo_360' AND status='ready'`.

### Phase 2 track

- `updateMediaTags({ id, tags })`.
- `searchMedia({ query, kinds?, tags?, limit, offset })` — returns `{ rows, total }`.
- `searchDestinations({ query, limit })`, `searchScenes({ query, destinationId?, limit })`.
- Global creator search endpoint aggregates all three with a unified result shape (`{ type, id, name, href, snippet }`).

## 5. UI / UX

### P1 track

- **Media library row** — gains a thumbnail (for image / photo_360 / video kinds via Cloudinary delivery URL), an inline-editable name (click-to-edit pattern, Enter to save, Escape to cancel), description shown on hover for pointer users and always visible on mobile under the name.
- **Media detail panel** (or modal) — full-size preview, all metadata, edit name/description, tags placeholder for Phase 2, danger-zone delete.
- **Delete flow** — first click shows "Delete this file? It will be hidden but can be recovered for 30 days." Second click on a "Delete permanently" button triggers hard delete. Reference-blocker banner if any live content uses it.
- **Replace on destination** — edit destination page gains a "Hero media" picker: grid of ready images/photo_360s, filtered to owner's library. "None" option. Save writes new `heroMediaId`.
- **Replace on scene** — scene edit page gains same picker filtered to `photo_360`, `status='ready'`.

### Phase 2 track

- **Search bar** at the top of `/creator/media`, `/creator/destinations`, `/creator/destinations/[id]` (scenes), with 150 ms debounce and results highlighting.
- **Tag chips** on media cards. Tag editor in the detail panel: text input with comma/Enter to split, backspace to remove last.
- **Filter sidebar** on media library: kind checkboxes, status dropdown, tag multi-select, sort selector.
- **Empty-state hints** — "Try a shorter query" when fuzzy match returns nothing.
- **Mobile** — filter sidebar becomes a bottom sheet. Search bar is sticky at the top of the list.

## 6. Accessibility / mobile / offline

- Every new input/button has a visible label, min 44×44 tap target, focus ring, screen-reader name.
- Delete confirm uses a real `<dialog>` with focus trap, not a `window.confirm`.
- Inline edit: click-to-edit also works with Enter/F2 from keyboard focus, same as the accessibility pattern in section 8 of the style guide.
- Search results list uses `aria-live="polite"` to announce count changes.
- All server actions return `Result<T>` and render error states inline, not via `alert()`.
- Offline: library rows read from IndexedDB cache when offline; edits go through the outbox. Delete is blocked offline (too dangerous to queue).
- Search is server-side only — no client bundle bloat from a fuzzy-search lib.

## 7. Verification

P1 track:

1. Upload a file → library shows filename as default name → rename it → refresh → new name persists.
2. Upload two near-identical 360 photos → give each a distinct name + description → they're visibly distinguishable.
3. Add a photo_360 to a scene → try to delete the photo from the library → delete is blocked, blocker shows "Scene: {name}".
4. Create a destination with hero A → edit destination → swap hero to B → old hero A still exists in library → delete hero A → works, because the destination now points to B.
5. Hard-delete a file → Cloudinary API confirms removal → row gone from DB.
6. Axe-playwright + pa11y-ci clean on `/creator/media` and `/creator/destinations/[id]/edit`.
7. iPhone SE viewport: all rename/delete/replace actions reachable, keyboard operable.
8. EN + ES dictionaries complete.

Phase 2 track:

1. `pg_trgm` extension enabled on Neon branch → migration applies cleanly.
2. Type "muce" into media search → "Museo del Chocolate hero" ranks first.
3. Tag 10 images with `"exterior"` → filter by that tag → only those 10 appear.
4. Global search "choc" → returns destination, scenes, and media rows under separate headings.
5. Search perf: 1 000 media rows, 100 destinations, 500 scenes — p95 query < 150 ms on Neon free tier.

## 8. Build sequence

Each row = one branch + one PR.

| Track | Branch | What lands |
|---|---|---|
| P1 | `feat/media-rename-and-delete` | `displayName`, `description`, `deletedAt`, soft + hard delete with reference-blocker check, library row UI, dictionary. |
| P1 | `feat/destination-and-scene-media-replace` | Hero picker on destination edit, panorama picker on scene edit, both replace pointers in place. |
| P2 | `feat/media-tags` | Tags array, tag editor in detail panel, tag filter on library. |
| P2 | `feat/pg-trgm-fuzzy-search` | Extension + GIN indexes on media/destinations/scenes, server search endpoints, per-page search bars. |
| P2 | `feat/creator-global-search` | Unified search bar in creator nav, aggregated results page, keyboard shortcut (`/` focuses). |

## 9. Dependencies + assumptions

- Neon Postgres supports `pg_trgm` — verified, it's in the default shared_preload_libraries on Neon.
- Cloudinary admin API credentials already live (reuses `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`).
- No new npm deps — fuzzy search is 100 % database-side.
- `listMediaForOwner` already exists; extending it is cheap.
- Soft-delete semantics do not conflict with the existing `mediaStatus` enum (`uploading | processing | ready | failed`) — we add `"deleted"` as a fifth value.

## 10. Memory to save on approval

- **Feedback** — Fuzzy search across creator surfaces uses Postgres `pg_trgm`, not an external search service or a client-side lib. Keeps the stack small and the bundle lean.
- **Project** — Media CRUD (rename/delete/replace) is P1-blocking for MVP; discovery (search/tags/filters) is Phase 2. Do not collapse them into one branch.
- **Project** — Delete flow is always soft-first, with a reference-blocker check against scenes/destinations/content_blocks before hard delete.
