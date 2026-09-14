import { NextResponse } from "next/server";
import { getAppMode } from "@/lib/runtime-config";
import { APP_VERSION } from "@/lib/version";
export async function GET(){return NextResponse.json({ok:true,service:"h2obook-web",version:APP_VERSION,architecture:"academy-revenue-loop-production",mode:getAppMode(),timestamp:new Date().toISOString()});}
