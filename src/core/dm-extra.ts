import type { CommandDm as DM_JSON_BiliCommandGrpc } from "@/utils/proto/gen/bilibili/community/service/dm/v1/dm_pb.ts";

type DMBiliCommand = DM_JSON_BiliCommandGrpc;

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
