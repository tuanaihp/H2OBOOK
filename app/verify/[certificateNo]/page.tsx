import { CertificateVerification } from "@/components/operations/certificate-verification";
import { seedCertificates } from "@/lib/operations/data";

export default async function VerifyCertificatePage({ params }: { params: Promise<{ certificateNo: string }> }) {
  const { certificateNo } = await params;
  const certificate = seedCertificates.find((item) => item.certificateNo.toLowerCase() === decodeURIComponent(certificateNo).toLowerCase());
  return <CertificateVerification certificateNo={certificateNo} certificate={certificate}/>;
}
