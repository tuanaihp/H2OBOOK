import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAppMode } from "@/lib/runtime-config";

export async function createSupabaseServerClient() {
  // Demo mode must stay fully local even when a developer machine still has
  // production Supabase credentials in .env.local. Otherwise demo user IDs
  // are accidentally sent to the production-shaped database and imports fail.
  if (getAppMode() === "demo") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items: { name: string; value: string; options: CookieOptions }[]) => {
        try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Server Components cannot always write cookies. Middleware handles refresh in production. */ }
      }
    }
  });
}
