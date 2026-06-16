import { defineTransformer } from "@/adapters/index.ts";
import type { UDanmaku } from "@/core/index.ts";

/**
 * 热力图配置参数
 */
interface HeatmapOptions {
  /**
   * 视频总时长（毫秒）
   * - 默认：自动计算为所有弹幕中 progress 的最大值
   * - 用途：确定热力图的时间范围上界
   */
  videoDuration?: number;

  /**
   * 时间粒度（毫秒）
   * - 默认：1000（1秒）
   * - 最小值：必须为正数
   * - 用途：将时间轴划分为固定长度的采样点
   */
  granularity?: number;
}

/**
 * 热力图数据点
 */
interface HeatmapPoint {
  /**
   * 时间点（毫秒），表示该采样区间的起始时间
   * @example 0, 1000, 2000, 3000...
   */
  time: number;

  /**
   * 该时间段内的弹幕数量
   */
  count: number;
}

/**
 * 验证并标准化 granularity 参数
 */
function validateGranularity(granularity: number): number {
  if (!Number.isFinite(granularity) || granularity <= 0) {
    throw new Error(`Invalid granularity: ${granularity}. Must be a positive number.`);
  }
  return granularity;
}

/**
 * 验证并标准化 videoDuration 参数
 */
function validateVideoDuration(videoDuration: number | undefined): number | undefined {
  if (videoDuration !== undefined) {
    if (!Number.isFinite(videoDuration) || videoDuration <= 0) {
      throw new Error(`Invalid videoDuration: ${videoDuration}. Must be a positive number.`);
    }
  }
  return videoDuration;
}

/**
 * 计算弹幕数组中的最大 progress 值
 */
function calculateMaxProgress(danmakus: UDanmaku[]): number {
  let maxProgress = 0;
  for (const dan of danmakus) {
    if (
      typeof dan.progress === "number" &&
      !Number.isNaN(dan.progress) &&
      dan.progress > maxProgress
    ) {
      maxProgress = dan.progress;
    }
  }
  return maxProgress;
}

/**
 * 热力图转换器配置器
 *
 * @param options - 配置参数
 * @returns Transformer 函数
 *
 * @example
 * ```typescript
 * // 使用默认配置（1秒粒度，自动计算视频长度）
 * const heatmap = await chunk.export(HeatmapTransformerConfigurator());
 *
 * // 自定义配置
 * const heatmap = await chunk.export(HeatmapTransformerConfigurator({
 *   videoDuration: 600000,  // 10分钟
 *   granularity: 500        // 0.5秒
 * }));
 * ```
 */
export const HeatmapTransformerConfigurator = (options: HeatmapOptions = {}) =>
  defineTransformer((udanmakus: UDanmaku[]): HeatmapPoint[] => {
    // 1. 参数验证
    const granularity = validateGranularity(options.granularity ?? 1000);
    const specifiedDuration = validateVideoDuration(options.videoDuration);

    // 2. 边界情况：空弹幕数组
    if (udanmakus.length === 0) {
      return [];
    }

    // 3. 计算视频长度
    const videoDuration = specifiedDuration ?? calculateMaxProgress(udanmakus);

    // 4. 边界情况：无有效视频长度
    if (videoDuration <= 0) {
      return [];
    }

    // 5. 初始化时间桶
    // 使用 +1 确保能容纳 progress 等于 videoDuration 的弹幕
    const bucketCount = Math.floor(videoDuration / granularity) + 1;
    const buckets = Array.from({ length: bucketCount }, () => 0);

    // 6. 分配弹幕到时间桶
    for (const dan of udanmakus) {
      // 数据清洗：跳过无效的 progress
      if (
        typeof dan.progress !== "number" ||
        Number.isNaN(dan.progress) ||
        dan.progress < 0 ||
        dan.progress > videoDuration
      ) {
        continue;
      }

      // 计算桶索引
      const bucketIndex = Math.floor(dan.progress / granularity);

      // 安全性检查（理论上不会越界，但保持防御性编程）
      if (bucketIndex >= 0 && bucketIndex < bucketCount) {
        buckets[bucketIndex]++;
      }
    }

    // 7. 生成输出数组
    return buckets.map((count, index) => ({
      time: index * granularity,
      count,
    }));
  });

/**
 * 工具函数：查找热力图中的峰值
 *
 * @param heatmap - 热力图数据
 * @returns 弹幕数最多的时间点，如果为空返回 undefined
 */
function findHeatmapPeak(heatmap: HeatmapPoint[]): HeatmapPoint | undefined {
  if (heatmap.length === 0) return undefined;

  let peak = heatmap[0];
  for (let i = 1; i < heatmap.length; i++) {
    if (heatmap[i].count > peak.count) {
      peak = heatmap[i];
    }
  }

  return peak;
}

export const HeatmapUtils = {
  findPeak: findHeatmapPeak,
};
