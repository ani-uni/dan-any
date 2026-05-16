import { defineAdapter, defineTransformer } from "./index.ts";

import {
  DanUniConvertTipTemplate,
  defaultUniDM,
  type DanUniConvertTip,
  type Extra,
} from "@/core/dm.ts";
import { UniID } from "@/core/id.ts";
import { transMode } from "@/utils/transMode.ts";
import { enumModeCodec } from "./danuni/json.ts";

interface DM_JSON_Artplayer {
  danmuku: {
    text: string; // 弹幕文本
    time?: number; // 弹幕时间，默认为当前播放器时间 - 秒
    mode?: number; // 弹幕模式：0: 滚动 (默认)，1: 顶部，2: 底部
    color?: string; // 弹幕颜色，默认为白色
    border?: boolean; // 弹幕是否有描边，默认为 false
    style?: {}; // 弹幕自定义样式，默认为空对象
  }[];
}

export const ArtplayerAdapter = defineAdapter(
  (json: DM_JSON_Artplayer & { danuni?: DanUniConvertTip }, playerID: string, domain = "other") => {
    return async (udb, uchunk) => {
      const chunk = uchunk ?? (await udb.makeChunk({ fromConverted: !!json.danuni }));
      const SOID = UniID.fromUnknown(playerID, domain).toString();
      const senderID = UniID.fromNull(domain).toString();
      const now = new Date();
      await chunk.upsertDanmakus(
        json.danmuku.map((args) => {
          let extra = args.border
            ? ({ artplayer: { border: args.border, style: {} } } as Extra)
            : null;
          if (args.style) {
            if (extra)
              extra = {
                ...extra,
                artplayer: { ...extra.artplayer, border: args.border, style: args.style },
              };
            else extra = { artplayer: { border: args.border, style: args.style } };
          }
          const mode = transMode(args.mode ?? 0, "artplayer");
          const map_d = {
            attr: defaultUniDM.attr,
            fontsize: defaultUniDM.fontsize,
            ctime: now,
            weight: defaultUniDM.weight,
            pool: "Def" as const,
            content: args.text,
            progress: (args.time ?? 0) * 1000,
            mode: enumModeCodec.decode(mode),
            color: Number((args.color || "FFFFFF").replace("#", "0x")),
            style: args.style,
            SOID,
            senderID,
            platform: domain,
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
  },
);

export const ArtplayerTransformer = defineTransformer(
  (udanmakus): Promise<DM_JSON_Artplayer & { danuni?: DanUniConvertTip }> => {
    return udanmakus.then((dans) => ({
      danuni: {
        ...DanUniConvertTipTemplate,
        data: dans[0]?.SOID.split("@")[0],
      },
      danmuku: dans.map((d) => {
        let mode = 0;
        if (d.mode === "Top") mode = 1;
        else if (d.mode === "Bottom") mode = 2;
        return {
          text: d.content,
          time: d.progress / 1000,
          mode: mode as 0 | 1 | 2,
          color: `#${d.color.toString(16).toUpperCase() || "FFFFFF"}`,
          border: d.extra?.artplayer?.border,
          style: d.extra?.artplayer?.style,
        };
      }),
    }));
  },
);
