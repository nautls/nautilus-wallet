/**
 * Composes the Chrome Web Store listing images from the raw captures made by `capture.spec.ts`:
 *  - 5 screenshots at 1280x800
 *  - small promo tile at 440x280
 *  - marquee promo tile at 1400x560
 *
 * Output is JPEG, since the store rejects PNGs with an alpha channel.
 */
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test, type Page } from "@playwright/test";

const ROOT = path.resolve(import.meta.dirname, "../..");
const RAW_DIR = path.resolve(import.meta.dirname, "out/raw");
const OUT_DIR = path.resolve(import.meta.dirname, "out/store");

const dataUri = (file: string, mime: string) =>
  `data:${mime};base64,${readFileSync(file).toString("base64")}`;
const raw = (name: string) => dataUri(path.join(RAW_DIR, `${name}.png`), "image/png");
const font = (weight: string) =>
  dataUri(path.join(ROOT, `src/assets/fonts/OpenSans-${weight}.woff2`), "font/woff2");
const LOGO = dataUri(path.join(ROOT, "public/icons/app/logo.svg"), "image/svg+xml");

const CSS = `
@font-face { font-family: "Open Sans"; font-weight: 400; src: url(${font("Regular")}); }
@font-face { font-family: "Open Sans"; font-weight: 600; src: url(${font("SemiBold")}); }
@font-face { font-family: "Open Sans"; font-weight: 700; src: url(${font("Bold")}); }
:root {
  --bg: #030712;
  --bg-2: #0b1324;
  --ink: #f8fafc;
  --muted: #94a3b8;
  --amber: #ffad0a;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; }
body {
  font-family: "Open Sans", sans-serif;
  color: var(--ink);
  background:
    radial-gradient(900px 600px at 85% 30%, rgba(255, 173, 10, 0.14), transparent 60%),
    radial-gradient(800px 700px at 0% 100%, rgba(56, 189, 248, 0.10), transparent 60%),
    linear-gradient(160deg, var(--bg-2), var(--bg));
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}
.brand { display: flex; align-items: center; gap: 14px; font-weight: 700; font-size: 22px; }
.brand img { width: 44px; height: 44px; }
.brand span { color: var(--ink); letter-spacing: 0.2px; }
h1 { font-weight: 700; letter-spacing: -1px; line-height: 1.08; }
h1 em { font-style: normal; color: var(--amber); }
p.sub { color: var(--muted); line-height: 1.5; }
.device {
  border-radius: 28px;
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.10),
    0 30px 80px rgba(0, 0, 0, 0.55),
    0 0 120px rgba(255, 173, 10, 0.10);
}
.device img { display: block; width: 100%; height: 100%; }
ul.points { list-style: none; display: grid; gap: 14px; }
ul.points li { display: flex; gap: 12px; align-items: baseline; color: #cbd5e1; font-size: 20px; }
ul.points li::before {
  content: ""; flex: none; width: 8px; height: 8px; border-radius: 50%;
  background: var(--amber); transform: translateY(-3px);
}
`;

type Shot = {
  file: string;
  title: string;
  sub: string;
  points: string[];
  capture: string;
};

const SHOTS: Shot[] = [
  {
    file: "1-assets",
    title: "Your Ergo assets,<br><em>at a glance.</em>",
    sub: "ERG and every token you hold, with live fiat value.",
    points: [
      "Tokens and NFT collectibles",
      "Multiple addresses, one balance",
      "Light and dark themes"
    ],
    capture: "dark-assets"
  },
  {
    file: "2-send",
    title: "Send ERG and tokens<br><em>in one transaction.</em>",
    sub: "Bundle several assets into a single transfer and pick your fee.",
    points: ["Send many tokens at once", "Adjustable network fee", "Pay fees in supported tokens"],
    capture: "light-send"
  },
  {
    file: "3-connect",
    title: "Connect to<br><em>Ergo dApps.</em>",
    sub: "Choose which wallet each site can see. Nothing is shared until you say so.",
    points: ["EIP-12 dApp connector", "Per-site wallet selection", "Revoke access any time"],
    capture: "dark-connect"
  },
  {
    file: "4-sign",
    title: "Know exactly<br><em>what you sign.</em>",
    sub: "A clear summary of every asset leaving your wallet, before you approve.",
    points: ["Assets leaving your wallet", "Recipient addresses", "Network fee"],
    capture: "light-sign"
  },
  {
    file: "5-wallets",
    title: "All your wallets,<br><em>side by side.</em>",
    sub: "Standard, read-only and hardware wallets, one click apart.",
    points: [
      "Hardware wallet support",
      "Watch-only wallets from a public key",
      "Open source, no tracking"
    ],
    capture: "dark-wallets"
  }
];

async function render(page: Page, html: string, width: number, height: number, out: string) {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<!doctype html><html><head><style>${CSS}</style></head><body>${html}</body></html>`
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("load");
  await page.screenshot({ path: path.join(OUT_DIR, out), type: "jpeg", quality: 95 });
}

test.use({ deviceScaleFactor: 1 });
test.beforeAll(() => mkdirSync(OUT_DIR, { recursive: true }));

for (const shot of SHOTS) {
  test(`screenshot ${shot.file}`, async ({ page }) => {
    const html = `
      <div style="display:flex; height:100%; padding:0 96px 0 104px; align-items:center; gap:72px">
        <div style="flex:1; display:flex; flex-direction:column; gap:28px">
          <div class="brand"><img src="${LOGO}"><span>Nautilus Wallet</span></div>
          <h1 style="font-size:60px">${shot.title}</h1>
          <p class="sub" style="font-size:22px; max-width:520px">${shot.sub}</p>
          <ul class="points" style="margin-top:8px">${shot.points.map((p) => `<li>${p}</li>`).join("")}</ul>
        </div>
        <div class="device" style="flex:none; width:380px; height:680px">
          <img src="${raw(shot.capture)}">
        </div>
      </div>`;

    await render(page, html, 1280, 800, `screenshot-${shot.file}.jpg`);
  });
}

test("small promo tile", async ({ page }) => {
  const html = `
    <div style="height:100%; display:flex; flex-direction:column; justify-content:center; gap:18px; padding:0 36px">
      <div style="display:flex; align-items:center; gap:16px">
        <img src="${LOGO}" style="width:72px; height:72px">
        <h1 style="font-size:36px; letter-spacing:-0.5px">Nautilus<br><em>Wallet</em></h1>
      </div>
      <p class="sub" style="font-size:18px; color:#cbd5e1">The open-source wallet<br>for the Ergo Platform.</p>
    </div>`;

  await render(page, html, 440, 280, "promo-small-440x280.jpg");
});

test("marquee promo tile", async ({ page }) => {
  const html = `
    <div style="display:flex; height:100%; padding:0 0 0 96px; align-items:center; gap:56px">
      <div style="flex:1; display:flex; flex-direction:column; gap:24px">
        <div class="brand"><img src="${LOGO}"><span>Nautilus Wallet</span></div>
        <h1 style="font-size:54px">Your keys. Your assets.<br><em>Roam the Ergo seas.</em></h1>
        <p class="sub" style="font-size:21px; max-width:620px">Open source, privacy first, with hardware wallet and dApp support.</p>
      </div>
      <div style="flex:none; position:relative; width:640px; height:100%">
        <div class="device" style="position:absolute; left:40px; top:120px; width:300px; height:537px">
          <img src="${raw("light-assets")}">
        </div>
        <div class="device" style="position:absolute; left:280px; top:48px; width:300px; height:537px">
          <img src="${raw("dark-assets")}">
        </div>
      </div>
    </div>`;

  await render(page, html, 1400, 560, "promo-marquee-1400x560.jpg");
});
