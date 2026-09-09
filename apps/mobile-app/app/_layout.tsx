import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#005b55" },
        headerTintColor: "#fffaf1",
        headerTitleStyle: { fontWeight: "800" },
        contentStyle: { backgroundColor: "#fffaf1" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="profiles" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="booking" options={{ headerShown: false }} />
      <Stack.Screen name="today" options={{ headerShown: false }} />
      <Stack.Screen name="insurance" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="account" options={{ headerShown: false }} />
      <Stack.Screen name="registrations" options={{ headerShown: false }} />
      <Stack.Screen name="medical/visit/[id]" options={{ title: "Chi tiết lần khám" }} />
      <Stack.Screen name="medical/[type]" options={{ headerShown: false }} />
    </Stack>
  );
}
