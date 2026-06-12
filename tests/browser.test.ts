import { chromium, devices, type Browser, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = path.join("temp", "shots");

const ROUTES = ["/", "/about", "/projects", "/library", "/game", "/contact", "/privacy", "/signin", "/nonexistent"];

const consoleErrors: { page: string; text: string }[] = [];
let failed = 0;

function report(ok: boolean, label: string): void {
  if (ok) {
    console.log(`  ok    ${label}`);
  } else {
    failed++;
    console.error(`  FAIL  ${label}`);
  }
}

function watchConsole(page: Page, label: string): void {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const url = msg.location()?.url ?? page.url();
      if (msg.text().includes("status of 404") && (url.includes("/nonexistent") || page.url().includes("/nonexistent"))) return;
      consoleErrors.push({ page: label, text: `${msg.text().slice(0, 160)} @ ${url.slice(0, 80)}` });
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push({ page: label, text: `pageerror: ${err.message.slice(0, 200)}` });
  });
}

async function shootRoutes(browser: Browser, viewport: { width: number; height: number }, tag: string, mobile: boolean) {
  console.log(`\n== ${tag} (${viewport.width}×${viewport.height}) ==`);
  const ctx = await browser.newContext({
    viewport,
    reducedMotion: "reduce",
    ...(mobile ? { userAgent: devices["iPhone 13"].userAgent, hasTouch: true, isMobile: true } : {}),
  });
  const page = await ctx.newPage();
  watchConsole(page, tag);
  for (const route of ROUTES) {
    const resp = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 });
    const status = resp?.status() ?? 0;
    const expected = route === "/nonexistent" ? 404 : 200;
    report(status === expected, `${route} → ${status}`);
    await page.waitForTimeout(400);
    const name = route === "/" ? "home" : route.replace(/\//g, "_").replace(/^_/, "");
    await page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`), fullPage: route !== "/game" });
  }
  await ctx.close();
}

async function gameFlow(browser: Browser) {
  console.log("\n== game flow (desktop) ==");
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  watchConsole(page, "game-flow");

  await page.goto(BASE + "/game", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "flow-1-menu.png") });
  report(await page.locator(".rm-menu__title").count() > 0, "menu renders");

  await page.locator("text=Begin operation").first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "flow-2-narrative.png") });
  report(await page.locator(".rm-nar__frame").count() > 0, "sheifport narrative opens");

  for (let i = 0; i < 40; i++) {
    const choices = await page.locator(".rm-nar__choice").count();
    if (choices > 0) break;
    await page.locator(".rm-nar__frame").click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(120);
  }
  const choiceCount = await page.locator(".rm-nar__choice").count();
  report(choiceCount > 0, `reached the faction choice (${choiceCount} options)`);
  await page.screenshot({ path: path.join(OUT, "flow-3-choice.png") });

  if (choiceCount > 0) {
    await page.locator(".rm-nar__choice").first().click();
    for (let i = 0; i < 80; i++) {
      if ((await page.locator(".rm-cmsel").count()) > 0) break;
      const choices = await page.locator(".rm-nar__choice").count();
      if (choices > 0) {
        await page.locator(".rm-nar__choice").first().click();
      } else if ((await page.locator(".rm-nar__frame").count()) > 0) {
        await page.locator(".rm-nar__frame").click({ position: { x: 400, y: 300 } });
      }
      await page.waitForTimeout(120);
    }
    report((await page.locator(".rm-cmsel").count()) > 0, "commander select reached");
    await page.screenshot({ path: path.join(OUT, "flow-4-commander.png") });

    if ((await page.locator(".rm-cmsel").count()) > 0) {
      await page.locator(".rm-cmcard").first().click();
      await page.locator("text=Deploy detachment").click();
      for (let i = 0; i < 80; i++) {
        if ((await page.locator(".rm-hud").count()) > 0) break;
        const choices = await page.locator(".rm-nar__choice").count();
        if (choices > 0) {
          await page.locator(".rm-nar__choice").first().click();
        } else if ((await page.locator(".rm-nar__frame").count()) > 0) {
          await page.locator(".rm-nar__frame").click({ position: { x: 400, y: 300 } });
        }
        await page.waitForTimeout(120);
      }
      report((await page.locator(".rm-hud").count()) > 0, "mission HUD reached");
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, "flow-5-mission.png") });
      await page.locator(".rm-hud").screenshot({ path: path.join(OUT, "flow-5b-hud.png") });
      report((await page.locator(".rm-cmd").count()) > 0, "command strip present");
      report((await page.locator(".rm-cmd__obj").count()) > 0, "objective line present");

      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      report((await page.locator(".rm-mcard").count()) > 0, "pause opens on Esc");
      await page.screenshot({ path: path.join(OUT, "flow-6-pause.png") });

      await page.locator("text=Settings").click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, "flow-7-settings.png") });
      report((await page.locator(".rm-set__range").count()) > 0, "settings shows the volume slider");
      await page.keyboard.press("Escape");

      await page.locator(".rm-mbtn--gold").click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, "flow-8-codex.png") });
      report((await page.locator(".rm-cx").count()) > 0, "codex opens");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);

      const saved = await page.evaluate(() => window.localStorage.getItem("remnant_save_v1") !== null);
      report(saved, "save blob exists in localStorage");
    }
  }

  await ctx.close();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  await shootRoutes(browser, { width: 1440, height: 900 }, "desktop", false);
  await shootRoutes(browser, { width: 390, height: 844 }, "mobile", true);
  await gameFlow(browser);

  await browser.close();

  console.log("\n== console errors collected ==");
  if (consoleErrors.length === 0) {
    console.log("  none");
  } else {
    for (const e of consoleErrors.slice(0, 20)) console.error(`  [${e.page}] ${e.text}`);
  }

  console.log(`\nscreenshots in ${OUT}`);
  if (failed > 0 || consoleErrors.length > 0) {
    console.error(`${failed} failures, ${consoleErrors.length} console errors`);
    process.exit(1);
  }
  console.log("ALL OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
