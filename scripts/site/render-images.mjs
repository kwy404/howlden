// Renders the social images: one Open Graph card per page (docs/og.png and
// docs/og/*.png, 1200 by 630) and the GitHub social preview
// (assets/social-preview.png, 1280 by 640). Uses playwright-core with a local
// Chromium based browser (Edge on Windows by default, or BROWSER=path).
// Usage: node scripts/site/render-images.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { cardHtml } from './banners.mjs';
import { mascotHead } from './art.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const here = join(root, 'scripts', 'site');
const browserPath = process.env.BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
if (!browserPath) throw new Error('no browser found: set BROWSER to a Chromium based browser');

const head = `data:image/svg+xml,${encodeURIComponent(mascotHead('dark'))}`;
const meta = (dir) => readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => JSON.parse(/^<!--meta\n([\s\S]*?)\n-->/.exec(readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n'))[1]));

const jobs = [
  { out: 'docs/og.png', size: [1200, 630], title: 'Group chat for your pack. No server in sight.', sub: 'Text and voice channels, video and screen share in your browser. No email, no password, no phone.', kind: '', sceneName: 'campfire-voice' },
  { out: 'docs/og/guides.png', size: [1200, 630], title: 'Guides from the den', sub: 'Private group chat, voice and video in the browser, explained in plain words.', kind: 'Guides', sceneName: 'moonlit-den' },
  { out: 'assets/social-preview.png', size: [1280, 640], title: 'Group chat for your pack. No server in sight.', sub: 'Serverless peer to peer chat, voice and video in the browser. End to end encrypted, invite only.', kind: 'Open source', sceneName: 'campfire-voice' },
];
for (const m of [...meta(join(here, 'guides')), ...meta(join(here, 'guides', 'pt'))]) {
  const pt = m.lang === 'pt-BR';
  jobs.push({ out: `docs/og/${m.slug.replace('/', '-')}.png`, size: [1200, 630], title: m.h1, sub: m.lede.replace(/<[^>]+>/g, ''), kind: pt ? 'Guia' : 'Guide', sceneName: m.scene, pills: pt ? ['Sem conta', 'Criptografia ponta a ponta', 'Só com convite'] : undefined });
}

mkdirSync(join(root, 'docs', 'og'), { recursive: true });
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
for (const job of jobs) {
  const page = await browser.newPage({ viewport: { width: job.size[0], height: job.size[1] } });
  await page.setContent(cardHtml({ ...job, head }), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(root, job.out) });
  await page.close();
  console.log(`rendered ${job.out}`);
}
await browser.close();
