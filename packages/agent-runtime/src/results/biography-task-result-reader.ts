import type { BiographyUrlResult } from "./biography-url-result.js";

/**
 * Biography Task Result Reader（STEP 18）。
 *
 * 薄 batch 读取：task → packet ids → BiographyUrlResult[]。
 * 只复用单 Packet 的 BiographyUrlResultReader（LATEST_FROZEN_APPROVED_REVIEW 唯一 SSoT），
 * 不复制 URL 投影、不直接访问 Agent Runner、不读取 Search Result / Candidate Pool 第一条。
 * 严格保持输入 packetId 顺序（= frozen inventory 顺序），过滤不存在的 packet。
 */

/** 单 Packet Reader 形状（BiographyUrlResultReader 结构兼容）。 */
export interface BiographyUrlResultReaderPort {
  read(packetId: string): Promise<BiographyUrlResult | null>;
}

export class BiographyTaskResultReader {
  constructor(private readonly single: BiographyUrlResultReaderPort) {}

  /** 按 packetIds 顺序重建结果；packet 不存在（null）时跳过，不改变其余顺序。 */
  async readMany(packetIds: string[]): Promise<BiographyUrlResult[]> {
    const results: BiographyUrlResult[] = [];
    for (const packetId of packetIds) {
      const result = await this.single.read(packetId);
      if (result !== null) {
        results.push(result);
      }
    }
    return results;
  }
}
