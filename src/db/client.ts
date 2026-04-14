import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "./schema";

type Db = NeonHttpDatabase<typeof schema>;

let cached: Db | undefined;

function createDb(): Db {
  const sql = neon(env.DATABASE_URL);
  return drizzle(sql, { schema, casing: "snake_case" });
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    cached ??= createDb();
    return Reflect.get(cached, prop, receiver);
  },
});

export { schema };
