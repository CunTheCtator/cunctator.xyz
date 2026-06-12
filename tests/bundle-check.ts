import { chromium } from "playwright";

const BASE = "http://localhost:3000";

async function measure(route: string): Promise<{ initialJs: number; prefetchJs: number; engineInInitial: boolean }> {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let initialJs = 0;
  let prefetchJs = 0;
  let engineInInitial = false;
  let loaded = false;
  page.on("load", () => {
    loaded = true;
  });
  page.on("response", async (resp) => {
    try {
      const url = resp.url();
      if (!url.startsWith(BASE)) return;
      const isJs = url.includes(".js") || (resp.headers()["content-type"] ?? "").includes("javascript");
      if (!isJs) return;
      const body = await resp.body().catch(() => null);
      if (!body) return;
      const purpose = resp.request().headers()["sec-purpose"] ?? "";
      const isPrefetch = purpose.includes("prefetch") || loaded;
      if (isPrefetch) {
        prefetchJs += body.length;
      } else {
        initialJs += body.length;
        const text = body.toString("utf8");
        if (text.includes("pendingReinforcements") || text.includes("helvyn-layout")) engineInInitial = true;
      }
    } catch {}
  });
  await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 });
  await browser.close();
  return { initialJs, prefetchJs, engineInInitial };
}

async function main() {
  for (const route of ["/", "/about", "/library", "/projects", "/contact", "/game"]) {
    const m = await measure(route);
    console.log(
      `${route.padEnd(10)} initial js ${(m.initialJs / 1024).toFixed(0).padStart(5)} kB · prefetched ${(m.prefetchJs / 1024).toFixed(0).padStart(5)} kB · engine in initial: ${m.engineInInitial ? "YES" : "no"}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
