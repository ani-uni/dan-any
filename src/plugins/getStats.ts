import { defineTransformer } from "@/adapters/index.ts";
import { danmakusSelectZod } from "@/core/db/schema.ts";
import type { z } from "zod";

const statsItemZod = danmakusSelectZod.pick({
  content: true,
  SOID: true,
  mode: true,
  fontsize: true,
  color: true,
  senderID: true,
  weight: true,
  pool: true,
  platform: true,
});
type StatsItem = z.infer<typeof statsItemZod>;

export const getStatsTransformerConfigurator = <const T extends readonly (keyof StatsItem)[]>(
  items: T,
) =>
  defineTransformer(async function (udanmakus) {
    type StatsMap = { [K in T[number]]: Map<StatsItem[K], number> };
    const statsMap = {} as StatsMap;
    const dans = await udanmakus;
    const buildStatMap = <K extends T[number]>(key: K) => {
      const statMap = new Map<StatsItem[K], number>();
      for (const dan of dans) {
        const val = dan[key];
        statMap.set(val, (statMap.get(val) ?? 0) + 1);
      }
      statsMap[key] = statMap;
    };
    for (const key of items) {
      buildStatMap(key);
    }
    return statsMap;
  });

export function getStatsUtil4getMost<T extends keyof StatsItem>(
  statMap: Map<StatsItem[T], number>,
) {
  if (statMap.size === 0) return { val: undefined, count: 0 };
  let mostVal: StatsItem[T] | undefined;
  let maxCount = 0;
  for (const [val, count] of statMap.entries()) {
    if (count > maxCount) {
      maxCount = count;
      mostVal = val;
    }
  }
  return { val: mostVal, count: maxCount };
}
