import { DMAttrSchema, ModeSchema, PoolSchema } from "@/core/db/schema.ts";
import type { ExtraBili } from "@/core/dm-extra.ts";
import { type UniDMObj } from "@/core/dm.ts";
import type { UniChunk } from "@/core/index.ts";
import type { z } from "zod";

interface UniDMComparable extends Omit<UniDMObj, "mode" | "pool" | "attr"> {
  mode: z.infer<typeof ModeSchema>;
  pool: z.infer<typeof PoolSchema>;
  attr: z.infer<typeof DMAttrSchema>[];
}

type Comp = Pick<
  UniDMComparable | Awaited<UniChunk["$danmakus"]>[number],
  "SOID" | "content" | "mode" | "pool" | "platform" | "extra"
>;

function biliSp(that: ExtraBili) {
  return that.adv || that.code || that.bas || that.command;
}

export function isSame(that: Comp, dan: Comp, options?: { skipDanuniMerge?: boolean }): boolean {
  // 引用相同直接返回
  if (that === dan) return true;
  // 不支持比较高级弹幕
  if (that.mode === "Ext" || dan.mode === "Ext") return false;
  // 合并过视为不同，防止存在合并完成弹幕后再次合并造成计数错误
  if (!options?.skipDanuniMerge && (that.extra?.danuni?.merge || dan.extra?.danuni?.merge))
    return false;
  // 如果是bili弹幕，则以dmid判断是否相同
  if (that.extra?.bili?.dmid && dan.extra?.bili?.dmid) {
    // bili所有非一般类型的弹幕均直接判断为不同
    if (biliSp(that.extra.bili) || biliSp(dan.extra.bili)) return false;
    // 下面只会有来自 std/up 源的普通弹幕
    // 此时可以用mid原始值是否存在判断是否为up源弹幕
    // 当来源不同(标准源/创作中心源)时，视为不同弹幕
    if (
      (that.extra?.bili.mid && !dan.extra?.bili.mid) ||
      (!that.extra?.bili.mid && dan.extra?.bili.mid)
    )
      return false;
    // 不对dmid等原始值备份进行比较(若比较dmid，则必定不同，不符合比较函数使用场景)
    // 直接跳出bili特定判断，进入后续通用比较
  }
  // 如果是artplayer弹幕，需额外比较extra项目
  if (
    (that.extra?.artplayer && !dan.extra?.artplayer) ||
    (!that.extra?.artplayer && dan.extra?.artplayer)
  )
    return false;
  else if (
    that.extra?.artplayer &&
    dan.extra?.artplayer &&
    (that.extra?.artplayer.border !== dan.extra?.artplayer.border ||
      JSON.stringify(that.extra?.artplayer.style) !== JSON.stringify(dan.extra?.artplayer.style))
  )
    return false;
  const isSame = (k: keyof Comp) => that[k] === dan[k];
  const checks = (["SOID", "content", "mode", "pool", "platform"] satisfies (keyof Comp)[]).every(
    (k) => isSame(k),
  );
  // 忽略使用了extra字段却不在mode里标记的弹幕
  return checks;
}
