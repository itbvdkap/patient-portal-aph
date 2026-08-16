import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cổng thông tin bệnh nhân An Phú",
  description: "MVP Patient Portal cho Bệnh viện Đa khoa An Phú",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "An Phú",
  },
};

export const viewport: Viewport = {
  themeColor: "#005b55",
  width: "device-width",
  initialScale: 1,
};

const sans = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
});

const serif = Fraunces({
  subsets: ["latin", "vietnamese"],
  variable: "--font-serif",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={`${sans.variable} ${serif.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
