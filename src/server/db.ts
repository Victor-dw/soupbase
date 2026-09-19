import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { publicContent } from "@/shared/puzzle";
export { sql };
type Row = Record<string, any>;
type Database = { execute: (query: SQL) => Promise<{ rows: Row[] }> };
const state = globalThis as unknown as {
  soupDb?: Database;
  soupReady?: Promise<void>;
};
async function connect(): Promise<Database> {
  if (state.soupDb) return state.soupDb;
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    state.soupDb = drizzle(
      new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }),
    );
  } else {
    if (process.env.NODE_ENV === "production")
      throw new Error("DATABASE_URL is required in production");
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const dbPath =
      process.env.LOCAL_DB_PATH || path.join(process.cwd(), ".data/postgres");
    await mkdir(path.dirname(dbPath), { recursive: true });
    state.soupDb = drizzle(new PGlite(dbPath));
  }
  return state.soupDb!;
}
export async function migrate() {
  const db = await connect();
  const source = await readFile(
    path.join(process.cwd(), "src/server/schema.sql"),
    "utf8",
  );
  for (const statement of source.split(";").filter((s) => s.trim()))
    await db.execute(sql.raw(statement));
}
async function ready() {
  if (!state.soupReady)
    state.soupReady = (async () => {
      await connect();
      if (!process.env.DATABASE_URL) {
        await migrate();
        await seedDirect();
      }
    })();
  await state.soupReady;
}
export async function query<T = Row>(s: SQL): Promise<T[]> {
  await ready();
  return (await state.soupDb!.execute(s)).rows as T[];
}
async function seedDirect() {
  const { readCatalog } = await import("../../scripts/catalog");
  for (const { id, revision: rev, puzzle: p } of await readCatalog()) {
    await state.soupDb!.execute(
      sql`INSERT INTO puzzles (id,visibility,revision) VALUES (${id},'curated',${rev}) ON CONFLICT DO NOTHING`,
    );
    await state.soupDb!.execute(
      sql`INSERT INTO revisions(id,puzzle_id,public_content,secret_content) VALUES (${rev},${id},${JSON.stringify(publicContent(p))}::jsonb,${JSON.stringify(p)}::jsonb) ON CONFLICT DO NOTHING`,
    );
  }
}
export async function seed() {
  await connect();
  await seedDirect();
}
