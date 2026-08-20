import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import type { MobileSession } from "@anphu/patient-domain";
import { getCurrentSession, logout, logoutAllDevices } from "@/lib/portal-api";
import { Body, Card, H1, Mono, PrimaryButton, Screen, SecondaryButton } from "@/ui/components";
import { colors } from "@/ui/theme";

export default function AccountScreen() {
  const [session, setSession] = useState<MobileSession | null>(null);
  useFocusEffect(useCallback(() => { void getCurrentSession().then(setSession); }, []));
  async function signOut(all: boolean) { if (all) await logoutAllDevices(); else await logout(); router.replace("/login"); }
  return <Screen nav><ScrollView contentContainerStyle={styles.container}>
    <View style={styles.heading}><H1>Tài khoản</H1><Body>Quản lý phiên đăng nhập và hồ sơ y tế.</Body></View>
    <Card tone="teal"><Text style={styles.eyebrow}>TÀI KHOẢN PORTAL</Text><Text style={styles.phone}>{session?.phoneMasked || "Đã xác thực"}</Text><Text style={styles.meta}>{session?.profiles.length || 0} hồ sơ đã liên kết</Text></Card>
    <Card><Text style={styles.section}>Hồ sơ y tế</Text><Body>Chọn hồ sơ của bạn hoặc người thân để xem dữ liệu.</Body><PrimaryButton onPress={() => router.push("/profiles")}>Quản lý hồ sơ</PrimaryButton></Card>
    <Card><Text style={styles.section}>Phiên đăng nhập</Text><Mono>{session?.sessionId || "Phiên hiện tại"}</Mono><Body>Đăng xuất tất cả thiết bị sẽ thu hồi các phiên đã lưu.</Body><SecondaryButton onPress={() => signOut(true)}>Đăng xuất tất cả thiết bị</SecondaryButton></Card>
    <SecondaryButton onPress={() => router.push("/dashboard")}>Về dashboard</SecondaryButton>
    <SecondaryButton onPress={() => signOut(false)}>Đăng xuất</SecondaryButton>
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({
  container: { gap: 14, padding: 16 }, heading: { gap: 5 },
  eyebrow: { color: colors.tealSoft, fontSize: 11, fontWeight: "900" },
  phone: { color: colors.cream, fontFamily: "monospace", fontSize: 22, fontWeight: "900", marginVertical: 12 },
  meta: { color: colors.cream, fontWeight: "800" },
  section: { color: colors.ink, fontSize: 18, fontWeight: "900", marginBottom: 7 },
});
