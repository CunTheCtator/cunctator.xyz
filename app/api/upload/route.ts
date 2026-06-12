import { NextRequest, NextResponse } from "next/server";
import Busboy from "busboy";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { v4 as uuidv4 } from "uuid";
import { parse as parseHtml } from "node-html-parser";
import { insertDocument } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ??
  path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "uploads");

const ALLOWED_EXTENSIONS = new Set([".html", ".htm"]);
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_UPLOADS = 20;
const uploadTimestamps: number[] = [];

function rateLimited(): boolean {
  const now = Date.now();
  while (uploadTimestamps.length > 0 && now - uploadTimestamps[0] > RATE_WINDOW_MS) {
    uploadTimestamps.shift();
  }
  if (uploadTimestamps.length >= RATE_MAX_UPLOADS) return true;
  uploadTimestamps.push(now);
  return false;
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  return UPLOAD_DIR;
}

function extractTitle(html: string, fallback: string): string {
  try {
    const root = parseHtml(html);
    const titleEl = root.querySelector("title");
    const text = titleEl?.text?.trim();
    return text || fallback;
  } catch {
    return fallback;
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  if (!sameOrigin(req)) {
    return NextResponse.json({ data: null, error: "Cross-origin request rejected" }, { status: 403 });
  }

  if (rateLimited()) {
    return NextResponse.json({ data: null, error: "Too many uploads — try again in a minute" }, { status: 429 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { data: null, error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  const uploadDir = ensureUploadDir();

  return new Promise<NextResponse>((resolve) => {
    const bb = Busboy({ headers: { "content-type": contentType } });

    let originalName = "";
    let titleOverride = "";
    let description = "";
    let tagsRaw = "";
    let fileBuffer = Buffer.alloc(0);
    let fileFound = false;

    bb.on("field", (name, value) => {
      if (name === "title") titleOverride = value.trim();
      if (name === "description") description = value.trim();
      if (name === "tags") tagsRaw = value.trim();
    });

    let oversized = false;
    let receivedBytes = 0;

    bb.on("file", (_fieldname, fileStream, info) => {
      fileFound = true;
      originalName = info.filename;
      const chunks: Buffer[] = [];
      fileStream.on("data", (chunk: Buffer) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_UPLOAD_BYTES) {
          oversized = true;
          fileStream.resume();
          return;
        }
        chunks.push(chunk);
      });
      fileStream.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    bb.on("finish", () => {
      if (!fileFound || fileBuffer.length === 0) {
        resolve(
          NextResponse.json({ data: null, error: "No file received" }, { status: 400 })
        );
        return;
      }

      if (oversized) {
        resolve(
          NextResponse.json(
            { data: null, error: `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB upload ceiling` },
            { status: 413 }
          )
        );
        return;
      }

      const ext = path.extname(originalName).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        resolve(
          NextResponse.json(
            { data: null, error: "Only .html / .htm documents are accepted" },
            { status: 415 }
          )
        );
        return;
      }

      const uuid = uuidv4();
      const filePath = path.join(uploadDir, `${uuid}.html`);

      try {
        fs.writeFileSync(filePath, fileBuffer);
      } catch (err) {
        console.error("[upload] Failed to write file:", { filePath, err });
        resolve(
          NextResponse.json({ data: null, error: "Failed to save file" }, { status: 500 })
        );
        return;
      }

      const htmlContent = fileBuffer.toString("utf-8");
      const baseName = path.basename(originalName, path.extname(originalName));
      const title = titleOverride || extractTitle(htmlContent, baseName);

      let tags: string[] = [];
      try {
        tags = tagsRaw ? JSON.parse(tagsRaw) : [];
      } catch {
        tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
      }

      const doc = insertDocument({ uuid, title, description, tags });
      if (!doc) {
        fs.unlinkSync(filePath);
        resolve(
          NextResponse.json({ data: null, error: "Failed to save metadata" }, { status: 500 })
        );
        return;
      }

      resolve(NextResponse.json({ data: doc, error: null }, { status: 201 }));
    });

    bb.on("error", (err: unknown) => {
      console.error("[upload] Busboy error:", err);
      resolve(
        NextResponse.json({ data: null, error: "Upload parsing failed" }, { status: 500 })
      );
    });

    if (!req.body) {
      resolve(NextResponse.json({ data: null, error: "Empty body" }, { status: 400 }));
      return;
    }
    const bodyStream = Readable.fromWeb(
      req.body as import("stream/web").ReadableStream<Uint8Array>
    );
    bodyStream.pipe(bb);
  });
}
