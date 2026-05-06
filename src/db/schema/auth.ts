import { sql } from "drizzle-orm";
import { type AnyPgColumn, boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { UserPermissions } from "@/lib/permissions";

// `site_manager` is a delegated-admin role: not full admin, but can be
// granted granular permissions (see UserPermissions in src/lib/permissions.ts)
// to manage other creators' content. Appended to keep enum values stable;
// the rank ordering is defined in code (src/lib/rbac.ts), not by enum order.
export const userRole = pgEnum("user_role", [
  "learner",
  "creator",
  "teacher",
  "admin",
  "site_manager",
]);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    name: text("name"),
    image: text("image"),
    role: userRole("role").notNull().default("learner"),
    // Granular per-resource/per-action permissions for site_manager users.
    // Empty object for everyone else; ignored unless role === 'site_manager'.
    // Stored as JSONB so future shape evolution doesn't require a migration
    // for each new resource/action key.
    permissions: jsonb("permissions").$type<UserPermissions>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    // Audit trail: who flipped these permissions and when. Populated by the
    // admin form and the db:promote script. Null for non-site-managers.
    permissionsGrantedBy: text("permissions_granted_by").references(
      (): AnyPgColumn => users.id,
      { onDelete: "set null" },
    ),
    permissionsGrantedAt: timestamp("permissions_granted_at", { withTimezone: true }),
    birthYear: integer("birth_year"),
    locale: text("locale").notNull().default("en"),
    stripeCustomerId: text("stripe_customer_id"),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const passkeys = pgTable(
  "passkeys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    aaguid: text("aaguid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("passkeys_user_idx").on(table.userId),
    index("passkeys_credential_idx").on(table.credentialID),
  ],
);

export const twoFactors = pgTable(
  "two_factors",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: boolean("verified").notNull().default(true),
  },
  (table) => [index("two_factors_user_idx").on(table.userId)],
);
