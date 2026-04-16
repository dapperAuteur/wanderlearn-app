# Validation — feat/courses-crud

Covers the first slice of plan 00 §13 Week 5 (course layer). Lessons
and content blocks are a follow-up branch; this only validates the
course record itself.

## Nav

- [ ] Sign in as a creator → header shows **My courses** (between logo and Destinations)
- [ ] Sign in as a learner → header does NOT show My courses
- [ ] Click My courses → lands on `/creator/courses`

## Create

- [ ] Empty state shows "haven't created any courses yet" copy + New course CTA
- [ ] New course page renders all fields (title, slug, subtitle, destination picker, price, default language, description)
- [ ] Submit with only required fields (title) → saves → redirects to view page with "Course created" banner
- [ ] Leave slug empty → server generates slug from title
- [ ] Submit with a slug that already exists → alert shows "A course with that slug already exists"
- [ ] Price field accepts decimals (e.g. 9.99) → stored correctly as cents
- [ ] Destination picker lists all destinations → "None" option saves with `destinationId = null`

## View

- [ ] View page shows title, subtitle, description
- [ ] Description with newlines preserves line breaks (whitespace-pre-wrap)
- [ ] Empty description shows italic "No description yet" fallback
- [ ] Details panel shows slug, status, price, default language, destination link
- [ ] Destination link navigates to the destination view page
- [ ] Price 0 shows as "Free"
- [ ] Price > 0 shows as "USD 9.99" format
- [ ] Status pill reads "Draft" for new courses
- [ ] Edit details CTA navigates to edit page

## Edit

- [ ] Edit page pre-fills every field with current values
- [ ] Change title → save → view page heading updates
- [ ] Change price to a different value → persists as cents
- [ ] Change default language → persists
- [ ] Swap destination → view page destination link updates
- [ ] Clear destination (pick None) → view page shows "No destination" fallback
- [ ] Cancel → returns to course list without saving

## Delete

- [ ] Edit page has Danger zone with delete button
- [ ] Click delete → browser confirm prompt with course name substitution
- [ ] Confirm → course gone from list → redirect to `/creator/courses`
- [ ] Cancel confirm → nothing happens

## Auth + ownership

- [ ] Visit `/creator/courses` as learner → redirected to home (role check)
- [ ] Visit another creator's course by UUID → 404 (creatorId mismatch)
- [ ] Visit non-existent course → 404

## i18n

- [ ] Switch to Spanish → all course labels render in Spanish
- [ ] Switch back to English → all labels render in English

## Accessibility

- [ ] Keyboard tab through new course form → all fields + buttons reachable
- [ ] Required fields have `required` attribute
- [ ] Slug help text is connected via `aria-describedby`
- [ ] Focus ring visible on all form inputs + buttons
- [ ] Min 44px tap target on Save + Cancel + Delete
