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

export async function migrateDb(drizzleInstance: typeof db) {
  if (drizzleInstance === null) throw new Error("drizzle instance is null!");
  await migrate(drizzleInstance, {
    migrationsFolder: new URL(import.meta.resolve("./migrations", import.meta.url)).pathname,
  });
}

export async function initDb(dump?: File) {
  if (db) return db;
  const client = dump ? await PGlite.create(await dump.text()) : new PGlite();
  db = drizzle({ client, relations });
  await migrateDb(db);
  return db;
}
export async function initNewDb() {
  const db2 = drizzle({ relations });
  await migrateDb(db2);
  return db2;
}

export async function dumpDb(drizzleInstance?: typeof db) {
  if (drizzleInstance) return await pgDump({ pg: drizzleInstance.$client });
  if (!db) throw new Error("Database not initialized");
  const dump = await pgDump({ pg: db.$client });
  db = null;
  return dump;
}

export async function closeDb() {
  await db?.$client.close();
  db = null;
}
