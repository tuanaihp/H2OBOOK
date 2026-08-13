import type { OutputDestination } from "./types";

// "Kết quả này sẽ được dùng ở đâu?" (docs/stage1-learning-os-v1 §Mission Workspace). A static map
// over real destinations this same folder builds (Student Journey Passport at /student/profile,
// Skill Passport section, Credential Wallet), not a stub link.
//
// Keyed by root_mission_id (migration 0054), NOT title: the 2026-08-13 Stage 1 Blueprint
// Transformation renamed several of these Missions on the new published version (Career Map, 90-day
// goal, hồ sơ nghề, hoàn thiện hồ sơ Stage 1) — a title-keyed map silently returned [] for every
// renamed Mission the moment that version went live, which is the bug this rewrite fixes.
// root_mission_id is the one identifier guaranteed to survive a rename/re-clone across versions.
const OUTPUT_DESTINATIONS: Record<string, OutputDestination[]> = {
  "e6956113-3a08-4d93-8a74-b574a10389c4": [{ label: "Hồ sơ nghề Makeup", surface: "profile", destinationKey: "career" }], // Xác định hướng nghề Makeup
  "cbfbcc11-237a-46e5-b498-a8222974a634": [{ label: "Hồ sơ nghề Makeup", surface: "profile", destinationKey: "career" }], // Hoàn thành (Makeup) Career Map
  "6c1bcff8-0c54-4ea7-960f-b9396189a0ea": [{ label: "Nhật ký thực hành 90 ngày", surface: "journey", destinationKey: "daily_practice" }], // Xác định mục tiêu 90 ngày / Lộ trình Makeup 90 ngày của tôi
  "2a2d50d8-5a41-436b-b80a-70bb98e20f79": [{ label: "Hồ sơ nghề Makeup", surface: "profile", destinationKey: "career" }], // Setup hồ sơ nghề Makeup / Hồ sơ nghề Makeup
  "586a5f5f-baf6-4412-8e42-2291c58c73be": [{ label: "Skill Passport — Kỹ thuật nền", surface: "profile", destinationKey: "skill:skin" }], // Chuẩn bị da đúng
  "2093b7a6-882f-4082-bcbe-fd5fb3346d81": [{ label: "Skill Passport — Kỹ thuật nền", surface: "profile", destinationKey: "skill:skin" }], // Hoàn thiện lớp nền
  "7e9b353c-b0bd-4067-a054-27444ee6af09": [{ label: "Skill Passport — Phân tích khuôn mặt", surface: "profile", destinationKey: "skill:face" }], // Màu sắc cơ bản
  "b31064ca-a918-4787-858d-e0edf479d99d": [{ label: "Skill Passport — Sóng và texture", surface: "profile", destinationKey: "skill:waves" }], // Tóc nền tảng
  "bca82ea7-bf9e-40df-9112-ca3ff52b2882": [{ label: "Portfolio Evidence", surface: "profile", destinationKey: "evidence" }], // Before/After #1
  "cb0751f4-7300-495e-8d2a-5f61a63d00c9": [{ label: "Portfolio Evidence", surface: "profile", destinationKey: "evidence" }], // Before/After #2
  "1868b235-5f55-47e6-b9c5-117e8ee4a178": [{ label: "Portfolio Evidence", surface: "profile", destinationKey: "evidence" }], // Before/After #3
  "16ee3dcf-2ee9-4c7f-92ef-1ef4f2ce6f8c": [ // Hoàn thiện hồ sơ Stage 1 / Đánh giá cuối khóa
    { label: "Hồ sơ nghề Makeup", surface: "profile", destinationKey: "career" },
    { label: "Chứng nhận hoàn thành Stage 1", surface: "credential", destinationKey: "certificate" }
  ]
};

export function getMissionOutputDestinations(missionRootId: string): OutputDestination[] {
  return OUTPUT_DESTINATIONS[missionRootId] ?? [];
}
