import { defineAdapter, defineMetadata } from "./index.ts";
import { defaultUniDM } from "@/core/dm.ts";
import { PlatformVideoSource } from "@/core/platform.ts";
import { UniID } from "@/core/uni-id.ts";
import { fileParser } from "@/utils/fileParser.ts";
import type { Extra, ExtraMgtv } from "@/core/dm-extra.ts";
import { JSON } from "@/utils/bigint.ts";
import { transMode } from "@/utils/transMode.ts";

interface MgtvColor {
  r: number;
  g: number;
  b: number;
}

interface MgtvDanmaku {
  id?: bigint | number;
  ids: string;
  type?: number;
  uid: number;
  uuid: string;
  content: string;
  time: number;
  v2_up_count?: number;
  v2_position?: number;
  v2_color?: {
    color_left: MgtvColor;
    color_right: MgtvColor;
  };
}

interface DM_JSON_Mgtv {
  status?: number;
  data: {
    next?: number;
    interval?: number;
    total?: number;
    items: MgtvDanmaku[];
  };
}

// 芒果返回的颜色通道可出现 -1，表示该端点不提供颜色
function clampColor(v: number) {
  if (!Number.isInteger(v)) return undefined;
  return v >= 0 && v <= 255 ? v : undefined;
}

function rgbToColor(rgb?: MgtvColor) {
  if (!rgb) return undefined;
  const r = clampColor(rgb.r);
  const g = clampColor(rgb.g);
  const b = clampColor(rgb.b);
  if (r === undefined || g === undefined || b === undefined) return undefined;
  return (r << 16) + (g << 8) + b;
}

function weightFromUpCount(v2_up_count?: number) {
  const count = typeof v2_up_count === "number" && Number.isFinite(v2_up_count) ? v2_up_count : 0;
  if (count <= 0) return defaultUniDM.weight;
  return Math.min(10, Math.max(1, Math.ceil(Math.log2(count + 1))));
}

export const MgtvAdapter = defineAdapter((json: DM_JSON_Mgtv, vid?: number, cid?: number) => {
  return async (udb, uchunk) => {
    if ((vid && !cid) || (!vid && cid)) throw new Error("vid and cid must be provided together");
    const chunk = uchunk ?? (await udb.makeChunk({ fromConverted: false }));
    const list = Array.isArray(json?.data?.items) ? json.data.items : [];
    const vcid = `${vid ?? 0}-${cid ?? 0}`;
    const SOID = vcid
      ? UniID.fromUnknown(
          `def_${PlatformVideoSource.Mgtv}+${vcid}`,
          PlatformVideoSource.Mgtv,
        ).toString()
      : UniID.fromNull(PlatformVideoSource.Mgtv).toString();
    const now = new Date();
    await chunk.upsertDanmakus(
      list.map((item) => {
        const left = item.v2_color?.color_left;
        const right = item.v2_color?.color_right;
        const leftColor = rgbToColor(left);
        const rightColor = rgbToColor(right);
        const color = leftColor ?? rightColor ?? defaultUniDM.color;
        const hasValidGradient = leftColor !== undefined && rightColor !== undefined;
        const extra: Extra = {
          danuni: hasValidGradient
            ? {
                color: {
                  gradient: [leftColor, rightColor],
                },
              }
            : undefined,
          mgtv: {
            id: String(item.id ?? ""),
            ids: item.ids,
            uid: item.uid,
            uuid: item.uuid,
            position: item.v2_position,
          } satisfies ExtraMgtv,
        };
        const map_d = {
          attr: defaultUniDM.attr,
          fontsize: defaultUniDM.fontsize,
          ctime: now,
          weight: weightFromUpCount(item.v2_up_count),
          pool: "Def" as const,
          progress: Number(item.time) || 0,
          mode: transMode(item.v2_position ?? 0, "mgtv"),
          color,
          SOID,
          senderID: UniID.fromUnknown(String(item.uid), PlatformVideoSource.Mgtv).toString(),
          content: item.content,
          platform: PlatformVideoSource.Mgtv,
          extra,
        };
        return {
          ...map_d,
          DMID: chunk.$UniDB.DMIDGenerator(map_d),
        };
      }),
    );
    return chunk;
  };
});

export const MgtvMetadata = defineMetadata({
  type: "mgtv.json",
  ext: [".json"],
  check: {
    adapter: async (uchunk, body) => {
      try {
        await uchunk.import(MgtvAdapter(await fileParser(body, "json", JSON)));
        return MgtvAdapter;
      } catch {
        return null;
      }
    },
  },
});
