import { useEffect, useMemo, useState } from "react";
import type { RegionNode } from "@stellaris/contracts";
import type { ApiClient } from "../app.js";

export type DerivedRegionLevel = "PROVINCE" | "PREFECTURE" | "COUNTY";

export interface RegionSelection {
  province: RegionNode | null;
  city: RegionNode | null;
  county: RegionNode | null;
  finalRegion: RegionNode | null;
  level: DerivedRegionLevel | null;
  /** Path metadata retained for the existing form/request boundary. */
  codes: string[];
  names: string[];
}

export const EMPTY_REGION_SELECTION: RegionSelection = {
  province: null,
  city: null,
  county: null,
  finalRegion: null,
  level: null,
  codes: [],
  names: [],
};

function makeSelection(
  province: RegionNode | null,
  city: RegionNode | null,
  county: RegionNode | null,
): RegionSelection {
  const path = [province, city, county].filter((node): node is RegionNode => node !== null);
  const finalRegion = path.at(-1) ?? null;
  return {
    province,
    city,
    county,
    finalRegion,
    level: county ? "COUNTY" : city ? "PREFECTURE" : province ? "PROVINCE" : null,
    codes: path.map((node) => node.code),
    names: path.map((node) => node.name),
  };
}

export function RegionPicker({
  api,
  value,
  onChange,
}: {
  api: ApiClient;
  value: RegionSelection;
  onChange: (selection: RegionSelection) => void;
}): React.ReactElement {
  const [provinces, setProvinces] = useState<RegionNode[]>([]);
  const [cities, setCities] = useState<RegionNode[]>([]);
  const [counties, setCounties] = useState<RegionNode[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<RegionNode | null>(value.province);
  const [selectedCity, setSelectedCity] = useState<RegionNode | null>(value.city);
  const [selectedCounty, setSelectedCounty] = useState<RegionNode | null>(value.county);
  const [provinceError, setProvinceError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const [countyError, setCountyError] = useState<string | null>(null);
  const [cityLoadingFailed, setCityLoadingFailed] = useState(false);
  const [countyLoadingFailed, setCountyLoadingFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void api.listProvinces().then(
      (nodes) => {
        if (active) {
          setProvinces(nodes);
          setProvinceError(null);
        }
      },
      (error: unknown) => {
        if (active) setProvinceError(error instanceof Error ? error.message : "省份加载失败");
      },
    );
    return () => {
      active = false;
    };
  }, [api]);

  const selection = useMemo(
    () => makeSelection(selectedProvince, selectedCity, selectedCounty),
    [selectedProvince, selectedCity, selectedCounty],
  );

  useEffect(() => {
    onChange(selection);
  }, [onChange, selection]);

  const loadCities = async (province: RegionNode | null): Promise<void> => {
    setCities([]);
    setCounties([]);
    setSelectedCity(null);
    setSelectedCounty(null);
    setCityError(null);
    setCountyError(null);
    setCityLoadingFailed(false);
    setCountyLoadingFailed(false);
    if (!province) return;
    try {
      setCities(await api.listChildren(province.code));
    } catch (error) {
      setCityLoadingFailed(true);
      setCityError(error instanceof Error ? error.message : "地市加载失败");
    }
  };

  const handleProvinceChange = (code: string): void => {
    const province = provinces.find((node) => node.code === code) ?? null;
    setSelectedProvince(province);
    void loadCities(province);
  };

  const handleCityChange = async (code: string): Promise<void> => {
    const city = cities.find((node) => node.code === code) ?? null;
    setSelectedCity(city);
    setSelectedCounty(null);
    setCounties([]);
    setCountyError(null);
    setCountyLoadingFailed(false);
    if (!city) return;
    try {
      setCounties(await api.listChildren(city.code));
    } catch (error) {
      setCountyLoadingFailed(true);
      setCountyError(error instanceof Error ? error.message : "区县加载失败");
    }
  };

  const displayedLevel = selection.level === "PROVINCE"
    ? "省级"
    : selection.level === "PREFECTURE"
      ? "地市级"
      : selection.level === "COUNTY"
        ? "区县级"
        : null;

  return (
    <fieldset className="region-picker" aria-label="采集范围">
      <legend>采集范围</legend>
      <div className="rp-block rp-block--selectors">
        <span className="rp-label">行政区选择</span>
        <div className="rp-row">
          <label className="rp-field">
            <span>省份</span>
            <select
              aria-label="省份"
              value={selectedProvince?.code ?? ""}
              onChange={(event) => handleProvinceChange(event.target.value)}
            >
              <option value="">请选择省份</option>
              {provinces.map((province) => (
                <option key={province.code} value={province.code}>{province.name}</option>
              ))}
            </select>
          </label>
          <label className="rp-field">
            <span>地市</span>
            <select
              aria-label="地市"
              value={selectedCity?.code ?? ""}
              disabled={!selectedProvince || cityLoadingFailed}
              onChange={(event) => void handleCityChange(event.target.value)}
            >
              <option value="">请选择地市</option>
              {cities.map((city) => (
                <option key={city.code} value={city.code}>{city.name}</option>
              ))}
            </select>
          </label>
          <label className="rp-field">
            <span>区县</span>
            <select
              aria-label="区县"
              value={selectedCounty?.code ?? ""}
              disabled={!selectedCity || countyLoadingFailed}
              onChange={(event) => {
                setSelectedCounty(counties.find((node) => node.code === event.target.value) ?? null);
              }}
            >
              <option value="">请选择区县</option>
              {counties.map((county) => (
                <option key={county.code} value={county.code}>{county.name}</option>
              ))}
            </select>
          </label>
        </div>
        {provinceError && <p className="error">{provinceError}</p>}
        {cityError && <p className="error">{cityError}</p>}
        {countyError && <p className="error">{countyError}</p>}
      </div>
      <div className="rp-selection-summary" aria-live="polite">
        <p>当前采集范围：{selection.names.length > 0 ? selection.names.join(" / ") : "未选择"}</p>
        <p>任务层级：{displayedLevel ?? "未确定"}</p>
      </div>
    </fieldset>
  );
}
