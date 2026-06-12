import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })).newPage();
  await page.goto("http://localhost:3000/contact", { waitUntil: "networkidle" });
  await page.screenshot({ path: "temp/shots/contact-profiles.png", fullPage: true });
  const cards = await page.locator(".ct-profile").count();
  const body = (await page.textContent("body")) ?? "";
  const dashes = (body.match(/—/g) ?? []).length;
  const discordHref = await page.locator('.ct-profile:has-text("Discord")').getAttribute("href");
  console.log(`profile cards: ${cards} | em dashes rendered: ${dashes} | discord href: ${discordHref}`);

  for (const route of ["/", "/about", "/projects", "/library", "/game", "/privacy", "/signin"]) {
    await page.goto(`http://localhost:3000${route}`, { waitUntil: "load" });
    const text = (await page.textContent("body")) ?? "";
    const n = (text.match(/—/g) ?? []).length;
    console.log(`${route} em dashes rendered: ${n}`);
  }
  await b.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
