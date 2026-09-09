import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatDate, normalizeDisplayText } from "@anphu/patient-domain";
import type { MobileSession, Patient, PatientSessionProfile } from "@anphu/patient-domain";
import {
  getCurrentPatient,
  getCurrentSession,
  logout,
  logoutAllDevices,
  selectProfile,
  setPassword,
  updateAccountProfile,
} from "@/lib/portal-api";
import { Body, Card, EmptyState, Mono, PrimaryButton, Screen, SecondaryButton } from "@/ui/components";
import { colors } from "@/ui/theme";

export default function AccountScreen() {
  const [session, setSession] = useState<MobileSession | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [password, setPasswordValue] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [preferences, setPreferences] = useState(defaultPreferences);

  const currentProfile = useMemo(
    () => session?.profiles.find((profile) => profile.mabn === session.currentMabn),
    [session],
  );

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const nextSession = await getCurrentSession();
      if (!nextSession) {
        router.replace("/login");
        return;
      }
      setSession(nextSession);
      const currentProfile = nextSession.profiles.find((profile) => profile.mabn === nextSession.currentMabn);
      setDisplayName((current) => current || currentProfile?.fullName || "");
      const [currentPatient, storedPreferences] = await Promise.all([
        nextSession.currentMabn ? getCurrentPatient().catch(() => null) : Promise.resolve(null),
        readPreferences(),
      ]);
      setPatient(currentPatient);
      setPreferences(storedPreferences);
    } catch {
      setMessage("Chưa tải được thông tin tài khoản.");
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      void load();
    }, []),
  );

  async function chooseProfile(profile: PatientSessionProfile) {
    setLoading(true);
    setMessage("");
    try {
      const result = await selectProfile(profile.mabn);
      if (result.error) throw new Error(result.error);
      await load();
      setMessage(`Đang xem hồ sơ ${profile.fullName || profile.mabn}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chưa đổi được hồ sơ.");
    } finally {
      setLoading(false);
    }
  }

  async function savePassword() {
    if (password.length < 6) {
      setMessage("Mật khẩu cần tối thiểu 6 ký tự.");
      return;
    }
    setSavingPassword(true);
    setMessage("");
    try {
      const result = await setPassword(password);
      if (result.error) throw new Error(result.error);
      setPasswordValue("");
      setMessage("Đã cập nhật mật khẩu đăng nhập.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chưa đổi được mật khẩu.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function saveDisplayName() {
    if (displayName.trim().length < 2) {
      setMessage("Tên hiển thị cần tối thiểu 2 ký tự.");
      return;
    }

    setSavingName(true);
    setMessage("");
    try {
      const result = await updateAccountProfile(displayName.trim());
      if (result.error) throw new Error(result.error);
      setEditingName(false);
      setMessage("Đã cập nhật tên hiển thị trong app.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chưa cập nhật được tên hiển thị.");
    } finally {
      setSavingName(false);
    }
  }

  async function togglePreference(key: PreferenceKey) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    await AsyncStorage.setItem(notificationPreferenceKey, JSON.stringify(next)).catch(() => undefined);
  }

  async function signOut(all: boolean) {
    if (all) await logoutAllDevices();
    else await logout();
    router.replace("/login");
  }

  function confirmSignOutAll() {
    Alert.alert(
      "Đăng xuất tất cả thiết bị?",
      "Các phiên đăng nhập đã lưu trên điện thoại hoặc máy tính khác sẽ bị thu hồi.",
      [
        { text: "Hủy", style: "cancel" },
        { text: "Đăng xuất", style: "destructive", onPress: () => void signOut(true) },
      ],
    );
  }

  return (
    <Screen nav>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account-heart-outline" size={30} color={colors.teal} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>AN PHÚ CARE</Text>
            <Text style={styles.title}>Tài khoản</Text>
            <Mono>{session?.phoneMasked || "Đang bảo vệ phiên"}</Mono>
          </View>
          <View style={styles.sessionPill}>
            <MaterialCommunityIcons name="shield-check-outline" size={16} color={colors.teal} />
            <Text style={styles.sessionPillText}>An toàn</Text>
          </View>
        </View>

        {message ? (
          <Card tone="soft">
            <Body>{message}</Body>
          </Card>
        ) : null}

        <SectionCard
          icon="account-check-outline"
          title="Thông tin cá nhân"
          meta={session?.phoneMasked || "Đã đăng nhập"}
        >
          <View style={styles.editNameBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Tên hiển thị trong app</Text>
              <Body>Không thay đổi dữ liệu hồ sơ y tế/HIS.</Body>
            </View>
            <Pressable onPress={() => setEditingName(!editingName)} style={styles.miniButton}>
              <Text style={styles.miniButtonText}>{editingName ? "Hủy" : "Sửa"}</Text>
            </Pressable>
          </View>
          {editingName ? (
            <View style={styles.fieldGroup}>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Tên hiển thị"
                style={styles.input}
              />
              <PrimaryButton onPress={saveDisplayName} disabled={savingName || displayName.trim().length < 2}>
                {savingName ? "Đang lưu..." : "Lưu tên hiển thị"}
              </PrimaryButton>
            </View>
          ) : (
            <InfoRow label="Tên hiển thị" value={displayName || currentProfile?.fullName || "Chưa ghi nhận"} />
          )}
          <InfoRow label="Tài khoản" value={session?.phoneMasked || "Đã xác thực"} />
          <InfoRow label="Trạng thái" value="Đang hoạt động" />
          <InfoRow label="Hồ sơ liên kết" value={`${session?.profiles.length || 0} hồ sơ`} />
        </SectionCard>

        <SectionCard
          icon="account-switch-outline"
          title="Hồ sơ y tế người thân"
          meta={currentProfile ? `Đang xem BN ${currentProfile.mabn}` : "Chưa chọn hồ sơ"}
        >
          {currentProfile ? (
            <View style={styles.currentProfile}>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{currentProfile.fullName || "Hồ sơ bệnh nhân"}</Text>
                <Mono>BN {currentProfile.mabn}</Mono>
                <Text style={styles.profileRelation}>{currentProfile.relationship || "Hồ sơ đang xem"}</Text>
              </View>
              <MaterialCommunityIcons name="check-circle" size={22} color={colors.teal} />
            </View>
          ) : (
            <EmptyState text="Chưa chọn hồ sơ đang xem." />
          )}

          {patient ? (
            <View style={styles.patientDetails}>
              <InfoRow label="Ngày sinh" value={patient.birthDate ? formatDate(patient.birthDate) : "Chưa ghi nhận"} />
              <InfoRow label="Giới tính" value={patient.gender || "Chưa ghi nhận"} />
              <InfoRow label="Điện thoại" value={patient.phone || "Chưa ghi nhận"} />
              <InfoRow label="Địa chỉ" value={normalizeDisplayText(patient.address) || "Chưa ghi nhận"} />
              <InfoRow label="BHYT" value={patient.insurance?.cardNumber || "Chưa ghi nhận"} />
            </View>
          ) : null}

          <View style={styles.profileList}>
            {session?.profiles.length ? (
              session.profiles.map((profile) => (
                <ProfileSwitchRow
                  key={profile.mabn}
                  profile={profile}
                  active={profile.mabn === session.currentMabn}
                  onPress={() => void chooseProfile(profile)}
                />
              ))
            ) : (
              <EmptyState text="Chưa có hồ sơ y tế liên kết." />
            )}
          </View>

          <PrimaryButton onPress={() => router.push("/profiles")}>
            Quản lý / thêm hồ sơ
          </PrimaryButton>
        </SectionCard>

        <SectionCard icon="lock-reset" title="Thay đổi mật khẩu" meta="Dùng cho lần đăng nhập sau">
          <Text style={styles.label}>Mật khẩu mới</Text>
          <TextInput
            value={password}
            onChangeText={setPasswordValue}
            placeholder="Tối thiểu 6 ký tự"
            secureTextEntry
            style={styles.input}
          />
          <PrimaryButton onPress={savePassword} disabled={savingPassword || password.length < 6}>
            {savingPassword ? "Đang lưu..." : "Cập nhật mật khẩu"}
          </PrimaryButton>
        </SectionCard>

        <SectionCard icon="lock-outline" title="Passcode" meta="Chuẩn bị cho mobile">
          <Body>Passcode/mở khóa nhanh sẽ dùng để vào app thuận tiện hơn sau khi đã đăng nhập. Hiện tại tài khoản vẫn được bảo vệ bằng mật khẩu và phiên đăng nhập.</Body>
        </SectionCard>

        <SectionCard icon="bell-outline" title="Nhận thông báo" meta="Thiết bị này">
          <View style={styles.preferenceList}>
            {preferenceOptions.map((option) => (
              <Pressable
                key={option.key}
                accessibilityRole="switch"
                accessibilityState={{ checked: preferences[option.key] }}
                onPress={() => void togglePreference(option.key)}
                style={styles.preferenceRow}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.preferenceTitle}>{option.title}</Text>
                  <Text style={styles.preferenceDescription}>{option.description}</Text>
                </View>
                <View style={[styles.switchTrack, preferences[option.key] && styles.switchTrackOn]}>
                  <View style={[styles.switchThumb, preferences[option.key] && styles.switchThumbOn]} />
                </View>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => router.push("/booking")} style={styles.permissionRow}>
            <MaterialCommunityIcons name="camera-outline" size={21} color={colors.teal} />
            <View style={{ flex: 1 }}>
              <Text style={styles.preferenceTitle}>Camera quét QR CCCD</Text>
              <Text style={styles.preferenceDescription}>Mở màn đăng ký khám để hệ thống xin quyền camera khi cần quét QR.</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
          </Pressable>
        </SectionCard>

        <SectionCard icon="devices" title="Thiết bị đăng nhập" meta="Phiên hiện tại">
          <View style={styles.deviceRow}>
            <MaterialCommunityIcons name="cellphone-check" size={22} color={colors.teal} />
            <View style={{ flex: 1 }}>
              <Text style={styles.deviceTitle}>Thiết bị này</Text>
              <Mono>{session?.sessionId ? shortId(session.sessionId) : "Phiên hiện tại"}</Mono>
            </View>
          </View>
          <SecondaryButton onPress={confirmSignOutAll}>
            Đăng xuất tất cả thiết bị
          </SecondaryButton>
        </SectionCard>

        <SectionCard icon="file-document-outline" title="Thông tin pháp lý" meta="Điều khoản và chính sách">
          <LegalRow title="Điều khoản dịch vụ" />
          <LegalRow title="Chính sách bảo mật" />
          <LegalRow title="Quy định sử dụng" />
          <Body>Mobile sẽ mở nội dung chi tiết khi có màn pháp lý riêng; hiện nội dung đầy đủ đã có trên web app.</Body>
        </SectionCard>

        <Pressable onPress={() => void signOut(false)} style={styles.signOutButton}>
          <MaterialCommunityIcons name="logout" size={20} color={colors.red} />
          <Text style={styles.signOutText}>Đăng xuất</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

type PreferenceKey = "appointments" | "results" | "insurance";

const notificationPreferenceKey = "anphu-notification-preferences";
const defaultPreferences: Record<PreferenceKey, boolean> = {
  appointments: true,
  results: true,
  insurance: true,
};

const preferenceOptions: Array<{ key: PreferenceKey; title: string; description: string }> = [
  {
    key: "appointments",
    title: "Nhắc lịch hẹn",
    description: "Thông báo trước ngày khám hoặc khi có thay đổi lịch.",
  },
  {
    key: "results",
    title: "Kết quả mới",
    description: "Nhắc khi có kết quả xét nghiệm hoặc CĐHA mới được đồng bộ.",
  },
  {
    key: "insurance",
    title: "BHYT sắp hết hạn",
    description: "Cảnh báo trước khi thẻ BHYT gần hết hiệu lực.",
  },
];

async function readPreferences() {
  const stored = await AsyncStorage.getItem(notificationPreferenceKey).catch(() => null);
  if (!stored) return defaultPreferences;

  try {
    return { ...defaultPreferences, ...(JSON.parse(stored) as Partial<typeof defaultPreferences>) };
  } catch {
    return defaultPreferences;
  }
}

function SectionCard({
  icon,
  title,
  meta,
  children,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <View style={styles.sectionHeader}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name={icon} size={22} color={colors.teal} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionMeta}>{meta}</Text>
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </Card>
  );
}

function ProfileSwitchRow({
  profile,
  active,
  onPress,
}: {
  profile: PatientSessionProfile;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={active} style={[styles.switchRow, active && styles.switchRowActive]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.switchName}>{profile.fullName || "Hồ sơ bệnh nhân"}</Text>
        <Text style={styles.switchMeta}>BN {profile.mabn} · {profile.relationship || "Người thân"}</Text>
      </View>
      <Text style={active ? styles.activeText : styles.chooseText}>{active ? "Đang xem" : "Chọn"}</Text>
    </Pressable>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function LegalRow({ title }: { title: string }) {
  return (
    <View style={styles.legalRow}>
      <MaterialCommunityIcons name="file-document-outline" size={19} color={colors.teal} />
      <Text style={styles.legalTitle}>{title}</Text>
    </View>
  );
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16 },
  hero: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.creamBorder,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.tealSoft,
    borderRadius: 18,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  heroText: { flex: 1, gap: 2 },
  eyebrow: { color: colors.teal, fontSize: 11, fontWeight: "900" },
  title: { color: colors.ink, fontSize: 24, fontWeight: "900" },
  sessionPill: {
    alignItems: "center",
    backgroundColor: colors.tealSoft,
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  sessionPillText: { color: colors.teal, fontSize: 11, fontWeight: "900" },
  sectionHeader: { alignItems: "center", flexDirection: "row", gap: 10 },
  iconBox: {
    alignItems: "center",
    backgroundColor: colors.tealSoft,
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  sectionMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  sectionBody: { gap: 10, marginTop: 12 },
  editNameBox: {
    alignItems: "center",
    backgroundColor: colors.tealPale,
    borderColor: "#d3ece7",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10,
  },
  miniButton: {
    backgroundColor: colors.white,
    borderColor: "#c7e7e1",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  miniButtonText: { color: colors.teal, fontSize: 12, fontWeight: "900" },
  fieldGroup: { gap: 8 },
  infoRow: {
    borderTopColor: colors.creamBorder,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    paddingTop: 10,
  },
  infoLabel: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  infoValue: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: "900", textAlign: "right" },
  currentProfile: {
    alignItems: "center",
    backgroundColor: colors.tealPale,
    borderColor: "#d3ece7",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  profileName: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  profileRelation: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 3 },
  profileList: { gap: 8 },
  patientDetails: {
    backgroundColor: colors.white,
    borderColor: colors.creamBorder,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  switchRow: {
    alignItems: "center",
    borderColor: colors.creamBorder,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    padding: 10,
  },
  switchRowActive: { backgroundColor: colors.tealSoft, borderColor: "#c7e7e1" },
  switchName: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  switchMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  activeText: { color: colors.teal, fontSize: 12, fontWeight: "900" },
  chooseText: { color: colors.blue, fontSize: 12, fontWeight: "900" },
  label: { color: colors.ink, fontWeight: "800" },
  input: {
    borderColor: colors.creamBorder,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontWeight: "800",
    minHeight: 46,
    paddingHorizontal: 12,
  },
  deviceRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  deviceTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  preferenceList: { gap: 8 },
  preferenceRow: {
    alignItems: "center",
    borderColor: colors.creamBorder,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10,
  },
  preferenceTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  preferenceDescription: { color: colors.muted, fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: 2 },
  switchTrack: { backgroundColor: "#d7dde6", borderRadius: 999, height: 28, justifyContent: "center", paddingHorizontal: 3, width: 50 },
  switchTrackOn: { backgroundColor: colors.teal },
  switchThumb: { backgroundColor: colors.white, borderRadius: 999, height: 22, width: 22 },
  switchThumbOn: { alignSelf: "flex-end" },
  permissionRow: {
    alignItems: "center",
    backgroundColor: colors.tealPale,
    borderColor: "#d3ece7",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10,
  },
  legalRow: {
    alignItems: "center",
    borderColor: colors.creamBorder,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    padding: 10,
  },
  legalTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  signOutButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: "#fecdd3",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
  },
  signOutText: { color: colors.red, fontWeight: "900" },
});
