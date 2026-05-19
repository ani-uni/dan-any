import {
  ArtplayerAdapter,
  ArtplayerTransformer,
  BiliXmlAdapter,
  BiliXmlTransformerConfigurator,
  DanuniJsonAdapter,
  DanuniJsonTransformerConfigurator,
  DanuniPbAdapter,
  DanuniPbTransformer,
  DdplayAdapter,
  DdplayTransformer,
} from "@/adapters/index.ts";
import { initNewDb } from "@/core/db/index.ts";
import { InitedUniDB, UniChunk, UniDB } from "@/core/index.ts";
import { CountTransformer } from "@/plugins/count.ts";
import { describe, it, expect, beforeAll, afterAll } from "vite-plus/test";

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
const xml2 = `<i>
<chatserver>chat.bilibili.com</chatserver>
<chatid>1156756312</chatid>
<mission>0</mission>
<maxlimit>2947</maxlimit>
<state>0</state>
<real_name>0</real_name>
<source>k-v</source>
<d p="13.213,1,25,16777215,1686590010,0,296b35b5,1337972999512832512">test---hahaha</d>
</i>`;

let udb: InitedUniDB;
let chunk: UniChunk;
beforeAll(async () => {
  udb = await new UniDB().init();
  chunk = await udb.import(BiliXmlAdapter(xml));
  console.info(xml);
  console.info(await chunk.export(DanuniJsonTransformerConfigurator({ minify: true })));
});
afterAll(async () => {
  await udb.close();
});

describe("转化自", async () => {
  it("bili(xml)[双向]", async () => {
    console.info(await chunk.export(BiliXmlTransformerConfigurator()));
    console.info(await chunk.export(BiliXmlTransformerConfigurator({ avoidSenderIDWithAt: true })));
  });
  it("artplayer(json)", async () => {
    console.info(await chunk.export(ArtplayerTransformer));
    const json = {
      danmuku: [
        {
          text: "artplayer测试弹幕", // 弹幕文本
          time: 10, // 弹幕时间, 默认为当前播放器时间
          mode: 0, // 弹幕模式: 0: 滚动(默认)，1: 顶部，2: 底部
          color: "#FFFFFF", // 弹幕颜色，默认为白色
          border: false, // 弹幕是否有描边, 默认为 false
          style: { border: "10rem" }, // 弹幕自定义样式, 默认为空对象
        },
      ],
    };
    const chunk2 = await udb.import(ArtplayerAdapter(json, "playerid-test", "acfun"));
    const chunk2Json = await chunk2.export(DanuniJsonTransformerConfigurator({ minify: true }));
    const chunk2Artplayer = await chunk2.export(ArtplayerTransformer);
    console.info(chunk2Json);
    console.info(await chunk2.export(ArtplayerTransformer));
    expect(chunk2Artplayer.danmuku).toEqual(json.danmuku);
  });
  // it("ass[双向]", () => {
  //   const canvas = createCanvas(50, 50);
  //   const pool = UniPool.fromBiliXML(xml);
  //   const ass = pool.toASS(canvas.getContext("2d"));
  //   console.info(ass);
  //   console.info(UniPool.fromASS(ass));
  //   const imp = UniPool.import(ass);
  //   expect(imp.fmt).toBe("common.ass");
  //   expect(imp.pool).toEqual(pool);
  //   const imp2 = UniPool.import(ass, undefined, "test-common.ass");
  //   expect(imp2).toEqual(imp);
  // });
  it("pb[双向]", async () => {
    const pb = await chunk.export(DanuniPbTransformer);
    console.info(pb);
    const reImport = await udb.import(DanuniPbAdapter(pb));
    expect(await reImport.export(DanuniJsonTransformerConfigurator({ minify: true }))).toEqual(
      await chunk.export(DanuniJsonTransformerConfigurator({ minify: true })),
    );
  });
  it("DDPlay[双向]", async () => {
    const ddplay = await chunk.export(DdplayTransformer);
    console.info(ddplay);
    const reImport = await udb.import(DdplayAdapter(ddplay, "1"));
    const reImportDdplay = await reImport.export(DdplayTransformer);
    expect(reImportDdplay.comments).toEqual(ddplay.comments);
    // expect(await reImport.export(DanuniJsonTransformerConfigurator({ minify: true }))).toEqual(
    //   await chunk.export(DanuniJsonTransformerConfigurator({ minify: true })),
    // );
  });
  it("min[双向]", async () => {
    expect(
      (
        await udb.import(
          DanuniJsonAdapter(
            await chunk.export(DanuniJsonTransformerConfigurator({ minify: true })),
          ),
        )
      ).export(DanuniJsonTransformerConfigurator()),
    ).toEqual(chunk.export(DanuniJsonTransformerConfigurator()));
  });
});

describe("其它", () => {
  it("UniDB.assign[合并chunks]", async () => {
    // 创建多个 chunk
    const chunk1 = await udb.import(BiliXmlAdapter(xml));
    const chunk2 = await udb.import(BiliXmlAdapter(xml2));
    // 获取合并前的 danmakus 数量
    const result1 = await chunk1.export(CountTransformer);
    const result2 = await chunk2.export(CountTransformer);
    expect(result1).toBe(15);
    expect(result2).toBe(1);
    console.info(`Chunk1 count: ${result1}, Chunk2 count: ${result2}`);
    // 合并 chunks
    const merged = await UniChunk.assign(chunk1, [chunk2]);
    // 验证合并结果
    expect(merged.id).toBe(chunk1.id);
    expect(merged.$UniDB).toBe(chunk1.$UniDB);
    // 验证合并后 danmakus 数量应该是两个的总和
    const mergedResult = await merged.export(CountTransformer);
    console.info(`Merged count: ${mergedResult}, Expected: 16`);
    expect(mergedResult).toBe(16);
  });
  it("UniDB.assign[合并chunks](2udb)", async () => {
    const udb2 = new InitedUniDB(await initNewDb());
    // 创建多个 chunk
    const chunk1 = await udb.import(BiliXmlAdapter(xml));
    const chunk2 = await udb2.import(BiliXmlAdapter(xml2));
    // 获取合并前的 danmakus 数量
    const result1 = await chunk1.export(CountTransformer);
    const result2 = await chunk2.export(CountTransformer);
    expect(result1).toBe(15);
    expect(result2).toBe(1);
    console.info(`Chunk1 count: ${result1}, Chunk2 count: ${result2}`);
    // 合并 chunks
    const merged = await UniChunk.assign(chunk1, [chunk2]);
    // 验证合并结果
    expect(merged.id).toBe(chunk1.id);
    expect(merged.$UniDB).toBe(chunk1.$UniDB);
    // 验证合并后 danmakus 数量应该是两个的总和
    const mergedResult = await merged.export(CountTransformer);
    console.info(`Merged count: ${mergedResult}, Expected: 16`);
    expect(mergedResult).toBe(16);
    await udb2.close();
  });
});
