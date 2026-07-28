"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";

const VERSION_KEY = "h2obook-cloud-client-version";

export function CloudSyncAgent() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_APP_MODE !== "production") return;
    let stopped = false;
    let timeout: number | undefined;
    let applyingRemote = false;

    let authorized = false;

    const pull = async () => {
      try {
        const workspace = useAppStore.getState().workspace;
        const response = await fetch(`/api/sync/pull?organizationId=${encodeURIComponent(workspace.id)}`, { cache: "no-store" });
        if (!response.ok || stopped) return;
        const { snapshot } = await response.json();
        if (!snapshot?.payload) return;
        const localVersion = Number(localStorage.getItem(VERSION_KEY) ?? 0);
        if (Number(snapshot.client_version ?? 0) > localVersion) {
          applyingRemote = true;
          useAppStore.getState().importData(snapshot.payload);
          localStorage.setItem(VERSION_KEY, String(snapshot.client_version));
          queueMicrotask(() => { applyingRemote = false; });
        }
      } catch (error) {
        console.error("[H2OBOOK cloud pull]", error);
      }
    };

    const push = () => {
      if (applyingRemote || stopped) return;
      window.clearTimeout(timeout);
      timeout = window.setTimeout(async () => {
        try {
          const state = useAppStore.getState();
          const clientVersion = Date.now();
          const response = await fetch("/api/sync/push", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ organizationId: state.workspace.id, payload: state.exportData(), clientVersion })
          });
          if (response.ok) localStorage.setItem(VERSION_KEY, String(clientVersion));
        } catch (error) {
          console.error("[H2OBOOK cloud push]", error);
        }
      }, 5000);
    };

    const bootstrap = async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
        const sessionPayload = await sessionResponse.json();
        authorized = ["owner", "admin"].includes(sessionPayload.user?.role);
        if (authorized) await pull();
      } catch { authorized = false; }
    };
    void bootstrap();
    const unsubscribe = useAppStore.subscribe(() => { if (authorized) push(); });
    const onOnline = () => { if (authorized) { void pull(); push(); } };
    window.addEventListener("online", onOnline);
    return () => {
      stopped = true;
      window.clearTimeout(timeout);
      unsubscribe();
      window.removeEventListener("online", onOnline);
    };
  }, []);
  return null;
}
