import { NextResponse, type NextRequest } from "next/server";
import { demoSessionCookie } from "@/lib/auth/demo-auth";

const protectedRoutes = [
  "/dashboard",
  "/profile",
  "/today-visit",
  "/registrations",
  "/visits",
  "/lab-results",
  "/imaging",
  "/prescriptions",
  "/insurance",
  "/appointments",
  "/booking",
];

export function middleware(request: NextRequest) {
  const isProtected = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route));

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasDemoSession = Boolean(request.cookies.get(demoSessionCookie)?.value);

  if (!hasDemoSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/today-visit/:path*",
    "/registrations/:path*",
    "/visits/:path*",
    "/lab-results/:path*",
    "/imaging/:path*",
    "/prescriptions/:path*",
    "/insurance/:path*",
    "/appointments/:path*",
    "/booking/:path*",
  ],
};
