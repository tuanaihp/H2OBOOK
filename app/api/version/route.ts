import { NextResponse } from "next/server";
import { getAppMode,getRuntimeCapabilities } from "@/lib/runtime-config";
import { APP_VERSION, INPUT_ENGINE_VERSION } from "@/lib/version";
export async function GET(){return NextResponse.json({name:"H2OBOOK",version:APP_VERSION,inputEngineVersion:INPUT_ENGINE_VERSION,edition:"Professional Editor — Compose & Text Flow — No-AI-First",mode:getAppMode(),coreRequiresAI:false,capabilities:getRuntimeCapabilities()});}
