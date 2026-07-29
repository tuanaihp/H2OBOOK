import { AnalyticsProvider } from "@/components/providers/analytics-provider";
import { NeuralRouteTheme } from "@/components/global-neural";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/styles/global-neural-system.css";

export const metadata: Metadata = {
  title: { default: "H2OBOOK 4.14 · AI Learning Universe", template: "%s | H2OBOOK" },
  description: "Hệ sinh thái sách, khóa học, chiến lược nghề Makeup và trải nghiệm học viên thông minh của ThuyH2O Makeup Academy.",
  applicationName: "H2OBOOK",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" }
};

export const viewport: Viewport = { themeColor: "#0b1523", colorScheme: "light dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body><AnalyticsProvider/><NeuralRouteTheme/>{children}</body></html>;
}
