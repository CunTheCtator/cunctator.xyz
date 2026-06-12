import { NextResponse } from "next/server";
import { getAllDocuments } from "@/lib/db";

export async function GET() {
  const docs = getAllDocuments();
  return NextResponse.json({ data: docs, error: null });
}
