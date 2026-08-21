/**
 * Refuses to let a "dev" database command run against an unlabelled database.
 *
 * WHY THIS EXISTS. Every command in this repo named like a development command
 * — `db:migrate`, `db:seed`, `db:push`, `db:promote`, `db:studio` — loads
 * `.env.local` and writes to whatever `DATABASE_URL` it finds there. The
 * documentation said, in several places, that this was the safe local path and
 * that `db:migrate:prod` was the dangerous one.
 *
 * On 2026-08-20 that turned out to be backwards: `.env.local` pointed at
 * production. The tell was that `scripts/seed-mucho-data.ts` creates exactly
 * one destination and the app running locally served four real venues. So
 * `pnpm db:seed` would have inserted demo content into the live database, and
 * `pnpm db:push` — which diffs the schema and applies the difference directly,
 * including DROP COLUMN — could have destroyed real data with no migration file
 * to review and nothing to roll back.
 *
 * Nothing bad actually happened. That is luck, not design, and luck is not a
 * safeguard.
 *
 * HOW IT WORKS. The database has to say what it is. `DB_ENV` must be present
 * and must say `development` before any write-shaped dev command will run.
 *
 * It fails CLOSED: an unset `DB_ENV` is refused, not waved through. A guard
 * that assumes safety when it has no information is not a guard. The cost of a
 * false alarm is reading one paragraph; the cost of a false all-clear is a
 * dropped column on a live tour.
 *
 * It never prints the connection string, or any part of it. A guard that leaks
 * the credential it is protecting into a terminal, a scrollback, or a CI log
 * has traded one hazard for another.
 *
 * `db:migrate:prod` deliberately does not use this. It loads no env file, takes
 * its URL from the shell, and is honest about being the production path — which
 * is exactly the property the dev commands had lost.
 */

const command = process.argv[2] ?? "this command";
const dbEnv = process.env.DB_ENV?.trim().toLowerCase();

/** Set when you genuinely mean to point a dev-named command at production. */
const override = process.env.DB_TARGET_CONFIRM?.trim().toLowerCase();

function refuse(reason: string, guidance: string[]): never {
  console.error("");
  console.error(`  Refusing to run \`${command}\` — ${reason}`);
  console.error("");
  for (const line of guidance) console.error(`  ${line}`);
  console.error("");
  process.exit(1);
}

if (override === "production") {
  console.warn("");
  console.warn(`  DB_TARGET_CONFIRM=production is set.`);
  console.warn(`  Running \`${command}\` against a PRODUCTION database on purpose.`);
  console.warn("");
  process.exit(0);
}

if (!dbEnv) {
  refuse("this database has not said what it is.", [
    "`DB_ENV` is not set, so there is no way to tell a scratch database from the live one.",
    "",
    "Add ONE of these to .env.local, matching what DATABASE_URL there actually points at:",
    "",
    "    DB_ENV=development     # a scratch database. Safe to migrate, seed, reset.",
    "    DB_ENV=production      # the live database. Dev commands will refuse.",
    "",
    "If you are not certain which it is, assume production and check before writing.",
    "A Neon branch makes a real dev database cheap, and is the fix rather than the label.",
    "",
    "To run this against production anyway, deliberately:",
    "",
    "    DB_TARGET_CONFIRM=production pnpm <command>",
  ]);
}

if (dbEnv === "production") {
  refuse("DB_ENV says this is the PRODUCTION database.", [
    `\`${command}\` writes to whatever it is pointed at, and this one is live.`,
    "",
    "For schema changes on production, use the path built for it:",
    "",
    "    set -a; source .env.prod; set +a; pnpm db:migrate:prod",
    "",
    "That loads no .env.local, so it cannot pick up the wrong database by accident.",
    "",
    "If you really mean to run this exact command against production:",
    "",
    "    DB_TARGET_CONFIRM=production pnpm <command>",
  ]);
}

if (dbEnv !== "development") {
  refuse(`DB_ENV is "${dbEnv}", which is not a value this guard understands.`, [
    "Use exactly `development` or `production`.",
  ]);
}

// Development, explicitly declared. Carry on.
