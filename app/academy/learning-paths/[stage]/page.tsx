import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, CheckCircle2, LockKeyhole, Sparkles } from "lucide-react";
import { PublicShell } from "@/components/marketing/public-shell";
import { loadPublicStage } from "@/lib/career-stages/public";
import styles from "./stage.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ stage: string }> }): Promise<Metadata> {
  const { stage: slug } = await params;
  const stage = await loadPublicStage(slug);
  if (!stage) return { title: "Giai đoạn không tồn tại" };
  return {
    title: `${stage.title} | Lộ trình nghề Makeup`,
    description: stage.description || `Nội dung phù hợp cho giai đoạn ${stage.title}.`,
    openGraph: { title: stage.title, description: stage.description }
  };
}

// The destination "Xem nội dung phù hợp" should have had all along. The button used to point at
// /academy/learning-paths?stage=<id> — the page it already sat on, with a query string nothing
// read — so clicking it changed the URL and nothing else.
export default async function LearningPathStagePage({ params }: { params: Promise<{ stage: string }> }) {
  const { stage: slug } = await params;
  const stage = await loadPublicStage(slug);
  if (!stage) notFound();

  return <PublicShell>
    <section className="h2o-public-subhero path">
      <div className="h2o-public-container">
        <span>{stage.indexLabel ? `GIAI ĐOẠN ${stage.indexLabel}` : "LỘ TRÌNH NGHỀ"}{stage.durationLabel ? ` · ${stage.durationLabel}` : ""}</span>
        <h1>{stage.title}</h1>
        {stage.description && <p>{stage.description}</p>}
      </div>
    </section>

    <section className="h2o-public-section">
      <div className="h2o-public-container">
        {stage.skills.length > 0 && <ul className={styles.skills}>
          {stage.skills.map((skill) => <li key={skill}><CheckCircle2 aria-hidden="true" />{skill}</li>)}
        </ul>}

        <h2 className={styles.blockTitle}>Học thử miễn phí ở giai đoạn này</h2>
        {stage.freeResources.length > 0
          ? <div className={styles.resourceGrid}>
              {stage.freeResources.map((resource) => <Link key={resource.id} href={resource.href} className={styles.resourceCard}>
                <span className={styles.freeTag}><Sparkles aria-hidden="true" />Miễn phí</span>
                <strong>{resource.title}</strong>
                <p>{resource.summary || "Mở xem ngay, không cần tài khoản."}</p>
                <em>Mở tài liệu <ArrowRight aria-hidden="true" /></em>
              </Link>)}
            </div>
          : <p className={styles.emptyNote}>
              {stage.configured
                ? "Giai đoạn này chưa có tài liệu mở thử. Đăng ký tài khoản để xem toàn bộ nội dung khi được mở khóa."
                : "Học viện chưa gắn tài liệu cho giai đoạn này. Quản trị viên có thể thiết lập trong Academy Admin → Giai đoạn & tài liệu."}
            </p>}

        {stage.lockedCount > 0 && <p className={styles.lockedNote}>
          <LockKeyhole aria-hidden="true" />
          Còn <strong>{stage.lockedCount}</strong> tài liệu thuộc giai đoạn này sẽ mở khi bạn đăng ký và vào học.
        </p>}
      </div>
    </section>

    {/* Sticky conversion bar: the free material above is the reason to trust it, this is the ask. */}
    <div className={styles.stickyCta}>
      <div className="h2o-public-container">
        <div>
          <strong>Bắt đầu giai đoạn “{stage.title}”</strong>
          <small>Tạo tài khoản miễn phí để lưu tiến độ và mở khóa nội dung theo lộ trình.</small>
        </div>
        <div className={styles.stickyActions}>
          <Link href="/academy/learning-paths" className={styles.stickySecondary}>Xem toàn bộ lộ trình</Link>
          <Link href="/signup" className={styles.stickyPrimary}><BookOpen aria-hidden="true" />Đăng ký học <ArrowRight aria-hidden="true" /></Link>
        </div>
      </div>
    </div>
  </PublicShell>;
}
