/**
 * 获得数字的二进制，每位以boolean(true/false)表示1/0，从低位向高位
 * @param number 任意进制数字
 */
export const toBits = (number: number) => {
  // 低速方案
  // return [...number.toString(2)].map(Number)
  // 高速方案，位运算允许范围内更快
  const bits: boolean[] = [];
  do {
    bits.unshift(!!(number & 1)); // boolean[]
    // bits.unshift(number & 1) // (0|1)[]
    number >>= 1;
  } while (number);
  return bits.toReversed();
};

export class SetBin {
  constructor(public bin: number) {}
  set1(bit: number) {
    this.bin |= 1 << bit;
  }
  set0(bit: number) {
    this.bin &= ~(1 << bit);
  }
}
