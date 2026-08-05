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

/**
 * Copy for a sample book, keyed by the element ids in demoBook's three pages.
 *
 * The sibling books were originally `{ ...demoBook, id, title }`. A spread is shallow, so all three
 * shared one pages array: opening "Kỹ thuật nền trong trẻo" showed the makeup-course pages word for
 * word, and every element carried the same id in all three books. A later pass gave each book its
 * own pages and retitled anything containing the source title — which missed everything, because
 * the cover reads "GIÁO TRÌNH\nMAKEUP CHUYÊN NGHIỆP" in caps across a line break and the chapter
 * text never mentions the title at all. Hence real copy per book rather than string substitution.
 *
 * These stay sample books. The point is that three sample books now read as three different books,
 * which is what a reader demo is for.
 */
interface SampleBookCopy {
  cover_title: string;
  cover_subtitle: string;
  intro_title: string;
  intro_body: string;
  intro_quote: string;
  check_text: string;
}

function buildSampleBook(
  source: H2OBook,
  meta: { id: string; title: string; subtitle: string; status: H2OBook["status"]; cover: string },
  copy: SampleBookCopy
): H2OBook {
  const overrides = copy as unknown as Record<string, string>;
  return {
    ...source,
    ...meta,
    pages: source.pages.map((page, pageIndex) => ({
      ...page,
      id: `${meta.id}_p${pageIndex + 1}`,
      elements: page.elements.map((element) => {
        const replacement = overrides[element.id];
        return {
          ...element,
          id: `${meta.id}_${element.id}`,
          ...(replacement === undefined ? {} : { text: replacement })
        };
      })
    }))
  };
}

export const libraryBooks: H2OBook[] = [
  demoBook,
  buildSampleBook(
    demoBook,
    { id: "book_skin", title: "Kỹ thuật nền trong trẻo", subtitle: "Từ phân tích da đến hoàn thiện nền bền đẹp", status: "published", cover: "linear-gradient(135deg,#173d4d,#4f95a2,#d7f2ef)" },
    {
      cover_title: "KỸ THUẬT NỀN\nTRONG TRẺO",
      cover_subtitle: "Phân tích da • Lớp nền • Độ bền • Ánh sáng",
      intro_title: "Đọc da trước khi chạm cọ",
      intro_body: "Một lớp nền trong trẻo được quyết định trước khi mở hộp phấn. Hãy đọc da theo bốn thông tin: độ ẩm, độ dầu ở vùng chữ T, kết cấu lỗ chân lông và sắc độ dưới ánh sáng trắng. Bốn thông tin này quyết định lượng dưỡng, độ che phủ cần thiết và thời gian chờ giữa các lớp. Nền dày không làm da đẹp hơn; nền đúng thứ tự mới giữ được vẻ trong.",
      intro_quote: "“Nền đẹp là nền nhìn thấy da, không phải nhìn thấy lớp phấn.”",
      check_text: "01  Làm sạch và cân bằng độ ẩm\n\n02  Đọc da dưới ánh sáng trắng\n\n03  Chọn độ che phủ theo tình trạng da\n\n04  Chờ đủ thời gian giữa các lớp\n\n05  Khóa nền theo từng vùng"
    }
  ),
  buildSampleBook(
    demoBook,
    { id: "book_hair", title: "Tóc cô dâu ứng dụng", subtitle: "Hệ thống form tóc từ cơ bản đến nâng cao", status: "template", cover: "linear-gradient(135deg,#32231e,#85644e,#e8d5bc)" },
    {
      cover_title: "TÓC CÔ DÂU\nỨNG DỤNG",
      cover_subtitle: "Form tóc • Giữ nếp • Phụ kiện • Thời gian",
      intro_title: "Chọn form tóc theo khuôn mặt và trang phục",
      intro_body: "Form tóc cô dâu không chọn theo xu hướng mà chọn theo ba ràng buộc: tỉ lệ khuôn mặt, cổ áo của trang phục và thời lượng buổi lễ. Một búi thấp gọn phù hợp cổ thuyền và lễ kéo dài; tóc xõa uốn hợp cổ tim nhưng cần lớp giữ nếp kỹ hơn. Xác định ba ràng buộc này trước khi tạo khối sẽ tiết kiệm phần lớn thời gian chỉnh sửa.",
      intro_quote: "“Form tóc giữ được đến cuối buổi lễ mới là form tóc đúng.”",
      check_text: "01  Xác định tỉ lệ khuôn mặt và cổ áo\n\n02  Tạo chân tóc và lớp giữ nếp\n\n03  Dựng khối chính\n\n04  Cân đối phụ kiện\n\n05  Kiểm tra độ bền sau 30 phút"
    }
  )
];
