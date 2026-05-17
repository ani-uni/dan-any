import type { enumModeCodec } from "@/adapters/index.ts";
import type { z } from "zod";

export function transMode(
  oriMode: number,
  fmt: "bili" | "dplayer" | "artplayer" | "ddplay",
): z.infer<typeof enumModeCodec.out> {
  let mode: z.infer<typeof enumModeCodec.out> = "Normal";
  switch (fmt) {
    case "bili":
      // 类型 1 2 3:普通弹幕 4:底部弹幕 5:顶部弹幕 6:逆向弹幕 7:高级弹幕 8:代码弹幕 9:BAS弹幕(pool必须为2)
      switch (oriMode) {
        case 4:
          mode = "Bottom";
          break;
        case 5:
          mode = "Top";
          break;
        case 6:
          mode = "Reverse";
          break;
        case 7:
          mode = "Ext";
          break;
        case 8:
          mode = "Ext";
          break;
        case 9:
          mode = "Ext";
          break;
      }
      break;

    case "dplayer":
      if (oriMode === 1) mode = "Top";
      else if (oriMode === 2) mode = "Bottom";
      break;

    case "artplayer":
      if (oriMode === 1) mode = "Top";
      else if (oriMode === 2) mode = "Bottom";
      break;

    case "ddplay":
      // 弹幕模式：1-普通弹幕，4-底部弹幕，5-顶部弹幕
      // 其适配为bili格式子集
      mode = transMode(oriMode, "bili");
      break;

    default:
      mode = "Normal";
      break;
  }
  return mode;
}
