import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { formatDate, formatDateTime } from "@anphu/patient-domain";
import type { VisitDetail } from "@anphu/patient-domain";
import { getVisitDetail } from "@/lib/portal-api";
import { Body, Card, EmptyState, H1, H2, Mono, Screen, SecondaryButton } from "@/ui/components";
import { colors } from "@/ui/theme";

export default function VisitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  useEffect(() => { if (id) void getVisitDetail(id).then(setVisit); }, [id]);
  if (!visit) return <Screen nav><View style={styles.loading}><Body>Đang tải chi tiết lần khám...</Body></View></Screen>;
  return <Screen nav><ScrollView contentContainerStyle={styles.container}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>← Quay lại lịch sử khám</Text></Pressable>
    <View style={styles.heading}><H1>Chi tiết lần khám</H1><Body>{formatDateTime(visit.visitDate)} · {visit.departmentName || "Tiếp đón/KCB"}</Body></View>
    <Card><H2>Tổng quan</H2><Info label="Phòng" value={visit.departmentName} /><Info label="Bác sĩ" value={visit.doctorName} /><Info label="Mã lượt" value={visit.hisVisitId} /><Info label="Hẹn tái khám" value={visit.followUpDate ? formatDate(visit.followUpDate) : "Chưa ghi nhận"} /></Card>
    <Card><H2>Chẩn đoán</H2><Info label="CD ra viện" value={visit.primaryDiagnosis} />{visit.secondaryDiagnosis ? <Info label="Chẩn đoán kèm theo" value={visit.secondaryDiagnosis} /> : null}<Body>{visit.notes || "Chưa có ghi chú."}</Body></Card>
    {visit.vitalSigns && <Card><H2>Dấu hiệu sinh tồn</H2><View style={styles.grid}>{[['Huyết áp',visit.vitalSigns.bloodPressure],['Mạch',visit.vitalSigns.pulse ? `${visit.vitalSigns.pulse} lần/phút` : ""],['Nhiệt độ',visit.vitalSigns.temperature ? `${visit.vitalSigns.temperature}°C` : ""],['Cân nặng',visit.vitalSigns.weight ? `${visit.vitalSigns.weight} kg` : ""],['Chiều cao',visit.vitalSigns.height ? `${visit.vitalSigns.height} cm` : ""],['BMI',visit.vitalSigns.bmi ? String(visit.vitalSigns.bmi) : ""]].map(([label,value]) => value ? <Info key={label} label={label} value={value} /> : null)}</View></Card>}
    <Card><H2>Chỉ định</H2>{visit.services.length ? visit.services.map((service) => <View key={service.id} style={styles.item}><Text style={styles.itemTitle}>{service.serviceName}</Text><Mono>{formatDateTime(service.performedAt)} · {service.status}</Mono></View>) : <EmptyState text="Chưa có chỉ định dịch vụ." />}</Card>
    <Card><H2>Kết quả xét nghiệm</H2>{visit.labResults.length ? visit.labResults.map((lab) => <View key={lab.id} style={styles.lab}><Text style={styles.labName}>{lab.testName}</Text><Text style={styles.labValue}>{String(lab.result)} {lab.unit}</Text><Text style={styles.labRef}>{lab.referenceRange || "-"}</Text><Text style={lab.flag === "Bình thường" ? styles.normal : styles.high}>{lab.flag}</Text></View>) : <EmptyState text="Chưa có kết quả xét nghiệm." />}</Card>
    <Card><H2>Chẩn đoán hình ảnh</H2>{visit.imagingResults.length ? visit.imagingResults.map((item) => <View key={item.id} style={styles.item}><Text style={styles.itemTitle}>{item.techniqueName}</Text><Mono>{formatDate(item.date)}</Mono><Body>{item.conclusion || "Chưa có kết luận."}</Body></View>) : <EmptyState text="Chưa có kết quả CĐHA." />}</Card>
    <Card><H2>Đơn thuốc</H2>{visit.prescription?.items?.length ? visit.prescription.items.map((item) => <View key={item.id} style={styles.item}><Text style={styles.itemTitle}>{item.medicineName}</Text><Body>{item.quantity} · {item.dosage}</Body></View>) : <EmptyState text="Không có đơn thuốc trong lần khám này." />}</Card>
    <Card><H2>Lời dặn bác sĩ</H2><Body>{visit.doctorAdvice || "Chưa có lời dặn."}</Body></Card>
    <SecondaryButton onPress={() => router.push("/medical/visits")}>Về lịch sử khám</SecondaryButton>
  </ScrollView></Screen>;
}
function Info({ label, value }: { label: string; value?: string }) { return <View style={styles.info}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value || "Chưa ghi nhận"}</Text></View>; }
const styles = StyleSheet.create({ container: { gap: 14, padding: 16 }, loading: { alignItems: "center", flex: 1, justifyContent: "center" }, heading: { gap: 5 }, back: { color: colors.teal, fontWeight: "900" }, info: { backgroundColor: colors.tealSoft, borderRadius: 8, gap: 3, marginTop: 8, padding: 10 }, label: { color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }, value: { color: colors.ink, fontWeight: "800" }, grid: { gap: 4 }, item: { borderTopColor: colors.creamBorder, borderTopWidth: 1, gap: 4, paddingVertical: 10 }, itemTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" }, lab: { alignItems: "flex-start", borderTopColor: colors.creamBorder, borderTopWidth: 1, flexDirection: "row", gap: 6, paddingVertical: 10 }, labName: { color: colors.ink, flex: 1.5, fontWeight: "800" }, labValue: { color: colors.ink, flex: 1, fontFamily: "monospace", fontSize: 12 }, labRef: { color: colors.muted, flex: 1, fontFamily: "monospace", fontSize: 11 }, high: { color: colors.red, flex: 0.8, fontWeight: "900" }, normal: { color: colors.teal, flex: 0.8, fontWeight: "900" } });
