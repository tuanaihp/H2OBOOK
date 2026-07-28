import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function POST(){const auth=await requireApiUser();if(auth.response)return auth.response;const supabase=await createSupabaseServerClient();if(!supabase)return NextResponse.json({mode:"demo",claimed:0});const {data,error}=await supabase.rpc("claim_my_pending_access");if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({mode:"cloud",claimed:Number(data??0)});}
