// Client-side mirror of v5/32-.../resource-context-url.ts's buildMissionResourceHref — a Mission's
// "Kiến thức cần dùng" links must carry from=mission&missionId=...&returnTo=... so the Reader knows
// to show "← Quay lại Mission: ..." instead of the generic Library link (lib/curriculum/reader-
// context.ts's loadReaderMissionContext resolves and re-validates this server-side; the URL is only
// a hint, never trusted on its own).
export function buildMissionResourceHref(resourceType: string, resourceId: string, missionId: string): string {
  if (resourceType !== "document") return "/student/library";
  const params = new URLSearchParams({ type: resourceType, from: "mission", missionId, returnTo: `/student/missions/${missionId}` });
  return `/student/document/${encodeURIComponent(resourceId)}?${params.toString()}`;
}
