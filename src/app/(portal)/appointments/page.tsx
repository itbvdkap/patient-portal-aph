import { CalendarClock } from "lucide-react";
import { Badge, EmptyState, PageHeader, Panel } from "@/components/ui";
import { createPatientRepository } from "@/lib/data";
import { formatDateTime } from "@/utils/format";

export default async function AppointmentsPage() {
  const repository = createPatientRepository();
  const patient = await repository.getCurrentPatient();
  const appointments = await repository.getAppointments(patient.id);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingAppointments = appointments
    .filter((appointment) => new Date(appointment.appointmentDate) >= today)
    .sort((first, second) => new Date(first.appointmentDate).getTime() - new Date(second.appointmentDate).getTime());
  const nextAppointment = upcomingAppointments[0];

  return (
    <>
      <PageHeader
        title="Lịch hẹn"
        description="Theo dõi lịch tái khám và lịch hẹn đã ghi nhận."
        actions={upcomingAppointments.length > 0 ? <Badge tone="amber">{upcomingAppointments.length} lịch hẹn sắp tới</Badge> : undefined}
      />

      {nextAppointment && (
        <Panel className="mb-4 border-amber-200 bg-amber-50/80 shadow-none">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-800">
              <CalendarClock aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-amber-950">Có lịch hẹn từ hôm nay trở đi</p>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                Gần nhất: {formatDateTime(nextAppointment.appointmentDate)} · {nextAppointment.departmentName}
                {nextAppointment.doctorName ? ` · ${nextAppointment.doctorName}` : ""}
              </p>
            </div>
          </div>
        </Panel>
      )}

      <div className="space-y-3">
        {appointments.length === 0 && <EmptyState text="Chưa có lịch hẹn." />}
        {appointments.map((appointment) => {
          const isUpcoming = new Date(appointment.appointmentDate) >= today;

          return (
            <Panel key={appointment.id} className={isUpcoming ? "border-amber-200" : ""}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-ink">{formatDateTime(appointment.appointmentDate)}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{appointment.departmentName}</p>
                  {appointment.doctorName && <p className="mt-1 text-sm text-slate-600">{appointment.doctorName}</p>}
                </div>
                <Badge tone={isUpcoming ? "amber" : "blue"}>{isUpcoming ? "Sắp tới" : "Đã lên lịch"}</Badge>
              </div>
              {appointment.content && <p className="mt-3 text-sm leading-6 text-slate-700">{appointment.content}</p>}
            </Panel>
          );
        })}
      </div>
    </>
  );
}
