import { definePlugin } from "@/adapters/index.ts";
import type { Extra } from "@/core/dm-extra.ts";
import { UniChunk } from "@/core/index.ts";

/**
 * 降级转换插件：将高级弹幕转换为普通弹幕，适用于无法正确显示高级弹幕的播放器
 * @returns 转换后的弹幕Chunk，临时，导出后可自行调用delete方法删除
 */
export const downgradeAdvancedPluginConfigurator = ({
  include,
  exclude,
}: {
  include?: (keyof Extra)[];
  exclude?: (keyof Extra)[];
} = {}) =>
  definePlugin(async (uchunk) => {
    if (!include) include = [];
    if (!exclude) exclude = [];
    const check = (k: keyof Extra) => include?.includes(k) || !exclude?.includes(k);
    const chunk = await UniChunk.makeChunk(uchunk, { tmp: true });
    await chunk.upsertDanmakus(
      (await uchunk.$danmakus).map((d) => {
        if (!d.extra) return d;
        let newDan = {
          ...d,
          mode: "Top" as const,

          senderID: "compat[bot]@dan-any",
        };
        // TODO 分别对 mode7/8/9 command artplayer等正常播放器无法绘制的弹幕做降级处理
        if (check("danuni") && d.extra?.danuni) {
          const danuni = d.extra.danuni;
          if (danuni.merge) {
            newDan.content = `${newDan.content} x${danuni.merge.count}`;
          }
        } else if (check("bili") && d.extra?.bili) {
          const bili = d.extra.bili;
          if (bili.mode === 7 && bili.adv) {
            newDan.content = `[B站高级弹幕]${JSON.parse(bili.adv)[4] || ""}`;
          } else if (bili.command) {
            const command = bili.command;
            newDan.content = `[B站指令弹幕]${command.content}`;
            newDan.fontsize = 36;
          }
        }
        newDan.attr.push("Compatible");
        return { ...newDan, DMID: chunk.$UniDB.DMIDGenerator(newDan) };
      }),
    );
    return chunk;
  });
