import { NextResponse } from "next/server";
import { getAppMode } from "@/lib/runtime-config";
export async function GET(){return NextResponse.json({ok:true,service:"h2obook-web",version:"3.5.0",architecture:"v1-v2-v3-production-integrated",mode:getAppMode(),timestamp:new Date().toISOString()});}
