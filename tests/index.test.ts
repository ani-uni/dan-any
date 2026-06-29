import {
  ArtplayerAdapter,
  ArtplayerTransformer,
  BahaAdapter,
  BahaTransformer,
  BiliXmlAdapter,
  BiliXmlTransformerConfigurator,
  DanuniJsonAdapter,
  DanuniJsonTransformerConfigurator,
  DanuniPbAdapter,
  DanuniPbTransformer,
  DdplayAdapter,
  DdplayTransformer,
  IqiyiAdapter,
  TencentAdapter,
  VodAdapter,
  VodTransformer,
} from "@/adapters/index.ts";
import { initNewDb } from "@/core/db/index.ts";
import { InitedUniDB, UniChunk, UniDB } from "@/core/main-drizzle.ts";
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
    const nxml = await chunk.export(BiliXmlTransformerConfigurator());
    console.info(nxml);
    console.info(await chunk.export(BiliXmlTransformerConfigurator({ avoidSenderIDWithAt: true })));
    const reImport = await udb.import(BiliXmlAdapter(nxml));
    const reImportXml = await reImport.export(BiliXmlTransformerConfigurator());
    expect(reImportXml).toEqual(nxml);
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
  it("tencent[单向]", async () => {
    const json = {
      barrage_list: [
        {
          id: "76561195620751501",
          is_op: 0,
          head_url: "",
          time_offset: "0",
          up_count: "187",
          bubble_head: "http://i.gtimg.cn/qqlive/images/20171031/i1509452960_1.jpg",
          bubble_level: "http://i.gtimg.cn/qqlive/images/20160602/i1464875618_1.jpg",
          bubble_id: "1493980",
          rick_type: 0,
          content_style: '{"color":"ffffff","gradient_colors":["CD87FF","CD87FF"],"position":1}',
          user_vip_degree: 0,
          create_time: "1675579635",
          content: "唐三：你过来呀！",
          hot_type: 0,
          gift_info: null,
          share_item: null,
          vuid: "",
          nick: "",
          data_key: "id=76561195620751501",
          content_score: 9999,
          show_weight: 10,
          track_type: 1,
          show_like_type: 0,
          report_like_score: 0,
          relate_sku_info: [],
        },
        {
          id: "76561195620751488",
          is_op: 0,
          head_url: "",
          time_offset: "0",
          up_count: "765",
          bubble_head: "",
          bubble_level: "",
          bubble_id: "",
          rick_type: 0,
          content_style: '{"color":"ffffff","gradient_colors":["FDA742","FBF076"],"position":1}',
          user_vip_degree: 0,
          create_time: "1688468076",
          content: "唐门就在四川",
          hot_type: 0,
          gift_info: null,
          share_item: null,
          vuid: "",
          nick: "",
          data_key: "id=76561195620751488",
          content_score: 10000,
          show_weight: 10,
          track_type: 1,
          show_like_type: 1,
          report_like_score: 0,
          relate_sku_info: [],
        },
        {
          id: "76561199427574381",
          is_op: 0,
          head_url: "",
          time_offset: "0",
          up_count: "110",
          bubble_head: "",
          bubble_level: "",
          bubble_id: "",
          rick_type: 0,
          content_style: "",
          user_vip_degree: 0,
          create_time: "1710243022",
          content: "看了三次的➕1[鹅少生肖]",
          hot_type: 0,
          gift_info: null,
          share_item: null,
          vuid: "",
          nick: "",
          data_key: "id=76561199427574381",
          content_score: 49.909546,
          show_weight: 0,
          track_type: 0,
          show_like_type: 0,
          report_like_score: 0,
          relate_sku_info: [],
        },
        {
          id: "76561197070723241",
          is_op: 0,
          head_url: "",
          time_offset: "0",
          up_count: "4",
          bubble_head: "",
          bubble_level: "",
          bubble_id: "",
          rick_type: 0,
          content_style: "",
          user_vip_degree: 0,
          create_time: "1635251624",
          content: "今天",
          hot_type: 0,
          gift_info: null,
          share_item: null,
          vuid: "",
          nick: "",
          data_key: "id=76561197070723241",
          content_score: 49.891052,
          show_weight: 0,
          track_type: 0,
          show_like_type: 0,
          report_like_score: 0,
          relate_sku_info: [],
        },
        {
          id: "76561198786740886",
          is_op: 0,
          head_url: "",
          time_offset: "0",
          up_count: "8",
          bubble_head: "",
          bubble_level: "",
          bubble_id: "",
          rick_type: 0,
          content_style: "",
          user_vip_degree: 0,
          create_time: "1692471317",
          content: "梦开始的地方😊😊😊",
          hot_type: 0,
          gift_info: null,
          share_item: null,
          vuid: "",
          nick: "",
          data_key: "id=76561198786740886",
          content_score: 49.890366,
          show_weight: 0,
          track_type: 0,
          show_like_type: 0,
          report_like_score: 0,
          relate_sku_info: [],
        },
        {
          id: "76561199089971753",
          is_op: 0,
          head_url: "",
          time_offset: "44000",
          up_count: "2",
          bubble_head: "",
          bubble_level: "",
          bubble_id: "",
          rick_type: 0,
          content_style: "",
          user_vip_degree: 0,
          create_time: "1701575648",
          content: "二刷，怎么发现没有片头曲了",
          hot_type: 0,
          gift_info: null,
          share_item: null,
          vuid: "",
          nick: "",
          data_key: "id=76561199089971753",
          content_score: 49.889763,
          show_weight: 0,
          track_type: 0,
          show_like_type: 0,
          report_like_score: 0,
          relate_sku_info: [],
        },
      ],
    };
    const chunk = await udb.import(TencentAdapter(json, "m00253deqqo"));
    const exportedJson = await chunk.export(DanuniJsonTransformerConfigurator({ minify: true }));
    console.info(exportedJson);
    expect(exportedJson[0].DMID).toBe("1369a957");
    expect(exportedJson[exportedJson.length - 1].DMID).toBe("b375b92d");
  });
  it("vod[双向]", async () => {
    const vod = await chunk.export(VodTransformer);
    console.info(vod);
    const reImport = await udb.import(
      VodAdapter(vod, "https://v.qq.com/x/cover/mzc00200vkqr54u/u4100l66fas.html"),
    );
    const reImportVod = await reImport.export(VodTransformer);
    expect(reImportVod.danmuku).toEqual(vod.danmuku);
  });
  it("baha[双向]", async () => {
    const json = {
      data: {
        danmu: [
          {
            text: "1",
            color: "#FFFFFF",
            size: 1,
            position: 0,
            time: 0,
            sn: 39929764,
            userid: "andy475713",
          },
          {
            text: "2025／8／24",
            color: "#FF0026",
            size: 2,
            position: 2,
            time: 2,
            sn: 46251836,
            userid: "FeiFei88",
          },
          {
            text: "2025/8/12簽",
            color: "#FDE53D",
            size: 1,
            position: 1,
            time: 54,
            sn: 46084624,
            userid: "emu9025",
          },
          {
            text: "20250802",
            color: "#FFFFFF",
            size: 1,
            position: 0,
            time: 4,
            sn: 45952197,
            userid: "efg130",
          },
          {
            text: "20240821 我來啦",
            color: "#FF9496",
            size: 1,
            position: 0,
            time: 8,
            sn: 41361180,
            userid: "star112999",
          },
        ],
        totalCount: 5,
      },
    };
    const chunk = await udb.import(BahaAdapter(json, 38205));
    const baha = await chunk.export(BahaTransformer);
    console.info(baha);
    const reImport = await udb.import(BahaAdapter(baha));
    const reImportBaha = await reImport.export(BahaTransformer);
    expect(reImportBaha.data.danmu).toEqual(baha.data.danmu);
  });
  it("iqiyi[单向]", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<danmu>
  <code>A00000</code>
  <data>
    <entry>
      <int>1</int>
      <list>
        <bulletInfo>
          <contentId>1694838404542410326</contentId>
          <content>花有重开日，人无再少年</content>
          <parentId>0</parentId>
          <showTime>1</showTime>
          <font>14</font>
          <color>ffffff</color>
          <opacity>5</opacity>
          <position>0</position>
          <background>0</background>
          <variableEffectId>0</variableEffectId>
          <isReply>null</isReply>
          <likeCount>572</likeCount>
          <plusCount>0</plusCount>
          <dissCount>0</dissCount>
          <isShowLike>false</isShowLike>
          <isShowLikeTest>false</isShowLikeTest>
          <isShowReplyFlag>false</isShowReplyFlag>
          <replyCnt>2</replyCnt>
          <userInfo>
            <senderAvatar>
              https://img7.iqiyipic.com/passport/20230916/dc/95/passport_2007517714656960_169483986396272_50_50.jpg</senderAvatar>
            <uid>2007517714656960</uid>
            <udid>null</udid>
            <name>赴一场烟火⭐</name>
          </userInfo>
          <contentType>0</contentType>
          <subType>0</subType>
          <src>0</src>
          <spoiler>false</spoiler>
          <halfScreenShow>1</halfScreenShow>
          <scoreLevel>3</scoreLevel>
          <emotionType>1</emotionType>
          <imageEmotionType>0</imageEmotionType>
        </bulletInfo>
        <bulletInfo>
          <contentId>1721667599880415818</contentId>
          <content>zZ:楼子生日快乐&#127882;</content>
          <parentId>0</parentId>
          <showTime>1</showTime>
          <font>20</font>
          <color>ffffff</color>
          <opacity>1</opacity>
          <position>0</position>
          <background>0</background>
          <variableEffectId>0</variableEffectId>
          <isReply>null</isReply>
          <likeCount>4832</likeCount>
          <plusCount>0</plusCount>
          <dissCount>7</dissCount>
          <isShowLike>false</isShowLike>
          <isShowLikeTest>false</isShowLikeTest>
          <isShowReplyFlag>false</isShowReplyFlag>
          <replyCnt>1</replyCnt>
          <userInfo>
            <senderAvatar>https://pic1.iqiyipic.com/lequ/20210812/male-130-qy_biz_default.png</senderAvatar>
            <uid>4996603324772993</uid>
            <udid>null</udid>
            <name>用户@11c0625e41b281</name>
          </userInfo>
          <contentType>0</contentType>
          <subType>0</subType>
          <src>0</src>
          <spoiler>false</spoiler>
          <halfScreenShow>1</halfScreenShow>
          <scoreLevel>3</scoreLevel>
          <emotionType>1</emotionType>
          <imageEmotionType>0</imageEmotionType>
        </bulletInfo>
        <bulletInfo>
          <contentId>1691631690557105291</contentId>
          <content>让我看看有多少人是从结局回来的</content>
          <parentId>0</parentId>
          <showTime>1</showTime>
          <font>14</font>
          <color>ffffff</color>
          <opacity>5</opacity>
          <position>0</position>
          <background>0</background>
          <variableEffectId>0</variableEffectId>
          <isReply>null</isReply>
          <likeCount>81</likeCount>
          <plusCount>0</plusCount>
          <dissCount>0</dissCount>
          <isShowLike>false</isShowLike>
          <isShowLikeTest>false</isShowLikeTest>
          <isShowReplyFlag>false</isShowReplyFlag>
          <replyCnt>3</replyCnt>
          <userInfo>
            <senderAvatar>
              https://img7.iqiyipic.com/passport/20240125/b9/3c/passport_1361606578_170614488266759_50_50.jpg</senderAvatar>
            <uid>1361606578</uid>
            <udid>null</udid>
            <name>絮果0517</name>
          </userInfo>
          <contentType>0</contentType>
          <subType>0</subType>
          <src>0</src>
          <spoiler>false</spoiler>
          <halfScreenShow>1</halfScreenShow>
          <scoreLevel>3</scoreLevel>
          <emotionType>1</emotionType>
          <imageEmotionType>0</imageEmotionType>
        </bulletInfo>
        <bulletInfo>
          <contentId>1718850911185918412</contentId>
          <content>前奏响起又回到了去年夏天</content>
          <parentId>0</parentId>
          <showTime>1</showTime>
          <font>20</font>
          <color>ffffff</color>
          <opacity>1</opacity>
          <position>0</position>
          <background>0</background>
          <variableEffectId>0</variableEffectId>
          <isReply>null</isReply>
          <likeCount>199</likeCount>
          <plusCount>0</plusCount>
          <dissCount>2</dissCount>
          <isShowLike>false</isShowLike>
          <isShowLikeTest>false</isShowLikeTest>
          <isShowReplyFlag>false</isShowReplyFlag>
          <replyCnt>0</replyCnt>
          <userInfo>
            <senderAvatar>
              https://img7.iqiyipic.com/passport/20240104/9b/54/passport_323648275618770_170430666312784_50_50.png</senderAvatar>
            <uid>323648275618770</uid>
            <udid>null</udid>
            <name>Ev酱</name>
          </userInfo>
          <contentType>0</contentType>
          <subType>0</subType>
          <src>0</src>
          <spoiler>false</spoiler>
          <halfScreenShow>1</halfScreenShow>
          <scoreLevel>3</scoreLevel>
          <emotionType>1</emotionType>
          <imageEmotionType>0</imageEmotionType>
        </bulletInfo>
        <bulletInfo>
          <contentId>1747425804001938217</contentId>
          <content>果果：淇淇生日快乐&#129373;</content>
          <parentId>0</parentId>
          <showTime>1</showTime>
          <font>14</font>
          <color>ffffff</color>
          <opacity>5</opacity>
          <position>0</position>
          <background>0</background>
          <variableEffectId>0</variableEffectId>
          <isReply>null</isReply>
          <likeCount>0</likeCount>
          <plusCount>0</plusCount>
          <dissCount>0</dissCount>
          <isShowLike>false</isShowLike>
          <isShowLikeTest>false</isShowLikeTest>
          <isShowReplyFlag>false</isShowReplyFlag>
          <replyCnt>2</replyCnt>
          <userInfo>
            <senderAvatar>
              https://img7.iqiyipic.com/passport/20250517/24/bb/passport_3287143224975360_174742605318127_50_50.jpg</senderAvatar>
            <uid>3287143224975360</uid>
            <udid>null</udid>
            <name>毅欣果</name>
          </userInfo>
          <contentType>0</contentType>
          <subType>0</subType>
          <src>0</src>
          <spoiler>false</spoiler>
          <halfScreenShow>1</halfScreenShow>
          <scoreLevel>3</scoreLevel>
          <emotionType>1</emotionType>
          <imageEmotionType>0</imageEmotionType>
        </bulletInfo>
        <bulletInfo>
          <contentId>1737843173594067944</contentId>
          <content>甲辰年腊月二十七纪念一下</content>
          <parentId>0</parentId>
          <showTime>1</showTime>
          <font>2</font>
          <color>FFFFFF</color>
          <opacity>8</opacity>
          <position>0</position>
          <background>0</background>
          <variableEffectId>0</variableEffectId>
          <isReply>null</isReply>
          <likeCount>34</likeCount>
          <plusCount>0</plusCount>
          <dissCount>0</dissCount>
          <isShowLike>false</isShowLike>
          <isShowLikeTest>false</isShowLikeTest>
          <isShowReplyFlag>false</isShowReplyFlag>
          <replyCnt>0</replyCnt>
          <userInfo>
            <senderAvatar>
              https://img7.iqiyipic.com/passport/20220120/51/1d/passport_2492707721284864_164268860380137_50_50.png</senderAvatar>
            <uid>2492707721284864</uid>
            <udid>XAPKIVRP6RPJILIT4DRDE3SWZUBFWPRD</udid>
            <name>Jess蓝气球soo</name>
          </userInfo>
          <contentType>0</contentType>
          <subType>0</subType>
          <src>0</src>
          <spoiler>false</spoiler>
          <halfScreenShow>1</halfScreenShow>
          <scoreLevel>2</scoreLevel>
          <emotionType>2</emotionType>
          <imageEmotionType>0</imageEmotionType>
        </bulletInfo>
        <bulletInfo>
          <contentId>1691815209650378123</contentId>
          <content>今天是4刷哦！</content>
          <parentId>0</parentId>
          <showTime>1</showTime>
          <font>14</font>
          <color>ffffff</color>
          <opacity>5</opacity>
          <position>100</position>
          <background>0</background>
          <variableEffectId>0</variableEffectId>
          <isReply>null</isReply>
          <likeCount>64</likeCount>
          <plusCount>0</plusCount>
          <dissCount>0</dissCount>
          <isShowLike>false</isShowLike>
          <isShowLikeTest>false</isShowLikeTest>
          <isShowReplyFlag>false</isShowReplyFlag>
          <replyCnt>0</replyCnt>
          <userInfo>
            <senderAvatar>
              https://img7.iqiyipic.com/passport/20230810/25/9d/passport_1458873445_169162992727465_50_50.jpg</senderAvatar>
            <uid>1458873445</uid>
            <udid>null</udid>
            <name>凉烟如墨&#127809;</name>
          </userInfo>
          <contentType>0</contentType>
          <subType>0</subType>
          <src>0</src>
          <spoiler>false</spoiler>
          <halfScreenShow>1</halfScreenShow>
          <scoreLevel>2</scoreLevel>
          <emotionType>1</emotionType>
          <imageEmotionType>0</imageEmotionType>
        </bulletInfo>
        <bulletInfo>
          <contentId>1691672625276658785</contentId>
          <content>不行，结尾太刀了我要再看一遍[二刷打卡]</content>
          <parentId>0</parentId>
          <showTime>2</showTime>
          <font>14</font>
          <color>ffffff</color>
          <opacity>5</opacity>
          <position>0</position>
          <background>0</background>
          <variableEffectId>0</variableEffectId>
          <isReply>null</isReply>
          <likeCount>66</likeCount>
          <plusCount>0</plusCount>
          <dissCount>0</dissCount>
          <isShowLike>false</isShowLike>
          <isShowLikeTest>false</isShowLikeTest>
          <isShowReplyFlag>false</isShowReplyFlag>
          <replyCnt>0</replyCnt>
          <userInfo>
            <senderAvatar>
              https://img7.iqiyipic.com/passport/20220314/f7/a9/passport_2300576040_164716199270372_50_50.jpg</senderAvatar>
            <uid>2300576040</uid>
            <udid>null</udid>
            <name>咖啡不加糖也很甜⭐</name>
          </userInfo>
          <contentType>0</contentType>
          <subType>0</subType>
          <src>0</src>
          <spoiler>false</spoiler>
          <halfScreenShow>1</halfScreenShow>
          <scoreLevel>3</scoreLevel>
          <emotionType>2</emotionType>
          <imageEmotionType>0</imageEmotionType>
        </bulletInfo>
      </list>
    </entry>
  </data>
  <sum>122117</sum>
  <validSum>29681</validSum>
  <duration>2767</duration>
  <ts>2026-05-24 15:39:42</ts>
</danmu>`;
    const chunk = await udb.import(IqiyiAdapter(xml));
    const exportedJson = await chunk.export(DanuniJsonTransformerConfigurator({ minify: true }));
    console.info(exportedJson);
  });
  it("min[双向]", async () => {
    const minJson = await chunk.export(DanuniJsonTransformerConfigurator({ minify: true }));
    console.info(minJson);
    const reImport = await udb.import(DanuniJsonAdapter(minJson));
    const reImportJson = await reImport.export(DanuniJsonTransformerConfigurator({ minify: true }));
    expect(reImportJson).toEqual(minJson);
  });
});

describe("其它", () => {
  it("UniDB.assign[合并chunks]", async () => {
    // 创建多个 chunk
    const chunk1 = await udb.import(BiliXmlAdapter(xml));
    const chunk2 = await udb.import(BiliXmlAdapter(xml2));
    // 获取合并前的 danmakus 数量
    const result1 = await chunk1.$count;
    const result2 = await chunk2.$count;
    expect(result1).toBe(15);
    expect(result2).toBe(1);
    console.info(`Chunk1 count: ${result1}, Chunk2 count: ${result2}`);
    // 合并 chunks
    const merged = await UniChunk.assign(chunk1, [chunk2]);
    // 验证合并结果
    expect(merged.id).toBe(chunk1.id);
    expect(merged.$UniDB).toBe(chunk1.$UniDB);
    // 验证合并后 danmakus 数量应该是两个的总和
    const mergedResult = await merged.$count;
    console.info(`Merged count: ${mergedResult}, Expected: 16`);
    expect(mergedResult).toBe(16);
  });
  it("UniDB.assign[合并chunks](2udb)", async () => {
    const udb2 = new InitedUniDB(await initNewDb());
    // 创建多个 chunk
    const chunk1 = await udb.import(BiliXmlAdapter(xml));
    const chunk2 = await udb2.import(BiliXmlAdapter(xml2));
    // 获取合并前的 danmakus 数量
    const result1 = await chunk1.$count;
    const result2 = await chunk2.$count;
    expect(result1).toBe(15);
    expect(result2).toBe(1);
    console.info(`Chunk1 count: ${result1}, Chunk2 count: ${result2}`);
    // 合并 chunks
    const merged = await UniChunk.assign(chunk1, [chunk2]);
    // 验证合并结果
    expect(merged.id).toBe(chunk1.id);
    expect(merged.$UniDB).toBe(chunk1.$UniDB);
    // 验证合并后 danmakus 数量应该是两个的总和
    const mergedResult = await merged.$count;
    console.info(`Merged count: ${mergedResult}, Expected: 16`);
    expect(mergedResult).toBe(16);
    await udb2.close();
  });
});
