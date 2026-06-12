import { chromium, firefox, webkit, devices, type BrowserType } from "playwright";
import path from "node:path";

const BASE = "http://localhost:3000";
const ROUTES = ["/", "/about", "/projects", "/library", "/game", "/contact", "/privacy"];

let failed = 0;
const consoleErrors: string[] = [];

async function run(engine: BrowserType, tag: string, mobile: boolean) {
  console.log(`\n== ${tag} ==`);
  const browser = await engine.launch();
  const ctx = await browser.newContext({
    reducedMotion: "reduce",
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    ...(mobile ? { userAgent: devices["iPhone 13"].userAgent } : {}),
  });
  const page = await ctx.newPage();
  page.on("pageerror", (err) => {
    // WebKit reports Link prefetches cancelled by navigation as access-control
    // errors; they are aborted ?_rsc= fetches, not application failures.
    if (err.message.includes("_rsc=")) return;
    consoleErrors.push(`[${tag}] ${err.message.slice(0, 140)}`);
  });
  for (const route of ROUTES) {
    try {
      const resp = await page.goto(BASE + route, { waitUntil: "load", timeout: 30000 });
      const ok = resp?.status() === 200;
      if (!ok) failed++;
      console.log(`  ${ok ? "ok  " : "FAIL"}  ${route} → ${resp?.status()}`);
    } catch (err) {
      failed++;
      console.error(`  FAIL  ${route} — ${err instanceof Error ? err.message.slice(0, 100) : err}`);
    }
  }
  const name = tag.replace(/[^a-z-]/gi, "");
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.screenshot({ path: path.join("temp", "shots", `xb-${name}-home.png`) });
  await page.goto(BASE + "/game", { waitUntil: "load" });
  await page.screenshot({ path: path.join("temp", "shots", `xb-${name}-game.png`) });
  await browser.close();
}

async function main() {
  await run(firefox, "firefox-desktop", false);
  await run(webkit, "webkit-desktop", false);
  await run(webkit, "webkit-mobile", true);
  await run(chromium, "chromium-mobile", true);

  console.log("\n== page errors ==");
  if (consoleErrors.length === 0) console.log("  none");
  else for (const e of consoleErrors.slice(0, 10)) console.error(`  ${e}`);

  if (failed > 0 || consoleErrors.length > 0) {
    console.error(`${failed} failures, ${consoleErrors.length} page errors`);
    process.exit(1);
  }
  console.log("ALL OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
