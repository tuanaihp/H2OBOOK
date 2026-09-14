import { describe, expect, it } from "vitest";
import {
  invalidSettingsMessage,
  isMissingTableError,
  sanitizeSmartSettings,
  sanitizeWorkspaceSettings
} from "@/lib/settings/organization-settings";

describe("organization settings sanitizer", () => {
  it("keeps editable fields and drops server-owned ones", () => {
    const result = sanitizeWorkspaceSettings({
      id: "workspace_thuyh2o",
      plan: "business",
      storageLimitMb: 999_999,
      name: "  ThuyH2O Academy ",
      slug: "ThuyH2O-Academy",
      email: "Admin@ThuyH2O.vn",
      phone: "+84 901 234 567",
      brandColor: "#A43C6B",
      customDomain: "",
      logoUrl: "https://cdn.thuyh2o.vn/logo.png"
    });
    expect(result.invalid).toEqual([]);
    expect(result.value).toEqual({
      name: "ThuyH2O Academy",
      slug: "thuyh2o-academy",
      email: "admin@thuyh2o.vn",
      phone: "+84 901 234 567",
      brandColor: "#A43C6B",
      customDomain: "",
      logoUrl: "https://cdn.thuyh2o.vn/logo.png"
    });
  });

  it("reports invalid editable fields", () => {
    const result = sanitizeWorkspaceSettings({ name: " ", slug: "bad slug", brandColor: "red", email: "nope", customDomain: "http://x", logoUrl: "http://insecure.vn/a.png" });
    expect(result.invalid.sort()).toEqual(["brandColor", "customDomain", "email", "logoUrl", "name", "slug"]);
    expect(invalidSettingsMessage(["name", "brandColor"])).toBe("Giá trị không hợp lệ: Tên workspace, Màu hệ thống.");
  });

  it("validates smart settings types", () => {
    expect(sanitizeSmartSettings({ aiEnabled: true, assistMode: "external", focusMode: false, extra: 1 })).toEqual({ value: { aiEnabled: true, assistMode: "external", focusMode: false }, invalid: [] });
    expect(sanitizeSmartSettings({ aiEnabled: "yes", assistMode: "cloud" }).invalid).toEqual(["aiEnabled", "assistMode"]);
    expect(sanitizeSmartSettings(null)).toEqual({ value: {}, invalid: [] });
  });

  it("recognizes a missing settings table", () => {
    expect(isMissingTableError({ code: "42P01" })).toBe(true);
    expect(isMissingTableError({ code: "PGRST205", message: "Could not find the table 'public.organization_settings' in the schema cache" })).toBe(true);
    expect(isMissingTableError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
  });
});
