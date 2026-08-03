import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BusinessAccessSnapshot, CreateAssetReference } from "./types";

// outcome_type (create_outcome_projects, 0027) -> Business asset type. workbook/toolkit/casebook
// are learning artifacts, not commerce-ready Business assets, so projects with those types are
// filtered out here rather than force-mapped onto the wrong bucket.
const OUTCOME_TYPE_TO_ASSET_TYPE: Partial<Record<string, CreateAssetReference["assetType"]>> = {
  portfolio: "portfolio",
  brand_profile: "brand_kit",
  pricing_kit: "pricing",
  content_plan: "content_plan",
  sales_playbook: "sales_script"
};

const STATUS_MAP: Record<string, CreateAssetReference["status"]> = {
  draft: "draft", in_progress: "draft", needs_review: "draft",
  approved: "approved", ready_to_export: "approved",
  published: "published", archived: "draft"
};

export async function getReadyCreateAssets(access: BusinessAccessSnapshot): Promise<CreateAssetReference[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("create_outcome_projects").select("id,title,outcome_type,status").eq("owner_user_id", access.userId).eq("organization_id", access.organizationId);
  const rows: CreateAssetReference[] = [];
  for (const row of data ?? []) {
    const assetType = OUTCOME_TYPE_TO_ASSET_TYPE[String(row.outcome_type)];
    if (!assetType) continue;
    rows.push({ projectId: String(row.id), assetType, title: String(row.title), status: STATUS_MAP[String(row.status)] ?? "draft" });
  }
  return rows;
}

export async function countPublishedContent(access: BusinessAccessSnapshot): Promise<number> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return 0;
  const { count } = await supabase.from("create_outcome_projects").select("id", { count: "exact", head: true }).eq("owner_user_id", access.userId).eq("organization_id", access.organizationId).in("status", ["approved", "published"]);
  return count ?? 0;
}
