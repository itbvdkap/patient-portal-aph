export const PATIENT_BRANCHES = [
  {
    code: "CN1",
    name: "Bệnh viện An Phú - Chi nhánh 1",
    shortName: "An Phú CN1",
    location: "Thuận An",
  },
  {
    code: "CN3",
    name: "Phòng khám An Phú - Chi nhánh 3",
    shortName: "An Phú CN3",
    location: "Đồng Nai",
  },
] as const;

export type PatientBranchCode = (typeof PATIENT_BRANCHES)[number]["code"];

export function isPatientBranchCode(value: unknown): value is PatientBranchCode {
  return PATIENT_BRANCHES.some((branch) => branch.code === value);
}

export function patientBranch(code: PatientBranchCode) {
  return PATIENT_BRANCHES.find((branch) => branch.code === code) ?? PATIENT_BRANCHES[0];
}

export function patientBranchName(code: PatientBranchCode) {
  return patientBranch(code).name;
}

export function normalizePatientBranchCode(input: {
  branchCode?: unknown;
  branch_code?: unknown;
  branchId?: unknown;
  branch?: unknown;
}): PatientBranchCode | null {
  const directCode = normalizeBranchCodeValue(input.branchCode ?? input.branch_code);
  if (directCode) return directCode;

  const branchId = String(input.branchId ?? "").trim();
  if (branchId === "1") return "CN1";
  if (branchId === "3") return "CN3";

  const branchName = normalizeBranchText(input.branch);
  if (!branchName) return null;
  if (branchName.includes("CN3") || branchName.includes("CHI NHANH 3") || branchName.includes("DONG NAI") || branchName.includes("BINH PHUOC")) {
    return "CN3";
  }
  if (branchName.includes("CN1") || branchName.includes("CHI NHANH 1") || branchName.includes("THUAN AN") || branchName.includes("BINH DUONG")) {
    return "CN1";
  }

  return null;
}

function normalizeBranchCodeValue(value: unknown): PatientBranchCode | null {
  const code = String(value ?? "").trim().toUpperCase();
  return isPatientBranchCode(code) ? code : null;
}

function normalizeBranchText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D");
}
