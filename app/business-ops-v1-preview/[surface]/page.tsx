import { notFound } from "next/navigation";
import { BusinessOpsPreview } from "@/components/business-ops-v1";
import { isBusinessOpsV1PreviewEnabled } from "@/lib/business-ops-v1/feature";
import { isBusinessSurface } from "@/lib/business-ops-v1/registry";

export default async function BusinessOpsV1PreviewPage({ params }: { params: Promise<{ surface: string }> }) {
  if (!isBusinessOpsV1PreviewEnabled()) notFound();
  const { surface } = await params;
  if (!isBusinessSurface(surface)) notFound();
  return <BusinessOpsPreview surface={surface}/>;
}
