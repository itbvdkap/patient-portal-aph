import type { PatientRepository } from "@/lib/data/patient-repository";
import {
  appointments,
  buildVisitDetail,
  demoPatientId,
  imagingResults,
  labResults,
  patients,
  prescriptions,
  visits,
} from "@/lib/data/mock-data";

export class MockPatientRepository implements PatientRepository {
  async getCurrentPatient() {
    return patients[0];
  }

  async getPatientById(patientId: string) {
    return patients.find((patient) => patient.id === patientId) ?? null;
  }

  async getSummary(patientId: string) {
    const patientVisits = visits.filter((visit) => visit.patientId === patientId);
    const visitIds = new Set(patientVisits.map((visit) => visit.id));

    return {
      visitsCount: patientVisits.length,
      labResultsCount: labResults.filter((result) => visitIds.has(result.visitId)).length,
      imagingResultsCount: imagingResults.filter((result) => visitIds.has(result.visitId)).length,
      prescriptionsCount: prescriptions.filter((prescription) => visitIds.has(prescription.visitId)).length,
      appointmentsCount: appointments.filter((appointment) => appointment.patientId === patientId).length,
    };
  }

  async getVisits(patientId: string) {
    return visits.filter((visit) => visit.patientId === patientId);
  }

  async getVisitDetail(patientId: string, visitId: string) {
    const visit = visits.find((item) => item.id === visitId && item.patientId === patientId);
    return visit ? buildVisitDetail(visit) : null;
  }

  async getLabResults(patientId: string, visitId?: string) {
    const visitIds = new Set(visits.filter((visit) => visit.patientId === patientId).map((visit) => visit.id));
    return labResults
      .filter((result) => visitIds.has(result.visitId) && (!visitId || result.visitId === visitId))
      .map((result) => ({ serviceName: "Xét nghiệm", ...result }));
  }

  async getImagingResults(patientId: string) {
    const visitIds = new Set(visits.filter((visit) => visit.patientId === patientId).map((visit) => visit.id));
    return imagingResults.filter((result) => visitIds.has(result.visitId));
  }

  async getPrescriptions(patientId: string) {
    const visitIds = new Set(visits.filter((visit) => visit.patientId === patientId).map((visit) => visit.id));
    return prescriptions.filter((prescription) => visitIds.has(prescription.visitId));
  }

  async getInsurance(patientId: string) {
    return patients.find((patient) => patient.id === patientId)?.insurance ?? null;
  }

  async getAppointments(patientId: string) {
    return appointments.filter((appointment) => appointment.patientId === patientId);
  }

  async getTodayVisitStatus() {
    return {
      hasActiveVisit: false,
      currentStep: "NONE",
      currentStepText: "Chưa có lượt đăng ký hôm nay",
      registration: null,
      services: [],
    };
  }

  async getRegistrations() {
    return [];
  }
}

export const currentDemoPatientId = demoPatientId;
