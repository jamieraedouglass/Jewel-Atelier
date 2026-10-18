import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; const v = args[i + 1]; args.splice(i, 2); return v; };
const rounds = Number(opt("--rounds", "3"));
const notes = opt("--notes", undefined);
const photos = args;
if (!photos.length) { console.error("Give at least one photo: npm run check:recreate -- photo.jpg"); process.exit(1); }
const BASE = process.env.BASE || "http://localhost:3000";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = path.join(process.cwd(), "recreate-check");
mkdirSync(OUT, { recursive: true });

const work = mkdtempSync(path.join(tmpdir(), "recreate-"));
const asJpeg = (file, i) => {
  const out = path.join(work, `photo-${i}.jpg`);
  execFileSync("sips", ["-s", "format", "jpeg", "-Z", "1600", file, "--out", out], { stdio: "ignore" });
  writeFileSync(path.join(OUT, `photo-${i}.jpg`), readFileSync(out));
  return `data:image/jpeg;base64,${readFileSync(out).toString("base64")}`;
};
const photoUrls = photos.map(asJpeg);

const ask = async (body) => {
  const res = await fetch(`${BASE}/api/dev/recreate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
};

const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(path.join(tmpdir(), "chrome-"))}`, "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "about:blank"], { stdio: "ignore" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let tab;
for (let i = 0; i < 40 && !tab; i++) { await wait(250); tab = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" }).then((r) => r.json()).catch(() => null); }
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d.error); pending.delete(d.id); } };
await new Promise((r) => (ws.onopen = r));
const js = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.value;
await send("Emulation.setDeviceMetricsOverride", { width: 900, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: `${BASE}/dev/render` });
await wait(9000);

const shot = async (name) => {
  await wait(5000);
  const res = await send("Page.captureScreenshot", { format: "jpeg", quality: 85 });
  writeFileSync(path.join(OUT, `${name}.jpg`), Buffer.from(res.data, "base64"));
  return `data:image/jpeg;base64,${res.data}`;
};
const steps = [];
const apply = async (r, name) => {
  await js(`window.__apply(${JSON.stringify(r)}) && true`);
  const design = await js("JSON.stringify(window.__design)");
  writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify({ recreation: r, design: JSON.parse(design) }, null, 1));
  steps.push({ name, title: r.title, description: r.description, analysis: r.analysis, base: r.base ? "started from a showcase piece" : "" });
  return { render: await shot(name), design: JSON.parse(design) };
};

try {
  console.log("Rebuilding from the photo…");
  let now = await apply(await ask({ photos: photoUrls, notes }), "round-0");
  console.log("Analysis:\n" + steps[0].analysis + (steps[0].base ? `\n(${steps[0].base})` : ""));
  for (let round = 1; round <= rounds; round++) {
    console.log(`Comparing with the photo (check ${round} of ${rounds})…`);
    const r = await ask({ photos: photoUrls, notes, design: now.design, render: now.render, round });
    steps[steps.length - 1].score = r.score; steps[steps.length - 1].differences = r.differences;
    console.log(`  build ${round - 1} scored ${r.score}/10: ${(r.differences || []).join("; ")}`);
    if (r.score >= 9 || round === rounds) break;
    now = await apply(r, `round-${round}`);
  }
  const photoImgs = photos.map((_, i) => `<figure><img src="photo-${i}.jpg"><figcaption>The photo</figcaption></figure>`).join("");
  const stepImgs = steps.map((s) => `<figure><img src="${s.name}.jpg"><figcaption><b>${s.name === "round-0" ? "First build" : s.name.replace("round-", "After check ")}</b>${s.score != null ? ` · <b>${s.score}/10</b>` : ""} · ${s.title}<br><small>${s.description}${s.differences?.length ? "<br>Still different: " + s.differences.join("; ") : ""}</small></figcaption></figure>`).join("");
  writeFileSync(path.join(OUT, "index.html"), `<!doctype html><meta charset=utf-8><title>Recreate check</title><style>body{margin:0;padding:16px;background:#111;color:#eee;font:14px sans-serif;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}figure{margin:0}img{width:100%;display:block;border-radius:4px}small{color:#aaa}</style>${photoImgs}${stepImgs}`);
  console.log(`Done: open ${path.join(OUT, "index.html")}`);
} finally {
  ws.close(); chrome.kill();
}
