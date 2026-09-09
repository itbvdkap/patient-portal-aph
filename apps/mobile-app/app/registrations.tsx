import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Registration } from "@anphu/patient-domain";
import { formatDateTime } from "@anphu/patient-domain";
import { getCurrentSession, getRegistrations } from "@/lib/portal-api";
import { Badge, Body, Card, EmptyState, H1, Mono, Screen } from "@/ui/components";
import { colors } from "@/ui/theme";

type Filter = "all" | "waiting" | "done";

export default function RegistrationsScreen() {
  const [items, setItems] = useState<Registration[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
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

    try {
      setItems(await getRegistrations());
    } catch {
      setMessage("Chưa tải được lịch sử đăng ký. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      void load();
    }, []),
  );

  const counts = useMemo(() => ({
    all: items.length,
    waiting: items.filter((item) => !isDone(item)).length,
    done: items.filter(isDone).length,
  }), [items]);
  const visible = items.filter((item) => filter === "all" || (filter === "done" ? isDone(item) : !isDone(item)));

  return (
    <Screen nav>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <View style={styles.heading}>
          <View style={{ flex: 1 }}>
            <H1>Lịch sử đăng ký</H1>
            <Body>Theo dõi lượt tiếp đón, số thứ tự và phòng khám.</Body>
          </View>
          <Pressable onPress={() => router.push("/booking")} style={styles.addButton}>
            <MaterialCommunityIcons name="calendar-plus" size={20} color={colors.white} />
          </Pressable>
        </View>

        {message ? (
          <Card tone="soft">
            <Body>{message}</Body>
          </Card>
        ) : null}

        <View style={styles.filters}>
          <FilterButton label={`Tất cả ${counts.all}`} active={filter === "all"} onPress={() => setFilter("all")} />
          <FilterButton label={`Chờ ${counts.waiting}`} active={filter === "waiting"} onPress={() => setFilter("waiting")} />
          <FilterButton label={`Đã khám ${counts.done}`} active={filter === "done"} onPress={() => setFilter("done")} />
        </View>

        {visible.length ? (
          visible.map((item) => <RegistrationCard key={item.id} item={item} />)
        ) : (
          <EmptyState text={loading ? "Đang tải dữ liệu..." : "Chưa có lượt đăng ký phù hợp."} />
        )}
      </ScrollView>
    </Screen>
  );
}

function RegistrationCard({ item }: { item: Registration }) {
  const done = isDone(item);
  return (
    <Pressable onPress={() => router.push("/today")} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card>
        <View style={styles.cardTop}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name={done ? "check-circle-outline" : "clock-outline"} size={22} color={done ? colors.teal : "#b85c00"} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.departmentName || "Chưa ghi nhận phòng khám"}</Text>
            {item.branchName ? <Text style={styles.detail}>{item.branchName}</Text> : null}
            <Mono>{formatDateTime(item.registeredAt)}</Mono>
          </View>
          <Badge tone={done ? "teal" : "amber"}>{item.status || "Chưa ghi nhận"}</Badge>
        </View>

        <View style={styles.metrics}>
          <Metric label="STT khám" value={item.ticketNumber || "Chưa có"} />
          <Metric label="Mã phòng" value={item.departmentCode || "Chưa có"} />
        </View>

        {item.reason || item.doctorName || item.payerTypeName ? (
          <Text style={styles.detail}>
            {[item.reason, item.doctorName, item.payerTypeName].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

function FilterButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.filterButton, active && styles.filterButtonActive]}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
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

function isDone(item: Registration) {
  return item.status === "Đã khám" || item.status?.toLowerCase().includes("hoàn tất");
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16, paddingBottom: 28 },
  heading: { alignItems: "center", flexDirection: "row", gap: 10 },
  addButton: { alignItems: "center", backgroundColor: colors.teal, borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterButton: { backgroundColor: colors.white, borderColor: colors.creamBorder, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  filterButtonActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  filterText: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  filterTextActive: { color: colors.white },
  pressed: { opacity: 0.75 },
  cardTop: { alignItems: "center", flexDirection: "row", gap: 10 },
  iconBox: { alignItems: "center", backgroundColor: colors.amberSoft, borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  title: { color: colors.ink, fontSize: 16, fontWeight: "900", marginBottom: 3 },
  metrics: { flexDirection: "row", gap: 8, marginTop: 12 },
  metric: { backgroundColor: colors.tealPale, borderColor: "#d3ece7", borderRadius: 12, borderWidth: 1, flex: 1, padding: 10 },
  metricLabel: { color: colors.muted, fontSize: 11, fontWeight: "900" },
  metricValue: { color: colors.ink, fontFamily: "monospace", fontSize: 15, fontWeight: "900", marginTop: 3 },
  detail: { color: colors.muted, fontSize: 13, fontWeight: "700", lineHeight: 19, marginTop: 10 },
});
