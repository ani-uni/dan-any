import { createDMID, type DMIDGenerator } from "./id.ts";
import * as base from "./index.ts";
import type { Plugin, Transformer, TransformerInput } from "@/adapters/index.ts";
import type { Asyncify, Promisable, Simplify } from "type-fest";
import { BigSerialMap, SerialMap } from "@/utils/serialMap.ts";
import { isSame } from "@/utils/isSame.ts";

type baseClassTrans<T> = base.baseClassTrans<T, UniDB, InitedUniDB, UniChunk>;

interface UJson {
  danmakus: base.UDanmaku[];
  chunks: ReturnType<SerialMap<base.UChunk>["toJSON"]>;
  chunk2danmakus: ReturnType<BigSerialMap<base.UChunk2Danmaku>["toJSON"]>;
}

interface UMaps {
  danmakus: Map<string, base.UDanmaku>;
  chunks: SerialMap<base.UChunk>;
  chunk2danmakus: BigSerialMap<base.UChunk2Danmaku>;
}

const emptyDB: UMaps = {
  danmakus: new Map(),
  chunks: new SerialMap(),
  chunk2danmakus: new BigSerialMap(),
};
export function initNewDb() {
  return { ...emptyDB };
}

export class UniDB implements base.UniDB {
  __isUniDB = true;
  constructor(
    public $db: UMaps = emptyDB,
    public DMIDGenerator: DMIDGenerator = createDMID,
  ) {}
  init($json?: UJson) {
    if ($json)
      this.$db = {
        danmakus: new Map($json.danmakus.map((d) => [d.DMID, d])),
        chunks: SerialMap.fromJSON($json.chunks),
        chunk2danmakus: BigSerialMap.fromJSON($json.chunk2danmakus),
      };
    else this.$db = emptyDB;
    return new InitedUniDB(this.$db, this.DMIDGenerator);
  }
  close() {
    this.$db = { danmakus: new Map(), chunks: new SerialMap(), chunk2danmakus: new BigSerialMap() };
  }
}

function $Private4InitedUniDB_upsertDanmakus(that: InitedUniDB, data: base.DanmakusInsert[]) {
  data.forEach((d) => {
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
    that.$db.danmakus.set(d.DMID, { ...d, platform: d.platform ?? null });
  });
}

export class InitedUniDB extends UniDB implements base.InitedUniDB {
  __isInitedUniDB = true;
  constructor(
    public $db: UMaps,
    public DMIDGenerator: DMIDGenerator = createDMID,
  ) {
    super($db, DMIDGenerator);
  }
  dump(): UJson {
    return {
      danmakus: [...this.$db.danmakus.values()],
      chunks: this.$db.chunks.toJSON(),
      chunk2danmakus: this.$db.chunk2danmakus.toJSON(),
    };
  }
  get $chunks() {
    return [...this.$db.chunks.values()];
  }
  get $danmakus() {
    return [...this.$db.danmakus.values()];
  }
  listChunks() {
    const cs = this.$chunks;
    return cs.map((c) => new UniChunk(this, c.id));
  }
  makeChunk(data: Omit<base.ChunksInsert, "id">) {
    const newID = this.$db.chunks.nextSerial;
    this.$db.chunks.set(newID, {
      id: newID,
      fromConverted: data.fromConverted ?? false,
      tmp: data.tmp ?? false,
    });
    return new UniChunk(this, newID);
  }
  upsertDanmakus(
    data: base.DanmakusInsert[] | Map<string, base.DanmakusInsert>,
    dedupeDMID = true,
  ) {
    if (data instanceof Map) this.upsertDanmakus([...data.values()], false);
    else if (dedupeDMID) {
      const map = new Map<string, base.DanmakusInsert>();
      data.forEach((d) => {
        map.set(d.DMID, d);
      });
      $Private4InitedUniDB_upsertDanmakus(this, [...map.values()]);
    } else $Private4InitedUniDB_upsertDanmakus(this, data);
  }
  purge() {
    const uchunks = this.$db.chunks.values().filter((c) => c.tmp);
    for (const c of uchunks) new UniChunk(this, c.id).delete();
  }
  shrink() {
    const canonicalDMIDs = new Map<string, string>();
    const canonicalDanmakus: base.UDanmaku[] = [];
    const duplicatedDMIDs = new Set<string>();

    for (const danmaku of this.$db.danmakus.values()) {
      const same = canonicalDanmakus.find((candidate) => isSame(candidate, danmaku));
      if (!same) {
        canonicalDMIDs.set(danmaku.DMID, danmaku.DMID);
        canonicalDanmakus.push(danmaku);
        continue;
      }

      const canonicalDMID = same.DMID;
      const nextDanmaku = { ...danmaku, DMID: canonicalDMID };
      const index = canonicalDanmakus.findIndex((candidate) => candidate.DMID === canonicalDMID);
      canonicalDMIDs.set(danmaku.DMID, canonicalDMID);
      duplicatedDMIDs.add(danmaku.DMID);
      if (index >= 0) canonicalDanmakus[index] = nextDanmaku;
      this.$db.danmakus.set(canonicalDMID, nextDanmaku);
    }

    for (const DMID of duplicatedDMIDs) {
      if (canonicalDMIDs.get(DMID) !== DMID) this.$db.danmakus.delete(DMID);
    }

    const oldMappings = this.$db.chunk2danmakus.values();
    const nextMappings = new Map<string, { chunkID: number; DMID: string }>();
    for (const mapping of oldMappings) {
      const DMID = canonicalDMIDs.get(mapping.DMID) ?? mapping.DMID;
      if (!this.$db.danmakus.has(DMID)) continue;
      nextMappings.set(`${mapping.chunkID}:${DMID}`, { chunkID: mapping.chunkID, DMID });
    }

    this.$db.chunk2danmakus.clear();
    for (const mapping of nextMappings.values()) {
      const id = this.$db.chunk2danmakus.nextSerial;
      this.$db.chunk2danmakus.set(id, { id, ...mapping });
    }
  }
  import(adapterStore: base.AdapterStore): Promisable<UniChunk> {
    return <Promisable<UniChunk>>adapterStore(this);
  }
  export<T extends Transformer>(transformer: T): ReturnType<T>;
  async export<T extends Asyncify<Transformer>>(transformer: T): Promise<ReturnType<T>>;
  export<T extends Transformer | Asyncify<Transformer>>(transformer: T): Promisable<ReturnType<T>> {
    return <ReturnType<T>>transformer(this.$danmakus, { DMIDGenerator: this.DMIDGenerator });
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
  static makeChunk(u: TransformerInput<InitedUniDB | UniChunk>, data: base.ChunksInsert): UniChunk {
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
  static assign(base: UniChunk, chunks: UniChunk[]) {
    if (chunks.length < 1) return base;
    const targetId = base.id;
    const targetRow = base.$chunk();
    let newFromConverted = targetRow.fromConverted;
    for (const c of chunks) {
      const srcChunkRow = c.$chunk();
      newFromConverted = newFromConverted && !!srcChunkRow.fromConverted;
      base.upsertDanmakus(c.$danmakus, false);
      c.delete();
    }
    base.$db.chunks.set(targetId, { ...targetRow, fromConverted: newFromConverted });
    return new UniChunk(base.$UniDB, targetId);
  }
  /**
   * 比较两个chunk的弹幕是否相同
   * @description 可用于跨DB比较
   */
  static compare(u1: UniChunk, u2: UniChunk) {
    const dms1 = u1.$danmakus;
    const dms2 = u2.$danmakus;
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
  get $chunks() {
    const chunk = this.$db.chunks.get(this.id);
    return chunk ? [chunk] : [];
  }
  $chunk() {
    const c = this.$chunks;
    return c[0];
  }
  get $danmakus() {
    const c2d = this.$db.chunk2danmakus.values().filter((cd) => cd.chunkID === this.id);
    const ds = c2d
      .map((cd) => this.$db.danmakus.get(cd.DMID))
      .filter((d): d is base.UDanmaku => !!d);
    return [...ds];
  }
  get $count() {
    const c2d = this.$db.chunk2danmakus.values().filter((cd) => cd.chunkID === this.id);
    return c2d.reduce((acc) => acc + 1, 0);
  }
  get isDeleted() {
    return !this.$db.chunks.has(this.id);
  }
  upsertDanmakus(
    data: Map<string, base.DanmakusInsert & { platform: string | null }>,
    autoSetDMID?: false,
    dedupeDMID?: false,
  ): void;
  upsertDanmakus(
    data: Simplify<base.DanmakusInsert & { DMID: string; platform: string | null }>[],
    autoSetDMID?: false,
    dedupeDMID?: boolean,
  ): void;
  upsertDanmakus(
    data: Simplify<base.DanmakusInsert & { DMID?: undefined }>[],
    autoSetDMID: true,
    dedupeDMID?: true,
  ): void;
  upsertDanmakus(
    data:
      | (base.DanmakusInsert & { DMID?: string; platform: string | null })[]
      | Map<string, base.DanmakusInsert & { platform: string | null }>,
    autoSetDMID = false,
    dedupeDMID = true,
  ) {
    const dmids = new Set<string>();
    if (data instanceof Map) {
      this.$UniDB.upsertDanmakus([...data.values()], false);
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
      this.$UniDB.upsertDanmakus(data, dedupeDMID);
    }
    dmids.forEach((dmid) => {
      const chunk2danmakuID = this.$db.chunk2danmakus.nextSerial;
      this.$db.chunk2danmakus.set(chunk2danmakuID, {
        id: chunk2danmakuID,
        chunkID: this.id,
        DMID: dmid,
      });
    });
  }
  import(adapterStore: base.AdapterStore): Promisable<UniChunk> {
    return <Promisable<UniChunk>>adapterStore(this.$UniDB, this);
  }
  export<T extends Transformer>(transformer: T): ReturnType<T>;
  async export<T extends Asyncify<Transformer>>(transformer: T): Promise<ReturnType<T>>;
  export<T extends Transformer | Asyncify<Transformer>>(transformer: T): Promisable<ReturnType<T>> {
    // transformer 格式转换器 不应对数据库执行任何写操作
    return <ReturnType<T>>transformer(this.$danmakus, {
      DMIDGenerator: this.$UniDB.DMIDGenerator,
      uchunk: this.$chunk(),
    });
  }
  plugin<T extends Plugin>(plugin: T): baseClassTrans<ReturnType<T>>;
  plugin<T extends Asyncify<Plugin>>(plugin: T): Promise<baseClassTrans<ReturnType<T>>>;
  plugin<T extends Plugin | Asyncify<Plugin>>(
    plugin: T,
  ): Promisable<baseClassTrans<ReturnType<T>>> {
    const output = <baseClassTrans<ReturnType<T>>>plugin(this);
    return output;
  }
  delete() {
    const DMIDs = new Set<string>();
    this.$db.chunk2danmakus.forEach((cd) => {
      if (cd.chunkID === this.id) {
        DMIDs.add(cd.DMID);
        this.$db.chunk2danmakus.delete(cd.id);
      }
    });
    // 对于不再被任何 chunk 引用的弹幕，删除它们
    DMIDs.forEach((dmid) => {
      const still = this.$db.chunk2danmakus.values().some((cd) => cd.DMID === dmid);
      if (!still) this.$db.danmakus.delete(dmid);
    });
    this.$db.chunks.delete(this.id);
  }
}
