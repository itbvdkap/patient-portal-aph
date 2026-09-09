import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ClinicQueueStatus, TodayVisitStatus } from "@anphu/patient-domain";
import { formatDateTime } from "@anphu/patient-domain";
import { getCurrentSession, getTodayVisit } from "@/lib/portal-api";
import { Badge, Body, Card, EmptyState, H1, Mono, Screen, SecondaryButton } from "@/ui/components";
import { colors } from "@/ui/theme";

const steps = [
  { code: "REGISTERED", label: "Đăng ký", icon: "clipboard-check-outline" },
  { code: "WAITING_EXAM", label: "Chờ khám", icon: "clock-outline" },
  { code: "IN_EXAM", label: "Đang khám", icon: "stethoscope" },
  { code: "CLS", label: "Cận lâm sàng", icon: "flask-outline" },
  { code: "DONE", label: "Hoàn tất", icon: "check-circle-outline" },
] as const;

export default function TodayScreen() {
  const [today, setToday] = useState<TodayVisitStatus | null>(null);
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
      setToday(await getTodayVisit());
    } catch {
      setMessage("Chưa tải được trạng thái khám. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      void load();
    }, []),
  );

  const registration = today?.registration;

  return (
    <Screen nav>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <View style={styles.heading}>
          <View style={{ flex: 1 }}>
            <H1>Khám hôm nay</H1>
            <Body>Theo dõi STT, phòng khám và tiến trình trong ngày.</Body>
          </View>
          <Pressable onPress={load} style={styles.refreshButton} accessibilityLabel="Tải lại">
            <MaterialCommunityIcons name="refresh" size={22} color={colors.teal} />
          </Pressable>
        </View>

        {message ? (
          <Card tone="soft">
            <Body>{message}</Body>
          </Card>
        ) : null}

        {!today?.hasActiveVisit || !registration ? (
          <Card tone="soft">
            <Text style={styles.cardTitle}>Chưa có lượt khám đang hoạt động</Text>
            <Body>Nếu bạn đã đăng ký khám, hãy kéo xuống để tải lại dữ liệu.</Body>
            <SecondaryButton onPress={() => router.push("/booking")}>Đăng ký khám</SecondaryButton>
          </Card>
        ) : (
          <>
            <Card tone="teal">
              <View style={styles.statusHeader}>
                <View style={styles.statusIcon}>
                  <MaterialCommunityIcons name="ticket-confirmation-outline" size={26} color={colors.cream} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>LƯỢT KHÁM HÔM NAY</Text>
                  <Text style={styles.status}>{today.currentStepText}</Text>
                  {registration.branchName ? <Text style={styles.meta}>{registration.branchName}</Text> : null}
                  <Text style={styles.meta}>{registration.departmentName || "Chưa ghi nhận phòng"}</Text>
                </View>
                <View style={styles.ticketPill}>
                  <Text style={styles.ticketLabel}>STT</Text>
                  <Text style={styles.ticketValue}>{registration.ticketNumber || "--"}</Text>
                </View>
              </View>
              <View style={styles.statusLine}>
                <Mono>{formatDateTime(registration.registeredAt)}</Mono>
                {registration.reason ? <Text style={styles.reason}>{registration.reason}</Text> : null}
              </View>
            </Card>

            {today.queueStatus ? <QueueCard queue={today.queueStatus} /> : null}

            <Card>
              <Text style={styles.cardTitle}>Tiến trình khám</Text>
              <View style={styles.timeline}>
                {steps.map((step, index) => {
                  const state = stepState(today.currentStep, index);
                  return (
                    <View key={step.code} style={[styles.stepRow, state === "active" && styles.stepActiveRow]}>
                      <View style={[styles.stepIcon, state !== "idle" && styles.stepIconActive]}>
                        <MaterialCommunityIcons name={step.icon} size={18} color={state === "idle" ? colors.muted : colors.teal} />
                      </View>
                      <Text style={[styles.stepText, state !== "idle" && styles.stepTextActive]}>{step.label}</Text>
                      {state === "done" ? <MaterialCommunityIcons name="check" size={17} color={colors.teal} /> : null}
                    </View>
                  );
                })}
              </View>
            </Card>

            <Card>
              <View style={styles.sectionHeader}>
                <Text style={styles.cardTitle}>Cận lâm sàng</Text>
                <Badge>{today.services.length} dịch vụ</Badge>
              </View>
              {today.services.length ? (
                today.services.map((service) => (
                  <View key={service.id} style={styles.service}>
                    <Text style={styles.serviceName}>{service.serviceName || "Dịch vụ chưa ghi tên"}</Text>
                    <Body>{service.departmentName || service.serviceGroup || "Chưa ghi nhận phòng"}</Body>
                    <Mono>{service.status || "Đang xử lý"}</Mono>
                  </View>
                ))
              ) : (
                <EmptyState text="Chưa có chỉ định cận lâm sàng." />
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function QueueCard({ queue }: { queue: ClinicQueueStatus }) {
  const current = Number(queue.currentTicketNumber);
  const mine = Number(queue.patientTicketNumber);
  const passed = Number.isFinite(current) && Number.isFinite(mine) && current >= mine;

  return (
    <Card tone={passed ? "soft" : "plain"}>
      <View style={styles.sectionHeader}>
        <Text style={styles.cardTitle}>Hàng đợi phòng khám</Text>
        <Badge tone={passed ? "amber" : "teal"}>{queue.departmentName || queue.departmentCode}</Badge>
      </View>
      <View style={styles.queueGrid}>
        <Metric label="Đang xử lý tới" value={queue.currentTicketNumber ? `STT ${queue.currentTicketNumber}` : "Chưa có"} />
        <Metric label="Còn trước bạn" value={`${queue.waitingAhead} lượt`} />
        <Metric label="Dự kiến" value={queue.estimatedMinutes === 0 ? "Sắp tới lượt" : queue.estimatedMinutes ? `${queue.estimatedMinutes} phút` : "Cần kiểm tra"} />
      </View>
      <Text style={[styles.queueMessage, passed && styles.queueWarning]}>{queue.estimatedText}</Text>
      <Mono>Cập nhật: {queue.updatedAt ? formatDateTime(queue.updatedAt) : "Chưa ghi nhận"}</Mono>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function stepState(currentStep: string, index: number) {
  const activeIndex = currentStep === "WAITING_EXAM" ? 1 : currentStep === "IN_EXAM" ? 2 : currentStep === "WAITING_CLS" || currentStep === "DOING_CLS" ? 3 : currentStep === "DONE" ? 4 : 0;
  if (index < activeIndex || currentStep === "DONE") return "done";
  if (index === activeIndex) return "active";
  return "idle";
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16, paddingBottom: 28 },
  heading: { alignItems: "center", flexDirection: "row", gap: 10 },
  refreshButton: { alignItems: "center", backgroundColor: colors.white, borderColor: colors.creamBorder, borderRadius: 14, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  statusHeader: { alignItems: "center", flexDirection: "row", gap: 12 },
  statusIcon: { alignItems: "center", borderColor: "rgba(255,255,255,0.25)", borderRadius: 14, borderWidth: 1, height: 48, justifyContent: "center", width: 48 },
  eyebrow: { color: colors.tealSoft, fontSize: 11, fontWeight: "900" },
  status: { color: colors.cream, fontSize: 22, fontWeight: "900", marginTop: 4 },
  meta: { color: colors.cream, fontWeight: "800", marginTop: 5 },
  ticketPill: { alignItems: "center", backgroundColor: colors.cream, borderRadius: 14, minWidth: 62, paddingHorizontal: 10, paddingVertical: 8 },
  ticketLabel: { color: colors.teal, fontSize: 10, fontWeight: "900" },
  ticketValue: { color: colors.tealDark, fontFamily: "monospace", fontSize: 22, fontWeight: "900" },
  statusLine: { gap: 5, marginTop: 14 },
  reason: { color: colors.cream, fontWeight: "800" },
  sectionHeader: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" },
  queueGrid: { gap: 8, marginTop: 12 },
  metric: { backgroundColor: colors.tealPale, borderColor: "#d3ece7", borderRadius: 12, borderWidth: 1, padding: 11 },
  metricLabel: { color: colors.muted, fontSize: 11, fontWeight: "900" },
  metricValue: { color: colors.ink, fontFamily: "monospace", fontSize: 17, fontWeight: "900", marginTop: 4 },
  queueMessage: { backgroundColor: colors.tealSoft, borderRadius: 12, color: colors.tealDark, fontSize: 13, fontWeight: "900", lineHeight: 20, marginTop: 10, padding: 10 },
  queueWarning: { backgroundColor: colors.amberSoft, color: "#92400e" },
  timeline: { gap: 8, marginTop: 12 },
  stepRow: { alignItems: "center", borderColor: colors.creamBorder, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 48, paddingHorizontal: 10 },
  stepActiveRow: { backgroundColor: colors.amberSoft, borderColor: "#f8d27b" },
  stepIcon: { alignItems: "center", backgroundColor: colors.creamStrong, borderRadius: 10, height: 32, justifyContent: "center", width: 32 },
  stepIconActive: { backgroundColor: colors.tealSoft },
  stepText: { color: colors.muted, flex: 1, fontWeight: "800" },
  stepTextActive: { color: colors.ink, fontWeight: "900" },
  service: { borderTopColor: colors.creamBorder, borderTopWidth: 1, gap: 4, paddingVertical: 10 },
  serviceName: { color: colors.ink, fontSize: 15, fontWeight: "900" },
});
