import type { BrandProfile, H2OBook, H2OElement } from "@/types/editor";

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

export type DesignSnapshotPage = {
  name?: string;
  width: number;
  height: number;
  background?: string;
  elements: H2OElement[];
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
  /**
   * Element snapshots for imported/external templates. When present, buildDesignBook
   * renders these pages (with {{field}} placeholder substitution and fresh element ids)
   * instead of the procedural `layout` builders. Lets any external template source
   * (Polotno JSON, saved editor pages, hand-authored packs) plug into the same wizard.
   */
  snapshot?: DesignSnapshotPage[];
  /** "imported" marks templates loaded from packs or external converters. */
  source?: "builtin" | "imported";
  /** Font families referenced by snapshot elements — surfaced as warnings when missing. */
  fontsUsed?: string[];
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
