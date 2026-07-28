import { AnalyticsProvider } from "@/components/providers/analytics-provider";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "H2OBOOK Professional Editor 4.12", template: "%s | H2OBOOK" },
  description: "Nền tảng tạo sách, học tập, đào tạo và kinh doanh nội dung theo kiến trúc offline-first, AI tùy chọn.",
  applicationName: "H2OBOOK",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" }
};

export const viewport: Viewport = { themeColor: "#0b1523", colorScheme: "light dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body><AnalyticsProvider/>{children}</body></html>;
}
