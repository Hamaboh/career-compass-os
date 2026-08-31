import { NextRequest, NextResponse } from "next/server";
import { createRequestId } from "@/lib/http";
import { contentSecurityPolicy } from "@/lib/security-headers";

export function middleware(request: NextRequest) {
  const requestId = createRequestId(request.headers.get("x-request-id"));
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "production",
  );
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  response.headers.set("Content-Security-Policy", csp);
  if (
    !request.nextUrl.pathname.startsWith("/s/") &&
    !request.cookies.get("cc_csrf")
  )
    response.cookies.set("cc_csrf", crypto.randomUUID().replaceAll("-", ""), {
      httpOnly: false,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  return response;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
