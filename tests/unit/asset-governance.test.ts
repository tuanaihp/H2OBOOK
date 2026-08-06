import { describe, expect, it } from "vitest";
import { ASSET_SUBTYPES, ASSET_TYPES, assetDisplayName, filtersToQuery, queryToFilters } from "@/lib/assets/governance";

// The filter shape crosses the network: the page builds a query string and the API parses it back.
// If those two disagree the page silently shows the wrong rows, so the round trip is pinned here.

describe("filter round trip", () => {
  it("survives a full set of filters unchanged", () => {
    const filters = { search: "cô dâu", assetType: "image", classificationStatus: "unclassified", reviewStatus: "pending", lifecycleStatus: "active", folderId: "folder-1", unfiled: true };
    expect(queryToFilters(new URLSearchParams(filtersToQuery(filters)))).toEqual(filters);
  });

  it("omits empty filters rather than sending blank values the API would have to ignore", () => {
    expect(filtersToQuery({})).toBe("");
    expect(filtersToQuery({ search: "   " })).toBe("");
  });

  it("drops a value that is not in the allowed list", () => {
    // Straight from a hand-edited URL. An unknown asset_type would otherwise reach the query and
    // return nothing, which reads as "no assets" rather than "bad filter".
    const parsed = queryToFilters(new URLSearchParams("assetType=not-a-type&reviewStatus=pending"));
    expect(parsed.assetType).toBeUndefined();
    expect(parsed.reviewStatus).toBe("pending");
  });

  it("treats unfiled as off unless it is exactly 1", () => {
    expect(queryToFilters(new URLSearchParams("unfiled=1")).unfiled).toBe(true);
    expect(queryToFilters(new URLSearchParams("unfiled=true")).unfiled).toBe(false);
    expect(queryToFilters(new URLSearchParams()).unfiled).toBe(false);
  });
});

describe("assetDisplayName", () => {
  it("prefers a curated title over the filename", () => {
    expect(assetDisplayName({ title: "Nền cô dâu trong trẻo", original_name: "IMG_4821.jpg" })).toBe("Nền cô dâu trong trẻo");
  });

  it("falls back to the filename when the title is missing or blank", () => {
    expect(assetDisplayName({ title: null, original_name: "IMG_4821.jpg" })).toBe("IMG_4821.jpg");
    expect(assetDisplayName({ title: "   ", original_name: "IMG_4821.jpg" })).toBe("IMG_4821.jpg");
  });

  it("never renders empty, so a row is always clickable", () => {
    expect(assetDisplayName({ title: null, original_name: null })).toBeTruthy();
  });
});

describe("taxonomy", () => {
  it("keeps every subtype under a real asset type", () => {
    for (const type of Object.keys(ASSET_SUBTYPES)) {
      expect(ASSET_TYPES as readonly string[], `${type} is not an asset type`).toContain(type);
    }
  });
});
