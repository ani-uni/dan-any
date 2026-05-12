import { danmakus, onConflictDoUpdate } from "@/core/db/schema.ts";
import { defineTransformer, defineAdapter, type Transformer } from "../index.ts";
import { defaultUniDM, DMAttr, Modes, Pools, type UniDMObj } from "@/core/dm.ts";
import { createDMID } from "@/core/id.ts";
import { z } from "zod";
import { modeExtCheck } from "@/utils/modeExtCheck.ts";

import { migrateToV2Extra } from "@/utils/migrations/v2/extra.ts";

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

export const DanuniJsonAdapter = defineAdapter(
  (json: Partial<UniDMObj & { extraStr?: string }>[]) => {
    return async (udb, uchunk) => {
      const now = new Date();
      const chunk = uchunk ?? (await udb.makeChunk({ fromConverted: false }));
      await udb.$drizzle
        .insert(danmakus)
        .values(
          json.map((d) => {
            const map_d = {
              SOID: d.SOID || defaultUniDM.SOID,
              progress: d.progress ?? defaultUniDM.progress,
              mode: enumModeCodec.decode(d.mode),
              fontsize: d.fontsize ?? defaultUniDM.fontsize,
              color: d.color ?? defaultUniDM.color,
              senderID: d.senderID || defaultUniDM.senderID,
              content: d.content ?? defaultUniDM.content,
              ctime: d.ctime ?? now,
              weight: d.weight ?? defaultUniDM.weight,
              pool: enumPoolCodec.decode(d.pool),
              attr: d.attr ? enumAttrsCodec.decode(d.attr) : defaultUniDM.attr,
              platform: d.platform ?? defaultUniDM.platform,
              extra: d.extra ?? (d.extraStr ? migrateToV2Extra(d.extraStr) : defaultUniDM.extra),
            };
            modeExtCheck(map_d);
            return {
              chunkID: chunk.id,
              ...map_d,
              DMID:
                d.DMID ||
                createDMID({
                  ...map_d,
                  // 以下两个的类型partial由zod的default导致，但实际上以确保存在
                  mode: enumModeCodec.encode(map_d.mode)!,
                  pool: enumPoolCodec.encode(map_d.pool)!,
                }),
            };
          }),
        )
        .onConflictDoUpdate(onConflictDoUpdate.danmakus);
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
