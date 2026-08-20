import { NextResponse } from "next/server";
import { demoSessionCookie } from "@/lib/auth/demo-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(demoSessionCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
