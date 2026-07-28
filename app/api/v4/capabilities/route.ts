import { NextResponse } from "next/server";
import { getAppMode, getRuntimeCapabilities } from "@/lib/runtime-config";

export async function GET() {
  return NextResponse.json({
    product: "H2OBOOK",
    version: "4.12.0",
    architecture: "offline-first-no-ai-first",
    mode: getAppMode(),
    coreRequiresAI: false,
    core: ["editor","compose-engine","text-flow-engine","reader","templates","brand-clone","library","classes","quiz","flashcards","spaced-repetition","preflight","store","membership","backup"],
    optional: ["external-ai","cloud-sync","r2-storage","document-worker","payment","email","monitoring"],
    runtime: getRuntimeCapabilities()
  });
}
