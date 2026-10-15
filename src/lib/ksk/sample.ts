import type { KskQuery, KskSnapshot } from "./domain";

// Entirely synthetic, never sourced from screenshots or HIS. Local development only.
export function demoKskSnapshot(query: KskQuery): KskSnapshot {
  const selected = query.cohort === "900001";
  return {
    scope: { ...query, branch: "DEMO", mode: "demo", asof: new Date().toISOString(), episodePolicy: 2 },
    cohorts: !query.cohort || selected ? [{ id: "900001", name: "Đợt khám minh họa", customerid: "900", customer: "Công ty mẫu — không phải dữ liệu HIS", date: query.from, sohd: "DEMO-01", loai: "0", ghichu: "CSKH mẫu A — dữ liệu giả lập" }] : [],
    members: selected ? [
      { groupid: "101", groupname: "Văn phòng", mabn: "DEMO001", name: "Người khám mẫu A", manv: "NV01", namsinh: "1990", phai: "0" },
      { groupid: "101", groupname: "Văn phòng", mabn: "DEMO002", name: "Người khám mẫu B", manv: "NV02", namsinh: "1995", phai: "1" },
      { groupid: "102", groupname: "Sản xuất", mabn: "DEMO003", name: "Người khám mẫu C", manv: "NV03", namsinh: "1988", phai: "0" },
    ] : [],
    visits: selected ? [
      { maql: "1001", episodeid: "1001", groupid: "101", mabn: "DEMO001", date: query.from },
      { maql: "1002", episodeid: "1002", groupid: "101", mabn: "DEMO002", date: query.from },
    ] : [],
    charges: selected ? [
      { source: "DEMO", id: "1", maql: "1001", mabn: "DEMO001", mavaovien: "1001", serviceid: "1", name: "Khám sức khỏe", quantity: "1", price: "100000", amount: "100000", paid: "0" },
      { source: "DEMO", id: "2", maql: "1001", mabn: "DEMO001", mavaovien: "1001", serviceid: "2", name: "Xét nghiệm mẫu", quantity: "1", price: "50000", amount: "50000", paid: "0" },
      { source: "DEMO", id: "3", maql: "1002", mabn: "DEMO002", mavaovien: "1002", serviceid: "1", name: "Khám sức khỏe", quantity: "1", price: "100000", amount: "100000", paid: "1" },
    ] : [],
    clinical: selected ? [{ kind: "BASK_TONGKET", episodeid: "1001", ketluan: "Kết luận minh họa", loai_kl: "Loại II (mẫu)", mabs: "BS-MAU", denghi: "Theo dõi định kỳ — dữ liệu giả lập" }] : [],
    labs: selected ? [
      { id: "201", maql: "1001", parameterid: "1", name: "Thông số mẫu 1", value: "5.1", unit: "mmol/L", kq_batthuong: "0" },
      { id: "201", maql: "1001", parameterid: "2", name: "Thông số mẫu 2", value: "1.0", unit: "g/L", kq_batthuong: "0" },
    ] : [],
    imaging: [],
    payments: [],
    sections: Object.fromEntries((selected ? ["cohorts", "members", "visits:DEMO", "charges:DEMO", "payments:DEMO", "clinical:DEMO", "conclusions:DEMO", "labs", "imaging:DEMO"] : ["cohorts"]).map(k => [k, true])),
    warnings: ["DỮ LIỆU GIẢ LẬP: không kết nối HIS. Có kết quả không đồng nghĩa đủ CLS/đã duyệt.", "Chi phí phát sinh chưa phải công nợ hợp đồng."],
  };
}
