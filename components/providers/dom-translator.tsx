"use client";

import { useEffect } from "react";
import { useLocale } from "./locale-provider";

// Whole-app translation without touching every component: walk rendered text nodes + human-readable
// attributes and swap any exact dictionary match. In "en" mode the Vietnamese->English table is
// applied; in the app's default "vi" mode only a small English->Vietnamese table (stray captions)
// is applied. A MutationObserver keeps it applied through client navigation and re-renders. The
// shell/nav already translate via useLocale().t so they never flash. Because VI->EN replacements
// can't be reversed in place, switching back from "en" to "vi" reloads once for a clean reset.

const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);
const DONE = "data-i18n-locale";

type Dict = Record<string, string>;

function translate(root: ParentNode, dict: Dict) {
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || SKIP_TAGS.has(parent.tagName) || parent.isContentEditable) return NodeFilter.FILTER_REJECT;
      return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const texts: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);
  for (const t of texts) {
    const raw = t.nodeValue ?? "";
    const key = raw.trim();
    const hit = dict[key];
    if (hit && hit !== key) t.nodeValue = raw.replace(key, hit);
  }
  const els = (root instanceof Element ? [root, ...root.querySelectorAll("*")] : [...(root as Document).querySelectorAll("*")]) as Element[];
  for (const el of els) {
    for (const attr of ATTRS) {
      const val = el.getAttribute(attr);
      if (!val) continue;
      const key = val.trim();
      const hit = dict[key];
      if (hit && hit !== key) el.setAttribute(attr, hit);
    }
  }
}

export function DomTranslator() {
  const { locale } = useLocale();

  useEffect(() => {
    if (locale === "vi" && document.documentElement.getAttribute(DONE) === "en") {
      document.documentElement.removeAttribute(DONE);
      window.location.reload();
      return;
    }

    let observer: MutationObserver | null = null;
    let cancelled = false;

    void import("@/lib/i18n/dictionary").then((mod) => {
      if (cancelled) return;
      const dict = (locale === "en" ? mod.VI_EN : mod.EN_VI) as Dict;
      if (!dict || !Object.keys(dict).length) return;

      const opts: MutationObserverInit = { childList: true, subtree: true, characterData: true, attributeFilter: ATTRS };
      const run = (node: ParentNode) => {
        observer?.disconnect();
        try { translate(node, dict); } finally { observer?.observe(document.body, opts); }
      };

      run(document.body);
      document.documentElement.setAttribute(DONE, locale);
      const dt = dict[document.title.trim()];
      if (dt) document.title = dt;

      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "childList") {
            m.addedNodes.forEach((n) => {
              if (n.nodeType === 1) run(n as Element);
              else if (n.nodeType === 3) run(n.parentElement ?? document.body);
            });
          } else {
            run(m.target.nodeType === 1 ? (m.target as Element) : document.body);
          }
        }
      });
      observer.observe(document.body, opts);
    });

    return () => { cancelled = true; observer?.disconnect(); };
  }, [locale]);

  return null;
}
