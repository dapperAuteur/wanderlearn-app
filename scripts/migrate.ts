import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString.includes("placeholder")) {
  console.error("DATABASE_URL is not set. Put a real Neon connection string in .env.local.");
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
