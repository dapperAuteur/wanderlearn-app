import { eq } from "drizzle-orm";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { sanitizePermissions, type UserPermissions } from "../src/lib/permissions";
import * as schema from "../src/db/schema";

neonConfig.webSocketConstructor = ws;

const VALID_ROLES = ["learner", "creator", "teacher", "admin", "site_manager"] as const;
type Role = (typeof VALID_ROLES)[number];

function parseArgs(): { email: string; role: Role; permissions: UserPermissions | null } {
  const email = process.argv[2]?.trim();
  const roleArg = (process.argv[3]?.trim() ?? "creator") as Role;

  // Optional --permissions=<json>; only meaningful when role === site_manager.
  let permissionsRaw: string | null = null;
  for (const arg of process.argv.slice(4)) {
    if (arg.startsWith("--permissions=")) {
      permissionsRaw = arg.slice("--permissions=".length);
    }
  }

  if (!email) {
    console.error("Usage: pnpm db:promote <email> [role] [--permissions=<json>]");
    console.error(`  role is one of: ${VALID_ROLES.join(", ")} (default: creator)`);
    console.error(
      '  --permissions only applies when role=site_manager. Example:',
    );
    console.error(
      "    pnpm db:promote alice@example.com site_manager --permissions='{\"media\":{\"upload\":true,\"delete\":true},\"scenes\":{\"update\":true}}'",
    );
    process.exit(1);
  }

  if (!VALID_ROLES.includes(roleArg)) {
    console.error(`Invalid role "${roleArg}". Must be one of: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }

  let permissions: UserPermissions | null = null;
  if (roleArg === "site_manager" && permissionsRaw) {
    try {
      permissions = sanitizePermissions(JSON.parse(permissionsRaw));
    } catch (err) {
      console.error("Failed to parse --permissions JSON:", err);
      process.exit(1);
    }
  }
  if (roleArg === "site_manager" && !permissions) {
    console.warn(
      "[warn] role=site_manager set without --permissions. The user will have the role but no permissions ticked, so they'll behave like a regular creator until you grant some.",
    );
  }

  return { email, role: roleArg, permissions };
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString.includes("placeholder")) {
  // npm/pnpm exposes the invoked script name on npm_lifecycle_event.
  // The :prod entrypoint intentionally does not auto-load any .env file.
  const isProd = process.env.npm_lifecycle_event === "db:promote:prod";
  const hint = isProd
    ? "Set DATABASE_URL in your shell before running this — the :prod entrypoint deliberately does not auto-load any .env file."
    : "Put a real Neon connection string in .env.local.";
  console.error(`DATABASE_URL is not set. ${hint}`);
  process.exit(1);
}

const { email, role, permissions } = parseArgs();

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

async function main() {
  const grantingPermissions = role === "site_manager";
  const updated = await db
    .update(schema.users)
    .set({
      role,
      permissions: permissions ?? {},
      // Stamp the audit fields when granting permissions; clear them
      // when downgrading. There's no "operator" identity in the script
      // path so permissionsGrantedBy stays null — the admin UI is the
      // path that records "who clicked granted." If you need a CLI
      // identity, set OPERATOR_EMAIL and look up that user first.
      permissionsGrantedBy: null,
      permissionsGrantedAt: grantingPermissions ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.email, email))
    .returning({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      permissions: schema.users.permissions,
    });

  if (updated.length === 0) {
    console.error(`No user found with email "${email}". Sign up first, then re-run this script.`);
    await pool.end();
    process.exit(1);
  }

  const user = updated[0]!;
  console.log(`✓ Promoted ${user.email} (${user.name ?? "no name"}) to ${user.role}.`);
  if (grantingPermissions) {
    console.log("  Permissions:", JSON.stringify(user.permissions));
  }
  await pool.end();
}

main().catch((error) => {
  console.error("Promotion failed:", error);
  pool.end().finally(() => process.exit(1));
});
