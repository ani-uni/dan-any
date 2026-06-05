type innerSerialMap<V> = Map<number, V>;
export class SerialMap<V> implements Map<number, V> {
  #map = new Map<number, V>();
  #freeSerials: number[] = [];
  #nextSerial: number = 0;
  get nextSerial(): number {
    if (this.#freeSerials.length > 0) return this.#freeSerials.shift()!;
    else return this.#nextSerial++;
  }
  add(value: V) {
    this.#map.set(this.nextSerial, value);
    return this;
  }
  delete(serial: number) {
    const existed = this.#map.delete(serial);
    if (existed) this.#freeSerials.push(serial);
    return existed;
  }
  clear() {
    this.#map.clear();
    this.#freeSerials = [];
    this.#nextSerial = 0;
  }
  toJSON() {
    return {
      $typeName: "SerialMap",
      "#map": this.#map.entries().toArray(),
      "#freeSerials": this.#freeSerials,
      "#nextSerial": this.#nextSerial,
    };
  }
  static fromJSON<V>(data: ReturnType<SerialMap<V>["toJSON"]>): SerialMap<V> {
    if (data.$typeName !== "SerialMap") throw new Error("Invalid data for SerialMap");
    const map = new SerialMap<V>();
    map.#map = new Map<number, V>(data["#map"]);
    map.#freeSerials = data["#freeSerials"];
    map.#nextSerial = data["#nextSerial"];
    return map;
  }
  get size() {
    return this.#map.size;
  }
  has(...args: Parameters<innerSerialMap<V>["has"]>) {
    return this.#map.has(...args);
  }
  get(...args: Parameters<innerSerialMap<V>["get"]>) {
    return this.#map.get(...args);
  }
  set(...args: Parameters<innerSerialMap<V>["set"]>) {
    this.#map.set(...args);
    return this;
  }
  getOrInsert(...args: Parameters<innerSerialMap<V>["getOrInsert"]>) {
    return this.#map.getOrInsert(...args);
  }
  getOrInsertComputed(...args: Parameters<innerSerialMap<V>["getOrInsertComputed"]>) {
    return this.#map.getOrInsertComputed(...args);
  }
  forEach(...args: Parameters<innerSerialMap<V>["forEach"]>) {
    return this.#map.forEach(...args);
  }
  keys(...args: Parameters<innerSerialMap<V>["keys"]>) {
    return this.#map.keys(...args);
  }
  values(...args: Parameters<innerSerialMap<V>["values"]>) {
    return this.#map.values(...args);
  }
  entries(...args: Parameters<innerSerialMap<V>["entries"]>) {
    return this.#map.entries(...args);
  }
  [Symbol.iterator]() {
    return this.#map[Symbol.iterator]();
  }
  get [Symbol.toStringTag]() {
    return "SerialMap";
  }
}

type innerBigSerialMap<V> = Map<bigint, V>;
export class BigSerialMap<V> implements Map<bigint, V> {
  #map = new Map<bigint, V>();
  #freeSerials: bigint[] = [];
  #nextSerial: bigint = 0n;
  get nextSerial(): bigint {
    if (this.#freeSerials.length > 0) return this.#freeSerials.shift()!;
    else return this.#nextSerial++;
  }
  add(value: V) {
    this.#map.set(this.nextSerial, value);
    return this;
  }
  delete(serial: bigint) {
    const existed = this.#map.delete(serial);
    if (existed) this.#freeSerials.push(serial);
    return existed;
  }
  clear() {
    this.#map.clear();
    this.#freeSerials = [];
    this.#nextSerial = 0n;
  }
  toJSON() {
    return {
      $typeName: "BigSerialMap",
      "#map": this.#map
        .entries()
        .map(([k, v]) => [k.toString(), v] as [string, V])
        .toArray(),
      "#freeSerials": this.#freeSerials.map((s) => s.toString()),
      "#nextSerial": this.#nextSerial.toString(),
    };
  }
  static fromJSON<V>(data: ReturnType<BigSerialMap<V>["toJSON"]>): BigSerialMap<V> {
    if (data.$typeName !== "BigSerialMap") throw new Error("Invalid data for BigSerialMap");
    const map = new BigSerialMap<V>();
    map.#map = new Map<bigint, V>(data["#map"].map(([k, v]) => [BigInt(k), v]));
    map.#freeSerials = data["#freeSerials"].map(BigInt);
    map.#nextSerial = BigInt(data["#nextSerial"]);
    return map;
  }
  get size() {
    return this.#map.size;
  }
  has(...args: Parameters<innerBigSerialMap<V>["has"]>) {
    return this.#map.has(...args);
  }
  get(...args: Parameters<innerBigSerialMap<V>["get"]>) {
    return this.#map.get(...args);
  }
  set(...args: Parameters<innerBigSerialMap<V>["set"]>) {
    this.#map.set(...args);
    return this;
  }
  getOrInsert(...args: Parameters<innerBigSerialMap<V>["getOrInsert"]>) {
    return this.#map.getOrInsert(...args);
  }
  getOrInsertComputed(...args: Parameters<innerBigSerialMap<V>["getOrInsertComputed"]>) {
    return this.#map.getOrInsertComputed(...args);
  }
  forEach(...args: Parameters<innerBigSerialMap<V>["forEach"]>) {
    return this.#map.forEach(...args);
  }
  keys(...args: Parameters<innerBigSerialMap<V>["keys"]>) {
    return this.#map.keys(...args);
  }
  values(...args: Parameters<innerBigSerialMap<V>["values"]>) {
    return this.#map.values(...args);
  }
  entries(...args: Parameters<innerBigSerialMap<V>["entries"]>) {
    return this.#map.entries(...args);
  }
  [Symbol.iterator]() {
    return this.#map[Symbol.iterator]();
  }
  get [Symbol.toStringTag]() {
    return "BigSerialMap";
  }
}
