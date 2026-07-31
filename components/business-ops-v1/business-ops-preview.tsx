"use client";

import { useEffect, type ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { emitBusinessEvent } from "@/lib/business-ops-v1/events";
import type { BusinessSurface } from "@/lib/business-ops-v1/types";
import { AnalyticsOpsV1 } from "./pages/analytics-ops-v1";
import { GrowthReaderOpsV1 } from "./pages/growth-reader-ops-v1";
import { LicensingRoyaltyV1 } from "./pages/licensing-royalty-v1";
import { MarketplaceStudioV1 } from "./pages/marketplace-studio-v1";
import { MembershipOpsV1 } from "./pages/membership-ops-v1";
import { OrdersEntitlementsV1 } from "./pages/orders-entitlements-v1";
import { StoreCommerceV1 } from "./pages/store-commerce-v1";
import { WhiteLabelPortalsV1 } from "./pages/white-label-portals-v1";

export function BusinessOpsPreview({ surface }: { surface: BusinessSurface }) {
  useEffect(() => { emitBusinessEvent({ name: "business_surface_viewed", surface }); }, [surface]);
  const pages = {
    analytics: <AnalyticsOpsV1/>,
    "growth-reader": <GrowthReaderOpsV1/>,
    licensing: <LicensingRoyaltyV1/>,
    "marketplace-studio": <MarketplaceStudioV1/>,
    membership: <MembershipOpsV1/>,
    orders: <OrdersEntitlementsV1/>,
    store: <StoreCommerceV1/>,
    "white-label": <WhiteLabelPortalsV1/>,
  } satisfies Record<BusinessSurface, ReactNode>;
  return <AppShell>{pages[surface]}</AppShell>;
}
