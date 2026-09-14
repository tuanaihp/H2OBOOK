"use client";

import { useEffect } from "react";
import { loadOrganizationSettings } from "@/lib/settings/organization-settings-client";

/** Loads the organization's server-side settings into the local store for every admin page. */
export function OrganizationSettingsSync() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_APP_MODE !== "production") return;
    void loadOrganizationSettings();
  }, []);
  return null;
}
