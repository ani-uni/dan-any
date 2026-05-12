import type { PlatformDanmakuSource } from "./platform.ts";
import type { CommandDm as DM_JSON_BiliCommandGrpc } from "@/utils/proto/gen/bilibili/community/service/dm/v1/dm_pb.ts";

import pkg from "../../package.json" with { type: "json" };
import { UniID } from "./id.ts";

type DMBiliCommand = DM_JSON_BiliCommandGrpc;
export enum Modes {
  Normal,
  Bottom,
  Top,
  Reverse, //逆向弹幕
  Ext, //需要读取extra的弹幕，用于兼容bili等复杂弹幕
}
export enum Pools {
  Def, //默认池
  Sub, //重要池，建议强制加载，含字幕、科普、空降等
  Adv, //高级弹幕专用池，均需读取extra
  Ix, //互动池
}
export enum DMAttr {
  Protect = "Protect",
  FromLive = "FromLive",
  HighLike = "HighLike",
  Compatible = "Compatible", // 由dan-any进行过兼容处理的弹幕，可能丢失部分信息
  Reported = "Reported", // 在DanUni上被多人举报过的弹幕
  Unchecked = "Unchecked", // 在DanUni上未被审核过的弹幕
  HasEvent = "HasEvent", // 该弹幕当前在DanUni上存在事件(如点赞/举报等)
  Hide = "Hide", // 由于其它原因需要隐藏的弹幕(建议在server端不返回该类弹幕)
}
export interface Extra {
  artplayer?: ExtraArtplayer;
  bili?: ExtraBili;
  danuni?: ExtraDanUni;
  ddplay?: ExtraDdPlay;
}
export interface ExtraArtplayer {
  style?: object;
  border?: boolean;
}
export interface ExtraBili {
  mode?: number; //原弹幕类型
  pool?: number; //原弹幕池
  dmid?: string; //原弹幕ID
  attr?: number; //原弹幕属性
  mid?: string; //发送者mid(仅创作中心源、command弹幕)
  adv?: string;
  code?: string;
  bas?: string;
  command?: DMBiliCommand;
}
export interface ExtraDanUni {
  merge?: ExtraDanUniMerge;
}
export interface ExtraDanUniMerge {
  duration: number; //持续时间(重复内容第一次出现时间开始到合并了的弹幕中最后一次出现的时间)
  count: number; //重复次数
  senders: string[]; //发送者
  taolu_count: number; //类似弹幕数量
  taolu_senders: string[]; //类似弹幕发送者
}
export interface ExtraDdPlay {
  cid: number;
  uid: string;
}

export interface UniDMObj {
  SOID: string;
  progress: number; // int32, ms
  mode: Modes;
  fontsize: number;
  color: number;
  senderID: string;
  content: string;
  ctime: Date;
  weight: number;
  pool: Pools;
  attr: DMAttr[];
  platform: PlatformDanmakuSource | string | null;
  extra: Extra | null;
  // extraStr: string;
  DMID: string;
}

export const defaultUniDM = {
  SOID: UniID.fromNull().toString(),
  progress: 0,
  mode: Modes.Normal,
  fontsize: 25,
  color: 0xffffff,
  senderID: UniID.fromNull().toString(),
  content: "",
  // ctime: new Date(), // ctime 应根据实际构建时间创建
  weight: 0,
  pool: Pools.Def,
  attr: [] as DMAttr[],
  platform: null,
  extra: null,
} as const;

// export class UniDM {}

export interface DanUniConvertTip {
  meassage: string;
  version: string;
  data?: string;
}

export const DanUniConvertTipTemplate: DanUniConvertTip = {
  meassage: "Converted by DanUni!",
  version: `JS/TS ${pkg.name} (v${pkg.version})`,
};
