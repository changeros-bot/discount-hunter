import { NextResponse } from "next/server";

export function middleware(request) {
  const url = request.nextUrl.clone();
  if (url.pathname === "/paper-auto") {
    url.pathname = "/paper-status";
    return NextResponse.redirect(url, 307);
  }
  if (url.pathname === "/v17") {
    url.pathname = "/v17-with-chart";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/paper-auto", "/v17"],
};
