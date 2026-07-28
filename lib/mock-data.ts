import { BrandProfile, H2OBook } from "@/types/editor";

export const defaultBrand: BrandProfile = {
  id: "brand_thuyh2o",
  name: "THUYH2O MAKEUP",
  expertName: "Thủy H2O",
  expertTitle: "Founder & Makeup Educator",
  logoUrl: "",
  avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
  primaryColor: "#6f1d46",
  secondaryColor: "#f6e9ee",
  accentColor: "#d4a055",
  headingFont: "Georgia",
  bodyFont: "Arial",
  phone: "0900 000 000",
  email: "hello@thuyh2o.vn",
  website: "thuyh2o.vn",
  address: "Hải Phòng, Việt Nam"
};

export const demoBook: H2OBook = {
  id: "book_makeup_pro",
  title: "Giáo trình Makeup Chuyên Nghiệp",
  subtitle: "Hệ thống kiến thức nền tảng đến ứng dụng thực chiến",
  author: "Thủy H2O",
  cover: "linear-gradient(135deg,#571535,#a44e73 55%,#f0c9d8)",
  status: "draft",
  updatedAt: new Date().toISOString(),
  pages: [
    {
      id: "page_cover",
      name: "Bìa sách",
      width: 794,
      height: 1123,
      background: "#681c43",
      elements: [
        {
          id: "cover_kicker", type: "text", name: "Thương hiệu", x: 72, y: 68, width: 650, height: 42,
          rotation: 0, opacity: 1, locked: false, hidden: false, text: "{{brand.name}}", fontSize: 22,
          fontFamily: "Arial", fontWeight: 700, align: "center", fill: "#f5d9e3", bindingKey: "brand.name",
          permissions: { canEditContent: true, canMove: true, canResize: true, canDelete: false, canChangeColor: true }
        },
        {
          id: "cover_title", type: "text", name: "Tên sách", x: 86, y: 275, width: 620, height: 230,
          rotation: 0, opacity: 1, locked: false, hidden: false, text: "GIÁO TRÌNH\nMAKEUP CHUYÊN NGHIỆP", fontSize: 58,
          fontFamily: "Georgia", fontWeight: 700, align: "center", fill: "#ffffff",
          permissions: { canEditContent: true, canMove: true, canResize: true, canDelete: false, canChangeColor: true }
        },
        {
          id: "cover_subtitle", type: "text", name: "Phụ đề", x: 112, y: 545, width: 570, height: 90,
          rotation: 0, opacity: 1, locked: false, hidden: false, text: "Nền tảng • Kỹ thuật • Ứng dụng • Kinh doanh", fontSize: 21,
          fontFamily: "Arial", fontWeight: 400, align: "center", fill: "#f7dce5",
          permissions: { canEditContent: true, canMove: true, canResize: true, canDelete: true, canChangeColor: true }
        },
        {
          id: "cover_line", type: "shape", name: "Khối trang trí", x: 280, y: 665, width: 235, height: 8,
          rotation: 0, opacity: 1, locked: false, hidden: false, fill: "#d4a055", cornerRadius: 10,
          permissions: { canEditContent: false, canMove: true, canResize: true, canDelete: true, canChangeColor: true }
        },
        {
          id: "cover_author", type: "text", name: "Tác giả", x: 150, y: 925, width: 495, height: 65,
          rotation: 0, opacity: 1, locked: false, hidden: false, text: "{{expert.name}} — {{expert.title}}", fontSize: 20,
          fontFamily: "Arial", fontWeight: 500, align: "center", fill: "#ffffff", bindingKey: "expert.name",
          permissions: { canEditContent: true, canMove: true, canResize: true, canDelete: false, canChangeColor: true }
        }
      ]
    },
    {
      id: "page_intro",
      name: "Lời mở đầu",
      width: 794,
      height: 1123,
      background: "#fffaf7",
      elements: [
        {
          id: "intro_chapter", type: "text", name: "Nhãn chương", x: 72, y: 78, width: 650, height: 35,
          rotation: 0, opacity: 1, locked: false, hidden: false, text: "CHƯƠNG 01", fontSize: 15,
          fontFamily: "Arial", fontWeight: 700, align: "left", fill: "#a44e73",
          permissions: { canEditContent: true, canMove: true, canResize: true, canDelete: true, canChangeColor: true }
        },
        {
          id: "intro_title", type: "text", name: "Tiêu đề", x: 72, y: 130, width: 650, height: 100,
          rotation: 0, opacity: 1, locked: false, hidden: false, text: "Tư duy nền tảng của một Makeup Artist chuyên nghiệp", fontSize: 40,
          fontFamily: "Georgia", fontWeight: 700, align: "left", fill: "#4a1831",
          permissions: { canEditContent: true, canMove: true, canResize: true, canDelete: false, canChangeColor: true }
        },
        {
          id: "intro_body", type: "text", name: "Nội dung", x: 72, y: 285, width: 650, height: 360,
          rotation: 0, opacity: 1, locked: false, hidden: false, text: "Makeup chuyên nghiệp không bắt đầu từ việc sở hữu thật nhiều mỹ phẩm. Nền tảng quan trọng nhất là khả năng quan sát khuôn mặt, hiểu cấu trúc, kiểm soát ánh sáng và lựa chọn kỹ thuật phù hợp với từng khách hàng.\n\nTrong chương này, học viên sẽ xây dựng tư duy đúng trước khi bước vào các kỹ thuật chi tiết. Mỗi bài học đều đi kèm mục tiêu, checklist thực hành và tiêu chí tự đánh giá.", fontSize: 23,
          fontFamily: "Arial", fontWeight: 400, align: "left", fill: "#392f34",
          permissions: { canEditContent: true, canMove: true, canResize: true, canDelete: false, canChangeColor: true }
        },
        {
          id: "intro_callout", type: "shape", name: "Khung ghi nhớ", x: 72, y: 710, width: 650, height: 205,
          rotation: 0, opacity: 1, locked: false, hidden: false, fill: "#f5e5eb", cornerRadius: 24,
          permissions: { canEditContent: false, canMove: true, canResize: true, canDelete: true, canChangeColor: true }
        },
        {
          id: "intro_quote", type: "text", name: "Ghi nhớ", x: 112, y: 755, width: 570, height: 120,
          rotation: 0, opacity: 1, locked: false, hidden: false, text: "“Nhìn thấy vẻ đẹp của khách hàng trước khi nhìn thấy lớp makeup.”", fontSize: 29,
          fontFamily: "Georgia", fontWeight: 600, align: "center", fill: "#681c43",
          permissions: { canEditContent: true, canMove: true, canResize: true, canDelete: true, canChangeColor: true }
        }
      ]
    },
    {
      id: "page_checklist",
      name: "Checklist thực hành",
      width: 794,
      height: 1123,
      background: "#f4ece7",
      elements: [
        {
          id: "check_title", type: "text", name: "Tiêu đề", x: 70, y: 80, width: 654, height: 80,
          rotation: 0, opacity: 1, locked: false, hidden: false, text: "CHECKLIST THỰC HÀNH", fontSize: 42,
          fontFamily: "Georgia", fontWeight: 700, align: "center", fill: "#681c43",
          permissions: { canEditContent: true, canMove: true, canResize: true, canDelete: false, canChangeColor: true }
        },
        {
          id: "check_box", type: "shape", name: "Khung nội dung", x: 70, y: 205, width: 654, height: 720,
          rotation: 0, opacity: 1, locked: false, hidden: false, fill: "#ffffff", cornerRadius: 28,
          permissions: { canEditContent: false, canMove: true, canResize: true, canDelete: true, canChangeColor: true }
        },
        {
          id: "check_text", type: "text", name: "Danh sách", x: 115, y: 260, width: 565, height: 575,
          rotation: 0, opacity: 1, locked: false, hidden: false,
          text: "01  Chuẩn bị dụng cụ và vệ sinh cọ\n\n02  Phân tích loại da và tình trạng da\n\n03  Chọn tone nền và kỹ thuật hiệu chỉnh\n\n04  Kiểm tra nền dưới ánh sáng tự nhiên\n\n05  Chụp ảnh trước – sau để tự đánh giá\n\n06  Ghi lại công thức sản phẩm đã sử dụng",
          fontSize: 25, fontFamily: "Arial", fontWeight: 500, align: "left", fill: "#3f3438",
          permissions: { canEditContent: true, canMove: true, canResize: true, canDelete: false, canChangeColor: true }
        },
        {
          id: "check_footer", type: "text", name: "Chân trang", x: 70, y: 1010, width: 654, height: 35,
          rotation: 0, opacity: 1, locked: false, hidden: false, text: "{{brand.name}}  •  {{brand.website}}", fontSize: 15,
          fontFamily: "Arial", fontWeight: 600, align: "center", fill: "#8d6073", bindingKey: "brand.name",
          permissions: { canEditContent: true, canMove: true, canResize: true, canDelete: false, canChangeColor: true }
        }
      ]
    }
  ]
};

export const libraryBooks = [
  demoBook,
  { ...demoBook, id: "book_skin", title: "Kỹ thuật nền trong trẻo", subtitle: "Từ phân tích da đến hoàn thiện nền bền đẹp", status: "published" as const, cover: "linear-gradient(135deg,#173d4d,#4f95a2,#d7f2ef)" },
  { ...demoBook, id: "book_hair", title: "Tóc cô dâu ứng dụng", subtitle: "Hệ thống form tóc từ cơ bản đến nâng cao", status: "template" as const, cover: "linear-gradient(135deg,#32231e,#85644e,#e8d5bc)" }
];

export const studentRows = [
  { id: 1, name: "Nguyễn Minh Anh", email: "minhanh@example.com", course: "Makeup Pro K26", progress: 78, status: "Đang học" },
  { id: 2, name: "Trần Thu Hà", email: "thuha@example.com", course: "Makeup Pro K26", progress: 46, status: "Đang học" },
  { id: 3, name: "Lê Ngọc Mai", email: "ngocmai@example.com", course: "Nền trong trẻo", progress: 100, status: "Hoàn thành" },
  { id: 4, name: "Phạm Khánh Linh", email: "khanhlinh@example.com", course: "Tóc cô dâu", progress: 21, status: "Đang học" }
];
