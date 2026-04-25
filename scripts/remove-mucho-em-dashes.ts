// One-off cleanup that removes em-dashes from already-seeded MUCHO course
// rows. Runs verbatim text replacements in three tables — courses,
// lessons, content_blocks — plus their translations. Pairs match the
// edits in scripts/seed-mucho-data.ts so DB rows align with the new
// source.
//
// Idempotent. Re-running produces the same result; rows that already
// match the post-state are untouched.
//
// Run against PROD (carefully):
//   DATABASE_URL='<prod-neon-url>' pnpm tsx scripts/remove-mucho-em-dashes.ts
//
// Or against dev to verify first:
//   DATABASE_URL='<dev-neon-url>' pnpm tsx scripts/remove-mucho-em-dashes.ts

import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required. Pass it inline.");
  process.exit(1);
}

// Each pair: [before-text, after-text]. Order matters only when one
// pair's before is a substring of another's; here they don't overlap,
// so order is irrelevant.
const REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  // Course subtitle + description
  ["journey — from Olmec ritual", "journey, from Olmec ritual"],
  [
    "the full arc — from single-origin beans to finished bars — and MUCHO",
    "the full arc (from single-origin beans to finished bars), and MUCHO",
  ],

  // Lesson summaries
  [
    "actually began — and what changed",
    "actually began, and what changed",
  ],
  [
    "tribute, and — briefly — a spendable",
    "tribute, and (briefly) a spendable",
  ],
  [
    "planning a visit — hours, workshops",
    "planning a visit: hours, workshops",
  ],

  // Lesson 1 body
  [
    '*Theobroma cacao* — "food of the gods" — evolved',
    '*Theobroma cacao* ("food of the gods") evolved',
  ],
  [
    "That pattern — cacao-as-beverage — held",
    "That pattern (cacao-as-beverage) held",
  ],
  ["no chocolate — just a bitter", "no chocolate. Just a bitter"],

  // Lesson 2 body
  ["**tribute goods** — flowing", "**tribute goods**: flowing"],
  ["to aerate it — a technique", "to aerate it, a technique"],

  // Lesson 3 body — bean-to-bar list + tasting checklist
  [
    "**Tago** — Mexico City — works with Chiapanecan",
    "**Tago**, Mexico City: works with Chiapanecan",
  ],
  [
    "**Qachoco** — Oaxaca — emphasises native",
    "**Qachoco**, Oaxaca: emphasises native",
  ],
  [
    "**Le Caméléon** — Mexico City — French technique",
    "**Le Caméléon**, Mexico City: French technique",
  ],
  [
    "**Rózsavölgyi Csokoládé** — (Hungarian",
    "**Rózsavölgyi Csokoládé** (Hungarian",
  ],
  ["**Snap** — a clean break", "**Snap**: a clean break"],
  [
    "**Aroma at body temp** — warm the bar",
    "**Aroma at body temp**: warm the bar",
  ],
  ["**Finish** — should fade long", "**Finish**: should fade long"],
  [
    "**No waxy mouthfeel** — that's cocoa",
    "**No waxy mouthfeel**: that's cocoa",
  ],

  // Lesson 4 body — visit plan + pair-with list
  [
    "**Olmec-to-Aztec** room (ground floor) — ceremonial",
    "**Olmec-to-Aztec** room (ground floor): ceremonial",
  ],
  [
    "**tasting room** (upper floor) — small, free",
    "**tasting room** (upper floor): small, free",
  ],
  [
    "**history-of-the-bar** hallway — the European",
    "**history-of-the-bar** hallway: the European",
  ],
  [
    "**workshop space** (if a session is running) — public",
    "**workshop space** (if a session is running): public",
  ],
  [
    "**Dulcería de Celaya** — 19th-century",
    "**Dulcería de Celaya**: 19th-century",
  ],
  [
    "**La Ciudadela market** — walkable",
    "**La Ciudadela market**: walkable",
  ],
];

async function main() {
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  let totalChanges = 0;

  console.log(
    `Applying ${REPLACEMENTS.length} em-dash replacements across MUCHO content…`,
  );

  for (const [before, after] of REPLACEMENTS) {
    // Track per-pair changes for visibility.
    let pairChanges = 0;

    // 1. courses (subtitle, description)
    const courseRes = await db.execute(sql`
      UPDATE courses
      SET subtitle = REPLACE(subtitle, ${before}, ${after}),
          description = REPLACE(description, ${before}, ${after}),
          updated_at = now()
      WHERE subtitle LIKE ${`%${before}%`} OR description LIKE ${`%${before}%`}
    `);
    pairChanges += Number(courseRes.rowCount ?? 0);

    // 2. course_translations (subtitle, description — both text columns)
    const courseTranslationRes = await db.execute(sql`
      UPDATE course_translations
      SET subtitle = REPLACE(COALESCE(subtitle, ''), ${before}, ${after}),
          description = REPLACE(COALESCE(description, ''), ${before}, ${after}),
          updated_at = now()
      WHERE COALESCE(subtitle, '') LIKE ${`%${before}%`}
         OR COALESCE(description, '') LIKE ${`%${before}%`}
    `);
    pairChanges += Number(courseTranslationRes.rowCount ?? 0);

    // 3. lessons (summary)
    const lessonRes = await db.execute(sql`
      UPDATE lessons
      SET summary = REPLACE(summary, ${before}, ${after}),
          updated_at = now()
      WHERE summary LIKE ${`%${before}%`}
    `);
    pairChanges += Number(lessonRes.rowCount ?? 0);

    // 4. lesson_translations (summary — text column, not "value")
    const lessonTranslationRes = await db.execute(sql`
      UPDATE lesson_translations
      SET summary = REPLACE(COALESCE(summary, ''), ${before}, ${after}),
          updated_at = now()
      WHERE COALESCE(summary, '') LIKE ${`%${before}%`}
    `);
    pairChanges += Number(lessonTranslationRes.rowCount ?? 0);

    // 5. content_blocks (data->>'markdown' for text blocks)
    const blockRes = await db.execute(sql`
      UPDATE content_blocks
      SET data = jsonb_set(
            data,
            '{markdown}',
            to_jsonb(REPLACE(data->>'markdown', ${before}, ${after}))
          ),
          updated_at = now()
      WHERE type = 'text'
        AND data->>'markdown' LIKE ${`%${before}%`}
    `);
    pairChanges += Number(blockRes.rowCount ?? 0);

    // 6. content_block_translations (also data jsonb with 'markdown' key
    // for translated text blocks, mirroring content_blocks)
    const blockTranslationRes = await db.execute(sql`
      UPDATE content_block_translations
      SET data = jsonb_set(
            data,
            '{markdown}',
            to_jsonb(REPLACE(data->>'markdown', ${before}, ${after}))
          ),
          updated_at = now()
      WHERE data ? 'markdown'
        AND data->>'markdown' LIKE ${`%${before}%`}
    `);
    pairChanges += Number(blockTranslationRes.rowCount ?? 0);

    if (pairChanges > 0) {
      console.log(
        `  ${pairChanges.toString().padStart(3)} row(s) updated: "${before.slice(0, 60)}…"`,
      );
    }
    totalChanges += pairChanges;
  }

  if (totalChanges === 0) {
    console.log(
      "No rows updated. Either already clean, or nothing matched (verify DATABASE_URL points where you think it does).",
    );
  } else {
    console.log(`\nDone. ${totalChanges} row update(s) total.`);
  }

  await pool.end();
}

main().catch((error) => {
  console.error("Cleanup failed:", error);
  process.exit(1);
});
