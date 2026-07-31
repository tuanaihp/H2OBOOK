import type { DemoLicense, DemoMembership, DemoOrder, DemoPortal, DemoProduct } from "./types";

export const demoProducts: DemoProduct[] = [
  { id: "product-book-pro", name: "Giáo trình Makeup Chuyên Nghiệp", type: "book", price: 890000, compareAtPrice: 1290000, sales: 84, revenue: 74760000, status: "active", cover: "linear-gradient(135deg,#741448,#e7a8c6)", description: "Bộ giáo trình hệ thống từ nền tảng đến ứng dụng thực chiến." },
  { id: "product-book-foundation", name: "Kỹ thuật nền trong trẻo", type: "book", price: 390000, sales: 126, revenue: 49140000, status: "active", cover: "linear-gradient(135deg,#155166,#8ee6ea)", description: "Phân tích da, lựa chọn sản phẩm và hoàn thiện nền bền đẹp." },
  { id: "product-template-master", name: "Template Giáo trình Makeup Master", type: "template", price: 1290000, sales: 28, revenue: 36120000, status: "active", cover: "linear-gradient(135deg,#4e1737,#d790b0)", description: "Quyền clone và nhân hóa thương hiệu cho học viện." },
  { id: "product-membership", name: "Membership Academy", type: "membership", price: 299000, sales: 146, revenue: 43654000, status: "active", cover: "linear-gradient(135deg,#33192c,#dc9ebe)", description: "Truy cập toàn bộ thư viện tài liệu đào tạo theo kỳ." },
];

export const demoOrders: DemoOrder[] = [
  { id: "order-1", code: "H2B-260728-9288", customer: "Khách hàng demo", email: "demo@example.com", product: "Kỹ thuật nền trong trẻo", total: 390000, method: "qr", payment: "pending", entitlement: "pending", createdAt: "2026-07-28" },
  { id: "order-2", code: "H2B-260725-0186", customer: "Nguyễn Thanh Vy", email: "vy@example.com", product: "Giáo trình Makeup Chuyên Nghiệp", total: 890000, method: "qr", payment: "paid", entitlement: "granted", createdAt: "2026-07-27" },
  { id: "order-3", code: "H2B-260725-0185", customer: "Lê Bảo Ngọc", email: "ngoc@example.com", product: "Membership Academy", total: 299000, method: "bank_transfer", payment: "pending", entitlement: "pending", createdAt: "2026-07-27" },
  { id: "order-4", code: "H2B-260724-0184", customer: "Học viện Lumi", email: "hello@lumibeauty.vn", product: "Template Giáo trình Makeup Master", total: 1290000, method: "manual", payment: "paid", entitlement: "granted", createdAt: "2026-07-26" },
];

export const demoMemberships: DemoMembership[] = [
  { id: "membership-1", member: "Nguyễn Minh Anh", plan: "Academy Monthly", cycle: "month", value: 299000, renewsAt: "2026-08-07", status: "active" },
  { id: "membership-2", member: "Trần Thu Hà", plan: "Academy Annual", cycle: "year", value: 2990000, renewsAt: "2027-05-09", status: "active" },
  { id: "membership-3", member: "Phạm Khánh Linh", plan: "Trial", cycle: "month", value: 0, renewsAt: "2026-07-30", status: "trial" },
];

export const demoLicenses: DemoLicense[] = [
  { id: "license-1", partner: "Lumi Beauty Academy", template: "template_makeup_master", model: "revenue_share", seats: 120, clonesUsed: 2, cloneLimit: 5, revenue: 38600000, royaltyRate: 20, status: "active" },
  { id: "license-2", partner: "Mộc Beauty", template: "template_skin", model: "one_time", seats: 45, clonesUsed: 1, cloneLimit: 3, revenue: 1290000, royaltyRate: 0, status: "active" },
];

export const demoPortals: DemoPortal[] = [
  { id: "portal-1", name: "ThuyH2O Academy Library", domain: "book.thuyh2o.vn", books: 2, members: 184, plan: "business", status: "active", primary: "#6f1446", accent: "#e1a0c1" },
  { id: "portal-2", name: "Lumi Beauty Learning", domain: "/lumi-beauty", books: 1, members: 38, plan: "academy", status: "draft", primary: "#172941", accent: "#d4a055" },
];
