import { NextResponse } from "next/server";
import { getAppMode,getRuntimeCapabilities } from "@/lib/runtime-config";
export async function GET(){return NextResponse.json({name:"H2OBOOK",version:"4.12.0",edition:"Professional Editor — Compose & Text Flow — No-AI-First",mode:getAppMode(),coreRequiresAI:false,capabilities:getRuntimeCapabilities(),buildDate:"2026-07-27"});}
