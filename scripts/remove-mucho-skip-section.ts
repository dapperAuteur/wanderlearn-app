import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import ws from "ws";
import * as schema from "../src/db/schema";

// One-off cleanup for plans/bugs/10-copy-MUCHO-course.md.
// The "Visiting MUCHO" lesson shipped with a trailing "## One thing to skip"
// section that BAM asked to remove. The seed files have been updated
// (fix/mucho-copy-remove-skip-section), but production rows already contain
// the paragraph. This script strips it out of every text block (and its
// translations) where it appears. Idempotent: re-running after the section
// is gone prints "0 rows touched" and exits.
//
// Run with:
//   DATABASE_URL='postgres://...prod...' pnpm tsx --env-file=.env.local scripts/remove-mucho-skip-section.ts
//   (or drop --env-file if DATABASE_URL is exported inline)

const TARGET =
  "\n\n## One thing to skip\n\n" +
  "The gift-shop chocolate is fine but nothing special. " +
  "If you want to take something home, the tasting room sells a " +
  "curated selection that's better than what's at the front counter.";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || DATABASE_URL.includes("placeholder")) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool, { schema });

type TextData = { markdown: string };

function stripSection(markdown: string): string | null {
  if (!markdown.includes(TARGET)) return null;
  return markdown.split(TARGET).join("");
}

async function main() {
  let blockUpdates = 0;
  let translationUpdates = 0;

  const blocks = await db.select().from(schema.contentBlocks);
  for (const block of blocks) {
    if (block.type !== "text") continue;
    const data = block.data as TextData;
    if (typeof data?.markdown !== "string") continue;
    const next = stripSection(data.markdown);
    if (next === null) continue;
    await db
      .update(schema.contentBlocks)
      .set({
        data: { ...data, markdown: next },
        updatedAt: new Date(),
      })
      .where(eq(schema.contentBlocks.id, block.id));
    console.log(`  content_blocks.${block.id} updated`);
    blockUpdates += 1;
  }

  const translations = await db.select().from(schema.contentBlockTranslations);
  for (const t of translations) {
    const data = t.data as Partial<TextData>;
    if (typeof data?.markdown !== "string") continue;
    const next = stripSection(data.markdown);
    if (next === null) continue;
    await db
      .update(schema.contentBlockTranslations)
      .set({
        data: { ...data, markdown: next },
        updatedAt: new Date(),
      })
      .where(eq(schema.contentBlockTranslations.id, t.id));
    console.log(`  content_block_translations.${t.id} (${t.locale}) updated`);
    translationUpdates += 1;
  }

  console.log(
    `Done. ${blockUpdates} content block(s) and ${translationUpdates} translation(s) updated.`,
  );
}

main()
  .catch((error) => {
    console.error("remove-mucho-skip-section failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
