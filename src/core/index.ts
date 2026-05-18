import type { Plugin, Transformer, TransformerInput } from "@/adapters/index.ts";
import { closeDb, db, dumpDb, initDb } from "./db/index.ts";
import {
  chunks as chunksTable,
  chunksZod,
  danmakus,
  chunk2danmakus,
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
    return this.$db.query.chunks.findMany();
  }
  get $danmakus() {
    return this.$db.query.chunks
      .findFirst({
        with: {
          danmakus: true,
        },
      })
      .then((data) => data?.danmakus ?? []);
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
  /**
   * 清理临时chunks
   */
  async shrink() {
    const uchunks = await this.$db.query.chunks.findMany({
      where: {
        tmp: true,
      },
    });
    for (const c of uchunks) await new UniChunk(this, c.id).delete();
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
      const srcChunkRow = await c.$chunk();
      newFromConverted = newFromConverted && !!srcChunkRow.fromConverted;
      const srcDanmakus = await c.$danmakus;
      await base.upsertDanmakus(srcDanmakus, false);
      await c.delete();
    }
    await drizzle
      .update(chunksTable)
      .set({ fromConverted: newFromConverted })
      .where(eq(chunksTable.id, targetId));
    return new UniChunk(baseDB, targetId);
  }
  /**
   * 比较两个chunk的弹幕是否相同
   * @description 可用于跨DB比较
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
  get $chunks() {
    return this.$db.select().from(chunksTable).where(eq(chunksTable.id, this.id));
  }
  async $chunk() {
    const c = await this.$chunks;
    return c[0];
  }
  get $danmakus() {
    return this.$db.query.chunks
      .findFirst({
        where: {
          id: this.id,
        },
        with: {
          danmakus: true,
        },
      })
      .then((data) => data?.danmakus ?? []);
  }
  async upsertDanmakus(
    data: Simplify<DanmakusInsert & { DMID: string }>[],
    autoSetDMID?: false,
  ): Promise<void>;
  async upsertDanmakus(
    data: Simplify<DanmakusInsert & { DMID?: undefined }>[],
    autoSetDMID: true,
  ): Promise<void>;
  async upsertDanmakus(data: (DanmakusInsert & { DMID?: string })[], autoSetDMID = false) {
    if (autoSetDMID) data = data.map((d) => ({ ...d, DMID: this.$UniDB.DMIDGenerator(d) }));
    // 写入/更新 danmakus 表
    await this.$UniDB.upsertDanmakus(data);
    await this.$db
      .insert(chunk2danmakus)
      .values(data.map((d) => ({ chunkID: this.id, DMID: d.DMID })))
      .onConflictDoNothing();
  }
  async import(adapterStore: AdapterStore) {
    const chunk = await adapterStore(this.$UniDB, this);
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
    return output;
  }
  async delete() {
    await this.$db.transaction(async (tx) => {
      // 1) 查询当前 chunk 对应的 DMID 列表
      const maps = await tx
        .select()
        .from(chunk2danmakus)
        .where(eq(chunk2danmakus.chunkID, this.id));
      const DMIDs = maps.map((m) => m.DMID);
      // 2) 删除映射关系
      await tx.delete(chunk2danmakus).where(eq(chunk2danmakus.chunkID, this.id));
      // 3) 对于不再被任何 chunk 引用的弹幕，删除它们
      for (const id of DMIDs) {
        const still = await tx.select().from(chunk2danmakus).where(eq(chunk2danmakus.DMID, id));
        if (still.length === 0) {
          await tx.delete(danmakus).where(eq(danmakus.DMID, id));
        }
      }
      // 4) 删除 chunk 本身
      await tx.delete(chunksTable).where(eq(chunksTable.id, this.id));
    });
  }
}

export * from "./dm.ts";
export * from "./id.ts";
export * from "./platform.ts";
