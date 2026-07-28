"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app-store";
import { formatDate } from "@/lib/utils";
import { BookOpen, CircleDot, LockKeyhole, MessageSquareText, MousePointer2, UsersRound } from "lucide-react";

export default function CollaborationPage() {
  const store = useAppStore();
  const unresolved = store.reviewComments.filter((item) => !item.resolved);
  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">COLLABORATION HUB</span><h1>Cộng tác và phản hồi</h1><p>Theo dõi người đang làm việc, trang đang mở và bình luận gắn với từng sách.</p></div><div className="header-actions"><Badge tone="purple">Realtime-ready</Badge></div></div>
    <div className="collab-grid">
      <section className="section-card collab-sessions"><div className="section-head"><div><h2>Phiên làm việc</h2><p>Trạng thái cộng tác đang hoạt động.</p></div><UsersRound size={19}/></div><div className="section-body">{store.collaborationSessions.map((session) => { const book = store.books.find((item) => item.id === session.bookId); return <article key={session.id}><div className="collab-book-head"><span className="collab-cover" style={{ background: book?.cover }}/><div><strong>{book?.title ?? session.bookId}</strong><small>Cập nhật {formatDate(session.updatedAt)}</small></div><Link className="btn btn-secondary btn-sm" href={`/editor/${session.bookId}`}><BookOpen size={13}/>Mở Studio</Link></div><div className="presence-list">{session.activeUsers.map((user) => <div key={user.userId}><span className="presence-avatar" style={{ background: user.color }}>{user.initials}</span><span><strong>{user.name}</strong><small>{user.status === "online" ? `Đang ở ${user.pageId ?? "trang sách"}` : `Hoạt động ${formatDate(user.lastSeenAt)}`}</small></span><Badge tone={user.status === "online" ? "success" : "neutral"}>{user.status}</Badge></div>)}</div><footer><span><LockKeyhole size={13}/>{session.lockedPageIds.length} trang đang khóa</span><span><MousePointer2 size={13}/>{session.activeUsers.filter((user) => user.status === "online").length} người online</span></footer></article>; })}</div></section>
      <section className="section-card"><div className="section-head"><div><h2>Phản hồi cần xử lý</h2><p>Bình luận chưa được đánh dấu hoàn tất.</p></div><MessageSquareText size={19}/></div><div className="section-body collab-comments">{unresolved.map((comment) => { const book = store.books.find((item) => item.id === comment.bookId); return <article key={comment.id}><div><span className="comment-dot"><CircleDot size={14}/></span><span><strong>{comment.authorName}</strong><small>{book?.title ?? comment.bookId} · {formatDate(comment.createdAt)}</small></span></div><p>{comment.message}</p><div><Link href={`/editor/${comment.bookId}`} className="btn btn-secondary btn-sm">Mở vị trí</Link><button className="btn btn-primary btn-sm" onClick={() => store.resolveReviewComment(comment.id)}>Đã xử lý</button></div></article>; })}{!unresolved.length && <div className="empty-inline">Không còn phản hồi cần xử lý.</div>}</div></section>
    </div>
  </AppShell>;
}
