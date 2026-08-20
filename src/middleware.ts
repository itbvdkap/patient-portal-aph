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

const corsOrigins = new Set([
  "http://localhost:8081",
  "http://localhost:8082",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:8082",
  "https://patient-portal-aph.vercel.app",
  "https://anphucare.benhvienanphu.vn",
]);

function withCors(response: NextResponse, request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && corsOrigins.has(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Accept");
    response.headers.append("Vary", "Origin");
  }
  return response;
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (request.method === "OPTIONS") {
      return withCors(new NextResponse(null, { status: 204 }), request);
    }
    return withCors(NextResponse.next(), request);
  }

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

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-portal-pathname", request.nextUrl.pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/api/:path*",
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
