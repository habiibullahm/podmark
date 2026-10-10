// Applies backend/neon/migrations/*.sql in filename order: `npm run db:migrate`.
// DATABASE_URL = the branch owner's connection string (never commit it).
// Every migration is written to be re-runnable (if-not-exists / drop-if-exists),
// so there is no migrations table to keep in sync.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL to the Neon branch owner's connection string.");
  process.exit(2);
}

const dir = join(import.meta.dirname, "..", "backend", "neon", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  for (const file of files) {
    await client.query(readFileSync(join(dir, file), "utf8"));
    console.log(`applied ${file}`);
  }
  // Standard PostgREST schema-cache reload. Neon's Data API was observed to
  // pick up new tables without it; this is a harmless belt-and-braces.
  await client.query("notify pgrst, 'reload schema'");
} finally {
  await client.end();
}
