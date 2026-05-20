import { defineAdapter } from "./index.ts";
import { defaultUniDM } from "@/core/dm.ts";
import type { Extra, ExtraTencent } from "@/core/dm-extra.ts";
import { UniID } from "@/core/uni-id.ts";
import { PlatformVideoSource } from "@/core/platform.ts";
import { transCtime } from "@/utils/transCtime.ts";
import { z } from "zod";

interface TencentBarrage {
  id: string; //bigint
  is_op: number; //0|1?
  head_url: string;
  time_offset: string; //ms
  up_count: string; //number
  bubble_head: string;
  bubble_level: string;
  bubble_id: string;
  rick_type: number;
  content_style: string; //
  user_vip_degree: number;
  create_time: string; //
  content: string; //
  hot_type: number;
  gift_info: null;
  share_item: null;
  vuid: string;
  nick: string;
  data_key: string;
  content_score: number; //float
  show_weight: number; //1-10?
  track_type: number;
  show_like_type: number;
  report_like_score: number;
  relate_sku_info: unknown[];
}

interface DM_JSON_Tencent {
  barrage_list: TencentBarrage[];
}

function mapPositionToMode(pos?: number) {
  if (pos === 2) return "Top" as const;
  if (pos === 3) return "Bottom" as const;
  return "Normal" as const;
}

const zCommentStyle = z.object({
  color: z.string(), // color in hex, without #
  gradient_colors: z.tuple([z.string(), z.string()]),
  position: z.number(),
});
const zContentStyle = z
  .string()
  .transform((str) => {
    try {
      const json = JSON.parse(str);
      return zCommentStyle.parse(json);
    } catch {
      return undefined;
    }
  })
  .transform((data) => {
    const hexString =
      data?.gradient_colors[0] ?? // we can't display gradient color, so use the first color
      data?.color ??
      "ffffff";
    const color = Number(`#${hexString}`.replace("#", "0x"));
    return { color, mode: mapPositionToMode(data?.position) };
  });

const domain = PlatformVideoSource.Tencent;

export const TencentAdapter = defineAdapter((json: DM_JSON_Tencent, vid?: string) => {
  return async (udb, uchunk) => {
    const chunk = uchunk ?? (await udb.makeChunk({ fromConverted: false }));
    const SOID = vid
      ? UniID.fromUnknown(vid, domain).toString()
      : UniID.fromNull(domain).toString();
    const senderID = UniID.fromNull(domain).toString();
    const list: TencentBarrage[] = Array.isArray(json?.barrage_list) ? json.barrage_list : [];
    await chunk.upsertDanmakus(
      list.map((item) => {
        const content_style = zContentStyle.parse(item.content_style);

        const extraTencent: ExtraTencent &
          Partial<Pick<TencentBarrage, "content" | "time_offset" | "create_time">> = {
          ...item,
        };
        delete extraTencent.content;
        delete extraTencent.time_offset;
        delete extraTencent.create_time;

        const mapped = {
          attr: defaultUniDM.attr,
          fontsize: defaultUniDM.fontsize,
          ctime: transCtime(item.create_time, "s"),
          weight: item.show_weight ?? defaultUniDM.weight,
          pool: "Def" as const,
          content: item.content,
          progress: Number.parseInt(item.time_offset) || 0,
          mode: content_style.mode,
          color: content_style.color,
          SOID,
          senderID,
          platform: domain,
          extra: { tencent: extraTencent } satisfies Extra,
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

export default TencentAdapter;
