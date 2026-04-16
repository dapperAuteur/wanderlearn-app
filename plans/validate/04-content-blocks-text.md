# Validation — feat/content-blocks-text

Depends on `feat/courses-crud` + `feat/lessons-crud` being merged first.
Only the **text** block type lands in this branch. photo_360, video,
quiz, virtual_tour arrive in `feat/content-blocks-media` and later.

## Create

- [ ] On a lesson view page, "Add text block" button appears in the Blocks section
- [ ] Click → new-block page with Markdown textarea + help text
- [ ] Submit valid Markdown → redirect to lesson view with "Block saved" banner
- [ ] Block appears in the list at the correct order (appends to end)
- [ ] Submit empty Markdown → form rejects (required min length 1)
- [ ] Submit > 20,000 chars → form rejects (max length client + server)

## Render

- [ ] Headings (`#`, `##`, `###`) render as `<h1>`/`<h2>`/`<h3>`
- [ ] **Bold** and *italic* render correctly
- [ ] `[links](https://example.com)` render as anchors
- [ ] Code fences and inline \`code\` render as `<pre>` / `<code>`
- [ ] Lists (ordered + unordered) render properly
- [ ] GFM strikethrough `~~text~~` renders as `<del>`
- [ ] HTML injection (e.g. `<script>alert(1)</script>`) is **stripped** by DOMPurify — the allowed-tag list is enforced
- [ ] `javascript:` URLs in links are blocked (URI regex)
- [ ] Block index label (`01 · Text`, `02 · Text`) renders with zero-padded number

## Edit

- [ ] Click Edit on a text block → edit page pre-fills the Markdown textarea
- [ ] Save → redirects to lesson view with block saved banner
- [ ] Edited block shows updated HTML on the lesson view

## Delete

- [ ] Click Delete next to a block → browser confirm prompt
- [ ] Confirm → block removed, subsequent blocks' `orderIndex` shift down by 1
- [ ] Create block A, B, C → delete B → block C's orderIndex becomes 1 (was 2)

## Ownership

- [ ] Visit another creator's block by UUID → 404
- [ ] Visit a block whose lesson belongs to a different course → 404
- [ ] Visit a non-text block's edit URL (once media blocks exist) → 404

## i18n

- [ ] Switch to Spanish → block editor labels render in Spanish
- [ ] Switch back to English → labels render in English

## Accessibility

- [ ] Markdown textarea is labelled + connected to help text via `aria-describedby`
- [ ] Save / Cancel / Delete all meet 44 px tap target
- [ ] Block renderer uses `prose` styles for sane defaults
- [ ] Screen reader can navigate the rendered HTML headings
