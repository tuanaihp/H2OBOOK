"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "vi" | "en";
type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void; toggleLocale: () => void; t: (key: string) => string };

// Navigation + shell chrome dictionary. Keys are the source strings hard-coded in the components
// (mostly Vietnamese, some English) so `t(key)` is a drop-in wrapper: it returns the other-language
// value when a mapping exists and the key itself otherwise. Page-body copy uses an inline
// l(vi, en) helper instead of this table.
const translations: Record<string, Record<Locale, string>> = {
  // --- workspace rail domains (components/layout/sidebar.tsx) ---
  Home: { vi: "Trang chủ", en: "Home" }, Learn: { vi: "Học tập", en: "Learn" }, Create: { vi: "Sáng tạo", en: "Create" }, Teach: { vi: "Giảng dạy", en: "Teach" }, Business: { vi: "Kinh doanh", en: "Business" }, System: { vi: "Hệ thống", en: "System" },

  // --- workspace: Learn group links ---
  "Tổng quan đào tạo": { vi: "Tổng quan đào tạo", en: "Training overview" },
  "Journey & Outcomes": { vi: "Hành trình & kết quả", en: "Journey & Outcomes" },
  "Knowledge & Library": { vi: "Kho tri thức & thư viện", en: "Knowledge & Library" },
  "Classes & Cohorts": { vi: "Lớp học & nhóm", en: "Classes & Cohorts" },
  "Assignment & Review": { vi: "Bài tập & chấm bài", en: "Assignment & Review" },
  "Smart Review": { vi: "Ôn tập thông minh", en: "Smart Review" },
  "Quiz & Assessment": { vi: "Trắc nghiệm & đánh giá", en: "Quiz & Assessment" },

  // --- workspace: Create group links ---
  "Kho tài sản": { vi: "Kho tài sản", en: "Asset library" },
  "Nhập nội dung": { vi: "Nhập nội dung", en: "Content import" },
  "Block Library": { vi: "Thư viện khối", en: "Block Library" },
  "Dự án sách": { vi: "Dự án sách", en: "Book projects" },
  "Brand Kit": { vi: "Bộ nhận diện thương hiệu", en: "Brand Kit" },
  Template: { vi: "Mẫu", en: "Templates" },
  "Thư viện thiết kế": { vi: "Thư viện thiết kế", en: "Design library" },
  "Brand Clone": { vi: "Bản sao thương hiệu", en: "Brand Clone" },
  "Bulk Publishing": { vi: "Xuất bản hàng loạt", en: "Bulk Publishing" },
  "H2OBOOK Studio": { vi: "H2OBOOK Studio", en: "H2OBOOK Studio" },
  Preflight: { vi: "Kiểm tra trước in", en: "Preflight" },
  "Publish Center": { vi: "Trung tâm xuất bản", en: "Publish Center" },

  // --- workspace: Teach group links ---
  "Học viên": { vi: "Học viên", en: "Students" },
  "Lớp & lịch học": { vi: "Lớp & lịch học", en: "Classes & schedule" },
  "Đánh giá": { vi: "Đánh giá", en: "Assessment" },
  "Class View": { vi: "Sơ đồ lớp", en: "Class View" },
  "Duyệt xuất bản": { vi: "Duyệt xuất bản", en: "Publish review" },
  "Cộng tác": { vi: "Cộng tác", en: "Collaboration" },
  Automation: { vi: "Tự động hóa", en: "Automation" },
  "Document Queue": { vi: "Hàng đợi tài liệu", en: "Document Queue" },

  // --- workspace: Business group links ---
  "Book Store": { vi: "Cửa hàng sách", en: "Book Store" },
  "Marketplace Studio": { vi: "Xưởng marketplace", en: "Marketplace Studio" },
  "Đơn hàng": { vi: "Đơn hàng", en: "Orders" },
  Membership: { vi: "Gói thành viên", en: "Membership" },
  Analytics: { vi: "Phân tích", en: "Analytics" },
  "Growth Reader": { vi: "Growth Reader", en: "Growth Reader" },
  Licensing: { vi: "Cấp phép", en: "Licensing" },
  "White-label": { vi: "Thương hiệu riêng", en: "White-label" },

  // --- workspace: System group links ---
  "Quản trị": { vi: "Quản trị", en: "Administration" },
  "System Command Center": { vi: "Trung tâm điều hành hệ thống", en: "System Command Center" },
  "Academy Control Center": { vi: "Trung tâm điều hành Academy", en: "Academy Control Center" },
  "Operations Center": { vi: "Trung tâm vận hành", en: "Operations Center" },
  "Enterprise & API": { vi: "Doanh nghiệp & API", en: "Enterprise & API" },
  "Cổng API": { vi: "Cổng API", en: "API Gateway" },
  "Tích hợp": { vi: "Tích hợp", en: "Integrations" },
  "Cloud Sync": { vi: "Đồng bộ đám mây", en: "Cloud Sync" },
  "Offline Center": { vi: "Trung tâm ngoại tuyến", en: "Offline Center" },
  "Bảo mật": { vi: "Bảo mật", en: "Security" },
  "Tài khoản": { vi: "Tài khoản", en: "Account" },
  "Smart Core": { vi: "Lõi thông minh", en: "Smart Core" },
  "AI Policy": { vi: "Chính sách AI", en: "AI Policy" },
  "Cài đặt": { vi: "Cài đặt", en: "Settings" },

  // --- workspace shell chrome (sidebar + topbar) ---
  "AI hỗ trợ đang bật": { vi: "AI hỗ trợ đang bật", en: "AI assist is on" },
  "Lõi độc lập AI": { vi: "Lõi độc lập AI", en: "AI-independent core" },
  "Quản lý gói": { vi: "Quản lý gói", en: "Manage plan" },
  "dung lượng": { vi: "dung lượng", en: "storage" },
  "Smart Tools – AI tùy chọn": { vi: "Smart Tools – AI tùy chọn", en: "Smart Tools – optional AI" },
  "Workspace Owner": { vi: "Chủ workspace", en: "Workspace Owner" },
  "Ưu tiên hôm nay, tiến độ học và các dự án đang hoạt động.": { vi: "Ưu tiên hôm nay, tiến độ học và các dự án đang hoạt động.", en: "Today's priorities, learning progress and active projects." },

  // --- learner shell (components/student/student-shell.tsx + lib/student/compact-navigation.ts) ---
  "Learning Universe": { vi: "Hệ sinh thái học tập", en: "Learning Universe" },
  "Academy Student": { vi: "Học viên Academy", en: "Academy Student" },
  HOME: { vi: "TRANG CHỦ", en: "HOME" }, LEARN: { vi: "HỌC TẬP", en: "LEARN" }, CREATE: { vi: "SÁNG TẠO", en: "CREATE" }, BUSINESS: { vi: "KINH DOANH", en: "BUSINESS" }, TEACH: { vi: "GIẢNG DẠY", en: "TEACH" },
  "CHƯƠNG TRÌNH ĐÀO TẠO": { vi: "CHƯƠNG TRÌNH ĐÀO TẠO", en: "CURRICULUM" },
  "Smart Home": { vi: "Trang tổng quan", en: "Smart Home" },
  "Lịch học": { vi: "Lịch học", en: "Class schedule" },
  "Học training": { vi: "Học lý thuyết", en: "Training" },
  "Học thực hành": { vi: "Học thực hành", en: "Practice" },
  "Bới tóc": { vi: "Bới tóc", en: "Hair styling" },
  "Hành trình của tôi": { vi: "Hành trình của tôi", en: "My journey" },
  "Học & ghi nhớ": { vi: "Học & ghi nhớ", en: "Learn & remember" },
  "Thư viện của tôi": { vi: "Thư viện của tôi", en: "My library" },
  "Thực hành & kết quả": { vi: "Thực hành & kết quả", en: "Practice & results" },
  Studio: { vi: "Xưởng sáng tạo", en: "Studio" },
  "Dự án của tôi": { vi: "Dự án của tôi", en: "My projects" },
  "Công cụ của tôi": { vi: "Công cụ của tôi", en: "My tools" },
  "Trung tâm kinh doanh": { vi: "Trung tâm kinh doanh", en: "Business hub" },
  "Khách hàng & bán hàng": { vi: "Khách hàng & bán hàng", en: "Customers & sales" },
  "Nội dung & tăng trưởng": { vi: "Nội dung & tăng trưởng", en: "Content & growth" },
  "Quyền lợi & vận hành": { vi: "Quyền lợi & vận hành", en: "Benefits & operations" },
  "Lớp của tôi": { vi: "Lớp của tôi", en: "My classes" },
  "Bài cần chấm": { vi: "Bài cần chấm", en: "Assignments to grade" },
  "Học viên được giao": { vi: "Học viên được giao", en: "Assigned students" },
  "Khám phá thêm khóa học": { vi: "Khám phá thêm khóa học", en: "Explore more courses" },
  "Đăng xuất": { vi: "Đăng xuất", en: "Sign out" },
  "Hỏi H2O Mentor": { vi: "Hỏi H2O Mentor", en: "Ask H2O Mentor" },
  "Đang tải tiến độ…": { vi: "Đang tải tiến độ…", en: "Loading progress…" },
  "hành trình": { vi: "hành trình", en: "of journey" },
  "Tiến độ của bạn": { vi: "Tiến độ của bạn", en: "Your progress" },
  "Chưa có dữ liệu": { vi: "Chưa có dữ liệu", en: "Not available" },

  // --- language switcher ---
  "Language / Ngôn ngữ": { vi: "Ngôn ngữ", en: "Language" }, Vietnamese: { vi: "Tiếng Việt", en: "Vietnamese" }, English: { vi: "Tiếng Anh", en: "English" },
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("vi");
  useEffect(() => {
    try { const saved = window.localStorage.getItem("h2obook-locale"); if (saved === "vi" || saved === "en") setLocaleState(saved); } catch { /* Storage can be disabled; keep the session usable. */ }
    const sync = (event: StorageEvent) => { if (event.key === "h2obook-locale" && (event.newValue === "vi" || event.newValue === "en")) setLocaleState(event.newValue); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try { window.localStorage.setItem("h2obook-locale", next); } catch { /* Session preference still applies. */ }
  }, []);
  const value = useMemo(() => ({ locale, setLocale, toggleLocale: () => setLocale(locale === "vi" ? "en" : "vi"), t: (key: string) => translations[key]?.[locale] ?? key }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export function useLocale() { const context = useContext(LocaleContext); if (!context) throw new Error("useLocale must be used inside LocaleProvider"); return context; }
