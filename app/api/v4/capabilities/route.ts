import { NextResponse } from "next/server";
import { getAppMode, getRuntimeCapabilities } from "@/lib/runtime-config";
import { APP_VERSION } from "@/lib/version";

export async function GET() {
  return NextResponse.json({
    product: "H2OBOOK",
    version: APP_VERSION,
    architecture: "offline-first-no-ai-first",
    mode: getAppMode(),
    coreRequiresAI: false,
    core: ["editor","compose-engine","text-flow-engine","reader","templates","brand-clone","library","classes","quiz","flashcards","spaced-repetition","preflight","store","membership","backup"],
    optional: ["external-ai","cloud-sync","r2-storage","document-worker","payment","email","monitoring"],
    runtime: getRuntimeCapabilities()
  });
}
