import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { getCurrentSession } from "@/lib/portal-api";
import { Screen } from "@/ui/components";
import { colors } from "@/ui/theme";

export default function IndexScreen() {
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const session = await getCurrentSession();
      if (cancelled) return;

      if (!session) {
        router.replace("/login");
        return;
      }

      if (!session.currentMabn) {
        router.replace("/profiles");
        return;
      }

      router.replace("/dashboard");
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    </Screen>
  );
}
