"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, ClipboardList, Map, Sparkles, UserRound, X } from "lucide-react";
import { useStudentData } from "@/components/student/student-data";
import { useLocale } from "@/components/providers/locale-provider";
import styles from "@/components/ui/experience.module.css";

/**
 * First-run checklist for a brand-new student account (audit U1): without it a fresh account
 * lands on a dashboard that only says "chưa có gì". Shown while the account has no completed
 * lesson; a dismissed card stays dismissed per account via localStorage. Items point at real
 * surfaces — nothing here fabricates progress.
 */
export function OnboardingChecklist() {
  const { summary, live, loading } = useStudentData();
  const { locale } = useLocale();
  const l = (vi: string, en: string) => (locale === "vi" ? vi : en);
  const email = summary?.user.email ?? "anonymous";
  const dismissKey = `h2obook-onboarding-dismissed:${email}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(dismissKey) === "1"); } catch { setDismissed(false); }
  }, [dismissKey]);

  const steps = useMemo(() => {
    if (!summary || summary.mode !== "production") return [];
    const hasTasks = summary.todayTasks.length > 0;
    return [
      {
        key: "journey",
        icon: Map,
        title: l("Xem hành trình học của bạn", "View your learning journey"),
        description: l("Bản đồ giai đoạn và nhiệm vụ đầu tiên đã được giảng viên chuẩn bị sẵn.", "Your stage map and first missions are already prepared."),
        href: "/student/courses",
        done: (summary.unlockedStageIds?.length ?? 0) > 0
      },
      {
        key: "library",
        icon: BookOpen,
        title: l("Mở tài liệu đầu tiên trong thư viện", "Open your first library resource"),
        description: l("Sách, tài liệu và video của giai đoạn đang mở nằm ở đây.", "Books, documents and videos for your unlocked stage live here."),
        href: "/student/library",
        done: false
      },
      {
        key: "profile",
        icon: UserRound,
        title: l("Hoàn thiện hồ sơ học viên", "Complete your student profile"),
        description: l("Tên, ảnh và số điện thoại giúp giảng viên nhận diện và cấp chứng chỉ đúng.", "Name, photo and phone help instructors recognize you and issue certificates correctly."),
        href: "/student/profile",
        done: Boolean(summary.user.name?.trim())
      },
      {
        key: "task",
        icon: ClipboardList,
        title: l("Làm nhiệm vụ đầu tiên", "Complete your first task"),
        description: hasTasks ? summary.todayTasks[0].title : l("Nhiệm vụ sẽ xuất hiện khi giảng viên mở nội dung giai đoạn.", "Tasks appear once your instructor publishes stage content."),
        href: hasTasks ? summary.todayTasks[0].href : "/student/learn",
        done: summary.completedLessons > 0
      },
      {
        key: "study",
        icon: Sparkles,
        title: l("Ôn thử bộ flashcard", "Try a flashcard review"),
        description: l("Lịch ôn thông minh chạy hoàn toàn local — không cần AI.", "Smart review runs fully local — no AI required."),
        href: "/student/study",
        done: false
      }
    ];
  }, [summary, locale]); // eslint-disable-line react-hooks/exhaustive-deps -- l is locale-derived

  if (!live || loading || dismissed || !summary || summary.mode !== "production") return null;
  if (summary.completedLessons > 0) return null;
  const doneCount = steps.filter((step) => step.done).length;

  const dismiss = () => {
    try { localStorage.setItem(dismissKey, "1"); } catch { /* private mode */ }
    setDismissed(true);
  };

  return (
    <section className={styles.panel} aria-label={l("Bắt đầu với H2OBOOK", "Get started with H2OBOOK")}>
      <header>
        <div>
          <h2>{l("Bắt đầu với H2OBOOK", "Get started with H2OBOOK")}</h2>
          <p>{l(`${doneCount}/${steps.length} bước đầu tiên — tài khoản mới nên đi theo thứ tự này.`, `${doneCount}/${steps.length} first steps — new accounts work best in this order.`)}</p>
        </div>
        <button aria-label={l("Ẩn hướng dẫn bắt đầu", "Dismiss getting started")} onClick={dismiss}><X size={15}/></button>
      </header>
      <div className={styles.list}>
        {steps.map((step) => {
          const StepIcon = step.icon;
          return (
            <Link className={styles.item} key={step.key} href={step.href}>
              {step.done ? <CheckCircle2 size={20} aria-hidden="true"/> : <StepIcon size={20} aria-hidden="true"/>}
              <div>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </div>
              {!step.done && <ArrowRight size={17}/>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
