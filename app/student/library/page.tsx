"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Bookmark, Clock3, LockKeyhole, Search, Sparkles } from "lucide-react";
import { useAppStore } from "@/store/app-store";

type LibraryResource = { id: string; resourceType: string; resourceId: string; title: string; summary: string; href: string; free: boolean };
type LibraryStage = { slug: string; title: string; indexLabel: string; durationLabel: string; unlocked: boolean; resources: LibraryResource[]; lockedCount: number };
type LibraryPayload = { mode: "production" | "unconfigured" | "demo"; stages: LibraryStage[] };

const TYPE_LABEL: Record<string, string> = {
  book: "Sách", course: "Khóa học", publication: "Ấn phẩm", template: "Mẫu",
  knowledge_space: "Knowledge Space", roadmap: "Lộ trình", link: "Tài liệu"
};

function resourceHref(resource: LibraryResource): string {
  if (resource.href) return resource.href;
  if (resource.resourceType === "course") return `/student/courses/${resource.resourceId}`;
  if (resource.resourceType === "knowledge_space") return `/student/spaces/${resource.resourceId}`;
  return `/reader/${resource.resourceId}`;
}

export default function StudentLibraryPage() {
  const store = useAppStore();
  const [live, setLive] = useState<LibraryPayload | null>(null);

  useEffect(() => {
    fetch("/api/student/library", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: LibraryPayload | null) => payload && setLive(payload))
      .catch(() => null);
  }, []);

  const head = <section className="h2o-student-page-head">
    <div><span>MY KNOWLEDGE LIBRARY</span><h1>Thư viện của tôi</h1><p>Sách, giáo trình và tài liệu được gắn với từng giai đoạn trong lộ trình của bạn.</p></div>
    <div className="h2o-student-page-search"><Search /><input placeholder="Tìm sách hoặc chủ đề..." /></div>
  </section>;

  // Real curriculum: one section per stage, showing unlocked material and free previews only.
  // Anything still locked is counted rather than listed — the student learns more exists without
  // seeing what it is.
  if (live?.mode === "production") {
    return <>{head}
      {live.stages.map((stage) => <section key={stage.slug} className="h2o-student-section">
        <header>
          <div>
            <span>{stage.indexLabel || "GIAI ĐOẠN"}{stage.durationLabel ? ` · ${stage.durationLabel}` : ""}</span>
            <h2>{stage.title}</h2>
          </div>
          {!stage.unlocked && <Link href="/academy/membership"><LockKeyhole />Mở khóa giai đoạn</Link>}
        </header>

        {stage.resources.length === 0
          ? <p style={{ color: "#718092" }}>{stage.lockedCount > 0 ? `${stage.lockedCount} tài liệu sẽ mở khi bạn vào giai đoạn này.` : "Giai đoạn này chưa có tài liệu."}</p>
          : <div className="h2o-student-library-grid">{stage.resources.map((resource, index) => <article key={resource.id}>
              <Link href={resourceHref(resource)} className="h2o-student-library-cover" style={{ background: store.books[index % Math.max(1, store.books.length)]?.cover }}>
                <span>{TYPE_LABEL[resource.resourceType] ?? resource.resourceType}</span>
                <small>{String(index + 1).padStart(2, "0")}</small>
                <h3>{resource.title || resource.resourceId}</h3>
              </Link>
              <div>
                <strong>{resource.title || resource.resourceId}</strong>
                <p>{resource.summary || (resource.free ? "Nội dung mở thử miễn phí." : "Tài liệu thuộc giai đoạn này.")}</p>
                <span>{resource.free ? <><Sparkles />Miễn phí</> : <><BookOpen />Đã mở khóa</>}</span>
                <footer><Link href={resourceHref(resource)}><BookOpen />Mở tài liệu</Link><button><Bookmark /></button></footer>
              </div>
            </article>)}</div>}

        {stage.resources.length > 0 && stage.lockedCount > 0 && <p style={{ color: "#718092", marginTop: 10 }}>Còn {stage.lockedCount} tài liệu sẽ mở khi bạn vào giai đoạn này.</p>}
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
  return <>{head}
    <div className="h2o-library-highlight"><Sparkles /><div><span>CHẾ ĐỘ DEMO</span><h2>Đây là sách mẫu, chưa phải thư viện thật của bạn.</h2><p>Khi tài khoản được nối với học viện, thư viện sẽ hiện đúng tài liệu theo giai đoạn.</p></div></div>
    <section className="h2o-student-section">
      <header><div><span>SAMPLE LIBRARY</span><h2>Sách mẫu</h2></div></header>
      <div className="h2o-student-library-grid">{store.books.filter((book) => !book.archivedAt).map((book, index) => <article key={book.id}>
        <Link href={`/reader/${book.id}`} className="h2o-student-library-cover" style={{ background: book.cover }}><span>{book.category}</span><small>{String(index + 1).padStart(2, "0")}</small><h3>{book.title}</h3></Link>
        <div>
          <strong>{book.title}</strong><p>{book.subtitle}</p>
          <span><Clock3 />{book.readingMinutes} phút <i /> {book.pages.length} trang</span>
          <footer><Link href={`/reader/${book.id}`}><BookOpen />Mở sách</Link><button><Bookmark /></button></footer>
        </div>
      </article>)}</div>
    </section>
  </>;
}
