import { BiliXmlAdapter } from "@/adapters/index.ts";
import { defaultUniDM, UniDB, type InitedUniDB, type UniChunk } from "@/core/index.ts";
import { isSame } from "@/utils/index.ts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const xml = `<i>
<chatserver>chat.bilibili.com</chatserver>
<chatid>1156756312</chatid>
<mission>0</mission>
<maxlimit>2947</maxlimit>
<state>0</state>
<real_name>0</real_name>
<source>k-v</source>
<d p="13.213,1,25,16777215,1686314041,3,ff41173d,1335658005672492032">喜欢</d>
<d p="13.331,1,25,16777215,1686948453,3,56a3c5d5,1340979831550069760">不喜欢</d>
<d p="13.374,1,25,16777215,1686300770,3,647fe355,1335546672880933888">不喜欢</d>
<d p="13.499,1,25,16777215,1686301548,3,2848bf1c,1335553202649003264">不喜欢</d>
</i>`;

let udb: InitedUniDB;
let chunk: UniChunk;
let json: Awaited<UniChunk["$danmakus"]>;
beforeAll(async () => {
  udb = await new UniDB().init();
  chunk = await udb.import(BiliXmlAdapter(xml));
  json = await chunk.$danmakus;
});
afterAll(async () => {
  await udb.close();
});

describe("其它", () => {
  it("比较(常规)", () => {
    // 确保测试用例为预期值
    expect(json[0].content).toBe("喜欢");
    expect(json[1].content).toBe("不喜欢");
    // 正式测试
    const a = isSame(json[0], json[1]);
    const b = isSame(json[1], json[2]);
    const c = isSame(json[1], json[3]);
    console.info(a, b, c);
    expect(a).toBe(false);
    expect(b).toBe(false);
    expect(c).toBe(false);
  });
  it("比较(extra)", () => {
    const now = new Date();
    const commonSample = {
      ...defaultUniDM,
      mode: "Normal",
      pool: "Def",
      ctime: now,
      DMID: "",
      SOID: "test@du",
      content: "T Sample",
      extra: {
        danuni: {
          merge: {
            count: 1,
            duration: 0,
            senders: ["test@du"],
            taolu_count: 1,
            taolu_senders: ["test@du"],
          },
        },
      },
    } satisfies Omit<Awaited<UniChunk["$danmakus"]>[number], "chunkID">;
    const pool2 = [
      { ...commonSample, extra: null },
      { ...commonSample, extra: {} },
      { ...commonSample, extra: { danuni: {} } },
      { ...commonSample },
      { ...commonSample, extra: { artplayer: { border: true } } },
    ] satisfies Omit<Awaited<UniChunk["$danmakus"]>[number], "chunkID">[];
    let counter = 0;
    for (const pool of pool2) {
      pool.DMID = chunk.$UniDB.DMIDGenerator({ ...pool });
      console.info(pool.extra);
      console.info(isSame(pool, pool2[0]));
      if (counter <= 2) expect(pool2[0].extra).toBe(null);
      counter++;
    }
    expect(isSame(pool2[0], pool2[1])).toBe(true);
    expect(isSame(pool2[0], pool2[2])).toBe(true);
    expect(isSame(pool2[0], pool2[3])).toBe(false);
    expect(isSame(pool2[0], pool2[3], { skipDanuniMerge: true })).toBe(true);
    expect(isSame(pool2[0], pool2[4])).toBe(false);
  });
});
