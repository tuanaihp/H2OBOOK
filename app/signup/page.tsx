import type { Metadata } from "next";
import { SignupForm } from "@/components/marketing/signup-form";

// §4.5: auth pages have no reason to be indexed. Extracted the form into a client component so
// this page can be a Server Component and export metadata (Next.js requires Server Components
// for metadata exports).
export const metadata: Metadata = { title: "Đăng ký", robots: { index: false, follow: false } };

export default function SignupPage() {
  return <SignupForm />;
}
