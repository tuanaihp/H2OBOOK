import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";

function deviceLabel(userAgent: string) {
  const browser = /Edg\//.test(userAgent) ? "Microsoft Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent) ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : "Trình duyệt";
  const os = /Windows/.test(userAgent) ? "Windows" : /Mac OS/.test(userAgent) ? "macOS" : /Android/.test(userAgent) ? "Android" : /iPhone|iPad/.test(userAgent) ? "iOS" : /Linux/.test(userAgent) ? "Linux" : "Thiết bị không xác định";
  return `${browser} trên ${os}`;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const userAgent = request.headers.get("user-agent") ?? "";
  return NextResponse.json({
    user,
    session: user ? {
      id: "current",
      device: deviceLabel(userAgent),
      userAgent,
      current: true,
      authenticated: !user.demo,
      location: "Không thu thập vị trí chính xác"
    } : null
  });
}
