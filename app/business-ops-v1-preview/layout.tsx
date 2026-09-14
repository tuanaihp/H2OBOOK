import { OpsPreviewLayout } from "@/components/operations/preview-guard";
import { isBusinessOpsV1PreviewEnabled } from "@/lib/business-ops-v1/feature";

export const dynamic = "force-dynamic";

export default function BusinessOpsV1PreviewLayout({ children }: { children: React.ReactNode }) {
  return <OpsPreviewLayout enabled={isBusinessOpsV1PreviewEnabled()}>{children}</OpsPreviewLayout>;
}
