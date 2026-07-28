import type { DomainResource } from "./resource-config";

export async function listDomainRows<T>(resource: DomainResource, organizationId?: string): Promise<T[]> {
  const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
  const response = await fetch(`/api/domain/${resource}${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Cannot load ${resource}`);
  return (await response.json()).data as T[];
}

export async function createDomainRow<T>(resource: DomainResource, input: Record<string, unknown>, organizationId?: string): Promise<T> {
  const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
  const response = await fetch(`/api/domain/${resource}${query}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error(`Cannot create ${resource}`);
  return (await response.json()).data as T;
}

export async function updateDomainRow<T>(resource: DomainResource, id: string, patch: Record<string, unknown>, organizationId?: string): Promise<T> {
  const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
  const response = await fetch(`/api/domain/${resource}/${id}${query}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
  if (!response.ok) throw new Error(`Cannot update ${resource}`);
  return (await response.json()).data as T;
}
