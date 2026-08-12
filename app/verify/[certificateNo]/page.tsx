import { CertificateVerification } from "@/components/operations/certificate-verification";
import { lookupPublicCertificate } from "@/lib/stage1-learning-os/credential";

// Was reading lib/operations/data.ts's seedCertificates (2 hardcoded fake records) — certificate_issues
// (migration 0025) has always been the real table; nothing wired /verify/[certificateNo] to it until
// now (docs/stage1-learning-os-v1/01_PRODUCTION_AUDIT.md). lookupPublicCertificate() only ever
// returns the 6 fields the table's own RLS comment names as safe for public verification — never
// verification_token or organization_id, matching why this table has no public SELECT policy at all.
export default async function VerifyCertificatePage({ params }: { params: Promise<{ certificateNo: string }> }) {
  const { certificateNo } = await params;
  const record = await lookupPublicCertificate(decodeURIComponent(certificateNo));
  const certificate = record ? { id: record.certificateNo, verificationToken: "", ...record } : undefined;
  return <CertificateVerification certificateNo={certificateNo} certificate={certificate}/>;
}
