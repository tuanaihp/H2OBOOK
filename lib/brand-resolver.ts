import { uid } from "@/lib/utils";
import type { BrandProfile, H2OBook, H2OElement } from "@/types/editor";

export const brandVariableMap = (brand: BrandProfile): Record<string, string> => ({
  "brand.name": brand.name,
  "brand.logo": brand.logoUrl,
  "brand.primary_color": brand.primaryColor,
  "brand.secondary_color": brand.secondaryColor,
  "brand.accent_color": brand.accentColor,
  "brand.phone": brand.phone,
  "brand.email": brand.email,
  "brand.website": brand.website,
  "brand.address": brand.address,
  "brand.introduction": brand.introduction ?? "",
  "brand.copyright": brand.copyrightText ?? `© ${new Date().getFullYear()} ${brand.name}`,
  "expert.name": brand.expertName,
  "expert.title": brand.expertTitle,
  "expert.avatar": brand.avatarUrl,
  "expert.bio": brand.introduction ?? "",
  "social.facebook": brand.socialFacebook ?? "",
  "social.tiktok": brand.socialTikTok ?? "",
  "social.instagram": brand.socialInstagram ?? ""
});

export function resolveText(text: string, brand: BrandProfile) {
  const variables = brandVariableMap(brand);
  return Object.entries(variables).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value ?? "")),
    text
  );
}

export function resolveElement(element: H2OElement, brand: BrandProfile): H2OElement {
  const next: H2OElement = { ...structuredClone(element), permissions: { ...element.permissions } };

  if (next.text) {
    next.sourceText ??= next.text;
    next.text = resolveText(next.sourceText, brand);
  }
  if (next.qrValue) {
    next.sourceQrValue ??= next.qrValue;
    next.qrValue = resolveText(next.sourceQrValue, brand);
  }

  switch (next.bindingKey) {
    case "brand.name": next.text = brand.name; break;
    case "brand.logo": next.imageUrl = brand.logoUrl; break;
    case "brand.primary_color": next.fill = brand.primaryColor; break;
    case "brand.secondary_color": next.fill = brand.secondaryColor; break;
    case "brand.accent_color": next.fill = brand.accentColor; break;
    case "brand.phone": next.text = brand.phone; break;
    case "brand.email": next.text = brand.email; break;
    case "brand.website": next.text = brand.website; break;
    case "brand.address": next.text = brand.address; break;
    case "expert.name": next.text = next.sourceText?.includes("—") ? `${brand.expertName} — ${brand.expertTitle}` : brand.expertName; break;
    case "expert.title": next.text = brand.expertTitle; break;
    case "expert.avatar": next.imageUrl = brand.avatarUrl; break;
  }

  if (next.type === "text") {
    const looksLikeHeading = (next.fontSize ?? 0) >= 30 || next.name.toLowerCase().includes("tiêu đề");
    next.fontFamily = looksLikeHeading ? brand.headingFont : brand.bodyFont;
  }
  return next;
}

export function applyBrandToBook(book: H2OBook, brand: BrandProfile, preserveIds = true): H2OBook {
  const branded = structuredClone(book);
  branded.id = preserveIds ? book.id : uid("book");
  branded.author = brand.expertName;
  branded.updatedAt = new Date().toISOString();
  branded.pages = branded.pages.map((page) => ({
    ...page,
    id: preserveIds ? page.id : uid("page"),
    background: page.background === "{{brand.primary_color}}" ? brand.primaryColor : page.background === "{{brand.secondary_color}}" ? brand.secondaryColor : page.background,
    elements: page.elements.map((element) => {
      const resolved = resolveElement(element, brand);
      if (!preserveIds) {
        resolved.sourceElementId = element.sourceElementId ?? element.id;
        resolved.sourceRevision = element.localRevision ?? element.sourceRevision ?? 0;
        resolved.localRevision = 0;
        resolved.id = uid(element.type);
      }
      return resolved;
    })
  }));
  return branded;
}

export function cloneBookForBrand(book: H2OBook, brand: BrandProfile): H2OBook {
  return applyBrandToBook(book, brand, false);
}
