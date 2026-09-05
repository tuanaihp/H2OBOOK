// Shared by the browser login form, the admin create-student route and the academy service.
// Vietnamese mobile numbers only: 10 local digits starting with 0 (e.g. 0912 345 678), or the
// same number already in +84 / 84 form. Supabase Auth stores the phone WITHOUT the leading "+"
// (e.g. "84912345678"); `toSupabasePhone` returns that shape, `toE164` keeps the "+".

export function normalizeVietnamPhone(raw: string): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+84")) d = d.slice(3);
  else if (d.startsWith("84")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  else if (d.startsWith("+")) return null; // a different country code — not supported here
  // VN mobile without the trunk 0 is 9 digits and starts 3/5/7/8/9.
  if (!/^[3-9]\d{8}$/.test(d)) return null;
  return `84${d}`;
}

/** "+84912345678" for display / signInWithPassword({ phone }). */
export function toE164(raw: string): string | null {
  const s = normalizeVietnamPhone(raw);
  return s ? `+${s}` : null;
}

/** "0912345678" for showing back to the student. */
export function toLocalVietnamPhone(raw: string): string | null {
  const s = normalizeVietnamPhone(raw);
  return s ? `0${s.slice(2)}` : null;
}
