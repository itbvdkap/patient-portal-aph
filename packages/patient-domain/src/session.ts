import { z } from "zod";

export const patientSessionProfileSchema = z.object({
  mabn: z.string(),
  patientId: z.string(),
  fullName: z.string().optional(),
  relationship: z.string().optional(),
});

export const mobileSessionSchema = z.object({
  sessionId: z.string().optional(),
  accountId: z.string().optional(),
  accountKey: z.string().optional(),
  phoneMasked: z.string().optional(),
  currentMabn: z.string().optional(),
  profiles: z.array(patientSessionProfileSchema).default([]),
});

export const apiErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
});

export const apiEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema.optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  });

export type PatientSessionProfile = z.infer<typeof patientSessionProfileSchema>;
export type MobileSession = z.infer<typeof mobileSessionSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiEnvelope<T> = {
  data?: T;
  error?: string;
  message?: string;
};

export type PortalAuthMode = "password" | "otp-register" | "forgot-password";
