import type { DesignSmartField, DesignTemplateDefinition } from "@/types/design-library";

const field = (
  key: string,
  label: string,
  defaultValue: string,
  options: Partial<DesignSmartField> = {}
): DesignSmartField => ({ key, label, type: "text", defaultValue, required: true, lockedStyle: true, ...options });

const profileFields = [
  field("expertName", "Tên Makeup Artist", "THỦY H2O"),
  field("expertTitle", "Danh xưng", "Founder & Makeup Educator"),
  field("specialties", "Chuyên môn", "Makeup cô dâu • Đào tạo nghề • Xây thương hiệu"),
  field("socialHandle", "Tên kênh", "@thuyh2omakeup"),
  field("phone", "Số điện thoại", "0900 000 000")
];

const invitationFields = [
  field("studentName", "Tên học viên", "NGUYỄN MINH ANH"),
  field("courseName", "Tên khóa học", "MAKEUP CHUYÊN NGHIỆP"),
  field("startDate", "Ngày khai giảng", "15.08.2026", { type: "date" }),
  field("schedule", "Lịch học", "Thứ 2 • 4 • 6 | 09:00–12:00"),
  field("location", "Địa điểm", "ThuyH2O Makeup Academy — Hải Phòng"),
  field("mentorName", "Giảng viên", "Cô Thủy H2O"),
  field("contact", "Liên hệ", "0900 000 000")
];

const certificateFields = [
  field("studentName", "Tên học viên", "NGUYỄN MINH ANH"),
  field("courseName", "Tên khóa", "KHÓA MAKEUP CHUYÊN NGHIỆP"),
  field("achievement", "Nội dung công nhận", "Đã hoàn thành chương trình đào tạo và đạt yêu cầu tốt nghiệp"),
  field("issueDate", "Ngày cấp", "28.07.2026", { type: "date" }),
  field("certificateNo", "Mã bằng", "H2O-MUP-2026-001"),
  field("instructorName", "Người ký", "THỦY H2O"),
  field("instructorTitle", "Chức danh", "Founder & Lead Educator"),
  field("verificationUrl", "Liên kết xác minh", "https://thuyh2o.vn/certificate/H2O-MUP-2026-001", { type: "url" })
];

const promotionFields = [
  field("serviceName", "Tên dịch vụ", "MAKEUP CÔ DÂU SIGNATURE"),
  field("offerTitle", "Thông điệp ưu đãi", "ƯU ĐÃI MÙA CƯỚI"),
  field("discount", "Mức ưu đãi", "GIẢM 20%"),
  field("finalPrice", "Giá ưu đãi", "TỪ 1.290.000Đ"),
  field("deadline", "Hạn chương trình", "Đến hết 31.08.2026"),
  field("benefit", "Quyền lợi", "Tặng thử layout tóc • Giữ lịch 7 ngày"),
  field("phone", "Số điện thoại", "0900 000 000"),
  field("cta", "Kêu gọi hành động", "ĐẶT LỊCH NGAY")
];

export const DESIGN_LIBRARY_CATALOG: DesignTemplateDefinition[] = [
  {
    id: "cover-beauty-authority",
    name: "Beauty Authority",
    description: "Cover Fanpage xây hình ảnh chuyên gia Makeup cao cấp, tập trung chân dung và tuyên ngôn nghề nghiệp.",
    category: "fanpage-cover",
    subcategory: "Layout Makeup",
    style: "burgundy-signature",
    tags: ["fanpage", "chuyên gia", "makeup artist", "thương hiệu cá nhân"],
    baseFormat: "facebook-cover",
    supportedFormats: ["facebook-cover", "portrait-post", "story"],
    palette: { background: "#180E17", surface: "#35152A", primary: "#8F174D", secondary: "#F1DCE6", accent: "#D8B36A", text: "#FFFFFF", muted: "#D4B6C4" },
    layout: "split-editorial",
    fields: [
      ...profileFields,
      field("headline", "Tiêu đề chính", "MAKEUP IS THE ART OF REVEALING YOU"),
      field("subtitle", "Dòng mô tả", "Bridal Makeup • Education • Beauty Business")
    ],
    featured: true,
    trendScore: 96
  },
  {
    id: "cover-course-launch",
    name: "Future Course Launch",
    description: "Cover thông báo khai giảng khóa Makeup với bố cục AI orb, lịch học và CTA rõ ràng.",
    category: "fanpage-cover",
    subcategory: "Thông báo khóa học",
    style: "future-luxe",
    tags: ["khai giảng", "khóa học", "academy", "future"],
    baseFormat: "facebook-cover",
    supportedFormats: ["facebook-cover", "portrait-post", "story"],
    palette: { background: "#101827", surface: "#1B2740", primary: "#9B7CF8", secondary: "#49D7E8", accent: "#F0C76B", text: "#FFFFFF", muted: "#B8C4DC" },
    layout: "centered-orbit",
    fields: [
      field("headline", "Tiêu đề chính", "TUYỂN SINH KHÓA MAKEUP CHUYÊN NGHIỆP"),
      field("subtitle", "Mô tả", "Từ nền tảng kỹ thuật đến hành trình có khách đầu tiên"),
      field("startDate", "Ngày khai giảng", "KHAI GIẢNG 15.08.2026", { type: "date" }),
      field("cta", "CTA", "ĐĂNG KÝ TƯ VẤN"),
      field("phone", "Số điện thoại", "0900 000 000")
    ],
    featured: true,
    trendScore: 94
  },
  {
    id: "cover-bridal-signature",
    name: "Bridal Signature Cover",
    description: "Cover dịch vụ makeup cô dâu phong cách editorial sang trọng, dùng cho studio hoặc cá nhân.",
    category: "fanpage-cover",
    subcategory: "Layout Makeup",
    style: "clean-editorial",
    tags: ["cô dâu", "bridal", "studio", "editorial"],
    baseFormat: "facebook-cover",
    supportedFormats: ["facebook-cover", "portrait-post"],
    palette: { background: "#F7F1F3", surface: "#FFFFFF", primary: "#6F1D46", secondary: "#D6B1C2", accent: "#B59055", text: "#2F2028", muted: "#7C6873" },
    layout: "split-editorial",
    fields: [
      field("headline", "Tiêu đề", "BRIDAL SIGNATURE"),
      field("subtitle", "Mô tả", "Makeup trong trẻo • Tôn đường nét • Bền đẹp suốt ngày cưới"),
      field("expertName", "Tên Makeup Artist", "THỦY H2O"),
      field("phone", "Số điện thoại", "0900 000 000"),
      field("cta", "CTA", "BOOKING 2026")
    ],
    trendScore: 90
  },
  {
    id: "cover-advanced-intake",
    name: "Advanced Class Intake",
    description: "Thông báo tuyển sinh khóa nâng cao với nhịp typography mạnh và cảm giác runway.",
    category: "fanpage-cover",
    subcategory: "Thông báo khóa học",
    style: "monochrome-fashion",
    tags: ["nâng cao", "masterclass", "runway", "fashion"],
    baseFormat: "facebook-cover",
    supportedFormats: ["facebook-cover", "portrait-post", "story"],
    palette: { background: "#0B0B0D", surface: "#1A1A1F", primary: "#FFFFFF", secondary: "#BDBDC8", accent: "#D7FF3F", text: "#FFFFFF", muted: "#A2A2AA" },
    layout: "split-editorial",
    fields: [
      field("headline", "Tiêu đề", "ADVANCED MAKEUP MASTERCLASS"),
      field("subtitle", "Mô tả", "Nâng tư duy sáng tạo • Tối ưu tốc độ • Xây dấu ấn cá nhân"),
      field("startDate", "Ngày khai giảng", "20.09.2026", { type: "date" }),
      field("seat", "Số lượng", "CHỈ 12 HỌC VIÊN"),
      field("cta", "CTA", "GIỮ CHỖ NGAY")
    ],
    trendScore: 92
  },

  {
    id: "profile-clean-luxe",
    name: "Clean Luxe Profile",
    description: "Profile cá nhân tối giản, nhấn mạnh chân dung, tên nghề và chuyên môn chính.",
    category: "personal-profile",
    subcategory: "Profile Makeup Artist",
    style: "clean-editorial",
    tags: ["profile", "clean", "luxury", "artist"],
    baseFormat: "portrait-post",
    supportedFormats: ["portrait-post", "square-post", "story"],
    palette: { background: "#F8F4F1", surface: "#FFFFFF", primary: "#4A1831", secondary: "#E6D4DD", accent: "#B9935A", text: "#2F252A", muted: "#7B6D74" },
    layout: "portrait-signature",
    fields: profileFields,
    featured: true,
    trendScore: 95
  },
  {
    id: "profile-douyin-glow",
    name: "Beauty Glow Profile",
    description: "Profile thiên về ánh sáng glow, gradient mềm và cảm giác nội dung beauty trend hiện đại.",
    category: "personal-profile",
    subcategory: "Profile Makeup Artist",
    style: "soft-glow",
    tags: ["glow", "beauty trend", "soft", "portrait"],
    baseFormat: "portrait-post",
    supportedFormats: ["portrait-post", "square-post", "story"],
    palette: { background: "#FCECF4", surface: "#FFF8FB", primary: "#B45280", secondary: "#EFC5D8", accent: "#A899FF", text: "#492638", muted: "#95677C" },
    layout: "centered-orbit",
    fields: profileFields,
    trendScore: 97
  },
  {
    id: "profile-future-beauty",
    name: "Future Beauty Identity",
    description: "Profile AI tương lai với viền holographic, thông tin nghề và QR kênh cá nhân.",
    category: "personal-profile",
    subcategory: "Profile Makeup Artist",
    style: "future-luxe",
    tags: ["AI", "future", "identity", "holographic"],
    baseFormat: "portrait-post",
    supportedFormats: ["portrait-post", "story"],
    palette: { background: "#101827", surface: "#17243A", primary: "#49D7E8", secondary: "#9B7CF8", accent: "#F6B7D0", text: "#FFFFFF", muted: "#A8B7D0" },
    layout: "portrait-signature",
    fields: [...profileFields, field("portfolioUrl", "Portfolio URL", "https://thuyh2o.vn", { type: "url" })],
    trendScore: 93
  },
  {
    id: "profile-burgundy-expert",
    name: "Burgundy Expert Card",
    description: "Thẻ giới thiệu chuyên gia theo nhận diện ThuyH2O, phù hợp ghim đầu trang cá nhân.",
    category: "personal-profile",
    subcategory: "Profile Makeup Artist",
    style: "burgundy-signature",
    tags: ["burgundy", "expert", "personal branding"],
    baseFormat: "square-post",
    supportedFormats: ["square-post", "portrait-post"],
    palette: { background: "#5B1737", surface: "#7D2A4F", primary: "#F8DDE8", secondary: "#E0AFC5", accent: "#D9B56F", text: "#FFFFFF", muted: "#E7C9D6" },
    layout: "portrait-signature",
    fields: profileFields,
    trendScore: 91
  },

  {
    id: "invite-professional-course",
    name: "Welcome to Makeup Pro",
    description: "Thiệp mời học viên gia nhập khóa Makeup chuyên nghiệp, có lịch học và thông tin học viện.",
    category: "student-invitation",
    subcategory: "Khóa chuyên nghiệp",
    style: "academy-prestige",
    tags: ["thiệp mời", "học viên", "makeup pro", "academy"],
    baseFormat: "a5-invitation",
    supportedFormats: ["a5-invitation", "portrait-post", "story"],
    palette: { background: "#FFF9FB", surface: "#FFFFFF", primary: "#6F1D46", secondary: "#ECD6E0", accent: "#D3A45E", text: "#2E2228", muted: "#7A6671" },
    layout: "invite-arch",
    fields: invitationFields,
    bulkCapable: true,
    featured: true,
    trendScore: 94
  },
  {
    id: "invite-advanced-course",
    name: "Advanced Masterclass Invite",
    description: "Thiệp mời khóa nâng cao mang phong cách runway, phù hợp gửi riêng từng học viên.",
    category: "student-invitation",
    subcategory: "Khóa nâng cao",
    style: "monochrome-fashion",
    tags: ["nâng cao", "masterclass", "invite", "fashion"],
    baseFormat: "a5-invitation",
    supportedFormats: ["a5-invitation", "portrait-post", "story"],
    palette: { background: "#0D0D10", surface: "#19191F", primary: "#FFFFFF", secondary: "#B5B5BE", accent: "#D7FF3F", text: "#FFFFFF", muted: "#A6A6AF" },
    layout: "invite-arch",
    fields: invitationFields.map((item) => item.key === "courseName" ? { ...item, defaultValue: "ADVANCED MAKEUP MASTERCLASS" } : item),
    bulkCapable: true,
    trendScore: 92
  },
  {
    id: "invite-personal-course",
    name: "Private Personal Makeup Invite",
    description: "Thiệp mời lớp Makeup cá nhân 1:1, nhẹ nhàng, gần gũi và cao cấp.",
    category: "student-invitation",
    subcategory: "Khóa cá nhân",
    style: "soft-glow",
    tags: ["cá nhân", "1:1", "thiệp", "soft glow"],
    baseFormat: "a5-invitation",
    supportedFormats: ["a5-invitation", "portrait-post"],
    palette: { background: "#FFF1F7", surface: "#FFFFFF", primary: "#A34F77", secondary: "#F0CADB", accent: "#A99CF2", text: "#4E2B3B", muted: "#946E7F" },
    layout: "invite-arch",
    fields: invitationFields.map((item) => item.key === "courseName" ? { ...item, defaultValue: "MAKEUP CÁ NHÂN 1:1" } : item),
    bulkCapable: true,
    trendScore: 90
  },

  {
    id: "certificate-makeup-professional",
    name: "Professional Makeup Graduation",
    description: "Bằng tốt nghiệp khóa Makeup chuyên nghiệp có QR xác minh và mã chứng nhận.",
    category: "makeup-certificate",
    subcategory: "Khóa Makeup chuyên nghiệp",
    style: "academy-prestige",
    tags: ["bằng tốt nghiệp", "makeup pro", "certificate", "QR"],
    baseFormat: "a4-certificate-landscape",
    supportedFormats: ["a4-certificate-landscape"],
    palette: { background: "#FFFDF9", surface: "#FFFFFF", primary: "#651B41", secondary: "#E9D5DE", accent: "#CDA355", text: "#2C2026", muted: "#78646E" },
    layout: "certificate-frame",
    fields: certificateFields,
    bulkCapable: true,
    approvalRequired: true,
    featured: true,
    trendScore: 96
  },
  {
    id: "certificate-advanced-makeup",
    name: "Advanced Makeup Mastery",
    description: "Bằng hoàn thành khóa nâng cao với phong cách thời trang, trang trọng và hiện đại.",
    category: "makeup-certificate",
    subcategory: "Khóa nâng cao",
    style: "monochrome-fashion",
    tags: ["advanced", "mastery", "certificate", "fashion"],
    baseFormat: "a4-certificate-landscape",
    supportedFormats: ["a4-certificate-landscape"],
    palette: { background: "#F6F6F3", surface: "#FFFFFF", primary: "#111113", secondary: "#D8D8D2", accent: "#B89A55", text: "#16161A", muted: "#67676E" },
    layout: "certificate-frame",
    fields: certificateFields.map((item) => item.key === "courseName" ? { ...item, defaultValue: "ADVANCED MAKEUP MASTERCLASS" } : item),
    bulkCapable: true,
    approvalRequired: true,
    trendScore: 92
  },
  {
    id: "certificate-personal-makeup",
    name: "Personal Makeup Completion",
    description: "Chứng nhận hoàn thành khóa Makeup cá nhân, phong cách nhẹ nhàng nhưng vẫn chuyên nghiệp.",
    category: "makeup-certificate",
    subcategory: "Khóa cá nhân",
    style: "soft-glow",
    tags: ["cá nhân", "completion", "certificate", "beauty"],
    baseFormat: "a4-certificate-landscape",
    supportedFormats: ["a4-certificate-landscape"],
    palette: { background: "#FFF5F9", surface: "#FFFFFF", primary: "#9A4D71", secondary: "#EDD1DE", accent: "#A99AF0", text: "#4C293A", muted: "#8D6678" },
    layout: "certificate-frame",
    fields: certificateFields.map((item) => item.key === "courseName" ? { ...item, defaultValue: "KHÓA MAKEUP CÁ NHÂN" } : item),
    bulkCapable: true,
    approvalRequired: true,
    trendScore: 90
  },
  {
    id: "certificate-makeup-show",
    name: "Makeup Show Excellence",
    description: "Chứng nhận hoạt động thực tế dành cho học viên tham gia Makeup Show và sự kiện chuyên nghiệp.",
    category: "makeup-certificate",
    subcategory: "Hoạt động thực tế",
    style: "future-luxe",
    tags: ["makeup show", "excellence", "event", "certificate"],
    baseFormat: "a4-certificate-landscape",
    supportedFormats: ["a4-certificate-landscape"],
    palette: { background: "#101827", surface: "#17233A", primary: "#49D7E8", secondary: "#9B7CF8", accent: "#F3C76D", text: "#FFFFFF", muted: "#B8C6DC" },
    layout: "certificate-frame",
    fields: certificateFields.map((item) => item.key === "courseName" ? { ...item, defaultValue: "MAKEUP SHOW PRACTICAL EXPERIENCE" } : item),
    bulkCapable: true,
    approvalRequired: true,
    trendScore: 93
  },

  {
    id: "promo-bridal-season",
    name: "Bridal Season Offer",
    description: "Thiết kế ưu đãi Makeup cô dâu với trọng tâm dịch vụ, quyền lợi và CTA đặt lịch.",
    category: "makeup-promotion",
    subcategory: "Makeup cô dâu",
    style: "burgundy-signature",
    tags: ["cô dâu", "khuyến mãi", "booking", "wedding"],
    baseFormat: "portrait-post",
    supportedFormats: ["portrait-post", "square-post", "story"],
    palette: { background: "#5E1739", surface: "#77284E", primary: "#FCE7F0", secondary: "#E2B7CA", accent: "#D9B46B", text: "#FFFFFF", muted: "#E9CAD7" },
    layout: "promotion-burst",
    fields: promotionFields,
    featured: true,
    trendScore: 95
  },
  {
    id: "promo-party-makeup",
    name: "Party Makeup Glow",
    description: "Bài ưu đãi Makeup tiệc trẻ trung, bắt sáng và dễ chuyển sang Story.",
    category: "makeup-promotion",
    subcategory: "Makeup tiệc",
    style: "soft-glow",
    tags: ["makeup tiệc", "glow", "offer", "beauty"],
    baseFormat: "portrait-post",
    supportedFormats: ["portrait-post", "square-post", "story"],
    palette: { background: "#FFF0F7", surface: "#FFFFFF", primary: "#B34D7D", secondary: "#F0C5D8", accent: "#9C8CFA", text: "#4E263A", muted: "#966C80" },
    layout: "promotion-burst",
    fields: promotionFields.map((item) => item.key === "serviceName" ? { ...item, defaultValue: "MAKEUP TIỆC GLOW LOOK" } : item),
    trendScore: 94
  },
  {
    id: "promo-flash-sale-48h",
    name: "Flash Sale 48H",
    description: "Thiết kế flash sale nhịp mạnh, mức giảm nổi bật và đồng hồ đếm ngược dạng nội dung.",
    category: "makeup-promotion",
    subcategory: "Flash Sale",
    style: "flash-sale-energy",
    tags: ["flash sale", "48h", "deal", "urgent"],
    baseFormat: "square-post",
    supportedFormats: ["square-post", "portrait-post", "story"],
    palette: { background: "#170D22", surface: "#2C1740", primary: "#FF4F9B", secondary: "#8B5CF6", accent: "#FFE04B", text: "#FFFFFF", muted: "#D5B9E7" },
    layout: "promotion-burst",
    fields: promotionFields.map((item) => {
      if (item.key === "offerTitle") return { ...item, defaultValue: "FLASH SALE 48H" };
      if (item.key === "discount") return { ...item, defaultValue: "GIẢM ĐẾN 30%" };
      if (item.key === "deadline") return { ...item, defaultValue: "Kết thúc lúc 23:59 Chủ nhật" };
      return item;
    }),
    trendScore: 98
  },
  {
    id: "promo-bridal-combo",
    name: "Bridal Team Combo",
    description: "Combo makeup cô dâu, mẹ cô dâu và phù dâu với bố cục quyền lợi rõ ràng.",
    category: "makeup-promotion",
    subcategory: "Makeup cô dâu",
    style: "clean-editorial",
    tags: ["combo", "bridal team", "family", "promotion"],
    baseFormat: "portrait-post",
    supportedFormats: ["portrait-post", "story"],
    palette: { background: "#F8F3F4", surface: "#FFFFFF", primary: "#6F1D46", secondary: "#E4CED8", accent: "#C9A05D", text: "#30242A", muted: "#7B6872" },
    layout: "promotion-burst",
    fields: promotionFields.map((item) => item.key === "serviceName" ? { ...item, defaultValue: "BRIDAL TEAM COMBO" } : item),
    trendScore: 91
  }
];

export const DESIGN_CATEGORY_LABELS: Record<DesignTemplateDefinition["category"], string> = {
  "fanpage-cover": "Cover Fanpage",
  "personal-profile": "Profile Makeup Artist",
  "student-invitation": "Thiệp mời học viên",
  "makeup-certificate": "Bằng tốt nghiệp",
  "makeup-promotion": "Thiết kế khuyến mãi"
};
