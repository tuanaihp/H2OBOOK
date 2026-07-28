export type JsonPath = Array<string | number>;
export type JsonPatchOperation =
  | { op: "add" | "replace"; path: JsonPath; value: unknown }
  | { op: "remove"; path: JsonPath; oldValue: unknown };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sameArrayIdentity(before: unknown[], after: unknown[]) {
  if (before.length !== after.length) return false;
  return before.every((item, index) => {
    const left = isObject(item) ? item.id : undefined;
    const right = isObject(after[index]) ? after[index].id : undefined;
    return left !== undefined && left === right;
  });
}

export function diffJson(before: unknown, after: unknown, path: JsonPath = []): JsonPatchOperation[] {
  if (Object.is(before, after)) return [];
  if (Array.isArray(before) && Array.isArray(after)) {
    if (!sameArrayIdentity(before, after)) return [{ op: "replace", path, value: structuredClone(after) }];
    return before.flatMap((value, index) => diffJson(value, after[index], [...path, index]));
  }
  if (isObject(before) && isObject(after)) {
    const operations: JsonPatchOperation[] = [];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    keys.forEach((key) => {
      if (!(key in after)) operations.push({ op: "remove", path: [...path, key], oldValue: structuredClone(before[key]) });
      else if (!(key in before)) operations.push({ op: "add", path: [...path, key], value: structuredClone(after[key]) });
      else operations.push(...diffJson(before[key], after[key], [...path, key]));
    });
    return operations;
  }
  return [{ op: "replace", path, value: structuredClone(after) }];
}

function parentAt(root: unknown, path: JsonPath) {
  let current = root as Record<string | number, unknown>;
  for (const segment of path.slice(0, -1)) current = current[segment] as Record<string | number, unknown>;
  return { parent: current, key: path[path.length - 1] };
}

export function applyJsonPatch<T>(input: T, operations: JsonPatchOperation[]): T {
  let root = structuredClone(input) as unknown;
  for (const operation of operations) {
    if (!operation.path.length) {
      if (operation.op === "remove") root = undefined;
      else root = structuredClone(operation.value);
      continue;
    }
    const { parent, key } = parentAt(root, operation.path);
    if (operation.op === "remove") {
      if (Array.isArray(parent)) parent.splice(Number(key), 1);
      else delete parent[key];
    } else if (operation.op === "add" && Array.isArray(parent)) parent.splice(Number(key), 0, structuredClone(operation.value));
    else parent[key] = structuredClone(operation.value);
  }
  return root as T;
}

export function invertPatch(before: unknown, after: unknown) {
  return diffJson(after, before);
}
