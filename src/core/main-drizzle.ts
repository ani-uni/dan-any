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
import { array2chunk } from "@/utils/array2chunk.ts";
import * as base from "./index.ts";

type baseClassTrans<T> = base.baseClassTrans<T, UniDB, InitedUniDB, UniChunk>;

export class UniDB implements base.UniDB {
  __isUniDB = true;
  constructor(
    public $db = db,
    public DMIDGenerator: DMIDGenerator = createDMID,
  ) {}
  async init(dump?: File) {
    return new InitedUniDB(await initDb(dump), this.DMIDGenerator);
  }
  async close() {
    this.$db = null;
    await closeDb();
  }
}

async function $Private4InitedUniDB_upsertDanmakus(that: InitedUniDB, data: DanmakusInsert[]) {
  data = data.map((d) => {
    const rawContent = d.content;
    // oxlint-disable-next-line no-control-regex
    d.content = rawContent.replace(/[\x00-\x1F\x7F]/g, "");
    if (d.content !== rawContent)
      d.extra = {
        ...d.extra,
        danuni: {
          ...d.extra?.danuni,
          raw: {
            ...d.extra?.danuni?.raw,
            content: Buffer.from(rawContent, "utf8").toString("base64"),
          },
        },
      };
    return d;
  });
  for (const c of array2chunk(data, 2340))
    await that.$db.insert(danmakus).values(c).onConflictDoUpdate(onConflictDoUpdate.danmakus);
}

export class InitedUniDB extends UniDB implements base.InitedUniDB {
  __isInitedUniDB = true;
  constructor(
    public $db: NonNullable<UniDB["$db"]>,
    public DMIDGenerator: DMIDGenerator = createDMID,
  ) {
    super($db, DMIDGenerator);
  }
  async dump() {
    const dump = await dumpDb(this.$db);
    return dump;
  }
  get $chunks() {
    return Promise.resolve(this.$db.query.chunks.findMany());
  }
  get $danmakus() {
    return Promise.resolve(
      this.$db.query.chunks
        .findFirst({
          with: {
            danmakus: true,
          },
        })
        .then((data) => data?.danmakus ?? []),
    );
  }
  async listChunks() {
    const cs = await this.$chunks;
    return cs.map((c) => new UniChunk(this, c.id));
  }
  async makeChunk(data: Omit<z.infer<typeof chunksZod>, "id">) {
    const chunk = await this.$db.insert(chunksTable).values(data).returning();
    return new UniChunk(this, chunk[0].id);
  }
  async upsertDanmakus(data: DanmakusInsert[] | Map<string, DanmakusInsert>, dedupeDMID = true) {
    if (data instanceof Map) await this.upsertDanmakus([...data.values()], false);
    else if (dedupeDMID) {
      const map = new Map<string, DanmakusInsert>();
      data.forEach((d) => {
        map.set(d.DMID, d);
      });
      await $Private4InitedUniDB_upsertDanmakus(this, [...map.values()]);
    } else await $Private4InitedUniDB_upsertDanmakus(this, data);
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
  import(adapterStore: base.AdapterStore): Promisable<UniChunk> {
    return <Promisable<UniChunk>>adapterStore(this);
  }
  async export<T extends Transformer>(transformer: T) {
    return <ReturnType<T>>transformer(await this.$danmakus, { DMIDGenerator: this.DMIDGenerator });
  }
}

export class UniChunk implements base.UniChunk {
  __isUniChunk = true;
  constructor(
    public $UniDB: InitedUniDB,
    public id: number,
  ) {}
  get $db() {
    return this.$UniDB.$db;
  }
  static async makeChunk(
    u: TransformerInput<InitedUniDB | UniChunk>,
    data: z.infer<typeof chunksZod>,
  ) {
    return u instanceof InitedUniDB ? u.makeChunk(data) : u.$UniDB.makeChunk(data);
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
    await baseDB.$db
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
  get $count() {
    return this.$db.$count(chunk2danmakus, eq(chunk2danmakus.chunkID, this.id));
  }
  get isDeleted() {
    return this.$chunks.then((cs) => cs.length === 0);
  }
  async upsertDanmakus(
    data: Map<string, DanmakusInsert & { platform: string | null }>,
    autoSetDMID?: false,
    dedupeDMID?: false,
  ): Promise<void>;
  async upsertDanmakus(
    data: Simplify<DanmakusInsert & { DMID: string; platform: string | null }>[],
    autoSetDMID?: false,
    dedupeDMID?: boolean,
  ): Promise<void>;
  async upsertDanmakus(
    data: Simplify<DanmakusInsert & { DMID?: undefined }>[],
    autoSetDMID: true,
    dedupeDMID?: true,
  ): Promise<void>;
  async upsertDanmakus(
    data:
      | (DanmakusInsert & { DMID?: string; platform: string | null })[]
      | Map<string, DanmakusInsert & { platform: string | null }>,
    autoSetDMID = false,
    dedupeDMID = true,
  ) {
    const dmids = new Set<string>();
    if (data instanceof Map) {
      await this.$UniDB.upsertDanmakus([...data.values()], false);
      data.forEach((d) => dmids.add(d.DMID));
    } else {
      if (autoSetDMID)
        data = data.map((d) => {
          const DMID = this.$UniDB.DMIDGenerator(d);
          dmids.add(DMID);
          return { ...d, DMID };
        });
      else
        data.forEach((d) => {
          dmids.add(d.DMID!);
        });
      await this.$UniDB.upsertDanmakus(data, dedupeDMID);
    }
    for (const c of array2chunk(
      [...dmids].map((DMID) => ({ chunkID: this.id, DMID })),
      2340,
    ))
      await this.$db.insert(chunk2danmakus).values(c).onConflictDoNothing();
  }
  import(adapterStore: base.AdapterStore): Promisable<UniChunk> {
    return <Promisable<UniChunk>>adapterStore(this.$UniDB, this);
  }
  async export<T extends Transformer>(transformer: T) {
    // transformer 格式转换器 不应对数据库执行任何写操作
    return <ReturnType<T>>transformer(await this.$danmakus, {
      DMIDGenerator: this.$UniDB.DMIDGenerator,
      uchunk: await this.$chunk(),
    });
  }
  plugin<T extends Plugin>(plugin: T): baseClassTrans<ReturnType<T>>;
  async plugin<T extends Asyncify<Plugin>>(plugin: T): Promise<baseClassTrans<ReturnType<T>>>;
  plugin<T extends Plugin | Asyncify<Plugin>>(
    plugin: T,
  ): Promisable<baseClassTrans<ReturnType<T>>> {
    const output = <baseClassTrans<ReturnType<T>>>plugin(this);
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
