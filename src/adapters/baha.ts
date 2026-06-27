import { defineAdapter, defineMetadata, defineTransformer } from "./index.ts";

import { DanUniConvertTipTemplate, defaultUniDM, type DanUniConvertTip } from "@/core/dm.ts";
import { PlatformVideoSource } from "@/core/platform.ts";
import { UniID } from "@/core/uni-id.ts";
import { transMode } from "@/utils/transMode.ts";
import { fileParser } from "@/utils/fileParser.ts";
import { z } from "zod";

enum DM_JSON_Baha_size {
  Small = 0,
  Medium = 1,
  Large = 2,
}
enum DM_JSON_Baha_position {
  RTL = 0,
  TOP = 1,
  BOTTOM = 2,
}

interface DM_JSON_Baha {
  data: {
    danmu: {
      /** 弹幕 ID */
      sn: number;
      /** 弹幕文本 */
      text: string;
      /** 出现时间， time/10 = 秒 */
      time: number;
      /** 颜色，#RRGGBB 格式 */
      color: string;
      /** 字体大小（0=小, 1=中, 2=大） */
      size: DM_JSON_Baha_size;
      /** 位置：0-滚动 1-顶部 2-底部 */
      position: DM_JSON_Baha_position;
      /** 用户名 */
      userid: string;
    }[];
    totalCount?: number;
  };
}

export const BahaZod = z.object({
  data: z.object({
    danmu: z.array(
      z.object({
        sn: z.int(),
        text: z.string(),
        time: z.int(),
        color: z.string(),
        size: z.enum(DM_JSON_Baha_size).default(DM_JSON_Baha_size.Medium),
        position: z.enum(DM_JSON_Baha_position).default(DM_JSON_Baha_position.RTL),
        userid: z.string(),
      }),
    ),
    totalCount: z.int().optional(),
  }),
});
const zBahaSizeCodec = z.codec(z.enum(DM_JSON_Baha_size), z.int(), {
  decode: (size) => {
    switch (size) {
      case DM_JSON_Baha_size.Small:
        return 18;
      case DM_JSON_Baha_size.Medium:
        return 25;
      case DM_JSON_Baha_size.Large:
        return 36;
    }
  },
  encode: (fontsize) => {
    if (fontsize <= 18) return DM_JSON_Baha_size.Small;
    else if (fontsize <= 25) return DM_JSON_Baha_size.Medium;
    else return DM_JSON_Baha_size.Large;
  },
});

export const BahaAdapter = defineAdapter(
  (json: DM_JSON_Baha & { danuni?: DanUniConvertTip }, sn?: number) => {
    return async (udb, uchunk) => {
      const fromConverted = !!json.danuni;
      const chunk = uchunk ?? (await udb.makeChunk({ fromConverted }));
      const recSOID = fromConverted ? json.danuni?.data : undefined;
      const SOID = sn
        ? UniID.fromUnknown(
            `def_${PlatformVideoSource.Baha}+${sn}`,
            PlatformVideoSource.Baha,
          ).toString()
        : (recSOID ?? UniID.fromNull(PlatformVideoSource.Baha).toString());
      const now = new Date();
      await chunk.upsertDanmakus(
        BahaZod.parse(json).data.danmu.map((d) => {
          const senderID = UniID.fromUnknown(d.userid, PlatformVideoSource.Baha).toString();
          const map_d = {
            attr: defaultUniDM.attr,
            fontsize: zBahaSizeCodec.decode(d.size),
            ctime: now,
            weight: defaultUniDM.weight,
            pool: "Def" as const,
            content: d.text,
            progress: d.time * 100, // time / 10 * 1000
            mode: transMode(d.position, "baha"),
            color: Number.parseInt(d.color.replace("#", ""), 16),
            SOID,
            senderID,
            platform: PlatformVideoSource.Baha,
            extra: { baha: { sn: d.sn, userid: d.userid, size: d.size } },
          };
          return {
            ...map_d,
            DMID: chunk.$UniDB.DMIDGenerator(map_d),
          };
        }),
      );
      return chunk;
    };
  },
);

// const genSN = (id?: string) => {
//   if (id) {
//     const uniID = UniID.fromStringSafe(id);
//     if (uniID.domain === PlatformVideoSource.Baha) {
//       const sn = uniID.id.replaceAll(`def_${PlatformVideoSource.Baha}+`, "");
//       if (sn) return sn;
//     }
//     return id;
//   } else return UniID.fromNull().toString();
// };

export const BahaTransformer = defineTransformer(
  (udanmakus): DM_JSON_Baha & { danuni?: DanUniConvertTip } => ({
    danuni: {
      ...DanUniConvertTipTemplate,
      data: [...new Set(udanmakus.map((d) => d.SOID))][0],
    },
    data: {
      danmu: udanmakus.map((d) => {
        let position = 0;
        if (d.mode === "Top") position = 1;
        else if (d.mode === "Bottom") position = 2;
        return {
          sn: d.extra?.baha?.sn ?? 0,
          text: d.content,
          time: ~~(d.progress / 100),
          color: `#${d.color.toString(16).toUpperCase() || "FFFFFF"}`,
          size: zBahaSizeCodec.encode(d.fontsize),
          position,
          userid: d.extra?.baha?.userid ?? "",
        };
      }),
      totalCount: udanmakus.length,
    },
  }),
);

export const BahaMetadata = defineMetadata({
  type: "baha.json",
  ext: [".json"],
  check: {
    adapter: async (uchunk, body) => {
      try {
        await uchunk.import(BahaAdapter(await fileParser(body, "json")));
        return BahaAdapter;
      } catch {
        return null;
      }
    },
  },
});
