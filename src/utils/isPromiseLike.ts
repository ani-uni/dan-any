import type { Promisable } from "type-fest";

export function isPromiseLike<T>(value: Promisable<T>): value is PromiseLike<T> {
  return value !== null && typeof value === "object" && typeof (value as any).then === "function";
}
