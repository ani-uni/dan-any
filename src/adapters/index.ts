import { UniChunk, type AdapterStore, type DMIDGenerator, type InitedUniDB } from "@/core/index.ts";
import type { Promisable } from "type-fest";

export type TransformerInput = InitedUniDB | UniChunk;
export function transformerInput2Danmakus(input: TransformerInput) {
  return input.$danmakus;
}

export type UDanmaku = Awaited<ReturnType<typeof transformerInput2Danmakus>>[number];

export type Adapter<Args extends unknown[] = unknown[]> = (
  ...args: Args
) => Promisable<AdapterStore>;
export type Transformer<T = unknown> = (
  udanmakus: ReturnType<typeof transformerInput2Danmakus>,
  ctx: {
    uchunk?: Awaited<ReturnType<typeof UniChunk.prototype.$chunk>>;
    DMIDGenerator: DMIDGenerator;
  },
) => Promisable<T>;
export type Plugin<T = unknown> = (uchunk: UniChunk) => Promisable<T>;

export function defineAdapter<T extends (...args: any[]) => Promisable<AdapterStore>>(adapter: T) {
  return adapter;
}
export function defineTransformer<T extends Transformer>(transformer: T) {
  return transformer;
}
export function definePlugin<T extends Plugin>(plugin: T) {
  return plugin;
}

export * from "./danuni/json.ts";
export * from "./danuni/pb.ts";
export * from "./bili/command-grpc.ts";
export * from "./bili/grpc.ts";
export * from "./bili/up.ts";
export * from "./bili/xml.ts";
export * from "./artplayer.ts";
export * from "./ddplay.ts";
export * from "./dplayer.ts";
export * from "./tencent.ts";
