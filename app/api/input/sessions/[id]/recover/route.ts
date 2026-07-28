import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { getInputSession } from "@/lib/input/orchestrator-server";
import { inputErrorResponse } from "@/lib/input/api-errors";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const auth=await requireApiUser();if(auth.response)return auth.response;const access=await resolveOrganizationAccess(auth.user!,new URL(request.url).searchParams.get("organizationId")??undefined);if(!access)throw new Error("WORKSPACE_FORBIDDEN");
    const {id}=await params;const session=await getInputSession(access.organizationId,id);if(!session)throw new Error("INPUT_SESSION_NOT_FOUND");
    return NextResponse.json({session,recovery:{canResume:["failed","cancelled","recovery_required"].includes(session.status),hasPreview:Boolean(session.preview),commitResult:session.commitResult??null,deadlineAt:session.deadlineAt,heartbeatAt:session.heartbeatAt}},{headers:session.traceId?{"x-trace-id":session.traceId}:undefined});
  }catch(error){return inputErrorResponse(error,request,"INPUT_RECOVERY_READ_FAILED");}
}
