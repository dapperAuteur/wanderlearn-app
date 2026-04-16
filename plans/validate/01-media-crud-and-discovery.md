# Validation — Plan 01: Media CRUD + Discovery

## P1 track: rename, delete, replace

### Media rename + describe

- [ ] Upload a file → library shows uploaded filename as default name
- [ ] Click Edit → rename to "MUCHO entrance hall" → Save → refresh → new name persists
- [ ] Add description "Main lobby looking south" → Save → description visible on card
- [ ] Clear name (empty) → falls back to original filename
- [ ] Name > 200 chars → server rejects, error shown inline

### Media delete

- [ ] Soft delete an unused file → disappears from library
- [ ] Create a scene using a 360° photo → try to soft delete that photo → blocked, banner shows "Scene: {name}"
- [ ] Set a destination hero → try to delete hero image → blocked, banner shows "Destination: {name}"
- [ ] Remove the scene → retry delete → succeeds
- [ ] Hard delete an unused file → confirm "permanently" → gone from library AND from Cloudinary (check Cloudinary dashboard)
- [ ] Attempt hard delete when Cloudinary is misconfigured → error message, DB row untouched

### Destination hero replace

- [ ] Edit destination → Hero Image section shows grid of ready images + 360° photos
- [ ] Select an image → "Save hero" enabled → click → view page shows banner
- [ ] Select "No hero" → save → view page banner disappears
- [ ] Upload a new image → return to destination edit → new image appears in picker
- [ ] Soft-deleted images do NOT appear in the picker

### Scene panorama replace

- [ ] View scene → Panorama picker shows ready 360° photos
- [ ] Select a different panorama → save → Photo Sphere Viewer renders new image
- [ ] Non-photo_360 assets do NOT appear in the picker
- [ ] Processing assets do NOT appear in the picker

## Phase 2 track: tags, fuzzy search

### Tags

- [ ] Edit a file → type "exterior, morning, museum" in Tags input → Save
- [ ] Tag chips ("exterior", "morning", "museum") appear on the card
- [ ] Tag filter bar appears at top of library with "All | exterior | morning | museum"
- [ ] Click "exterior" → only files tagged "exterior" shown
- [ ] Click "All" → all files shown again
- [ ] Add a duplicate tag ("exterior, exterior") → only one chip appears (dedup)
- [ ] Tag > 40 chars → server rejects
- [ ] > 25 tags → server rejects
- [ ] Tags are per-creator (other creators can't see them)

### Fuzzy search: media

- [ ] Media page shows search bar above the library
- [ ] Type partial name ("muse") → ranked results via pg_trgm similarity
- [ ] Type a description phrase → matches appear
- [ ] Type a tag value → files carrying that tag appear
- [ ] Empty query → full library shown (not just ready rows)
- [ ] Gibberish query → "No files match your search" empty state
- [ ] URL updates with `?q=...` (shareable search URLs)

### Transcript link

- [ ] Upload a transcript file (.srt, .vtt, .txt) via the uploader with kind = Transcript
- [ ] On any video card, a "Transcript" dropdown appears with the transcript(s) listed
- [ ] Select a transcript → saves immediately, persists on refresh
- [ ] Choose "— No transcript linked —" → transcriptMediaId clears
- [ ] Non-video media (image, audio, 360° photo) do NOT show the transcript dropdown
- [ ] Delete the linked transcript → warning "linked transcript was deleted" appears
- [ ] With zero transcripts in library → helper text directs user to upload one

### Fuzzy search: destinations

- [ ] Destinations page shows search bar
- [ ] Type "muce" → "Museo del Chocolate" appears (pg_trgm similarity)
- [ ] Type "newfields" → "Newfields Museum" appears
- [ ] Type city name → matching destination appears
- [ ] Type gibberish → "No destinations match your search" empty state
- [ ] Clear search → all destinations listed
- [ ] URL updates with `?q=...` (shareable search URLs)

### Performance

- [ ] 100 media rows, 10 destinations, 20 scenes → search results render < 1s in dev
- [ ] No N+1 queries (check terminal for duplicate SQL)

## Edge cases

- [ ] Offline: edit/delete buttons on library → blocked gracefully, no crash
- [ ] Concurrent edits: two tabs open on same file → both save without conflict
- [ ] File kind filter + tag filter combine correctly
