import { defineTransformer } from "@/adapters/index.ts";

export const countTransformer = defineTransformer((udanmakus) => udanmakus.then((d) => d.length));
