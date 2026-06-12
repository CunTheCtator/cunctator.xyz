import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDocument, updateDocument, deleteDocument } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? path.join(process.cwd(), "public", "uploads");

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return NextResponse.json({ data: null, error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ data: null, error: "Invalid body" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const update: Parameters<typeof updateDocument>[1] = {};

  if ("title" in raw) {
    if (typeof raw.title !== "string") {
      return NextResponse.json({ data: null, error: "title must be a string" }, { status: 400 });
    }
    update.title = raw.title;
  }
  if ("description" in raw) {
    if (typeof raw.description !== "string") {
      return NextResponse.json({ data: null, error: "description must be a string" }, { status: 400 });
    }
    update.description = raw.description;
  }
  if ("tags" in raw) {
    if (!Array.isArray(raw.tags) || !raw.tags.every((t) => typeof t === "string")) {
      return NextResponse.json({ data: null, error: "tags must be an array of strings" }, { status: 400 });
    }
    update.tags = raw.tags as string[];
  }
  if ("featured" in raw) {
    if (typeof raw.featured !== "boolean") {
      return NextResponse.json({ data: null, error: "featured must be a boolean" }, { status: 400 });
    }
    update.featured = raw.featured;
  }

  const doc = updateDocument(numId, update);
  if (!doc) {
    return NextResponse.json({ data: null, error: "Document not found or update failed" }, { status: 404 });
  }

  return NextResponse.json({ data: doc, error: null });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) {
    return NextResponse.json({ data: null, error: "Invalid id" }, { status: 400 });
  }

  const doc = getDocument(numId);
  if (!doc) {
    return NextResponse.json({ data: null, error: "Document not found" }, { status: 404 });
  }

  const deleted = deleteDocument(numId);
  if (!deleted) {
    return NextResponse.json({ data: null, error: "Delete failed" }, { status: 500 });
  }

  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const filePath = path.resolve(UPLOAD_DIR, `${doc.uuid}.html`);
  const escapesUploadDir = !filePath.startsWith(path.resolve(UPLOAD_DIR) + path.sep);
  if (!UUID_PATTERN.test(doc.uuid) || escapesUploadDir) {
    console.error(`[documents] Refusing to delete suspicious path for doc ${numId}:`, { uuid: doc.uuid, filePath });
    return NextResponse.json({ data: { id: numId }, error: null });
  }
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`[documents] Failed to delete file for doc ${numId}:`, { filePath, err });
  }

  return NextResponse.json({ data: { id: numId }, error: null });
}
