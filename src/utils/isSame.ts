import { DMAttrSchema, ModeSchema, PoolSchema } from "@/core/db/schema.ts";
import { type UniDMObj } from "@/core/dm.ts";
import type { z } from "zod";

interface UniDMComparable extends Omit<UniDMObj, "mode" | "pool" | "attr"> {
  mode: z.infer<typeof ModeSchema>;
  pool: z.infer<typeof PoolSchema>;
  attr: z.infer<typeof DMAttrSchema>[];
}

export function isSame(
  that: UniDMComparable,
  dan: UniDMComparable,
  options?: { skipDanuniMerge?: boolean },
): boolean {
  // 引用相同直接返回
  if (that === dan) return true;
  // 不支持比较高级弹幕
  if (that.mode === "Ext" || dan.mode === "Ext") return false;
  // 合并过视为不同，防止存在合并完成弹幕后再次合并造成计数错误
  if (!options?.skipDanuniMerge && (that.extra?.danuni?.merge || dan.extra?.danuni?.merge))
    return false;
  // 如果是bili弹幕，则以dmid判断是否相同
  if (that.extra?.bili?.dmid && dan.extra?.bili?.dmid) {
    // 当来源不同(标准源/创作中心源)时，视为不同弹幕
    if (
      (that.extra?.bili.dmid && !dan.extra?.bili.dmid) ||
      (!that.extra?.bili.dmid && dan.extra?.bili.dmid)
    )
      return false;
    if (that.extra?.bili.dmid === dan.extra?.bili.dmid) return true;
    else return false;
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
  const isSame = (k: keyof UniDMObj) => that[k] === dan[k];
  const checks = (
    ["SOID", "content", "mode", "pool", "platform"] satisfies (keyof UniDMObj)[]
  ).every((k) => isSame(k));
  // 忽略使用了extra字段却不在mode里标记的弹幕
  return checks;
}
