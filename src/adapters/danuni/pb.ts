import {
  Mode as DanuniPbMode,
  Pool as DanuniPbPool,
} from "@/utils/proto/gen/danuni/danmaku/v1/danmaku_pb.ts";

import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import { timestampDate, timestampFromDate, timestampNow } from "@bufbuild/protobuf/wkt";

import { ListDanResponseSchema } from "@/utils/proto/gen/danuni/danmaku/v1/danmaku_pb.ts";
import { defineAdapter, defineMetadata, defineTransformer } from "../index.ts";
import { danmakus } from "@/core/db/schema.ts";
import { z } from "zod";

import { JSON } from "@/utils/bigint.ts";
import { migrateToV2Extra } from "@/utils/migrations/v2/extra.ts";
import { defaultUniDM } from "@/core/dm.ts";

const enumModeCodec = z.codec(z.enum(DanuniPbMode), z.enum(danmakus.mode.enumValues), {
  decode: (danuniPbMode) => danmakus.mode.enumValues[danuniPbMode] || "Normal",
  encode: (dbMode) => {
    const i = danmakus.mode.enumValues.indexOf(dbMode);
    return i === -1 ? DanuniPbMode.NORMAL_UNSPECIFIED : i;
  },
});
const enumPoolCodec = z.codec(z.enum(DanuniPbPool), z.enum(danmakus.pool.enumValues), {
  decode: (danuniPbPool) => danmakus.pool.enumValues[danuniPbPool] || "Def",
  encode: (dbPool) => {
    const i = danmakus.pool.enumValues.indexOf(dbPool);
    return i === -1 ? DanuniPbPool.DEF_UNSPECIFIED : i;
  },
});

export const DanuniPbAdapter = defineAdapter((bin: Uint8Array | ArrayBuffer) => {
  return async (udb, uchunk) => {
    const data = fromBinary(ListDanResponseSchema, new Uint8Array(bin));
    const chunk = uchunk ?? (await udb.makeChunk({}));
    const isV1Fmt = data.danmakus.some((d) => d.extraV1);
    await chunk.upsertDanmakus(
      data.danmakus.map((d) => {
        const map_d = {
          ...d,
          SOID: d.soid,
          DMID: d.dmid,
          // progress: d.progress,
          mode: enumModeCodec.decode(d.mode),
          // fontsize: d.fontsize,
          // color: d.color,
          senderID: d.senderId,
          // content: d.content,
          ctime: timestampDate(d.ctime || timestampNow()),
          // weight: d.weight,
          pool: enumPoolCodec.decode(d.pool),
          attr: z.enum(danmakus.attr.enumValues).array().parse(d.attr),
          platform: d.platform ?? defaultUniDM.platform,
          extra: d.extra
            ? JSON.parse(d.extra)
            : d.extraV1
              ? migrateToV2Extra(d.extraV1)
              : undefined,
        };
        if (isV1Fmt) return { ...map_d, DMID: chunk.$UniDB.DMIDGenerator(map_d) };
        else return map_d;
      }),
    );
    return chunk;
  };
});

export const DanuniPbTransformer = defineTransformer((udanmakus): Promise<Uint8Array> => {
  return udanmakus.then((data) =>
    toBinary(
      ListDanResponseSchema,
      create(ListDanResponseSchema, {
        danmakus: data.map((d) => ({
          ...d,
          soid: d.SOID,
          dmid: d.DMID,
          mode: enumModeCodec.encode(d.mode),
          senderId: d.senderID,
          ctime: timestampFromDate(d.ctime),
          pool: enumPoolCodec.encode(d.pool),
          // attr: d.attr,
          platform: d.platform ?? undefined,
          extra: JSON.stringify(d.extra),
          // $typeName: "danuni.danmaku.v1.Danmaku" as const,
        })),
      }),
    ),
  );
});

export const DanuniPbMetadata = defineMetadata({
  type: "danuni.binpb",
  ext: [".binpb", ".bin", ".pb.bin"],
  check: {
    adapter: async (uchunk, body) => {
      if (typeof body !== "object") return false;
      if (!(body instanceof ArrayBuffer) && !ArrayBuffer.isView(body)) return false;
      try {
        let buf: Uint8Array;
        if (body instanceof ArrayBuffer) {
          buf = new Uint8Array(body);
        } else if (ArrayBuffer.isView(body)) {
          const view = body;
          buf = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        } else {
          return false;
        }
        return uchunk.import(DanuniPbAdapter(buf));
      } catch {
        return false;
      }
    },
  },
});
