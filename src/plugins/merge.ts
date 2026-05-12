import { definePlugin } from "@/adapters/index.ts";
import { danmakus } from "@/core/db/schema.ts";
import { DMAttr, Modes, Pools, type Extra } from "@/core/dm.ts";
import { createDMID } from "@/core/id.ts";
import { UniChunk } from "@/core/index.ts";
import { isSame } from "@/utils/isSame.ts";

/**
 * 合并一定时间段内的重复弹幕，防止同屏出现过多
 * @param lifetime 查重时间区段，单位秒 (默认为 0，表示不查重)
 */
export const mergePluginConfigurator = (lifetime = 0) =>
  definePlugin(async (u) => {
    const chunk = await UniChunk.makeChunk(u, { fromConverted: false });
    const sourceDanmakus = [...(await u.$danmakus)].sort(
      (a, b) => a.progress - b.progress || a.ctime.getTime() - b.ctime.getTime(),
    );

    if (lifetime <= 0) {
      await chunk.$db
        .insert(danmakus)
        .values(sourceDanmakus.map((d) => ({ ...d, chunkID: chunk.id })));
      return chunk;
    }

    const lifetimeMs = lifetime * 1000;
    const makeKey = (d: (typeof sourceDanmakus)[number]) =>
      [d.SOID, d.content, d.mode, d.pool, d.platform ?? ""].join("|");

    type MergeGroup = {
      base: (typeof sourceDanmakus)[number];
      lastProgress: number;
      senders: string[];
      senderSet: Set<string>;
      members: (typeof sourceDanmakus)[number][];
    };

    const groups = new Map<string, MergeGroup[]>();
    const orderedGroups: MergeGroup[] = [];

    for (const dan of sourceDanmakus) {
      const key = makeKey(dan);
      const bucket = groups.get(key) ?? [];
      let current: MergeGroup | undefined;

      for (let index = bucket.length - 1; index >= 0; index--) {
        const candidate = bucket[index];
        if (dan.progress - candidate.lastProgress > lifetimeMs) break;
        if (isSame(candidate.base, dan)) {
          current = candidate;
          break;
        }
      }

      if (current) {
        current.members.push(dan);
        current.lastProgress = dan.progress;
        if (!current.senderSet.has(dan.senderID)) {
          current.senderSet.add(dan.senderID);
          current.senders.push(dan.senderID);
        }
        continue;
      }

      const nextGroup: MergeGroup = {
        base: dan,
        lastProgress: dan.progress,
        senders: [dan.senderID],
        senderSet: new Set([dan.senderID]),
        members: [dan],
      };
      bucket.push(nextGroup);
      groups.set(key, bucket);
      orderedGroups.push(nextGroup);
    }

    await chunk.$db.insert(danmakus).values(
      orderedGroups.map((group) => {
        if (group.members.length === 1) {
          return { ...group.base, chunkID: chunk.id };
        }

        const merge = {
          duration: group.lastProgress - group.base.progress,
          count: group.members.length,
          senders: group.senders,
          taolu_count: group.members.length,
          taolu_senders: group.senders,
        };
        let extra: Extra | null = group.base.extra
          ? {
              ...group.base.extra,
              danuni: {
                ...(group.base.extra.danuni ? group.base.extra.danuni : {}),
                merge,
              },
            }
          : {
              danuni: {
                merge,
              },
            };
        if (group.senders.length === 1) {
          const danuni = extra.danuni;
          if (danuni?.merge) {
            const { merge: _merge, ...danuniRest } = danuni;
            if (Object.keys(danuniRest).length > 0) {
              extra = {
                ...extra,
                danuni: danuniRest,
              };
            } else {
              const { danuni: _danuni, ...extraRest } = extra;
              extra = Object.keys(extraRest).length > 0 ? extraRest : null;
            }
          }
        }
        const attr = group.base.attr.includes(DMAttr.Protect)
          ? group.base.attr
          : [...group.base.attr, DMAttr.Protect];
        const senderID = "merge[bot]@dan-any";

        return {
          ...group.base,
          chunkID: chunk.id,
          senderID,
          attr,
          extra,
          DMID: createDMID({
            content: group.base.content,
            mode: Modes[group.base.mode],
            pool: Pools[group.base.pool],
            platform: group.base.platform,
            extra: extra && Object.keys(extra).length > 0 ? extra : null,
            senderID,
            ctime: group.base.ctime,
          }),
        };
      }),
    );
    return chunk;
  });
