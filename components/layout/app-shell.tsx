import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CloudSyncAgent } from "@/components/providers/cloud-sync-agent";
import { SmartUIProvider } from "@/components/providers/smart-ui-provider";
import { PWARegister } from "@/components/providers/pwa-register";
import { CommandCenter } from "@/components/smart/command-center";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="app-shell quantum-shell"><SmartUIProvider/><PWARegister/><CloudSyncAgent/><Sidebar/><main className="main-area"><Topbar/><CommandCenter/><div className="page-content">{children}</div></main></div>;
}
