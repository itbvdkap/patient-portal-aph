import { Platform } from "react-native";

const sessionCookieKey = "anphucare.portal.sessionCookie";

export async function getStoredSessionCookie() {
  if (Platform.OS === "web") {
    return typeof window === "undefined" ? null : window.localStorage.getItem(sessionCookieKey);
  }

  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(sessionCookieKey);
}

export async function setStoredSessionCookie(cookie: string) {
  const normalized = normalizeCookie(cookie);
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.localStorage.setItem(sessionCookieKey, normalized);
    return;
  }

  const SecureStore = await import("expo-secure-store");
  await SecureStore.setItemAsync(sessionCookieKey, normalized);
}

export async function clearStoredSessionCookie() {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.localStorage.removeItem(sessionCookieKey);
    return;
  }

  const SecureStore = await import("expo-secure-store");
  await SecureStore.deleteItemAsync(sessionCookieKey);
}

function normalizeCookie(cookie: string) {
  return cookie
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.includes("="))
    ?.split(";")[0]
    .trim() ?? cookie;
}
