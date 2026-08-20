import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import type { Registration } from "@anphu/patient-domain";
import { formatDateTime } from "@anphu/patient-domain";
import { getRegistrations } from "@/lib/portal-api";
import { Body, Card, EmptyState, H1, Mono, Screen, SecondaryButton } from "@/ui/components";
import { colors } from "@/ui/theme";

export default function RegistrationsScreen() {
  const [items, setItems] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    setLoading(true);
    setMessage("");
    try {
      setItems(await getRegistrations());
    } catch {
      setMessage("Chưa tải được lịch sử đăng ký. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }
  useFocusEffect(useCallback(() => { void load(); }, []));
  return <Screen nav><ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
    <View style={styles.heading}><H1>Lịch sử đăng ký</H1><Body>Theo dõi các lượt đăng ký khám của hồ sơ đang xem.</Body></View>
    {message ? <Card tone="soft"><Body>{message}</Body></Card> : null}
    {items.length ? items.map((item) => <Card key={item.id}><View style={styles.row}><View style={{ flex: 1, gap: 4 }}><Text style={styles.title}>{item.departmentName || "Lượt đăng ký khám"}</Text><Mono>{formatDateTime(item.registeredAt)}</Mono><Body>{item.reason || "Không ghi nhận lý do khám"}</Body>{item.ticketNumber ? <Mono>STT: {item.ticketNumber}</Mono> : null}</View><Text style={styles.status}>{item.status || "Chưa ghi nhận"}</Text></View></Card>) : <EmptyState text={loading ? "Đang tải dữ liệu..." : "Chưa có lịch sử đăng ký."} />}
    <SecondaryButton onPress={() => router.push("/dashboard")}>Về dashboard</SecondaryButton>
  </ScrollView></Screen>;
}
const styles = StyleSheet.create({ container: { gap: 14, padding: 16 }, heading: { gap: 5 }, row: { flexDirection: "row", gap: 10 }, title: { color: colors.ink, fontSize: 16, fontWeight: "900" }, status: { color: colors.teal, fontSize: 12, fontWeight: "900", maxWidth: 90, textAlign: "right" } });
