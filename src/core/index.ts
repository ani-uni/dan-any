import type { Plugin, Transformer, TransformerInput } from "@/adapters/index.ts";
import type { Asyncify, Promisable } from "type-fest";
import { createDMID, type DMIDGenerator } from "./id.ts";
import type { Extra } from "./dm-extra.ts";

export type AdapterStore = (udb: InitedUniDB, uchunk?: UniChunk) => Promisable<UniChunk>;

export interface UChunk {
  fromConverted: boolean;
  id: number;
  tmp: boolean;
}
export interface UDanmaku {
  DMID: string;
  SOID: string;
  attr: (
    | "Compatible"
    | "FromLive"
    | "HasEvent"
    | "Hide"
    | "HighLike"
    | "Protect"
    | "Reported"
    | "Unchecked"
  )[];
  color: number;
  content: string;
  ctime: Date;
  extra: Extra | null;
  fontsize: number;
  mode: "Bottom" | "Ext" | "Normal" | "Reverse" | "Top";
  platform: string | null;
  pool: "Adv" | "Def" | "Ix" | "Sub";
  progress: number;
  senderID: string;
  weight: number;
}
export interface UChunk2Danmaku {
  DMID: string;
  chunkID: number;
  id: bigint;
}

export interface ChunksInsert {
  id?: number | undefined;
  fromConverted?: boolean | undefined;
  tmp?: boolean | undefined;
}
export interface DanmakusInsert {
  SOID: string;
  DMID: string;
  progress: number;
  mode: "Bottom" | "Ext" | "Normal" | "Reverse" | "Top";
  fontsize: number;
  color: number;
  senderID: string;
  content: string;
  ctime: Date;
  weight: number;
  pool: "Adv" | "Def" | "Ix" | "Sub";
  attr: (
    | "Compatible"
    | "FromLive"
    | "HasEvent"
    | "Hide"
    | "HighLike"
    | "Protect"
    | "Reported"
    | "Unchecked"
  )[];
  platform?: string | null | undefined;
  extra: Extra | null;
}

export type baseClassTrans<T, ImplUniDB, ImplInitedUniDB, ImplUniChunk> = baseUniChunkTransX<
  baseInitedUniDBTransX<baseUniDBTransX<T, ImplUniDB>, ImplInitedUniDB>,
  ImplUniChunk
>;

type baseUniDBTrans<T, ImplClass> = T extends UniDB ? ImplClass : T;
type baseUniDBTransPromise<T, ImplClass> = T extends Promise<UniDB> ? Promise<ImplClass> : T;
type baseUniDBTransX<T, ImplClass> = baseUniDBTransPromise<baseUniDBTrans<T, ImplClass>, ImplClass>;
export abstract class UniDB {
  __isUniDB = true;
  static [Symbol.hasInstance](obj: any) {
    return obj?.__isUniDB === true;
  }
  constructor(
    public $db: any,
    public DMIDGenerator: DMIDGenerator = createDMID,
  ) {}
  abstract init(dump?: unknown): Promisable<InitedUniDB>;
  abstract close(): Promisable<void>;
}

type baseInitedUniDBTrans<T, ImplClass> = T extends InitedUniDB ? ImplClass : T;
type baseInitedUniDBTransPromise<T, ImplClass> =
  T extends Promise<InitedUniDB> ? Promise<ImplClass> : T;
type baseInitedUniDBTransX<T, ImplClass> = baseInitedUniDBTransPromise<
  baseInitedUniDBTrans<T, ImplClass>,
  ImplClass
>;
export abstract class InitedUniDB extends UniDB {
  __isInitedUniDB = true;
  static [Symbol.hasInstance](obj: any) {
    return obj?.__isInitedUniDB === true;
  }
  constructor(
    public $db: NonNullable<UniDB["$db"]>,
    public DMIDGenerator: DMIDGenerator = createDMID,
  ) {
    super($db, DMIDGenerator);
  }
  abstract dump(): Promisable<any>;
  abstract get $chunks(): Promisable<UChunk[]>;
  abstract get $danmakus(): Promisable<UDanmaku[]>;
  abstract listChunks(): Promisable<UniChunk[]>;
  abstract makeChunk(data: Omit<ChunksInsert, "id">): Promisable<UniChunk>;
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

type baseUniChunkTrans<T, ImplClass> = T extends UniChunk ? ImplClass : T;
type baseUniChunkTransPromise<T, ImplClass> = T extends Promise<UniChunk> ? Promise<ImplClass> : T;
type baseUniChunkTransX<T, ImplClass> = baseUniChunkTransPromise<
  baseUniChunkTrans<T, ImplClass>,
  ImplClass
>;
export abstract class UniChunk {
  __isUniChunk = true;
  static [Symbol.hasInstance](obj: any) {
    return obj?.__isUniChunk === true;
  }
  constructor(
    public $UniDB: InitedUniDB,
    public id: number,
  ) {}
  abstract get $db(): UniDB["$db"];
  static makeChunk(
    u: TransformerInput<InitedUniDB | UniChunk>,
    data: ChunksInsert,
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
  abstract get $chunks(): Promisable<UChunk[]>;
  abstract $chunk(): Promisable<UChunk>;
  abstract get $danmakus(): Promisable<UDanmaku[]>;
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
