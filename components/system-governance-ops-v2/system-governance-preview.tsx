"use client";
import { useEffect } from "react";
import type { ComponentType } from "react";
import { isSystemSurface } from "@/lib/system-governance-ops-v2/registry";
import type { SystemSurface } from "@/lib/system-governance-ops-v2/types";
import { emitSystemEvent } from "@/lib/system-governance-ops-v2/events";
import { SystemSurfaceNav } from "./system-shared";
import { AccountV2 } from "./pages/account-v2";
import { AdminV2 } from "./pages/admin-v2";
import { AssistControlV2 } from "./pages/assist-control-v2";
import { CloudSyncV2 } from "./pages/cloud-sync-v2";
import { EnterpriseV2 } from "./pages/enterprise-v2";
import { IntegrationsV2 } from "./pages/integrations-v2";
import { OfflineV2 } from "./pages/offline-v2";
import { SecurityV2 } from "./pages/security-v2";
import { SettingsV2 } from "./pages/settings-v2";
import { SmartSettingsV2 } from "./pages/smart-settings-v2";
import { OperationsV2 } from "./pages/operations-v2";
import { OperationsAdmissionsV2 } from "./pages/operations-admissions-v2";
import { OperationsApprovalsV2 } from "./pages/operations-approvals-v2";
import { OperationsAutomationCenterV2 } from "./pages/operations-automation-center-v2";
import { OperationsImportCenterV2 } from "./pages/operations-import-center-v2";
import { OperationsNotificationsV2 } from "./pages/operations-notifications-v2";
import { OperationsProductConfigV2 } from "./pages/operations-product-config-v2";
import { OperationsSupportV2 } from "./pages/operations-support-v2";
import { OperationsSystemHealthV2 } from "./pages/operations-system-health-v2";
import styles from "./system-governance-ops-v2.module.css";

const pages: Record<SystemSurface, ComponentType> = {
  account: AccountV2,
  admin: AdminV2,
  "assist-control": AssistControlV2,
  "cloud-sync": CloudSyncV2,
  enterprise: EnterpriseV2,
  integrations: IntegrationsV2,
  offline: OfflineV2,
  security: SecurityV2,
  settings: SettingsV2,
  "smart-settings": SmartSettingsV2,
  operations: OperationsV2,
  "operations-admissions": OperationsAdmissionsV2,
  "operations-approvals": OperationsApprovalsV2,
  "operations-automation-center": OperationsAutomationCenterV2,
  "operations-import-center": OperationsImportCenterV2,
  "operations-notifications": OperationsNotificationsV2,
  "operations-product-config": OperationsProductConfigV2,
  "operations-support": OperationsSupportV2,
  "operations-system-health": OperationsSystemHealthV2,
};

export function SystemGovernanceOperationsPreview({ surface }: { surface: string }) {
  const active: SystemSurface = isSystemSurface(surface) ? surface : "admin";
  const Page = pages[active];
  useEffect(() => emitSystemEvent(active.startsWith("operations") ? "operations_surface_viewed" : "system_surface_viewed", { surface: active }), [active]);
  return <main className={styles.surface}><SystemSurfaceNav active={active}/><Page/></main>;
}
