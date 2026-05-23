import { defineAdapter, defineMetadata, defineTransformer } from "./index.ts";

import { DanUniConvertTipTemplate, defaultUniDM, type DanUniConvertTip } from "@/core/dm.ts";
import { UniID } from "@/core/uni-id.ts";
import { transMode } from "@/utils/transMode.ts";

interface DM_JSON_Dplayer {
  code: number;
  /**
   * progress,mode,color,midHash,content
   */
  data: [number, number, number, string, string][];
}

export const DplayerAdapter = defineAdapter(
  (
    json: DM_JSON_Dplayer & { danuni?: DanUniConvertTip },
    playerID?: string,
    domain: string = "other",
  ) => {
    return async (udb, uchunk) => {
      const chunk = uchunk ?? (await udb.makeChunk({ fromConverted: !!json.danuni }));
      const SOID = playerID
        ? UniID.fromUnknown(playerID, domain).toString()
        : UniID.fromNull(domain).toString();
      const now = new Date();
      await chunk.upsertDanmakus(
        json.data.map(([progress, ori_mode, color, midHash, content]) => {
          const mode = transMode(ori_mode, "dplayer");
          const map_d = {
            attr: defaultUniDM.attr,
            fontsize: defaultUniDM.fontsize,
            ctime: now,
            weight: defaultUniDM.weight,
            extra: defaultUniDM.extra,
            pool: "Def" as const,
            progress: progress * 1000,
            mode,
            color,
            midHash,
            content,
            SOID,
            senderID: UniID.fromUnknown(midHash, domain).toString(),
            platform: domain,
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

export const DplayerTransformer = defineTransformer(
  (udanmakus): Promise<DM_JSON_Dplayer & { danuni?: DanUniConvertTip }> => {
    return udanmakus.then((dans) => ({
      code: 0,
      danuni: {
        ...DanUniConvertTipTemplate,
        data: dans[0]?.SOID.split("@")[0],
      },
      data: dans.map((dan) => {
        let mode = 0;
        if (dan.mode === "Top") mode = 1;
        else if (dan.mode === "Bottom") mode = 2;
        return [dan.progress / 1000, mode, dan.color, dan.senderID, dan.content];
      }),
    }));
  },
);

export const DplayerMetadata = defineMetadata({
  type: "dplayer.json",
  ext: [".json"],
  check: {
    adapter: async (uchunk, body) => {
      if (typeof body !== "object" || !body) return false;
      try {
        await uchunk.import(DplayerAdapter(body as any));
        return true;
      } catch {
        return false;
      }
    },
  },
});
