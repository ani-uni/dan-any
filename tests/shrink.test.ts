import { defaultUniDM } from "@/core/dm.ts";
import { danmakus as danmakusTable } from "@/core/db/schema.ts";
import type { DanmakusInsert, DMIDGenerator } from "@/core/index.ts";
import { UniDB as DrizzleUniDB } from "@/core/main-drizzle.ts";
import { UniDB as PureUniDB } from "@/core/main-pure.ts";
import { describe, expect, it } from "vite-plus/test";

function makeSameDanmakus(DMIDGenerator: DMIDGenerator) {
  const base = {
    ...defaultUniDM,
    SOID: "same-source",
    progress: 1000,
    mode: "Normal" as const,
    fontsize: 25,
    color: 0xffffff,
    senderID: "same-user",
    content: "same content",
    ctime: new Date(0),
    weight: 0,
    pool: "Def" as const,
    attr: [],
    platform: "youku",
  };
  const first = { ...base, extra: null };
  const second = { ...base, ctime: new Date(1000), weight: 7, extra: { danuni: {} } };
  return [
    { ...first, DMID: DMIDGenerator(first) },
    { ...second, DMID: DMIDGenerator(second) },
  ] satisfies (DanmakusInsert & { DMID: string; platform: string | null })[];
}

describe("udb.shrink", () => {
  it("dedupes pure backend and rewrites chunk mappings", () => {
    const udb = new PureUniDB().init();
    const [first, second] = makeSameDanmakus(udb.DMIDGenerator);
    const chunkA = udb.makeChunk({});
    const chunkB = udb.makeChunk({});

    expect(first.DMID).not.toBe(second.DMID);
    chunkA.upsertDanmakus([first], false);
    chunkB.upsertDanmakus([second], false);
    expect(udb.$danmakus).toHaveLength(2);

    udb.shrink();

    expect(udb.$danmakus).toHaveLength(1);
    expect(chunkA.$danmakus).toHaveLength(1);
    expect(chunkB.$danmakus).toHaveLength(1);
    expect(chunkA.$danmakus[0].DMID).toBe(first.DMID);
    expect(chunkB.$danmakus[0].DMID).toBe(first.DMID);
    expect(chunkA.$danmakus[0].ctime).toEqual(second.ctime);
    expect(chunkA.$danmakus[0].weight).toBe(second.weight);
    udb.close();
  });

  it(
    "dedupes drizzle backend and rewrites chunk mappings",
    async () => {
      const udb = await new DrizzleUniDB().init();
      const [first, second] = makeSameDanmakus(udb.DMIDGenerator);
      const chunkA = await udb.makeChunk({});
      const chunkB = await udb.makeChunk({});

      expect(first.DMID).not.toBe(second.DMID);
      await chunkA.upsertDanmakus([first], false);
      await chunkB.upsertDanmakus([second], false);
      expect(await udb.$db.select().from(danmakusTable)).toHaveLength(2);
      expect(await chunkA.$danmakus).toHaveLength(1);
      expect(await chunkB.$danmakus).toHaveLength(1);
      expect((await chunkA.$danmakus)[0].DMID).toBe(first.DMID);
      expect((await chunkB.$danmakus)[0].DMID).toBe(second.DMID);

      await udb.shrink();

      const danmakus = await udb.$db.select().from(danmakusTable);
      const chunkADanmakus = await chunkA.$danmakus;
      const chunkBDanmakus = await chunkB.$danmakus;

      expect(danmakus).toHaveLength(1);
      expect(chunkADanmakus).toHaveLength(1);
      expect(chunkBDanmakus).toHaveLength(1);
      expect(chunkADanmakus[0].DMID).toBe(first.DMID);
      expect(chunkBDanmakus[0].DMID).toBe(first.DMID);
      expect(chunkADanmakus[0].ctime).toEqual(second.ctime);
      expect(chunkADanmakus[0].weight).toBe(second.weight);
      await udb.close();
    },
    100 * 1000,
  );
});
