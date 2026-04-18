import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Neon's websocket-based driver needs a Node WebSocket implementation.
// Browsers have one built in; Node serverless runtimes don't.
neonConfig.webSocketConstructor = ws;

type Db = NeonDatabase<typeof schema>;

let cachedPool: Pool | undefined;
let cachedDb: Db | undefined;

function createDb(): Db {
  // Single connection per serverless instance. Vercel scales horizontally
  // by spinning up more instances, not by parallel pool connections
  // inside one instance, so max=1 avoids warming up connections we don't
  // use and sidesteps Neon's per-branch connection limits at scale.
  cachedPool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
  return drizzle(cachedPool, { schema, casing: "snake_case" });
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    cachedDb ??= createDb();
    return Reflect.get(cachedDb, prop, receiver);
  },
});

export { schema };
