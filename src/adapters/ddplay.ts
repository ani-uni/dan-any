import { defineAdapter, defineMetadata, defineTransformer } from "./index.ts";

import { DanUniConvertTipTemplate, defaultUniDM, type DanUniConvertTip } from "@/core/dm.ts";
import { transMode } from "@/utils/transMode.ts";
import { PlatformDanmakuOnlySource } from "@/core/platform.ts";
import { UniID } from "@/core/uni-id.ts";

interface DM_JSON_DDPlay {
  count: number | string;
  comments: {
    cid: number;
    p: string;
    m: string;
  }[];
}

export const DdplayAdapter = defineAdapter(
  (
    json: DM_JSON_DDPlay & { danuni?: DanUniConvertTip },
    episodeId: string = "0",
    domain: string = PlatformDanmakuOnlySource.DanDanPlay,
  ) => {
    return async (udb, uchunk) => {
      const chunk = uchunk ?? (await udb.makeChunk({ fromConverted: !!json.danuni }));
      const SOID = UniID.fromUnknown(
        `def_${PlatformDanmakuOnlySource.DanDanPlay}+${episodeId}`,
        domain,
      ).toString();
      const now = new Date();
      await chunk.upsertDanmakus(
        json.comments.map((d) => {
          const p_arr = d.p.split(",");
          const uid = p_arr[3];
          const senderID = UniID.fromUnknown(uid, domain).toString();
          const mode = transMode(Number.parseInt(p_arr[1]), "ddplay");
          const map_d = {
            SOID,
            color: Number.parseInt(p_arr[2]),
            progress: Number.parseFloat(p_arr[0]) * 1000,
            mode,
            senderID,
            content: d.m,
            platform: domain,
            extra: { ddplay: { cid: d.cid, uid } },
            attr: defaultUniDM.attr,
            fontsize: defaultUniDM.fontsize,
            ctime: now,
            weight: defaultUniDM.weight,
            pool: "Def" as const,
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

export const DdplayTransformer = defineTransformer(
  (udanmakus): Promise<DM_JSON_DDPlay & { danuni?: DanUniConvertTip }> => {
    return udanmakus.then((dans) => ({
      danuni: {
        ...DanUniConvertTipTemplate,
        data: dans[0]?.SOID.split("@")[0].replaceAll(
          `def_${PlatformDanmakuOnlySource.DanDanPlay}+`,
          "",
        ),
      },
      count: dans.length,
      comments: dans.map((dan) => {
        let mode = 1;
        if (dan.mode === "Top") mode = 5;
        else if (dan.mode === "Bottom") mode = 4;
        return {
          cid:
            dan.extra?.ddplay?.cid ??
            Number.parseInt(`0x${Buffer.from(dan.DMID).toString("hex")}`) ??
            0,
          p: `${dan.progress / 1000},${mode},${dan.color},${dan.extra?.ddplay?.uid ?? dan.senderID}`,
          m: dan.content,
        };
      }),
    }));
  },
);

export const DdplayMetadata = defineMetadata({
  type: "ddplay.json",
  ext: [".json"],
  check: {
    adapter: async (uchunk, body) => {
      if (typeof body !== "object" || !body) return false;
      try {
        await uchunk.import(DdplayAdapter(body as any));
        return true;
      } catch {
        return false;
      }
    },
  },
});
