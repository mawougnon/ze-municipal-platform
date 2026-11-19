import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

// These tests write to the database: never to the one in .env, which is production.
// Prisma only connects on the first query, and it fills an unset DATABASE_URL from .env,
// which this check then refuses.
const url = process.env.DATABASE_URL;
const production = existsSync(".env") ? parseEnv(readFileSync(".env", "utf8")).DATABASE_URL : "";
if (!url || url === production) {
  throw new Error("Set DATABASE_URL to a test or preproduction database to run these tests.");
}

// Unique per run, so a test only ever touches the rows it created
export const runId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
