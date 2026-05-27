import { defineTransformer } from "@/adapters/index.ts";

/**
 * 计数转换器：统计弹幕数量，适用于需要获取弹幕总数的场景
 * @deprecated 建议直接使用UniChunk的$count属性获取弹幕数量
 */
export const CountTransformer = defineTransformer((udanmakus) => udanmakus.then((d) => d.length));
