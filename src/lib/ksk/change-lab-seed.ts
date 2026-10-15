import type { LabTarget } from "./change-contract";
export const labCatalog = [{ id: "LAB-S01", name: "Khám tổng quát mẫu" }, { id: "LAB-S02", name: "Xét nghiệm mẫu" }, { id: "LAB-S03", name: "X-quang mẫu" }];
export const labGroups = [{ id: "LAB-G01", name: "Nhóm văn phòng GIẢ LẬP" }, { id: "LAB-G02", name: "Nhóm sản xuất GIẢ LẬP" }];
export function seedLabTargets(): LabTarget[] {
  return [
    { id: "LAB-P01", hasVisit: false, value: { kind: "package", name: "Gói cơ bản GIẢ LẬP", services: [{ serviceId: "LAB-S01", quantity: 1, unitPrice: 100000 }, { serviceId: "LAB-S02", quantity: 1, unitPrice: 50000 }] } },
    { id: "LAB-P02", hasVisit: false, value: { kind: "package", name: "Gói đã tiếp nhận GIẢ LẬP", services: [{ serviceId: "LAB-S01", quantity: 1, unitPrice: 120000 }] } },
    { id: "LAB-M01", hasVisit: false, value: { kind: "member", name: "Người khám GIẢ LẬP A", birthYear: 1990, sex: "female", employeeCode: "TEST01", department: "Văn phòng", groupId: "LAB-G01", packageId: "LAB-P01" } },
    { id: "LAB-M02", hasVisit: true, value: { kind: "member", name: "Người khám GIẢ LẬP B", birthYear: 1985, sex: "male", employeeCode: "TEST02", department: "Sản xuất", groupId: "LAB-G02", packageId: "LAB-P02" } },
  ];
}
