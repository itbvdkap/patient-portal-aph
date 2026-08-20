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
      <Stack.Screen name="login" options={{ title: "Đăng nhập" }} />
      <Stack.Screen name="profiles" options={{ title: "Chọn hồ sơ" }} />
      <Stack.Screen name="dashboard" options={{ title: "An Phú Care" }} />
      <Stack.Screen name="booking" options={{ title: "Đăng ký khám" }} />
      <Stack.Screen name="today" options={{ title: "Khám hôm nay" }} />
      <Stack.Screen name="insurance" options={{ title: "BHYT điện tử" }} />
      <Stack.Screen name="account" options={{ title: "Tài khoản" }} />
      <Stack.Screen name="registrations" options={{ title: "Lịch sử đăng ký" }} />
      <Stack.Screen name="medical/visit/[id]" options={{ title: "Chi tiết lần khám" }} />
      <Stack.Screen name="medical/[type]" options={{ title: "Hồ sơ y tế" }} />
    </Stack>
  );
}
