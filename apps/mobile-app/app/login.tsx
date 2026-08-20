import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  getCurrentSession,
  loginWithPassword,
  sendOtp,
  setPassword,
  startRegister,
  verifyOtp,
  verifyRegisterOtp,
} from "@/lib/portal-api";
import {
  Body,
  Card,
  Mono,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "@/ui/components";
import { colors } from "@/ui/theme";

type Mode = "password" | "otp" | "register";

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>("password");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPasswordValue] = useState("");
  const [otp, setOtp] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const secondsLeft = expiresAt
    ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - clock) / 1000))
    : 0;

  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  async function goNext() {
    const session = await getCurrentSession();
    router.replace(session?.currentMabn ? "/dashboard" : "/profiles");
  }

  async function requestOtp() {
    const result =
      mode === "register"
        ? await startRegister(phone, fullName)
        : await sendOtp(phone);
    setExpiresAt(
      result.data?.expiresAt ?? new Date(Date.now() + 5 * 60_000).toISOString(),
    );
    setClock(Date.now());
    setOtpSent(true);
    setMessage(
      result.data?.testOtp
        ? `Mã test: ${result.data.testOtp}`
        : "Mã OTP đã được gửi. Kiểm tra Zalo của bạn.",
    );
  }

  async function submitOtp() {
    if (mode === "register") {
      await verifyRegisterOtp(phone, fullName, otp);
      await setPassword(password);
    } else {
      await verifyOtp(phone, otp);
    }
    await goNext();
  }

  async function submit() {
    setLoading(true);
    setMessage("");
    try {
      if (mode === "password") {
        await loginWithPassword(phone, password, true);
        await goNext();
      } else if (!otpSent || secondsLeft <= 0) {
        await requestOtp();
      } else {
        await submitOtp();
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể xác thực. Vui lòng thử lại.",
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setOtpSent(false);
    setOtp("");
    setExpiresAt("");
    setMessage("");
  }

  const otpMode = mode !== "password";
  const canSubmit =
    mode === "password"
      ? Boolean(phone && password)
      : Boolean(
          phone &&
          (mode !== "register" || (fullName && password)) &&
          (otpSent ? otp : true),
        );

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Card tone="teal">
            <Text style={styles.eyebrow}>An Phú Care</Text>
            <Text style={styles.heroTitle}>
              {mode === "register" ? "Tạo tài khoản" : "Đăng nhập"}
            </Text>
            <Text style={styles.heroText}>
              Tài khoản độc lập với hồ sơ HIS. Hồ sơ y tế chỉ hiện sau khi xác
              thực.
            </Text>
          </Card>

          <View style={styles.modeRow}>
            <ModeButton
              active={mode === "password"}
              label="Mật khẩu"
              onPress={() => switchMode("password")}
            />
            <ModeButton
              active={mode === "otp"}
              label="OTP Zalo"
              onPress={() => switchMode("otp")}
            />
            <ModeButton
              active={mode === "register"}
              label="Đăng ký"
              onPress={() => switchMode("register")}
            />
          </View>

          <Card>
            {mode === "register" ? (
              <Field
                label="Họ và tên"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Nguyễn Văn A"
              />
            ) : null}
            <Field
              label="Số điện thoại"
              value={phone}
              onChangeText={setPhone}
              placeholder="0911071001"
              keyboardType="phone-pad"
            />
            {mode === "password" || mode === "register" ? (
              <Field
                label="Mật khẩu"
                value={password}
                onChangeText={setPasswordValue}
                placeholder="Tối thiểu 6 ký tự"
                secureTextEntry
              />
            ) : null}
            {otpMode && otpSent ? (
              <>
                <Field
                  label="Mã OTP 6 số"
                  value={otp}
                  onChangeText={(value) =>
                    setOtp(value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="123456"
                  keyboardType="number-pad"
                />
                <Mono>
                  {secondsLeft > 0
                    ? `Mã còn hiệu lực ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
                    : "Mã đã hết hạn, hãy gửi lại."}
                </Mono>
              </>
            ) : null}
            {message ? <Body>{message}</Body> : null}
            <PrimaryButton onPress={submit} disabled={loading || !canSubmit}>
              {loading
                ? "Đang xử lý..."
                : otpMode && otpSent && secondsLeft > 0
                  ? "Xác nhận OTP"
                  : otpMode
                    ? "Gửi mã OTP"
                    : "Đăng nhập"}
            </PrimaryButton>
            {otpMode && otpSent ? (
              <SecondaryButton onPress={requestOtp}>
                Gửi lại mã OTP
              </SecondaryButton>
            ) : null}
          </Card>
          <Body>
            Không chia sẻ mã OTP hoặc mật khẩu. Nhân viên bệnh viện không yêu
            cầu bạn đọc mã xác thực.
          </Body>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: "phone-pad" | "number-pad";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        style={styles.input}
        autoCapitalize="none"
      />
    </View>
  );
}

function ModeButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Text
      onPress={onPress}
      style={[styles.modeButton, active && styles.modeButtonActive]}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, padding: 16 },
  eyebrow: {
    color: "#d9f4ef",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  heroTitle: {
    marginTop: 8,
    color: colors.cream,
    fontSize: 28,
    fontWeight: "900",
  },
  heroText: {
    marginTop: 8,
    color: "#d9f4ef",
    fontWeight: "700",
    lineHeight: 22,
  },
  modeRow: { flexDirection: "row", gap: 6 },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.white,
    color: colors.muted,
    textAlign: "center",
    fontWeight: "800",
    overflow: "hidden",
  },
  modeButtonActive: { backgroundColor: colors.tealSoft, color: colors.teal },
  field: { gap: 6, marginBottom: 12 },
  label: { color: colors.ink, fontWeight: "800" },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.creamBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
  },
});
