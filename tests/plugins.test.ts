import { DanuniJsonAdapter, DanuniJsonTransformerConfigurator } from "@/adapters/index.ts";
import { defaultUniDM, InitedUniDB, UniDB, type UniChunk, type UniDMObj } from "@/core/index.ts";
import {
  getStatsTransformerConfigurator,
  downgradeAdvancedPluginConfigurator,
  getStatsUtil4getMost,
} from "@/plugins/index.ts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const now = new Date();
let udb: InitedUniDB;
let chunk: UniChunk;
let danuniJson: UniDMObj[];
beforeAll(async () => {
  udb = await new UniDB().init();
  const ori = await udb.import(
    DanuniJsonAdapter([
      {
        ...defaultUniDM,
        ctime: now,
        DMID: "",
        content: "test",
        extra: {
          danuni: {
            merge: {
              count: 100,
              duration: 10,
              senders: [],
              taolu_count: 100,
              taolu_senders: [],
            },
          },
        },
      },
      {
        ...defaultUniDM,
        ctime: now,
        DMID: "",
        platform: "bili",
        extra: {
          bili: {
            mode: 7,
            adv: '["0.355","0.27","0.8-0","0.6"," 真棒☺",0,0,"0.355",0,"500",0,0,"SimHei",1]',
          },
        },
      },
    ]),
  );
  chunk = await ori.plugin(downgradeAdvancedPluginConfigurator());
  danuniJson = await chunk.export(DanuniJsonTransformerConfigurator());
});
afterAll(async () => {
  await udb.close();
});

it("getStats", async () => {
  const stats = await chunk.export(getStatsTransformerConfigurator(["mode", "fontsize"]));
  console.info(stats);
  expect(stats.mode.get("Normal")).toBeUndefined();
  expect(stats.fontsize.get(36)).toBeUndefined();
  expect(stats.mode.get("Top")).toBe(2);
  expect(stats.fontsize.get(25)).toBe(2);
  console.info(getStatsUtil4getMost(stats.mode));
});

describe("弹幕降级", () => {
  it("danuni.merge", () => {
    const d = danuniJson[0];
    console.info(d);
    expect(d.content).toBe("test x100");
  });
  it("bili.adv", () => {
    const d = danuniJson[1];
    console.info(d);
    expect(d.content).toBe("[B站高级弹幕] 真棒☺");
  });
});
