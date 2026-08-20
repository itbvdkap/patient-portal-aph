import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
  Body,
  Card,
  EmptyState,
  H1,
  H2,
  Mono,
  Screen,
  SecondaryButton,
} from "@/ui/components";

type MedicalType =
  "visits" | "labs" | "imaging" | "prescriptions" | "appointments";
type MedicalItem =
  Visit | LabResult | ImagingResult | Prescription | Appointment;

const titles: Record<MedicalType, string> = {
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
        <View style={{ gap: 6 }}>
          <H1>{title}</H1>
          <Body>Dữ liệu lấy từ portal API sau khi chọn hồ sơ đang xem.</Body>
        </View>

        {message ? (
          <Card tone="soft">
            <Body>{message}</Body>
          </Card>
        ) : null}

        {groupedItems.length ? (
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
        <H2>{formatDate(visit.visitDate)}</H2>
        <Mono>{normalizeDisplayText(visit.departmentName) || "Chưa ghi nhận phòng"}</Mono>
        <Body>{normalizeDisplayText(visit.primaryDiagnosis) || "Chưa ghi nhận chẩn đoán"}</Body>
        <Text style={styles.openLink}>Xem chi tiết →</Text>
      </Card></Pressable>;
  }

  if (type === "imaging") {
    const imaging = item as ImagingResult;
    return (
      <Card>
        <H2>{normalizeDisplayText(imaging.techniqueName)}</H2>
        <Mono>{formatDate(imaging.date)}</Mono>
        <Body>{normalizeDisplayText(imaging.conclusion) || "Chưa ghi nhận kết luận"}</Body>
      </Card>
    );
  }

  if (type === "prescriptions") {
    const prescription = item as Prescription;
    return (
      <Card>
        <H2>{formatDate(prescription.prescribedAt)}</H2>
        <Mono>{normalizeDisplayText(prescription.doctorName) || "Chưa ghi nhận bác sĩ"}</Mono>
        <Body>{prescription.items.length} thuốc</Body>
      </Card>
    );
  }

  const appointment = item as Appointment;
  return (
    <Card>
      <H2>{formatDateTime(appointment.appointmentDate)}</H2>
      <Mono>{normalizeDisplayText(appointment.departmentName) || "Chưa ghi nhận khoa"}</Mono>
      <Body>
        {normalizeDisplayText(appointment.content || appointment.doctorName) || "Lịch hẹn khám"}
      </Body>
    </Card>
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
  if (type === "visits") return getVisits();
  if (type === "labs") return getLabResults();
  if (type === "imaging") return getImagingResults();
  if (type === "prescriptions") return getPrescriptions();
  return getAppointments();
}

function normalizeType(value: string | undefined): MedicalType {
  if (
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

const styles = {
  labHeader: {
    flexDirection: "row" as const,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eadcc8",
    paddingVertical: 8,
  },
  labHeaderText: {
    flex: 1,
    color: "#64748b",
    fontSize: 10,
    fontWeight: "900" as const,
    textTransform: "uppercase" as const,
  },
  labRow: { flexDirection: "row" as const, gap: 6, paddingVertical: 10 },
  labName: {
    flex: 1.5,
    color: "#17312f",
    fontSize: 12,
    fontWeight: "800" as const,
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
    fontWeight: "900" as const,
  },
  normal: { color: "#005b55" },
  prescription: {
    borderTopWidth: 1,
    borderTopColor: "#eadcc8",
    marginTop: 8,
    paddingTop: 8,
  },
  labSummary: { alignItems: "center" as const, flexDirection: "row" as const, gap: 8 },
  openLink: { color: "#005b55", fontSize: 12, fontWeight: "900" as const, marginTop: 6 },
};
