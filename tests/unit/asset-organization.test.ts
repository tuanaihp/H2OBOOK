import { describe, expect, it } from "vitest";
import {
  buildFolderTree, canEditSavedView, canManageAssetOrganization, collectSubtreeIds,
  toAssetSlug, wouldCreateCycle, type FolderRow
} from "@/lib/assets/organization-rules";
import { PAGE_SIZE, filtersToQuery, queryToFilters, queryToPaging } from "@/lib/assets/governance";

// These are the rules the API enforces before every write. They are pure so the decisions can be
// pinned without a database; the organisation-isolation and RLS halves are database behaviour and
// are covered by pnpm test:sql and by the policies in migrations 0037/0038, not here — stated in
// docs/module-0038-asset-organization-test-report.md rather than faked with a mock.

function folder(id: string, parentId: string | null, name = id, position = 0): FolderRow {
  return { id, parentId, name, slug: toAssetSlug(name), position, archivedAt: null };
}

describe("slug", () => {
  it("keeps Vietnamese names recognisable", () => {
    expect(toAssetSlug("Ảnh cô dâu")).toBe("anh-co-dau");
    expect(toAssetSlug("Học liệu — Buổi 1")).toBe("hoc-lieu-buoi-1");
    expect(toAssetSlug("Đầu vào")).toBe("dau-vao");
  });

  it("collapses names that differ only by punctuation, which is what makes the unique index bite", () => {
    expect(toAssetSlug("Ảnh cô dâu")).toBe(toAssetSlug("  Ảnh   cô dâu!!  "));
  });
});

describe("folder cycles", () => {
  const folders = [folder("a", null), folder("b", "a"), folder("c", "b")];

  it("refuses a folder as its own parent", () => {
    expect(wouldCreateCycle(folders, "a", "a")).toBe(true);
  });

  it("refuses moving a folder under its own descendant", () => {
    // a → b → c; moving a under c would close the loop and the tree would never render.
    expect(wouldCreateCycle(folders, "a", "c")).toBe(true);
  });

  it("allows a move that keeps the tree acyclic", () => {
    expect(wouldCreateCycle(folders, "c", "a")).toBe(false);
    expect(wouldCreateCycle(folders, "c", null)).toBe(false);
  });

  it("terminates even when the stored data already contains a cycle", () => {
    const corrupt = [folder("x", "y"), folder("y", "x")];
    expect(wouldCreateCycle(corrupt, "z", "x")).toBe(true);
  });
});

describe("subtree", () => {
  it("collects a folder and every descendant, which is what archive and the not-empty check act on", () => {
    const folders = [folder("a", null), folder("b", "a"), folder("c", "b"), folder("d", null)];
    expect(collectSubtreeIds(folders, "a").sort()).toEqual(["a", "b", "c"]);
    expect(collectSubtreeIds(folders, "d")).toEqual(["d"]);
  });
});

describe("folder tree", () => {
  it("nests children and orders by position then name", () => {
    const folders = [folder("root", null), folder("second", "root", "Bê", 2), folder("first", "root", "Ẩn", 1)];
    const tree = buildFolderTree(folders, { root: 3, first: 1 });
    expect(tree).toHaveLength(1);
    expect(tree[0].assetCount).toBe(3);
    expect(tree[0].children.map((child) => child.id)).toEqual(["first", "second"]);
  });

  it("surfaces a folder whose parent is missing rather than dropping it", () => {
    // An archived parent is filtered out of the list; its children must not disappear with it.
    const tree = buildFolderTree([folder("orphan", "gone")]);
    expect(tree.map((node) => node.id)).toEqual(["orphan"]);
  });
});

describe("who may manage shared structure", () => {
  it("allows owner, admin and designer", () => {
    for (const role of ["owner", "admin", "designer"]) expect(canManageAssetOrganization(role)).toBe(true);
  });

  it("refuses teacher, partner and student", () => {
    // Renaming a workspace tag reaches every screen; an instructor's scope is their own classes.
    for (const role of ["teacher", "partner", "student"]) expect(canManageAssetOrganization(role)).toBe(false);
  });
});

describe("saved view ownership", () => {
  const mine = { isShared: false, createdBy: "user-1" };
  const theirs = { isShared: false, createdBy: "user-2" };
  const shared = { isShared: true, createdBy: "user-2" };

  it("lets anyone edit their own private view", () => {
    expect(canEditSavedView("teacher", mine, "user-1")).toBe(true);
  });

  it("refuses editing someone else's private view, whatever the role", () => {
    expect(canEditSavedView("owner", theirs, "user-1")).toBe(false);
  });

  it("gates a workspace view behind the manage role, not ownership", () => {
    expect(canEditSavedView("admin", shared, "user-1")).toBe(true);
    expect(canEditSavedView("teacher", shared, "user-2")).toBe(false);
  });
});

describe("saved view filters survive pagination", () => {
  it("round-trips filters together with page and sort", () => {
    const query = { assetType: "image", tagId: "tag-1", page: 3, sortBy: "size_bytes" as const, sortDirection: "asc" as const };
    const params = new URLSearchParams(filtersToQuery(query));
    expect(queryToFilters(params).assetType).toBe("image");
    expect(queryToFilters(params).tagId).toBe("tag-1");
    expect(queryToPaging(params)).toEqual({ page: 3, sortBy: "size_bytes", sortDirection: "asc" });
  });

  it("keeps the filters when only the page changes, so page 2 of a view is the same view", () => {
    const base = { assetType: "image", classificationStatus: "unclassified" };
    const pageOne = queryToFilters(new URLSearchParams(filtersToQuery({ ...base, page: 1 })));
    const pageTwo = queryToFilters(new URLSearchParams(filtersToQuery({ ...base, page: 2 })));
    expect(pageOne).toEqual(pageTwo);
  });

  it("falls back rather than passing an unknown sort column to the query", () => {
    expect(queryToPaging(new URLSearchParams("sortBy=; drop table assets")).sortBy).toBe("created_at");
    expect(queryToPaging(new URLSearchParams("page=-4")).page).toBe(1);
    expect(queryToPaging(new URLSearchParams("page=abc")).page).toBe(1);
  });

  it("uses a page size the client and server agree on", () => {
    expect(PAGE_SIZE).toBeGreaterThan(0);
  });
});
