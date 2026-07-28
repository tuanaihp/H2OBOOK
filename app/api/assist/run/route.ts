import {handleAssistRequest} from "@/lib/assist/handler";export async function POST(request:Request){return handleAssistRequest(request);}
