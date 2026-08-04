import type { Metadata } from "next";

// Vietnamese typography fixture required by the font rollout. Kept out of search results and out of
// the navigation — it exists so diacritics can be checked against both families at every weight the
// app actually loads, on a real device, after deploy. Delete the route once the rollout is signed
// off; nothing links to it.
export const metadata: Metadata = { title: "Typography fixture", robots: { index: false, follow: false } };

const PANGRAM = "Một bộ não tri thức kết nối toàn bộ hành trình nghề Makeup.";
const PARAGRAPH = "H2O Brain thu nhận sách, khóa học, bài thực hành và dữ liệu nghề; sau đó kết nối chúng thành Skill Map, lộ trình học và bước hành động tiếp theo.";
const NAMES = "Trường học · nghề nghiệp · thẩm mỹ · kỹ thuật · chuyển đổi · dữ liệu · quyền sở hữu · Nguyễn Thị Thủy · Đặng Hoàng Yến · Lê Bảo Ngọc.";
const GLYPH_ROWS = [
  "ă â ê ô ơ ư đ",
  "Ă Â Ê Ô Ơ Ư Đ",
  "á à ả ã ạ",
  "ắ ằ ẳ ẵ ặ",
  "ấ ầ ẩ ẫ ậ",
  "é è ẻ ẽ ẹ",
  "ế ề ể ễ ệ",
  "í ì ỉ ĩ ị",
  "ó ò ỏ õ ọ",
  "ố ồ ổ ỗ ộ",
  "ớ ờ ở ỡ ợ",
  "ú ù ủ ũ ụ",
  "ứ ừ ử ữ ự",
  "ý ỳ ỷ ỹ ỵ"
];

// Only the weights lib/fonts.ts actually downloads. Literata is variable, so every step is real;
// Be Vietnam Pro ships these six cuts and rounds 650/750/850/950 to the nearest one.
const HEADING_WEIGHTS = [400, 600, 700];
const BODY_WEIGHTS = [400, 500, 600, 700, 800, 900];

function Specimen({ family, label, weights }: { family: string; label: string; weights: number[] }) {
  return <section style={{ marginBottom: 56 }}>
    <h2 style={{ fontFamily: "var(--font-sans)", fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase", color: "#7c6f76", margin: "0 0 18px" }}>{label}</h2>
    {weights.map((weight) => <div key={weight} style={{ marginBottom: 26, paddingBottom: 22, borderBottom: "1px solid #e8e2e5" }}>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "#7c6f76", marginBottom: 8 }}>{weight}</div>
      <p style={{ fontFamily: family, fontWeight: weight, fontSize: 30, lineHeight: 1.25, margin: "0 0 10px" }}>{PANGRAM}</p>
      <p style={{ fontFamily: family, fontWeight: weight, fontSize: 16, lineHeight: 1.75, margin: "0 0 8px" }}>{PARAGRAPH}</p>
      <p style={{ fontFamily: family, fontWeight: weight, fontSize: 14, lineHeight: 1.7, margin: 0, color: "#7c6f76" }}>{NAMES}</p>
    </div>)}
    <div style={{ fontFamily: family, fontSize: 24, lineHeight: 1.9, letterSpacing: ".04em" }}>
      {GLYPH_ROWS.map((row) => <div key={row}>{row}</div>)}
    </div>
  </section>;
}

export default function TypographyFixturePage() {
  return <main style={{ maxWidth: 940, margin: "0 auto", padding: "48px 24px 96px" }}>
    <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 44, lineHeight: 1.05, margin: "0 0 6px" }}>Kiểm tra dấu tiếng Việt</h1>
    <p style={{ fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.7, color: "#7c6f76", margin: "0 0 44px" }}>
      Mỗi khối dưới đây phải hiển thị cùng một kiểu chữ trên toàn bộ dòng. Nếu một chữ có dấu đột ngột đổi
      dáng so với chữ không dấu bên cạnh, nghĩa là trình duyệt đang thay thế bằng font dự phòng và cần báo lại.
    </p>
    <Specimen family="var(--font-serif)" label="Literata — tiêu đề, nội dung editorial" weights={HEADING_WEIGHTS} />
    <Specimen family="var(--font-sans)" label="Be Vietnam Pro — giao diện, nội dung, biểu mẫu" weights={BODY_WEIGHTS} />
  </main>;
}
