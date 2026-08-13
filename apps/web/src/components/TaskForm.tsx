import { useState } from "react";
import type { InstitutionType } from "@stellaris/contracts";
import { EMPTY_REGION_SELECTION, RegionPicker, type RegionSelection } from "./RegionPicker.js";
import type { ApiClient } from "../app.js";

export interface TaskFormValues {
  mode: "TARGETED" | "FULL_INSTITUTION";
  /** TARGETED 模式字段。 */
  regionCode?: string;
  regionName?: string;
  institutionName?: string;
  institutionType?: InstitutionType;
  officialEntryUrl?: string;
  /** FULL_INSTITUTION 模式字段（RegionPicker 选择结果）。 */
  regionSelection?: RegionSelection;
}

/**
 * 指定行政区/机构任务表单（规格 §5.2 定向模式 + §5.1 完整机构模式）。
 * - 定向模式：行政区代码/名称 + 机构名称 + 可选官方入口（R-37）；
 * - 完整机构模式：RegionPicker（行政区多选/上传名单/展开层级）。
 */
export function TaskForm({
  api,
  onSubmit,
  disabled,
}: {
  api: ApiClient;
  onSubmit: (values: TaskFormValues) => Promise<void>;
  disabled: boolean;
}): React.ReactElement {
  const [mode, setMode] = useState<"TARGETED" | "FULL_INSTITUTION">("FULL_INSTITUTION");
  const [regionCode, setRegionCode] = useState("");
  const [regionName, setRegionName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [officialEntryUrl, setOfficialEntryUrl] = useState("");
  const [regionSelection, setRegionSelection] = useState<RegionSelection>(EMPTY_REGION_SELECTION);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (mode === "TARGETED") {
      void onSubmit({
        mode,
        regionCode,
        regionName,
        institutionName,
        institutionType: "government",
        ...(officialEntryUrl.trim() ? { officialEntryUrl: officialEntryUrl.trim() } : {}),
      });
    } else {
      if (!regionSelection.finalRegion) return;
      void onSubmit({ mode, regionSelection });
    }
  };

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <div className="task-form__content">
        <div className="tf-mode">
          <label>
            <input
              type="radio"
              name="tf-mode"
              checked={mode === "FULL_INSTITUTION"}
              onChange={() => setMode("FULL_INSTITUTION")}
            />
            完整机构模式
          </label>
          <label>
            <input
              type="radio"
              name="tf-mode"
              checked={mode === "TARGETED"}
              onChange={() => setMode("TARGETED")}
            />
            指定机构
          </label>
        </div>

        {mode === "TARGETED" ? (
          <fieldset className="targeted-card" aria-label="指定机构信息">
            <legend>指定机构</legend>
            <div className="targeted-fields">
              <label>
                行政区划代码
                <input
                  value={regionCode}
                  onChange={(e) => setRegionCode(e.target.value)}
                  required
                />
              </label>
              <label>
                行政区名称
                <input
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  required
                />
              </label>
              <label>
                机构名称
                <input
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  required
                />
              </label>
              <label>
                官方入口 URL（可选，留空自动补全）
                <input
                  type="url"
                  value={officialEntryUrl}
                  onChange={(e) => setOfficialEntryUrl(e.target.value)}
                  placeholder="https://www.ah.gov.cn/..."
                />
              </label>
            </div>
          </fieldset>
        ) : (
          <RegionPicker
            api={api}
            value={regionSelection}
            onChange={setRegionSelection}
          />
        )}

        <button
          type="submit"
          className="primary start-action"
          disabled={disabled || (mode === "FULL_INSTITUTION" && !regionSelection.finalRegion)}
        >
          <span className="ui-icon icon-play" aria-hidden="true" />
          开始采集
        </button>
      </div>
    </form>
  );
}
