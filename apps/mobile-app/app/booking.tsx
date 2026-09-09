import { useEffect, useMemo, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PATIENT_BRANCHES, patientBranchName, type MobileSession, type PatientBranchCode, type PatientSessionProfile } from "@anphu/patient-domain";
import {
  createMobileBooking,
  getCurrentPatient,
  getCurrentSession,
  lookupProfile,
  selectProfile,
} from "@/lib/portal-api";
import { Body, Card, Mono, PrimaryButton, Screen, SecondaryButton } from "@/ui/components";
import { colors } from "@/ui/theme";

type BookingMode = "new" | "old";
type Step = 1 | 2 | 3 | 4;
type Form = {
  mode: BookingMode;
  mabn: string;
  fullName: string;
  phone: string;
  birthDate: string;
  gender: string;
  address: string;
  soCCCD: string;
  ngayCap: string;
  appointmentDate: string;
  appointmentTime: string;
  department: string;
  symptoms: string;
  branchCode: PatientBranchCode;
};

const initial: Form = {
  mode: "new",
  mabn: "",
  fullName: "",
  phone: "",
  birthDate: "",
  gender: "",
  address: "",
  soCCCD: "",
  ngayCap: "",
  appointmentDate: "",
  appointmentTime: "",
  department: "",
  symptoms: "",
  branchCode: "CN1",
};

const departmentSuggestions = ["Nội khoa", "Nhi khoa", "Sản phụ khoa", "Tai mũi họng", "CĐHA", "Xét nghiệm"];
const timeSuggestions = ["07:30", "08:00", "09:00", "14:00", "15:00"];

export default function BookingScreen() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<Form>({ ...initial, appointmentDate: todayDisplay(), appointmentTime: "08:00" });
  const [session, setSession] = useState<MobileSession | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");

  const selectedProfile = useMemo(
    () => session?.profiles.find((profile) => profile.mabn === form.mabn),
    [form.mabn, session],
  );

  useEffect(() => {
    void getCurrentSession().then((nextSession) => {
      setSession(nextSession);
      if (!nextSession) router.replace("/login");
    });
  }, []);

  const set = (key: keyof Form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  function chooseMode(mode: BookingMode) {
    setForm((current) => ({ ...current, mode }));
    setMessage("");
  }

  async function scan() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setMessage("Bạn chưa cấp quyền camera. Có thể nhập CCCD thủ công.");
        return;
      }
    }
    setScanning(true);
    setMessage("");
  }

  function onBarcodeScanned({ data }: { data: string }) {
    setScanning(false);
    const parsed = parseCitizenQr(data);
    if (!parsed.idNumber) {
      setMessage("Không đọc được dữ liệu CCCD từ mã QR này.");
      return;
    }
    setForm((current) => ({
      ...current,
      soCCCD: parsed.idNumber,
      fullName: parsed.fullName || current.fullName,
      birthDate: parsed.birthDate || current.birthDate,
      gender: parsed.gender || current.gender,
      address: parsed.address || current.address,
      ngayCap: parsed.issueDate || current.ngayCap,
    }));
    setMessage("Đã đọc QR CCCD. Anh/chị kiểm tra lại thông tin trước khi chọn lịch.");
    setStep(2);
  }

  async function useLinkedProfile(profile: PatientSessionProfile) {
    setLoading(true);
    setMessage("");
    try {
      const selected = await selectProfile(profile.mabn);
      if (selected.error) throw new Error(selected.error);
      const patient = await getCurrentPatient();
      setForm((current) => ({
        ...current,
        mode: "old",
        mabn: profile.mabn,
        fullName: patient?.fullName || profile.fullName || current.fullName,
        phone: patient?.phone || current.phone,
        birthDate: toDisplayDate(patient?.birthDate || current.birthDate),
        gender: patient?.gender || current.gender,
        address: patient?.address || current.address,
        soCCCD: patient?.citizenId || patient?.soCCCD || current.soCCCD,
        ngayCap: toDisplayDate(patient?.citizenIssueDate || patient?.ngayCap || current.ngayCap),
      }));
      setStep(2);
      setMessage("Đã chọn hồ sơ liên kết.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chưa chọn được hồ sơ liên kết.");
    } finally {
      setLoading(false);
    }
  }

  async function findOldPatient() {
    setLoading(true);
    setMessage("");
    try {
      const result = await lookupProfile(form.mabn, {
        phone: form.phone,
        birthDate: form.birthDate,
      });
      if (!result.data) throw new Error(result.error || "Không tìm thấy hồ sơ.");
      setForm((current) => ({
        ...current,
        mode: "old",
        fullName: result.data!.fullName,
        phone: result.data!.phone || current.phone,
        birthDate: toDisplayDate(result.data!.birthDate || current.birthDate),
        gender: result.data!.gender || current.gender,
        address: result.data!.address || current.address,
        soCCCD: result.data!.soCCCD || current.soCCCD,
        ngayCap: toDisplayDate(result.data!.ngayCap || current.ngayCap),
      }));
      setStep(2);
      setMessage("Đã xác minh hồ sơ cũ.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tìm được hồ sơ.");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setLoading(true);
    setMessage("");
    setSuccess("");
    try {
      const currentSession = await getCurrentSession();
      if (!currentSession) {
        router.replace("/login");
        return;
      }
      const result = await createMobileBooking({
        oldPatientCode: form.mode === "old" ? form.mabn : "",
        fullName: form.fullName,
        phone: form.phone,
        birthDate: form.birthDate,
        gender: form.gender,
        address: form.address,
        soCCCD: form.soCCCD,
        ngayCap: form.ngayCap,
        appointmentDate: form.appointmentDate,
        appointmentTime: form.appointmentTime,
        department: form.department,
        symptoms: form.symptoms,
        branchCode: form.branchCode,
      });
      setSuccess(
        result.data?.ma_lich_hen
          ? `Đăng ký thành công. Mã lịch hẹn: ${result.data.ma_lich_hen}`
          : "Đăng ký khám thành công.",
      );
      setStep(4);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chưa gửi được đăng ký.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen nav>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="calendar-check-outline" size={30} color={colors.cream} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>EXPRESS BOOKING</Text>
            <Text style={styles.heroTitle}>Đăng ký khám</Text>
            <Text style={styles.heroMeta}>Chọn người bệnh, lịch khám và gửi trong một luồng ngắn gọn.</Text>
          </View>
        </View>

        <StepBar step={step} />

        {message ? (
          <Card tone="soft">
            <Body>{message}</Body>
          </Card>
        ) : null}

        {step === 1 ? (
          <Card>
            <Text style={styles.sectionTitle}>1. Người bệnh</Text>
            <View style={styles.modeGrid}>
              <ModeCard
                active={form.mode === "new"}
                icon="account-plus-outline"
                title="Bệnh nhân mới"
                meta="Nhập thông tin hoặc quét QR CCCD"
                onPress={() => chooseMode("new")}
              />
              <ModeCard
                active={form.mode === "old"}
                icon="account-clock-outline"
                title="Đã từng khám"
                meta="Chọn hồ sơ liên kết hoặc nhập mã BN"
                onPress={() => chooseMode("old")}
              />
            </View>

            {form.mode === "old" ? (
              <View style={styles.block}>
                {session?.profiles?.length ? (
                  <View style={styles.linkedBox}>
                    <Text style={styles.label}>Hồ sơ đã xác minh</Text>
                    {session.profiles.map((profile) => (
                      <LinkedProfileButton
                        key={profile.mabn}
                        profile={profile}
                        active={selectedProfile?.mabn === profile.mabn}
                        onPress={() => void useLinkedProfile(profile)}
                      />
                    ))}
                  </View>
                ) : null}
                <Field label="Mã bệnh nhân" value={form.mabn} onChangeText={(v) => set("mabn", v)} placeholder="Ví dụ: 17058369" />
                <Field label="Số điện thoại xác thực" value={form.phone} onChangeText={(v) => set("phone", v)} placeholder="09xxxxxxxx" keyboardType="phone-pad" />
                <Field label="Ngày sinh xác thực" value={form.birthDate} onChangeText={(v) => set("birthDate", v)} placeholder="dd/mm/yyyy" />
                <PrimaryButton onPress={findOldPatient} disabled={loading || !form.mabn || (!form.phone && !form.birthDate)}>
                  {loading ? "Đang tìm..." : "Tìm và điền hồ sơ"}
                </PrimaryButton>
              </View>
            ) : (
              <View style={styles.actionGrid}>
                <PrimaryButton onPress={() => setStep(2)}>Nhập thông tin mới</PrimaryButton>
                <SecondaryButton onPress={scan}>Quét QR CCCD</SecondaryButton>
              </View>
            )}
          </Card>
        ) : null}

        {step === 2 ? (
          <Card>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>2. Thông tin người bệnh</Text>
              {form.mode === "new" ? <Pressable onPress={scan}><Text style={styles.textLink}>Quét QR</Text></Pressable> : null}
            </View>
            {scanning ? (
              <View style={styles.camera}>
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={onBarcodeScanned}
                />
                <Text style={styles.cameraHint}>Đưa mã QR CCCD vào khung hình</Text>
                <View style={styles.cameraAction}>
                  <SecondaryButton onPress={() => setScanning(false)}>Đóng camera</SecondaryButton>
                </View>
              </View>
            ) : null}
            <View style={styles.twoCols}>
              <Field label="Họ và tên" value={form.fullName} onChangeText={(v) => set("fullName", v)} placeholder="Nguyễn Văn A" />
              <Field label="Số điện thoại" value={form.phone} onChangeText={(v) => set("phone", v)} placeholder="09xxxxxxxx" keyboardType="phone-pad" />
            </View>
            <View style={styles.twoCols}>
              <Field label="Ngày sinh" value={form.birthDate} onChangeText={(v) => set("birthDate", v)} placeholder="dd/mm/yyyy" />
              <Field label="Giới tính" value={form.gender} onChangeText={(v) => set("gender", v)} placeholder="Nam/Nữ" />
            </View>
            <View style={styles.twoCols}>
              <Field label="CCCD/CMND" value={form.soCCCD} onChangeText={(v) => set("soCCCD", v)} placeholder="Có thể bỏ qua" />
              <Field label="Ngày cấp" value={form.ngayCap} onChangeText={(v) => set("ngayCap", v)} placeholder="dd/mm/yyyy" />
            </View>
            <Field label="Địa chỉ" value={form.address} onChangeText={(v) => set("address", v)} placeholder="Địa chỉ thường trú" />
            <PrimaryButton onPress={() => setStep(3)} disabled={!form.fullName || !form.phone || !form.birthDate}>
              Tiếp tục chọn lịch khám
            </PrimaryButton>
          </Card>
        ) : null}

        {step === 3 ? (
          <Card>
            <Text style={styles.sectionTitle}>3. Lịch khám</Text>
            <Text style={styles.label}>Chi nhánh</Text>
            <ChipRow
              items={PATIENT_BRANCHES.map((branch) => branch.code)}
              value={form.branchCode}
              onSelect={(value) => set("branchCode", value as PatientBranchCode)}
              labels={Object.fromEntries(PATIENT_BRANCHES.map((branch) => [branch.code, branch.shortName]))}
            />
            <Field label="Ngày khám" value={form.appointmentDate} onChangeText={(v) => set("appointmentDate", v)} placeholder="dd/mm/yyyy" />
            <Text style={styles.label}>Giờ khám</Text>
            <ChipRow items={timeSuggestions} value={form.appointmentTime} onSelect={(value) => set("appointmentTime", value)} />
            <Field label="Giờ khác" value={form.appointmentTime} onChangeText={(v) => set("appointmentTime", v)} placeholder="08:00" />
            <Text style={styles.label}>Khoa/phòng</Text>
            <ChipRow items={departmentSuggestions} value={form.department} onSelect={(value) => set("department", value)} />
            <Field label="Khoa/phòng khác" value={form.department} onChangeText={(v) => set("department", v)} placeholder="Nội khoa" />
            <Field label="Triệu chứng / lý do khám" value={form.symptoms} onChangeText={(v) => set("symptoms", v)} placeholder="Mô tả ngắn" multiline />
            <Summary form={form} />
            <PrimaryButton onPress={submit} disabled={loading || !form.appointmentDate || !form.appointmentTime || !form.department}>
              {loading ? "Đang gửi..." : "Gửi đăng ký khám"}
            </PrimaryButton>
            <SecondaryButton onPress={() => setStep(2)}>Quay lại thông tin</SecondaryButton>
          </Card>
        ) : null}

        {step === 4 ? (
          <Card tone="soft">
            <Text style={styles.successTitle}>Đã gửi đăng ký</Text>
            <Body>{success || "Thông tin đã chuyển về hệ thống lịch hẹn của bệnh viện."}</Body>
            <PrimaryButton onPress={() => router.replace("/dashboard")}>Về trang chủ</PrimaryButton>
            <SecondaryButton onPress={() => router.push("/registrations")}>Xem lịch sử đăng ký</SecondaryButton>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function StepBar({ step }: { step: Step }) {
  const items = ["Người bệnh", "Thông tin", "Xác nhận"];
  return (
    <View style={styles.steps}>
      {items.map((label, index) => {
        const active = step >= index + 1;
        return (
          <View key={label} style={[styles.step, active && styles.stepActive]}>
            <Text style={[styles.stepNo, active && styles.stepNoActive]}>{index + 1}</Text>
            <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ModeCard({
  active,
  icon,
  title,
  meta,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.modeCard, active && styles.modeCardActive]}>
      <MaterialCommunityIcons name={icon} size={26} color={active ? colors.teal : colors.muted} />
      <Text style={styles.modeTitle}>{title}</Text>
      <Text style={styles.modeMeta}>{meta}</Text>
    </Pressable>
  );
}

function LinkedProfileButton({
  profile,
  active,
  onPress,
}: {
  profile: PatientSessionProfile;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.profileChoice, active && styles.profileChoiceActive]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.profileName}>{profile.fullName || "Hồ sơ bệnh nhân"}</Text>
        <Text style={styles.profileMeta}>BN {profile.mabn} · {profile.relationship || "Hồ sơ y tế"}</Text>
      </View>
      <Text style={active ? styles.profileActive : styles.profileAction}>{active ? "Đã chọn" : "Chọn"}</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "phone-pad";
  multiline?: boolean;
}) {
  return (
    <View style={[styles.field, multiline && { minHeight: 116 }]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && styles.textarea]}
      />
    </View>
  );
}

function ChipRow({
  items,
  value,
  onSelect,
  labels,
}: {
  items: readonly string[];
  value: string;
  onSelect: (value: string) => void;
  labels?: Record<string, string>;
}) {
  return (
    <View style={styles.chipRow}>
      {items.map((item) => (
        <Pressable key={item} onPress={() => onSelect(item)} style={[styles.chip, value === item && styles.chipActive]}>
          <Text style={[styles.chipText, value === item && styles.chipTextActive]}>{labels?.[item] ?? item}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Summary({ form }: { form: Form }) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryTitle}>Tóm tắt đăng ký</Text>
      <Mono>{form.fullName || "Người bệnh"} · {form.phone || "Chưa có SĐT"}</Mono>
      <Text style={styles.summaryText}>{patientBranchName(form.branchCode)} · {form.appointmentDate || "Ngày khám"} · {form.appointmentTime || "Giờ khám"} · {form.department || "Khoa/phòng"}</Text>
    </View>
  );
}

function parseCitizenQr(raw: string) {
  try {
    const json = JSON.parse(raw) as Record<string, string>;
    return {
      idNumber: json.idNumber || json.id || json.cccd || "",
      fullName: json.fullName || json.name,
      birthDate: json.birthDate || json.dob,
      gender: json.gender,
      address: json.address,
      issueDate: json.issueDate,
    };
  } catch {
    const parts = raw.split("|");
    return {
      idNumber: parts[0] || "",
      fullName: parts[1],
      birthDate: normalizeQrDate(parts[2]),
      gender: parts[3],
      address: parts[4],
      issueDate: normalizeQrDate(parts[5]),
    };
  }
}

function normalizeQrDate(value?: string) {
  if (!value) return "";
  const compact = /^(\d{2})(\d{2})(\d{4})$/.exec(value);
  if (compact) return `${compact[1]}/${compact[2]}/${compact[3]}`;
  return value;
}

function toDisplayDate(value?: string) {
  if (!value) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return value;
}

function todayDisplay() {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16 },
  hero: {
    alignItems: "center",
    backgroundColor: colors.teal,
    borderRadius: 20,
    flexDirection: "row",
    gap: 14,
    padding: 16,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 18,
    height: 58,
    justifyContent: "center",
    width: 58,
  },
  heroEyebrow: { color: colors.tealSoft, fontSize: 11, fontWeight: "900" },
  heroTitle: { color: colors.cream, fontSize: 28, fontWeight: "900" },
  heroMeta: { color: colors.cream, fontSize: 13, fontWeight: "700", lineHeight: 19, marginTop: 3 },
  steps: { backgroundColor: colors.white, borderColor: colors.creamBorder, borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 6, padding: 6 },
  step: { alignItems: "center", borderRadius: 12, flex: 1, gap: 3, justifyContent: "center", minHeight: 58 },
  stepActive: { backgroundColor: colors.tealSoft },
  stepNo: { color: colors.muted, fontFamily: "monospace", fontWeight: "900" },
  stepNoActive: { color: colors.teal },
  stepLabel: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  stepLabelActive: { color: colors.ink, fontWeight: "900" },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginBottom: 10 },
  textLink: { color: colors.teal, fontWeight: "900" },
  modeGrid: { flexDirection: "row", gap: 10 },
  modeCard: { borderColor: colors.creamBorder, borderRadius: 16, borderWidth: 1, flex: 1, gap: 7, minHeight: 126, padding: 12 },
  modeCardActive: { backgroundColor: colors.tealSoft, borderColor: "#c7e7e1" },
  modeTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  modeMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", lineHeight: 17 },
  block: { gap: 10, marginTop: 12 },
  linkedBox: { gap: 8 },
  actionGrid: { gap: 10, marginTop: 12 },
  twoCols: { gap: 10 },
  field: { gap: 5, marginTop: 8 },
  label: { color: colors.ink, fontSize: 13, fontWeight: "900", marginTop: 4 },
  input: {
    borderColor: colors.creamBorder,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontWeight: "800",
    minHeight: 46,
    paddingHorizontal: 12,
  },
  textarea: { minHeight: 96, paddingTop: 12 },
  profileChoice: { alignItems: "center", borderColor: colors.creamBorder, borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 8, padding: 11 },
  profileChoiceActive: { backgroundColor: colors.tealSoft, borderColor: "#c7e7e1" },
  profileName: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  profileMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  profileAction: { color: colors.blue, fontSize: 12, fontWeight: "900" },
  profileActive: { color: colors.teal, fontSize: 12, fontWeight: "900" },
  camera: { backgroundColor: "#000", borderRadius: 16, height: 320, marginBottom: 10, overflow: "hidden" },
  cameraHint: { alignSelf: "center", color: colors.white, fontWeight: "900", position: "absolute", top: 16 },
  cameraAction: { bottom: 12, left: 12, position: "absolute", right: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 4 },
  chip: { backgroundColor: colors.white, borderColor: colors.creamBorder, borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  chipTextActive: { color: colors.cream },
  summary: { backgroundColor: colors.tealPale, borderColor: "#d3ece7", borderRadius: 14, borderWidth: 1, gap: 5, padding: 12 },
  summaryTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  summaryText: { color: colors.muted, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  successTitle: { color: colors.teal, fontSize: 20, fontWeight: "900", marginBottom: 6 },
});
