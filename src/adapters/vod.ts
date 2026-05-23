import { DanUniConvertTipTemplate, defaultUniDM, type DanUniConvertTip } from "@/core/dm.ts";
import { defineAdapter, defineMetadata, defineTransformer } from "./index.ts";
import { z } from "zod";
import { UniID } from "@/core/uni-id.ts";
import { transMode } from "@/utils/transMode.ts";

interface DM_JSON_Vod {
  code: number;
  name: string; //url str 带转义符
  danum: number;
  danmuku: [number, string, string, string, string, string, string, string][];
}

export const VodZod = z.object({
  code: z.number(),
  name: z.string(),
  danum: z.number(),
  danmuku: z.array(
    z
      .tuple([
        z.coerce.number<string>().min(0), // time
        z.union([z.literal("right"), z.literal("top"), z.literal("bottom")]), // mode
        z
          .string()
          .toUpperCase()
          .regex(/^#([0-9a-fA-F]{3}){1,2}$/, {
            error: "Invalid hex color format",
          })
          .transform((hex) => {
            // pad hex to 6 chars and make upper case
            if (hex.length > 6) {
              return hex.toUpperCase();
            }
            const val = hex.split("#");
            return `#${val[1].toUpperCase()}`;
          }), // color
        z.string().prefault(""), // ?
        z.string(), // text
        z.string().prefault(""), // ?
        z.string().prefault(""), // ?
        z.string().regex(/^\d+px$/), // font size
      ])
      .rest(z.any()),
  ),
});

export const VodAdapter = defineAdapter(
  (json: DM_JSON_Vod, videoId?: string, domain: string = "other") => {
    return async (udb, uchunk) => {
      const chunk = uchunk ?? (await udb.makeChunk({ fromConverted: false }));
      const SOID = videoId
        ? UniID.fromUnknown(videoId, domain).toString()
        : UniID.fromNull(domain).toString();
      const senderID = UniID.fromNull(domain).toString();
      const now = new Date();
      await chunk.upsertDanmakus(
        // the danmaku list often has extra items in the beginning, use slice to remove them
        // 由系统自动插入的无关弹幕，需要根据弹幕数去除
        json.danmuku.slice(-json.danum).map((d) => {
          const map_d = {
            ...defaultUniDM,
            pool: "Def" as const,
            ctime: now,
            SOID,
            senderID,
            progress: ~~(d[0] * 1000),
            mode: transMode(d[1], "vod"),
            color: Number((d[2] || "FFFFFF").replace("#", "0x")),
            content: d[4],
            fontsize: Number(d[7].replace("px", "")),
          };
          return { ...map_d, DMID: chunk.$UniDB.DMIDGenerator(map_d) };
        }),
      );
      return chunk;
    };
  },
);

export const VodTransformer = defineTransformer(
  (udanmakus): Promise<DM_JSON_Vod & { danuni?: DanUniConvertTip }> => {
    return udanmakus.then((dans) => {
      return {
        danuni: {
          ...DanUniConvertTipTemplate,
          data: dans[0]?.SOID.split("@")[0],
        },
        code: 0,
        name: dans[0]?.SOID ?? "unknown",
        danum: dans.length,
        danmuku: dans.map((d) => {
          let mode = "right";
          switch (d.mode) {
            case "Top":
              mode = "top";
              break;
            case "Bottom":
              mode = "bottom";
              break;
          }
          return [
            d.progress / 1000,
            mode,
            `#${d.color.toString(16).toUpperCase() || "FFFFFF"}`,
            "",
            d.content,
            "",
            "",
            `${d.fontsize}px`,
          ];
        }),
      };
    });
  },
);

export const VodMetadata = defineMetadata({
  type: "vod.json",
  ext: [".json"],
  check: {
    body: (body) => {
      return VodZod.safeParse(body).success ? VodAdapter : null;
    },
    adapter: async (uchunk, body) => {
      if (typeof body !== "object" || !body) return null;
      try {
        await uchunk.import(VodAdapter(body as any));
        return VodAdapter;
      } catch {
        return null;
      }
    },
  },
});
