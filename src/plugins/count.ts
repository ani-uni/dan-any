import { defineTransformer } from "@/adapters/index.ts";

export const CountTransformer = defineTransformer((udanmakus) => udanmakus.then((d) => d.length));
