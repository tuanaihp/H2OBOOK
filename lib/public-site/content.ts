export type PublicBook = {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  level: string;
  readingMinutes: number;
  pages: number;
  price: number;
  accent: string;
  description: string;
  outcomes: string[];
  chapters: string[];
  tags: string[];
};

export type PublicCourse = {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  level: string;
  duration: string;
  lessons: number;
  format: string;
  price: number;
  accent: string;
  description: string;
  outcomes: string[];
  modules: string[];
  featured?: boolean;
};

export type PublicStrategy = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  readingMinutes: number;
  accent: string;
  tools: string[];
  sections: string[];
};

export const publicBooks: PublicBook[] = [
  {
    slug: "giao-trinh-makeup-chuyen-nghiep",
    title: "Giáo trình Makeup Chuyên Nghiệp",
    subtitle: "Hệ thống kiến thức từ nền tảng đến quy trình làm nghề thực tế.",
    category: "Makeup",
    level: "Nền tảng → Chuyên nghiệp",
    readingMinutes: 210,
    pages: 186,
    price: 890000,
    accent: "linear-gradient(145deg,#64143a 0%,#a43866 48%,#edb5cf 100%)",
    description: "Bộ giáo trình trung tâm dành cho học viên muốn học có hệ thống, hiểu bản chất kỹ thuật và biết cách áp dụng trong môi trường khách hàng thật.",
    outcomes: ["Xây nền kỹ thuật vững", "Làm chủ quy trình makeup cô dâu", "Biết tự đánh giá và sửa lỗi", "Sẵn sàng thực hành trên khách thật"],
    chapters: ["Tư duy nghề và dụng cụ", "Phân tích khuôn mặt", "Kỹ thuật nền", "Mắt – mày – môi", "Makeup cô dâu", "Quy trình phục vụ khách"],
    tags: ["Makeup", "Giáo trình", "Cô dâu"]
  },
  {
    slug: "ky-thuat-nen-trong-treo",
    title: "Kỹ thuật Nền Trong Trẻo",
    subtitle: "Kiểm soát da, lớp nền, độ bám và hiệu ứng ảnh cưới.",
    category: "Kỹ thuật",
    level: "Trung cấp",
    readingMinutes: 95,
    pages: 72,
    price: 390000,
    accent: "linear-gradient(145deg,#123f4c 0%,#25869b 50%,#a8e3e8 100%)",
    description: "Phân tích từng lớp sản phẩm, cách xử lý nền theo tình trạng da và ánh sáng để lớp makeup tự nhiên ngoài đời nhưng vẫn đẹp trong ảnh.",
    outcomes: ["Chọn nền theo từng loại da", "Kiểm soát độ dày", "Tăng độ bền", "Giảm lỗi khi chụp ảnh"],
    chapters: ["Đọc tình trạng da", "Chuẩn bị da", "Phối nền", "Che khuyết điểm", "Khóa nền", "Kiểm tra dưới ánh sáng"],
    tags: ["Nền", "Da", "Ảnh cưới"]
  },
  {
    slug: "toc-co-dau-ung-dung",
    title: "Tóc Cô Dâu Ứng Dụng",
    subtitle: "Hệ thống form tóc, độ phồng, nếp và phụ kiện dễ ứng dụng.",
    category: "Hair Styling",
    level: "Nền tảng → Nâng cao",
    readingMinutes: 130,
    pages: 104,
    price: 590000,
    accent: "linear-gradient(145deg,#24253e 0%,#62618d 48%,#d9cbe7 100%)",
    description: "Từ cấu trúc đầu, hướng tóc đến cách dựng form phù hợp gương mặt và trang phục cô dâu.",
    outcomes: ["Dựng form chắc", "Tạo độ phồng tự nhiên", "Gắn phụ kiện cân đối", "Tối ưu thời gian làm tóc"],
    chapters: ["Dụng cụ và sản phẩm", "Chia khu tóc", "Sóng và texture", "Bới thấp", "Bới cao", "Phụ kiện và veil"],
    tags: ["Tóc", "Cô dâu", "Ứng dụng"]
  },
  {
    slug: "chinh-anh-makeup-proart",
    title: "Chỉnh Ảnh Makeup ProArt",
    subtitle: "Giữ đúng tay nghề makeup, nâng chất lượng hình ảnh thương hiệu.",
    category: "Hậu kỳ",
    level: "Trung cấp",
    readingMinutes: 120,
    pages: 88,
    price: 490000,
    accent: "linear-gradient(145deg,#3e1d48 0%,#8b4b91 48%,#e7b7e8 100%)",
    description: "Workflow chỉnh ảnh beauty, da, tóc, màu sắc và ánh sáng để hình ảnh sạch, cao cấp nhưng không làm sai kỹ thuật makeup.",
    outcomes: ["Retouch da tự nhiên", "Giữ texture", "Tối ưu màu makeup", "Xây portfolio đồng nhất"],
    chapters: ["Quản lý file", "Retouch da", "Tóc và chi tiết", "Màu sắc", "Ánh sáng", "Xuất file social"],
    tags: ["Retouch", "Portfolio", "Thương hiệu"]
  },
  {
    slug: "xay-thuong-hieu-nghe-makeup",
    title: "Xây Thương Hiệu Nghề Makeup",
    subtitle: "Từ người làm nghề đến thương hiệu được khách hàng tin chọn.",
    category: "Kinh doanh",
    level: "Mọi cấp độ",
    readingMinutes: 150,
    pages: 126,
    price: 690000,
    accent: "linear-gradient(145deg,#6b3512 0%,#ba7a29 48%,#f0d29a 100%)",
    description: "Bộ khung định vị, nội dung, hình ảnh, trải nghiệm khách hàng và hệ thống uy tín dành riêng cho nghề makeup.",
    outcomes: ["Xác định định vị", "Tạo nội dung có chiến lược", "Tăng độ tin cậy", "Xây hệ thống giới thiệu khách"],
    chapters: ["Định vị cá nhân", "Chân dung khách", "Hệ thống nội dung", "Portfolio bán hàng", "Trải nghiệm khách", "Đo lường và tối ưu"],
    tags: ["Branding", "Content", "Kinh doanh"]
  },
  {
    slug: "ai-tu-dong-hoa-studio",
    title: "AI & Tự Động Hóa Cho Studio",
    subtitle: "Ứng dụng AI đúng việc, giảm thao tác lặp lại và giữ chất lượng vận hành.",
    category: "AI & Vận hành",
    level: "Ứng dụng",
    readingMinutes: 115,
    pages: 96,
    price: 790000,
    accent: "linear-gradient(145deg,#112849 0%,#3d65a3 45%,#77e1df 100%)",
    description: "Hướng dẫn lựa chọn công việc phù hợp để tự động hóa, xây prompt, dữ liệu và quy trình kiểm soát chất lượng trong studio/học viện.",
    outcomes: ["Nhận diện tác vụ nên tự động hóa", "Xây prompt có cấu trúc", "Kiểm soát dữ liệu", "Tạo workflow an toàn"],
    chapters: ["Tư duy AI thực dụng", "Prompt hệ thống", "Quản lý dữ liệu", "Workflow nội dung", "Workflow vận hành", "Kiểm soát chất lượng"],
    tags: ["AI", "Automation", "Studio"]
  }
];

export const publicCourses: PublicCourse[] = [
  {
    slug: "makeup-chuyen-nghiep-3-thang",
    title: "Makeup Chuyên Nghiệp 3 Tháng",
    subtitle: "Học kỹ thuật, thực hành, làm việc nhóm và bước ra nghề với nền móng vững.",
    category: "Khóa nghề",
    level: "Người mới",
    duration: "12 tuần",
    lessons: 48,
    format: "Trực tiếp + H2OBOOK",
    price: 19800000,
    accent: "linear-gradient(135deg,#6f1742,#c65e87,#f1c1d4)",
    description: "Lộ trình toàn diện dành cho người mới bắt đầu, kết hợp bài học tại lớp, giáo trình số, bài tập, chấm điểm và trải nghiệm Makeup Show thực tế.",
    outcomes: ["Thực hiện makeup cô dâu hoàn chỉnh", "Làm tóc ứng dụng", "Tư vấn và chăm sóc khách", "Xây portfolio và thương hiệu cá nhân"],
    modules: ["Nền tảng nghề", "Kỹ thuật makeup", "Kỹ thuật tóc", "Thực hành mẫu", "Làm việc thực tế", "Kinh doanh và thương hiệu"],
    featured: true
  },
  {
    slug: "makeup-advance-master",
    title: "Makeup Advance Master",
    subtitle: "Nâng cấp kỹ thuật, tư duy thẩm mỹ và khả năng tạo concept có dấu ấn.",
    category: "Nâng cao",
    level: "Đã có nền tảng",
    duration: "6 tuần",
    lessons: 24,
    format: "Trực tiếp + dự án",
    price: 12900000,
    accent: "linear-gradient(135deg,#32144c,#884ea1,#d4b5e8)",
    description: "Dành cho makeup artist muốn nâng tầm kỹ thuật, hình ảnh và năng lực sáng tạo concept chuyên nghiệp.",
    outcomes: ["Tạo concept có câu chuyện", "Nâng độ tinh xảo", "Kiểm soát ánh sáng – màu sắc", "Xây bộ ảnh portfolio cao cấp"],
    modules: ["Aesthetic direction", "Advanced skin", "Eye architecture", "Editorial hair", "Concept production", "Portfolio review"]
  },
  {
    slug: "makeup-ca-nhan",
    title: "Makeup Cá Nhân Thông Minh",
    subtitle: "Hiểu khuôn mặt, chọn đúng sản phẩm và tự makeup phù hợp hoàn cảnh.",
    category: "Cá nhân",
    level: "Cơ bản",
    duration: "4 buổi",
    lessons: 12,
    format: "Trực tiếp",
    price: 3600000,
    accent: "linear-gradient(135deg,#8b3d44,#d7898b,#f5d5cf)",
    description: "Lộ trình gọn, thực tế, cá nhân hóa theo gương mặt và nhu cầu sử dụng hằng ngày.",
    outcomes: ["Tự chuẩn bị da", "Makeup đi làm/đi tiệc", "Chọn sản phẩm phù hợp", "Tối ưu thời gian"],
    modules: ["Phân tích gương mặt", "Nền cá nhân", "Mày – mắt", "Môi và hoàn thiện"]
  },
  {
    slug: "chinh-anh-makeup-proart",
    title: "Chỉnh Ảnh Makeup ProArt",
    subtitle: "Xây workflow chỉnh ảnh đẹp, nhanh và đồng nhất thương hiệu.",
    category: "Hậu kỳ",
    level: "Cơ bản → Nâng cao",
    duration: "5 tuần",
    lessons: 20,
    format: "Online + thực hành",
    price: 5900000,
    accent: "linear-gradient(135deg,#24354d,#617eab,#b4d4e9)",
    description: "Tập trung vào kỹ năng hậu kỳ đúng với ảnh makeup, portfolio và nội dung truyền thông.",
    outcomes: ["Retouch tự nhiên", "Phối màu có gu", "Tăng tốc workflow", "Tạo preset cá nhân"],
    modules: ["Quản lý file", "Retouch", "Color grading", "Hair cleanup", "Portfolio system"]
  },
  {
    slug: "kinh-doanh-nghe-makeup",
    title: "Kinh Doanh Nghề Makeup Thực Chiến",
    subtitle: "Có khách sớm, định giá đúng, vận hành gọn và phát triển bền vững.",
    category: "Kinh doanh",
    level: "Makeup Artist / Chủ studio",
    duration: "8 tuần",
    lessons: 32,
    format: "Online + coaching",
    price: 8900000,
    accent: "linear-gradient(135deg,#5c3213,#be7f30,#f0ca84)",
    description: "Hệ thống hóa toàn bộ hành trình từ định vị, marketing, tư vấn, giá, chăm sóc khách đến quản lý tài chính và đội nhóm.",
    outcomes: ["Xây tệp khách mục tiêu", "Tạo hệ thống nội dung", "Tư vấn chốt khách", "Theo dõi doanh thu – chi phí"],
    modules: ["Định vị", "Sản phẩm – giá", "Content", "Tư vấn", "CRM", "Vận hành", "Đội nhóm", "Tăng trưởng"],
    featured: true
  },
  {
    slug: "ai-automation-beauty-business",
    title: "AI Automation Cho Beauty Business",
    subtitle: "Dùng AI như trợ lý vận hành, không phụ thuộc AI để làm lõi nghiệp vụ.",
    category: "AI & công nghệ",
    level: "Ứng dụng",
    duration: "4 tuần",
    lessons: 16,
    format: "Online lab",
    price: 6900000,
    accent: "linear-gradient(135deg,#10294e,#4457bd,#4dd8db)",
    description: "Xây workflow AI cho nội dung, tư vấn, nghiên cứu concept, quản trị tài liệu và tự động hóa studio.",
    outcomes: ["Thiết kế prompt workflow", "Tạo kho tri thức", "Tự động hóa báo cáo", "Kiểm soát chi phí và chất lượng"],
    modules: ["AI foundation", "Prompt architecture", "Knowledge base", "Automation", "Agent control", "Security"]
  }
];

export const publicStrategies: PublicStrategy[] = [
  {
    slug: "co-khach-som-cho-makeup-artist-moi",
    title: "Có khách sớm cho Makeup Artist mới",
    category: "Có khách",
    summary: "Một lộ trình 30 ngày để biến kỹ năng đang học thành bằng chứng năng lực và các cuộc hội thoại với khách hàng thật.",
    readingMinutes: 14,
    accent: "#d85f89",
    tools: ["Checklist 30 ngày", "Mẫu portfolio", "Kịch bản nhắn tin"],
    sections: ["Xác định dịch vụ đầu tiên", "Tạo 5 bằng chứng năng lực", "Xây tệp khách gần", "Nội dung tạo cuộc hội thoại", "Đo lường và cải tiến"]
  },
  {
    slug: "dinh-gia-khong-bi-re",
    title: "Định giá mà không bị kéo về cuộc chiến giá rẻ",
    category: "Giá & sản phẩm",
    summary: "Xây gói dịch vụ dựa trên kết quả, trải nghiệm và mức độ chăm sóc thay vì chỉ cộng chi phí sản phẩm.",
    readingMinutes: 11,
    accent: "#d6a84e",
    tools: ["Bảng tính giá", "Khung 3 gói", "Checklist phát sinh"],
    sections: ["Chi phí thật", "Giá trị cảm nhận", "Thiết kế ba gói", "Quy tắc phát sinh", "Trình bày giá"]
  },
  {
    slug: "content-90-ngay-nghe-makeup",
    title: "Hệ thống Content 90 ngày cho nghề Makeup",
    category: "Content",
    summary: "Tổ chức nội dung theo vấn đề khách hàng, bằng chứng tay nghề, câu chuyện và lời mời hành động.",
    readingMinutes: 18,
    accent: "#7b75dc",
    tools: ["Content matrix", "Lịch 90 ngày", "Hook library"],
    sections: ["Bốn trụ cột", "Nội dung giáo dục", "Nội dung bằng chứng", "Nội dung câu chuyện", "CTA và đo lường"]
  },
  {
    slug: "tu-van-chot-khach-khong-gay-ap-luc",
    title: "Tư vấn chốt khách không gây áp lực",
    category: "Tư vấn",
    summary: "Dẫn dắt khách từ nỗi lo, mong muốn và bối cảnh thật đến một lựa chọn phù hợp, minh bạch.",
    readingMinutes: 13,
    accent: "#46a8aa",
    tools: ["Bộ câu hỏi", "Kịch bản tư vấn", "Follow-up 3 bước"],
    sections: ["Hiểu bối cảnh", "Làm rõ nỗi lo", "Đề xuất phương án", "Xử lý do dự", "Follow-up"]
  },
  {
    slug: "xay-doi-nhom-makeup",
    title: "Xây đội nhóm Makeup vận hành ổn định",
    category: "Đội nhóm",
    summary: "Phân vai, chuẩn hóa chất lượng, giao việc và phản hồi để đội nhóm phát triển mà không phụ thuộc hoàn toàn vào chủ.",
    readingMinutes: 17,
    accent: "#4f79bd",
    tools: ["Role map", "SOP chất lượng", "Scorecard"],
    sections: ["Thiết kế vai trò", "Tiêu chuẩn chất lượng", "Đào tạo tại chỗ", "Giao việc", "Đánh giá"]
  },
  {
    slug: "mo-studio-hoc-vien",
    title: "Từ Makeup Artist đến Studio/Học viện",
    category: "Tăng trưởng",
    summary: "Các điều kiện cần trước khi mở rộng: sản phẩm, khách hàng, tài chính, quy trình, đội ngũ và năng lực đào tạo.",
    readingMinutes: 22,
    accent: "#9d4f88",
    tools: ["Readiness score", "Kế hoạch 12 tháng", "Dashboard KPI"],
    sections: ["Điều kiện mở rộng", "Mô hình doanh thu", "Tài chính", "Quy trình", "Đội ngũ", "Lộ trình 12 tháng"]
  }
];

export const learningPaths = [
  { id: "starter", index: "01", title: "Người mới bắt đầu", description: "Hiểu nghề, dụng cụ, vệ sinh, gương mặt và kỹ thuật nền tảng.", duration: "0–2 tháng", skills: ["Nền tảng makeup", "Tóc cơ bản", "Thực hành có hướng dẫn"] },
  { id: "first-client", index: "02", title: "Có khách đầu tiên", description: "Hoàn thiện dịch vụ đầu tiên, portfolio và quy trình chăm sóc khách.", duration: "2–4 tháng", skills: ["Makeup cô dâu", "Tư vấn", "Portfolio", "Giá khởi đầu"] },
  { id: "professional", index: "03", title: "Makeup Artist chuyên nghiệp", description: "Tăng độ ổn định kỹ thuật, tốc độ, trải nghiệm và thương hiệu cá nhân.", duration: "4–12 tháng", skills: ["Kỹ thuật nâng cao", "Content", "CRM", "Khách hàng quay lại"] },
  { id: "leader", index: "04", title: "Xây đội nhóm", description: "Chuẩn hóa chất lượng, phân vai, đào tạo và giao việc.", duration: "12–24 tháng", skills: ["SOP", "Đào tạo", "Quản trị", "Tài chính"] },
  { id: "academy", index: "05", title: "Studio / Học viện", description: "Xây mô hình sản phẩm, thương hiệu và hệ thống tăng trưởng dài hạn.", duration: "24 tháng+", skills: ["Chiến lược", "Sản phẩm đào tạo", "Đội ngũ", "Automation"] }
];

export const successStories = [
  { name: "Minh Anh", role: "Makeup Artist cô dâu", result: "Từ người mới đến nhận khách đầu tiên sau 4 tháng", quote: "Lần đầu mình biết chính xác hôm nay cần học gì, thực hành gì và sai ở đâu." },
  { name: "Thu Hà", role: "Founder studio nhỏ", result: "Chuẩn hóa 3 gói dịch vụ và quy trình tư vấn", quote: "Không còn đăng bài ngẫu nhiên. Mọi nội dung đều phục vụ một mục tiêu kinh doanh rõ ràng." },
  { name: "Khánh Linh", role: "Học viên Advance", result: "Hoàn thiện portfolio concept và tham gia Makeup Show", quote: "Trải nghiệm thực tế giúp mình hiểu áp lực thời gian, teamwork và tiêu chuẩn chuyên nghiệp." }
];

export type MembershipPlan = { id: string; name: string; price: number; period: string; description: string; features: string[]; featured?: boolean };

export const membershipPlans: MembershipPlan[] = [
  { id: "library", name: "Knowledge Library", price: 299000, period: "tháng", description: "Dành cho người muốn đọc, ôn tập và cập nhật kiến thức.", features: ["Thư viện sách số", "Ghi chú và bookmark", "Strategy Hub", "Cập nhật nội dung"] },
  { id: "academy", name: "Academy Pro", price: 799000, period: "tháng", description: "Lộ trình học có bài tập, Skill Map và đánh giá tiến độ.", features: ["Toàn bộ Library", "Khóa học online", "Bài tập thực hành", "Skill Map", "H2O Mentor local"] , featured: true},
  { id: "business", name: "Beauty Business", price: 1490000, period: "tháng", description: "Dành cho makeup artist và chủ studio đang xây hệ thống kinh doanh.", features: ["Toàn bộ Academy", "Strategy Intelligence", "Template vận hành", "Coaching group", "AI workflow lab"] }
];

export function findPublicBook(slug: string) { return publicBooks.find((item) => item.slug === slug); }
export function findPublicCourse(slug: string) { return publicCourses.find((item) => item.slug === slug); }
export function findPublicStrategy(slug: string) { return publicStrategies.find((item) => item.slug === slug); }

export function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}
