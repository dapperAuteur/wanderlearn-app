import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString.includes("placeholder")) {
  // npm/pnpm exposes the invoked script name on npm_lifecycle_event. The
  // `:prod` entrypoint intentionally does not auto-load any .env file, so
  // its hint must point at shell sourcing rather than .env.local.
  const isProd = process.env.npm_lifecycle_event === "db:migrate:prod";
  const hint = isProd
    ? "Set DATABASE_URL in your shell before running this — `pnpm db:migrate:prod` deliberately does not auto-load any .env file. Try: `set -a; source .env.prod; set +a; pnpm db:migrate:prod`."
    : "Put a real Neon connection string in .env.local.";
  console.error(`DATABASE_URL is not set. ${hint}`);
  process.exit(1);
}

const pool = new Pool({ connectionString });
const db = drizzle(pool);

async function main() {
  console.log("Applying migrations from ./src/db/migrations …");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migrations applied.");
  await pool.end();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  pool.end().finally(() => process.exit(1));
});
