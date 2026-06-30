import { defineAdapter, defineMetadata } from "./index.ts";
import { defaultUniDM } from "@/core/dm.ts";
import type { Extra, ExtraYouku } from "@/core/dm-extra.ts";
import { PlatformVideoSource } from "@/core/platform.ts";
import { UniID } from "@/core/uni-id.ts";
import { fileParser } from "@/utils/fileParser.ts";
import { z } from "zod";

interface DM_JSON_Youku {
  api: string;
  data: {
    result: string; // YoukuDataResult
  };
  ret: string[];
  traceId: string;
  v: string;
}

interface YoukuDataResult {
  code: 1;
  cost: string;
  data: {
    count: number;
    result: YoukuDanmaku[];
    scm: string;
  };
  message: string;
}

interface YoukuDanmaku {
  aid: number;
  content: string;
  createtime: string; // "YYYY-MM-DD HH:mm:ss"
  ct: number;
  extFields: {
    grade: number;
    aigc: number;
    voteUp: number;
  };
  id: number;
  iid: string;
  level: number;
  lid: number;
  likeShow?: boolean;
  mat: number;
  ouid: string;
  playat: number;
  propertis?: string; // YoukuPropertis
  status: number;
  type: number;
  uid: string;
  uid2: number;
  ver: number;
}

interface YoukuPropertis {
  appVersion?: string;
  size?: number;
  color?: number;
  pos?: number;
  stream?: string;
  effect?: number;
  smks?: number;
  dmfid?: number;
  gradientColors?: [number, number];
  gradientColorPositions?: number[];
  flowLightColors?: number[];
  flowLightColorsV2?: number[];
  flowLightColorPositions?: number[];
  flowLightColorPositionsV2?: number[];
  [key: string]: unknown;
}

const domain = PlatformVideoSource.Youku;

const zYoukuDanmaku = z.object({
  aid: z.number(),
  content: z.string(),
  createtime: z.string(),
  ct: z.number(),
  extFields: z.object({
    grade: z.number(),
    aigc: z.number(),
    voteUp: z.number(),
  }),
  id: z.number(),
  iid: z.string(),
  level: z.number(),
  lid: z.number(),
  likeShow: z.boolean().optional(),
  mat: z.number(),
  ouid: z.string(),
  playat: z.number(),
  propertis: z.string().optional(),
  status: z.number(),
  type: z.number(),
  uid: z.string(),
  uid2: z.number(),
  ver: z.number(),
}) satisfies z.ZodType<YoukuDanmaku>;

const zYoukuDataResult = z.object({
  code: z.literal(1),
  cost: z.string(),
  data: z.object({
    count: z.number(),
    result: z.array(zYoukuDanmaku),
    scm: z.string(),
  }),
  message: z.literal("success"),
}) satisfies z.ZodType<YoukuDataResult>;

const zYoukuPropertis = z
  .object({
    appVersion: z.string().optional(),
    size: z.number().optional(),
    color: z.number().optional(),
    pos: z.number().optional(),
    stream: z.string().optional(),
    effect: z.number().optional(),
    smks: z.number().optional(),
    dmfid: z.number().optional(),
    gradientColors: z.tuple([z.number(), z.number()]).optional(),
    gradientColorPositions: z.array(z.number()).optional(),
    flowLightColors: z.array(z.number()).optional(),
    flowLightColorsV2: z.array(z.number()).optional(),
    flowLightColorPositions: z.array(z.number()).optional(),
    flowLightColorPositionsV2: z.array(z.number()).optional(),
  })
  .catchall(z.unknown()) satisfies z.ZodType<YoukuPropertis>;

function jsonString<T>(schema: z.ZodType<T>) {
  return z.string().transform((str, ctx) => {
    try {
      return schema.parse(JSON.parse(str));
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid JSON string" });
      return z.NEVER;
    }
  });
}

const zYoukuOuter = z
  .object({
    api: z.literal("mopen.youku.danmu.list"),
    data: z.object({
      result: jsonString(zYoukuDataResult),
    }),
    ret: z.tuple([z.literal("SUCCESS::调用成功")]),
    traceId: z.string(),
    v: z.literal("1.0"),
  })
  .transform((data) => data.data.result);

const zYoukuPayload = z.union([zYoukuDataResult, zYoukuOuter]);

const zYoukuPropertisString = z
  .string()
  .transform((str) => {
    try {
      return JSON.parse(str) as unknown;
    } catch {
      return {};
    }
  })
  .pipe(zYoukuPropertis.catch({}));

const zYoukuCtime = z
  .string()
  .transform((ctime) => new Date(ctime.replace(" ", "T")))
  .catch(() => new Date())
  .transform((date) => (Number.isNaN(date.getTime()) ? new Date() : date));

function parseProperties(raw?: string): YoukuPropertis {
  return raw ? zYoukuPropertisString.parse(raw) : {};
}

// function mapPositionToMode(pos?: number) {
//   if (pos === 4) return "Ext" as const;
//   return "Normal" as const;
// }

function mapSizeToFontsize(size?: number) {
  if (size === 1) return defaultUniDM.fontsize;
  if (size === 2) return 30;
  if (size === 4) return 36;
  return defaultUniDM.fontsize;
}

function mapWeight(voteUp?: number) {
  if (!voteUp) return defaultUniDM.weight;
  return Math.min(10, Math.max(1, Math.ceil(Math.log2(voteUp + 1))));
}

export const YoukuAdapter = defineAdapter((json: DM_JSON_Youku | YoukuDataResult) => {
  return async (udb, uchunk) => {
    const payload = zYoukuPayload.parse(json);
    const list: YoukuDanmaku[] = Array.isArray(payload?.data?.result) ? payload.data.result : [];
    const chunk = uchunk ?? (await udb.makeChunk({ fromConverted: false }));
    const SOID = `def_${PlatformVideoSource.Youku}+${UniID.fromYouku(list[0].aid).toString()}`;
    await chunk.upsertDanmakus(
      list.map((item) => {
        const propertis = parseProperties(item.propertis);
        const senderID = UniID.fromYouku(item.uid || item.ouid || item.uid2).toString();
        const extraYouku: ExtraYouku = {
          aid: item.aid,
          ct: item.ct,
          id: item.id,
          iid: item.iid,
          mat: item.mat,
          ouid: item.ouid,
          uid: item.uid,
          uid2: item.uid2,
        };
        const gradient = propertis.gradientColors;
        const mapped = {
          attr: defaultUniDM.attr,
          fontsize: mapSizeToFontsize(propertis.size),
          ctime: zYoukuCtime.parse(item.createtime),
          weight: mapWeight(item.extFields?.voteUp),
          pool: "Def" as const,
          content: item.content,
          progress: item.playat,
          // mode: mapPositionToMode(propertis.pos),
          mode: "Normal" as const,
          color: propertis.color ?? gradient?.[0] ?? defaultUniDM.color,
          SOID,
          senderID,
          platform: domain,
          extra: {
            danuni: { color: { gradient } },
            youku: extraYouku,
          } satisfies Extra,
        };
        return {
          ...mapped,
          DMID: chunk.$UniDB.DMIDGenerator(mapped),
        };
      }),
    );
    return chunk;
  };
});

export const YoukuMetadata = defineMetadata({
  type: "youku.json",
  ext: [".json"],
  check: {
    adapter: async (uchunk, body) => {
      try {
        return await uchunk.import(YoukuAdapter(await fileParser(body, "json")));
      } catch {
        return null;
      }
    },
  },
});
