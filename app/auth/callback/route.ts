import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function GET(request:Request){const url=new URL(request.url);const requested=url.searchParams.get("next")||"/dashboard";const next=requested.startsWith("/")&&!requested.startsWith("//")?requested:"/dashboard";const code=url.searchParams.get("code");const supabase=await createSupabaseServerClient();if(code&&supabase){await supabase.auth.exchangeCodeForSession(code);await supabase.rpc("claim_my_pending_access");}return NextResponse.redirect(new URL(next,url.origin));}
