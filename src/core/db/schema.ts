import { defineRelations, sql } from "drizzle-orm";
import * as t from "drizzle-orm/pg-core";
import type { Extra as UniDanExtra } from "@/core/dm.ts";
import { z } from "zod";
import { createInsertSchema } from "drizzle-orm/zod";
import type { Simplify } from "type-fest";

export const modeEnum = t.pgEnum("mode", ["Normal", "Bottom", "Top", "Reverse", "Ext"]);
export const poolEnum = t.pgEnum("pool", ["Def", "Sub", "Adv", "Ix"]);
export const dmAttrEnum = t.pgEnum("dm_attr", [
  "Protect",
  "FromLive",
  "HighLike",
  "Compatible",
  "Reported",
  "Unchecked",
  "HasEvent",
  "Hide",
]);

// bsnapshot的弹幕不设置默认值，尽量遵循上传组的原始数据(保证所有重要值均有确定)
export const danmakus = t.pgTable(
  "danmakus",
  {
    SOID: t.text().notNull(),
    // .references(() => pools.SOID),
    chunkID: t
      .serial()
      .notNull()
      .references(() => chunks.id),
    DMID: t.text().notNull(), // 该值在此直接map到dan-any的DMID，为唯一值
    progress: t.integer().notNull(), // 毫秒
    mode: modeEnum().notNull(),
    fontsize: t.smallint().notNull(),
    color: t.integer().notNull(),
    senderID: t.text().notNull(),
    content: t.text().notNull(),
    ctime: t.timestamp().notNull(),
    weight: t.smallint().notNull(),
    pool: poolEnum().notNull(),
    attr: dmAttrEnum().array().notNull(),
    platform: t.text(),
    extra: t.jsonb().$type<UniDanExtra>(),
  },
  (table) => [t.primaryKey({ columns: [table.DMID, table.chunkID] })],
);
export const danmakusInsertZod = createInsertSchema(danmakus);
export const danmakusSelectZod = createInsertSchema(danmakus);
export type DanmakusInsert = Simplify<
  Omit<z.infer<typeof danmakusInsertZod>, "extra" | "chunkID"> & { extra: UniDanExtra | null }
>;
export type DanmakusSelect = Simplify<
  Omit<z.infer<typeof danmakusSelectZod>, "extra" | "chunkID"> & { extra: UniDanExtra | null }
>;
// export const pools = t.pgTable("pools", {
//   SOID: t.text().primaryKey(),
// });

export const chunks = t.pgTable("chunks", {
  id: t.serial().primaryKey(),
  // 信息区
  fromConverted: t.boolean().notNull().default(false), // 是否包含有损转换过的弹幕，导入后不建议再次导出(应用层决定：导出按钮检测到后提示/禁用)
});
export const chunksZod = createInsertSchema(chunks);

export const relations = defineRelations({ danmakus, chunks }, (r) => ({
  // pools: {
  //   danmakus: r.many.danmakus({
  //     from: r.pools.SOID,
  //     to: r.danmakus.SOID,
  //   }),
  // },
  chunks: {
    danmakus: r.many.danmakus({
      from: r.chunks.id,
      to: r.danmakus.chunkID,
    }),
  },
}));

export const onConflictDoUpdateSet = {
  danmakus: Object.fromEntries(
    Object.keys(danmakus).map((key) => [key, sql.raw(`excluded."${key}"`)]),
  ),
} as const;
export const onConflictDoUpdate = {
  danmakus: {
    target: [danmakus.DMID, danmakus.chunkID],
    set: onConflictDoUpdateSet.danmakus,
  },
};

export const ModeSchema = z.enum(danmakus.mode.enumValues);
export const PoolSchema = z.enum(danmakus.pool.enumValues);
export const DMAttrSchema = z.enum(danmakus.attr.enumValues);
