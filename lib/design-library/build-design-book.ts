import type { BrandProfile, H2OBook, H2OElement, H2OPage } from "@/types/editor";
import type { DesignBuildInput, DesignBuildResult, DesignPalette, DesignTemplateDefinition } from "@/types/design-library";
import { DESIGN_FORMATS } from "@/lib/design-library/formats";
import { interpolateDesignText } from "@/lib/design-library/smart-fields";
import { uid } from "@/lib/utils";

const fullPermissions = (): H2OElement["permissions"] => ({
  canEditContent: true,
  canMove: true,
  canResize: true,
  canDelete: true,
  canChangeColor: true,
  canReplaceAsset: true,
  canChangeFont: true,
  canRotate: true
});

const lockedDecorPermissions = (): H2OElement["permissions"] => ({
  canEditContent: false,
  canMove: false,
  canResize: false,
  canDelete: false,
  canChangeColor: false,
  canReplaceAsset: false,
  canChangeFont: false,
  canRotate: false
});

const editableTextLockedPosition = (): H2OElement["permissions"] => ({
  canEditContent: true,
  canMove: false,
  canResize: false,
  canDelete: false,
  canChangeColor: false,
  canReplaceAsset: false,
  canChangeFont: false,
  canRotate: false
});

const replaceableImageLockedFrame = (): H2OElement["permissions"] => ({
  canEditContent: false,
  canMove: false,
  canResize: false,
  canDelete: false,
  canChangeColor: false,
  canReplaceAsset: true,
  canChangeFont: false,
  canRotate: false
});

function resolvePalette(template: DesignTemplateDefinition, brand: BrandProfile, useBrandKit: boolean): DesignPalette {
  if (!useBrandKit) return template.palette;
  return {
    ...template.palette,
    primary: brand.primaryColor,
    secondary: brand.secondaryColor,
    accent: brand.accentColor
  };
}

function textElement(input: Partial<H2OElement> & Pick<H2OElement, "name" | "x" | "y" | "width" | "height" | "text">): H2OElement {
  return {
    id: uid("design_text"),
    type: "text",
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    fill: "#222222",
    fontFamily: "Arial",
    fontSize: 28,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: 0,
    align: "left",
    verticalAlign: "top",
    permissions: fullPermissions(),
    ...input
  };
}

function shapeElement(input: Partial<H2OElement> & Pick<H2OElement, "name" | "x" | "y" | "width" | "height">): H2OElement {
  return {
    id: uid("design_shape"),
    type: "shape",
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    fill: "#EEEEEE",
    strokeWidth: 0,
    cornerRadius: 0,
    permissions: fullPermissions(),
    ...input
  };
}

function imageElement(input: Partial<H2OElement> & Pick<H2OElement, "name" | "x" | "y" | "width" | "height">): H2OElement {
  return {
    id: uid("design_image"),
    type: "image",
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    imageFit: "cover",
    altText: "Ảnh chân dung Makeup Artist — thay bằng ảnh của bạn",
    permissions: replaceableImageLockedFrame(),
    ...input
  };
}

function qrElement(input: Partial<H2OElement> & Pick<H2OElement, "name" | "x" | "y" | "width" | "height">): H2OElement {
  return {
    id: uid("design_qr"),
    type: "qr",
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    fill: "#222222",
    qrValue: "https://thuyh2o.vn",
    permissions: fullPermissions(),
    ...input
  };
}

function applyFields(value: string, values: Record<string, string>, brand: BrandProfile) {
  return interpolateDesignText(value, values, brand);
}

function buildSplitEditorial(template: DesignTemplateDefinition, brand: BrandProfile, values: Record<string, string>, palette: DesignPalette): H2OPage {
  const { width: w, height: h } = DESIGN_FORMATS[template.baseFormat];
  const horizontal = w / h > 1.5;
  const imageX = horizontal ? w * 0.58 : w * 0.08;
  const imageY = horizontal ? h * 0.08 : h * 0.08;
  const imageW = horizontal ? w * 0.36 : w * 0.84;
  const imageH = horizontal ? h * 0.84 : h * 0.48;
  const textX = horizontal ? w * 0.07 : w * 0.08;
  const textY = horizontal ? h * 0.19 : h * 0.62;
  const textW = horizontal ? w * 0.46 : w * 0.84;

  return {
    id: uid("design_page"),
    name: template.name,
    width: w,
    height: h,
    background: palette.background,
    pageType: "imported",
    elements: [
      shapeElement({ name: "Nền khóa", x: 0, y: 0, width: w, height: h, fill: palette.background, locked: true, permissions: lockedDecorPermissions() }),
      shapeElement({ name: "Vòng sáng thương hiệu", x: w * 0.48, y: -h * 0.25, width: h * 0.9, height: h * 0.9, fill: palette.secondary, opacity: 0.22, cornerRadius: 999, locked: true, permissions: lockedDecorPermissions() }),
      shapeElement({ name: "Đường nhấn", x: textX, y: textY - h * 0.08, width: horizontal ? w * 0.12 : w * 0.22, height: Math.max(6, h * 0.012), fill: palette.accent, cornerRadius: 999, locked: true, permissions: lockedDecorPermissions() }),
      textElement({ name: "Tên thương hiệu", x: textX, y: h * 0.08, width: textW, height: h * 0.08, text: brand.name, fill: palette.accent, fontFamily: brand.bodyFont, fontSize: Math.max(18, h * 0.038), fontWeight: 800, letterSpacing: 2, permissions: editableTextLockedPosition() }),
      textElement({ name: "Tiêu đề chính", x: textX, y: textY, width: textW, height: horizontal ? h * 0.34 : h * 0.20, text: applyFields("{{headline}}", values, brand), fill: palette.text, fontFamily: brand.headingFont, fontSize: Math.max(34, h * (horizontal ? 0.095 : 0.052)), fontWeight: 800, lineHeight: 1.03, permissions: editableTextLockedPosition() }),
      textElement({ name: "Mô tả", x: textX, y: horizontal ? h * 0.59 : h * 0.83, width: textW, height: h * 0.13, text: applyFields("{{subtitle}}", values, brand), fill: palette.muted, fontFamily: brand.bodyFont, fontSize: Math.max(18, h * 0.036), fontWeight: 500, lineHeight: 1.35, permissions: editableTextLockedPosition() }),
      textElement({ name: "CTA", x: textX, y: horizontal ? h * 0.81 : h * 0.93, width: textW * 0.58, height: h * 0.08, text: applyFields("{{cta}}", values, brand) || applyFields("{{phone}}", values, brand), fill: palette.accent, fontFamily: brand.bodyFont, fontSize: Math.max(17, h * 0.032), fontWeight: 800, permissions: editableTextLockedPosition() }),
      imageElement({ name: "Ảnh chân dung — thay ảnh", x: imageX, y: imageY, width: imageW, height: imageH, imageUrl: "/design-library/portrait-placeholder.svg", cornerRadius: Math.max(24, h * 0.06), shadow: { color: "#000000", blur: 32, offsetX: 0, offsetY: 12, opacity: 0.22 } })
    ]
  };
}

function buildCenteredOrbit(template: DesignTemplateDefinition, brand: BrandProfile, values: Record<string, string>, palette: DesignPalette): H2OPage {
  const { width: w, height: h } = DESIGN_FORMATS[template.baseFormat];
  const horizontal = w / h > 1.5;
  return {
    id: uid("design_page"),
    name: template.name,
    width: w,
    height: h,
    background: palette.background,
    pageType: "imported",
    elements: [
      shapeElement({ name: "Nền khóa", x: 0, y: 0, width: w, height: h, fill: palette.background, locked: true, permissions: lockedDecorPermissions() }),
      shapeElement({ name: "AI Orbit 1", x: w * 0.62, y: horizontal ? -h * 0.35 : h * 0.05, width: h * 0.95, height: h * 0.95, fill: palette.primary, opacity: 0.18, cornerRadius: 999, locked: true, permissions: lockedDecorPermissions() }),
      shapeElement({ name: "AI Orbit 2", x: w * 0.71, y: horizontal ? -h * 0.18 : h * 0.12, width: h * 0.62, height: h * 0.62, fill: palette.secondary, opacity: 0.20, cornerRadius: 999, locked: true, permissions: lockedDecorPermissions() }),
      textElement({ name: "Nhãn AI Academy", x: w * 0.07, y: h * 0.08, width: w * 0.50, height: h * 0.06, text: `${brand.name}  •  AI KNOWLEDGE SYSTEM`, fill: palette.secondary, fontFamily: brand.bodyFont, fontSize: Math.max(16, h * 0.027), fontWeight: 800, letterSpacing: 2, permissions: editableTextLockedPosition() }),
      textElement({ name: "Tiêu đề", x: w * 0.07, y: horizontal ? h * 0.22 : h * 0.18, width: horizontal ? w * 0.56 : w * 0.86, height: horizontal ? h * 0.35 : h * 0.24, text: applyFields("{{headline}}", values, brand) || applyFields("{{expertName}}", values, brand), fill: palette.text, fontFamily: brand.headingFont, fontSize: Math.max(38, h * (horizontal ? 0.09 : 0.052)), fontWeight: 800, lineHeight: 1.03, align: horizontal ? "left" : "center", permissions: editableTextLockedPosition() }),
      textElement({ name: "Mô tả", x: w * 0.07, y: horizontal ? h * 0.60 : h * 0.48, width: horizontal ? w * 0.52 : w * 0.86, height: h * 0.12, text: applyFields("{{subtitle}}", values, brand) || applyFields("{{specialties}}", values, brand), fill: palette.muted, fontFamily: brand.bodyFont, fontSize: Math.max(18, h * 0.031), fontWeight: 500, align: horizontal ? "left" : "center", permissions: editableTextLockedPosition() }),
      textElement({ name: "Thông tin", x: w * 0.07, y: horizontal ? h * 0.78 : h * 0.67, width: horizontal ? w * 0.48 : w * 0.86, height: h * 0.08, text: [values.startDate, values.socialHandle, values.phone].filter(Boolean).join("   •   "), fill: palette.accent, fontFamily: brand.bodyFont, fontSize: Math.max(17, h * 0.028), fontWeight: 800, align: horizontal ? "left" : "center", permissions: editableTextLockedPosition() }),
      imageElement({ name: "Ảnh/visual — thay ảnh", x: horizontal ? w * 0.68 : w * 0.18, y: horizontal ? h * 0.14 : h * 0.76, width: horizontal ? w * 0.25 : w * 0.64, height: horizontal ? h * 0.72 : h * 0.20, imageUrl: "/design-library/academy-placeholder.svg", cornerRadius: Math.max(30, h * 0.08) })
    ]
  };
}

function buildPortraitSignature(template: DesignTemplateDefinition, brand: BrandProfile, values: Record<string, string>, palette: DesignPalette): H2OPage {
  const { width: w, height: h } = DESIGN_FORMATS[template.baseFormat];
  return {
    id: uid("design_page"),
    name: template.name,
    width: w,
    height: h,
    background: palette.background,
    pageType: "imported",
    elements: [
      shapeElement({ name: "Nền khóa", x: 0, y: 0, width: w, height: h, fill: palette.background, locked: true, permissions: lockedDecorPermissions() }),
      imageElement({ name: "Ảnh chân dung — thay ảnh", x: w * 0.08, y: h * 0.07, width: w * 0.84, height: h * 0.55, imageUrl: "/design-library/portrait-placeholder.svg", cornerRadius: w * 0.04, shadow: { color: "#000000", blur: 30, offsetX: 0, offsetY: 14, opacity: 0.18 } }),
      shapeElement({ name: "Khối thông tin", x: w * 0.06, y: h * 0.56, width: w * 0.88, height: h * 0.36, fill: palette.surface, cornerRadius: w * 0.045, shadow: { color: "#000000", blur: 28, offsetX: 0, offsetY: 12, opacity: 0.12 }, locked: true, permissions: lockedDecorPermissions() }),
      textElement({ name: "Tên chuyên gia", x: w * 0.12, y: h * 0.62, width: w * 0.76, height: h * 0.09, text: applyFields("{{expertName}}", values, brand), fill: palette.primary, fontFamily: brand.headingFont, fontSize: h * 0.052, fontWeight: 800, align: "center", permissions: editableTextLockedPosition() }),
      textElement({ name: "Danh xưng", x: w * 0.12, y: h * 0.71, width: w * 0.76, height: h * 0.05, text: applyFields("{{expertTitle}}", values, brand), fill: palette.text, fontFamily: brand.bodyFont, fontSize: h * 0.025, fontWeight: 700, align: "center", permissions: editableTextLockedPosition() }),
      textElement({ name: "Chuyên môn", x: w * 0.12, y: h * 0.77, width: w * 0.76, height: h * 0.08, text: applyFields("{{specialties}}", values, brand), fill: palette.muted, fontFamily: brand.bodyFont, fontSize: h * 0.022, fontWeight: 500, align: "center", lineHeight: 1.35, permissions: editableTextLockedPosition() }),
      textElement({ name: "Kênh cá nhân", x: w * 0.12, y: h * 0.86, width: w * 0.76, height: h * 0.04, text: [values.socialHandle, values.phone].filter(Boolean).join("  •  "), fill: palette.accent, fontFamily: brand.bodyFont, fontSize: h * 0.021, fontWeight: 800, align: "center", permissions: editableTextLockedPosition() })
    ]
  };
}

function buildInviteArch(template: DesignTemplateDefinition, brand: BrandProfile, values: Record<string, string>, palette: DesignPalette): H2OPage {
  const { width: w, height: h } = DESIGN_FORMATS[template.baseFormat];
  return {
    id: uid("design_page"),
    name: template.name,
    width: w,
    height: h,
    background: palette.background,
    pageType: "imported",
    elements: [
      shapeElement({ name: "Nền khóa", x: 0, y: 0, width: w, height: h, fill: palette.background, locked: true, permissions: lockedDecorPermissions() }),
      shapeElement({ name: "Khung vòm", x: w * 0.08, y: h * 0.06, width: w * 0.84, height: h * 0.86, fill: palette.surface, stroke: palette.accent, strokeWidth: 3, cornerRadius: w * 0.42, shadow: { color: palette.primary, blur: 28, offsetX: 0, offsetY: 12, opacity: 0.10 }, locked: true, permissions: lockedDecorPermissions() }),
      textElement({ name: "Tên học viện", x: w * 0.16, y: h * 0.12, width: w * 0.68, height: h * 0.05, text: brand.name, fill: palette.primary, fontFamily: brand.bodyFont, fontSize: h * 0.021, fontWeight: 800, align: "center", letterSpacing: 2, permissions: editableTextLockedPosition() }),
      textElement({ name: "Lời mời", x: w * 0.16, y: h * 0.22, width: w * 0.68, height: h * 0.08, text: "TRÂN TRỌNG CHÀO ĐÓN", fill: palette.accent, fontFamily: brand.bodyFont, fontSize: h * 0.024, fontWeight: 800, align: "center", letterSpacing: 2, permissions: editableTextLockedPosition() }),
      textElement({ name: "Tên học viên", x: w * 0.14, y: h * 0.31, width: w * 0.72, height: h * 0.11, text: applyFields("{{studentName}}", values, brand), fill: palette.primary, fontFamily: brand.headingFont, fontSize: h * 0.047, fontWeight: 800, align: "center", permissions: editableTextLockedPosition() }),
      textElement({ name: "Tên khóa", x: w * 0.15, y: h * 0.44, width: w * 0.70, height: h * 0.13, text: applyFields("CHÍNH THỨC GIA NHẬP\n{{courseName}}", values, brand), fill: palette.text, fontFamily: brand.headingFont, fontSize: h * 0.032, fontWeight: 700, align: "center", lineHeight: 1.2, permissions: editableTextLockedPosition() }),
      textElement({ name: "Lịch học", x: w * 0.17, y: h * 0.61, width: w * 0.66, height: h * 0.12, text: applyFields("Khai giảng: {{startDate}}\n{{schedule}}", values, brand), fill: palette.text, fontFamily: brand.bodyFont, fontSize: h * 0.021, fontWeight: 600, align: "center", lineHeight: 1.5, permissions: editableTextLockedPosition() }),
      textElement({ name: "Địa điểm", x: w * 0.17, y: h * 0.75, width: w * 0.66, height: h * 0.07, text: applyFields("{{location}}", values, brand), fill: palette.muted, fontFamily: brand.bodyFont, fontSize: h * 0.019, fontWeight: 500, align: "center", permissions: editableTextLockedPosition() }),
      textElement({ name: "Giảng viên", x: w * 0.17, y: h * 0.84, width: w * 0.66, height: h * 0.05, text: applyFields("Giảng viên: {{mentorName}}  •  {{contact}}", values, brand), fill: palette.primary, fontFamily: brand.bodyFont, fontSize: h * 0.018, fontWeight: 800, align: "center", permissions: editableTextLockedPosition() })
    ]
  };
}

function buildCertificateFrame(template: DesignTemplateDefinition, brand: BrandProfile, values: Record<string, string>, palette: DesignPalette): H2OPage {
  const { width: w, height: h } = DESIGN_FORMATS[template.baseFormat];
  return {
    id: uid("design_page"),
    name: template.name,
    width: w,
    height: h,
    background: palette.background,
    pageType: "imported",
    elements: [
      shapeElement({ name: "Nền bằng", x: 0, y: 0, width: w, height: h, fill: palette.background, locked: true, permissions: lockedDecorPermissions() }),
      shapeElement({ name: "Khung ngoài khóa", x: w * 0.035, y: h * 0.05, width: w * 0.93, height: h * 0.90, fill: "transparent", stroke: palette.primary, strokeWidth: 5, cornerRadius: 10, locked: true, permissions: lockedDecorPermissions() }),
      shapeElement({ name: "Khung trong khóa", x: w * 0.052, y: h * 0.075, width: w * 0.896, height: h * 0.85, fill: "transparent", stroke: palette.accent, strokeWidth: 2, cornerRadius: 8, locked: true, permissions: lockedDecorPermissions() }),
      imageElement({ name: "Con dấu học viện", x: w * 0.08, y: h * 0.12, width: h * 0.17, height: h * 0.17, imageUrl: "/design-library/certificate-seal.svg", imageFit: "contain", permissions: lockedDecorPermissions(), locked: true }),
      textElement({ name: "Tên học viện", x: w * 0.24, y: h * 0.09, width: w * 0.52, height: h * 0.06, text: brand.name, fill: palette.primary, fontFamily: brand.bodyFont, fontSize: h * 0.035, fontWeight: 800, align: "center", letterSpacing: 2, permissions: editableTextLockedPosition() }),
      textElement({ name: "Tiêu đề bằng", x: w * 0.17, y: h * 0.20, width: w * 0.66, height: h * 0.12, text: "CERTIFICATE\nOF COMPLETION", fill: palette.primary, fontFamily: brand.headingFont, fontSize: h * 0.068, fontWeight: 800, align: "center", lineHeight: 1.0, permissions: editableTextLockedPosition() }),
      textElement({ name: "Công nhận", x: w * 0.20, y: h * 0.36, width: w * 0.60, height: h * 0.05, text: "TRÂN TRỌNG CÔNG NHẬN", fill: palette.muted, fontFamily: brand.bodyFont, fontSize: h * 0.022, fontWeight: 700, align: "center", letterSpacing: 1.5, permissions: editableTextLockedPosition() }),
      textElement({ name: "Tên học viên", x: w * 0.13, y: h * 0.42, width: w * 0.74, height: h * 0.10, text: applyFields("{{studentName}}", values, brand), fill: palette.text, fontFamily: brand.headingFont, fontSize: h * 0.07, fontWeight: 800, align: "center", permissions: editableTextLockedPosition() }),
      textElement({ name: "Tên khóa", x: w * 0.18, y: h * 0.55, width: w * 0.64, height: h * 0.07, text: applyFields("{{courseName}}", values, brand), fill: palette.primary, fontFamily: brand.bodyFont, fontSize: h * 0.03, fontWeight: 800, align: "center", permissions: editableTextLockedPosition() }),
      textElement({ name: "Nội dung công nhận", x: w * 0.20, y: h * 0.63, width: w * 0.60, height: h * 0.08, text: applyFields("{{achievement}}", values, brand), fill: palette.muted, fontFamily: brand.bodyFont, fontSize: h * 0.022, fontWeight: 500, align: "center", lineHeight: 1.35, permissions: editableTextLockedPosition() }),
      textElement({ name: "Ngày cấp", x: w * 0.11, y: h * 0.77, width: w * 0.24, height: h * 0.08, text: applyFields("Ngày cấp\n{{issueDate}}", values, brand), fill: palette.text, fontFamily: brand.bodyFont, fontSize: h * 0.021, fontWeight: 700, align: "center", lineHeight: 1.5, permissions: editableTextLockedPosition() }),
      textElement({ name: "Chữ ký", x: w * 0.38, y: h * 0.76, width: w * 0.30, height: h * 0.10, text: applyFields("{{instructorName}}\n{{instructorTitle}}", values, brand), fill: palette.text, fontFamily: brand.headingFont, fontSize: h * 0.024, fontWeight: 700, align: "center", lineHeight: 1.45, permissions: editableTextLockedPosition() }),
      qrElement({ name: "QR xác minh", x: w * 0.79, y: h * 0.73, width: h * 0.14, height: h * 0.14, qrValue: values.verificationUrl || brand.website, fill: palette.primary, permissions: replaceableImageLockedFrame() }),
      textElement({ name: "Mã bằng", x: w * 0.72, y: h * 0.88, width: w * 0.22, height: h * 0.04, text: applyFields("Mã: {{certificateNo}}", values, brand), fill: palette.muted, fontFamily: brand.bodyFont, fontSize: h * 0.016, fontWeight: 700, align: "center", permissions: editableTextLockedPosition() })
    ]
  };
}

function buildPromotionBurst(template: DesignTemplateDefinition, brand: BrandProfile, values: Record<string, string>, palette: DesignPalette): H2OPage {
  const { width: w, height: h } = DESIGN_FORMATS[template.baseFormat];
  return {
    id: uid("design_page"),
    name: template.name,
    width: w,
    height: h,
    background: palette.background,
    pageType: "imported",
    elements: [
      shapeElement({ name: "Nền khóa", x: 0, y: 0, width: w, height: h, fill: palette.background, locked: true, permissions: lockedDecorPermissions() }),
      shapeElement({ name: "Vòng khuyến mãi", x: w * 0.58, y: h * 0.06, width: w * 0.56, height: w * 0.56, fill: palette.primary, opacity: 0.22, cornerRadius: 999, locked: true, permissions: lockedDecorPermissions() }),
      imageElement({ name: "Ảnh dịch vụ — thay ảnh", x: w * 0.10, y: h * 0.08, width: w * 0.80, height: h * 0.46, imageUrl: "/design-library/makeup-tools-placeholder.svg", cornerRadius: w * 0.05, shadow: { color: "#000000", blur: 32, offsetX: 0, offsetY: 14, opacity: 0.18 } }),
      textElement({ name: "Tên chương trình", x: w * 0.10, y: h * 0.58, width: w * 0.80, height: h * 0.06, text: applyFields("{{offerTitle}}", values, brand), fill: palette.accent, fontFamily: brand.bodyFont, fontSize: h * 0.027, fontWeight: 900, align: "center", letterSpacing: 2, permissions: editableTextLockedPosition() }),
      textElement({ name: "Tên dịch vụ", x: w * 0.08, y: h * 0.64, width: w * 0.84, height: h * 0.10, text: applyFields("{{serviceName}}", values, brand), fill: palette.text, fontFamily: brand.headingFont, fontSize: h * 0.048, fontWeight: 800, align: "center", permissions: editableTextLockedPosition() }),
      textElement({ name: "Mức giảm", x: w * 0.08, y: h * 0.75, width: w * 0.84, height: h * 0.10, text: applyFields("{{discount}}", values, brand), fill: palette.primary, fontFamily: brand.headingFont, fontSize: h * 0.065, fontWeight: 900, align: "center", permissions: editableTextLockedPosition() }),
      textElement({ name: "Giá ưu đãi", x: w * 0.12, y: h * 0.85, width: w * 0.76, height: h * 0.055, text: applyFields("{{finalPrice}}  •  {{deadline}}", values, brand), fill: palette.text, fontFamily: brand.bodyFont, fontSize: h * 0.022, fontWeight: 800, align: "center", permissions: editableTextLockedPosition() }),
      textElement({ name: "Quyền lợi", x: w * 0.12, y: h * 0.905, width: w * 0.76, height: h * 0.04, text: applyFields("{{benefit}}", values, brand), fill: palette.muted, fontFamily: brand.bodyFont, fontSize: h * 0.018, fontWeight: 600, align: "center", permissions: editableTextLockedPosition() }),
      textElement({ name: "CTA", x: w * 0.20, y: h * 0.955, width: w * 0.60, height: h * 0.035, text: applyFields("{{cta}}  •  {{phone}}", values, brand), fill: palette.accent, fontFamily: brand.bodyFont, fontSize: h * 0.018, fontWeight: 900, align: "center", permissions: editableTextLockedPosition() })
    ]
  };
}

function smartResizePage(page: H2OPage, targetWidth: number, targetHeight: number): H2OPage {
  if (page.width === targetWidth && page.height === targetHeight) return page;
  const sx = targetWidth / page.width;
  const sy = targetHeight / page.height;
  const fontScale = Math.min(sx, sy);
  return {
    ...page,
    id: uid("design_page"),
    width: targetWidth,
    height: targetHeight,
    elements: page.elements.map((element) => ({
      ...element,
      id: uid(`resized_${element.type}`),
      x: element.x * sx,
      y: element.y * sy,
      width: element.width * sx,
      height: element.height * sy,
      fontSize: element.fontSize ? Math.max(10, element.fontSize * fontScale) : element.fontSize,
      cornerRadius: element.cornerRadius ? element.cornerRadius * fontScale : element.cornerRadius,
      strokeWidth: element.strokeWidth ? element.strokeWidth * fontScale : element.strokeWidth,
      shadow: element.shadow ? {
        ...element.shadow,
        blur: element.shadow.blur * fontScale,
        offsetX: element.shadow.offsetX * sx,
        offsetY: element.shadow.offsetY * sy
      } : undefined
    }))
  };
}

export function buildDesignBook(input: DesignBuildInput): DesignBuildResult {
  const { template, brand, values, targetFormat, useBrandKit } = input;
  const palette = resolvePalette(template, brand, useBrandKit);
  const builders = {
    "split-editorial": buildSplitEditorial,
    "centered-orbit": buildCenteredOrbit,
    "portrait-signature": buildPortraitSignature,
    "invite-arch": buildInviteArch,
    "certificate-frame": buildCertificateFrame,
    "promotion-burst": buildPromotionBurst
  } as const;
  const basePage = builders[template.layout](template, brand, values, palette);
  const target = DESIGN_FORMATS[targetFormat];
  const page = smartResizePage(basePage, target.width, target.height);
  const warnings: string[] = [];
  if (targetFormat !== template.baseFormat) warnings.push("Thiết kế đã được Smart Resize. Nên kiểm tra lại vị trí chữ và ảnh trước khi xuất bản.");
  if (template.approvalRequired) warnings.push("Mẫu này yêu cầu duyệt trước khi phát hành chính thức.");
  if (!values.studentName && template.category === "makeup-certificate") warnings.push("Chưa có tên học viên.");

  const title = values.studentName
    ? `${template.name} — ${values.studentName}`
    : values.serviceName
      ? `${template.name} — ${values.serviceName}`
      : template.name;

  const book: H2OBook = {
    id: uid("design"),
    title,
    subtitle: `${template.subcategory} • ${target.label}`,
    author: brand.expertName,
    cover: `linear-gradient(135deg,${palette.background},${palette.primary},${palette.accent})`,
    status: "draft",
    pages: [page],
    updatedAt: new Date().toISOString(),
    description: template.description,
    language: "vi",
    pageSize: "custom"
  };
  return { book, warnings };
}
