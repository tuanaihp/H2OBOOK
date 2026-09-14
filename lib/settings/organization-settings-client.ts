"use client";

import { useAppStore } from "@/store/app-store";
import type { SmartSettings, Workspace } from "@/types/domain";
import type { OrganizationSettingsPayload } from "./organization-settings";

export type SettingsSaveResult =
  | { status: "saved" }
  | { status: "local"; message: string }
  | { status: "error"; message: string };

let serverSettings: OrganizationSettingsPayload | null = null;
let loading: Promise<OrganizationSettingsPayload | null> | null = null;
let saveQueue: Promise<unknown> = Promise.resolve();

/**
 * Applies the server copy over the local store. Also called after CloudSyncAgent imports an older
 * whole-store snapshot, so that snapshot can never roll settings back.
 */
export function applyServerSettings() {
  if (serverSettings?.mode !== "production") return;
  const store = useAppStore.getState();
  if (Object.keys(serverSettings.workspace).length) store.updateWorkspace(serverSettings.workspace);
  if (Object.keys(serverSettings.smartSettings).length) store.updateSmartSettings(serverSettings.smartSettings);
}

/** Fetches once per page load; later callers share the same request. */
export function loadOrganizationSettings(): Promise<OrganizationSettingsPayload | null> {
  loading ??= (async () => {
    try {
      const organizationId = useAppStore.getState().workspace.id;
      const response = await fetch(`/api/settings/organization?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      if (!response.ok) return null;
      serverSettings = await response.json() as OrganizationSettingsPayload;
      applyServerSettings();
      return serverSettings;
    } catch {
      return null;
    }
  })();
  return loading;
}

/** Saves are serialized so an older toggle can never land after a newer one. */
export function saveOrganizationSettings(patch: { workspace?: Partial<Workspace>; smartSettings?: Partial<SmartSettings> }): Promise<SettingsSaveResult> {
  const run = async (): Promise<SettingsSaveResult> => {
    try {
      const response = await fetch("/api/settings/organization", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: useAppStore.getState().workspace.id, ...patch }),
        signal: AbortSignal.timeout(15_000)
      });
      const payload = await response.json().catch(() => null) as (OrganizationSettingsPayload & { error?: string; message?: string }) | null;
      if (response.ok && payload?.mode === "production") {
        serverSettings = payload;
        return { status: "saved" };
      }
      if (response.ok) return { status: "local", message: "Chế độ demo: cài đặt chỉ được lưu trên trình duyệt này." };
      if (payload?.error === "SETTINGS_NOT_MIGRATED") return { status: "local", message: payload.message ?? "Máy chủ chưa sẵn sàng; cài đặt chỉ được lưu trên trình duyệt này." };
      return { status: "error", message: payload?.message ?? "Không lưu được cài đặt lên máy chủ." };
    } catch {
      return { status: "error", message: "Mất kết nối — cài đặt mới chỉ được lưu trên trình duyệt này." };
    }
  };
  const next = saveQueue.then(run, run);
  saveQueue = next;
  return next;
}
