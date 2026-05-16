import { defineAdapter } from "../index.ts";

import { DMAttr, Modes, Pools, type Extra, type ExtraBili } from "@/core/dm.ts";
import { PlatformVideoSource, type PlatformDanmakuSource } from "@/core/platform.ts";
import { UniID, type DMIDGenerator } from "@/core/id.ts";
import { transCtime } from "@/utils/transCtime.ts";
import { enumModeCodec, enumPoolCodec } from "../danuni/json.ts";
import { fromBinary } from "@bufbuild/protobuf";
import { DmSegMobileReplySchema } from "@/utils/proto/gen/bilibili/community/service/dm/v1/dm_pb.ts";
import { SetBin, toBits } from "@/utils/bin.ts";
import type { UniChunk } from "@/core/index.ts";
import type { z } from "zod";
import type { DanmakusSelect } from "@/core/db/schema.ts";

interface DMBili {
  id: bigint; // xml 7
  progress: number; // xml 0 ; xml s, protobuf ms
  mode: number; // xml 1
  fontsize: number; // xml 2
  color: number; // xml 3
  mid?: bigint; // 仅创作中心源
  midHash: string; // xml 6
  /**
   * 特殊类型解析：
   * - [ohh] : /oh{2,}/gi
   * - [前方高能]
   * - [...] (JS数组) : 高级弹幕
   */
  content: string; // xml content
  ctime: bigint; // xml 4
  pool: number; // xml 5
  weight?: number; // xml 8
  action?: string;
  idStr?: string;
  attr?: number;
  animation?: string;
  extra?: string;
  colorful?: number;
  type?: number;
  oid?: bigint;
}

const DMAttrUtils = {
  fromBin(bin: number = 0, format?: PlatformDanmakuSource) {
    const array = toBits(bin);
    const attr: DMAttr[] = [];
    if (format === "bili") {
      if (array[0]) attr.push(DMAttr.Protect);
      if (array[1]) attr.push(DMAttr.FromLive);
      if (array[2]) attr.push(DMAttr.HighLike);
    }
    return attr;
  },
  toBin(
    attr: DMAttr[] = [],
    /**
     * 对于二进制格式的读取，应该分别读取各位，
     * 但由于不知道B站及其它使用该参数程序的读取逻辑，
     * 所以单独提供 bili 格式
     */
    format?: PlatformDanmakuSource,
  ) {
    const bin = new SetBin(0);
    if (format === "bili") {
      if (attr.includes(DMAttr.Protect)) bin.set1(0);
      if (attr.includes(DMAttr.FromLive)) bin.set1(1);
      if (attr.includes(DMAttr.HighLike)) bin.set1(2);
    }
    return bin.bin;
  },
};

export function BiliCommonParser(chunk: UniChunk, args: DMBili, cid?: bigint, recSOID?: string) {
  if (args.oid && !cid) cid = args.oid;
  const SOID =
    recSOID || `def_${PlatformVideoSource.Bilibili}+${UniID.fromBili({ cid }).toString()}`;
  const senderID = UniID.validateString(args.midHash)
    ? args.midHash
    : UniID.fromBili({ midHash: args.midHash }).toString();
  let mode: Modes;
  const pool = args.pool; //暂时不做处理，兼容bili的pool格式
  const extra: Extra = {
    bili: {
      mode: args.mode,
      pool: args.pool,
      dmid: args.idStr ?? args.id.toString(),
      attr: args.attr,
      mid: args.mid?.toString(),
      adv: undefined,
      code: undefined,
      bas: undefined,
    },
  };
  //重复 transMode ，但此处有关于extra的额外处理
  switch (args.mode) {
    case 4:
      mode = Modes.Normal;
      break;
    case 5:
      mode = Modes.Top;
      break;
    case 6:
      mode = Modes.Reverse;
      break;
    case 7:
      mode = Modes.Ext;
      extra.bili!.adv = args.content;
      break;
    case 8:
      mode = Modes.Ext;
      extra.bili!.code = args.content;
      break;
    case 9:
      mode = Modes.Ext;
      extra.bili!.bas = args.content;
      break;

    default:
      mode = Modes.Normal;
      break;
  }
  const map_d = {
    ...args,
    SOID,
    mode,
    senderID,
    ctime: transCtime(args.ctime, "s"),
    weight: args.weight || (pool === Pools.Ix ? 1 : 0),
    pool,
    attr: DMAttrUtils.fromBin(args.attr, PlatformVideoSource.Bilibili),
    platform: PlatformVideoSource.Bilibili,
    // 需改进，7=>advanced 8=>code 9=>bas 互动=>command
    // 同时塞进无法/无需直接解析的数据
    // 另开一个解析器，为大部分播放器（无法解析该类dm）做文本类型降级处理
    extra,
  };
  return {
    ...map_d,
    mode: enumModeCodec.decode(mode),
    pool: enumPoolCodec.decode(pool),
    DMID: chunk.$UniDB.DMIDGenerator({
      ...map_d,
      mode: enumModeCodec.decode(mode),
      pool: enumPoolCodec.decode(pool),
    }),
  };
}

interface BiliCommonBuilderOptions {
  skipBiliCommand?: boolean;
  /**
   * 见 ../index.ts UniPool.toBiliXML() 的 options，该option不宜手动调用，判断逻辑未封装
   */
  avoidSenderIDWithAt?: boolean;
}
const recMode = (mode: z.infer<typeof enumModeCodec.out>, extra?: ExtraBili) => {
  switch (mode) {
    case "Normal":
      return 1;
    case "Bottom":
      return 4;
    case "Top":
      return 5;
    case "Reverse":
      return 6;
    case "Ext":
      if (!extra) return 1;
      else if (extra.adv) return 7;
      else if (extra.code) return 8;
      else if (extra.bas) return 9;
      else return 1;
    default:
      return 1;
  }
};
export function BiliCommonBuilder(
  DMIDGenerator: DMIDGenerator,
  that: DanmakusSelect,
  options?: BiliCommonBuilderOptions,
) {
  if (options?.skipBiliCommand && that.extra?.bili?.command) return null;
  const rMode = that.extra?.bili?.mode || recMode(that.mode, that.extra?.bili);
  let content;
  switch (rMode) {
    case 7:
      content = that.extra?.bili?.adv;
      break;
    case 8:
      content = that.extra?.bili?.code;
      break;
    case 9:
      content = that.extra?.bili?.bas;
      break;
    default:
      content = that.content;
      break;
  }
  return {
    "#text": content ?? that.content,
    "@_p": [
      that.progress / 1000, // 当前该函数仅用于 bili xml ，故时间格式与其同步
      rMode,
      that.fontsize,
      that.color,
      that.ctime.getTime() / 1000, // 当前该函数仅用于 bili xml ，故时间格式与其同步
      that.extra?.bili?.pool || that.pool, // 目前pool与bili兼容
      options?.avoidSenderIDWithAt
        ? that.senderID.replaceAll(`@${PlatformVideoSource.Bilibili}`, "")
        : that.senderID,
      that.extra?.bili?.dmid || that.DMID || DMIDGenerator(that),
      that.weight,
    ].join(","),
  };
}

export const BiliGrpcAdapter = defineAdapter((bin: Uint8Array | ArrayBuffer) => {
  return async (udb, uchunk) => {
    const chunk = uchunk ?? (await udb.makeChunk({}));
    const data = fromBinary(DmSegMobileReplySchema, new Uint8Array(bin));
    const json = data.elems;
    await chunk.upsertDanmakus(json.map((d) => BiliCommonParser(chunk, d)));
    return chunk;
  };
});
