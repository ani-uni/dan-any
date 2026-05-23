import { danmakus } from "@/core/db/schema.ts";
import { defineTransformer, defineAdapter, type Transformer, defineMetadata } from "../index.ts";
import { defaultUniDM, DMAttr, Modes, Pools, type UniDMObj } from "@/core/dm.ts";
import { z } from "zod";
import { modeExtCheck } from "@/utils/modeExtCheck.ts";

import { migrateToV2Extra } from "@/utils/migrations/v2/extra.ts";
import { migrateToV2Progress } from "@/utils/migrations/v2/progress.ts";

export const enumModeCodec = z.codec(
  z.enum(Modes).default(Modes.Normal),
  z.enum(danmakus.mode.enumValues),
  {
    decode: (danuniMode) => danmakus.mode.enumValues[danuniMode] || "Normal",
    encode: (dbMode) => Modes[dbMode] || Modes.Normal,
  },
);
export const enumPoolCodec = z.codec(
  z.enum(Pools).default(Pools.Def),
  z.enum(danmakus.pool.enumValues),
  {
    decode: (danuniPool) => danmakus.pool.enumValues[danuniPool] || "Def",
    encode: (dbPool) => Pools[dbPool] || Pools.Def,
  },
);
export const enumAttrsCodec = z.codec(
  z.enum(DMAttr).array(),
  z.enum(danmakus.attr.enumValues).array(),
  {
    decode: (danuniAttrs) => danuniAttrs,
    encode: (dbAttrs) => dbAttrs.map((attr) => DMAttr[attr]),
  },
);

function isV1UniObj(
  json: Partial<UniDMObj> & { extraStr?: string },
): json is Partial<UniDMObj> & { extraStr: string } {
  const progressIsV1 = !Number.isInteger(json.progress);
  const extraIsV1 = typeof json.extraStr === "string";
  return progressIsV1 || extraIsV1;
}

export const DanuniJsonAdapter = defineAdapter(
  (json: Partial<UniDMObj & { extraStr?: string }>[], options?: { isV1?: boolean }) => {
    return async (udb, uchunk) => {
      const now = new Date();
      const chunk = uchunk ?? (await udb.makeChunk({}));
      const isV1Fmt = options?.isV1 ? true : json.some((d) => isV1UniObj(d));
      await chunk.upsertDanmakus(
        json.map((d) => {
          const map_d = {
            SOID: d.SOID || defaultUniDM.SOID,
            progress: d.progress
              ? isV1Fmt
                ? migrateToV2Progress(d.progress)
                : d.progress
              : defaultUniDM.progress,
            mode: enumModeCodec.decode(d.mode),
            fontsize: d.fontsize ?? defaultUniDM.fontsize,
            color: d.color ?? defaultUniDM.color,
            senderID: d.senderID || defaultUniDM.senderID,
            content: d.content ?? defaultUniDM.content,
            ctime: d.ctime ? new Date(d.ctime) : now,
            weight: d.weight ?? defaultUniDM.weight,
            pool: enumPoolCodec.decode(d.pool),
            attr: d.attr ? enumAttrsCodec.decode(d.attr) : defaultUniDM.attr,
            platform: d.platform ?? defaultUniDM.platform,
            extra: d.extra ?? (d.extraStr ? migrateToV2Extra(d.extraStr) : defaultUniDM.extra),
          };
          modeExtCheck(map_d);
          return {
            ...map_d,
            DMID: !isV1Fmt && d.DMID ? d.DMID : chunk.$UniDB.DMIDGenerator(map_d),
          };
        }),
      );
      return chunk;
    };
  },
);

interface DanuniJsonTransformerOptions {
  /**
   * 是否启用minify模式，启用后会将输出中与默认值相同的字段转为undefined(DMID除外)，以减小输出体积
   */
  minify?: boolean;
}

export function DanuniJsonTransformerConfigurator(
  options: DanuniJsonTransformerOptions & { minify: true },
): Transformer<Promise<Partial<UniDMObj>[]>>;
export function DanuniJsonTransformerConfigurator(
  options?: DanuniJsonTransformerOptions,
): Transformer<Promise<UniDMObj[]>>;
export function DanuniJsonTransformerConfigurator(
  options?: DanuniJsonTransformerOptions,
): Transformer {
  return defineTransformer((udanmakus) =>
    udanmakus.then((data) => {
      if (options?.minify) {
        return data.map((d) => ({
          SOID: d.SOID === defaultUniDM.SOID ? undefined : d.SOID,
          progress: d.progress === defaultUniDM.progress ? undefined : d.progress,
          mode: d.mode === "Normal" ? undefined : enumModeCodec.encode(d.mode),
          fontsize: d.fontsize === defaultUniDM.fontsize ? undefined : d.fontsize,
          color: d.color === defaultUniDM.color ? undefined : d.color,
          senderID: d.senderID === defaultUniDM.senderID ? undefined : d.senderID,
          content: d.content === defaultUniDM.content ? undefined : d.content,
          ctime: d.ctime,
          weight: d.weight === defaultUniDM.weight ? undefined : d.weight,
          pool: d.pool === "Def" ? undefined : enumPoolCodec.encode(d.pool),
          attr: d.attr && d.attr.length > 0 ? enumAttrsCodec.encode(d.attr) : undefined,
          platform: d.platform ?? undefined,
          extra: d.extra ?? undefined,
          DMID: d.DMID,
        }));
      } else
        return data.map((d) => ({
          ...d,
          mode: enumModeCodec.encode(d.mode)!,
          pool: enumPoolCodec.encode(d.pool)!,
          attr: enumAttrsCodec.encode(d.attr),
        }));
    }),
  );
}

export const DanuniJsonMetadata = defineMetadata({
  type: "danuni.json",
  ext: [".json"],
  check: {
    adapter: async (uchunk, body) => {
      if (typeof body !== "object" || !body) return false;
      try {
        return uchunk.import(DanuniJsonAdapter(body as any));
      } catch {
        return false;
      }
    },
  },
});
