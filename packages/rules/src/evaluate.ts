/**
 * 离线金标准确率评估器（规格 §26.2 正确性门槛）。
 * 输入：金标已知答案（golden.json）+ 系统预测（result_row 投影），
 * 输出：两名主要自然人选择准确率 / 人员—机构—岗位映射准确率 / precision / recall / F1。
 * 纯函数、不触网、不依赖 DB。
 */

export interface GoldenPrimary {
  personName: string;
  url: string | null;
}
export interface GoldenInstitution {
  officialName: string;
  entryUrl: string;
  primary: GoldenPrimary[];
}
export interface GoldenFile {
  version: string;
  regions: Record<string, { institutions: GoldenInstitution[] }>;
}

/** 系统预测行（来自 result_row 投影的子集）。 */
export interface PredictedRow {
  institutionName: string;
  slot: string;
  personName: string | null;
  positionUrl: string | null;
}

/** 评估明细行（金标与预测配对结果）。 */
export interface EvaluatedRow {
  institutionName: string;
  slot: string;
  goldenName: string | null;
  predictedName: string | null;
  goldenUrl: string | null;
  predictedUrl: string | null;
  /** 人名命中（金标非空且相等）。 */
  nameHit: boolean;
  /** 人+URL 全命中（映射准确率口径）。 */
  mappingHit: boolean;
}

export interface AccuracyReport {
  /** 两名主要自然人选择准确率 = 人名命中槽位 / 金标槽位总数（§26.2 ≥95%）。 */
  twoPrimaryAccuracy: number;
  /** 人员—机构—岗位映射准确率 = 人+URL 全命中 / 金标槽位总数（§26.2 ≥98%）。 */
  mappingAccuracy: number;
  /** 已知合格 URL 召回率 = 命中金标 URL / 金标 URL 总数（§26.2 ≥90%）。 */
  recall: number;
  /** 预测非空 URL 中命中金标的比例。 */
  precision: number;
  f1: number;
  rows: EvaluatedRow[];
}

/** 展平金标为槽位行（含机构名 + 槽位序号）。 */
function flattenGolden(golden: GoldenFile): EvaluatedRow[] {
  const rows: EvaluatedRow[] = [];
  for (const region of Object.values(golden.regions)) {
    for (const inst of region.institutions) {
      const slots: string[] = ["PRIMARY_1", "PRIMARY_2"];
      inst.primary.forEach((p, idx) => {
        rows.push({
          institutionName: inst.officialName,
          slot: slots[idx] ?? `PRIMARY_${idx + 1}`,
          goldenName: p.personName,
          predictedName: null,
          goldenUrl: p.url,
          predictedUrl: null,
          nameHit: false,
          mappingHit: false,
        });
      });
    }
  }
  return rows;
}

/** 评估金标 vs 预测。 */
export function evaluateAccuracy(golden: GoldenFile, predicted: PredictedRow[]): AccuracyReport {
  const rows = flattenGolden(golden);

  // 按 institutionName + slot 配对预测。
  const predByKey = new Map<string, PredictedRow>();
  for (const p of predicted) {
    predByKey.set(`${p.institutionName}|${p.slot}`, p);
  }

  let nameHits = 0;
  let mappingHits = 0;
  let goldenUrlHits = 0;
  let goldenUrlTotal = 0;
  let predictedUrlNonEmpty = 0;
  let predictedUrlHits = 0;

  for (const row of rows) {
    const pred = predByKey.get(`${row.institutionName}|${row.slot}`);
    if (pred) {
      row.predictedName = pred.personName;
      row.predictedUrl = pred.positionUrl;
    }
    // 人名命中：金标非空 + 预测非空 + 相等。
    row.nameHit = row.goldenName != null && row.predictedName != null && row.goldenName === row.predictedName;
    // 映射命中：人 + URL 全命中（映射准确率口径，§26.2 人员—机构—岗位）。
    row.mappingHit =
      row.nameHit &&
      row.goldenUrl != null &&
      row.predictedUrl != null &&
      row.goldenUrl === row.predictedUrl;

    if (row.nameHit) nameHits += 1;
    if (row.mappingHit) mappingHits += 1;

    // 召回：金标 URL 中预测命中的比例。
    if (row.goldenUrl != null) {
      goldenUrlTotal += 1;
      if (row.predictedUrl != null && row.goldenUrl === row.predictedUrl) goldenUrlHits += 1;
    }
    // precision：预测非空 URL 中命中金标的比例。
    if (row.predictedUrl != null) {
      predictedUrlNonEmpty += 1;
      if (row.goldenUrl != null && row.goldenUrl === row.predictedUrl) predictedUrlHits += 1;
    }
  }

  const total = rows.length;
  const twoPrimaryAccuracy = total === 0 ? 0 : nameHits / total;
  const mappingAccuracy = total === 0 ? 0 : mappingHits / total;
  const recall = goldenUrlTotal === 0 ? 0 : goldenUrlHits / goldenUrlTotal;
  const precision = predictedUrlNonEmpty === 0 ? 0 : predictedUrlHits / predictedUrlNonEmpty;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return {
    twoPrimaryAccuracy,
    mappingAccuracy,
    recall,
    precision,
    f1,
    rows,
  };
}
