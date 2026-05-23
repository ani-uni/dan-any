import { UniChunk, type AdapterStore, type DMIDGenerator, type InitedUniDB } from "@/core/index.ts";
import type { Promisable } from "type-fest";

export type TransformerInput = InitedUniDB | UniChunk;
export function transformerInput2Danmakus(input: TransformerInput) {
  return input.$danmakus;
}

export type UDanmaku = Awaited<ReturnType<typeof transformerInput2Danmakus>>[number];

export type Adapter<Args extends any[] = any[]> = (...args: Args) => Promisable<AdapterStore>;
export type Transformer<T = unknown> = (
  udanmakus: ReturnType<typeof transformerInput2Danmakus>,
  ctx: {
    uchunk?: Awaited<ReturnType<typeof UniChunk.prototype.$chunk>>;
    DMIDGenerator: DMIDGenerator;
  },
) => Promisable<T>;
export type Plugin<T = unknown> = (uchunk: UniChunk) => Promisable<T>;
export type Metadata = {
  type: string;
  ext: string[];
  check?: {
    fn?: (fn: string) => boolean; // 基于文件名的自定义检测方法，默认根据ext自动检测
    body?: (body: unknown) => Promisable<boolean>; // 基于文件内容的检测方法，成功则认为检测通过
    adapter?: (uchunk: UniChunk, body: unknown) => Promisable<boolean | UniChunk>; // 同上，但上下文给定一个特定chunk，若使用Adapter导入进行检测，应使用该方法;返回UniChunk表示非临时导入，可直接使用
  };
};

export function defineAdapter<T extends Adapter>(adapter: T) {
  return adapter;
}
export function defineTransformer<T extends Transformer>(transformer: T) {
  return transformer;
}
export function definePlugin<T extends Plugin>(plugin: T) {
  return plugin;
}
export function defineMetadata(metadata: Metadata) {
  return metadata;
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
export * from "./vod.ts";
