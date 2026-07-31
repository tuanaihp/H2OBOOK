"use client";
import { useEffect } from "react";
import { track } from "@/lib/analytics/client";

export function PublicHomeSectionObserver() {
  useEffect(() => {
    track("page_viewed", {
      resourceType: "page",
      resourceId: "public-home-v3",
      properties: { route: "/", version: "v3" },
    });

    const observed = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const section = entry.target.getAttribute("data-public-home-section");
          if (!section || observed.has(section)) continue;
          observed.add(section);
          track("page_viewed", {
            resourceType: "page",
            resourceId: `public-home:${section}`,
            properties: { section, route: "/", version: "v3" },
          });
        }
      },
      { threshold: 0.35 },
    );

    document.querySelectorAll<HTMLElement>("[data-public-home-section]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return null;
}
