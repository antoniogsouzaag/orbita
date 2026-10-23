// Uso: OUT=dir PREFIX=antes node scripts/shots.mjs /rota1 /rota2 ...
import { chromium } from "@playwright/test";

const routes = process.argv.slice(2);
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = process.env.OUT ?? ".";
const prefix = process.env.PREFIX ?? "shot";
const w = Number(process.env.W ?? 1440), h = Number(process.env.H ?? 900);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: process.env.THEME === "light" ? "light" : "dark", deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGEERROR", e.message));
await page.goto(`${base}/login`);
await page.fill('input[name="password"]', process.env.ORBITA_PASSWORD ?? "orbita-dev");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90000 });
if (process.env.SIDEBAR === "1") await page.evaluate(() => localStorage.setItem("orbita:sidebar", "1"));
if (process.env.THEME === "light") await page.evaluate(() => localStorage.setItem("theme", "light"));
for (const r of routes) {
  await page.goto(`${base}${r}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(([t, sf]) => { if (t) document.documentElement.setAttribute("data-theme", t); if (sf) document.documentElement.setAttribute("data-surface", sf); }, [process.env.DATA_THEME ?? "", process.env.DATA_SURFACE ?? ""]);
  await page.waitForTimeout(900);
  const file = `${out}/${prefix}-${r.replace(/[/?=&]+/g, "_").replace(/^_|_$/g, "") || "home"}.png`;
  await page.screenshot({ path: file, fullPage: process.env.FULL === "1" });
  console.log("ok", file);
}
await browser.close();
