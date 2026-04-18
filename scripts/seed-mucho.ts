import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { parse as parseCsv } from "csv-parse/sync";
import ws from "ws";
import * as schema from "../src/db/schema";
import { COURSE, DESTINATION, LESSONS } from "./seed-mucho-data";

// ---- env + connection ----------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Run via pnpm db:seed.");
}

const CREATOR_EMAIL = process.env.SEED_CREATOR_EMAIL;
if (!CREATOR_EMAIL) {
  throw new Error(
    "SEED_CREATOR_EMAIL is required. Set it to the email of the user who should own the MUCHO course. Example: SEED_CREATOR_EMAIL=bam@awews.com pnpm db:seed",
  );
}

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool, { schema });

// Seed content — DESTINATION, COURSE, LESSONS, TextBlock, SeedLesson — lives
// in ./seed-mucho-data.ts so gen-translation-template.ts can import it
// without triggering the seed runner. See the imports at the top of this
// file.

// ---- seed logic ----------------------------------------------------

async function main() {
  console.log(`Seeding MUCHO course for creator: ${CREATOR_EMAIL}`);

  const [creator] = await db
    .select({ id: schema.users.id, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.email, CREATOR_EMAIL!))
    .limit(1);

  if (!creator) {
    throw new Error(
      `No user found with email ${CREATOR_EMAIL}. Sign up first, then re-run the seed.`,
    );
  }
  const creatorRole = (creator.role as string | undefined) ?? "learner";
  if (creatorRole !== "creator" && creatorRole !== "admin" && creatorRole !== "teacher") {
    console.warn(
      `WARN: ${CREATOR_EMAIL} has role "${creatorRole}". Course will be created but won't be editable in the creator UI until you promote the user (pnpm db:promote ${CREATOR_EMAIL} creator).`,
    );
  }

  // Destination — upsert by slug.
  let [destination] = await db
    .select()
    .from(schema.destinations)
    .where(eq(schema.destinations.slug, DESTINATION.slug))
    .limit(1);
  if (!destination) {
    [destination] = await db.insert(schema.destinations).values(DESTINATION).returning();
    console.log(`  destination created: ${destination.name}`);
  } else {
    await db
      .update(schema.destinations)
      .set({ ...DESTINATION, updatedAt: new Date() })
      .where(eq(schema.destinations.id, destination.id));
    console.log(`  destination updated: ${destination.name}`);
  }

  // Course — upsert by slug, tied to this creator.
  let [course] = await db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.slug, COURSE.slug))
    .limit(1);

  const courseValues = {
    ...COURSE,
    creatorId: creator.id,
    destinationId: destination.id,
    status: "published" as const,
    publishedAt: new Date(),
  };

  if (!course) {
    [course] = await db.insert(schema.courses).values(courseValues).returning();
    console.log(`  course created: ${course.title}`);
  } else {
    await db
      .update(schema.courses)
      .set({ ...courseValues, updatedAt: new Date() })
      .where(eq(schema.courses.id, course.id));
    console.log(`  course updated: ${course.title}`);
  }

  // Lessons + blocks — upsert each lesson by (course_id, slug), then replace its blocks.
  for (const lessonSeed of LESSONS) {
    const [existing] = await db
      .select()
      .from(schema.lessons)
      .where(
        and(
          eq(schema.lessons.courseId, course.id),
          eq(schema.lessons.slug, lessonSeed.slug),
        ),
      )
      .limit(1);

    const lessonValues = {
      courseId: course.id,
      slug: lessonSeed.slug,
      orderIndex: lessonSeed.orderIndex,
      title: lessonSeed.title,
      summary: lessonSeed.summary,
      status: "published" as const,
      isFreePreview: lessonSeed.isFreePreview,
      estimatedMinutes: lessonSeed.estimatedMinutes,
    };

    let lessonId: string;
    if (!existing) {
      const [inserted] = await db.insert(schema.lessons).values(lessonValues).returning();
      lessonId = inserted.id;
      console.log(`    lesson created: ${lessonSeed.title}`);
    } else {
      await db
        .update(schema.lessons)
        .set({ ...lessonValues, updatedAt: new Date() })
        .where(eq(schema.lessons.id, existing.id));
      lessonId = existing.id;
      console.log(`    lesson updated: ${lessonSeed.title}`);
    }

    // Replace blocks for this lesson — idempotent by rebuild. The seed is the
    // source of truth; manual edits to blocks in the UI WILL be overwritten on
    // re-seed. Keep authoring lesson content in this file.
    await db.delete(schema.contentBlocks).where(eq(schema.contentBlocks.lessonId, lessonId));
    await db.insert(schema.contentBlocks).values(
      lessonSeed.blocks.map((block, index) => ({
        lessonId,
        orderIndex: index,
        type: block.type,
        data: { markdown: block.markdown },
      })),
    );
    console.log(`      blocks replaced: ${lessonSeed.blocks.length}`);
  }

  await applyTranslations(course.id);

  console.log("Seed complete.");
}

// ---- translation CSV loader ---------------------------------------

type TranslationRow = {
  kind: "course" | "lesson" | "block";
  scope: string;
  index: string;
  field: string;
  value: string;
};

const COURSE_TRANSLATABLE_FIELDS = new Set(["title", "subtitle", "description"]);
const LESSON_TRANSLATABLE_FIELDS = new Set(["title", "summary"]);
const TEXT_BLOCK_FIELDS = new Set(["markdown"]);

function seedDataDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "seed-data");
}

function listTranslationFiles(): { locale: string; path: string }[] {
  const dir = seedDataDir();
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const out: { locale: string; path: string }[] = [];
  for (const name of entries) {
    const match = /^mucho\.([a-z]{2}(?:-[A-Z]{2})?)\.csv$/.exec(name);
    if (!match) continue;
    out.push({ locale: match[1], path: join(dir, name) });
  }
  return out.sort((a, b) => a.locale.localeCompare(b.locale));
}

function parseTranslationCsv(path: string): TranslationRow[] {
  const raw = readFileSync(path, "utf8");
  // relax_column_count tolerates the optional `source` column. `source` is
  // translator-facing reference only (the English text to translate from);
  // the loader ignores it — `value` is the real translation target.
  const records = parseCsv(raw, {
    columns: true,
    trim: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[];
  return records.map((r) => ({
    kind: r.kind as TranslationRow["kind"],
    scope: r.scope ?? "",
    index: r.index ?? "",
    field: r.field ?? "",
    value: r.value ?? "",
  }));
}

async function applyTranslations(courseId: string): Promise<void> {
  const files = listTranslationFiles();
  if (files.length === 0) {
    console.log("  no translation CSVs found in scripts/seed-data/ — skipping.");
    return;
  }

  for (const { locale, path } of files) {
    if (locale === COURSE.defaultLocale) {
      console.log(
        `  translations (${locale}): matches course defaultLocale — treating as reference template, not writing.`,
      );
      continue;
    }
    console.log(`  translations (${locale}): reading ${path}`);
    const rows = parseTranslationCsv(path);
    await applyLocaleRows(courseId, locale, rows);
  }
}

async function applyLocaleRows(
  courseId: string,
  locale: string,
  rows: TranslationRow[],
): Promise<void> {
  const courseFields = new Map<string, string>();
  const lessonFieldsBySlug = new Map<string, Map<string, string>>();
  const blockFieldsByLessonIndex = new Map<string, Map<number, Map<string, string>>>();

  for (const row of rows) {
    if (!row.value) continue;

    if (row.kind === "course") {
      if (row.scope !== COURSE.slug) {
        console.warn(`    WARN: unknown course slug "${row.scope}" — skipping row.`);
        continue;
      }
      if (!COURSE_TRANSLATABLE_FIELDS.has(row.field)) {
        console.warn(`    WARN: unknown course field "${row.field}" — skipping row.`);
        continue;
      }
      courseFields.set(row.field, row.value);
      continue;
    }

    if (row.kind === "lesson") {
      const lessonSeed = LESSONS.find((l) => l.slug === row.scope);
      if (!lessonSeed) {
        console.warn(`    WARN: unknown lesson slug "${row.scope}" — skipping row.`);
        continue;
      }
      if (!LESSON_TRANSLATABLE_FIELDS.has(row.field)) {
        console.warn(`    WARN: unknown lesson field "${row.field}" — skipping row.`);
        continue;
      }
      const m = lessonFieldsBySlug.get(row.scope) ?? new Map<string, string>();
      m.set(row.field, row.value);
      lessonFieldsBySlug.set(row.scope, m);
      continue;
    }

    if (row.kind === "block") {
      const lessonSeed = LESSONS.find((l) => l.slug === row.scope);
      if (!lessonSeed) {
        console.warn(`    WARN: unknown lesson slug "${row.scope}" — skipping row.`);
        continue;
      }
      const idx = Number.parseInt(row.index, 10);
      if (!Number.isInteger(idx) || idx < 0 || idx >= lessonSeed.blocks.length) {
        console.warn(
          `    WARN: block index "${row.index}" out of range for lesson "${row.scope}" — skipping.`,
        );
        continue;
      }
      const block = lessonSeed.blocks[idx];
      const allowedFields = block.type === "text" ? TEXT_BLOCK_FIELDS : new Set<string>();
      if (!allowedFields.has(row.field)) {
        console.warn(
          `    WARN: field "${row.field}" not supported for block type "${block.type}" — skipping.`,
        );
        continue;
      }
      const byIndex =
        blockFieldsByLessonIndex.get(row.scope) ?? new Map<number, Map<string, string>>();
      const fields = byIndex.get(idx) ?? new Map<string, string>();
      fields.set(row.field, row.value);
      byIndex.set(idx, fields);
      blockFieldsByLessonIndex.set(row.scope, byIndex);
      continue;
    }

    console.warn(`    WARN: unknown kind "${row.kind}" — skipping row.`);
  }

  // course_translations
  if (courseFields.size > 0) {
    const title = courseFields.get("title");
    if (!title) {
      console.warn(`    WARN: course title empty for locale ${locale} — skipping course row.`);
    } else {
      await upsertCourseTranslation(courseId, locale, {
        title,
        subtitle: courseFields.get("subtitle") ?? null,
        description: courseFields.get("description") ?? null,
      });
      console.log(`    course translation upserted (${locale}).`);
    }
  }

  // lesson_translations
  for (const [slug, fields] of lessonFieldsBySlug) {
    const title = fields.get("title");
    if (!title) {
      console.warn(`    WARN: lesson "${slug}" has no title (${locale}) — skipping.`);
      continue;
    }
    const [lessonRow] = await db
      .select({ id: schema.lessons.id })
      .from(schema.lessons)
      .where(
        and(eq(schema.lessons.courseId, courseId), eq(schema.lessons.slug, slug)),
      )
      .limit(1);
    if (!lessonRow) {
      console.warn(`    WARN: lesson "${slug}" not in DB — skipping.`);
      continue;
    }
    await upsertLessonTranslation(lessonRow.id, locale, {
      title,
      summary: fields.get("summary") ?? null,
    });
    console.log(`    lesson translation upserted: ${slug} (${locale}).`);
  }

  // content_block_translations
  for (const [slug, byIndex] of blockFieldsByLessonIndex) {
    const [lessonRow] = await db
      .select({ id: schema.lessons.id })
      .from(schema.lessons)
      .where(
        and(eq(schema.lessons.courseId, courseId), eq(schema.lessons.slug, slug)),
      )
      .limit(1);
    if (!lessonRow) continue;

    const blockRows = await db
      .select({ id: schema.contentBlocks.id, orderIndex: schema.contentBlocks.orderIndex, type: schema.contentBlocks.type })
      .from(schema.contentBlocks)
      .where(eq(schema.contentBlocks.lessonId, lessonRow.id));
    const byOrder = new Map(blockRows.map((b) => [b.orderIndex, b]));

    for (const [idx, fields] of byIndex) {
      const block = byOrder.get(idx);
      if (!block) continue;
      if (block.type !== "text") continue;
      const markdown = fields.get("markdown");
      if (!markdown) continue;
      await upsertBlockTranslation(block.id, locale, { markdown });
      console.log(`    block translation upserted: ${slug}[${idx}] (${locale}).`);
    }
  }
}

async function upsertCourseTranslation(
  courseId: string,
  locale: string,
  values: { title: string; subtitle: string | null; description: string | null },
): Promise<void> {
  const [existing] = await db
    .select({ id: schema.courseTranslations.id })
    .from(schema.courseTranslations)
    .where(
      and(
        eq(schema.courseTranslations.courseId, courseId),
        eq(schema.courseTranslations.locale, locale),
      ),
    )
    .limit(1);
  if (existing) {
    await db
      .update(schema.courseTranslations)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(schema.courseTranslations.id, existing.id));
  } else {
    await db.insert(schema.courseTranslations).values({ courseId, locale, ...values });
  }
}

async function upsertLessonTranslation(
  lessonId: string,
  locale: string,
  values: { title: string; summary: string | null },
): Promise<void> {
  const [existing] = await db
    .select({ id: schema.lessonTranslations.id })
    .from(schema.lessonTranslations)
    .where(
      and(
        eq(schema.lessonTranslations.lessonId, lessonId),
        eq(schema.lessonTranslations.locale, locale),
      ),
    )
    .limit(1);
  if (existing) {
    await db
      .update(schema.lessonTranslations)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(schema.lessonTranslations.id, existing.id));
  } else {
    await db.insert(schema.lessonTranslations).values({ lessonId, locale, ...values });
  }
}

async function upsertBlockTranslation(
  blockId: string,
  locale: string,
  data: Record<string, unknown>,
): Promise<void> {
  const [existing] = await db
    .select({ id: schema.contentBlockTranslations.id })
    .from(schema.contentBlockTranslations)
    .where(
      and(
        eq(schema.contentBlockTranslations.blockId, blockId),
        eq(schema.contentBlockTranslations.locale, locale),
      ),
    )
    .limit(1);
  if (existing) {
    await db
      .update(schema.contentBlockTranslations)
      .set({ data, updatedAt: new Date() })
      .where(eq(schema.contentBlockTranslations.id, existing.id));
  } else {
    await db.insert(schema.contentBlockTranslations).values({ blockId, locale, data });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
