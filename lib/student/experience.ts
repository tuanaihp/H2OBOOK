export type StudentSkill = {
  id: string;
  title: string;
  group: "Makeup" | "Hair" | "Career" | "Business";
  progress: number;
  status: "completed" | "active" | "locked" | "practice";
  evidence: string;
};

export const studentSkills: StudentSkill[] = [
  { id: "skin", title: "Kỹ thuật nền", group: "Makeup", progress: 86, status: "active", evidence: "4/5 bài đạt" },
  { id: "face", title: "Phân tích khuôn mặt", group: "Makeup", progress: 100, status: "completed", evidence: "Đã chứng nhận" },
  { id: "bridal", title: "Makeup cô dâu", group: "Makeup", progress: 68, status: "practice", evidence: "Cần 2 bài thực hành" },
  { id: "waves", title: "Sóng và texture", group: "Hair", progress: 72, status: "active", evidence: "3/4 form tóc" },
  { id: "updo", title: "Tóc bới ứng dụng", group: "Hair", progress: 44, status: "practice", evidence: "Đang luyện form thấp" },
  { id: "consult", title: "Tư vấn khách hàng", group: "Career", progress: 61, status: "active", evidence: "2 tình huống mô phỏng" },
  { id: "team", title: "Làm việc nhóm", group: "Career", progress: 82, status: "active", evidence: "1 Makeup Show" },
  { id: "pricing", title: "Định giá dịch vụ", group: "Business", progress: 30, status: "locked", evidence: "Mở sau kỹ năng tư vấn" },
  { id: "brand", title: "Thương hiệu cá nhân", group: "Business", progress: 22, status: "locked", evidence: "Mở sau Portfolio" }
];

export const studentMissions = [
  { id: "mission-skin", title: "Hoàn thiện nền cô dâu trong trẻo", detail: "Xem bài 3.2, thực hành trên mẫu và tải 3 góc ảnh.", duration: "35 phút", progress: 50, steps: ["Xem bài giảng", "Thực hành trên mẫu", "Tải ảnh bài tập", "Nhận đánh giá"] },
  { id: "mission-review", title: "Ôn 12 flashcard đang đến hạn", detail: "Tập trung vào lỗi nền và phân tích loại da.", duration: "12 phút", progress: 25, steps: ["Ôn nhóm nền", "Ôn nhóm da", "Đánh dấu câu khó"] }
];

export const studentAchievements = [
  { title: "Nền tảng vững", description: "Hoàn thành 100% phần phân tích khuôn mặt", icon: "✦" },
  { title: "7 ngày liên tục", description: "Duy trì nhịp học trong một tuần", icon: "◈" },
  { title: "Team Player", description: "Hoàn thành hoạt động Makeup Show", icon: "◎" },
  { title: "First Portfolio", description: "Đăng 5 bài thực hành đạt chuẩn", icon: "◇" }
];

export const studentCareerStages = [
  { id: "foundation", title: "Học viên nền tảng", status: "completed", description: "Hiểu nghề, dụng cụ, vệ sinh và kỹ thuật cơ bản.", requirements: ["Hoàn thành 4 module", "Điểm quiz ≥ 70"] },
  { id: "practice", title: "Học viên thực hành", status: "active", description: "Luyện kỹ thuật trên mẫu và xây bằng chứng năng lực.", requirements: ["3 bài makeup cô dâu", "2 bài tóc", "1 bài tư vấn"] },
  { id: "first-client", title: "Makeup Artist có khách đầu tiên", status: "locked", description: "Sẵn sàng tư vấn, thực hiện và chăm sóc khách hàng đầu tiên.", requirements: ["Portfolio 10 bài", "Đạt bài tình huống", "Hoàn thành bảng giá"] },
  { id: "professional", title: "Makeup Artist chuyên nghiệp", status: "locked", description: "Kỹ thuật ổn định, có thương hiệu và quy trình làm nghề.", requirements: ["50 giờ thực hành", "20 khách", "Hoàn thiện brand kit"] },
  { id: "leader", title: "Studio / Team Leader", status: "locked", description: "Biết tổ chức dịch vụ, đội nhóm và vận hành tài chính.", requirements: ["SOP dịch vụ", "Scorecard đội nhóm", "Kế hoạch 12 tháng"] }
];

export const localMentorResponses = [
  { match: ["học", "tiếp", "bài nào"], answer: "Bạn nên hoàn thiện bài 3.2 về nền cô dâu trước. Sau đó làm bài thực hành 3 góc ảnh để mở kỹ năng Makeup cô dâu cấp 2." },
  { match: ["nền", "lỗi", "mốc"], answer: "Dữ liệu học hiện cho thấy bạn cần ôn ba điểm: lượng kem nền, thời gian chờ giữa các lớp và cách khóa vùng chữ T. Hãy xem lại checklist của bài Nền trong trẻo." },
  { match: ["bài tập", "thiếu"], answer: "Bạn còn thiếu 2 bài makeup cô dâu và 1 bài tóc bới thấp. Bài gần deadline nhất là Nền cô dâu trong trẻo." },
  { match: ["khách", "đầu tiên"], answer: "Để sẵn sàng nhận khách đầu tiên, bạn cần hoàn thiện portfolio 10 bài, bảng giá ba gói và kịch bản tư vấn 5 câu hỏi." },
  { match: ["lịch", "hôm nay", "kế hoạch"], answer: "Kế hoạch 60 phút hôm nay: 12 phút flashcard, 18 phút xem bài 3.2, 25 phút thực hành một nửa khuôn mặt và 5 phút tự chấm theo rubric." }
];

export function getLocalMentorAnswer(input: string) {
  const normalized = input.toLowerCase();
  const found = localMentorResponses.find((item) => item.match.some((term) => normalized.includes(term)));
  return found?.answer ?? "Tôi đã ghi nhận câu hỏi. Theo tiến độ hiện tại, ưu tiên tốt nhất là hoàn thành nhiệm vụ hôm nay, sau đó xem lại Skill Map để chọn kỹ năng đang ở trạng thái ‘Cần luyện thêm’.";
}
