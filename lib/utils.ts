export const cn = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

export const uid = (prefix = "id") => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
