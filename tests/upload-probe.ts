import fs from "node:fs";
import { encode } from "next-auth/jwt";

const BASE = "http://localhost:3000";

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
  const secret = parseEnvLocal().NEXTAUTH_SECRET;
  const sessionToken = await encode({ token: { name: "operator", isAdmin: true }, secret });
  const cookie = `next-auth.session-token=${sessionToken}`;

  for (const mb of [0.5, 1, 2, 5, 10, 25]) {
    const body = `<!doctype html><html><head><title>probe ${mb}</title></head><body>${"x".repeat(Math.floor(mb * 1024 * 1024))}</body></html>`;
    const fd = new FormData();
    fd.set("title", `probe ${mb}MB`);
    fd.set("file", new Blob([body], { type: "text/html" }), `probe-${mb}.html`);
    const resp = await fetch(`${BASE}/api/upload`, { method: "POST", headers: { cookie }, body: fd });
    const json = (await resp.json().catch(() => null)) as { data: { id: number } | null; error: string | null } | null;
    console.log(`${mb}MB → ${resp.status} ${json?.error ?? "ok id=" + json?.data?.id}`);
    if (json?.data?.id) {
      await fetch(`${BASE}/api/documents/${json.data.id}`, { method: "DELETE", headers: { cookie } });
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
