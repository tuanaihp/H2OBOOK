import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { retryInputSession } from "@/lib/input/orchestrator-server";
import { readJsonBody } from "@/lib/security/request-limits";
import { inputErrorResponse } from "@/lib/input/api-errors";
export async function POST(request: Request,{params}:{params:Promise<{id:string}>}){
  const auth=await requireApiUser();if(auth.response)return auth.response;
  try{
    const body=await readJsonBody<{organizationId?:string;fromStage?:"validating"|"processing"|"committing"}>(request,64*1024);
    const access=await resolveOrganizationAccess(auth.user!,body?.organizationId,["owner","admin","designer","partner","teacher"]);if(!access)throw new Error("WORKSPACE_FORBIDDEN");
    const {id}=await params;return NextResponse.json({session:await retryInputSession({organizationId:access.organizationId,userId:auth.user!.id,sessionId:id,fromStage:body?.fromStage})});
  }catch(error){return inputErrorResponse(error,request,"INPUT_RETRY_FAILED");}
}
