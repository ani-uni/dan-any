import { expectTypeOf, it } from "vite-plus/test";
import { relations } from "@dan-uni/dan-any/core/db/schema";
import { migrateDb } from "@dan-uni/dan-any/core/db/utils";
import { drizzle } from "drizzle-orm/pglite";
import { InitedUniDB, UniChunk } from "@dan-uni/dan-any/core";
import { defineRelations, defineRelationsPart } from "drizzle-orm";
import { baseRelations } from "@dan-uni/dan-any/core/db/schema";
import { pgTable, serial, text } from "drizzle-orm/pg-core";

it("自定义数据库实例", async () => {
  const db = drizzle({ relations: { ...baseRelations, ...relations } });
  await migrateDb(db);
  const udb = new InitedUniDB(db);
  const chunk = await udb.makeChunk({});
  expectTypeOf(chunk).toEqualTypeOf<UniChunk>();
});

it("接入兼容的数据库实例", async () => {
  const schema = await import("@dan-uni/dan-any/core/db/schema");
  // const { danmakus, chunks, chunk2danmakus } = schema;
  const another_table = pgTable("another_table", {
    id: serial().primaryKey(),
    name: text().notNull(),
  });
  const newDbSchema = { ...schema, another_table };
  const anotherRelations = defineRelationsPart({ ...newDbSchema, another_table }, (r) => ({
    another_table: {
      danmakus: r.many.danmakus({
        from: r.another_table.name,
        to: r.danmakus.DMID,
      }),
    },
  }));
  const db = drizzle({
    relations: { ...defineRelations(newDbSchema), ...relations, ...anotherRelations },
  });
  // 迁移数据库
  // 方法1: 在自定义schema文件里 `export * from "@dan-uni/dan-any/core/db/schema"` ，然后可以在drizzle generate时直接生成全部schema的迁移
  // 方法2: 由utils完成dan-any的自己的数据库迁移；再自行处理自己额外定义的schema (这里只展示方法2)
  await migrateDb(db);
  await db.$client.exec(
    `CREATE TABLE IF NOT EXISTS another_table (
      id SERIAL PRIMARY KEY,
      name text NOT NULL
    )`,
  );
  // end
  const udb = new InitedUniDB(db);
  const chunk = await udb.makeChunk({});
  expectTypeOf(chunk).toEqualTypeOf<UniChunk>();
  console.info(await db.query.another_table.findMany({ with: { danmakus: true } }));
});
