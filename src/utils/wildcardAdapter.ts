import { type Adapter, type Metadata } from "@/adapters/index.ts";
import { UniChunk, type InitedUniDB } from "@/core/index.ts";

/**
 * 通配插件: 在给定范围内尝试导入弹幕
 * @description
 * 可能会有3种返回：
 * 1. 导入成功(无额外参数要求): 直接返回UniChunk
 * 2. 导入成功(需要额外参数): 返回匹配到的Adapter
 * 3. 导入失败: 返回null
 */
export const WildcardBodyAdapterUtil = async (
  u: InitedUniDB | UniChunk,
  metadataList: Metadata[],
  body: unknown,
) => {
  const uchunk = u instanceof UniChunk ? u : await u.makeChunk({});
  for (const metadata of metadataList) {
    if (metadata.check?.body) {
      const r = await metadata.check.body(body);
      if (r !== null) {
        uchunk.delete(); // 需额外参数，返回适配器，当前测试用的chunk视为临时chunk
        return r;
      }
    }
    if (metadata.check?.adapter) {
      const r = await metadata.check.adapter(uchunk, body);
      if (r !== null) return r;
    }
  }
  uchunk.delete(); // 若为无额外参数要求的，其已经被返回，不会执行到这里
  return null;
};

export const WildcardFnAdapterUtil = (
  handlerList: [Metadata, Adapter][],
  fn: string,
): [Metadata, Adapter][] => {
  const possibleHandlers: [Metadata, Adapter][] = [];
  for (const [metadata, adapter] of handlerList) {
    if (metadata.check?.fn) {
      const r = metadata.check.fn(fn);
      if (r) {
        possibleHandlers.push([metadata, adapter]);
        continue;
      }
    } else {
      const r1 = fn.includes(metadata.type);
      if (r1) return [[metadata, adapter]];
      const r2 = metadata.ext.some((e) => fn.endsWith(e));
      if (r2) possibleHandlers.push([metadata, adapter]);
    }
  }
  return possibleHandlers;
};

export const WildcardAdapterUtil = async (
  u: InitedUniDB | UniChunk,
  handlerList: [Metadata, Adapter][],
  fn: string,
  body: unknown,
) => {
  const uchunk = u instanceof UniChunk ? u : await u.makeChunk({});
  const possileHandlers = WildcardFnAdapterUtil(handlerList, fn);
  return WildcardBodyAdapterUtil(
    uchunk,
    possileHandlers.map(([m]) => m),
    body,
  );
};
