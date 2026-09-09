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
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
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
} from "@/lib/portal-api";
import {
  Badge,
  Body,
  Card,
  Mono,
  Screen,
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

  return (
    <Screen nav>
      <View style={styles.screenBody}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        >
          <View style={styles.header}>
            <View style={styles.logo}><Image source={{ uri: "https://anphucare.benhvienanphu.vn/logo-an-phu.jpg" }} style={styles.logoImage} /></View>
            <View style={styles.brand}><Text style={styles.brandName}>Bệnh viện Đa khoa An Phú</Text><Text style={styles.brandSub}>Cổng thông tin bệnh nhân</Text></View>
            <Pressable onPress={() => router.push("/account")} accessibilityLabel="Mở tài khoản" style={styles.avatar}>
              <MaterialCommunityIcons name="account-outline" size={22} color={colors.teal} />
            </Pressable>
          </View>

          <Card tone="soft">
            <View style={styles.profileHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileEyebrow}>HỒ SƠ ĐANG XEM</Text>
                <Text style={styles.profileName}>{patient?.fullName || "Chưa chọn hồ sơ"}</Text>
                <Mono>BN {session?.currentMabn ?? "Chưa chọn"}</Mono>
              </View>
              <Pressable onPress={() => router.push("/profiles")} style={styles.switchProfile}>
                <Text style={styles.switchProfileText}>Đổi hồ sơ</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={colors.teal} />
              </Pressable>
            </View>
          </Card>

          <Card tone={today?.hasActiveVisit ? "soft" : "plain"}>
            <View style={styles.todayHeading}>
              <View style={styles.todayIcon}><MaterialCommunityIcons name="stethoscope" size={22} color={colors.teal} /></View>
              <View style={styles.todayCopy}><Text style={styles.todayTitle}>Hôm nay</Text><Body>{today?.hasActiveVisit ? today.currentStepText : "Chưa có lượt khám đang chờ hoặc đang khám."}</Body></View>
            </View>
            {today?.registration?.departmentName ? <Mono>{today.registration.departmentName}</Mono> : null}
            <Pressable onPress={() => router.push(today?.hasActiveVisit ? "/notifications" : "/booking")} style={styles.todayAction}>
              <Text style={styles.todayActionText}>{today?.hasActiveVisit ? "Xem trong thông báo" : "Đăng ký khám"}</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color={colors.white} />
            </Pressable>
          </Card>

          {patient?.insurance ? <Pressable onPress={() => router.push("/insurance")}><Card tone="teal"><View style={styles.walletCompact}><View style={styles.walletIcon}><MaterialCommunityIcons name="shield-check-outline" size={20} color={colors.cream} /></View><View style={{ flex: 1 }}><Text style={styles.eyebrow}>VÍ SỨC KHỎE</Text><Text style={styles.walletTitle}>Thẻ BHYT điện tử</Text></View><Badge tone={patient.insurance.status === "Còn hiệu lực" ? "teal" : "amber"}>{patient.insurance.status}</Badge><MaterialCommunityIcons name="chevron-right" size={20} color={colors.cream} /></View></Card></Pressable> : null}

          <View style={styles.shortcuts}>
            <Shortcut label="Đăng ký khám" meta="Đặt lịch nhanh" target="/booking" icon="calendar-plus" tone="amber" />
            <Shortcut label="Lịch sử khám" meta="Lần khám" count={summary?.visitsCount} target="/medical/visits" icon="clipboard-text-outline" tone="teal" />
            <Shortcut label="Xét nghiệm" meta="Phiếu kết quả" count={summary?.labResultsCount} target="/medical/labs" icon="heart-pulse" tone="violet" />
            <Shortcut label="CĐHA" meta="Kết quả" count={summary?.imagingResultsCount} target="/medical/imaging" icon="file-document-outline" tone="blue" />
            <Shortcut label="Đơn thuốc" meta="Đơn thuốc" count={summary?.prescriptionsCount} target="/medical/prescriptions" icon="pill" tone="rose" />
            <Shortcut label="Lịch hẹn" meta="Lịch sắp tới" count={summary?.appointmentsCount} target="/medical/appointments" icon="calendar-clock" tone="rose" />
            <Shortcut label="Thông báo" meta="Việc cần chú ý" target="/notifications" icon="bell-outline" tone="amber" />
            <Shortcut label="Theo dõi" meta="Sức khỏe" target="/medical/health" icon="chart-line" tone="lime" />
            <Shortcut label="Lịch sử đăng ký" meta="Lượt tiếp đón" target="/registrations" icon="clipboard-clock-outline" tone="teal" />
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}

type ShortcutTone = "teal" | "amber" | "blue" | "violet" | "rose" | "lime";

function Shortcut({ label, meta, target, count, icon, tone }: { label: string; meta: string; target: string; count?: number; icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; tone: ShortcutTone }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${typeof count === "number" ? `, ${count} ${meta.toLowerCase()}` : ""}`}
      onPress={() => router.push(target)}
      style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]}
    >
      <View style={styles.shortcutTop}>
        <View style={[styles.shortcutIcon, styles[`shortcutIcon_${tone}`]]}><MaterialCommunityIcons name={icon} size={21} color={shortcutColors[tone]} /></View>
        {typeof count === "number" ? <View style={styles.countBadge}><Text style={styles.countBadgeText}>{count}</Text></View> : null}
      </View>
      <Text style={styles.shortcutText}>{label}</Text>
      <Text style={styles.shortcutMeta}>{typeof count === "number" ? `${count} ${meta.toLowerCase()}` : meta}</Text>
    </Pressable>
  );
}

const shortcutColors: Record<ShortcutTone, string> = {
  teal: colors.teal,
  amber: "#b85c00",
  blue: colors.blue,
  violet: colors.violet,
  rose: colors.rose,
  lime: colors.lime,
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
    padding: 14,
    paddingBottom: 28,
  },
  screenBody: { flex: 1 },
  header: { alignItems: "center", flexDirection: "row", gap: 10, minHeight: 54 },
  logo: { alignItems: "center", borderColor: colors.creamBorder, borderRadius: 12, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  logoImage: { borderRadius: 9, height: 36, width: 36 },
  brand: { flex: 1 },
  brandName: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  brandSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  avatar: { alignItems: "center", backgroundColor: colors.tealSoft, borderRadius: 18, height: 38, justifyContent: "center", width: 38 },
  profileHeader: { alignItems: "center", flexDirection: "row", gap: 10 },
  profileEyebrow: { color: colors.teal, fontSize: 11, fontWeight: "900" },
  profileName: { color: colors.ink, fontSize: 20, fontWeight: "900", marginVertical: 4 },
  switchProfile: { alignItems: "center", borderColor: "#cae6e1", borderRadius: 10, borderWidth: 1, backgroundColor: colors.white, flexDirection: "row", paddingHorizontal: 10, paddingVertical: 9 },
  switchProfileText: { color: colors.teal, fontSize: 12, fontWeight: "900" },
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
  todayHeading: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  todayIcon: { alignItems: "center", backgroundColor: colors.tealSoft, borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  todayCopy: { flex: 1, gap: 2 },
  todayTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  todayAction: { alignItems: "center", backgroundColor: colors.teal, borderRadius: 10, flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 12, minHeight: 42 },
  todayActionText: { color: colors.white, fontSize: 14, fontWeight: "900" },
  walletCompact: { alignItems: "center", flexDirection: "row", gap: 10 },
  walletIcon: { alignItems: "center", borderColor: "rgba(255,255,255,0.25)", borderRadius: 10, borderWidth: 1, height: 36, justifyContent: "center", width: 36 },
  walletTitle: { color: colors.cream, fontSize: 18, fontWeight: "900", marginTop: 4 },
  walletDates: { flexDirection: "row", gap: 30, marginTop: 16 },
  walletLabel: { color: colors.tealSoft, fontSize: 10, fontWeight: "900", marginBottom: 4 },
  shortcuts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  shortcut: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 112,
    borderWidth: 1,
    borderColor: colors.creamBorder,
    borderRadius: 14,
    backgroundColor: colors.white,
    padding: 12,
  },
  shortcutPressed: { opacity: 0.72 },
  shortcutTop: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  shortcutIcon: { alignItems: "center", borderRadius: 10, height: 38, justifyContent: "center", width: 38 },
  shortcutIcon_teal: { backgroundColor: colors.tealSoft },
  shortcutIcon_amber: { backgroundColor: colors.amberSoft },
  shortcutIcon_blue: { backgroundColor: colors.blueSoft },
  shortcutIcon_violet: { backgroundColor: colors.violetSoft },
  shortcutIcon_rose: { backgroundColor: colors.roseSoft },
  shortcutIcon_lime: { backgroundColor: colors.limeSoft },
  shortcutText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
    marginTop: 10,
  },
  shortcutMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 3 },
  countBadge: { backgroundColor: colors.creamStrong, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  countBadgeText: { color: colors.ink, fontFamily: "monospace", fontSize: 11, fontWeight: "900" },
});
