import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { relations } from "./schema.ts";
import { pgDump } from "@electric-sql/pglite-tools";
import { migrate } from "drizzle-orm/pglite/migrator";

export let db:
  | (ReturnType<typeof drizzle> & { query: ReturnType<typeof drizzleQueryType> })
  | null = null;

function drizzleQueryType() {
  return drizzle({ client: new PGlite(), relations }).query;
}

export async function initDb(dump?: File) {
  if (db) return db;
  const client = dump ? await PGlite.create(await dump.text()) : new PGlite();
  db = drizzle({ client, relations });
  await migrate(db, {
    migrationsFolder: new URL(import.meta.resolve("./migrations", import.meta.url)).pathname,
  });
  return db;
}
export async function initNewDb() {
  const db2 = drizzle({ relations });
  await migrate(db2, {
    migrationsFolder: new URL(import.meta.resolve("./migrations", import.meta.url)).pathname,
  });
  return db2;
}

export async function dumpDb(s_db?: ReturnType<typeof drizzle>) {
  if (s_db) return await pgDump({ pg: s_db.$client });
  if (!db) throw new Error("Database not initialized");
  const dump = await pgDump({ pg: db.$client });
  db = null;
  return dump;
}

export function closeDb() {
  db = null;
}
