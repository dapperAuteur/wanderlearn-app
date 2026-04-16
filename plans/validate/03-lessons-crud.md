# Validation — feat/lessons-crud

Depends on `feat/courses-crud` being merged first.

## Nav + ownership

- [ ] View any of your own courses → lessons section now has a "New lesson" CTA (no more "coming soon" copy)
- [ ] Visit another creator's course by UUID → 404 (unchanged from courses branch)

## Create

- [ ] Click "New lesson" on course view → form renders with all fields (title, slug, summary, status, estimated minutes, order, free preview checkbox)
- [ ] Submit with only title → saves → redirects to lesson view with "Lesson created" banner
- [ ] Leave slug empty → server generates from title
- [ ] Submit a slug that another lesson in the same course already uses → alert shows slug-taken error
- [ ] Leave order blank → lesson appends to end (orderIndex = max + 1)
- [ ] Set order 0 → lesson is first when you return to course view
- [ ] Check "Allow free preview" → saves as true

## Course view

- [ ] Course view shows lessons ordered by orderIndex, padded to two digits (01, 02, 03…)
- [ ] Each row shows title + status pill (Draft/Published) + free-preview badge if applicable
- [ ] Click lesson title → navigates to lesson view page
- [ ] Empty lessons shows "No lessons yet" panel with New lesson CTA still above

## View

- [ ] Lesson view shows title, summary (optional), and a details panel (slug, order, status, free preview, estimated minutes)
- [ ] Estimated minutes shown as "15 min" when set; "—" when null
- [ ] Free preview row shows Yes/No
- [ ] Edit CTA navigates to edit page
- [ ] Visit a lesson by UUID that belongs to a different course → 404 (courseId check)

## Edit

- [ ] Edit page pre-fills every field with current values
- [ ] Rename title → save → lesson view and course outline update
- [ ] Change status draft → published → pill updates
- [ ] Toggle free preview on → badge appears in course outline
- [ ] Change estimated minutes → persists
- [ ] Change order → lesson moves in the course outline
- [ ] Change slug to one used by another lesson in the same course → slug-taken error
- [ ] Change slug to one used by a lesson in a different course → saves fine (per-course uniqueness)

## Delete

- [ ] Edit page has Danger zone with delete button
- [ ] Confirm → lesson removed, redirect to course view
- [ ] Cancel confirm → nothing happens

## i18n

- [ ] Switch to Spanish → all lesson labels render in Spanish
- [ ] Switch back to English → all labels render in English

## Accessibility

- [ ] Keyboard-tab through create lesson form → all fields + checkbox + buttons reachable
- [ ] Help text connected via `aria-describedby` on slug, minutes, order
- [ ] Checkbox has its full label clickable
- [ ] 44px tap targets on Save / Cancel / Delete
