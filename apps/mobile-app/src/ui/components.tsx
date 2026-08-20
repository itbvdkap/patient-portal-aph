import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { colors, radius } from "@/ui/theme";

export function Screen({ children, nav = false }: { children: ReactNode; nav?: boolean }) {
  return <View style={styles.screen}><View style={styles.screenBody}>{children}</View>{nav ? <MobileNav /> : null}</View>;
}

function MobileNav() {
  const pathname = usePathname();
  const tabs = [["Trang chủ", "/dashboard"], ["Hôm nay", "/today"], ["Lịch sử", "/medical/visits"], ["Xét nghiệm", "/medical/labs"], ["Tài khoản", "/account"]] as const;
  return <View style={styles.nav}>{tabs.map(([label, target]) => { const active = pathname === target || pathname.startsWith(target + "/"); return <Pressable key={target} onPress={() => router.push(target)} style={styles.navItem}><Text style={[styles.navDot, active && styles.navDotActive]}>●</Text><Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text></Pressable>; })}</View>;
}

export function Card({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "teal" | "soft" }) {
  return <View style={[styles.card, tone === "teal" && styles.tealCard, tone === "soft" && styles.softCard]}>{children}</View>;
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function H2({ children }: { children: ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}

export function Body({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Mono({ children }: { children: ReactNode }) {
  return <Text style={styles.mono}>{children}</Text>;
}

export function PrimaryButton({ children, onPress, disabled = false }: { children: ReactNode; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.button, disabled && styles.buttonDisabled]}>
      <Text style={styles.buttonText}>{children}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.secondaryButton}>
      <Text style={styles.secondaryButtonText}>{children}</Text>
    </Pressable>
  );
}

export function Metric({ label, value }: { label: string; value?: number | string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value ?? "-"}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  screenBody: { flex: 1 },
  nav: { backgroundColor: colors.white, borderTopColor: colors.creamBorder, borderTopWidth: 1, flexDirection: "row", paddingBottom: 7, paddingTop: 8 },
  navItem: { alignItems: "center", flex: 1, gap: 3 },
  navDot: { color: colors.muted, fontSize: 11 },
  navDotActive: { color: colors.teal },
  navLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  navLabelActive: { color: colors.teal, fontWeight: "900" },
  card: {
    borderWidth: 1,
    borderColor: colors.creamBorder,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    padding: 14,
  },
  tealCard: {
    borderColor: colors.teal,
    backgroundColor: colors.teal,
  },
  softCard: {
    borderColor: "#d3ece7",
    backgroundColor: colors.tealSoft,
  },
  h1: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "900",
  },
  h2: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  mono: {
    color: colors.ink,
    fontFamily: "monospace",
    fontSize: 14,
    fontWeight: "700",
  },
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.teal,
    paddingHorizontal: 14,
  },
  buttonDisabled: {
    backgroundColor: "#94a3b8",
  },
  buttonText: {
    color: colors.cream,
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.creamBorder,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: colors.teal,
    fontWeight: "900",
  },
  metric: {
    width: "48%",
    borderRadius: radius.md,
    backgroundColor: colors.tealSoft,
    padding: 14,
  },
  metricValue: {
    color: colors.teal,
    fontFamily: "monospace",
    fontSize: 22,
    fontWeight: "900",
  },
  metricLabel: {
    marginTop: 4,
    color: colors.ink,
    fontWeight: "700",
  },
  empty: {
    borderWidth: 1,
    borderColor: colors.creamBorder,
    borderRadius: radius.md,
    borderStyle: "dashed",
    padding: 16,
  },
  emptyText: {
    color: colors.muted,
    textAlign: "center",
    fontWeight: "700",
  },
});
