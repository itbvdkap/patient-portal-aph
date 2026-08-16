import type {
  Appointment,
  ImagingResult,
  LabResult,
  Patient,
  Prescription,
  Visit,
  VisitDetail,
} from "@/types/patient";

export const demoPatientId = "11111111-1111-4111-8111-111111111111";

export const patients: Patient[] = [
  {
    id: demoPatientId,
    hisPatientCode: "23006552",
    fullName: "NGUYỄN VĂN AN",
    birthDate: "1985-05-15",
    gender: "Nam",
    phone: "0901234567",
    address: "TP. Hồ Chí Minh",
    insurance: {
      id: "71111111-1111-4111-8111-111111111111",
      patientId: demoPatientId,
      cardNumber: "DN4010123456789",
      benefitCode: "4",
      registeredClinic: "Bệnh viện Đa khoa An Phú",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      status: "Còn hiệu lực",
    },
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    hisPatientCode: "23001001",
    fullName: "TRẦN THỊ BÌNH",
    birthDate: "1992-09-03",
    gender: "Nữ",
    phone: "0912222333",
    address: "Bình Dương",
    insurance: {
      id: "72222222-2222-4222-8222-222222222222",
      patientId: "22222222-2222-4222-8222-222222222222",
      cardNumber: "DN4010000000001",
      benefitCode: "4",
      registeredClinic: "Bệnh viện Đa khoa An Phú",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      status: "Còn hiệu lực",
    },
  },
];

export const visits: Visit[] = [
  {
    id: "v-20260812",
    patientId: demoPatientId,
    hisVisitId: "MAQL-20260812",
    visitDate: "2026-08-12T08:30:00+07:00",
    departmentName: "Nội tổng quát",
    doctorName: "BS. Nguyễn Minh Thành",
    status: "Đã hoàn tất",
    primaryDiagnosis: "E11.9 - Đái tháo đường type 2",
    notes: "Theo dõi đường huyết định kỳ.",
  },
  {
    id: "v-20260605",
    patientId: demoPatientId,
    hisVisitId: "MAQL-20260605",
    visitDate: "2026-06-05T09:15:00+07:00",
    departmentName: "Tim mạch",
    doctorName: "BS. Trần Văn Hùng",
    status: "Đã hoàn tất",
    primaryDiagnosis: "I10 - Tăng huyết áp",
    notes: "Điều chỉnh thuốc huyết áp.",
  },
  {
    id: "v-20260320",
    patientId: demoPatientId,
    hisVisitId: "MAQL-20260320",
    visitDate: "2026-03-20T10:00:00+07:00",
    departmentName: "Nội tổng quát",
    doctorName: "BS. Nguyễn Minh Thành",
    status: "Đã hoàn tất",
    primaryDiagnosis: "E78.5 - Rối loạn lipid máu",
    notes: "Tư vấn dinh dưỡng và vận động.",
  },
  {
    id: "v-20260118",
    patientId: demoPatientId,
    hisVisitId: "MAQL-20260118",
    visitDate: "2026-01-18T07:45:00+07:00",
    departmentName: "Chẩn đoán hình ảnh",
    doctorName: "BS. Lê Hoàng Anh",
    status: "Đã hoàn tất",
    primaryDiagnosis: "R10.4 - Đau bụng không đặc hiệu",
    notes: "Đã thực hiện siêu âm bụng.",
  },
  {
    id: "v-20251104",
    patientId: demoPatientId,
    hisVisitId: "MAQL-20251104",
    visitDate: "2025-11-04T08:10:00+07:00",
    departmentName: "Hô hấp",
    doctorName: "BS. Phạm Quang Dũng",
    status: "Đã hoàn tất",
    primaryDiagnosis: "J20.9 - Viêm phế quản cấp",
    notes: "Điều trị ngoại trú.",
  },
  {
    id: "v-20250922",
    patientId: demoPatientId,
    hisVisitId: "MAQL-20250922",
    visitDate: "2025-09-22T13:30:00+07:00",
    departmentName: "Cơ xương khớp",
    doctorName: "BS. Võ Thanh Tâm",
    status: "Đã hoàn tất",
    primaryDiagnosis: "M54.5 - Đau thắt lưng",
    notes: "Tập vật lý trị liệu tại nhà.",
  },
];

export const labResults: LabResult[] = [
  { id: "lab-1", visitId: "v-20260812", testName: "Glucose", result: 8.2, unit: "mmol/L", referenceRange: "3.9 - 6.4", performedAt: "2026-08-12T09:15:00+07:00", flag: "Cao" },
  { id: "lab-2", visitId: "v-20260812", testName: "HbA1c", result: 7.1, unit: "%", referenceRange: "4.0 - 5.6", performedAt: "2026-08-12T09:15:00+07:00", flag: "Cao" },
  { id: "lab-3", visitId: "v-20260812", testName: "Creatinine", result: 86, unit: "µmol/L", referenceRange: "62 - 106", performedAt: "2026-08-12T09:15:00+07:00", flag: "Bình thường" },
  { id: "lab-4", visitId: "v-20260812", testName: "AST", result: 32, unit: "U/L", referenceRange: "< 40", performedAt: "2026-08-12T09:15:00+07:00", flag: "Bình thường" },
  { id: "lab-5", visitId: "v-20260812", testName: "ALT", result: 37, unit: "U/L", referenceRange: "< 41", performedAt: "2026-08-12T09:15:00+07:00", flag: "Bình thường" },
  { id: "lab-6", visitId: "v-20260320", testName: "Cholesterol", result: 6.4, unit: "mmol/L", referenceRange: "< 5.2", performedAt: "2026-03-20T10:45:00+07:00", flag: "Cao" },
  { id: "lab-7", visitId: "v-20260320", testName: "Triglyceride", result: 2.4, unit: "mmol/L", referenceRange: "< 1.7", performedAt: "2026-03-20T10:45:00+07:00", flag: "Cao" },
  { id: "lab-8", visitId: "v-20260320", testName: "HDL-C", result: 0.9, unit: "mmol/L", referenceRange: "> 1.0", performedAt: "2026-03-20T10:45:00+07:00", flag: "Thấp" },
  { id: "lab-9", visitId: "v-20260320", testName: "LDL-C", result: 3.8, unit: "mmol/L", referenceRange: "< 3.4", performedAt: "2026-03-20T10:45:00+07:00", flag: "Cao" },
];

export const imagingResults: ImagingResult[] = [
  {
    id: "img-1",
    visitId: "v-20260118",
    date: "2026-01-18T09:00:00+07:00",
    techniqueName: "Siêu âm bụng",
    doctorName: "BS. Lê Hoàng Anh",
    description: "Gan kích thước bình thường, nhu mô đồng nhất. Túi mật không sỏi.",
    conclusion: "Chưa ghi nhận bất thường rõ trên siêu âm bụng.",
  },
  {
    id: "img-2",
    visitId: "v-20251104",
    date: "2025-11-04T09:30:00+07:00",
    techniqueName: "X-quang ngực",
    doctorName: "BS. Phạm Quang Dũng",
    description: "Phổi sáng đều, tim không to, góc sườn hoành rõ.",
    conclusion: "Không thấy tổn thương cấp tính trên phim.",
  },
  {
    id: "img-3",
    visitId: "v-20260118",
    date: "2026-01-18T10:30:00+07:00",
    techniqueName: "CT bụng - tiểu khung",
    doctorName: "BS. Lê Hoàng Anh",
    description: "Khảo sát ổ bụng và tiểu khung sau tiêm thuốc cản quang.",
    conclusion: "Chưa phát hiện khối choán chỗ bất thường.",
  },
];

export const prescriptions: Prescription[] = [
  {
    id: "rx-1",
    visitId: "v-20260812",
    prescribedAt: "2026-08-12T10:00:00+07:00",
    doctorName: "BS. Nguyễn Minh Thành",
    items: [
      { id: "rxi-1", medicineName: "Metformin 500mg", activeIngredient: "Metformin", strength: "500mg", route: "Uống", quantity: "30 viên", dosage: "Sáng 1 viên - chiều 1 viên", instruction: "Uống sau ăn" },
      { id: "rxi-2", medicineName: "Atorvastatin 20mg", activeIngredient: "Atorvastatin", strength: "20mg", route: "Uống", quantity: "30 viên", dosage: "Tối 1 viên", instruction: "Uống sau ăn tối" },
    ],
  },
  {
    id: "rx-2",
    visitId: "v-20260605",
    prescribedAt: "2026-06-05T10:20:00+07:00",
    doctorName: "BS. Trần Văn Hùng",
    items: [
      { id: "rxi-3", medicineName: "Amlodipine 5mg", activeIngredient: "Amlodipine", strength: "5mg", route: "Uống", quantity: "30 viên", dosage: "Ngày 1 viên", instruction: "Uống buổi sáng" },
    ],
  },
];

export const appointments: Appointment[] = [
  {
    id: "appt-1",
    patientId: demoPatientId,
    appointmentDate: "2026-09-12T08:30:00+07:00",
    departmentName: "Nội tổng quát",
    doctorName: "BS. Nguyễn Minh Thành",
    content: "Tái khám đường huyết và đánh giá kết quả xét nghiệm.",
  },
  {
    id: "appt-2",
    patientId: demoPatientId,
    appointmentDate: "2026-10-05T09:00:00+07:00",
    departmentName: "Tim mạch",
    doctorName: "BS. Trần Văn Hùng",
    content: "Kiểm tra huyết áp, điều chỉnh thuốc nếu cần.",
  },
];

export function buildVisitDetail(visit: Visit): VisitDetail {
  return {
    ...visit,
    diagnoses: [
      {
        id: `dx-${visit.id}`,
        visitId: visit.id,
        icd10Code: visit.primaryDiagnosis.split(" - ")[0],
        diagnosisName: visit.primaryDiagnosis.split(" - ")[1] ?? visit.primaryDiagnosis,
        diagnosisType: "Chính",
      },
    ],
    vitalSigns: {
      bloodPressure: visit.id === "v-20260605" ? "150/92 mmHg" : "128/78 mmHg",
      pulse: 78,
      temperature: 36.8,
      weight: 68,
      height: 170,
      bmi: 23.5,
    },
    services: [
      { id: `svc-1-${visit.id}`, visitId: visit.id, serviceName: "Khám chuyên khoa", performedAt: visit.visitDate, status: "Đã thực hiện" },
      { id: `svc-2-${visit.id}`, visitId: visit.id, serviceName: "Tư vấn điều trị", performedAt: visit.visitDate, status: "Đã thực hiện" },
    ],
    prescription: prescriptions.find((item) => item.visitId === visit.id),
    labResults: labResults.filter((item) => item.visitId === visit.id),
    imagingResults: imagingResults.filter((item) => item.visitId === visit.id),
    doctorAdvice: "Dùng thuốc theo toa, tái khám đúng hẹn. Khi có dấu hiệu bất thường cần liên hệ cơ sở y tế.",
    followUpDate: appointments[0]?.appointmentDate,
  };
}
