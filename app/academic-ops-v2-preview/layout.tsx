import { OpsPreviewLayout } from "@/components/operations/preview-guard";
import { isAcademicOperationsPreviewEnabled } from "@/lib/academic-ops-v2/feature";

export const dynamic = "force-dynamic";

export default function AcademicOpsV2PreviewLayout({ children }: { children: React.ReactNode }) {
  return <OpsPreviewLayout enabled={isAcademicOperationsPreviewEnabled()}>{children}</OpsPreviewLayout>;
}
