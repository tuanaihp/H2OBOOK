import { PublicHomeV3 } from "@/components/public-home-v3";
import { loadPublicHomeV3 } from "@/lib/public-home-v3/loader.server";

export default async function PublicHomeV3PreviewPage() {
  const viewModel = await loadPublicHomeV3();
  return <PublicHomeV3 viewModel={viewModel} />;
}
