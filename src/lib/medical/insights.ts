import type { ImagingResult, LabResult, Visit, VisitDetail } from "@/types/patient";

export interface VisitClinicalMarker {
  visitId: string;
  labOrderCount: number;
  abnormalLabCount: number;
  imagingCount: number;
  abnormalImagingCount: number;
}

export interface TrendPoint {
  date: string;
  value: number;
  flag?: string;
  visitId?: string;
}

export interface TrendSeries {
  key: string;
  label: string;
  unit: string;
  kind: "lab" | "vital";
  latestValue: string;
  latestDate: string;
  abnormalCount: number;
  points: TrendPoint[];
}

const trackedLabNames = [
  { key: "glucose", label: "Đường huyết", patterns: [/glucose/i, /duong huyet/i, /đường huyết/i] },
  { key: "hba1c", label: "HbA1c", patterns: [/hba1c/i] },
  { key: "cholesterol", label: "Cholesterol", patterns: [/cholesterol/i] },
  { key: "triglyceride", label: "Triglyceride", patterns: [/triglyceride/i] },
  { key: "hdl-c", label: "HDL-C", patterns: [/hdl/i] },
  { key: "ldl-c", label: "LDL-C", patterns: [/ldl/i] },
  { key: "ast", label: "AST", patterns: [/^ast\b/i, /got/i] },
  { key: "alt", label: "ALT", patterns: [/^alt\b/i, /gpt/i] },
  { key: "creatinine", label: "Creatinine", patterns: [/creatinin/i, /creatinine/i] },
  { key: "uric-acid", label: "Acid uric", patterns: [/acid uric/i, /uric/i] },
  { key: "crp", label: "CRP", patterns: [/\bcrp\b/i] },
  { key: "d-dimer", label: "D-Dimer", patterns: [/d-?dimer/i] },
  { key: "nt-probnp", label: "NT-proBNP", patterns: [/pro-?bnp/i, /nt-?probnp/i] },
];

export function buildVisitClinicalMarkers(labs: LabResult[], imaging: ImagingResult[]): Map<string, VisitClinicalMarker> {
  const markers = new Map<string, VisitClinicalMarker>();

  for (const result of labs) {
    const marker = ensureMarker(markers, result.visitId);
    if (isAbnormalLabFlag(result.flag)) {
      marker.abnormalLabCount += 1;
    }
  }

  for (const [visitId, count] of countLabOrdersByVisit(labs)) {
    ensureMarker(markers, visitId).labOrderCount = count;
  }

  for (const result of imaging) {
    const marker = ensureMarker(markers, result.visitId);
    marker.imagingCount += 1;
    if (isPotentiallyAbnormalImaging(result.conclusion)) {
      marker.abnormalImagingCount += 1;
    }
  }

  return markers;
}

export function isAbnormalLabFlag(flag: LabResult["flag"] | string | undefined) {
  const text = normalizeText(flag);
  return Boolean(text) && text !== "." && text !== "-" && !/^(binh thuong|normal|bt|n)$/.test(text);
}

export function labFlagDirection(flag: LabResult["flag"] | string | undefined) {
  const text = normalizeText(flag);
  if (/(thap|low|giam|down|↓|\bl\b)/.test(text)) return "low";
  if (isAbnormalLabFlag(flag)) return "high";
  return "normal";
}

export function isPotentiallyAbnormalImaging(conclusion: string | undefined) {
  const text = normalizeText(conclusion);
  if (!text) return false;
  if (/(binh thuong|trong gioi han binh thuong|khong thay|khong phat hien|chua phat hien|chua ghi nhan|khong co bat thuong|khong ton thuong|khong thay ton thuong|chua thay bat thuong|khong co dau hieu bat thuong)/.test(text)) {
    return false;
  }

  return true;
}

export function buildLabTrendSeries(results: LabResult[], maxSeries = 8): TrendSeries[] {
  const map = new Map<string, { label: string; unit: string; points: TrendPoint[] }>();

  for (const result of results) {
    const value = parseNumericResult(result.result);
    if (value === null) continue;

    const tracked = matchTrackedLab(result.testName);
    const key = tracked?.key ?? `lab:${normalizeText(result.testName).slice(0, 42)}`;
    const current = map.get(key) ?? {
      label: tracked?.label ?? result.testName,
      unit: result.unit,
      points: [],
    };

    current.points.push({
      date: result.performedAt,
      value,
      flag: result.flag,
      visitId: result.visitId,
    });
    if (!current.unit && result.unit) current.unit = result.unit;
    map.set(key, current);
  }

  return Array.from(map.entries())
    .map(([key, item]) => toTrendSeries(key, item.label, item.unit, "lab", item.points))
    .filter((series) => series.points.length >= 2 || series.abnormalCount > 0)
    .sort((first, second) => {
      const abnormalDelta = second.abnormalCount - first.abnormalCount;
      if (abnormalDelta) return abnormalDelta;
      return new Date(second.latestDate).getTime() - new Date(first.latestDate).getTime();
    })
    .slice(0, maxSeries);
}

export function buildVitalTrendSeries(details: VisitDetail[], visits: Visit[]): TrendSeries[] {
  const visitDateById = new Map(visits.map((visit) => [visit.id, visit.visitDate]));
  const systolic: TrendPoint[] = [];
  const diastolic: TrendPoint[] = [];
  const pulse: TrendPoint[] = [];
  const weight: TrendPoint[] = [];
  const bmi: TrendPoint[] = [];
  const temperature: TrendPoint[] = [];

  for (const detail of details) {
    const date = visitDateById.get(detail.id) ?? detail.visitDate;
    const pressure = parseBloodPressure(detail.vitalSigns?.bloodPressure);
    if (pressure) {
      systolic.push({ date, value: pressure.systolic, flag: pressure.systolic >= 140 ? "Cao" : undefined, visitId: detail.id });
      diastolic.push({ date, value: pressure.diastolic, flag: pressure.diastolic >= 90 ? "Cao" : undefined, visitId: detail.id });
    }
    pushVitalPoint(pulse, date, detail.vitalSigns?.pulse, detail.id, detail.vitalSigns?.pulse > 100 || detail.vitalSigns?.pulse < 60 ? "Cần lưu ý" : undefined);
    pushVitalPoint(weight, date, detail.vitalSigns?.weight, detail.id);
    pushVitalPoint(bmi, date, detail.vitalSigns?.bmi, detail.id, detail.vitalSigns?.bmi >= 25 || detail.vitalSigns?.bmi < 18.5 ? "Cần lưu ý" : undefined);
    pushVitalPoint(temperature, date, detail.vitalSigns?.temperature, detail.id, detail.vitalSigns?.temperature >= 37.5 ? "Cao" : undefined);
  }

  return [
    toTrendSeries("bp-systolic", "Huyết áp tâm thu", "mmHg", "vital", systolic),
    toTrendSeries("bp-diastolic", "Huyết áp tâm trương", "mmHg", "vital", diastolic),
    toTrendSeries("pulse", "Mạch", "lần/phút", "vital", pulse),
    toTrendSeries("weight", "Cân nặng", "kg", "vital", weight),
    toTrendSeries("bmi", "BMI", "", "vital", bmi),
    toTrendSeries("temperature", "Nhiệt độ", "°C", "vital", temperature),
  ].filter((series) => series.points.length >= 2 || series.abnormalCount > 0);
}

function ensureMarker(markers: Map<string, VisitClinicalMarker>, visitId: string) {
  const current =
    markers.get(visitId) ??
    {
      visitId,
      labOrderCount: 0,
      abnormalLabCount: 0,
      imagingCount: 0,
      abnormalImagingCount: 0,
    };
  markers.set(visitId, current);
  return current;
}

function countLabOrdersByVisit(results: LabResult[]) {
  const map = new Map<string, Set<string>>();
  for (const result of results) {
    const serviceName = result.serviceName || "Phiếu xét nghiệm";
    const key = `${serviceName}-${result.performedAt.slice(0, 16)}`;
    const current = map.get(result.visitId) ?? new Set<string>();
    current.add(key);
    map.set(result.visitId, current);
  }
  return Array.from(map.entries()).map(([visitId, orders]) => [visitId, orders.size] as const);
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseNumericResult(value: LabResult["result"]) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").replace(",", ".");
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchTrackedLab(testName: string) {
  return trackedLabNames.find((item) => item.patterns.some((pattern) => pattern.test(testName)));
}

function toTrendSeries(key: string, label: string, unit: string, kind: TrendSeries["kind"], points: TrendPoint[]): TrendSeries {
  const sorted = points
    .filter((point) => Number.isFinite(point.value) && point.date)
    .sort((first, second) => new Date(first.date).getTime() - new Date(second.date).getTime())
    .slice(-12);
  const latest = sorted[sorted.length - 1];

  return {
    key,
    label,
    unit,
    kind,
    latestValue: latest ? formatNumber(latest.value, unit) : "Chưa ghi nhận",
    latestDate: latest?.date ?? "",
    abnormalCount: sorted.filter((point) => isAbnormalLabFlag(point.flag)).length,
    points: sorted,
  };
}

function parseBloodPressure(value: string | undefined) {
  const match = String(value ?? "").match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!match) return null;
  return {
    systolic: Number(match[1]),
    diastolic: Number(match[2]),
  };
}

function pushVitalPoint(points: TrendPoint[], date: string, value: number | undefined, visitId: string, flag?: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return;
  points.push({ date, value, visitId, flag });
}

function formatNumber(value: number, unit: string) {
  const rounded = Math.abs(value) >= 100 ? Math.round(value).toString() : Number(value.toFixed(2)).toString();
  return unit ? `${rounded} ${unit}` : rounded;
}
