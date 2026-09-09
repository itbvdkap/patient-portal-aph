import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { formatDate, formatDateTime, normalizeDisplayText } from "@anphu/patient-domain";
import type {
  Appointment,
  ImagingResult,
  LabResult,
  Prescription,
  Visit,
} from "@anphu/patient-domain";
import {
  getAppointments,
  getCurrentSession,
  getImagingResults,
  getLabResults,
  getPrescriptions,
  getVisits,
} from "@/lib/portal-api";
import {
  Badge,
  Body,
  Card,
  EmptyState,
  H1,
  H2,
  Mono,
  Screen,
  SecondaryButton,
} from "@/ui/components";
import { colors } from "@/ui/theme";

type MedicalType =
  "health" | "visits" | "labs" | "imaging" | "prescriptions" | "appointments";
type MedicalItem =
  Visit | LabResult | ImagingResult | Prescription | Appointment;

const titles: Record<MedicalType, string> = {
  health: "Hồ sơ sức khỏe",
  visits: "Lịch sử khám",
  labs: "Xét nghiệm",
  imaging: "Chẩn đoán hình ảnh",
  prescriptions: "Đơn thuốc",
  appointments: "Lịch hẹn",
};

export default function MedicalListScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const type = normalizeType(params.type);
  const [items, setItems] = useState<MedicalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const title = titles[type];

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
      const data = await fetchByType(type);
      setItems(data);
    } catch {
      setMessage("Chưa tải được dữ liệu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [type]),
  );

  const groupedItems = useMemo(() => items.slice(0, 50), [items]);
  const labGroups = useMemo(() => groupLabs(groupedItems as LabResult[]), [groupedItems]);

  return (
    <Screen nav>
      <ScrollView
        contentContainerStyle={{ gap: 12, padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} />
        }
      >
        <View style={styles.heading}>
          <H1>{title}</H1>
          <Body>{type === "health" ? "Trung tâm hồ sơ y tế: khám, xét nghiệm, CĐHA, thuốc, BHYT và theo dõi." : "Dữ liệu lấy từ portal API theo hồ sơ đang xem."}</Body>
        </View>

        {message ? (
          <Card tone="soft">
            <Body>{message}</Body>
          </Card>
        ) : null}

        {type === "health" ? (
          <HealthHub />
        ) : groupedItems.length ? (
          type === "prescriptions" ? (
            <PrescriptionSections items={groupedItems as Prescription[]} />
          ) : type === "labs" ? (
            <LabSections groups={labGroups} />
          ) : (
            groupedItems.map((item, index) => (
              <MedicalCard key={itemKey(item, index)} item={item} type={type} />
            ))
          )
        ) : (
          <EmptyState
            text={
              loading ? "Đang tải dữ liệu..." : "Chưa có dữ liệu để hiển thị."
            }
          />
        )}

        <SecondaryButton onPress={() => router.push("/dashboard")}>
          Về dashboard
        </SecondaryButton>
      </ScrollView>
    </Screen>
  );
}

function MedicalCard({ item, type }: { item: MedicalItem; type: MedicalType }) {
  if (type === "visits") {
    const visit = item as Visit;
    return <Pressable onPress={() => router.push(`/medical/visit/${visit.id}`)}><Card>
        <View style={styles.cardHeader}>
          <IconBox name="hospital-building" color={colors.teal} background={colors.tealSoft} />
          <View style={{ flex: 1 }}>
        <H2>{formatDate(visit.visitDate)}</H2>
        <Mono>{normalizeDisplayText(visit.departmentName) || "Chưa ghi nhận phòng"}</Mono>
          </View>
        </View>
        <Body>{normalizeDisplayText(visit.primaryDiagnosis) || "Chưa ghi nhận chẩn đoán"}</Body>
        <Text style={styles.openLink}>Xem chi tiết</Text>
      </Card></Pressable>;
  }

  if (type === "imaging") {
    const imaging = item as ImagingResult;
    return (
      <Card>
        <View style={styles.cardHeader}>
          <IconBox name="image-search-outline" color={colors.blue} background={colors.blueSoft} />
          <View style={{ flex: 1 }}>
            <H2>{normalizeDisplayText(imaging.techniqueName)}</H2>
            <Mono>{formatDate(imaging.date)}</Mono>
          </View>
        </View>
        <Body>{normalizeDisplayText(imaging.conclusion) || "Chưa ghi nhận kết luận"}</Body>
      </Card>
    );
  }

  if (type === "prescriptions") {
    const prescription = item as Prescription;
    return (
      <Card>
        <View style={styles.cardHeader}>
          <IconBox name="pill" color={colors.rose} background={colors.roseSoft} />
          <View style={{ flex: 1 }}>
            <H2>{formatDate(prescription.prescribedAt)}</H2>
            <Mono>{normalizeDisplayText(prescription.doctorName) || "Chưa ghi nhận bác sĩ"}</Mono>
          </View>
        </View>
        <Body>{prescription.items.length} thuốc</Body>
      </Card>
    );
  }

  const appointment = item as Appointment;
  return (
    <Card>
      <View style={styles.cardHeader}>
        <IconBox name="calendar-clock" color={colors.rose} background={colors.roseSoft} />
        <View style={{ flex: 1 }}>
          <H2>{formatDateTime(appointment.appointmentDate)}</H2>
          <Mono>{normalizeDisplayText(appointment.departmentName) || "Chưa ghi nhận khoa"}</Mono>
        </View>
      </View>
      <Body>
        {normalizeDisplayText(appointment.content || appointment.doctorName) || "Lịch hẹn khám"}
      </Body>
    </Card>
  );
}

function HealthHub() {
  const cards = [
    { label: "Lịch sử khám", meta: "Chẩn đoán, phòng khám", target: "/medical/visits", icon: "clipboard-pulse-outline", color: colors.teal, bg: colors.tealSoft },
    { label: "Xét nghiệm", meta: "4 cột, bất thường", target: "/medical/labs", icon: "heart-pulse", color: colors.violet, bg: colors.violetSoft },
    { label: "CĐHA", meta: "Siêu âm, X-quang", target: "/medical/imaging", icon: "image-search-outline", color: colors.blue, bg: colors.blueSoft },
    { label: "Đơn thuốc", meta: "BHYT và dịch vụ", target: "/medical/prescriptions", icon: "pill", color: colors.rose, bg: colors.roseSoft },
    { label: "BHYT điện tử", meta: "Thẻ và hiệu lực", target: "/insurance", icon: "shield-check-outline", color: colors.teal, bg: colors.tealSoft },
    { label: "Lịch hẹn", meta: "Nhắc tái khám", target: "/medical/appointments", icon: "calendar-clock", color: colors.rose, bg: colors.roseSoft },
    { label: "Lịch sử đăng ký", meta: "STT, phòng khám", target: "/registrations", icon: "calendar-plus", color: colors.amber, bg: colors.amberSoft },
    { label: "Theo dõi sức khỏe", meta: "Xu hướng chỉ số", target: "/medical/labs", icon: "chart-line", color: colors.lime, bg: colors.limeSoft },
  ];

  return (
    <View style={styles.hubWrap}>
      <View style={styles.hubHero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hubEyebrow}>HỒ SƠ Y TẾ</Text>
          <Text style={styles.hubHeroTitle}>Theo dõi sức khỏe</Text>
          <Text style={styles.hubHeroText}>Chọn nhanh nhóm dữ liệu cần xem.</Text>
        </View>
        <MaterialCommunityIcons name="heart-pulse" size={38} color={colors.cream} />
      </View>
      <View style={styles.hubGrid}>
        {cards.map((item) => (
          <Pressable key={item.target} onPress={() => router.push(item.target)} style={styles.hubCard}>
            <View style={[styles.tileIcon, { backgroundColor: item.bg }]}>
              <MaterialCommunityIcons name={item.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={24} color={item.color} />
            </View>
            <Text style={styles.hubTitle}>{item.label}</Text>
            <Text style={styles.hubMeta}>{item.meta}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function IconBox({
  name,
  color,
  background,
}: {
  name: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  background: string;
}) {
  return (
    <View style={[styles.tileIcon, { backgroundColor: background }]}>
      <MaterialCommunityIcons name={name} size={22} color={color} />
    </View>
  );
}

function PrescriptionSections({ items }: { items: Prescription[] }) {
  const bhyt = items.filter((item) =>
    /bhyt|bảo hiểm/i.test(item.payerType || ""),
  );
  const service = items.filter(
    (item) => !/bhyt|bảo hiểm/i.test(item.payerType || ""),
  );
  return (
    <View style={{ gap: 12 }}>
      {bhyt.length ? (
        <PrescriptionSection title="Đơn thuốc BHYT" items={bhyt} />
      ) : null}
      {service.length ? (
        <PrescriptionSection title="Đơn thuốc dịch vụ" items={service} />
      ) : null}
    </View>
  );
}

type LabGroup = { key: string; title: string; performedAt: string; items: LabResult[] };

function groupLabs(items: LabResult[]): LabGroup[] {
  const groups = new Map<string, LabGroup>();
  for (const item of items) {
    const key = `${item.visitId}:${item.serviceName || "Xét nghiệm"}:${item.performedAt}`;
    const group = groups.get(key) || { key, title: item.serviceName || "Phiếu xét nghiệm", performedAt: item.performedAt, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return Array.from(groups.values());
}

function LabSections({ groups }: { groups: LabGroup[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return <View style={{ gap: 12 }}>{groups.map((group) => <Card key={group.key}>
    <Pressable onPress={() => setOpen(open === group.key ? null : group.key)} style={styles.labSummary}>
      <View style={{ flex: 1 }}><H2>{normalizeDisplayText(group.title)}</H2><Mono>{formatDateTime(group.performedAt)} · {group.items.length} chỉ số</Mono></View>
      <Text style={styles.openLink}>{open === group.key ? "Thu gọn" : "Xem"}</Text>
    </Pressable>
    {open === group.key ? <View><View style={styles.labHeader}><Text style={styles.labHeaderText}>Tên chỉ số</Text><Text style={styles.labHeaderText}>Kết quả</Text><Text style={styles.labHeaderText}>Tham chiếu</Text><Text style={styles.labHeaderText}>Đánh giá</Text></View>{group.items.map((lab) => <View key={lab.id} style={styles.labRow}><Text style={styles.labName}>{normalizeDisplayText(lab.testName)}</Text><Text style={styles.labValue}>{String(lab.result)} {normalizeDisplayText(lab.unit)}</Text><Text style={styles.labValue}>{normalizeDisplayText(lab.referenceRange) || "-"}</Text><Text style={[styles.labFlag, normalizeDisplayText(lab.flag) === "Bình thường" && styles.normal]}>{normalizeDisplayText(lab.flag)}</Text></View>)}</View> : null}
  </Card>)}</View>;
}

function PrescriptionSection({
  title,
  items,
}: {
  title: string;
  items: Prescription[];
}) {
  return (
    <Card>
          <H2>{normalizeDisplayText(title)}</H2>
      {items.map((item) => (
        <View key={item.id} style={styles.prescription}>
          <Mono>
            {formatDate(item.prescribedAt)} ·{" "}
            {normalizeDisplayText(item.doctorName) || "Chưa ghi nhận bác sĩ"}
          </Mono>
          <Body>{item.items.length} thuốc</Body>
        </View>
      ))}
    </Card>
  );
}

async function fetchByType(type: MedicalType): Promise<MedicalItem[]> {
  if (type === "health") return [];
  if (type === "visits") return getVisits();
  if (type === "labs") return getLabResults();
  if (type === "imaging") return getImagingResults();
  if (type === "prescriptions") return getPrescriptions();
  return getAppointments();
}

function normalizeType(value: string | undefined): MedicalType {
  if (
    value === "health" ||
    value === "labs" ||
    value === "imaging" ||
    value === "prescriptions" ||
    value === "appointments"
  ) {
    return value;
  }

  return "visits";
}

function itemKey(item: MedicalItem, index: number) {
  return "id" in item && item.id ? item.id : String(index);
}

const styles = StyleSheet.create({
  heading: { gap: 6 },
  cardHeader: { alignItems: "center", flexDirection: "row", gap: 10, marginBottom: 8 },
  labHeader: {
    flexDirection: "row",
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eadcc8",
    paddingVertical: 8,
  },
  labHeaderText: {
    flex: 1,
    color: "#64748b",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  labRow: { flexDirection: "row", gap: 6, paddingVertical: 10 },
  labName: {
    flex: 1.5,
    color: "#17312f",
    fontSize: 12,
    fontWeight: "800",
  },
  labValue: {
    flex: 1,
    color: "#17312f",
    fontFamily: "monospace",
    fontSize: 11,
  },
  labFlag: {
    flex: 0.8,
    color: "#be123c",
    fontSize: 11,
    fontWeight: "900",
  },
  normal: { color: "#005b55" },
  prescription: {
    borderTopWidth: 1,
    borderTopColor: "#eadcc8",
    marginTop: 8,
    paddingTop: 8,
  },
  labSummary: { alignItems: "center", flexDirection: "row", gap: 8 },
  openLink: { color: colors.teal, fontSize: 12, fontWeight: "900", marginTop: 6 },
  hubWrap: { gap: 12 },
  hubHero: { alignItems: "center", backgroundColor: colors.teal, borderRadius: 20, flexDirection: "row", gap: 10, padding: 16 },
  hubEyebrow: { color: colors.tealSoft, fontSize: 11, fontWeight: "900" },
  hubHeroTitle: { color: colors.cream, fontSize: 23, fontWeight: "900", marginTop: 2 },
  hubHeroText: { color: colors.cream, fontSize: 13, fontWeight: "700", marginTop: 4 },
  hubGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  hubCard: {
    width: "48%",
    minHeight: 108,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.creamBorder,
    borderRadius: 14,
    backgroundColor: colors.white,
    padding: 12,
  },
  tileIcon: { alignItems: "center", borderRadius: 13, height: 44, justifyContent: "center", width: 44 },
  hubTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  hubMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", lineHeight: 18 },
});
