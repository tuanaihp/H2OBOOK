import type { BookDocument, SemanticContentNode } from "./types";

export type ContentOperation =
  | { type: "insert_node"; parentId: string | null; node: SemanticContentNode }
  | { type: "update_node"; nodeId: string; patch: Partial<Omit<SemanticContentNode, "id" | "children">> }
  | { type: "delete_node"; nodeId: string }
  | { type: "move_node"; nodeId: string; parentId: string | null; position: number };

function mapNodes(nodes: SemanticContentNode[], fn: (node: SemanticContentNode) => SemanticContentNode | null): SemanticContentNode[] {
  return nodes.flatMap((node) => {
    const changed = fn({ ...node, children: mapNodes(node.children, fn) });
    return changed ? [changed] : [];
  });
}

function findNode(nodes: SemanticContentNode[], nodeId: string): SemanticContentNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const nested = findNode(node.children, nodeId);
    if (nested) return nested;
  }
  return null;
}

export function applyContentOperation(document: BookDocument, operation: ContentOperation): BookDocument {
  let root = structuredClone(document.root);
  if (operation.type === "update_node") {
    root = mapNodes(root, (node) => node.id === operation.nodeId ? { ...node, ...operation.patch, version: node.version + 1 } : node);
  }
  if (operation.type === "delete_node") root = mapNodes(root, (node) => node.id === operation.nodeId ? null : node);
  if (operation.type === "insert_node") {
    if (!operation.parentId) root = [...root, operation.node];
    else root = mapNodes(root, (node) => node.id === operation.parentId ? { ...node, children: [...node.children, operation.node] } : node);
  }
  if (operation.type === "move_node") {
    const moving = findNode(root, operation.nodeId);
    if (moving) {
      root = mapNodes(root, (node) => node.id === operation.nodeId ? null : node);
      const moved: SemanticContentNode = { ...moving, parentId: operation.parentId, position: operation.position, version: moving.version + 1 };
      if (!operation.parentId) root.push(moved);
      else root = mapNodes(root, (node) => node.id === operation.parentId ? { ...node, children: [...node.children, moved] } : node);
    }
  }
  return { ...document, root, version: document.version + 1, updatedAt: new Date().toISOString() };
}
