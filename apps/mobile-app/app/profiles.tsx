import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import type {
  MobileSession,
  PatientSessionProfile,
} from "@anphu/patient-domain";
import {
  getCurrentSession,
  linkProfile,
  lookupProfile,
  logout,
  logoutAllDevices,
  selectProfile,
  unlinkProfile,
} from "@/lib/portal-api";
import {
  Body,
  Card,
  EmptyState,
  Mono,
  PrimaryButton,
  Screen,
  SecondaryButton,
} from "@/ui/components";
import { colors } from "@/ui/theme";

type Lookup = {
  oldPatientCode: string;
  fullName: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  address?: string;
  soCCCD?: string;
  ngayCap?: string;
};
const relationships = [
  "Con",
  "Cha",
  "Mẹ",
  "Vợ/Chồng",
  "Anh/Chị/Em",
  "Người thân khác",
];

export default function ProfilesScreen() {
  const [session, setSession] = useState<MobileSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [mabn, setMabn] = useState("");
  const [verifyPhone, setVerifyPhone] = useState("");
  const [verifyBirthDate, setVerifyBirthDate] = useState("");
  const [relationship, setRelationship] = useState("Con");
  const [lookup, setLookup] = useState<Lookup | null>(null);

  async function load() {
    setLoading(true);
    setMessage("");
    setSession(await getCurrentSession());
    setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      void load();
    }, []),
  );

  async function choose(profile: PatientSessionProfile) {
    try {
      await selectProfile(profile.mabn);
      await load();
    } catch {
      setMessage("Chưa chọn được hồ sơ này.");
    }
  }

  async function findProfile() {
    setLoading(true);
    setMessage("");
    setLookup(null);
    try {
      const result = await lookupProfile(mabn, {
        phone: verifyPhone,
        birthDate: verifyBirthDate,
      });
      setLookup(result.data ?? null);
      if (!result.data) setMessage(result.error ?? "Không tìm thấy hồ sơ.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không tìm được hồ sơ.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmLink() {
    if (!lookup) return;
    setLoading(true);
    setMessage("");
    try {
      await linkProfile({
        mabn: lookup.oldPatientCode,
        phone: verifyPhone,
        birthDate: toIsoDate(verifyBirthDate || lookup.birthDate || ""),
        relationship,
        citizenId: lookup.soCCCD,
      });
      setLookup(null);
      setMabn("");
      setVerifyPhone("");
      setVerifyBirthDate("");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không liên kết được hồ sơ.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function remove(profile: PatientSessionProfile) {
    try {
      await unlinkProfile(profile.mabn);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không gỡ được hồ sơ.",
      );
    }
  }

  async function signOut(all = false) {
    if (all) await logoutAllDevices();
    else await logout();
    router.replace("/login");
  }

  return (
    <Screen nav>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} />
        }
      >
        <View style={{ gap: 6 }}>
          <Text style={styles.title}>Hồ sơ y tế</Text>
          <Body>
            Chọn người đang xem. Thông tin chỉ hiển thị sau khi phiên đã xác
            thực.
          </Body>
          {session?.phoneMasked ? <Mono>{session.phoneMasked}</Mono> : null}
        </View>
        {message ? (
          <Card tone="soft">
            <Body>{message}</Body>
          </Card>
        ) : null}

        <Card>
          <Text style={styles.sectionTitle}>Hồ sơ đang liên kết</Text>
          {session?.profiles?.length ? (
            session.profiles.map((profile) => (
              <ProfileRow
                key={profile.mabn}
                profile={profile}
                current={profile.mabn === session.currentMabn}
                onChoose={() => choose(profile)}
                onRemove={() => remove(profile)}
              />
            ))
          ) : (
            <EmptyState text="Chưa có hồ sơ y tế liên kết." />
          )}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Thêm hồ sơ người thân</Text>
          <Body>
            Nhập mã BN và thêm số điện thoại hoặc ngày sinh để xác thực quyền
            liên kết.
          </Body>
          <Field
            label="Mã bệnh nhân"
            value={mabn}
            onChangeText={setMabn}
            placeholder="Ví dụ: 23006552"
          />
          <Field
            label="Số điện thoại xác thực"
            value={verifyPhone}
            onChangeText={setVerifyPhone}
            placeholder="09xxxxxxxx"
            keyboardType="phone-pad"
          />
          <Field
            label="Ngày sinh xác thực"
            value={verifyBirthDate}
            onChangeText={setVerifyBirthDate}
            placeholder="dd/mm/yyyy"
          />
          <PrimaryButton
            onPress={findProfile}
            disabled={loading || !mabn || (!verifyPhone && !verifyBirthDate)}
          >
            Tìm hồ sơ
          </PrimaryButton>
          {lookup ? (
            <View style={styles.preview}>
              <Text style={styles.name}>{lookup.fullName}</Text>
              <Mono>Mã BN: {lookup.oldPatientCode}</Mono>
              {lookup.phone ? <Mono>SĐT: {lookup.phone}</Mono> : null}
              <Text style={styles.label}>Quan hệ</Text>
              <View style={styles.relationships}>
                {relationships.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => setRelationship(item)}
                    style={[
                      styles.relationship,
                      relationship === item && styles.relationshipActive,
                    ]}
                  >
                    <Text
                      style={
                        relationship === item
                          ? styles.relationshipTextActive
                          : styles.relationshipText
                      }
                    >
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <PrimaryButton onPress={confirmLink} disabled={loading}>
                Xác nhận liên kết
              </PrimaryButton>
            </View>
          ) : null}
        </Card>

        <SecondaryButton onPress={() => signOut(false)}>
          Đăng xuất
        </SecondaryButton>
        <SecondaryButton onPress={() => signOut(true)}>
          Đăng xuất tất cả thiết bị
        </SecondaryButton>
      </ScrollView>
    </Screen>
  );
}

function ProfileRow({
  profile,
  current,
  onChoose,
  onRemove,
}: {
  profile: PatientSessionProfile;
  current: boolean;
  onChoose: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.profile}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{profile.fullName || "Hồ sơ bệnh nhân"}</Text>
        <Mono>Mã BN: {profile.mabn}</Mono>
        <Text style={styles.relationshipLabel}>
          {profile.relationship || "Hồ sơ y tế"}
        </Text>
      </View>
      {current ? (
        <Text style={styles.current}>Đang xem</Text>
      ) : (
        <Pressable onPress={onChoose}>
          <Text style={styles.action}>Chọn</Text>
        </Pressable>
      )}
      <Pressable
        onPress={onRemove}
        accessibilityLabel={`Gỡ hồ sơ ${profile.mabn}`}
      >
        <Text style={styles.remove}>Gỡ</Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "phone-pad";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

function toIsoDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

const styles = StyleSheet.create({
  container: { gap: 14, padding: 16 },
  title: { color: colors.ink, fontSize: 28, fontWeight: "900" },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.creamBorder,
    paddingVertical: 12,
  },
  name: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  relationshipLabel: { color: colors.muted, fontWeight: "700", marginTop: 3 },
  current: { color: colors.teal, fontWeight: "900" },
  action: { color: colors.teal, fontWeight: "900" },
  remove: { color: colors.red, fontWeight: "800" },
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
  preview: {
    gap: 8,
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: colors.tealSoft,
    padding: 12,
  },
  relationships: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  relationship: {
    borderWidth: 1,
    borderColor: colors.creamBorder,
    borderRadius: 999,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  relationshipActive: {
    borderColor: colors.teal,
    backgroundColor: colors.teal,
  },
  relationshipText: { color: colors.ink, fontWeight: "700" },
  relationshipTextActive: { color: colors.cream, fontWeight: "800" },
});
