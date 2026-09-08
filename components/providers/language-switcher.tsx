"use client";
import { Languages } from "lucide-react";
import { useLocale } from "./locale-provider";
export function LanguageSwitcher() { const { locale, toggleLocale } = useLocale(); return <button type="button" className="language-switcher" onClick={toggleLocale} aria-label={locale === "vi" ? "Switch to English" : "Chuyển sang tiếng Việt"} title={locale === "vi" ? "Switch to English" : "Chuyển sang tiếng Việt"}><Languages size={15}/><span>{locale === "vi" ? "VI" : "EN"}</span></button>; }
