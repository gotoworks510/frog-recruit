/**
 * Capture design screenshots of public + candidate + employer surfaces.
 * Requires: npm run dev on :3005, demo seed, mint-demo-session.
 */
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE = "http://localhost:3005";
const OUT = join(process.cwd(), "tmp/design-shots");
mkdirSync(OUT, { recursive: true });

function loadSession(role) {
  return JSON.parse(readFileSync(join(OUT, `session-${role}.json`), "utf8"));
}

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log("saved", path);
}

async function withSession(browser, role, paths) {
  const sess = loadSession(role);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await context.addCookies([
    {
      name: sess.cookieName,
      value: sess.token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  for (const [url, name] of paths) {
    await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1200);
    await shot(page, name);
  }
  await context.close();
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
});

try {
  // Public
  const pub = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await pub.newPage();
  for (const [url, name] of [
    ["/", "01-landing"],
    ["/login", "02-candidate-login"],
    ["/employer/login", "03-employer-login"],
  ]) {
    await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1200);
    await shot(page, name);
  }
  await pub.close();

  await withSession(browser, "candidate", [
    ["/me", "10-candidate-home"],
    ["/me/profile", "11-candidate-profile"],
    ["/me/preview", "12-candidate-preview"],
  ]);

  await withSession(browser, "employer", [
    ["/portal", "20-employer-portal"],
    ["/portal/candidates/cp-demo-1", "21-employer-candidate-detail"],
  ]);
} finally {
  await browser.close();
}

console.log("done");
