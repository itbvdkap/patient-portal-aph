import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import type { TodayVisitStatus } from "@anphu/patient-domain";
import { getCurrentSession, getTodayVisit } from "@/lib/portal-api";
import { Body, Card, EmptyState, H1, H2, Mono, Screen, SecondaryButton } from "@/ui/components";
import { colors } from "@/ui/theme";

const steps = ["Đăng ký", "Chờ khám", "Đang khám", "Cận lâm sàng", "Hoàn tất"];

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
      return;
    }
    if (!session.currentMabn) {
      router.replace("/profiles");
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

  useFocusEffect(useCallback(() => { void load(); }, []));
  const currentIndex = today?.hasActiveVisit ? stepIndex(today.currentStep) : -1;

  return (
    <Screen nav>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <View style={styles.heading}>
          <H1>Khám hôm nay</H1>
          <Body>Theo dõi lượt đăng ký và các chỉ định trong ngày.</Body>
        </View>
        {message ? <Card tone="soft"><Body>{message}</Body></Card> : null}
        {!today?.hasActiveVisit ? (
          <Card tone="soft">
            <H2>Chưa có lượt khám đang hoạt động</H2>
            <Body>Nếu bạn đã đăng ký khám, hãy kéo xuống để tải lại dữ liệu.</Body>
            <SecondaryButton onPress={() => router.push("/booking")}>Đăng ký khám</SecondaryButton>
          </Card>
        ) : (
          <>
            <Card tone="teal">
              <Text style={styles.eyebrow}>TRẠNG THÁI HIỆN TẠI</Text>
              <Text style={styles.status}>{today.currentStepText}</Text>
              {today.registration?.departmentName ? <Text style={styles.meta}>{today.registration.departmentName}</Text> : null}
              {today.registration?.ticketNumber ? <Mono>STT: {today.registration.ticketNumber}</Mono> : null}
            </Card>
            <Card>
              <H2>Tiến trình khám</H2>
              <View style={styles.progress}>{steps.map((step, index) => <View key={step} style={styles.progressItem}>
                <View style={[styles.dot, index <= currentIndex && styles.dotActive]} />
                <Text style={[styles.step, index === currentIndex && styles.stepActive]}>{step}</Text>
              </View>)}</View>
            </Card>
            <Card>
              <H2>Cận lâm sàng</H2>
              {today.services.length ? today.services.map((service) => <View key={service.id} style={styles.service}>
                <Text style={styles.serviceName}>{service.serviceName}</Text>
                <Mono>{service.status || "Đang xử lý"}</Mono>
              </View>) : <EmptyState text="Chưa có chỉ định cận lâm sàng." />}
            </Card>
          </>
        )}
        <SecondaryButton onPress={() => router.push("/dashboard")}>Về dashboard</SecondaryButton>
      </ScrollView>
    </Screen>
  );
}

function stepIndex(value: string) {
  const normalized = value.toLowerCase();
  const index = steps.findIndex((step) => normalized.includes(step.toLowerCase()));
  return index >= 0 ? index : 0;
}

const styles = StyleSheet.create({
  container: { gap: 14, padding: 16 },
  heading: { gap: 5 },
  eyebrow: { color: colors.tealSoft, fontSize: 11, fontWeight: "900" },
  status: { color: colors.cream, fontSize: 22, fontWeight: "900", marginTop: 6 },
  meta: { color: colors.cream, fontWeight: "800", marginVertical: 8 },
  progress: { flexDirection: "row", justifyContent: "space-between", gap: 4, marginTop: 16 },
  progressItem: { alignItems: "center", flex: 1, gap: 6 },
  dot: { backgroundColor: colors.creamBorder, borderRadius: 8, height: 16, width: 16 },
  dotActive: { backgroundColor: colors.teal },
  step: { color: colors.muted, fontSize: 10, fontWeight: "700", textAlign: "center" },
  stepActive: { color: colors.teal, fontWeight: "900" },
  service: { borderTopColor: colors.creamBorder, borderTopWidth: 1, gap: 4, paddingVertical: 10 },
  serviceName: { color: colors.ink, fontSize: 15, fontWeight: "800" },
});
