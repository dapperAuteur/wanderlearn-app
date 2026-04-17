import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { parse as parseCsv } from "csv-parse/sync";
import ws from "ws";
import * as schema from "../src/db/schema";

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

// ---- seed data -----------------------------------------------------

// MUCHO Museo del Chocolate. Colonia Juárez, Mexico City.
// Source: mucho.org.mx — coordinates from OpenStreetMap at the museum address.
const DESTINATION = {
  slug: "mucho-museo-del-chocolate",
  name: "MUCHO Museo del Chocolate",
  country: "Mexico",
  city: "Mexico City",
  lat: "19.427910",
  lng: "-99.164250",
  description:
    "A privately-run chocolate museum in Colonia Juárez, Mexico City. Founded in 2012 by Ana Rita García Lascuráin, MUCHO traces cacao from Olmec origins through the Spanish colonial spread to modern bean-to-bar craft. The museum houses a library, a tasting room, and regular workshops.",
  website: "https://mucho.org.mx",
};

const COURSE = {
  slug: "mucho-museo-del-chocolate",
  title: "MUCHO Museo del Chocolate",
  subtitle: "A walk through cacao's 3,500-year journey — from Olmec ritual to the bean-to-bar craft you can taste in Mexico City today.",
  description:
    "Cacao is older than chocolate. The Olmecs cultivated Theobroma cacao along the Gulf Coast more than three thousand years ago. The Maya drank it bitter and ceremonial; the Aztecs used the beans as currency. Spanish colonists took it home, added sugar, and turned it into a European luxury. Today, Mexican chocolatiers are reclaiming the full arc — from single-origin beans to finished bars — and MUCHO Museo del Chocolate is the place to stand inside that story.\n\nThis course is a place-based tour of the museum. You'll meet the plant, the people who domesticated it, the trade that moved it across an ocean, and the craft that's bringing it home.",
  priceCents: 0,
  defaultLocale: "en",
};

// ---- lesson + block data -------------------------------------------

type TextBlock = { type: "text"; markdown: string };

type SeedLesson = {
  slug: string;
  orderIndex: number;
  title: string;
  summary: string;
  isFreePreview: boolean;
  estimatedMinutes: number;
  blocks: TextBlock[];
};

const LESSONS: SeedLesson[] = [
  {
    slug: "the-olmec-origin",
    orderIndex: 0,
    title: "The Olmec origin",
    summary: "Where cacao domestication actually began — and what changed when humans started fermenting the beans.",
    isFreePreview: true,
    estimatedMinutes: 10,
    blocks: [
      {
        type: "text",
        markdown: `## Cacao is a forest tree

*Theobroma cacao* — "food of the gods" — evolved in the understory of Amazonian forests. It can't pollinate itself. It can't ripen without the shade of taller trees. And its seeds, bitter and astringent raw, don't taste like chocolate until humans do something specific to them.

## The first chocolate was a drink

Residue analysis of pottery from the Olmec heartland along the Gulf Coast of what is now Veracruz and Tabasco shows cacao consumption as early as **1500 BCE**. The Olmecs weren't eating bars. They were drinking a fermented, spiced, often savory beverage. That pattern — cacao-as-beverage — held for more than two thousand years.

## The step that matters: fermentation

Raw cacao seeds taste almost nothing like chocolate. What makes chocolate *chocolate* is a multi-day fermentation of the pulp-coated beans, followed by drying and roasting. The flavor compounds come from that process. Without it, no chocolate — just a bitter tropical seed.

## Why this matters for the museum

MUCHO's first rooms trace this arc. The cacao on display isn't a symbol; it's the same genetic material that Olmec farmers were tending 3,500 years ago.`,
      },
    ],
  },
  {
    slug: "maya-and-aztec-ritual-and-currency",
    orderIndex: 1,
    title: "Maya and Aztec: ritual and currency",
    summary: "How cacao became a ceremonial drink, a unit of tribute, and — briefly — a spendable currency.",
    isFreePreview: false,
    estimatedMinutes: 12,
    blocks: [
      {
        type: "text",
        markdown: `## A drink, then a currency

By the time the Maya were building the great cities of the Classic period (roughly **250–900 CE**), cacao was central to religious and royal life. It showed up in marriage ceremonies, in offerings to ancestors, and on glyphs that explicitly labelled vessels as "his cup for cacao."

The Aztecs took this further. Under the Triple Alliance, cacao beans were **tribute goods** — flowing into Tenochtitlán from conquered cacao-producing regions along the southern coasts. You could pay with them. Period accounts record prices in the 16th century:

- **1 small rabbit** ≈ 30 cacao beans
- **1 turkey egg** ≈ 3 cacao beans
- **1 ripe avocado** ≈ 1 cacao bean

You could buy dinner with beans. You could also drink it.

## The recipe nobody expected

Aztec *cacahuatl* was cold, thick, and often bitter. Common additions: chile, achiote, vanilla, honey. No milk. No added sugar. The distinctive frothy top came from pouring the drink between two vessels to aerate it — a technique still used by Oaxacan chocolatiers today.

## The colonial pivot

When the Spanish arrived, cacao was already a strategic Mesoamerican commodity. They kept the trade, changed the recipe (heated, sweetened, milk eventually added in Europe), and carried it back across the Atlantic. By **1650**, chocolate houses had opened in Madrid, Paris, and London.

The museum's ceremonial-vessel room is worth slowing down in. The vessels themselves tell you more about cacao's social role than any text panel.`,
      },
    ],
  },
  {
    slug: "bean-to-bar-in-mexico-today",
    orderIndex: 2,
    title: "Bean-to-bar in Mexico today",
    summary: "How a handful of Mexican chocolatiers are rebuilding the supply chain from origin to finished bar.",
    isFreePreview: false,
    estimatedMinutes: 15,
    blocks: [
      {
        type: "text",
        markdown: `## Why bean-to-bar matters

Most chocolate consumed globally goes through a long industrial supply chain: farmers in West Africa or Ecuador sell beans to middlemen, beans are bulk-shipped to processors in Europe or the US, cocoa butter and cocoa solids are traded as commodities, and chocolate is manufactured far from where the bean grew.

**Bean-to-bar** compresses that chain. One operation buys beans directly from a known farm or cooperative, ferments or verifies fermentation, roasts, grinds, conches, tempers, and moulds. You can trace every step. The farmer gets paid more. The chocolate tastes like the place.

## The Mexican case

Mexico has every advantage: native cacao genetics, an unbroken cultural tradition, cacao-growing regions in Chiapas and Tabasco, and a new generation of chocolatiers who trained abroad and came home.

A partial list of Mexican bean-to-bar makers worth knowing (as of 2026):

- **Tago** — Mexico City — works with Chiapanecan cooperatives
- **Qachoco** — Oaxaca — emphasises native Criollo varieties
- **Le Caméléon** — Mexico City — French technique, Mexican beans
- **Rózsavölgyi Csokoládé** — (Hungarian, but frequently collaborates with Mexican origin)

MUCHO works with several of these makers directly. The museum's tasting room is the best single place in Mexico to compare origin bars side by side.

## What to taste for

When you're in the tasting room, the things that tell you a bar is well-made:

1. **Snap** — a clean break, not a crumble. Good temper.
2. **Aroma at body temp** — warm the bar in your hand. Should bloom fruit and floral notes.
3. **Finish** — should fade long, not disappear. Poor cacao has a short, often tinny finish.
4. **No waxy mouthfeel** — that's cocoa butter replaced by vegetable fat. Walk away.

Don't chew. Let it melt.`,
      },
    ],
  },
  {
    slug: "visiting-mucho",
    orderIndex: 3,
    title: "Visiting MUCHO",
    summary: "Practical details for planning a visit — hours, workshops, and what to skip if you're short on time.",
    isFreePreview: false,
    estimatedMinutes: 8,
    blocks: [
      {
        type: "text",
        markdown: `## Where

MUCHO Museo del Chocolate
Calle Milán 45, Colonia Juárez
06600 Mexico City, CDMX

Two blocks from the Cuauhtémoc metro station (Line 1). Walk-up; no timed entry as of 2026.

Official site: [mucho.org.mx](https://mucho.org.mx)

## When to go

Weekday mornings are calmest. Weekends fill up by 11am, especially when a workshop is running. The museum is closed Mondays.

## If you have 30 minutes

Go straight to:
1. The **Olmec-to-Aztec** room (ground floor) — ceremonial vessels and the trade-goods display.
2. The **tasting room** (upper floor) — small, free samples of three origin bars.

## If you have 90 minutes

Add:
3. The **history-of-the-bar** hallway — the European chocolate-house period.
4. The **workshop space** (if a session is running) — public workshops cost around MXN 400 and include hands-on grinding and moulding.

## Pair the visit with

- **Dulcería de Celaya** — 19th-century sweet shop at Cinco de Mayo 39. Different tradition, similar reverence.
- **La Ciudadela market** — walkable from MUCHO; look for the stalls selling solid tablets of Oaxacan drinking chocolate.

## One thing to skip

The gift-shop chocolate is fine but nothing special. If you want to take something home, the tasting room sells a curated selection that's better than what's at the front counter.`,
      },
    ],
  },
];

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
  const records = parseCsv(raw, {
    columns: true,
    trim: true,
    skip_empty_lines: true,
    relax_column_count: false,
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
