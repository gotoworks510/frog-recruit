const { chromium } = require("playwright-core");
const path = require("path");

const HIDE_CSS = `
nextjs-portal,
[data-next-badge-root],
[data-next-badge],
#__next-build-watcher,
[data-nextjs-toast],
[data-nextjs-dialog-overlay],
[data-nextjs-dev-overlay] {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
`;

(async () => {
  const outDir = path.join(process.cwd(), "public", "guide");
  const browser = await chromium
    .launch({ channel: "chrome", headless: true })
    .catch(() => chromium.launch({ channel: "msedge", headless: true }));
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  for (const s of [
    { url: "http://localhost:3005/demo/employer", file: "employer-list.png" },
    {
      url: "http://localhost:3005/demo/employer/candidate",
      file: "employer-detail.png",
    },
    { url: "http://localhost:3005/demo/candidate", file: "candidate-home.png" },
  ]) {
    await page.goto(s.url, { waitUntil: "networkidle", timeout: 60000 });
    await page.addStyleTag({ content: HIDE_CSS });
    await page.evaluate(() => {
      document
        .querySelectorAll(
          "nextjs-portal, [data-next-badge-root], [data-next-badge]",
        )
        .forEach((el) => el.remove());
    });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(outDir, s.file),
      fullPage: false,
    });
    console.log("wrote", s.file);
  }

  await browser.close();
  console.log("SHOTS_OK");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
