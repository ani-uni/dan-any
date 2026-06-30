import type { enumModeCodec } from "@/adapters/index.ts";
import type { z } from "zod";

export function transMode(oriMode: string, fmt: "vod"): z.infer<typeof enumModeCodec.out>;
export function transMode(
  oriMode: number,
  fmt: "bili" | "dplayer" | "artplayer" | "ddplay" | "baha" | "iqiyi" | "mgtv",
): z.infer<typeof enumModeCodec.out>;
export function transMode(
  oriMode: number | string,
  fmt: "bili" | "dplayer" | "artplayer" | "ddplay" | "baha" | "iqiyi" | "mgtv" | "vod",
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
      mode = transMode(oriMode as number, "bili");
      break;

    case "baha":
      // position：0-滚动 1-顶部 2-底部
      if (oriMode === 1) mode = "Top";
      else if (oriMode === 2) mode = "Bottom";
      break;

    case "iqiyi":
      //    0    NORMAL               普通滚动弹幕，右向左滚动
      //  100    TOP_NORMAL           顶部固定普通弹幕
      //  200    BOTTOM_NORMAL        底部固定普通弹幕
      //  108    TOP_ROLE             顶部角色弹幕
      //  208    BOTTOM_ROLE          底部角色弹幕
      //    8    ROLE                 角色弹幕
      //    2    STAR                 明星弹幕
      //   10    STAR_TOPIC           明星话题弹幕
      //    9    VR                   VR 弹幕
      //  305    SURROUND_PORTRAIT    环绕/画像类弹幕
      switch (oriMode) {
        case 100:
        case 108:
          mode = "Top";
          break;
        case 200:
        case 208:
          mode = "Bottom";
          break;
      }
      break;

    case "mgtv":
      if (oriMode === 1) mode = "Top";
      else if (oriMode === 2) mode = "Bottom";
      break;

    case "vod":
      if (oriMode === "top") mode = "Top";
      else if (oriMode === "bottom") mode = "Bottom";
      break;

    default:
      mode = "Normal";
      break;
  }
  return mode;
}
