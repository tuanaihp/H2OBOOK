import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BusinessAccessSnapshot } from "./types";

export interface MyOrderRow { id: string; orderCode: string; total: number; currency: string; paymentStatus: string; orderStatus: string; createdAt: string }
export interface MyMembershipRow { id: string; planName: string; status: string; startsAt: string; expiresAt: string | null }
export interface MyEntitlementRow { id: string; resourceType: string; resourceId: string; permission: string; status: string; expiresAt: string | null }

export interface MyCommerceOverview {
  orders: MyOrderRow[];
  membership: MyMembershipRow | null;
  entitlements: MyEntitlementRow[];
}

// "Học viên không thấy tổng doanh thu, tạo sản phẩm, sửa giá hay đơn của người khác"
// (CLAUDE_INTEGRATION_PROMPT.md §11) — every query here is filtered to the caller's own rows;
// RLS (0002/0005) already enforces the same scope independently.
export async function getMyCommerceOverview(access: BusinessAccessSnapshot): Promise<MyCommerceOverview> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { orders: [], membership: null, entitlements: [] };

  const [{ data: orderRows }, { data: membershipRow }, { data: entitlementRows }] = await Promise.all([
    supabase.from("orders").select("id,order_code,total,currency,payment_status,order_status,created_at").eq("buyer_id", access.userId).order("created_at", { ascending: false }).limit(20),
    supabase.from("memberships").select("id,plan_name,status,starts_at,expires_at").eq("user_id", access.userId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("entitlements").select("id,resource_type,resource_id,permission,status,expires_at").eq("user_id", access.userId).eq("status", "active").order("created_at", { ascending: false }).limit(50)
  ]);

  return {
    orders: (orderRows ?? []).map((row) => ({ id: String(row.id), orderCode: String(row.order_code), total: Number(row.total), currency: String(row.currency), paymentStatus: String(row.payment_status), orderStatus: String(row.order_status), createdAt: String(row.created_at) })),
    membership: membershipRow ? { id: String(membershipRow.id), planName: String(membershipRow.plan_name), status: String(membershipRow.status), startsAt: String(membershipRow.starts_at), expiresAt: membershipRow.expires_at ? String(membershipRow.expires_at) : null } : null,
    entitlements: (entitlementRows ?? []).map((row) => ({ id: String(row.id), resourceType: String(row.resource_type), resourceId: String(row.resource_id), permission: String(row.permission), status: String(row.status), expiresAt: row.expires_at ? String(row.expires_at) : null }))
  };
}
