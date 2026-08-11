import { notFound } from "next/navigation";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { loadCurriculumDocumentForStudent, type DocumentStructuredContent } from "@/lib/curriculum/document-reader";
import { getResourceProgress, loadReaderMissionContext, safeReturnTo } from "@/lib/curriculum/reader-context";
import { ReaderTools } from "@/components/student/reader/reader-tools";

export const dynamic = "force-dynamic";

const DOC_TYPE_LABEL: Record<string, string> = {
  article: "Bài học", checklist: "Checklist", rubric: "Bảng tiêu chí", practice: "Bài thực hành",
  worksheet: "Phiếu bài tập", template: "Mẫu", assessment: "Bài đánh giá", case_study: "Case study",
  sop: "Quy trình chuẩn", script: "Kịch bản", tool_guide: "Hướng dẫn công cụ", playbook: "Playbook",
  assignment: "Bài tập"
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section style={{ marginTop: 26 }}>
    <h2 style={{ fontSize: 15, margin: "0 0 10px", color: "#1f2b3a" }}>{title}</h2>
    {children}
  </section>;
}

function Bullets({ items, ordered }: { items: string[]; ordered?: boolean }) {
  const style = { margin: 0, paddingLeft: 20, display: "grid", gap: 6, fontSize: 13, lineHeight: 1.6, color: "#3d4a5a" } as const;
  return ordered
    ? <ol style={style}>{items.map((item, index) => <li key={index}>{item}</li>)}</ol>
    : <ul style={style}>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
}

function Prose({ text }: { text: string }) {
  return <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "#3d4a5a" }}>{text}</p>;
}

function StructuredBody({ content }: { content: DocumentStructuredContent }) {
  return <>
    {content.objectives?.length ? <Section title="Kết quả đầu ra"><Bullets items={content.objectives} /></Section> : null}
    {content.principles?.length ? <Section title="Kiến thức cốt lõi"><Bullets items={content.principles} /></Section> : null}
    {content.workflow?.length ? <Section title="Quy trình áp dụng thực chiến"><Bullets items={content.workflow} ordered /></Section> : null}
    {content.case ? <Section title="Case áp dụng ngành Makeup"><Prose text={content.case} /></Section> : null}
    {content.studentAction ? <Section title="Bài thực hành ngay"><Prose text={content.studentAction} /></Section> : null}
    {content.evidence?.length ? <Section title="Bằng chứng phải nộp / lưu"><Bullets items={content.evidence} /></Section> : null}
    {content.kpis?.length ? <Section title="KPI / tiêu chuẩn đạt"><Bullets items={content.kpis} /></Section> : null}
    {content.mistakes?.length ? <Section title="Lỗi thường gặp"><Bullets items={content.mistakes} /></Section> : null}
    {content.coach?.length ? <Section title="Câu hỏi H2O Coaching"><Bullets items={content.coach} /></Section> : null}
  </>;
}

type SearchParams = { type?: string; from?: string; missionId?: string; returnTo?: string };

export default async function StudentCurriculumDocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const { from, missionId, returnTo } = await searchParams;
  const user = await requireCurrentUser();
  const organizationId = await configuredAcademyOrganizationId();
  if (!organizationId || user.demo) notFound();

  const result = await loadCurriculumDocumentForStudent(user.id, organizationId, id);
  if (result.status === "not_found") notFound();

  // Mission context (v5/32-.../CLAUDE_H2OBOOK_LEARN_OUTCOME_OS_V4.md §4/§1): only trusted when the
  // Mission actually resolves through the same access-checked read model the Workspace uses — a
  // stale or forged missionId simply falls back to the plain Library-return behavior below.
  const missionContext = from === "mission" && missionId ? await loadReaderMissionContext(user.id, organizationId, missionId, returnTo ?? null) : null;
  const backHref = missionContext ? missionContext.returnTo : safeReturnTo(returnTo, "/student/library");
  const backLabel = missionContext ? `← Quay lại Mission: ${missionContext.missionTitle}` : "← Về thư viện của tôi";

  if (result.status === "locked") {
    return <section className="h2o-student-section" style={{ maxWidth: 720 }}>
      <div style={{ display: "grid", gap: 10, justifyItems: "start" }}>
        <LockKeyhole size={22} color="#94a3b8" />
        <h1 style={{ margin: 0, fontSize: 19 }}>Tài liệu này chưa mở</h1>
        <p style={{ margin: 0, color: "#718092", fontSize: 13, lineHeight: 1.7 }}>
          Tài liệu thuộc giai đoạn <strong>{result.stageTitle}</strong>. Bạn sẽ đọc được khi giai đoạn này được mở cho tài khoản của bạn.
        </p>
        <Link href={backHref} style={{ fontSize: 13 }}>{backLabel}</Link>
      </div>
    </section>;
  }

  const { document } = result;
  const hasStructured = document.contentVersion >= 2 && Object.keys(document.structured).length > 0;
  const progress = await getResourceProgress(organizationId, user.id, "document", id);

  return <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 20, alignItems: "start" }} className="h2o-mission-workspace-grid">
    <article className="h2o-student-section" style={{ maxWidth: 760 }}>
      <Link href={backHref} className="h2o-sr-back">{backLabel}</Link>
      <header style={{ display: "grid", gap: 8, paddingBottom: 16, borderBottom: "1px solid #e6eaef", marginTop: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, color: "#6b7a89" }}>
          <span>{document.stageIndexLabel ? `GIAI ĐOẠN ${document.stageIndexLabel}` : "GIAI ĐOẠN"} · {document.stageTitle}</span>
          <span>·</span>
          <span>{DOC_TYPE_LABEL[document.docType] ?? document.docType}</span>
          {document.requirementType === "required" && <><span>·</span><span style={{ color: "#b45309" }}>Bắt buộc</span></>}
          {document.structured.estimatedMinutes ? <><span>·</span><span>{document.structured.estimatedMinutes} phút</span></> : null}
        </div>
        <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.35 }}>{document.title}</h1>
        {document.summary && <p style={{ margin: 0, color: "#5b6b7c", fontSize: 13, lineHeight: 1.7 }}>{document.summary}</p>}
        {missionContext && <p style={{ margin: 0, fontSize: 12, color: "#8d1d50" }}>Đang đọc để hoàn thành: {missionContext.expectedResult}</p>}
      </header>

      {hasStructured
        ? <StructuredBody content={document.structured} />
        // Documents still at content_version 1 have only the seed's Markdown skeleton and no
        // structured fields to lay out. Rendered as preformatted text rather than through a Markdown
        // parser: this repo has no Markdown dependency, and inventing one here would mean either a new
        // package or hand-rolled HTML injection for content that is a placeholder anyway.
        : <pre style={{ marginTop: 22, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.7, color: "#3d4a5a" }}>{document.bodyMarkdown}</pre>}

      {document.structured.teacherNote && <Section title="Ghi chú cho giảng viên">
        <div style={{ padding: 12, borderRadius: 10, background: "#f7f9fb", border: "1px solid #e6eaef" }}>
          <Prose text={document.structured.teacherNote} />
        </div>
      </Section>}

      <footer style={{ marginTop: 30, paddingTop: 16, borderTop: "1px solid #e6eaef" }}>
        <Link href={backHref} style={{ fontSize: 13 }}>{backLabel}</Link>
      </footer>
    </article>

    <div>
      <ReaderTools resourceType="document" resourceId={id} initialBookmarked={progress?.bookmarked ?? false} missionContext={missionContext} />
    </div>
  </div>;
}
