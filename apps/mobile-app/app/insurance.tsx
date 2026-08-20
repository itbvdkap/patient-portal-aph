import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import type { Patient } from "@anphu/patient-domain";
import { getCurrentPatient } from "@/lib/portal-api";
import { Body, Card, EmptyState, H1, Mono, Screen, SecondaryButton } from "@/ui/components";
import { colors } from "@/ui/theme";

export default function InsuranceScreen() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    try { setPatient(await getCurrentPatient()); } catch { setPatient(null); }
    setLoading(false);
  }
  useFocusEffect(useCallback(() => { void load(); }, []));
  const insurance = patient?.insurance;

  return <Screen nav><ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
    <View style={styles.heading}><H1>BHYT điện tử</H1><Body>Thông tin thẻ của hồ sơ đang xem.</Body></View>
    {insurance ? <Card tone="teal">
      <Text style={styles.eyebrow}>THẺ BẢO HIỂM Y TẾ</Text>
      <Text style={styles.cardTitle}>{insurance.status}</Text>
      <Mono>{insurance.cardNumber}</Mono>
      <View style={styles.dates}><View><Text style={styles.label}>TỪ NGÀY</Text><Mono>{insurance.validFrom}</Mono></View><View><Text style={styles.label}>ĐẾN NGÀY</Text><Mono>{insurance.validTo}</Mono></View></View>
      <Text style={styles.note}>Mã quyền lợi: {insurance.benefitCode || "Chưa ghi nhận"}</Text>
    </Card> : <EmptyState text="Chưa ghi nhận thông tin thẻ BHYT." />}
    <Card><Text style={styles.section}>Hồ sơ đang xem</Text><Mono>{patient?.fullName || "Chưa chọn hồ sơ"}</Mono><Mono>Mã BN: {patient?.hisPatientCode || "-"}</Mono></Card>
    <SecondaryButton onPress={() => router.push("/profiles")}>Đổi hồ sơ đang xem</SecondaryButton>
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  container: { gap: 14, padding: 16 }, heading: { gap: 5 },
  eyebrow: { color: colors.tealSoft, fontSize: 11, fontWeight: "900" },
  cardTitle: { color: colors.cream, fontSize: 20, fontWeight: "900", marginVertical: 12 },
  dates: { flexDirection: "row", gap: 28, marginTop: 20 },
  label: { color: colors.tealSoft, fontSize: 10, fontWeight: "900", marginBottom: 5 },
  note: { color: colors.cream, fontWeight: "700", marginTop: 18 },
  section: { color: colors.ink, fontSize: 17, fontWeight: "900", marginBottom: 8 },
});
