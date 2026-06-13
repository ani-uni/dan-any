import { expectTypeOf, it } from "vite-plus/test";
import { db as nullableDb } from "@/core/db/index.ts";
import type { ChunksInsert, UChunk, UChunk2Danmaku, UDanmaku } from "@/core/index.ts";
import type { chunksZod } from "@/core/db/schema.ts";
import type { z } from "zod";

it("确保同一类型与drizzle db定义相同", () => {
  const db = nullableDb as NonNullable<typeof nullableDb>;
  expectTypeOf<Awaited<ReturnType<typeof db.query.chunks.findMany>>>().toEqualTypeOf<UChunk[]>();
  expectTypeOf<Awaited<ReturnType<typeof db.query.danmakus.findMany>>>().toEqualTypeOf<
    UDanmaku[]
  >();
  expectTypeOf<Awaited<ReturnType<typeof db.query.chunk2danmakus.findMany>>>().toEqualTypeOf<
    UChunk2Danmaku[]
  >();

  expectTypeOf<z.infer<typeof chunksZod>>().toEqualTypeOf<ChunksInsert>();
});
