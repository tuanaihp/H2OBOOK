import { notFound } from "next/navigation";
import { SystemGovernanceOperationsPreview } from "@/components/system-governance-ops-v2";
import { isSystemGovernanceOpsV2PreviewEnabled } from "@/lib/system-governance-ops-v2/feature";

export default async function SystemGovernanceOperationsPreviewPage({ params }: { params: Promise<{ surface: string }> }) {
  if (!isSystemGovernanceOpsV2PreviewEnabled()) notFound();
  const { surface } = await params;
  return <SystemGovernanceOperationsPreview surface={surface}/>;
}
