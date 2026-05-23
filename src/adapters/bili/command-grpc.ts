import { defineAdapter, defineMetadata } from "../index.ts";

import { defaultUniDM, DMAttr } from "@/core/dm.ts";
import { PlatformVideoSource } from "@/core/platform.ts";
import { fromBinary } from "@bufbuild/protobuf";
import { DmWebViewReplySchema } from "@/utils/proto/gen/bilibili/community/service/dm/v1/dm_pb.ts";
import { UniID } from "@/core/uni-id.ts";

export const BiliCommandGrpcAdapter = defineAdapter((bin: Uint8Array | ArrayBuffer) => {
  return async (udb, uchunk) => {
    const chunk = uchunk ?? (await udb.makeChunk({}));
    const data = fromBinary(DmWebViewReplySchema, new Uint8Array(bin));
    const json = data.commandDms;
    await chunk.upsertDanmakus(
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
          ...map_d,
          DMID: chunk.$UniDB.DMIDGenerator(map_d),
        };
      }),
    );
    return chunk;
  };
});

export const BiliCommandGrpcMetadata = defineMetadata({
  type: "bili.cmd.binpb",
  ext: [".binpb", ".bin", ".pb.bin", ".so"],
  check: {
    adapter: async (uchunk, body) => {
      if (typeof body !== "object") return false;
      if (!(body instanceof ArrayBuffer) && !ArrayBuffer.isView(body)) return false;
      try {
        let buf: Uint8Array;
        if (body instanceof ArrayBuffer) {
          buf = new Uint8Array(body);
        } else if (ArrayBuffer.isView(body)) {
          const view = body;
          buf = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        } else {
          return false;
        }
        return uchunk.import(BiliCommandGrpcAdapter(buf));
      } catch {
        return false;
      }
    },
  },
});
