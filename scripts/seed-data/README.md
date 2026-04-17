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

## Columns

Every row has exactly **five** columns, in order:

| # | Column | Required | Values |
|---|---|---|---|
| 1 | `kind` | yes | `course` / `lesson` / `block` |
| 2 | `scope` | yes | For `course`: the course slug. For `lesson` + `block`: the lesson slug |
| 3 | `index` | yes for `block`; empty otherwise | 0-based block position within the lesson |
| 4 | `field` | yes | See per-kind field list below |
| 5 | `value` | yes | The translated text. Multi-line is fine — wrap the cell in `"..."` and double any literal `"` as `""` |

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
kind,scope,index,field,value
course,mucho-museo-del-chocolate,,title,MUCHO Museo del Chocolate
course,mucho-museo-del-chocolate,,subtitle,"Un recorrido por los 3,500 años del cacao…"
course,mucho-museo-del-chocolate,,description,"El cacao es más antiguo que el chocolate…"
lesson,the-olmec-origin,,title,El origen olmeca
lesson,the-olmec-origin,,summary,"Dónde empezó realmente la domesticación…"
block,the-olmec-origin,0,markdown,"## El cacao es un árbol de bosque

*Theobroma cacao* — 'alimento de los dioses' — evolucionó…"
```

## Workflow

1. Duplicate the existing EN content from `scripts/seed-mucho.ts` into
   a spreadsheet with the 5 columns above.
2. Translate each value cell.
3. Export as CSV, save as `scripts/seed-data/mucho.<locale>.csv`.
4. Run `pnpm db:seed` (or `SEED_CREATOR_EMAIL=… pnpm db:seed` on a
   fresh machine).
5. Visit `/<locale>/courses/mucho-museo-del-chocolate` to verify.

Translators never touch the TypeScript code. Editors never touch the
CSV — they use the creator UI once it ships in the next branch.
