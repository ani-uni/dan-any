import type { Promisable } from "type-fest";

export function fileParser<T extends unknown>(
  file: T,
  mod: "bin",
): T extends File ? Promise<ArrayBuffer> : Promisable<ArrayBuffer | Uint8Array>;
export function fileParser<T extends unknown>(
  file: T,
  mod: "string",
): T extends File ? Promise<string> : Promisable<string>;
export function fileParser<T extends unknown>(
  file: unknown,
  mod: "json",
  JSON?: Pick<JSON, "parse">,
): T extends File ? Promise<T> : Promisable<T>;
export function fileParser(
  file: unknown,
  mod: "bin" | "string" | "json",
  JSON: Pick<JSON, "parse"> = globalThis.JSON,
): Promisable<ArrayBuffer | Uint8Array | string | object> {
  const isBinary =
    file instanceof ArrayBuffer || file instanceof Uint8Array || file instanceof Buffer;
  switch (mod) {
    case "bin": {
      if (isBinary) {
        if (file instanceof Buffer)
          return new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
        return file;
      } else if (file instanceof File) return file.arrayBuffer();
      else if (ArrayBuffer.isView(file))
        return new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
      throw new TypeError('Expected binary data for mod "bin"');
    }
    case "string": {
      if (typeof file === "string") return file;
      else if (file instanceof File) return file.text();
      else if (isBinary) return new TextDecoder().decode(file);
      else if (ArrayBuffer.isView(file))
        return new TextDecoder().decode(
          new Uint8Array(file.buffer, file.byteOffset, file.byteLength),
        );
      throw new TypeError('Expected binary data or string for mod "string"');
    }
    case "json": {
      if (file instanceof File) return file.text().then((text) => JSON.parse(text));
      else if (typeof file === "object" && file !== null && !isBinary) return file;
      if (typeof file !== "string" && !isBinary && !ArrayBuffer.isView(file)) {
        throw new TypeError('Expected object, JSON string, or binary data for mod "json"');
      }
      const str =
        typeof file === "string"
          ? file
          : new TextDecoder().decode(
              isBinary ? file : new Uint8Array(file.buffer, file.byteOffset, file.byteLength),
            );
      try {
        return JSON.parse(str);
      } catch {
        throw new Error("Invalid JSON string");
      }
    }
    default:
      throw new Error("Unsupported mod");
  }
}
