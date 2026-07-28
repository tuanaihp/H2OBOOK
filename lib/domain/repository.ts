import type { SupabaseClient } from "@supabase/supabase-js";
import { DOMAIN_RESOURCES, type DomainResource } from "./resource-config";

export type DomainRow = Record<string, unknown> & { id?: string };

export class DomainRepository {
  constructor(private readonly client: SupabaseClient, private readonly resource: DomainResource) {}

  private get config() { return DOMAIN_RESOURCES[this.resource]; }

  async list(organizationId: string, limit = 200) {
    const { data, error } = await this.client
      .from(this.config.table)
      .select("*")
      .eq(this.config.orgColumn, organizationId)
      .order(this.config.orderColumn, { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 500));
    if (error) throw error;
    return (data ?? []) as DomainRow[];
  }

  async getById(organizationId: string, id: string) {
    const { data, error } = await this.client
      .from(this.config.table)
      .select("*")
      .eq(this.config.orgColumn, organizationId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as DomainRow | null;
  }

  async create(organizationId: string, input: DomainRow) {
    const payload = { ...input, id: undefined, [this.config.orgColumn]: organizationId };
    delete payload.id;
    const { data, error } = await this.client.from(this.config.table).insert(payload).select("*").single();
    if (error) throw error;
    return data as DomainRow;
  }

  async update(organizationId: string, id: string, patch: DomainRow) {
    const payload = { ...patch };
    delete payload.id;
    delete payload[this.config.orgColumn];
    const { data, error } = await this.client
      .from(this.config.table)
      .update(payload)
      .eq(this.config.orgColumn, organizationId)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as DomainRow;
  }

  async remove(organizationId: string, id: string) {
    const { error } = await this.client
      .from(this.config.table)
      .delete()
      .eq(this.config.orgColumn, organizationId)
      .eq("id", id);
    if (error) throw error;
  }
}
