import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "./lib/auth";
export async function proxy(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get("session")?.value);
  if (!session && req.nextUrl.pathname !== "/login")
    return NextResponse.redirect(new URL("/login", req.url));
  if (session && req.nextUrl.pathname === "/login")
    return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}
export const config = { matcher: ["/", "/calendar", "/login"] };
