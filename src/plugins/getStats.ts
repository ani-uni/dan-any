import { defineTransformer } from "@/adapters/index.ts";
import type { DanmakusSelect } from "@/core/index.ts";
type StatsItem = Pick<
  DanmakusSelect,
  "content" | "SOID" | "mode" | "fontsize" | "color" | "senderID" | "weight" | "pool" | "platform"
>;

export const GetStatsTransformerConfigurator = <const T extends readonly (keyof StatsItem)[]>(
  items: T,
) =>
  defineTransformer(async function (udanmakus) {
    type StatsMap = { [K in T[number]]: Map<StatsItem[K], number> };
    const statsMap = {} as StatsMap;
    const buildStatMap = <K extends T[number]>(key: K) => {
      const statMap = new Map<StatsItem[K], number>();
      for (const dan of udanmakus) {
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

export function GetStatsUtil4getMost<T extends unknown>(statMap: Map<T, number>) {
  if (statMap.size === 0) return { val: undefined, count: 0 };
  let mostVal: T | undefined = undefined;
  let maxCount = 0;
  for (const [val, count] of statMap.entries()) {
    if (count > maxCount) {
      maxCount = count;
      mostVal = val;
    }
  }
  return { val: mostVal, count: maxCount };
}
