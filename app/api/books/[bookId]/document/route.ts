import { NextResponse } from "next/server";
import { requireApiUser, resolveOrganizationAccess } from "@/lib/auth/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { nestContentNodes } from "@/lib/content-document";
import type { BookDocument } from "@h2obook/content-core";

export async function GET(request: Request, context: { params: Promise<{ bookId: string }> }) {
  const auth=await requireApiUser(); if(auth.response)return auth.response;
  const access=await resolveOrganizationAccess(auth.user!,new URL(request.url).searchParams.get("organizationId")??undefined);
  if(!access)return NextResponse.json({error:"WORKSPACE_FORBIDDEN"},{status:403});
  const { bookId }=await context.params; const client=await createSupabaseServerClient();
  if(!client)return NextResponse.json({error:"DATABASE_NOT_CONFIGURED"},{status:503});
  const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(bookId);
  const {data:book}=await client.from("books").select("id").eq("organization_id",access.organizationId).eq(uuid?"id":"client_key",bookId).maybeSingle();
  if(!book)return NextResponse.json({error:"BOOK_NOT_FOUND"},{status:404});
  const {data:document,error}=await client.from("book_documents").select("*").eq("book_id",book.id).eq("organization_id",access.organizationId).maybeSingle();
  if(error)return NextResponse.json({error:error.message},{status:400}); if(!document)return NextResponse.json({document:null});
  const {data:nodes,error:nodesError}=await client.from("content_nodes").select("*").eq("document_id",document.id).order("position");
  if(nodesError)return NextResponse.json({error:nodesError.message},{status:400});
  return NextResponse.json({document:{id:document.id,bookId:String(book.id),organizationId:access.organizationId,title:document.title,language:document.language,metadata:document.metadata,version:document.version,createdAt:document.created_at,updatedAt:document.updated_at,root:nestContentNodes(nodes??[])}});
}

export async function PUT(request: Request, context: { params: Promise<{ bookId: string }> }) {
  const auth=await requireApiUser(); if(auth.response)return auth.response;
  const body=await request.json().catch(()=>null) as {organizationId?:string;document?:BookDocument}|null;
  if(!body?.document)return NextResponse.json({error:"DOCUMENT_REQUIRED"},{status:400});
  const access=await resolveOrganizationAccess(auth.user!,body.organizationId,["owner","admin","designer"]);
  if(!access)return NextResponse.json({error:"WORKSPACE_FORBIDDEN"},{status:403});
  const {bookId}=await context.params; const client=await createSupabaseServerClient();
  if(!client)return NextResponse.json({error:"DATABASE_NOT_CONFIGURED"},{status:503});
  const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(bookId);
  const {data:book}=await client.from("books").select("id").eq("organization_id",access.organizationId).eq(uuid?"id":"client_key",bookId).maybeSingle();
  if(!book)return NextResponse.json({error:"BOOK_NOT_FOUND"},{status:404});
  const {flattenContentNodes}=await import("@/lib/content-document");
  const {data,error}=await client.rpc("save_book_semantic_document",{p_organization_id:access.organizationId,p_book_id:book.id,p_title:body.document.title,p_language:body.document.language,p_metadata:body.document.metadata,p_version:body.document.version,p_nodes:flattenContentNodes(body.document.root)});
  if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({documentId:data});
}
