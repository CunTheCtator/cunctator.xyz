import { NextResponse } from "next/server";

export const runtime = "nodejs";

const STARTED_AT = new Date().toISOString();

export async function GET() {
  return NextResponse.json({
    data: {
      status: "ok",
      startedAt: STARTED_AT,
      node: process.version,
    },
    error: null,
  });
}
