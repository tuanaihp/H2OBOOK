import "server-only";
import { buildBusinessCommandView } from "./command-center";
import { getMyGoals } from "./goals";
import { getMyOpportunities } from "./opportunities";
import { countPublishedContent, getReadyCreateAssets } from "./assets";
import type { BusinessAccessSnapshot, BusinessCommandView, CreateAssetReference } from "./types";

export interface BusinessCommandCenterSummary {
  view: BusinessCommandView;
  readyAssets: CreateAssetReference[];
}

export async function buildBusinessCommandCenterSummary(access: BusinessAccessSnapshot): Promise<BusinessCommandCenterSummary> {
  const [opportunities, goals, publishedContent, readyAssets] = await Promise.all([
    getMyOpportunities(access),
    getMyGoals(access),
    countPublishedContent(access),
    getReadyCreateAssets(access)
  ]);
  const view = buildBusinessCommandView(access, opportunities, goals, publishedContent);
  return { view, readyAssets };
}
