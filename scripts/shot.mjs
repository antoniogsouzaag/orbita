// Uso: node scripts/shot.mjs <rota> [arquivo] [largura] [altura] [tema]
import { chromium } from "@playwright/test";

const [route = "/", out = "shot.png", w = "1440", h = "900", theme = "dark"] = process.argv.slice(2);
const base = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: Number(w), height: Number(h) }, colorScheme: theme === "light" ? "light" : "dark", deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGEERROR", e.message));
page.on("console", (m) => m.type() === "error" && console.error("CONSOLE", m.text()));
await page.goto(`${base}/login`);
await page.fill('input[name="password"]', process.env.ORBITA_PASSWORD ?? "orbita-dev");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
if (theme === "light") await page.evaluate(() => localStorage.setItem("theme", "light"));
await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: process.env.FULL === "1" });
console.log("ok", out);
await browser.close();
