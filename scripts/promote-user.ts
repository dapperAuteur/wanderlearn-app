import { eq } from "drizzle-orm";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../src/db/schema";

neonConfig.webSocketConstructor = ws;

const VALID_ROLES = ["learner", "creator", "teacher", "admin"] as const;
type Role = (typeof VALID_ROLES)[number];

function parseArgs(): { email: string; role: Role } {
  const email = process.argv[2]?.trim();
  const roleArg = (process.argv[3]?.trim() ?? "creator") as Role;

  if (!email) {
    console.error("Usage: pnpm db:promote <email> [role]");
    console.error(`  role is one of: ${VALID_ROLES.join(", ")} (default: creator)`);
    process.exit(1);
  }

  if (!VALID_ROLES.includes(roleArg)) {
    console.error(`Invalid role "${roleArg}". Must be one of: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  return { email, role: roleArg };
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString.includes("placeholder")) {
  console.error("DATABASE_URL is not set. Put a real Neon connection string in .env.local.");
  process.exit(1);
}

const { email, role } = parseArgs();

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

async function main() {
  const updated = await db
    .update(schema.users)
    .set({ role, updatedAt: new Date() })
    .where(eq(schema.users.email, email))
    .returning({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
    });

  if (updated.length === 0) {
    console.error(`No user found with email "${email}". Sign up first, then re-run this script.`);
    await pool.end();
    process.exit(1);
  }

  const user = updated[0]!;
  console.log(`✓ Promoted ${user.email} (${user.name ?? "no name"}) to ${user.role}.`);
  await pool.end();
}

main().catch((error) => {
  console.error("Promotion failed:", error);
  pool.end().finally(() => process.exit(1));
});
