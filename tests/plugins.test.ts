import {
  BiliXmlAdapter,
  DanuniJsonAdapter,
  DanuniJsonTransformerConfigurator,
} from "@/adapters/index.ts";
import { type UniDMObj, defaultUniDM } from "@/core/dm.ts";
import { InitedUniDB, UniChunk, UniDB } from "@/core/main-drizzle.ts";
import {
  MergePluginConfigurator,
  GetStatsTransformerConfigurator,
  DowngradeAdvancedPluginConfigurator,
  GetStatsUtil4getMost,
  HeatmapTransformerConfigurator,
  HeatmapUtils,
} from "@/plugins/index.ts";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

const xml = `<i>
<chatserver>chat.bilibili.com</chatserver>
<chatid>1156756312</chatid>
<mission>0</mission>
<maxlimit>2947</maxlimit>
<state>0</state>
<real_name>0</real_name>
<source>k-v</source>
<d p="13.213,1,25,16777215,1686314041,3,ff41173d,1335658005672492032">喜欢</d>
<d p="13.213,1,25,16777215,1686590010,0,296b35b5,1337972999512832512">来了 哈哈~~</d>
<d p="13.246,1,25,16777215,1686276875,0,5664cfc4,1335346233459549696">就是</d>
<d p="13.266,1,25,16777215,1686283375,0,c7e6646f,1335400761013670912">什么鬼？</d>
<d p="13.284,1,25,16777215,1686291338,0,38662881,1335467554877267456">哇哦</d>
<d p="13.306,1,25,16777215,1686268410,0,4c01de10,1335275224983600896">试试</d>
<d p="13.331,1,25,16777215,1686948453,3,56a3c5d5,1340979831550069760">不喜欢</d>
<d p="13.374,1,25,16777215,1686300770,3,647fe355,1335546672880933888">不喜欢</d>
<d p="13.376,1,25,16777215,1686297921,0,469d94b8,1335522778300134400">哦豁</d>
<d p="13.419,1,25,8700107,1686268005,0,be402447,1335271828100244224">太酷啦</d>
<d p="13.419,1,25,16777215,1686316828,3,7ffb6619,1335681385016736768">喜欢</d>
<d p="13.459,1,25,16777215,1686299729,0,45834405,1335537942797634048">一般，不好看</d>
<d p="13.462,1,25,16777215,1686302133,0,3cab672c,1335558106620590080">哈哈哈</d>
<d p="13.481,1,25,16777215,1686297342,0,ce67fafd,1335517923728804864">？</d>
<d p="13.499,1,25,16777215,1686301548,3,2848bf1c,1335553202649003264">不喜欢</d>
</i>`;

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
  chunk = await ori.plugin(DowngradeAdvancedPluginConfigurator());
  danuniJson = await chunk.export(DanuniJsonTransformerConfigurator());
});
afterAll(async () => {
  await udb.purge();
  await udb.shrink();
  await udb.close();
});

it("getStats", async () => {
  const stats = await chunk.export(GetStatsTransformerConfigurator(["mode", "fontsize"]));
  console.info(stats);
  expect(stats.mode.get("Normal")).toBeUndefined();
  expect(stats.fontsize.get(36)).toBeUndefined();
  expect(stats.mode.get("Top")).toBe(2);
  expect(stats.fontsize.get(25)).toBe(2);
  console.info(GetStatsUtil4getMost(stats.mode));
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

it("merge", async () => {
  const c = await udb.import(BiliXmlAdapter(xml));
  const merged = await c.plugin(MergePluginConfigurator(10));
  const dms = await merged.export(DanuniJsonTransformerConfigurator({ minify: true }));
  console.info(dms);
  expect(dms.filter((d) => d.content === "喜欢").length).toBe(1);
  expect(dms.filter((d) => d.content === "不喜欢").length).toBe(1);
});

describe("弹幕热力图", () => {
  function sumHeatmap(heatmap: { time: number; count: number }[]): number {
    return heatmap.reduce((sum, point) => sum + point.count, 0);
  }
  it("空弹幕数组应返回空结果", async () => {
    const emptyChunk = await udb.import(DanuniJsonAdapter([]));
    const heatmap = await emptyChunk.export(HeatmapTransformerConfigurator());
    expect(heatmap).toEqual([]);
  });

  it("默认粒度为1秒", async () => {
    const testData = [
      { ...defaultUniDM, ctime: now, DMID: "", content: "a", progress: 0 },
      { ...defaultUniDM, ctime: now, DMID: "", content: "b", progress: 500 },
      { ...defaultUniDM, ctime: now, DMID: "", content: "c", progress: 1500 },
    ];
    const testChunk = await udb.import(DanuniJsonAdapter(testData));
    const heatmap = await testChunk.export(HeatmapTransformerConfigurator());

    expect(heatmap.length).toBe(2);
    expect(heatmap[0]).toEqual({ time: 0, count: 2 }); // 0ms 和 500ms
    expect(heatmap[1]).toEqual({ time: 1000, count: 1 }); // 1500ms
    expect(sumHeatmap(heatmap)).toBe(3);
  });

  it("自定义粒度", async () => {
    const testData = [
      { ...defaultUniDM, ctime: now, DMID: "", content: "a", progress: 0 },
      { ...defaultUniDM, ctime: now, DMID: "", content: "b", progress: 500 },
      { ...defaultUniDM, ctime: now, DMID: "", content: "c", progress: 1500 },
    ];
    const testChunk = await udb.import(DanuniJsonAdapter(testData));
    const heatmap = await testChunk.export(HeatmapTransformerConfigurator({ granularity: 500 }));

    expect(heatmap.length).toBe(4);
    expect(heatmap[0]).toEqual({ time: 0, count: 1 });
    expect(heatmap[1]).toEqual({ time: 500, count: 1 });
    expect(heatmap[2]).toEqual({ time: 1000, count: 0 });
    expect(heatmap[3]).toEqual({ time: 1500, count: 1 });
    expect(sumHeatmap(heatmap)).toBe(3);
  });

  it("自动计算视频长度", async () => {
    const testData = [
      { ...defaultUniDM, ctime: now, DMID: "", content: "a", progress: 1000 },
      { ...defaultUniDM, ctime: now, DMID: "", content: "b", progress: 5000 },
    ];
    const testChunk = await udb.import(DanuniJsonAdapter(testData));
    const heatmap = await testChunk.export(HeatmapTransformerConfigurator());

    // 最大 progress 为 5000ms，默认粒度 1000ms
    // floor(5000/1000) + 1 = 6 个桶
    expect(heatmap.length).toBe(6); // 0-1000, 1000-2000, ..., 5000-6000
    expect(sumHeatmap(heatmap)).toBe(2);
  });

  it("手动指定视频长度", async () => {
    const testData = [
      { ...defaultUniDM, ctime: now, DMID: "", content: "a", progress: 1000 },
      { ...defaultUniDM, ctime: now, DMID: "", content: "b", progress: 2000 },
    ];
    const testChunk = await udb.import(DanuniJsonAdapter(testData));
    const heatmap = await testChunk.export(
      HeatmapTransformerConfigurator({ videoDuration: 10000 }),
    );

    // floor(10000/1000) + 1 = 11 个桶
    expect(heatmap.length).toBe(11);
    expect(sumHeatmap(heatmap)).toBe(2);
  });

  it("忽略负数和超范围的progress", async () => {
    const testData = [
      { ...defaultUniDM, ctime: now, DMID: "", content: "valid1", progress: 1000 },
      { ...defaultUniDM, ctime: now, DMID: "", content: "negative", progress: -100 },
      { ...defaultUniDM, ctime: now, DMID: "", content: "valid2", progress: 2000 },
      { ...defaultUniDM, ctime: now, DMID: "", content: "overflow", progress: 10000 },
    ];
    const testChunk = await udb.import(DanuniJsonAdapter(testData));
    const heatmap = await testChunk.export(HeatmapTransformerConfigurator({ videoDuration: 5000 }));

    const total = sumHeatmap(heatmap);
    expect(total).toBe(2); // 只有 valid1 和 valid2
  });

  it("granularity参数验证", async () => {
    const emptyChunk = await udb.import(DanuniJsonAdapter([]));

    await expect(
      async () => await emptyChunk.export(HeatmapTransformerConfigurator({ granularity: 0 })),
    ).rejects.toThrow("Invalid granularity");

    await expect(
      async () => await emptyChunk.export(HeatmapTransformerConfigurator({ granularity: -1000 })),
    ).rejects.toThrow("Invalid granularity");
  });

  it("videoDuration参数验证", async () => {
    const emptyChunk = await udb.import(DanuniJsonAdapter([]));

    await expect(
      async () => await emptyChunk.export(HeatmapTransformerConfigurator({ videoDuration: 0 })),
    ).rejects.toThrow("Invalid videoDuration");

    await expect(
      async () => await emptyChunk.export(HeatmapTransformerConfigurator({ videoDuration: -5000 })),
    ).rejects.toThrow("Invalid videoDuration");
  });

  it("工具函数：查找峰值", async () => {
    const testData = [
      { ...defaultUniDM, ctime: now, DMID: "", content: "a", progress: 0 },
      { ...defaultUniDM, ctime: now, DMID: "", content: "b", progress: 1000 },
      { ...defaultUniDM, ctime: now, DMID: "", content: "c", progress: 1100 },
      { ...defaultUniDM, ctime: now, DMID: "", content: "d", progress: 1200 },
    ];
    const testChunk = await udb.import(DanuniJsonAdapter(testData));
    const heatmap = await testChunk.export(HeatmapTransformerConfigurator());

    const peak = HeatmapUtils.findPeak(heatmap);
    expect(peak).toEqual({ time: 1000, count: 3 });
    expect(sumHeatmap(heatmap)).toBe(4);
  });

  it("工具函数：计算总数", async () => {
    const testData = [
      { ...defaultUniDM, ctime: now, DMID: "", content: "a", progress: 0 },
      { ...defaultUniDM, ctime: now, DMID: "", content: "b", progress: 1000 },
      { ...defaultUniDM, ctime: now, DMID: "", content: "c", progress: 2000 },
    ];
    const testChunk = await udb.import(DanuniJsonAdapter(testData));
    const heatmap = await testChunk.export(HeatmapTransformerConfigurator());

    expect(sumHeatmap(heatmap)).toBe(3);
  });

  it("使用Bilibili XML数据的集成测试", async () => {
    const c = await udb.import(BiliXmlAdapter(xml));
    const heatmap = await c.export(HeatmapTransformerConfigurator());

    console.info("Heatmap:", heatmap);

    // XML 中所有弹幕 progress 都在 13.213-13.499 秒范围内（13213-13499ms）
    // 应该全部落在第 13 秒的桶中（索引 13）
    expect(heatmap[13].count).toBe(15);
    expect(sumHeatmap(heatmap)).toBe(15);

    const peak = HeatmapUtils.findPeak(heatmap);
    expect(peak?.time).toBe(13000);
    expect(peak?.count).toBe(15);
  });
});
