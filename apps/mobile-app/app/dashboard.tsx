import { useCallback, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import type {
  MobileSession,
  Patient,
  PatientSummary,
  TodayVisitStatus,
} from "@anphu/patient-domain";
import {
  getCurrentPatient,
  getCurrentSession,
  getPatientSummary,
  getTodayVisit,
  logout,
} from "@/lib/portal-api";
import {
  Body,
  Card,
  H1,
  H2,
  Mono,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "@/ui/components";
import { colors } from "@/ui/theme";

export default function DashboardScreen() {
  const [session, setSession] = useState<MobileSession | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [today, setToday] = useState<TodayVisitStatus | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const currentSession = await getCurrentSession();
    setSession(currentSession);

    if (!currentSession) {
      router.replace("/login");
      return;
    }

    if (!currentSession.currentMabn) {
      router.replace("/profiles");
      return;
    }

    const [currentPatient, patientSummary, todayVisit] = await Promise.all([
      getCurrentPatient(),
      getPatientSummary(),
      getTodayVisit(),
    ]);
    setPatient(currentPatient);
    setSummary(patientSummary);
    setToday(todayVisit);
    setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      void load();
    }, []),
  );

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  return (
    <Screen>
      <View style={styles.screenBody}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        >
          <View style={styles.header}>
            <View style={styles.logo}><Image source={{ uri: "https://anphucare.benhvienanphu.vn/logo-an-phu.jpg" }} style={styles.logoImage} /></View>
            <View style={styles.brand}><Text style={styles.brandName}>Bệnh viện Đa khoa An Phú</Text><Text style={styles.brandSub}>Cổng thông tin bệnh nhân</Text></View>
            <Pressable onPress={() => router.push("/account")} accessibilityLabel="Mở tài khoản"><Text style={styles.avatar}>{(patient?.fullName || "A").charAt(0)}</Text></Pressable>
          </View>

          <View style={styles.greeting}><Text style={styles.eyebrow}>XIN CHÀO</Text><Text style={styles.heroTitle}>{patient?.fullName || "An Phú Care"}</Text><Mono>Mã BN: {session?.currentMabn ?? "Chưa chọn"}</Mono></View>

          <Card tone={today?.hasActiveVisit ? "soft" : "plain"}>
            <View style={styles.cardHeading}><H2>Hôm nay</H2><Text style={styles.cardIcon}>+</Text></View>
            <Body>{today?.hasActiveVisit ? today.currentStepText : "Chưa ghi nhận lượt khám đang chờ hoặc đang khám hôm nay."}</Body>
            {today?.registration?.departmentName ? <Mono>{today.registration.departmentName}</Mono> : null}
            <View style={styles.actionRow}><PrimaryButton onPress={() => router.push("/today")}>Khám hôm nay</PrimaryButton><SecondaryButton onPress={() => router.push("/booking")}>Đăng ký khám</SecondaryButton></View>
          </Card>

          {patient?.insurance ? <Pressable onPress={() => router.push("/insurance")}><Card tone="teal"><Text style={styles.eyebrow}>THẺ BHYT ĐIỆN TỬ</Text><Text style={styles.walletTitle}>Bảo hiểm y tế</Text><Mono>{patient.insurance.cardNumber}</Mono><View style={styles.walletDates}><View><Text style={styles.walletLabel}>TỪ NGÀY</Text><Mono>{patient.insurance.validFrom}</Mono></View><View><Text style={styles.walletLabel}>ĐẾN NGÀY</Text><Mono>{patient.insurance.validTo}</Mono></View></View></Card></Pressable> : null}

          <View style={styles.shortcuts}>
            <Shortcut label="Đăng ký khám" target="/booking" />
            <Shortcut label="Lịch sử khám" count={summary?.visitsCount} target="/medical/visits" />
            <Shortcut label="Xét nghiệm" count={summary?.labResultsCount} target="/medical/labs" />
            <Shortcut label="Chẩn đoán hình ảnh" count={summary?.imagingResultsCount} target="/medical/imaging" />
            <Shortcut label="Đơn thuốc" count={summary?.prescriptionsCount} target="/medical/prescriptions" />
            <Shortcut label="Lịch hẹn" count={summary?.appointmentsCount} target="/medical/appointments" />
          </View>
          <PrimaryButton onPress={() => router.push("/profiles")}>Chọn hồ sơ đang xem</PrimaryButton>
          <SecondaryButton onPress={signOut}>Đăng xuất</SecondaryButton>
        </ScrollView>
        <TabBar />
      </View>
    </Screen>
  );
}

function Shortcut({ label, target, count }: { label: string; target: string; count?: number }) {
  return (
    <Pressable onPress={() => router.push(target)} style={styles.shortcut}>
      <Text style={styles.shortcutIcon}>{label === "Đăng ký khám" ? "+" : "•"}</Text><Text style={styles.shortcutText}>{label}</Text>{typeof count === "number" ? <Text style={styles.shortcutCount}>{count}</Text> : null}
    </Pressable>
  );
}

function TabBar() {
  return <View style={styles.tabBar}><Tab label="Trang chủ" target="/dashboard" active /><Tab label="Hôm nay" target="/today" /><Tab label="Lịch sử" target="/medical/visits" /><Tab label="Xét nghiệm" target="/medical/labs" /><Tab label="Tài khoản" target="/account" /></View>;
}

function Tab({ label, target, active = false }: { label: string; target: string; active?: boolean }) {
  return <Pressable onPress={() => router.push(target)} style={styles.tab}><Text style={[styles.tabDot, active && styles.tabDotActive]}>●</Text><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text></Pressable>;
}

function Progress({ current }: { current: string }) {
  const steps = [
    "Đăng ký",
    "Chờ khám",
    "Đang khám",
    "Cận lâm sàng",
    "Hoàn tất",
  ];
  const index = Math.max(
    0,
    steps.findIndex((step) =>
      current.toLowerCase().includes(step.toLowerCase()),
    ),
  );
  return (
    <View style={styles.progress}>
      {steps.map((step, itemIndex) => (
        <View key={step} style={styles.progressItem}>
          <View
            style={[
              styles.progressDot,
              itemIndex <= index && styles.progressDotActive,
            ]}
          />
          <Text
            style={[
              styles.progressLabel,
              itemIndex === index && styles.progressLabelActive,
            ]}
          >
            {step}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    padding: 16,
    paddingBottom: 28,
  },
  screenBody: { flex: 1 },
  header: { alignItems: "center", borderBottomColor: colors.creamBorder, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingBottom: 12 },
  logo: { alignItems: "center", backgroundColor: colors.teal, borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  logoImage: { borderRadius: 10, height: 36, width: 36 },
  brand: { flex: 1 },
  brandName: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  brandSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  avatar: { alignItems: "center", backgroundColor: colors.tealSoft, borderRadius: 18, color: colors.teal, fontSize: 17, fontWeight: "900", padding: 8 },
  greeting: { gap: 4, paddingVertical: 2 },
  eyebrow: {
    color: "#d9f4ef",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  heroTitle: {
    marginTop: 6,
    color: colors.cream,
    fontSize: 24,
    fontWeight: "900",
  },
  heroMeta: {
    marginTop: 8,
    color: colors.cream,
    fontFamily: "monospace",
    fontWeight: "800",
  },
  cardHeading: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  cardIcon: { alignItems: "center", backgroundColor: colors.tealSoft, borderRadius: 18, color: colors.teal, fontSize: 22, fontWeight: "900", height: 32, textAlign: "center", width: 32 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  walletTitle: { color: colors.cream, fontSize: 20, fontWeight: "900", marginVertical: 10 },
  walletDates: { flexDirection: "row", gap: 30, marginTop: 16 },
  walletLabel: { color: colors.tealSoft, fontSize: 10, fontWeight: "900", marginBottom: 4 },
  shortcuts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  shortcut: {
    minHeight: 92,
    width: "48%",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.creamBorder,
    borderRadius: 14,
    backgroundColor: colors.white,
    padding: 11,
  },
  shortcutIcon: { color: colors.teal, fontSize: 22, fontWeight: "900" },
  shortcutText: {
    color: colors.ink,
    fontWeight: "900",
  },
  shortcutCount: { color: colors.teal, fontFamily: "monospace", fontSize: 20, fontWeight: "900" },
  tabBar: { backgroundColor: colors.white, borderTopColor: colors.creamBorder, borderTopWidth: 1, flexDirection: "row", paddingBottom: 7, paddingTop: 8 },
  tab: { alignItems: "center", flex: 1, gap: 3 },
  tabDot: { color: colors.muted, fontSize: 11 },
  tabDotActive: { color: colors.teal },
  tabText: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  tabTextActive: { color: colors.teal, fontWeight: "900" },
  progress: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
  },
  progressItem: { flex: 1, alignItems: "center", gap: 5 },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.creamBorder,
  },
  progressDotActive: { backgroundColor: colors.teal },
  progressLabel: {
    color: colors.muted,
    fontSize: 10,
    textAlign: "center",
    fontWeight: "700",
  },
  progressLabelActive: { color: colors.teal, fontWeight: "900" },
});
