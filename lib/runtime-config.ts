export type RuntimeCapability = {
  key: string;
  label: string;
  configured: boolean;
  required: boolean;
  description: string;
};

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isR2Configured() {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
}

export function isQueueConfigured() {
  return Boolean(process.env.REDIS_URL);
}

export function isPaymentConfigured() {
  return Boolean(process.env.PAYMENT_PROVIDER && process.env.PAYMENT_PROVIDER !== "manual" && process.env.PAYMENT_WEBHOOK_SECRET);
}

export function isFileScannerConfigured() {
  return Boolean(process.env.FILE_SCAN_URL);
}

export function isEmailConfigured() {
  return Boolean(process.env.EMAIL_PROVIDER && (process.env.EMAIL_API_KEY || process.env.EMAIL_WEBHOOK_URL));
}

export function isAcademyCommerceEnabled() {
  return process.env.ACADEMY_COMMERCE_ENABLED !== "false";
}

export function getAppMode() {
  if (process.env.NEXT_PUBLIC_APP_MODE === "production" && isSupabaseConfigured()) return "production" as const;
  return "demo" as const;
}

export function isUnifiedInputEnabled() {
  return process.env.NEXT_PUBLIC_UNIFIED_INPUT_ENABLED !== "false";
}

export function getRuntimeCapabilities(): RuntimeCapability[] {
  const academyCommerce = isAcademyCommerceEnabled();
  return [
    { key: "web", label: "Next.js Web", configured: true, required: true, description: "Dashboard, Studio, Reader và Store" },
    { key: "smart-core", label: "Smart Core Local", configured: true, required: true, description: "Tóm tắt, câu hỏi, flashcard, lịch ôn và preflight không cần AI" },
    { key: "offline", label: "Offline / PWA", configured: true, required: true, description: "Local workspace, backup và service worker" },
    { key: "database", label: "Supabase", configured: isSupabaseConfigured(), required: true, description: "Auth, PostgreSQL, RLS và Realtime" },
    { key: "storage", label: "Cloudflare R2", configured: isR2Configured(), required: true, description: "File private, ảnh, PDF và bản xuất" },
    { key: "queue", label: "Redis / BullMQ", configured: isQueueConfigured(), required: true, description: "Import, export, OCR và automation" },
    { key: "scanner", label: "File Scanner", configured: isFileScannerConfigured(), required: true, description: "Quét file upload trước khi cho phép tải hoặc đọc" },
    { key: "payment", label: "Payment Provider", configured: isPaymentConfigured(), required: academyCommerce, description: "Checkout, webhook và entitlement cho Academy" },
    { key: "email", label: "Email Provider", configured: isEmailConfigured(), required: academyCommerce, description: "Mời học viên, xác nhận đăng ký, hóa đơn và nhắc gia hạn" },
    { key: "ai", label: "AI Gateway (tùy chọn)", configured: Boolean(process.env.AI_GATEWAY_URL && process.env.AI_GATEWAY_TOKEN), required: false, description: "Chỉ tăng cường Smart Tools; không ảnh hưởng chức năng cốt lõi" },
    { key: "monitoring", label: "Monitoring", configured: Boolean(process.env.SENTRY_DSN || process.env.OTEL_EXPORTER_OTLP_ENDPOINT), required: false, description: "Lỗi, trace và cảnh báo" }
  ];
}
