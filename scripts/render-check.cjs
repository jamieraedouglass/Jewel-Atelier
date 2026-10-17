const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = path.join(process.cwd(), "render-check");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || undefined,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1300, height: 860 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/design?type=ring`);
  await page.waitForTimeout(8000);
  const categories = await page.$$eval('[aria-label="Showcase category"] button', (bs) => bs.map((b) => b.textContent));
  const pieces = [];
  for (const cat of categories) {
    await page.click(`[aria-label="Showcase category"] button:has-text("${cat}")`);
    const names = await page.$$eval("#showcase option", (os) => os.map((o) => o.textContent).filter((t) => t && !t.startsWith("Choose")));
    for (const name of names) if (!pieces.some((p) => p.name === name)) pieces.push({ cat, name });
  }
  await page.click('button:has-text("Pause")');
  const results = [];
  for (const [i, { cat, name }] of pieces.entries()) {
    const before = errors.length;
    await page.click(`[aria-label="Showcase category"] button:has-text("${cat}")`);
    await page.selectOption("#showcase", { label: name });
    await page.waitForTimeout(6500);
    const file = `${String(i).padStart(2, "0")}.png`;
    const box = await page.locator("canvas").first().boundingBox();
    await page.screenshot({ path: path.join(OUT, file), clip: box, timeout: 120000 });
    const stats = await page.evaluate(async (src) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement("canvas"); c.width = 200; c.height = Math.round((200 * img.height) / img.width);
      const x = c.getContext("2d"); x.drawImage(img, 0, 0, c.width, c.height);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let lit = 0, black = 0, n = d.length / 4;
      for (let k = 0; k < d.length; k += 4) { const l = (d[k] + d[k + 1] + d[k + 2]) / 3; if (l > 90) lit++; if (l < 6) black++; }
      return { lit: lit / n, black: black / n };
    }, `data:image/png;base64,${fs.readFileSync(path.join(OUT, file)).toString("base64")}`);
    const problems = [];
    if (errors.length > before) problems.push(`page error: ${errors.slice(before).join("; ")}`);
    if (stats.lit < 0.004) problems.push("nothing visible drawn");
    if (stats.black > 0.25) problems.push("large black areas (stones or background rendering black)");
    results.push({ name, file, problems, ...stats });
    console.log(`${problems.length ? "✗" : "✓"} ${name}${problems.length ? "  — " + problems.join(", ") : ""}`);
  }
  await browser.close();
  const html = `<!doctype html><meta charset="utf-8"><title>Render check</title><style>body{font:14px system-ui;background:#111;color:#eee;margin:20px}div{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}figure{margin:0}img{width:100%;border-radius:8px}figcaption{padding:4px 0}.bad{color:#ff7b7b}</style>
<h1>Render check · ${new Date().toLocaleString()}</h1><div>${results.map((r) => `<figure><img src="${r.file}"><figcaption class="${r.problems.length ? "bad" : ""}">${r.name}${r.problems.length ? "<br>" + r.problems.join("<br>") : ""}</figcaption></figure>`).join("")}</div>`;
  fs.writeFileSync(path.join(OUT, "index.html"), html);
  const bad = results.filter((r) => r.problems.length);
  console.log(`\n${results.length - bad.length}/${results.length} pieces look fine. Contact sheet: render-check/index.html`);
  process.exit(bad.length ? 1 : 0);
})();
