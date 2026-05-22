import { sha3_256 } from "@noble/hashes/sha3.js";
import { JSON } from "@/utils/bigint.ts";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { type UDanmaku } from "@/adapters/index.ts";

type DMIDGeneratorDanmaku = Omit<UDanmaku, "DMID">;
export type DMIDGenerator = (dan: DMIDGeneratorDanmaku, slice?: number) => string;

export const createDMID: DMIDGenerator = (dan: DMIDGeneratorDanmaku, slice = 8) => {
  const raw = [
    dan.SOID, //
    dan.progress,
    dan.mode,
    dan.fontsize, //
    dan.color, //
    dan.senderID,
    dan.content,
    dan.ctime.toISOString(),
    dan.weight, //
    dan.pool,
    dan.attr.toSorted().join(","), //
    dan.platform ?? null,
    JSON.stringify(dan.extra),
  ].join("|");
  const data = utf8ToBytes(raw);
  const digest = sha3_256.create().update(data).digest();
  const str = bytesToHex(digest);
  return str.slice(0, slice);
};
