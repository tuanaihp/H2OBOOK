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
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  images: { remotePatterns: [
    { protocol: "https", hostname: "images.unsplash.com" },
    { protocol: "https", hostname: "plus.unsplash.com" },
    { protocol: "https", hostname: "*.r2.dev" }
  ]},
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
  async headers() { return [{ source: "/:path*", headers: securityHeaders }]; }
};
export default nextConfig;
