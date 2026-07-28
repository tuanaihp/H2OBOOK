import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth/current-user";
import { resolveOrganizationAccess } from "@/lib/auth/api";
import { DOMAIN_RESOURCES, type DomainResource } from "./resource-config";
import { DomainRepository, type DomainRow } from "./repository";

export class DomainService {
  private constructor(
    private readonly repository: DomainRepository,
    readonly organizationId: string,
    readonly role: string
  ) {}

  static async create(user: CurrentUser, resource: DomainResource, requestedOrganizationId?: string) {
    const config = DOMAIN_RESOURCES[resource];
    const access = await resolveOrganizationAccess(user, requestedOrganizationId, [...config.ownerRoles]);
    if (!access) return null;
    const client = await createSupabaseServerClient();
    if (!client) return null;
    return new DomainService(new DomainRepository(client, resource), access.organizationId, access.role);
  }

  list(limit?: number) { return this.repository.list(this.organizationId, limit); }
  get(id: string) { return this.repository.getById(this.organizationId, id); }
  create(input: DomainRow) { return this.repository.create(this.organizationId, input); }
  update(id: string, patch: DomainRow) { return this.repository.update(this.organizationId, id, patch); }
  remove(id: string) { return this.repository.remove(this.organizationId, id); }
}
