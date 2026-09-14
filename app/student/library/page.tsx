"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Clock3, LockKeyhole, Search, Sparkles } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { normalizeNavigationText } from "@/components/layout/navigation-dialog";

type LibraryResource = { id: string; resourceType: string; resourceId: string; title: string; summary: string; href: string; free: boolean };
type LibraryStage = { slug: string; title: string; indexLabel: string; position: number; durationLabel: string; unlocked: boolean; resources: LibraryResource[]; lockedCount: number };
type LibraryPayload = { mode: "production" | "unconfigured" | "demo"; stages: LibraryStage[] };

const TYPE_LABEL: Record<string, string> = {
  book: "Sách", course: "Khóa học", publication: "Ấn phẩm", template: "Mẫu",
  knowledge_space: "Knowledge Space", roadmap: "Lộ trình", link: "Tài liệu", document: "Tài liệu"
};

// Real resources get a cover by type. They used to borrow a random demo book's cover
// (store.books[index % len]), so a real document could wear the sample makeup curriculum's artwork.
const TYPE_COVER: Record<string, string> = {
  book: "linear-gradient(135deg,#6f1d46,#b45f83)",
  publication: "linear-gradient(135deg,#7a3b1f,#c27a4e)",
  course: "linear-gradient(135deg,#17496a,#3f8fb5)",
  knowledge_space: "linear-gradient(135deg,#43337f,#8a74d6)",
  document: "linear-gradient(135deg,#255a4c,#5fa38c)",
  template: "linear-gradient(135deg,#5b2a6e,#a86bbf)",
  roadmap: "linear-gradient(135deg,#1f4f5a,#4fa0ad)",
  link: "linear-gradient(135deg,#3a4556,#6b7a90)"
};
const DEFAULT_COVER = "linear-gradient(135deg,#3a4556,#6b7a90)";

function resourceHref(resource: LibraryResource): string {
  if (resource.href) return resource.href;
  if (resource.resourceType === "course") return `/student/courses/${resource.resourceId}`;
  if (resource.resourceType === "knowledge_space") return `/student/spaces/${resource.resourceId}`;
  // curriculum_documents rows live in their own table, so the book/publication reader cannot resolve
  // them — without this branch they fell through to /reader/[slug] and looked up the id in the wrong
  // table.
  if (resource.resourceType === "document") return `/student/document/${resource.resourceId}`;
  return `/reader/${resource.resourceId}`;
}

export default function StudentLibraryPage() {
  const store = useAppStore();
  const [live, setLive] = useState<LibraryPayload | null>(null);
  const [query, setQuery] = useState("");
  const needle = normalizeNavigationText(query.trim());
  const matches = (...values: (string | undefined)[]) => !needle || normalizeNavigationText(values.filter(Boolean).join(" ")).includes(needle);

  useEffect(() => {
    fetch("/api/student/library", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: LibraryPayload | null) => payload && setLive(payload))
      .catch(() => null);
  }, []);

  const stages = useMemo(() => (live?.stages ?? []).map((stage) => ({
    ...stage,
    resources: stage.resources.filter((resource) => matches(resource.title, resource.summary, resource.resourceId, TYPE_LABEL[resource.resourceType]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [live, needle]);

  const head = <section className="h2o-student-page-head">
    <div><span>MY KNOWLEDGE LIBRARY</span><h1>Thư viện của tôi</h1><p>Sách, giáo trình và tài liệu được gắn với từng giai đoạn trong lộ trình của bạn.</p></div>
    <div className="h2o-student-page-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm sách hoặc chủ đề..." aria-label="Tìm trong thư viện" /></div>
  </section>;

  // Real curriculum: one section per stage, showing unlocked material and free previews only.
  // Anything still locked is counted rather than listed — the student learns more exists without
  // seeing what it is.
  if (live?.mode === "production") {
    const visibleStages = needle ? stages.filter((stage) => stage.resources.length > 0) : stages;
    return <>{head}
      {needle && visibleStages.length === 0 && <section className="h2o-student-section"><p style={{ color: "#718092" }}>Không tìm thấy tài liệu khớp “{query.trim()}”.</p></section>}
      {visibleStages.map((stage) => <section key={stage.slug} className="h2o-student-section">
        <header>
          <div>
            <span>{`GIAI ĐOẠN ${String(stage.position).padStart(2, "0")}`}{stage.durationLabel ? ` · ${stage.durationLabel}` : ""}</span>
            <h2>{stage.title}</h2>
          </div>
          {!stage.unlocked && <Link href="/academy/membership"><LockKeyhole />Mở khóa giai đoạn</Link>}
        </header>

        {stage.resources.length === 0
          ? <p style={{ color: "#718092" }}>{stage.lockedCount > 0 ? `${stage.lockedCount} tài liệu sẽ mở khi bạn vào giai đoạn này.` : "Giai đoạn này chưa có tài liệu."}</p>
          : <div className="h2o-student-library-grid">{stage.resources.map((resource, index) => <article key={resource.id}>
              <Link href={resourceHref(resource)} className="h2o-student-library-cover" style={{ background: TYPE_COVER[resource.resourceType] ?? DEFAULT_COVER }}>
                <span>{TYPE_LABEL[resource.resourceType] ?? resource.resourceType}</span>
                <small>{String(index + 1).padStart(2, "0")}</small>
                <h3>{resource.title || resource.resourceId}</h3>
              </Link>
              <div>
                <strong>{resource.title || resource.resourceId}</strong>
                <p>{resource.summary || (resource.free ? "Nội dung mở thử miễn phí." : "Tài liệu thuộc giai đoạn này.")}</p>
                <span>{resource.free ? <><Sparkles />Miễn phí</> : <><BookOpen />Đã mở khóa</>}</span>
                <footer><Link href={resourceHref(resource)}><BookOpen />Mở tài liệu</Link></footer>
              </div>
            </article>)}</div>}

        {!needle && stage.resources.length > 0 && stage.lockedCount > 0 && <p style={{ color: "#718092", marginTop: 10 }}>Còn {stage.lockedCount} tài liệu sẽ mở khi bạn vào giai đoạn này.</p>}
      </section>)}
    </>;
  }

  if (live?.mode === "unconfigured") {
    return <>{head}
      <section className="h2o-student-section">
        <p style={{ color: "#718092" }}>Học viện chưa gắn tài liệu cho các giai đoạn. Khi quản trị viên thiết lập xong trong Academy Admin → Giai đoạn &amp; tài liệu, thư viện của bạn sẽ hiện đúng tài liệu theo giai đoạn đang học.</p>
      </section>
    </>;
  }

  // Demo/offline shelf, now labelled as such. The old percentage bars are gone with this rewrite:
  // they came from `34 + index * 18`, which is why the fifth card could read 106%.
  const sampleBooks = store.books.filter((book) => !book.archivedAt && matches(book.title, book.subtitle, book.category));
  return <>{head}
    <div className="h2o-library-highlight"><Sparkles /><div><span>CHẾ ĐỘ DEMO</span><h2>Đây là sách mẫu, chưa phải thư viện thật của bạn.</h2><p>Khi tài khoản được nối với học viện, thư viện sẽ hiện đúng tài liệu theo giai đoạn.</p></div></div>
    <section className="h2o-student-section">
      <header><div><span>SAMPLE LIBRARY</span><h2>Sách mẫu</h2></div></header>
      {sampleBooks.length === 0 && <p style={{ color: "#718092" }}>Không tìm thấy sách khớp “{query.trim()}”.</p>}
      <div className="h2o-student-library-grid">{sampleBooks.map((book, index) => <article key={book.id}>
        <Link href={`/reader/${book.id}`} className="h2o-student-library-cover" style={{ background: book.cover }}><span>{book.category}</span><small>{String(index + 1).padStart(2, "0")}</small><h3>{book.title}</h3></Link>
        <div>
          <strong>{book.title}</strong><p>{book.subtitle}</p>
          <span><Clock3 />{book.readingMinutes} phút <i /> {book.pages.length} trang</span>
          <footer><Link href={`/reader/${book.id}`}><BookOpen />Mở sách</Link></footer>
        </div>
      </article>)}</div>
    </section>
  </>;
}
