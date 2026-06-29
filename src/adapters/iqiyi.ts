import { defineAdapter, defineMetadata } from "./index.ts";

import { XMLParser } from "fast-xml-parser";
import { defaultUniDM, type DanUniConvertTip } from "@/core/dm.ts";
import { PlatformVideoSource } from "@/core/platform.ts";
import { UniID } from "@/core/uni-id.ts";
import { transMode } from "@/utils/transMode.ts";
import { fileParser } from "@/utils/fileParser.ts";
import type { TupleOf } from "type-fest";

interface IqiyiUserInfo {
  senderAvatar: string; //url
  uid: string; //bigint
  udid: string; //null
  name: string;
}

/**
 * 爱奇艺弹幕单条信息
 * @description 对应 iqiyi danmu 接口返回 XML 中的 bulletInfo 节点
 */
interface IqiyiBulletInfo {
  contentId: string; // bigint，保留字符串
  content: string;
  parentId: string; // 回复目标弹幕contentID，默认0
  showTime: string; // int, 秒
  font: string; // int, 字体/字号/样式编码
  color: string; // hex
  opacity: string; // 0-10 对应百分比透明度?
  position: string; // 0-滚动 1-顶部 2-底部
  background: string; // int?
  variableEffectId: string; // int?
  isReply: string; // null?
  likeCount: string; // int
  plusCount: string; // int
  dissCount: string; // int
  isShowLike: string; // boolean?
  isShowLikeTest: string; // boolean?
  isShowReplyFlag: string; // boolean?
  replyCnt: string; // int
  userInfo: IqiyiUserInfo;
  contentType: string; // 0?
  subType: string; // 0?
  src: string; // 0?
  spoiler: string; // boolean 剧透弹幕
  halfScreenShow: string; // 0-1?
  scoreLevel: string; // int?
  emotionType: string; // int?
  imageEmotionType: string; // int?
}

interface DM_XML_Iqiyi {
  danmu: {
    code: string;
    data: {
      entry: {
        int: string; //1
        list: {
          bulletInfo: IqiyiBulletInfo[];
        };
      };
    };
    sum: string; //int
    validSum: string; //int
    duration: string; //int
    ts: string; //Date
  };
}

const danmuFontSize = [14, 20, 24, 30, 42, 50];

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (_name, jpath, _isLeafNode, _isAttribute) => {
    // 保证单条 bulletInfo 也被解析为数组
    if (jpath === "danmu.data.entry.list.bulletInfo") return true;
    return false;
  },
});

function like_diss_map(d: IqiyiBulletInfo) {
  return Number(d.likeCount) + Number(d.plusCount) - Number(d.dissCount);
}
function like_diss_cnt(ds: IqiyiBulletInfo[], lv: "1" | "2" | "3") {
  return ds
    .filter((d) => d.scoreLevel === lv)
    .map(like_diss_map)
    .toSorted();
}
function like_diss_950(cnt: number[]): [number, number, number] {
  return [cnt[~~(cnt.length * 0.9)], cnt[~~(cnt.length * 0.5)], cnt[0]];
}

export const IqiyiAdapter = defineAdapter((xml: string, tvid?: string) => {
  return async (udb, uchunk) => {
    const oriData: DM_XML_Iqiyi & { danmu: { danuni?: DanUniConvertTip } } = parser.parse(xml);
    const list: IqiyiBulletInfo[] = oriData.danmu.data.entry.list.bulletInfo;
    const fromConverted = !!oriData.danmu.danuni;
    const chunk = uchunk ?? (await udb.makeChunk({ fromConverted }));
    const SOID = tvid
      ? UniID.fromUnknown(
          `def_${PlatformVideoSource.Iqiyi}+${tvid}`,
          PlatformVideoSource.Iqiyi,
        ).toString()
      : UniID.fromNull(PlatformVideoSource.Iqiyi).toString();
    const recSOID = fromConverted ? oriData.danmu.danuni?.data : undefined;
    const now = new Date();
    const like_diss_x = [
      like_diss_cnt(list, "1"),
      like_diss_cnt(list, "2"),
      like_diss_cnt(list, "3"),
    ] as const;
    const like_diss_p = <TupleOf<3, TupleOf<3, number>>>like_diss_x.map(like_diss_950);
    await chunk.upsertDanmakus(
      list.map((d) => {
        const senderID = UniID.fromUnknown(d.userInfo.uid, PlatformVideoSource.Iqiyi).toString();
        const fontsize = danmuFontSize.includes(Number(d.font)) ? Number(d.font) : 24;
        let weight = 0;
        const like_diss_cnt = like_diss_map(d);
        if (["1", "2", "3"].includes(d.scoreLevel)) {
          if (d.scoreLevel === "1") {
            if (like_diss_cnt > like_diss_p[0][0]) weight = 10;
            else if (like_diss_cnt > like_diss_p[0][1]) weight = 9;
            else weight = 8;
          } else if (d.scoreLevel === "2") {
            if (like_diss_cnt > like_diss_p[1][0]) weight = 7;
            else if (like_diss_cnt > like_diss_p[1][1]) weight = 6;
            else weight = 5;
          } else if (d.scoreLevel === "3") {
            if (like_diss_cnt > like_diss_p[2][0]) weight = 4;
            else if (like_diss_cnt > like_diss_p[2][1]) weight = 3;
            else weight = 2;
          }
        }
        const map_d = {
          SOID: recSOID ?? SOID,
          senderID,
          content: d.content,
          color: Number.parseInt(d.color || "FFFFFF", 16),
          ctime: now,
          progress: Number(d.showTime) * 1000,
          attr: defaultUniDM.attr,
          fontsize,
          pool: "Def" as const,
          platform: PlatformVideoSource.Iqiyi,
          mode: transMode(Number(d.position), "iqiyi"),
          weight,
          extra: {
            iqiyi: {
              contentId: d.contentId,
              parentId: d.parentId,
              font: Number(d.font),
              opacity: Number(d.opacity),
              position: Number(d.position),
              background: Number(d.background),
              variableEffectId: Number(d.variableEffectId),
              contentType: Number(d.contentType),
              subType: Number(d.subType),
              spoiler: d.spoiler === "true",
              halfScreenShow: Number(d.halfScreenShow),
              emotionType: Number(d.emotionType),
              imageEmotionType: Number(d.imageEmotionType),
            },
          },
        };
        return {
          ...map_d,
          DMID: chunk.$UniDB.DMIDGenerator(map_d),
        };
      }),
    );
    return chunk;
  };
});

export const IqiyiMetadata = defineMetadata({
  type: "iqiyi.xml",
  ext: [".xml"],
  check: {
    adapter: async (uchunk, body) => {
      try {
        await uchunk.import(IqiyiAdapter(await fileParser(body, "string")));
        return IqiyiAdapter;
      } catch {
        return null;
      }
    },
  },
});
