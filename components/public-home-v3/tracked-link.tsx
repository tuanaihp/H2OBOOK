"use client";
import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { AnalyticsEvent } from "@h2obook/analytics-core";
import { track } from "@/lib/analytics/client";

type Props = LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
  children: ReactNode;
  section: string;
  action: string;
  resourceId?: string;
  // Bound to the canonical analytics contract so this cannot drift from
  // packages/analytics-core; widening it means widening the stored enum too.
  resourceType?: AnalyticsEvent["resourceType"];
};

export function TrackedLink({
  children,
  section,
  action,
  resourceId,
  resourceType = "page",
  onClick,
  ...props
}: Props) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        track("cta_clicked", {
          resourceType,
          resourceId,
          properties: {
            section,
            action,
            href: String(props.href),
          },
        });
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}
