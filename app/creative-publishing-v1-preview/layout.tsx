import { OpsPreviewLayout } from "@/components/operations/preview-guard";
import { isCreativePublishingOpsPreviewEnabled } from "@/lib/creative-publishing-v1/feature";

export const dynamic = "force-dynamic";

export default function CreativePublishingV1PreviewLayout({ children }: { children: React.ReactNode }) {
  return <OpsPreviewLayout enabled={isCreativePublishingOpsPreviewEnabled()}>{children}</OpsPreviewLayout>;
}
