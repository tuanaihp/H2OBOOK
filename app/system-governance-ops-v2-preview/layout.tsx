import { OpsPreviewLayout } from "@/components/operations/preview-guard";
import { isSystemGovernanceOpsV2PreviewEnabled } from "@/lib/system-governance-ops-v2/feature";

export const dynamic = "force-dynamic";

export default function SystemGovernanceOpsV2PreviewLayout({ children }: { children: React.ReactNode }) {
  return <OpsPreviewLayout enabled={isSystemGovernanceOpsV2PreviewEnabled()}>{children}</OpsPreviewLayout>;
}
