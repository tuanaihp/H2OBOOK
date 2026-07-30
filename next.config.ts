import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }
];

const nextConfig: NextConfig = {
  // "standalone" is only for self-hosted Docker (see Dockerfile.production).
  // Vercel has its own build output format and explicitly recommends against
  // setting this, since it can break routing/edge-function bundling there.
  // pnpm's standalone trace uses symlinks that require elevated privileges on
  // Windows. Docker/Linux keeps the deployable standalone artifact; local
  // Windows and Vercel use Next's normal output.
  ...(process.env.VERCEL || process.platform === "win32" ? {} : { output: "standalone" as const }),
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  images: { remotePatterns: [
    { protocol: "https", hostname: "images.unsplash.com" },
    { protocol: "https", hostname: "plus.unsplash.com" },
    { protocol: "https", hostname: "*.r2.dev" }
  ]},
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false, "@valkey/valkey-glide": false };
    return config;
  },
  async headers() { return [{ source: "/:path*", headers: securityHeaders }]; }
};
export default nextConfig;
