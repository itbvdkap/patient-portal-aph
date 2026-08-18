import { AppShell } from "@/components/app-shell";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isPortalSessionActive } from "@/lib/account/portal-account";
import { getDemoPatientSession } from "@/lib/auth/session";
import { createPatientRepository } from "@/lib/data";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = getDemoPatientSession(await cookies());
  const pathname = (await headers()).get("x-portal-pathname") ?? "";
  let upcomingAppointmentsCount = 0;
  let pendingRegistrationsCount = 0;
  let activeTodayVisitCount = 0;

  if (!session) {
    redirect("/login");
  }

  if (session) {
    const isActive = await isPortalSessionActive(session);
    if (!isActive) {
      redirect("/login");
    }

    if (!session.mabn && !pathname.startsWith("/profile")) {
      redirect("/profile");
    }

    if (session.mabn) {
      const repository = createPatientRepository();
      const [appointmentsResult, registrationsResult, todayVisitStatusResult] = await Promise.allSettled([
        repository.getAppointments(session.patientId),
        repository.getRegistrations(session.patientId),
        repository.getTodayVisitStatus(session.patientId),
      ]);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (appointmentsResult.status === "fulfilled") {
        upcomingAppointmentsCount = appointmentsResult.value.filter((appointment) => new Date(appointment.appointmentDate) >= today).length;
      }

      if (registrationsResult.status === "fulfilled") {
        pendingRegistrationsCount = registrationsResult.value.filter((registration) => new Date(registration.registeredAt) >= today && registration.status !== "Đã khám").length;
      }

      if (todayVisitStatusResult.status === "fulfilled") {
        activeTodayVisitCount = todayVisitStatusResult.value.hasActiveVisit ? 1 : 0;
      }
    }
  }

  return (
    <AppShell
      upcomingAppointmentsCount={upcomingAppointmentsCount}
      pendingRegistrationsCount={pendingRegistrationsCount}
      activeTodayVisitCount={activeTodayVisitCount}
    >
      {children}
    </AppShell>
  );
}
