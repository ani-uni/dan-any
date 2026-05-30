import { zstdCompressSync, zstdDecompressSync, type InputType } from "node:zlib";
import { JSON } from "@/utils/bigint.ts";

export function compress<T extends InputType>(data: T): Buffer<ArrayBuffer> {
  return zstdCompressSync(data);
}

export function decompress<P extends object>(data: InputType, type: "json"): P;
export function decompress<P extends string>(data: InputType, type: "str"): P;
export function decompress<P extends Buffer<ArrayBuffer>>(data: InputType, type?: "bin"): P;
export function decompress<P extends Buffer<ArrayBuffer> | string | object>(
  data: InputType,
  type: "bin" | "str" | "json" = "bin",
): P {
  const d: Buffer<ArrayBuffer> = zstdDecompressSync(data);
  if (type === "bin") return d as P;
  if (type === "str") return d.toString("utf8") as P;
  return JSON.parse(d.toString("utf8")) as P;
}
