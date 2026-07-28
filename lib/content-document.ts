import type { BookDocument, SemanticContentNode } from "@h2obook/content-core";

export function flattenContentNodes(nodes: SemanticContentNode[]) {
  const result: Array<Omit<SemanticContentNode, "children">> = [];
  const visit = (items: SemanticContentNode[], parentId: string | null) => {
    [...items].sort((a,b)=>a.position-b.position).forEach((node) => {
      const { children, ...flat } = node;
      result.push({ ...flat, parentId });
      visit(children, node.id);
    });
  };
  visit(nodes, null);
  return result;
}

export function nestContentNodes(rows: Array<Record<string, unknown>>) {
  const map = new Map<string, SemanticContentNode>();
  rows.forEach((row) => map.set(String(row.id), {
    id: String(row.id), type: String(row.node_type) as SemanticContentNode["type"],
    parentId: row.parent_id ? String(row.parent_id) : null, position: Number(row.position ?? 0),
    text: Array.isArray(row.text_content) ? row.text_content as SemanticContentNode["text"] : [],
    attrs: (row.attrs ?? {}) as Record<string,unknown>, children: [], version: Number(row.version ?? 1)
  }));
  const root: SemanticContentNode[] = [];
  map.forEach((node) => { if (node.parentId && map.has(node.parentId)) map.get(node.parentId)!.children.push(node); else root.push(node); });
  const sort = (nodes: SemanticContentNode[]) => nodes.sort((a,b)=>a.position-b.position).forEach((node)=>sort(node.children));
  sort(root); return root;
}

export function documentPayload(document: BookDocument) {
  return { title: document.title, language: document.language, metadata: document.metadata, version: document.version, nodes: flattenContentNodes(document.root) };
}
