/**
 * 将 v1 版本的 extraStr 转换为新的 extra 格式
 * - extraStr -> extra
 * - extra.bili.dmid extra.bili.mid : bigint -> string
 */

import type { Extra, ExtraBili } from "@/core/dm.ts";
import { JSON } from "@/utils/bigint.ts";
import type { Simplify } from "type-fest";

type V1_ExtraBili = Omit<ExtraBili, "dmid" | "mid"> & {
  dmid?: bigint;
  mid?: bigint;
};
export type V1_Extra = Simplify<
  Omit<Extra, "bili"> & {
    bili?: V1_ExtraBili;
  }
>;

export function migrateToV2Extra(extraStr: string): Extra {
  const extra: V1_Extra = JSON.parse(extraStr);
  return {
    ...extra,
    bili: extra.bili
      ? { ...extra.bili, dmid: extra.bili.dmid?.toString(), mid: extra.bili.mid?.toString() }
      : undefined,
  } satisfies Extra;
}
