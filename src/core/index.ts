import type { Plugin, Transformer, TransformerInput } from "@/adapters/index.ts";
import { closeDb, db, dumpDb, initDb } from "./db/index.ts";
import {
  chunks as chunksTable,
  chunksZod,
  danmakus,
  onConflictDoUpdate,
  type DanmakusInsert,
} from "./db/schema.ts";
import { eq } from "drizzle-orm";
import type { Asyncify, Promisable, Simplify } from "type-fest";
import { createDMID, type DMIDGenerator } from "./id.ts";
import type { z } from "zod";

export type AdapterStore = (udb: InitedUniDB, uchunk?: UniChunk) => Promisable<UniChunk>;

export class UniDB {
  constructor(
    public $drizzle = db,
    public DMIDGenerator: DMIDGenerator = createDMID,
  ) {}
  async init(dump?: File) {
    return new InitedUniDB(await initDb(dump), this.DMIDGenerator);
  }
  async dump() {
    const dump = await dumpDb(this.$drizzle!);
    return dump;
  }
  async close() {
    this.$drizzle = null;
    await closeDb();
  }
  /**
   * 合并弹幕库
   * @description 将多个chunk的弹幕合并到base chunk中，合并后原chunk会被删除
   * @param base 目标chunk，合并后其他chunk的弹幕会被移到这个chunk中
   * @param chunks 待合并的chunk列表，这些chunk中的弹幕会被移到base chunk中，合并后这些chunk会被删除
   * @returns 合并后的目标chunk实例
   * @throws 如果chunks列表为空，函数会直接返回base chunk；如果目标chunk在数据库中未找到，会抛出错误；如果chunks中有来自不同数据库的chunk且options.allowDifferentDB为false，也会抛出错误
   */
  static async assign(base: UniChunk, chunks: UniChunk[]) {
    if (chunks.length < 1) return base;
    const baseDB = base.$UniDB;
    const drizzle = baseDB.$drizzle;
    const targetId = base.id;
    const targetRow = await base.$chunk();
    let newFromConverted = targetRow.fromConverted;
    for (const c of chunks) {
      const srcDrizzle = c.$UniDB.$drizzle;
      const srcChunkRow = await c.$chunk();
      newFromConverted = newFromConverted && !!srcChunkRow.fromConverted;
      const srcDanmakus = await c.$danmakus;
      await base.upsertDanmakus(srcDanmakus, false, true);
      await srcDrizzle.delete(danmakus).where(eq(danmakus.chunkID, c.id));
      await srcDrizzle.delete(chunksTable).where(eq(chunksTable.id, c.id));
    }
    await drizzle
      .update(chunksTable)
      .set({ fromConverted: newFromConverted })
      .where(eq(chunksTable.id, targetId));
    return new UniChunk(baseDB, targetId);
  }
}

export class InitedUniDB extends UniDB {
  constructor(
    public $drizzle: NonNullable<UniDB["$drizzle"]>,
    public DMIDGenerator: DMIDGenerator = createDMID,
  ) {
    super($drizzle, DMIDGenerator);
  }
  get $db() {
    return this.$drizzle;
  }
  get $chunks() {
    return this.$drizzle.select().from(chunksTable);
  }
  get $danmakus() {
    return this.$drizzle.select().from(danmakus);
  }
  async listChunks() {
    const cs = await this.$chunks;
    return cs.map((c) => new UniChunk(this, c.id));
  }
  async makeChunk(data: z.infer<typeof chunksZod>) {
    return UniChunk.makeChunk(this, data);
  }
  async upsertDanmakus(data: DanmakusInsert[]) {
    await this.$db.insert(danmakus).values(data).onConflictDoUpdate(onConflictDoUpdate.danmakus);
  }
  async import(adapterStore: AdapterStore) {
    return adapterStore(this);
  }
  export<T extends Transformer>(transformer: T): ReturnType<T>;
  async export<T extends Asyncify<Transformer>>(transformer: T): Promise<ReturnType<T>>;
  export<T extends Transformer | Asyncify<Transformer>>(transformer: T): Promisable<ReturnType<T>> {
    return <ReturnType<T>>transformer(this.$danmakus, { DMIDGenerator: this.DMIDGenerator });
  }
}

export class UniChunk {
  /**
   * @description 任何修改chunkInfo的操作后都需要重置缓存；最佳实践是是完成更改后返回new Uni
   */
  #infoCache?: Awaited<UniChunk["$chunks"]>[0];
  constructor(
    public $UniDB: InitedUniDB,
    public id: number,
  ) {}
  get $db() {
    return this.$UniDB.$drizzle;
  }
  static async makeChunk(u: TransformerInput, data: z.infer<typeof chunksZod>) {
    const chunk = await u.$db.insert(chunksTable).values(data).returning();
    return new UniChunk(u instanceof InitedUniDB ? u : u.$UniDB, chunk[0].id);
  }
  /**
   * 获取当前chunk的数据库记录
   * @description 虽然数组仅会包含一个值，但这里保持数据库原始返回
   */
  get $chunks() {
    return this.$UniDB.$drizzle.select().from(chunksTable).where(eq(chunksTable.id, this.id));
  }
  async $chunk() {
    if (this.#infoCache) return this.#infoCache;
    const c = await this.$chunks;
    if (c.length === 0) throw new Error("Chunk not found");
    this.#infoCache = c[0];
    return this.#infoCache;
  }
  get $danmakus() {
    return this.$UniDB.$drizzle.select().from(danmakus).where(eq(danmakus.chunkID, this.id));
  }
  async upsertDanmakus(
    data: Simplify<DanmakusInsert & { DMID: string; chunkID: number }>[],
    autoSetDMID?: false,
    autoSetChunk?: false,
  ): Promise<void>;
  async upsertDanmakus(
    data: Simplify<DanmakusInsert & { DMID: string }>[],
    autoSetDMID?: false,
    autoSetChunk?: true,
  ): Promise<void>;
  async upsertDanmakus(
    data: Simplify<DanmakusInsert & { chunkID: number }>[],
    autoSetDMID?: true,
    autoSetChunk?: false,
  ): Promise<void>;
  async upsertDanmakus(
    data: DanmakusInsert[],
    autoSetDMID: true,
    autoSetChunk: true,
  ): Promise<void>;
  async upsertDanmakus(
    data: (DanmakusInsert & { DMID?: string; chunkID?: number })[],
    autoSetDMID = false,
    autoSetChunk = false,
  ) {
    if (autoSetDMID) data = data.map((d) => ({ ...d, DMID: this.$UniDB.DMIDGenerator(d) }));
    if (autoSetChunk) data = data.map((d) => ({ ...d, chunkID: this.id }));
    await this.$UniDB.upsertDanmakus(data);
  }
  async import(adapterStore: AdapterStore) {
    const chunk = await adapterStore(this.$UniDB, this);
    this.#infoCache = undefined;
    return chunk;
  }
  async export<T extends Transformer | Asyncify<Transformer>>(
    transformer: T,
  ): Promise<ReturnType<T>> {
    // transformer 格式转换器 不应对数据库执行任何写操作
    return <ReturnType<T>>transformer(this.$danmakus, {
      DMIDGenerator: this.$UniDB.DMIDGenerator,
      uchunk: await this.$chunk(),
    });
  }
  plugin<T extends Plugin>(plugin: T): ReturnType<T>;
  async plugin<T extends Asyncify<Plugin>>(plugin: T): Promise<ReturnType<T>>;
  plugin<T extends Plugin | Asyncify<Plugin>>(plugin: T): Promisable<ReturnType<T>> {
    const output = <ReturnType<T>>plugin(this);
    this.#infoCache = undefined;
    return output;
  }
  async delete() {
    await this.$db.delete(danmakus).where(eq(danmakus.chunkID, this.id));
    await this.$db.delete(chunksTable).where(eq(chunksTable.id, this.id));
  }
}

export * from "./dm.ts";
export * from "./id.ts";
export * from "./platform.ts";
