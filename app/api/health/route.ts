import { NextResponse } from "next/server";
import { getAppMode } from "@/lib/runtime-config";
export async function GET(){return NextResponse.json({ok:true,service:"h2obook-web",version:"4.16.0",architecture:"academy-revenue-loop-production",mode:getAppMode(),timestamp:new Date().toISOString()});}
