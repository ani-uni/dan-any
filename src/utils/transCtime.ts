type ctime = string | number | bigint | Date;

function isMsTs(ts: number | bigint, tsUnit?: "ms" | "s") {
  if (tsUnit === "ms") return true;
  else if (tsUnit === "s") return false;
  else return ts < 100000000;
}

/**
 * 将各种类型的时间进行格式化
 * @param oriCtime
 * @param tsUnit 当`oriCtime`为数字类型表时间戳时的单位;
 * 为 毫秒(ms)/秒(s)
 * @returns {Date} Date格式时间
 */
export function transCtime(oriCtime: ctime, tsUnit?: "ms" | "s"): Date {
  if (typeof oriCtime === "number" || typeof oriCtime === "bigint")
    if (isMsTs(oriCtime, tsUnit)) return new Date(Number(oriCtime));
    else return new Date(Number(oriCtime) * 1000);
  else if (typeof oriCtime === "string") {
    if (/^\d+n$/.test(oriCtime))
      return transCtime(Number(oriCtime.slice(0, -1)), tsUnit); // 处理类似 "1234567890n" 的字符串，类bigint
    else return transCtime(Number(oriCtime), tsUnit);
  } else return oriCtime;
}
