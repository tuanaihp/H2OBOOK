import { Be_Vietnam_Pro, Literata } from "next/font/google";

// The single place either family is instantiated. next/font/google downloads and self-hosts both
// at build time, so there is no runtime request to fonts.googleapis.com / fonts.gstatic.com and no
// <link> or @import anywhere in the app. Never call these loaders again in a page or component —
// a second call ships a second copy of the same font.
//
// Audit note that shaped this file: before it existed, the app asked for "Inter" in CSS but never
// loaded Inter from anywhere, so every UI string was silently rendering in whatever sans-serif the
// visitor's OS defaults to. Georgia did work, because it is installed system-wide. So this change
// replaces one real font (Georgia -> Literata) and one font that was only ever a name in a
// stylesheet (Inter -> Be Vietnam Pro).

export const fontBody = Be_Vietnam_Pro({
  variable: "--font-body",
  display: "swap",
  subsets: ["latin", "vietnamese"],
  // Be Vietnam Pro is not a variable font, so each weight is a separate file and only the ones the
  // design actually uses are listed. Browser synthesis covers intermediate weights while keeping
  // the first page load to three body-font files instead of six.
  weight: ["400", "600", "800"],
  fallback: ["Inter", "system-ui", "Arial", "sans-serif"]
});

export const fontHeading = Literata({
  variable: "--font-heading",
  display: "swap",
  subsets: ["latin", "vietnamese"],
  // Literata is variable, so no weight list — declaring one would download static instances and
  // throw away the range the editorial headings interpolate across.
  fallback: ["Georgia", "Times New Roman", "serif"]
});
