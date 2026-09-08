"use client";
import Link from "next/link";
import { useState } from "react";
import { Bell, CheckCheck, HelpCircle, X } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { NeuralHeaderSignal } from "@/components/global-neural";
import { LanguageSwitcher } from "@/components/providers/language-switcher";
import { useLocale } from "@/components/providers/locale-provider";
import { NavigationDialog } from "./navigation-dialog";
import { workspaceNavigationEntries } from "./sidebar";

export function Topbar() {
  const { t, locale } = useLocale();
  const l = (vi: string,en: string) => locale === "vi" ? vi : en;
  const [notificationsOpen,setNotificationsOpen] = useState(false);
  const books = useAppStore(state=>state.books);
  const notifications = useAppStore(state=>state.notifications);
  const ownerName = useAppStore(state=>state.workspace.ownerName);
  const markAllNotificationsRead = useAppStore(state=>state.markAllNotificationsRead);
  const markNotificationRead = useAppStore(state=>state.markNotificationRead);
  const unread = notifications.filter(notice=>!notice.read).length;
  const entries = workspaceNavigationEntries(t);
  const searchEntries = [...entries, ...books.map(book=>({ href: "/editor/"+book.id, label: book.title, group: l("Dự án sách", "Book projects") }))];
  return <header className="topbar">
    <NavigationDialog kind="menu" entries={entries}/>
    <NavigationDialog entries={searchEntries}/>
    <NeuralHeaderSignal compact/>
    <div className="top-actions"><LanguageSwitcher/>
      <Link className="icon-btn" aria-label={l("Trợ giúp và cài đặt","Help and settings")} href="/settings"><HelpCircle size={18}/></Link>
      <div className="notification-wrap"><button className="icon-btn" aria-label={l("Thông báo","Notifications")} aria-expanded={notificationsOpen} onClick={()=>setNotificationsOpen(!notificationsOpen)}><Bell size={18}/>{unread>0 && <span className="notification-dot">{unread}</span>}</button>
        {notificationsOpen && <div className="notification-popover"><header><div><strong>{l("Thông báo","Notifications")}</strong><span>{unread} {l("chưa đọc","unread")}</span></div><button onClick={markAllNotificationsRead}><CheckCheck size={14}/>{l("Đọc tất cả","Mark all read")}</button><button aria-label={l("Đóng","Close")} onClick={()=>setNotificationsOpen(false)}><X size={16}/></button></header><div>{!notifications.length && <p>{l("Chưa có thông báo mới.","No new notifications.")}</p>}{notifications.map(notice=><Link key={notice.id} href={notice.href} className={notice.read?"read":"unread"} onClick={()=>{markNotificationRead(notice.id);setNotificationsOpen(false);}}><span className={"notice-type notice-"+notice.type}/><span><strong>{notice.title}</strong><small>{notice.message}</small><time>{new Date(notice.createdAt).toLocaleDateString(locale==="vi"?"vi-VN":"en-US")}</time></span></Link>)}</div></div>}
      </div>
      <Link href="/account" className="user-pill"><div className="user-avatar">{ownerName.split(" ").map(word=>word[0]).slice(-2).join("")}</div><div className="user-meta"><strong>{ownerName}</strong><span>{t("Workspace Owner")}</span></div></Link>
    </div>
  </header>;
}
