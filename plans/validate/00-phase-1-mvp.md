# Validation — Plan 00: Phase 1 MVP

Run after each staging deploy and before every public push.

## Auth + identity

- [ ] Sign up with email/password → user created, role = learner
- [ ] Sign in with existing credentials → session created, header shows user name + sign-out
- [ ] Sign out → session destroyed, header shows sign-in link
- [ ] Promote user to creator via `pnpm db:promote <email> creator` → creator nav items appear
- [ ] Promote to admin → admin nav item appears
- [ ] Visit `/en/creator/destinations` as learner → redirected to home (not 404)
- [ ] Birth-year age gate: enter year making user < 13 → "must be at least 13" error

## Creator: media library

- [ ] Upload an image → library shows file with "Uploading… → Ready" status progression
- [ ] Upload a 360° photo → ready state, thumbnail visible
- [ ] Upload a video (.mp4, .mov, .lrv) → ready state, poster thumbnail visible
- [ ] Upload a transcript (.srt / .vtt / .txt) → ready state, no thumbnail
- [ ] Edit a file: rename, add description → refresh → changes persist
- [ ] Add tags (comma separated) → tag chips appear on card, tag filter bar appears at top
- [ ] Filter by tag → only matching files shown; click "All" → all shown again
- [ ] Soft delete a file → file disappears from library
- [ ] Try to delete a file used by a scene → blocker banner shows scene name
- [ ] Hard delete an unused file → confirm prompt → file removed from library AND Cloudinary

## Creator: destinations

- [ ] Create a new destination with name, slug, country, city, lat, lng, website, description → saved, view page shows all fields
- [ ] Negative coordinates → displayed with minus sign (not N/S/E/W)
- [ ] Edit destination → change name → save → breadcrumb and heading update
- [ ] Set hero image via picker on edit page → view page shows 16:9 banner
- [ ] Remove hero (select "No hero") → view page no longer shows banner
- [ ] Delete destination → removed from list, no orphan scenes remain
- [ ] Search destinations by name → matching rows appear
- [ ] Search by city/country → matches appear
- [ ] Clear search → all destinations listed again
- [ ] Empty search with no destinations → empty-state text (not "no results")

## Creator: scenes

- [ ] Create scene → pick a 360° photo → scene view shows panorama in Photo Sphere Viewer
- [ ] Panorama missing (photo processing or deleted) → warning banner, no crash
- [ ] Swap panorama via picker on scene page → viewer updates after save + refresh
- [ ] Delete scene → removed from destination's scene list

## i18n

- [ ] Switch to Spanish → all creator strings render in Spanish
- [ ] Switch back to English → all strings render in English
- [ ] URL changes between `/en/...` and `/es/...`

## Routing + SEO

- [ ] Visit `/` → redirects to `/en/` (or user's locale)
- [ ] Visit `/en/` → landing page renders
- [ ] Visit `/fr/...` → 404 (invalid locale)
- [ ] Visit non-existent page → 404 page with nav header/footer
- [ ] Creator pages return `robots: noindex, nofollow` in metadata
- [ ] Public pages return canonical URL + hreflang alternates

## Mobile

- [ ] iPhone SE viewport (320px): all pages scrollable, no horizontal overflow
- [ ] All buttons + links ≥ 44px tap target
- [ ] Media library grid collapses to 1 column on mobile

## Accessibility

- [ ] Keyboard tab through media library → all edit/delete buttons reachable
- [ ] Screen reader announces upload progress, save success, delete confirm
- [ ] Focus ring visible on all interactive elements in both light and dark mode
- [ ] No `axe-playwright` violations on `/en/creator/media` and `/en/creator/destinations`
