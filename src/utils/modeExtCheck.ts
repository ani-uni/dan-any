import { ModeSchema } from "@/core/db/schema.ts";
import type { Extra, ExtraBili } from "@/core/dm-extra.ts";
import { z } from "zod";

interface ModeExtCheckDanmaku {
  mode: z.infer<typeof ModeSchema>;
  extra: Extra | null;
}

const checkExtraBili = (obj?: ExtraBili) =>
  obj ? (["adv", "bas", "code", "command"] as (keyof ExtraBili)[]).some((k) => obj[k]) : false;

/**
 * 检查特殊弹幕(extra非普通弹幕扩展分区，即 extra.danuni.merge与extra.bili中的共通部分 以外)的弹幕是否正确设置了Ext模式
 * @param danmaku 待检查的弹幕对象
 * @returns 是否存在模式与extra不匹配的情况
 */
export function modeExtCheck(danmaku: ModeExtCheckDanmaku) {
  if (danmaku.mode !== "Ext" && danmaku.extra) {
    if (danmaku.extra.artplayer || checkExtraBili(danmaku.extra.bili)) {
      danmaku.mode = "Ext"; // 若传入引用则判断后自动修改，否则需手动修改
      return true;
    }
  }
  return false;
}
