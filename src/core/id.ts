import { sha3_256 } from "@noble/hashes/sha3.js";
import { z } from "zod";
import { JSON } from "@/utils/bigint.ts";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { enumModeCodec, enumPoolCodec } from "@/adapters/index.ts";
import type { Extra } from "./dm-extra.ts";

interface DMIDGeneratorDanmaku {
  content: string;
  mode: z.infer<typeof enumModeCodec.out>;
  pool: z.infer<typeof enumPoolCodec.out>;
  platform?: string | null;
  extra: Extra | null;
  senderID: string;
  ctime: Date;
}
export type DMIDGenerator = (dan: DMIDGeneratorDanmaku, slice?: number) => string;

export const createDMID: DMIDGenerator = (dan: DMIDGeneratorDanmaku, slice = 8) => {
  const raw = `${dan.content}|${dan.mode}|${dan.pool}|${dan.platform ?? null}|${JSON.stringify(dan.extra)}|${dan.senderID}|${dan.ctime.toISOString()}`;
  const data = utf8ToBytes(raw);
  const digest = sha3_256.create().update(data).digest();
  const str = bytesToHex(digest);
  return str.slice(0, slice);
};
