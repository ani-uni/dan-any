import { defineTransformer, defineAdapter } from "../index.ts";
import { danmakus, onConflictDoUpdate } from "@/core/db/schema.ts";

import { XMLParser } from "fast-xml-parser";
import { DanUniConvertTipTemplate, type DanUniConvertTip } from "@/core/dm.ts";
import { BiliCommonBuilder, BiliCommonParser } from "./grpc.ts";
import { UniID } from "@/core/id.ts";
import { PlatformVideoSource } from "@/core/platform.ts";
import XMLBuilder from "fast-xml-builder";
import { enumAttrsCodec, enumModeCodec, enumPoolCodec } from "../danuni/json.ts";

interface DM_XML_Bili {
  i: {
    chatserver: string;
    chatid: bigint;
    mission: number;
    maxlimit: number;
    state: number;
    real_name: number;
    source: string;
    d: {
      "#text": string;
      "@_p": string;
    }[];
  };
}

const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (_name, jpath, _isLeafNode, _isAttribute) => {
    if (jpath === "i.d") return true;
    return false;
  },
});
const builder = new XMLBuilder({ ignoreAttributes: false });

function parseBiliSingle(p: string, c: string) {
  const p_arr = p.split(",");
  return {
    content: c,
    progress: Number.parseFloat(p_arr[0]) * 1000,
    mode: Number.parseInt(p_arr[1]),
    fontsize: Number.parseInt(p_arr[2]),
    color: Number.parseInt(p_arr[3]),
    ctime: BigInt(p_arr[4]),
    pool: Number.parseInt(p_arr[5]),
    midHash: p_arr[6],
    id: BigInt(p_arr[7]),
    idStr: p_arr[7],
    weight: Number.parseInt(p_arr[8]),
  };
}

export const BiliXmlAdapter = defineAdapter((xml: string) => {
  return async (udb, uchunk) => {
    const oriData: DM_XML_Bili & { i: { danuni?: DanUniConvertTip } } = parser.parse(xml);
    const dans = oriData.i.d;
    const fromConverted = !!oriData.i.danuni;
    const cid = BigInt(oriData.i.chatid);
    const recSOID = fromConverted ? oriData.i.danuni?.data : undefined;
    const chunk = uchunk ?? (await udb.makeChunk({ fromConverted }));
    await udb.$drizzle
      .insert(danmakus)
      .values(
        dans.map((d) =>
          BiliCommonParser(chunk.id, parseBiliSingle(d["@_p"], d["#text"]), cid, recSOID),
        ),
      )
      .onConflictDoUpdate(onConflictDoUpdate.danmakus);
    return chunk;
  };
});

interface BiliXmlTransformerOptions {
  /**
   * 当SOID非来源bili时，若此处指定则使用该值为cid，否则使用SOID
   */
  cid?: bigint;
  /**
   * 跳过command类型的特殊弹幕
   */
  skipBiliCommand?: boolean;
  /**
   * 当仅含有来自bili的弹幕时，启用将保持发送者标识不含`@`
   * @description
   * bili的弹幕含midHash(crc)，不启用该处使用senderID填充，启用则去除`@bili`部分，提高兼容性
   */
  avoidSenderIDWithAt?: boolean;
}

const genCID = (id?: string, options?: BiliXmlTransformerOptions) => {
  if (id) {
    const uniID = UniID.fromStringSafe(id);
    if (uniID.domain === PlatformVideoSource.Bilibili) {
      const cid = uniID.id.replaceAll(`def_${PlatformVideoSource.Bilibili}+`, "");
      if (cid) return cid;
    }
    return options?.cid || id;
  } else return options?.cid || UniID.fromNull().toString();
};

export const BiliXmlTransformerConfigurator = (options?: BiliXmlTransformerOptions) =>
  defineTransformer(async (udanmakus) => {
    const dans = await udanmakus;
    if (options?.avoidSenderIDWithAt) {
      const ok = dans.every((d) => d.senderID.endsWith(`@${PlatformVideoSource.Bilibili}`));
      if (!ok) throw new Error("存在其他来源的senderID，请关闭该功能再试！");
    }
    let ds = dans.map((dan) =>
      BiliCommonBuilder(
        {
          ...dan,
          mode: enumModeCodec.encode(dan.mode)!,
          pool: enumPoolCodec.encode(dan.pool)!,
          attr: enumAttrsCodec.encode(dan.attr),
        },
        options,
      ),
    );
    if (options?.skipBiliCommand) ds = ds.filter((d) => d !== null);
    return builder.build({
      "?xml": {
        "@_version": "1.0",
        "@_encoding": "UTF-8",
      },
      i: {
        chatserver: "chat.bilibili.com",
        chatid: genCID(dans[0]?.SOID),
        mission: 0,
        maxlimit: dans.length,
        state: 0,
        real_name: 0,
        source: "k-v",
        danuni: { ...DanUniConvertTipTemplate, data: [...new Set(dans.map((d) => d.SOID))][0] },
        d: ds,
      },
    });
  });
