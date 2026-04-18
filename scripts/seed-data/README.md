# MUCHO seed translations — CSV format

Human-translated strings for the MUCHO flagship course, keyed by
locale. Drop one CSV per locale in this folder, re-run `pnpm db:seed`,
and the seed script upserts the rows into `course_translations`,
`lesson_translations`, and `content_block_translations`.

**No AI translation.** This folder exists so human translators (or you,
BAM) can contribute content without touching code. Empty value cells
are skipped — so partial files are fine; re-run after each fill-in.

## File naming

`scripts/seed-data/mucho.<locale>.csv`

Examples: `mucho.es.csv`, `mucho.it.csv`, `mucho.pt.csv`, `mucho.fr.csv`.
The locale is the two-letter code that matches the `lang` segment in
URLs. Only `en` and `es` are wired into the app today (see
`src/lib/locales.ts`), but dropping more CSVs here is harmless —
additional locales will activate when they're added to the allow-list.

## Getting the English reference

Run `pnpm db:gen-template` to generate (or regenerate) the English
reference and the per-locale templates from the authoritative seed
data in `scripts/seed-mucho-data.ts`:

- `mucho.en.csv` — always overwritten. The `source` and `value`
  columns both hold the English text. This is the file a translator
  reads to see what needs translating.
- `mucho.<locale>.csv` for every non-default locale — the `source`
  column is refreshed from the English data; the `value` column is
  preserved if the file already exists, so in-progress translations
  are never clobbered.

Re-run `pnpm db:gen-template` whenever you change
`scripts/seed-mucho-data.ts` so the translator CSVs reflect the new
English source.

## Columns

Every row has **six** columns, in order:

| # | Column | Required | Values |
|---|---|---|---|
| 1 | `kind` | yes | `course` / `lesson` / `block` |
| 2 | `scope` | yes | For `course`: the course slug. For `lesson` + `block`: the lesson slug |
| 3 | `index` | yes for `block`; empty otherwise | 0-based block position within the lesson |
| 4 | `field` | yes | See per-kind field list below |
| 5 | `source` | yes (generated) | The English text. **Reference only — the loader ignores this column.** Exists so translators can read the source alongside. |
| 6 | `value` | yes | The translated text. Multi-line is fine — wrap the cell in `"..."` and double any literal `"` as `""` |

### Fields per kind

| kind | allowed fields |
|---|---|
| `course` | `title`, `subtitle`, `description` |
| `lesson` | `title`, `summary` |
| `block` (text) | `markdown` |

Other block types (photo_360, video, video_360, virtual_tour, quiz)
aren't in the MUCHO seed today. When they are, this table will grow.

## Rules

- **Empty `value` = skipped.** Use that to leave strings untranslated.
  The learner sees the English base text for any skipped field. No
  warnings.
- **`source` is ignored by the loader.** Translators use it for
  reference. Editing it has no effect on the DB — only `value` is
  imported.
- **Locale matches `defaultLocale` is skipped.** `mucho.en.csv` is a
  reference template; `pnpm db:seed` doesn't import it because the
  course's default locale is already English.
- **Unknown slugs are skipped with a warning.** Typo a lesson slug and
  you'll see `WARN: unknown lesson slug …` in the seed output — the row
  is ignored, not fatal.
- **Block index must match a real block.** If a lesson has 1 block and
  you reference `index=1`, the row is skipped with a warning.
- **Seed is idempotent.** Running it twice is safe. Removing a row from
  the CSV does NOT delete the DB translation — that's by design, so a
  partially-filled CSV doesn't accidentally erase prior work. Delete
  the row directly from the DB if you need to remove a translation.
  (A future `--prune` flag could change this.)
- **Quoting.** Use standard RFC 4180 CSV quoting. Excel, Google Sheets,
  Numbers, and LibreOffice all handle this correctly on export.

## Example (first few rows of `mucho.es.csv`)

```csv
kind,scope,index,field,source,value
course,mucho-museo-del-chocolate,,title,MUCHO Museo del Chocolate,MUCHO Museo del Chocolate
course,mucho-museo-del-chocolate,,subtitle,"A walk through cacao's 3,500-year journey…","Un recorrido por los 3,500 años del cacao…"
lesson,the-olmec-origin,,title,The Olmec origin,El origen olmeca
block,the-olmec-origin,0,markdown,"## Cacao is a forest tree

*Theobroma cacao* — ""food of the gods"" — evolved…","## El cacao es un árbol de bosque

*Theobroma cacao* — 'alimento de los dioses' — evolucionó…"
```

## Workflow

1. Run `pnpm db:gen-template`. This refreshes `mucho.en.csv` (the
   reference) and every `mucho.<locale>.csv` (adds new rows, updates
   `source`, keeps your existing `value` cells).
2. Open `mucho.<locale>.csv` in a spreadsheet. Translate each `value`
   cell. Leave `source` alone.
3. Save as CSV. Re-run `pnpm db:seed`.
4. Visit `/<locale>/courses/mucho-museo-del-chocolate` to verify the
   translation is live.

Translators never touch the TypeScript code. Editors never touch the
CSV — they use the creator UI once it ships in the next branch.
