import { PublicAcademyPreviewHub } from "@/components/public-academy-v5";
import { loadPublicAcademyV5 } from "@/lib/public-academy-v5/loader.server";

export default async function PublicAcademyV5PreviewPage() {
  return <PublicAcademyPreviewHub viewModel={await loadPublicAcademyV5()} />;
}
