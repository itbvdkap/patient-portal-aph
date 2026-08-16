import { NextResponse } from "next/server";

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}

export function notFoundResponse() {
  return NextResponse.json({ error: "Resource not found." }, { status: 404 });
}

export function okResponse<T>(data: T) {
  return NextResponse.json({ data });
}
