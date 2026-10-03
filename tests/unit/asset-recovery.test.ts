import { describe, expect, it } from "vitest";
import type { H2OBook, H2OElement } from "@/types/editor";
import { mergeMissingBookAssetReferences } from "@/lib/editor/asset-recovery";

const permissions: H2OElement["permissions"] = {
  canEditContent: false, canMove: false, canResize: false, canDelete: false,
  canChangeColor: false, canReplaceAsset: false, canChangeFont: false, canRotate: false,
};

function book(element: H2OElement): H2OBook {
  return {
    id: "import-book", title: "Ảnh", subtitle: "", author: "H2O", cover: "", status: "draft", updatedAt: "2026-10-02T00:00:00.000Z",
    pages: [{ id: "page-1", name: "1.png", width: 794, height: 1123, background: "#fff", elements: [element] }],
  };
}

describe("legacy imported image recovery", () => {
  it("restores an assetId dropped by an older cloud save", () => {
    const cloud = book({ id: "image-1", type: "image", name: "Nền 1.png", x: 0, y: 0, width: 794, height: 1123, rotation: 0, opacity: 1, locked: true, hidden: false, imageFit: "fill", permissions });
    const staged = book({ ...cloud.pages[0].elements[0], assetId: "asset-1", imageUrl: "blob:temporary" });

    const recovered = mergeMissingBookAssetReferences(cloud, staged);

    expect(recovered.pages[0].elements[0].assetId).toBe("asset-1");
    expect(recovered.pages[0].elements[0].imageUrl).toBeUndefined();
  });

  it("does not overwrite a valid cloud asset reference", () => {
    const cloud = book({ id: "image-1", type: "image", name: "Nền 1.png", x: 0, y: 0, width: 794, height: 1123, rotation: 0, opacity: 1, locked: true, hidden: false, assetId: "asset-cloud", imageFit: "fill", permissions });
    const staged = book({ ...cloud.pages[0].elements[0], assetId: "asset-old" });

    expect(mergeMissingBookAssetReferences(cloud, staged)).toBe(cloud);
  });
});
