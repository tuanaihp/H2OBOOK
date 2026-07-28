import type { BrandProfile } from "@/types/editor";
import type { DesignSmartField } from "@/types/design-library";

export function createDefaultFieldValues(fields: DesignSmartField[], brand: BrandProfile): Record<string, string> {
  const values = Object.fromEntries(fields.map((item) => [item.key, item.defaultValue ?? ""]));
  return {
    ...values,
    brandName: brand.name,
    expertName: values.expertName || brand.expertName,
    expertTitle: values.expertTitle || brand.expertTitle,
    phone: values.phone || brand.phone,
    website: brand.website,
    email: brand.email,
    address: brand.address
  };
}

export function interpolateDesignText(text: string, values: Record<string, string>, brand: BrandProfile): string {
  const merged: Record<string, string> = {
    ...values,
    brandName: values.brandName || brand.name,
    expertName: values.expertName || brand.expertName,
    expertTitle: values.expertTitle || brand.expertTitle,
    phone: values.phone || brand.phone,
    website: values.website || brand.website,
    email: values.email || brand.email,
    address: values.address || brand.address
  };
  return text.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_, key: string) => merged[key] ?? "");
}
