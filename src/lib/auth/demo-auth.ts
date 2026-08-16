export const demoSessionCookie = "anphu_demo_session";
export const demoPatientCode = "23006552";
export const demoOtp = "123456";

export function canRequestDemoOtp(identifier: string) {
  return [demoPatientCode, "0901234567"].includes(identifier.trim());
}

export function verifyDemoOtp(identifier: string, otp: string) {
  return canRequestDemoOtp(identifier) && otp === demoOtp;
}
