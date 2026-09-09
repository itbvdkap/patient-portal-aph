import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { formatDate, formatDateTime, normalizeDisplayText } from "@anphu/patient-domain";
import type {
  Appointment,
  ImagingResult,
  LabResult,
  Patient,
  TodayVisitStatus,
} from "@anphu/patient-domain";
import {
  getAppointments,
  getCurrentPatient,
  getCurrentSession,
  getImagingResults,
  getLabResults,
  getTodayVisit,
} from "@/lib/portal-api";
import { Badge, Body, Card, EmptyState, H1, Mono, Screen } from "@/ui/components";
import { colors } from "@/ui/theme";

type NotificationTone = "teal" | "amber" | "red" | "blue" | "violet";

type PortalNotification = {
  id: string;
  title: string;
  body: string;
  meta: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tone: NotificationTone;
  target: string;
};

type NotificationTab = "today" | "alerts";

export default function NotificationsScreen() {
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [today, setToday] = useState<TodayVisitStatus | null>(null);
  const [activeTab, setActiveTab] = useState<NotificationTab>("today");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");

    const session = await getCurrentSession();
    if (!session) {
      router.replace("/login");
      setLoading(false);
      return;
    }

    if (!session.currentMabn) {
      router.replace("/profiles");
      setLoading(false);
      return;
    }

    try {
      const [patient, today, appointments, labs, imaging] = await Promise.all([
        getCurrentPatient(),
        getTodayVisit(),
        getAppointments(),
        getLabResults(),
        getImagingResults(),
      ]);

      setToday(today);
      setItems(buildNotifications({ patient, today, appointments, labs, imaging }));
    } catch {
      setMessage("Chưa tải được thông báo. Vui lòng kéo xuống để thử lại.");
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      void load();
    }, []),
  );

  return (
    <Screen nav>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <View style={styles.heading}>
          <View style={{ flex: 1 }}>
            <H1>Thông báo</H1>
            <Body>Theo dõi khám hôm nay và các thông báo quan trọng trong một chỗ.</Body>
          </View>
          <Pressable onPress={load} style={styles.refreshButton} accessibilityLabel="Tải lại thông báo">
            <MaterialCommunityIcons name="refresh" size={22} color={colors.teal} />
          </Pressable>
        </View>

        {message ? (
          <Card tone="soft">
            <Body>{message}</Body>
          </Card>
        ) : null}

        <View style={styles.tabs}>
          <TabButton active={activeTab === "today"} label="Khám hôm nay" onPress={() => setActiveTab("today")} />
          <TabButton active={activeTab === "alerts"} label={`Thông báo (${items.length})`} onPress={() => setActiveTab("alerts")} />
        </View>

        {activeTab === "today" ? (
          <TodayPanel today={today} loading={loading} />
        ) : (
          <>
            <Card tone="teal">
              <Text style={styles.heroEyebrow}>TRUNG TÂM THÔNG BÁO</Text>
              <Text style={styles.heroTitle}>{items.length} tin cần xem</Text>
              <Text style={styles.heroText}>Thông báo được tổng hợp từ dữ liệu portal hiện tại, chưa phải push notification nền.</Text>
            </Card>

            {items.length ? (
              <View style={styles.list}>
                {items.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    onPress={() => router.push(item.target)}
                    style={({ pressed }) => [styles.notification, pressed && styles.notificationPressed]}
                  >
                    <View style={[styles.iconBox, styles[`iconBox_${item.tone}`]]}>
                      <MaterialCommunityIcons name={item.icon} size={22} color={toneColors[item.tone]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.notificationTop}>
                        <Text style={styles.title}>{item.title}</Text>
                        <Badge tone={item.tone === "red" ? "red" : item.tone === "amber" ? "amber" : "teal"}>{item.meta}</Badge>
                      </View>
                      <Text style={styles.body}>{item.body}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <EmptyState text={loading ? "Đang kiểm tra thông báo..." : "Chưa có thông báo mới cho hồ sơ này."} />
            )}
          </>
        )}

        <Card tone="soft">
          <Text style={styles.noteTitle}>Gợi ý sử dụng</Text>
          <Body>Kéo xuống để làm mới khi đang ở bệnh viện. Với STT khám, hãy ưu tiên bảng gọi số/quầy tiếp nhận nếu thông tin thực tế khác với ước tính trên app.</Body>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function TabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tabButton, active && styles.tabButtonActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function TodayPanel({
  today,
  loading,
}: {
  today: TodayVisitStatus | null;
  loading: boolean;
}) {
  const registration = today?.registration;
  const queue = today?.queueStatus;

  if (!today?.hasActiveVisit || !registration) {
    return (
      <Card tone="soft">
        <Text style={styles.noteTitle}>Chưa có lượt khám hôm nay</Text>
        <Body>{loading ? "Đang kiểm tra trạng thái khám..." : "Nếu bạn vừa đăng ký khám, hãy kéo xuống để tải lại dữ liệu."}</Body>
      </Card>
    );
  }

  return (
    <View style={styles.list}>
      <Card tone="teal">
        <View style={styles.todayHeader}>
          <View style={styles.todayIcon}>
            <MaterialCommunityIcons name="ticket-confirmation-outline" size={26} color={colors.cream} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>KHÁM HÔM NAY</Text>
            <Text style={styles.todayStatus}>{today.currentStepText}</Text>
            {registration.branchName ? <Text style={styles.todayMeta}>{registration.branchName}</Text> : null}
            <Text style={styles.todayMeta}>{registration.departmentName || "Chưa ghi nhận phòng"}</Text>
          </View>
          <View style={styles.ticketPill}>
            <Text style={styles.ticketLabel}>STT</Text>
            <Text style={styles.ticketValue}>{registration.ticketNumber || "--"}</Text>
          </View>
        </View>
        <View style={styles.todayLine}>
          <Mono>{formatDateTime(registration.registeredAt)}</Mono>
          {registration.reason ? <Text style={styles.todayReason}>{registration.reason}</Text> : null}
        </View>
      </Card>

      {queue ? (
        <Card tone="plain">
          <View style={styles.notificationTop}>
            <Text style={styles.noteTitle}>Hàng đợi phòng khám</Text>
            <Badge tone="teal">{queue.departmentName || queue.departmentCode}</Badge>
          </View>
          <View style={styles.queueGrid}>
            <QueueMetric label="Đang xử lý tới" value={queue.currentTicketNumber ? `STT ${queue.currentTicketNumber}` : "Chưa có"} />
            <QueueMetric label="Còn trước bạn" value={`${queue.waitingAhead} lượt`} />
            <QueueMetric label="Dự kiến" value={queue.estimatedMinutes === 0 ? "Sắp tới lượt" : queue.estimatedMinutes ? `${queue.estimatedMinutes} phút` : "Cần kiểm tra"} />
          </View>
          <Text style={styles.queueMessage}>{queue.estimatedText}</Text>
          <Mono>Cập nhật: {queue.updatedAt ? formatDateTime(queue.updatedAt) : "Chưa ghi nhận"}</Mono>
        </Card>
      ) : null}

      <Pressable onPress={() => router.push("/today")} style={styles.detailLink}>
        <Text style={styles.detailLinkText}>Xem chi tiết tiến trình khám</Text>
        <MaterialCommunityIcons name="arrow-right" size={18} color={colors.teal} />
      </Pressable>
    </View>
  );
}

function QueueMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.queueMetric}>
      <Text style={styles.queueMetricLabel}>{label}</Text>
      <Text style={styles.queueMetricValue}>{value}</Text>
    </View>
  );
}

function buildNotifications(input: {
  patient: Patient | null;
  today: TodayVisitStatus | null;
  appointments: Appointment[];
  labs: LabResult[];
  imaging: ImagingResult[];
}): PortalNotification[] {
  const notifications: PortalNotification[] = [];

  if (input.today?.hasActiveVisit) {
    const registration = input.today.registration;
    const queue = input.today.queueStatus;
    notifications.push({
      id: "today-visit",
      title: "Bạn có lượt khám hôm nay",
      body: queue
        ? `${registration?.branchName || queue.branchName || "An Phú"} · ${registration?.departmentName || queue.departmentName}: STT của bạn ${queue.patientTicketNumber}, phòng đang xử lý tới ${queue.currentTicketNumber}. ${queue.estimatedText}`
        : `${registration?.branchName ? `${registration.branchName} · ` : ""}${registration?.departmentName || "Phòng khám"} · ${input.today.currentStepText}`,
      meta: "Hôm nay",
      icon: "stethoscope",
      tone: "amber",
      target: "/today",
    });
  }

  const upcomingAppointments = input.appointments
    .filter((item) => isUpcomingWithinDays(item.appointmentDate, 14))
    .sort((left, right) => new Date(left.appointmentDate).getTime() - new Date(right.appointmentDate).getTime())
    .slice(0, 3);

  for (const appointment of upcomingAppointments) {
    notifications.push({
      id: `appointment-${appointment.id}`,
      title: "Lịch hẹn sắp tới",
      body: `${formatDateTime(appointment.appointmentDate)} · ${normalizeDisplayText(appointment.departmentName) || "Chưa ghi nhận khoa"}`,
      meta: "Lịch hẹn",
      icon: "calendar-clock",
      tone: "teal",
      target: "/medical/appointments",
    });
  }

  const expiringInsurance = insuranceDaysLeft(input.patient?.insurance?.validTo);
  if (typeof expiringInsurance === "number" && expiringInsurance >= 0 && expiringInsurance <= 30) {
    notifications.push({
      id: "insurance-expiring",
      title: expiringInsurance === 0 ? "BHYT hết hạn hôm nay" : "BHYT sắp hết hạn",
      body: `Thẻ BHYT còn ${expiringInsurance} ngày, hạn đến ${formatDate(input.patient!.insurance.validTo)}.`,
      meta: "BHYT",
      icon: "shield-alert-outline",
      tone: expiringInsurance <= 7 ? "red" : "amber",
      target: "/insurance",
    });
  }

  const abnormalLabs = input.labs
    .filter((lab) => normalizeDisplayText(lab.flag) && normalizeDisplayText(lab.flag) !== "Bình thường")
    .slice(0, 3);

  for (const lab of abnormalLabs) {
    notifications.push({
      id: `lab-${lab.id}`,
      title: "Chỉ số xét nghiệm cần xem",
      body: `${normalizeDisplayText(lab.testName)}: ${String(lab.result)} ${normalizeDisplayText(lab.unit)} · ${normalizeDisplayText(lab.flag)}`,
      meta: "Xét nghiệm",
      icon: "flask-outline",
      tone: "red",
      target: "/medical/labs",
    });
  }

  const latestImaging = input.imaging
    .filter((item) => item.date)
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 2);

  for (const item of latestImaging) {
    notifications.push({
      id: `imaging-${item.id}`,
      title: "Có kết quả chẩn đoán hình ảnh",
      body: `${formatDate(item.date)} · ${normalizeDisplayText(item.techniqueName) || "Kết quả CĐHA"}`,
      meta: "CĐHA",
      icon: "image-search-outline",
      tone: "blue",
      target: "/medical/imaging",
    });
  }

  return notifications.slice(0, 10);
}

function isUpcomingWithinDays(value: string, days: number) {
  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return false;

  const today = startOfToday().getTime();
  const max = today + days * 24 * 60 * 60 * 1000;
  return target >= today && target <= max;
}

function insuranceDaysLeft(value: string | undefined) {
  if (!value) return null;

  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return null;

  const diff = target - startOfToday().getTime();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const toneColors: Record<NotificationTone, string> = {
  teal: colors.teal,
  amber: "#b85c00",
  red: colors.red,
  blue: colors.blue,
  violet: colors.violet,
};

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16, paddingBottom: 28 },
  heading: { alignItems: "center", flexDirection: "row", gap: 10 },
  refreshButton: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.creamBorder, borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  tabs: { backgroundColor: colors.creamStrong, borderRadius: 14, flexDirection: "row", gap: 6, padding: 5 },
  tabButton: { alignItems: "center", borderRadius: 11, flex: 1, minHeight: 42, justifyContent: "center" },
  tabButtonActive: { backgroundColor: colors.teal },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: "900" },
  tabTextActive: { color: colors.cream },
  heroEyebrow: { color: colors.tealSoft, fontSize: 11, fontWeight: "900" },
  heroTitle: { color: colors.cream, fontSize: 24, fontWeight: "900", marginTop: 6 },
  heroText: { color: colors.cream, fontSize: 13, fontWeight: "700", lineHeight: 20, marginTop: 8 },
  list: { gap: 10 },
  notification: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.creamBorder,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  notificationPressed: { opacity: 0.72 },
  notificationTop: { alignItems: "flex-start", flexDirection: "row", gap: 8, justifyContent: "space-between" },
  iconBox: { alignItems: "center", borderRadius: 13, height: 44, justifyContent: "center", width: 44 },
  iconBox_teal: { backgroundColor: colors.tealSoft },
  iconBox_amber: { backgroundColor: colors.amberSoft },
  iconBox_red: { backgroundColor: colors.roseSoft },
  iconBox_blue: { backgroundColor: colors.blueSoft },
  iconBox_violet: { backgroundColor: colors.violetSoft },
  title: { color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" },
  body: { color: colors.muted, fontSize: 13, fontWeight: "700", lineHeight: 20, marginTop: 5 },
  noteTitle: { color: colors.ink, fontSize: 16, fontWeight: "900", marginBottom: 6 },
  todayHeader: { alignItems: "center", flexDirection: "row", gap: 12 },
  todayIcon: { alignItems: "center", borderColor: "rgba(255,255,255,0.25)", borderRadius: 14, borderWidth: 1, height: 48, justifyContent: "center", width: 48 },
  todayStatus: { color: colors.cream, fontSize: 22, fontWeight: "900", marginTop: 4 },
  todayMeta: { color: colors.cream, fontWeight: "800", marginTop: 5 },
  todayLine: { gap: 5, marginTop: 14 },
  todayReason: { color: colors.cream, fontWeight: "800" },
  ticketPill: { alignItems: "center", backgroundColor: colors.cream, borderRadius: 14, minWidth: 62, paddingHorizontal: 10, paddingVertical: 8 },
  ticketLabel: { color: colors.teal, fontSize: 10, fontWeight: "900" },
  ticketValue: { color: colors.tealDark, fontFamily: "monospace", fontSize: 22, fontWeight: "900" },
  queueGrid: { gap: 8, marginTop: 12 },
  queueMetric: { backgroundColor: colors.tealPale, borderColor: "#d3ece7", borderRadius: 12, borderWidth: 1, padding: 11 },
  queueMetricLabel: { color: colors.muted, fontSize: 11, fontWeight: "900" },
  queueMetricValue: { color: colors.ink, fontFamily: "monospace", fontSize: 17, fontWeight: "900", marginTop: 4 },
  queueMessage: { backgroundColor: colors.tealSoft, borderRadius: 12, color: colors.tealDark, fontSize: 13, fontWeight: "900", lineHeight: 20, marginTop: 10, padding: 10 },
  detailLink: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 6, paddingHorizontal: 2, paddingVertical: 6 },
  detailLinkText: { color: colors.teal, fontSize: 13, fontWeight: "900" },
});
