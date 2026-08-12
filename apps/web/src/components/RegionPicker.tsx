import { useState } from "react";
import type { RegionNode } from "@stellaris/contracts";
import type { ApiClient } from "../app.js";

/** 行政区选择结果（已展开冻结）。 */
export interface RegionSelection {
  codes: string[];
  names: string[];
  level: "COUNTY" | "TOWN_STREET";
}

const EMPTY: RegionSelection = { codes: [], names: [], level: "COUNTY" };

/**
 * 行政区选择器（规格 §8.1 / §20.1 采集范围多选）。
 * 三种输入方式：
 * - 级联多选：省 → 地市 → 区县，选中父级自动展开；
 * - 上传名单：文本输入代码/名称，validate 校验 + expand 展开；
 * - 展开层级单选：COUNTY / TOWN_STREET。
 */
export function RegionPicker({
  api,
  value,
  onChange,
}: {
  api: ApiClient;
  value: RegionSelection;
  onChange: (sel: RegionSelection) => void;
}): React.ReactElement {
  const [provinces, setProvinces] = useState<RegionNode[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string>("");
  const [cities, setCities] = useState<RegionNode[]>([]);
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [uploadText, setUploadText] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [level, setLevel] = useState<"COUNTY" | "TOWN_STREET">(value.level);

  const loadProvinces = async (): Promise<void> => {
    if (provinces.length === 0) {
      setProvinces(await api.listProvinces());
    }
  };

  const handleProvinceChange = async (code: string): Promise<void> => {
    setSelectedProvince(code);
    if (code) {
      setCities(await api.listChildren(code));
    } else {
      setCities([]);
    }
  };

  const toggleCity = (code: string): void => {
    const next = new Set(selectedCities);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    setSelectedCities(next);
    // 同步展开结果：每个选中地市展开至目标层级。
    applySelection(Array.from(next), level);
  };

  const applySelection = async (cityCodes: string[], targetLevel: "COUNTY" | "TOWN_STREET"): Promise<void> => {
    if (cityCodes.length === 0) {
      onChange(EMPTY);
      return;
    }
    const expanded = await api.expandRegions(cityCodes, targetLevel);
    onChange({
      codes: expanded.map((r) => r.code),
      names: expanded.map((r) => r.name),
      level: targetLevel,
    });
  };

  const handleLevelChange = (next: "COUNTY" | "TOWN_STREET"): void => {
    setLevel(next);
    void applySelection(Array.from(selectedCities), next);
  };

  const handleUpload = async (): Promise<void> => {
    const codes = uploadText
      .split(/[\n,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (codes.length === 0) {
      setUploadError("请输入行政区划代码");
      return;
    }
    const res = await api.validateRegions(codes);
    if (!res.valid) {
      setUploadError(`无效代码：${res.invalid.join("、")}`);
      return;
    }
    setUploadError(null);
    const expanded = await api.expandRegions(codes, level);
    onChange({ codes: expanded.map((r) => r.code), names: expanded.map((r) => r.name), level });
  };

  return (
    <fieldset className="region-picker" aria-label="采集范围">
      <legend>采集范围</legend>

      <div className="rp-block rp-block--selectors">
        <span className="rp-label">行政区多选</span>
        <div className="rp-row">
          <select
            aria-label="省份"
            value={selectedProvince}
            onFocus={() => void loadProvinces()}
            onChange={(e) => void handleProvinceChange(e.target.value)}
          >
            <option value="">选择省份</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="地市（可多选）"
            value={Array.from(selectedCities)}
            multiple
            onChange={(e) => toggleCity(e.target.value)}
            disabled={!selectedProvince}
          >
            {cities.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {selectedCities.size > 0 && (
          <p className="rp-hint">
            已选 {selectedCities.size} 个地市 → 展开 {value.codes.length} 个行政区
          </p>
        )}
      </div>

      <div className="rp-block rp-block--upload">
        <span className="rp-label">或上传名单</span>
        <textarea
          aria-label="上传行政区代码"
          value={uploadText}
          onChange={(e) => setUploadText(e.target.value)}
          placeholder="每行一个行政区划代码，如：340100"
          rows={3}
        />
        <button type="button" className="secondary" onClick={() => void handleUpload()}>
          校验并添加
        </button>
        {uploadError && <p className="error">{uploadError}</p>}
      </div>

      <div className="rp-block rp-block--levels">
        <span className="rp-label">展开层级</span>
        <label>
          <input
            type="radio"
            name="rp-level"
            checked={level === "COUNTY"}
            onChange={() => handleLevelChange("COUNTY")}
          />
          区县
        </label>
        <label>
          <input
            type="radio"
            name="rp-level"
            checked={level === "TOWN_STREET"}
            onChange={() => handleLevelChange("TOWN_STREET")}
          />
          乡镇/街道
        </label>
      </div>
    </fieldset>
  );
}
