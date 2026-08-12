import type { OutputDestination } from "./types";

// "Kết quả này sẽ được dùng ở đâu?" (docs/stage1-learning-os-v1 §Mission Workspace). A static map
// keyed by the real, live Stage 1 Mission titles (docs/stage1-learning-os-v1/01_PRODUCTION_AUDIT.md)
// — every destination named here is a real surface this same folder builds (Student Journey
// Passport at /student/passport, Skill Passport section, Credential Wallet), not a stub link. Admin
// picks per Mission in the real curriculum, not one invented per the source blueprint's different
// (unused) Mission list.
const OUTPUT_DESTINATIONS: Record<string, OutputDestination[]> = {
  "Xác định hướng nghề Makeup": [{ label: "Hồ sơ nghề Makeup", surface: "profile", destinationKey: "career" }],
  "Hoàn thành Career Map": [{ label: "Hồ sơ nghề Makeup", surface: "profile", destinationKey: "career" }],
  "Xác định mục tiêu 90 ngày": [{ label: "Nhật ký thực hành 90 ngày", surface: "journey", destinationKey: "daily_practice" }],
  "Setup hồ sơ nghề Makeup": [{ label: "Hồ sơ nghề Makeup", surface: "profile", destinationKey: "career" }],
  "Chuẩn bị da đúng": [{ label: "Skill Passport — Kỹ thuật nền", surface: "profile", destinationKey: "skill:skin" }],
  "Hoàn thiện lớp nền": [{ label: "Skill Passport — Kỹ thuật nền", surface: "profile", destinationKey: "skill:skin" }],
  "Màu sắc cơ bản": [{ label: "Skill Passport — Phân tích khuôn mặt", surface: "profile", destinationKey: "skill:face" }],
  "Tóc nền tảng": [{ label: "Skill Passport — Sóng và texture", surface: "profile", destinationKey: "skill:waves" }],
  "Before/After #1": [{ label: "Portfolio Evidence", surface: "profile", destinationKey: "evidence" }],
  "Before/After #2": [{ label: "Portfolio Evidence", surface: "profile", destinationKey: "evidence" }],
  "Before/After #3": [{ label: "Portfolio Evidence", surface: "profile", destinationKey: "evidence" }],
  "Hoàn thiện hồ sơ Stage 1": [
    { label: "Hồ sơ nghề Makeup", surface: "profile", destinationKey: "career" },
    { label: "Chứng nhận hoàn thành Stage 1", surface: "credential", destinationKey: "certificate" }
  ]
};

export function getMissionOutputDestinations(missionTitle: string): OutputDestination[] {
  return OUTPUT_DESTINATIONS[missionTitle] ?? [];
}
