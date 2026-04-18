// Generates per-locale translation CSVs for the MUCHO course.
//
// Outputs:
// - scripts/seed-data/mucho.en.csv — always overwritten. This is the
//   authoritative English reference. `source` and `value` columns both
//   hold the English text. The seed runner ignores it (course defaultLocale
//   is "en") — it exists for translators to read alongside their target
//   locale.
// - scripts/seed-data/mucho.<locale>.csv for each non-default locale —
//   the `source` column is refreshed from the English data; the `value`
//   column is PRESERVED from any existing file so in-progress translations
//   aren't clobbered. If the file doesn't exist yet, a blank-value
//   starter is written.
//
// Run: pnpm db:gen-template
//
// When the seed content changes (scripts/seed-mucho-data.ts), re-run this
// so the translator CSVs reflect the new English source.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseCsv } from "csv-parse/sync";
import { locales } from "../src/lib/locales";
import { COURSE, LESSONS } from "./seed-mucho-data";

const SEED_DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "seed-data");

type Row = {
  kind: "course" | "lesson" | "block";
  scope: string;
  index: string;
  field: string;
  source: string;
  value: string;
};

function buildRows(): Row[] {
  const rows: Row[] = [];

  // Course fields.
  rows.push({
    kind: "course",
    scope: COURSE.slug,
    index: "",
    field: "title",
    source: COURSE.title,
    value: "",
  });
  rows.push({
    kind: "course",
    scope: COURSE.slug,
    index: "",
    field: "subtitle",
    source: COURSE.subtitle,
    value: "",
  });
  rows.push({
    kind: "course",
    scope: COURSE.slug,
    index: "",
    field: "description",
    source: COURSE.description,
    value: "",
  });

  // Per lesson.
  for (const lesson of LESSONS) {
    rows.push({
      kind: "lesson",
      scope: lesson.slug,
      index: "",
      field: "title",
      source: lesson.title,
      value: "",
    });
    rows.push({
      kind: "lesson",
      scope: lesson.slug,
      index: "",
      field: "summary",
      source: lesson.summary,
      value: "",
    });
    lesson.blocks.forEach((block, i) => {
      if (block.type === "text") {
        rows.push({
          kind: "block",
          scope: lesson.slug,
          index: String(i),
          field: "markdown",
          source: block.markdown,
          value: "",
        });
      }
    });
  }

  return rows;
}

// Minimal RFC 4180 CSV stringifier — wraps cells containing comma, quote,
// CR, or LF in double quotes and escapes quotes by doubling.
function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function stringifyCsv(rows: Row[]): string {
  const header = ["kind", "scope", "index", "field", "source", "value"].join(",");
  const body = rows
    .map((r) =>
      [r.kind, r.scope, r.index, r.field, r.source, r.value].map(csvCell).join(","),
    )
    .join("\n");
  return `${header}\n${body}\n`;
}

function readExistingValues(path: string): Map<string, string> {
  // Key: `${kind}|${scope}|${index}|${field}` → existing `value` cell.
  const map = new Map<string, string>();
  if (!existsSync(path)) return map;
  const raw = readFileSync(path, "utf8");
  const records = parseCsv(raw, {
    columns: true,
    trim: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];
  for (const r of records) {
    const key = `${r.kind}|${r.scope}|${r.index ?? ""}|${r.field}`;
    map.set(key, r.value ?? "");
  }
  return map;
}

function writeLocaleCsv(locale: string, rows: Row[]): void {
  const path = join(SEED_DATA_DIR, `mucho.${locale}.csv`);
  const isDefault = locale === COURSE.defaultLocale;

  const output = rows.map((r) => {
    if (isDefault) {
      // English reference: value mirrors source so translators can read the
      // full row without cross-referencing another file.
      return { ...r, value: r.source };
    }
    // Non-default locales: preserve any existing translation.
    const existing = readExistingValues(path);
    const key = `${r.kind}|${r.scope}|${r.index ?? ""}|${r.field}`;
    return { ...r, value: existing.get(key) ?? "" };
  });

  writeFileSync(path, stringifyCsv(output), "utf8");
  console.log(
    `  wrote ${path} (${output.length} rows)${isDefault ? " [authoritative EN reference]" : ""}`,
  );
}

function main() {
  console.log(`Generating translation templates in ${SEED_DATA_DIR}`);
  const rows = buildRows();
  // Ensure EN first (authoritative), then the rest in declaration order.
  const ordered = [...locales].sort((a, b) =>
    a === COURSE.defaultLocale ? -1 : b === COURSE.defaultLocale ? 1 : a.localeCompare(b),
  );
  for (const locale of ordered) {
    writeLocaleCsv(locale, rows);
  }
  console.log("Done.");
}

main();
