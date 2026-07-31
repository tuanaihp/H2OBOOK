"use client";

import { useEffect, type ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { emitCreativeEvent } from "@/lib/creative-publishing-v1/events";
import type { CreativeSurface } from "@/lib/creative-publishing-v1/types";
import { AssetCenterV1 } from "./pages/asset-center-v1";
import { BlockLibraryV1 } from "./pages/block-library-v1";
import { BookProjectsV1 } from "./pages/book-projects-v1";
import { BrandKitV1 } from "./pages/brand-kit-v1";
import { BulkPublishingV1 } from "./pages/bulk-publishing-v1";
import { CloneCenterV1 } from "./pages/clone-center-v1";
import { ContentHealthV1 } from "./pages/content-health-v1";
import { DesignLibraryV1 } from "./pages/design-library-v1";
import { EditorStudioV1 } from "./pages/editor-studio-v1";
import { IngestionV1 } from "./pages/ingestion-v1";
import { PublishCenterV1 } from "./pages/publish-center-v1";
import { TemplateLibraryV1 } from "./pages/template-library-v1";

export function CreativePublishingPreview({ surface }: { surface: CreativeSurface }) {
  useEffect(() => {
    emitCreativeEvent({ name: "creative_surface_viewed", surface });
  }, [surface]);

  const content = {
    assets: <AssetCenterV1/>,
    blocks: <BlockLibraryV1/>,
    books: <BookProjectsV1/>,
    "brand-kit": <BrandKitV1/>,
    "bulk-publishing": <BulkPublishingV1/>,
    clones: <CloneCenterV1/>,
    "content-health": <ContentHealthV1/>,
    "design-library": <DesignLibraryV1/>,
    editor: <EditorStudioV1/>,
    ingestion: <IngestionV1/>,
    publish: <PublishCenterV1/>,
    templates: <TemplateLibraryV1/>,
  } satisfies Record<CreativeSurface, ReactNode>;

  return <AppShell>{content[surface]}</AppShell>;
}
