import { useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createMobileBooking,
  getCurrentSession,
  lookupProfile,
} from "@/lib/portal-api";
import {
  Body,
  Card,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "@/ui/components";
import { colors } from "@/ui/theme";

type Form = {
  mode: "new" | "old";
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
};

export default function BookingScreen() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(initial);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const set = (key: keyof Form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

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
    setMessage(
      "Đã đọc QR CCCD. Bạn kiểm tra lại thông tin trước khi tiếp tục.",
    );
  }

  async function findOldPatient() {
    setLoading(true);
    setMessage("");
    try {
      const result = await lookupProfile(form.mabn, {
        phone: form.phone,
        birthDate: form.birthDate,
      });
      if (!result.data)
        throw new Error(result.error || "Không tìm thấy hồ sơ.");
      setForm((current) => ({
        ...current,
        fullName: result.data!.fullName,
        phone: result.data!.phone || current.phone,
        birthDate: result.data!.birthDate || current.birthDate,
        gender: result.data!.gender || current.gender,
        address: result.data!.address || current.address,
        soCCCD: result.data!.soCCCD || current.soCCCD,
        ngayCap: result.data!.ngayCap || current.ngayCap,
      }));
      setStep(2);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không tìm được hồ sơ.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setLoading(true);
    setMessage("");
    setSuccess("");
    try {
      const session = await getCurrentSession();
      if (!session) {
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
      });
      setSuccess(
        result.data?.ma_lich_hen
          ? `Đăng ký thành công. Mã lịch hẹn: ${result.data.ma_lich_hen}`
          : "Đăng ký khám thành công.",
      );
      setStep(4);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Chưa gửi được đăng ký.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen nav>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Đăng ký khám</Text>
        <Body>
          Bạn có thể đăng ký cho bệnh nhân mới hoặc dùng hồ sơ đã từng khám.
        </Body>
        <View style={styles.steps}>
          {[1, 2, 3].map((item) => (
            <View
              key={item}
              style={[styles.step, step >= item && styles.stepActive]}
            >
              <Text
                style={step >= item ? styles.stepTextActive : styles.stepText}
              >
                {item}
              </Text>
            </View>
          ))}
        </View>
        {message ? (
          <Card tone="soft">
            <Body>{message}</Body>
          </Card>
        ) : null}
        {success ? (
          <Card tone="soft">
            <Text style={styles.success}>{success}</Text>
            <PrimaryButton onPress={() => router.replace("/dashboard")}>
              Về dashboard
            </PrimaryButton>
          </Card>
        ) : null}
        {step === 1 ? (
          <Card>
            <Text style={styles.section}>1. Chọn loại hồ sơ</Text>
            <View style={styles.choiceRow}>
              <Choice
                active={form.mode === "new"}
                label="Bệnh nhân mới"
                onPress={() => set("mode", "new")}
              />
              <Choice
                active={form.mode === "old"}
                label="Đã từng khám"
                onPress={() => set("mode", "old")}
              />
            </View>
            {form.mode === "old" ? (
              <>
                <Field
                  label="Mã bệnh nhân"
                  value={form.mabn}
                  onChangeText={(v) => set("mabn", v)}
                  placeholder="23006552"
                />
                <Field
                  label="Số điện thoại xác thực"
                  value={form.phone}
                  onChangeText={(v) => set("phone", v)}
                  placeholder="09xxxxxxxx"
                />
                <Field
                  label="Ngày sinh xác thực"
                  value={form.birthDate}
                  onChangeText={(v) => set("birthDate", v)}
                  placeholder="dd/mm/yyyy"
                />
                <PrimaryButton
                  onPress={findOldPatient}
                  disabled={
                    loading || !form.mabn || (!form.phone && !form.birthDate)
                  }
                >
                  Tìm và điền hồ sơ
                </PrimaryButton>
              </>
            ) : (
              <>
                <PrimaryButton onPress={() => setStep(2)}>
                  Nhập thông tin mới
                </PrimaryButton>
                <SecondaryButton onPress={scan}>Quét QR CCCD</SecondaryButton>
              </>
            )}
          </Card>
        ) : null}
        {step === 2 ? (
          <Card>
            <Text style={styles.section}>2. Thông tin bệnh nhân</Text>
            {scanning ? (
              <View style={styles.camera}>
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={onBarcodeScanned}
                />
                <Text style={styles.cameraHint}>
                  Đưa mã QR CCCD vào khung hình
                </Text>
                <SecondaryButton onPress={() => setScanning(false)}>
                  Đóng camera
                </SecondaryButton>
              </View>
            ) : null}
            <Field
              label="Họ và tên"
              value={form.fullName}
              onChangeText={(v) => set("fullName", v)}
              placeholder="Nguyễn Văn A"
            />
            <Field
              label="Số điện thoại"
              value={form.phone}
              onChangeText={(v) => set("phone", v)}
              placeholder="09xxxxxxxx"
            />
            <Field
              label="Ngày sinh"
              value={form.birthDate}
              onChangeText={(v) => set("birthDate", v)}
              placeholder="dd/mm/yyyy"
            />
            <Field
              label="Giới tính"
              value={form.gender}
              onChangeText={(v) => set("gender", v)}
              placeholder="Nam/Nữ"
            />
            <Field
              label="CCCD/CMND"
              value={form.soCCCD}
              onChangeText={(v) => set("soCCCD", v)}
              placeholder="Số CCCD"
            />
            <Field
              label="Địa chỉ"
              value={form.address}
              onChangeText={(v) => set("address", v)}
              placeholder="Địa chỉ thường trú"
            />
            <PrimaryButton
              onPress={() => setStep(3)}
              disabled={
                !form.fullName || !form.phone || !form.birthDate || !form.soCCCD
              }
            >
              Tiếp tục
            </PrimaryButton>
            {form.mode === "new" ? (
              <SecondaryButton onPress={scan}>Quét lại QR CCCD</SecondaryButton>
            ) : null}
          </Card>
        ) : null}
        {step === 3 ? (
          <Card>
            <Text style={styles.section}>3. Chọn lịch khám</Text>
            <Field
              label="Ngày khám"
              value={form.appointmentDate}
              onChangeText={(v) => set("appointmentDate", v)}
              placeholder="dd/mm/yyyy"
            />
            <Field
              label="Giờ khám"
              value={form.appointmentTime}
              onChangeText={(v) => set("appointmentTime", v)}
              placeholder="08:00"
            />
            <Field
              label="Khoa/phòng"
              value={form.department}
              onChangeText={(v) => set("department", v)}
              placeholder="Nội khoa"
            />
            <Field
              label="Triệu chứng/lý do khám"
              value={form.symptoms}
              onChangeText={(v) => set("symptoms", v)}
              placeholder="Mô tả ngắn"
            />
            <PrimaryButton
              onPress={submit}
              disabled={loading || !form.appointmentDate}
            >
              {" "}
              {loading ? "Đang gửi..." : "Gửi đăng ký khám"}
            </PrimaryButton>
            <SecondaryButton onPress={() => setStep(2)}>
              Quay lại
            </SecondaryButton>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Choice({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, active && styles.choiceActive]}
    >
      <Text style={active ? styles.choiceTextActive : styles.choiceText}>
        {label}
      </Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={styles.input}
      />
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
      birthDate: parts[2],
      gender: parts[3],
      address: parts[4],
      issueDate: parts[5],
    };
  }
}

const styles = StyleSheet.create({
  container: { gap: 14, padding: 16 },
  title: { color: colors.ink, fontSize: 28, fontWeight: "900" },
  steps: { flexDirection: "row", gap: 8 },
  step: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: colors.creamBorder,
  },
  stepActive: { backgroundColor: colors.teal },
  stepText: { color: colors.muted, fontWeight: "900" },
  stepTextActive: { color: colors.cream, fontWeight: "900" },
  section: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },
  choiceRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  choice: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.creamBorder,
    borderRadius: 10,
    backgroundColor: colors.white,
    padding: 8,
  },
  choiceActive: { borderColor: colors.teal, backgroundColor: colors.tealSoft },
  choiceText: { color: colors.ink, fontWeight: "800", textAlign: "center" },
  choiceTextActive: {
    color: colors.teal,
    fontWeight: "900",
    textAlign: "center",
  },
  field: { gap: 5, marginTop: 10 },
  label: { color: colors.ink, fontWeight: "800" },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.creamBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: colors.ink,
    fontWeight: "700",
  },
  camera: {
    height: 300,
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#000",
    marginBottom: 12,
  },
  cameraHint: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    color: colors.white,
    fontWeight: "900",
  },
  success: {
    color: colors.teal,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },
});
