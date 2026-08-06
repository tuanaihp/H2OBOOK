// Pure rules for asset organisation. No server import, so the API and the page share one copy and
// the rules can be tested without a database.

export interface FolderNode {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  position: number;
  archivedAt: string | null;
  assetCount: number;
  children: FolderNode[];
}

export interface FolderRow {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  position: number;
  archivedAt: string | null;
}

/** Slug that survives Vietnamese input and matches what migration 0038 generates in SQL. */
export function toAssetSlug(value: string): string {
  return value
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Whether moving `folderId` under `newParentId` would create a cycle.
 *
 * A → B → A never renders and makes a recursive walk run forever. Postgres cannot express this as a
 * check constraint — it is a traversal, not a predicate — so it is enforced before the write, the
 * same way prerequisite chains are handled in the assignment curriculum. The walk is bounded by the
 * number of folders, so a cycle already present in the data cannot spin.
 */
export function wouldCreateCycle(folders: FolderRow[], folderId: string, newParentId: string | null): boolean {
  if (!newParentId) return false;
  if (newParentId === folderId) return true;
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const seen = new Set<string>([folderId]);
  let cursor: string | null = newParentId;
  while (cursor) {
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = byId.get(cursor)?.parentId ?? null;
  }
  return false;
}

/** Rows to a tree, ordered by position then name. Orphans (archived parent) surface at the root. */
export function buildFolderTree(folders: FolderRow[], counts: Record<string, number> = {}): FolderNode[] {
  const nodes = new Map<string, FolderNode>();
  for (const folder of folders) {
    nodes.set(folder.id, { ...folder, assetCount: counts[folder.id] ?? 0, children: [] });
  }
  const roots: FolderNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: FolderNode[]) => {
    list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "vi"));
    for (const node of list) sort(node.children);
  };
  sort(roots);
  return roots;
}

/** Folder plus every descendant, so a subtree can be counted or moved as one. */
export function collectSubtreeIds(folders: FolderRow[], folderId: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const folder of folders) {
    if (!folder.parentId) continue;
    childrenOf.set(folder.parentId, [...(childrenOf.get(folder.parentId) ?? []), folder.id]);
  }
  const out: string[] = [];
  const walk = (id: string) => {
    if (out.includes(id)) return;
    out.push(id);
    for (const child of childrenOf.get(id) ?? []) walk(child);
  };
  walk(folderId);
  return out;
}

export type OrganizationRole = "owner" | "admin" | "designer" | "partner" | "teacher" | "student";

/**
 * Who may change shared organisation structure — folders, tags, and workspace-wide saved views.
 *
 * Designers curate assets, so they are included. Teachers are not: their scope is their own classes
 * and submissions, and renaming a workspace-wide tag reaches every screen in the product. The UI
 * hides these controls for anyone else, but the API applies this same rule, because a hidden button
 * is not a permission check.
 */
export function canManageAssetOrganization(role: string): boolean {
  return role === "owner" || role === "admin" || role === "designer";
}

/** A private view belongs to whoever made it; a workspace view follows the rule above. */
export function canEditSavedView(role: string, view: { isShared: boolean; createdBy: string | null }, userId: string): boolean {
  if (view.isShared) return canManageAssetOrganization(role);
  return view.createdBy === userId;
}
