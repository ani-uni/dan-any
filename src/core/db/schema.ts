import { defineRelations, defineRelationsPart, sql } from "drizzle-orm";
import * as t from "drizzle-orm/pg-core";
import type { Extra as UniDanExtra } from "@/core/dm-extra.ts";
import { z } from "zod";
import { createInsertSchema } from "drizzle-orm/zod";
import type { Simplify } from "type-fest";
import { dmAttrEnumArr, modeEnumArr, poolEnumArr } from "../index.ts";

export const modeEnum = t.pgEnum("mode", modeEnumArr);
export const poolEnum = t.pgEnum("pool", poolEnumArr);
export const dmAttrEnum = t.pgEnum("dm_attr", dmAttrEnumArr);

// bsnapshot的弹幕不设置默认值，尽量遵循上传组的原始数据(保证所有重要值均有确定)
export const danmakus = t.pgTable("danmakus", {
  SOID: t.text().notNull(),
  // .references(() => pools.SOID),
  DMID: t.text().primaryKey(), // 该值在此直接map到dan-any的DMID，为唯一值
  progress: t.integer().notNull(), // 弹幕进度 毫秒
  mode: modeEnum().notNull(), // 弹幕模式(位置/类型)
  fontsize: t.smallint().notNull(), // 弹幕字号
  color: t.integer().notNull(), // 弹幕颜色
  senderID: t.text().notNull(), // 发送者ID uni-id
  content: t.text().notNull(), // 弹幕内容
  ctime: t.timestamp().notNull(), // 弹幕发送时间
  weight: t.smallint().notNull(), // 弹幕权重 0-11
  pool: poolEnum().notNull(), // 弹幕池
  attr: dmAttrEnum().array().notNull(), // 弹幕属性
  platform: t.text(), // 弹幕平台 platform
  extra: t.jsonb().$type<UniDanExtra>(),
});
export const danmakusInsertZod = createInsertSchema(danmakus);
export type DanmakusInsert = Simplify<
  Omit<z.infer<typeof danmakusInsertZod>, "extra"> & { extra: UniDanExtra | null }
>;
// export const pools = t.pgTable("pools", {
//   SOID: t.text().primaryKey(),
// });

export const chunks = t.pgTable("chunks", {
  id: t.serial().primaryKey(),
  // 信息区
  fromConverted: t.boolean().notNull().default(false), // 是否包含有损转换过的弹幕，导入后不建议再次导出(应用层决定：导出按钮检测到后提示/禁用)
  tmp: t.boolean().notNull().default(false), // 是否为临时chunk，临时chunk会在完成导出行为后自动删除/shrink时自动批量删除
});
export const chunksZod = createInsertSchema(chunks);

// many-to-many 映射表：chunk <-> danmakus
export const chunk2danmakus = t.pgTable("chunk_danmakus", {
  id: t.bigserial({ mode: "bigint" }).primaryKey(),
  chunkID: t
    .integer()
    .references(() => chunks.id)
    .notNull(),
  DMID: t
    .text()
    .references(() => danmakus.DMID)
    .notNull(),
});
export const chunk2danmakusZod = createInsertSchema(chunk2danmakus);

export const baseRelations = defineRelations({ danmakus, chunks, chunk2danmakus });
export const relations = defineRelationsPart({ danmakus, chunks, chunk2danmakus }, (r) => ({
  // pools: {
  //   danmakus: r.many.danmakus({
  //     from: r.pools.SOID,
  //     to: r.danmakus.SOID,
  //   }),
  // },
  chunks: {
    danmakus: r.many.danmakus({
      from: r.chunks.id.through(r.chunk2danmakus.chunkID),
      to: r.danmakus.DMID.through(r.chunk2danmakus.DMID),
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
    target: [danmakus.DMID],
    set: onConflictDoUpdateSet.danmakus,
  },
};

export const ModeSchema = z.enum(danmakus.mode.enumValues);
export const PoolSchema = z.enum(danmakus.pool.enumValues);
export const DMAttrSchema = z.enum(danmakus.attr.enumValues);
