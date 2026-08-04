import type { Metadata } from "next";
import { PublicAcademyLoginPage } from "@/components/public-academy-v5";
import { isAuthExperienceV2Enabled } from "@/lib/public-academy-v5/feature";
import { loadPublicAcademyV5 } from "@/lib/public-academy-v5/loader.server";
import { LegacyLoginForm } from "@/components/marketing/legacy-login-form";

// §4.5: auth pages have no reason to be indexed.
export const metadata: Metadata = { title: "Đăng nhập", robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (isAuthExperienceV2Enabled()) return <PublicAcademyLoginPage viewModel={await loadPublicAcademyV5()} />;
  return <LegacyLoginForm />;
}
