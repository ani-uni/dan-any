import type { Plugin, Transformer, TransformerInput } from "@/adapters/index.ts";
import { db as nullableDb } from "./db/index.ts";
import { chunksZod, type DanmakusInsert } from "./db/schema.ts";
import type { Asyncify, Promisable } from "type-fest";
import type { z } from "zod";

export type AdapterStore = (udb: InitedUniDB, uchunk?: UniChunk) => Promisable<UniChunk>;

const db = nullableDb as NonNullable<typeof nullableDb>;
type UChunks = Awaited<ReturnType<typeof db.query.chunks.findMany>>;
export type UChunk = UChunks[number];
type UDanmakus = Awaited<ReturnType<typeof db.query.danmakus.findMany>>;
export type UDanmaku = UDanmakus[number];
type UChunk2Danmakus = Awaited<ReturnType<typeof db.query.chunk2danmakus.findMany>>;
export type UChunk2Danmaku = UChunk2Danmakus[number];

export abstract class UniDB {
  constructor(
    public $db: any,
    public DMIDGenerator: DMIDGenerator,
  ) {}
  abstract init(dump?: unknown): Promisable<InitedUniDB>;
  abstract close(): Promisable<void>;
}

export abstract class InitedUniDB extends UniDB {
  abstract dump(): Promisable<any>;
  abstract get $chunks(): Promisable<UChunks>;
  abstract get $danmakus(): Promisable<UDanmakus>;
  abstract listChunks(): Promisable<UniChunk[]>;
  abstract makeChunk(data: Omit<z.infer<typeof chunksZod>, "id">): Promisable<UniChunk>;
  abstract upsertDanmakus(
    data: DanmakusInsert[] | Map<string, DanmakusInsert>,
    dedupeDMID: boolean,
  ): Promisable<void>;
  /**
   * 清理临时chunks
   */
  abstract shrink(): Promisable<void>;
  abstract import(adapterStore: AdapterStore): Promisable<UniChunk>;
  abstract export<T extends Transformer | Asyncify<Transformer>>(
    transformer: T,
  ): Promisable<ReturnType<T>>;
}

export abstract class UniChunk {
  constructor(
    public $UniDB: InitedUniDB,
    public id: number,
  ) {}
  abstract get $db(): UniDB["$db"];
  static makeChunk(
    u: TransformerInput<InitedUniDB | UniChunk>,
    data: z.infer<typeof chunksZod>,
  ): Promisable<UniChunk> {
    return u instanceof InitedUniDB ? u.makeChunk(data) : u.$UniDB.makeChunk(data);
  }
  static assign(_base: UniChunk, _chunks: UniChunk[]): Promisable<UniChunk> {
    throw new Error("应当调用相应环境的实现");
  }
  /**
   * 比较两个chunk的弹幕是否相同
   * @description 可用于跨DB比较
   * @deprecated 建议调用相应环境的实现
   */
  static async compare(u1: UniChunk, u2: UniChunk) {
    const dms1 = await u1.$danmakus;
    const dms2 = await u2.$danmakus;
    if (dms1.length !== dms2.length) return false;
    const dmidSet = new Set<string>();
    for (const dm of dms1) {
      dmidSet.add(dm.DMID);
    }
    for (const dm of dms2) {
      const target = dmidSet.has(dm.DMID);
      if (!target) return false;
      if (JSON.stringify(target) !== JSON.stringify(dm)) return false;
    }
    return true;
  }
  /**
   * 获取当前chunk的数据库记录
   * @description 虽然数组仅会包含一个值，但这里保持数据库原始返回
   */
  abstract get $chunks(): Promisable<UChunks>;
  abstract $chunk(): Promisable<UChunk>;
  abstract get $danmakus(): Promisable<UDanmakus>;
  abstract get $count(): Promisable<number>;
  abstract get isDeleted(): Promisable<boolean>;
  abstract upsertDanmakus(
    data:
      | (DanmakusInsert & { DMID?: string; platform: string | null })[]
      | Map<string, DanmakusInsert & { platform: string | null }>,
    autoSetDMID?: boolean,
    dedupeDMID?: boolean,
  ): Promisable<void>;
  abstract import(adapterStore: AdapterStore): Promisable<UniChunk>;
  abstract export<T extends Transformer | Asyncify<Transformer>>(
    transformer: T,
  ): Promise<ReturnType<T>>;
  abstract plugin<T extends Plugin | Asyncify<Plugin>>(plugin: T): Promisable<ReturnType<T>>;
  abstract delete(): Promisable<void>;
}

export * from "./dm-extra.ts";
export * from "./dm.ts";
export * from "./id.ts";
export * from "./platform.ts";
export * from "./uni-id.ts";
import * as drizzle from "./main-drizzle.ts";
import * as pure from "./main-pure.ts";
import type { DMIDGenerator } from "./id.ts";
export const main = { drizzle, pure };
