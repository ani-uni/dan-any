import { defineAdapter } from "../index.ts";
import { danmakus, onConflictDoUpdate } from "@/core/db/schema.ts";

import { defaultUniDM, DMAttr, Modes, Pools } from "@/core/dm.ts";
import { PlatformVideoSource } from "@/core/platform.ts";
import { createDMID, UniID } from "@/core/id.ts";
import { fromBinary } from "@bufbuild/protobuf";
import { DmWebViewReplySchema } from "@/utils/proto/gen/bilibili/community/service/dm/v1/dm_pb.ts";

export const BiliCommandGrpcAdapter = defineAdapter((bin: Uint8Array | ArrayBuffer) => {
  return async (udb, uchunk) => {
    const chunk = uchunk ?? (await udb.makeChunk({ fromConverted: false }));
    const data = fromBinary(DmWebViewReplySchema, new Uint8Array(bin));
    const json = data.commandDms;
    await udb.$drizzle
      .insert(danmakus)
      .values(
        json.map((args) => {
          const SOID = `def_${PlatformVideoSource.Bilibili}+${UniID.fromBili({ cid: args.oid }).toString()}`;
          const senderID = UniID.fromBili({ mid: args.mid });
          const map_d = {
            SOID,
            progress: args.progress,
            mode: "Ext" as const,
            fontsize: defaultUniDM.fontsize,
            color: defaultUniDM.color,
            senderID: senderID.toString(),
            content: args.content,
            ctime: new Date(`${args.ctime} GMT+0800`), // 无视本地时区，按照B站的东8区计算时间
            weight: 11,
            pool: "Adv" as const,
            attr: [DMAttr.Protect],
            platform: PlatformVideoSource.Bilibili,
            extra: {
              bili: {
                dmid: args.idStr,
                attr: args.attr,
                mid: args.mid?.toString(),
                command: args,
              },
            },
          };
          return {
            chunkID: chunk.id,
            ...map_d,
            DMID: createDMID({ ...map_d, mode: Modes.Ext, pool: Pools.Adv }),
          };
        }),
      )
      .onConflictDoUpdate(onConflictDoUpdate.danmakus);
    return chunk;
  };
});
