import { z } from "zod";

const progressV1Zod = z.float32();
const progressV2Zod = z.int();

export function migrateToV2Progress(
  progressV1: z.infer<typeof progressV1Zod>,
): z.infer<typeof progressV2Zod> {
  return progressV2Zod.parse(~~(progressV1Zod.parse(progressV1) * 1000));
}
