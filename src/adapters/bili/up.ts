import { defineAdapter } from "../index.ts";
import { danmakus, onConflictDoUpdate } from "@/core/db/schema.ts";

import { BiliCommonParser } from "./grpc.ts";

interface DM_JSON_BiliUp {
  /** 接口状态码，0 表示成功 */
  code: number;
  /** 文本形式的状态码，约定为字符串 "0" */
  message: string;
  /** TTL（time to live） 标识，本接口常量为 1 */
  ttl: number;
  data: {
    /** 分页元信息 */
    page: {
      /** 当前页序号，从 1 开始 */
      num: number;
      /** 每页返回的弹幕条数 */
      size: number;
      /** 总页数 */
      total: number;
    };
    result: {
      /** 弹幕 ID，int64 */
      id: bigint;
      /** 弹幕 ID 字符串形式 */
      id_str: string;
      /** 弹幕类型：1 表示视频弹幕（当前接口恒为 1） */
      type: number;
      aid: bigint;
      bvid: string;
      oid: bigint;
      mid: bigint;
      /** 发送者 mid 的 CRC 哈希（正常接口里用的是这个，保护隐私） */
      mid_hash: string;
      /** 弹幕池 */
      pool: number;
      /** 属性位字符串，逗号分隔的数字列表，对应 attr 二进制位 */
      attrs: string;
      /** 弹幕出现时间，单位毫秒(注意，此处与protobuf接口保持一致，但xml中progress是秒) */
      progress: number;
      mode: number;
      /** 弹幕内容, content */
      msg: string;
      state: number; // ?
      fontsize: number;
      /** 弹幕颜色，需将16进制转化为普通弹幕的10进制，示例："ffffff" */
      color: string;
      /** 发送时间戳，单位秒 */
      ctime: number;
      /** 发送者昵称 */
      uname: string;
      /** 发送者头像链接 */
      uface: string;
      /** 视频主标题 */
      title: string;
      self_seen: boolean; // 尽自己可见?
      /** 弹幕点赞数 */
      like_count: number;
      user_like: number; // ?
      /** 分 P 标题 */
      p_title: string;
      /** 视频封面链接 */
      cover: string;
      is_charge: boolean; // 该up是否开通充电计划?
      is_charge_plus: boolean; // 该up是否开通高级充电计划?
      following: boolean; // 当前登录用户是否关注该发送者?
      extra_cps: null; // ?
    }[];
  };
}

export const BiliUpAdapter = defineAdapter((json: DM_JSON_BiliUp) => {
  return async (udb, uchunk) => {
    const chunk = uchunk ?? (await udb.makeChunk({}));
    await udb.$drizzle
      .insert(danmakus)
      .values(
        json.data.result.map((d) => {
          // 处理 attrs 字符串转换为 attr 二进制
          // attrs 格式如 "1,13,21"，每个数字对应二进制位
          const attrBin = d.attrs
            ? d.attrs
                .split(",")
                .map(Number)
                .reduce((bin, bitPosition) => bin | (1 << (bitPosition - 1)), 0)
            : 0;
          return BiliCommonParser(chunk.id, {
            id: BigInt(d.id_str || d.id),
            idStr: d.id_str,
            progress: d.progress,
            mode: d.mode,
            fontsize: d.fontsize,
            color: Number.parseInt(d.color, 16),
            mid: d.mid,
            midHash: d.mid_hash,
            content: d.msg,
            ctime: BigInt(d.ctime),
            pool: d.pool,
            // idStr: d.id_str,
            attr: attrBin,
            oid: BigInt(d.oid),
          });
        }),
      )
      .onConflictDoUpdate(onConflictDoUpdate.danmakus);
    return chunk;
  };
});
