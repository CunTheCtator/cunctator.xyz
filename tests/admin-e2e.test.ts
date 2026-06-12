import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { encode } from "next-auth/jwt";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => Promise<void> | void): Promise<void> | void {
  const done = (err?: unknown) => {
    if (err) {
      failed++;
      failures.push(name);
      console.error(`  FAIL  ${name}`);
      console.error(`        ${err instanceof Error ? err.message : err}`);
    } else {
      passed++;
      console.log(`  ok    ${name}`);
    }
  };
  try {
    const r = fn();
    if (r instanceof Promise) return r.then(() => done()).catch(done);
    done();
  } catch (err) {
    done(err);
  }
}

function parseEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = fs.readFileSync(".env.local", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

async function main() {
  const env = parseEnvLocal();
  const secret = env.NEXTAUTH_SECRET;
  assert.ok(secret, "NEXTAUTH_SECRET missing from .env.local");
  const uploadDir = env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

  const sessionToken = await encode({
    token: { name: "operator", isAdmin: true },
    secret,
  });
  const cookie = `next-auth.session-token=${sessionToken}`;

  console.log("\n== authenticated admin E2E (real session, real pipeline) ==");

  await test("unauthenticated upload is rejected with 401", async () => {
    const resp = await fetch(`${BASE}/api/upload`, { method: "POST", body: new FormData() });
    assert.equal(resp.status, 401);
  });

  await test("unauthenticated document mutation is blocked by middleware", async () => {
    const resp = await fetch(`${BASE}/api/documents/1`, { method: "DELETE", redirect: "manual" });
    assert.ok(resp.status === 401 || (resp.status >= 300 && resp.status < 400), `status ${resp.status}`);
  });

  await test("wrong extension is rejected (415)", async () => {
    const fd = new FormData();
    fd.set("file", new Blob(["not html"], { type: "text/plain" }), "notes.txt");
    const resp = await fetch(`${BASE}/api/upload`, { method: "POST", headers: { cookie }, body: fd });
    assert.equal(resp.status, 415);
  });

  const MB = 1024 * 1024;
  const bigBody = `<!doctype html><html><head><title>Large Upload Drill</title></head><body><p>${"x".repeat(25 * MB)}</p></body></html>`;
  let docId = 0;
  let docUuid = "";

  await test(`25MB upload succeeds end-to-end (${Math.round(bigBody.length / MB)}MB body)`, async () => {
    const fd = new FormData();
    fd.set("title", "Large Upload Drill");
    fd.set("description", "20MB+ verification document");
    fd.set("tags", JSON.stringify(["drill"]));
    fd.set("file", new Blob([bigBody], { type: "text/html" }), "large-upload-drill.html");
    const resp = await fetch(`${BASE}/api/upload`, { method: "POST", headers: { cookie }, body: fd });
    const json = (await resp.json()) as { data: { id: number; uuid: string } | null; error: string | null };
    assert.equal(resp.status, 201, `status ${resp.status}: ${json.error}`);
    assert.ok(json.data);
    docId = json.data.id;
    docUuid = json.data.uuid;
  });

  await test("uploaded file exists on disk at its UUID path", () => {
    const p = path.join(uploadDir, `${docUuid}.html`);
    assert.ok(fs.existsSync(p));
    assert.ok(fs.statSync(p).size > 20 * MB);
  });

  await test("document appears in the listing", async () => {
    const resp = await fetch(`${BASE}/api/documents`, { headers: { cookie } });
    const json = (await resp.json()) as { data: { id: number }[] | null };
    assert.equal(resp.status, 200);
    assert.ok(json.data?.some((d) => d.id === docId));
  });

  await test("metadata edit + featured toggle persist", async () => {
    const resp = await fetch(`${BASE}/api/documents/${docId}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ title: "Large Upload Drill (edited)", featured: true, tags: ["drill", "edited"] }),
    });
    const json = (await resp.json()) as { data: { title: string; featured: boolean; tags: string[] } | null };
    assert.equal(resp.status, 200);
    assert.equal(json.data?.title, "Large Upload Drill (edited)");
    assert.equal(json.data?.featured, true);
    assert.deepEqual(json.data?.tags, ["drill", "edited"]);
  });

  await test("document page renders the 25MB upload in its sandboxed frame", async () => {
    const browser = await chromium.launch();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const resp = await page.goto(`${BASE}/library/${docId}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert.equal(resp?.status(), 200);
    const sandbox = await page.locator("iframe.rd-frame").getAttribute("sandbox");
    assert.equal(sandbox, "allow-scripts");
    await browser.close();
  });

  await test("/admin renders the console for the authenticated operator", async () => {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies([
      { name: "next-auth.session-token", value: sessionToken, url: BASE },
    ]);
    const page = await ctx.newPage();
    const resp = await page.goto(`${BASE}/admin`, { waitUntil: "networkidle", timeout: 30000 });
    assert.equal(resp?.status(), 200);
    assert.ok(!page.url().includes("/signin"), "should not bounce to signin");
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join("temp", "shots", "admin-console.png"), fullPage: true });
    const body = (await page.textContent("body")) ?? "";
    assert.ok(/upload/i.test(body), "admin surface should expose the upload flow");
    await browser.close();
  });

  await test("unauthenticated /admin bounces to /signin", async () => {
    const browser = await chromium.launch();
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded", timeout: 30000 });
    assert.ok(page.url().includes("/signin"), `landed on ${page.url()}`);
    await browser.close();
  });

  await test("delete removes the row and cleans the disk", async () => {
    const resp = await fetch(`${BASE}/api/documents/${docId}`, { method: "DELETE", headers: { cookie } });
    assert.equal(resp.status, 200);
    const p = path.join(uploadDir, `${docUuid}.html`);
    assert.ok(!fs.existsSync(p), "file should be deleted from disk");
    const list = await fetch(`${BASE}/api/documents`, { headers: { cookie } });
    const json = (await list.json()) as { data: { id: number }[] | null };
    assert.ok(!json.data?.some((d) => d.id === docId));
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.error("failures:", failures.join(" | "));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
