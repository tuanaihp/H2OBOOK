import type { BrandProfile, H2OBook } from "@/types/editor";

export type DesignCategory =
  | "fanpage-cover"
  | "personal-profile"
  | "student-invitation"
  | "makeup-certificate"
  | "makeup-promotion";

export type DesignStyle =
  | "future-luxe"
  | "clean-editorial"
  | "soft-glow"
  | "burgundy-signature"
  | "monochrome-fashion"
  | "academy-prestige"
  | "flash-sale-energy";

export type DesignFormatKey =
  | "facebook-cover"
  | "portrait-post"
  | "square-post"
  | "story"
  | "a5-invitation"
  | "a4-certificate-landscape";

export type DesignFieldType = "text" | "textarea" | "date" | "number" | "url";

export type DesignSmartField = {
  key: string;
  label: string;
  type: DesignFieldType;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  lockedStyle?: boolean;
};

export type DesignPalette = {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  muted: string;
};

export type DesignTemplateDefinition = {
  id: string;
  name: string;
  description: string;
  category: DesignCategory;
  subcategory: string;
  style: DesignStyle;
  tags: string[];
  baseFormat: DesignFormatKey;
  supportedFormats: DesignFormatKey[];
  palette: DesignPalette;
  layout:
    | "split-editorial"
    | "centered-orbit"
    | "portrait-signature"
    | "invite-arch"
    | "certificate-frame"
    | "promotion-burst";
  fields: DesignSmartField[];
  bulkCapable?: boolean;
  approvalRequired?: boolean;
  featured?: boolean;
  trendScore?: number;
};

export type DesignFormatPreset = {
  key: DesignFormatKey;
  label: string;
  width: number;
  height: number;
  purpose: string;
  safeArea: number;
};

export type DesignBuildInput = {
  template: DesignTemplateDefinition;
  brand: BrandProfile;
  values: Record<string, string>;
  targetFormat: DesignFormatKey;
  useBrandKit: boolean;
};

export type DesignBuildResult = {
  book: H2OBook;
  warnings: string[];
};

export type BulkDesignRow = Record<string, string>;
