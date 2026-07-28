export type ElementType = "text" | "image" | "shape" | "line" | "qr";
export type ImageFit = "cover" | "contain" | "fill";
export type ImageSourceMetadata = {
  pixelWidth: number;
  pixelHeight: number;
  orientation?: number;
  dpiX?: number;
  dpiY?: number;
  colorProfile?: string;
  checksumSha256?: string;
  originalFileName?: string;
  originalMimeType?: string;
};

export type PageType = "cover" | "content" | "chapter" | "checklist" | "gallery" | "quiz" | "blank" | "imported";

export type ElementPermissions = {
  canEditContent: boolean;
  canMove: boolean;
  canResize: boolean;
  canDelete: boolean;
  canChangeColor: boolean;
  canReplaceAsset?: boolean;
  canChangeFont?: boolean;
  canRotate?: boolean;
};

export type ShadowStyle = {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
};

export type TextFlowMetrics = {
  chainId: string;
  frameIndex: number;
  lineCount: number;
  usedHeight: number;
  availableHeight: number;
  consumedCharacters: number;
  remainingCharacters: number;
  overflow: boolean;
  lastReflowAt: string;
};

export type H2OElement = {
  id: string;
  type: ElementType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: number[];
  text?: string;
  sourceText?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline" | "line-through";
  lineHeight?: number;
  letterSpacing?: number;
  align?: "left" | "center" | "right" | "justify";
  verticalAlign?: "top" | "middle" | "bottom";
  assetId?: string;
  imageUrl?: string;
  altText?: string;
  caption?: string;
  focalPoint?: { x: number; y: number };
  imageMetadata?: ImageSourceMetadata;
  sourceRegion?: { x: number; y: number; width: number; height: number; order?: number };
  contentNodeId?: string;
  paragraphStyleId?: string;
  characterStyleId?: string;
  flowChainId?: string;
  flowOrder?: number;
  flowSourceText?: string;
  flowPadding?: number;
  flowOverflow?: boolean;
  flowMetrics?: TextFlowMetrics;
  overflowBehavior?: "clip" | "warn" | "flow";
  richText?: { type: "doc"; content: Array<Record<string, unknown>> };
  imageFit?: ImageFit;
  cornerRadius?: number;
  bindingKey?: string;
  bindingFallback?: string;
  qrValue?: string;
  sourceQrValue?: string;
  shadow?: ShadowStyle;
  sourceElementId?: string;
  sourceRevision?: number;
  localRevision?: number;
  permissions: ElementPermissions;
};

export type H2OPage = {
  id: string;
  name: string;
  width: number;
  height: number;
  background: string;
  pageType?: PageType;
  chapter?: string;
  notes?: string;
  hidden?: boolean;
  masterPageId?: string;
  elements: H2OElement[];
};

export type H2OBook = {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  cover: string;
  status: "draft" | "published" | "template";
  pages: H2OPage[];
  updatedAt: string;
  description?: string;
  language?: string;
  pageSize?: "A4" | "A5" | "square" | "presentation" | "custom";
  documentId?: string;
  layoutProfileId?: string;
};

export type BrandProfile = {
  id: string;
  name: string;
  expertName: string;
  expertTitle: string;
  logoUrl: string;
  avatarUrl: string;
  logoAssetId?: string;
  avatarAssetId?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  introduction?: string;
  copyrightText?: string;
  socialFacebook?: string;
  socialTikTok?: string;
  socialInstagram?: string;
};
