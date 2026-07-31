import { notFound } from "next/navigation";
import { CreativePublishingPreview } from "@/components/creative-publishing-v1";
import { creativeSurfaces, isCreativeSurface } from "@/lib/creative-publishing-v1/registry";
import { isCreativePublishingOpsPreviewEnabled } from "@/lib/creative-publishing-v1/feature";

export function generateStaticParams() {
  return creativeSurfaces.map((surface) => ({ surface }));
}

export default async function CreativePublishingPreviewPage({ params }: { params: Promise<{ surface: string }> }) {
  if (!isCreativePublishingOpsPreviewEnabled()) notFound();
  const { surface } = await params;
  if (!isCreativeSurface(surface)) notFound();
  return <CreativePublishingPreview surface={surface}/>;
}
