// End to end test in a real browser: three people with fake cameras and
// microphones create profiles, build a den mesh through invite links, chat,
// join voice (audio bytes must flow), share a screen, become friends, talk in
// a direct message with a 1 to 1 call, and reconnect with a verified key.
//
// Usage: node test/app-e2e.mjs [path-to-chromium-browser]
// Uses BROWSER, then common Edge and Chrome install paths.

import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { serve } from '../scripts/serve.mjs';

const candidates = [
  process.argv[2],
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));
if (!executablePath) {
  console.error('e2e: no Chromium based browser found (pass its path or set BROWSER)');
  process.exit(1);
}

const shots = process.env.E2E_SHOTS || '';
if (shots) mkdirSync(shots, { recursive: true });
const port = 8700 + Math.floor(Math.random() * 200);
const server = await serve(port, 'docs');
const base = `http://127.0.0.1:${port}/app/`;
const profileDir = mkdtempSync(join(tmpdir(), 'howlden-e2e-'));
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--auto-select-desktop-capture-source=Entire screen',
    '--auto-accept-this-tab-capture',
    '--enable-features=GetDisplayMediaSetAutoSelectAllScreens',
  ],
});

let step = 0;
const log = (msg) => console.log(`${String(++step).padStart(2, '0')} ${msg}`);
const errors = [];
const ok = (cond, msg) => {
  if (!cond) throw new Error(`check failed: ${msg}`);
};

async function person(name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['microphone', 'camera', 'clipboard-read', 'clipboard-write'], locale: 'en-US' });
  await context.addInitScript(() => {
    // The share sheet has no UI in a headless browser; fall back to copying.
    try {
      delete Navigator.prototype.share;
    } catch {
      // ignore
    }
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${name}: ${m.text()}`);
  });
  await page.goto(base);
  await page.fill('#login-name', name);
  await page.click('.check-btn[aria-label="Wolf"]');
  await page.click('.login-form button[type="submit"]');
  await page.waitForSelector('#app:not([hidden]) .rail');
  return { name, page, context };
}

const evalApp = (p, fn, arg) => p.page.evaluate(fn, arg);

async function inviteLink(p) {
  const input = p.page.locator('.invite-modal .share-side input');
  await input.waitFor({ timeout: 30000 });
  return input.inputValue();
}

async function acceptInvite(guest, link) {
  await guest.page.goto(link);
  await guest.page.waitForSelector('.join-modal');
  const hero = await guest.page.locator('.join-hero').innerText();
  await guest.page.click('.join-modal .btn-block');
  const reply = guest.page.locator('.join-modal .share-side input');
  await reply.waitFor({ timeout: 30000 });
  return { reply: await reply.inputValue(), hero };
}

async function pasteReply(host, reply) {
  await host.page.fill('.invite-modal textarea', reply);
  await host.page.click('.invite-modal button:text-is("Connect")');
  await host.page.waitForSelector('.invite-modal .invite-status.ok', { timeout: 40000 });
  await host.page.waitForSelector('.invite-modal', { state: 'detached', timeout: 5000 });
}

async function waitFor(p, fn, arg, timeout = 30000) {
  await p.page.waitForFunction(fn, arg, { timeout, polling: 250 });
}

async function audioIn(p, peerId) {
  return evalApp(
    p,
    async (id) => {
      const s = window.howlden.activeDen;
      const link = s.mesh.links.get(id);
      return link ? (await link.stats()).audioIn : -1;
    },
    peerId,
  );
}

async function audioFlows(p, peerId, label) {
  const a = await audioIn(p, peerId);
  await p.page.waitForTimeout(1500);
  const b = await audioIn(p, peerId);
  ok(b > a && a >= 0, `${label}: audio bytesReceived grows (${a} then ${b})`);
  return b - a;
}

const shot = async (p, file) => shots && p.page.screenshot({ path: join(shots, file) });

try {
  const ana = await person('Ana');
  const bia = await person('Bia');
  const caio = await person('Caio');
  const ids = {};
  for (const p of [ana, bia, caio]) ids[p.name] = await evalApp(p, () => window.howlden.profile.id);
  log('three profiles created with identity keys');

  // Den and mesh
  await ana.page.click('.home-card');
  await ana.page.fill('#den-name', 'Night owls');
  await ana.page.click('.hl-modal button[type="submit"]');
  let link = await inviteLink(ana);
  ok(link.startsWith(`${base}#i=`), 'invite link format');
  const first = await acceptInvite(bia, link);
  ok(first.hero.includes('Night owls'), 'join screen shows the den');
  await pasteReply(ana, first.reply);
  await waitFor(bia, () => window.howlden.activeDen?.status === 'online');
  log('Bia joined through one invite and one reply');

  await ana.page.click('.main-head button[aria-label="Invite people"]');
  link = await inviteLink(ana);
  const second = await acceptInvite(caio, link);
  await pasteReply(ana, second.reply);
  for (const p of [ana, bia, caio]) await waitFor(p, () => window.howlden.activeDen?.mesh?.links.size === 2);
  log('Caio joined; the host introduced Bia and Caio over data channels (full mesh of 3)');

  // Chat
  await ana.page.fill('.composer-input', 'Hello **pack** <img src=x onerror=alert(1)>');
  await ana.page.press('.composer-input', 'Enter');
  for (const p of [bia, caio]) await waitFor(p, () => [...document.querySelectorAll('.msg-content')].some((e) => e.textContent.includes('Hello pack')));
  ok(!(await bia.page.locator('.msg-content img').count()), 'no HTML injected');
  ok(await bia.page.locator('.msg-content strong').count(), 'markdown bold rendered');
  await caio.page.hover('.msg');
  await caio.page.click('.msg .msg-actions button[aria-label="Add reaction"]');
  await caio.page.click('.reaction-picker button[aria-label="howl"]');
  await waitFor(ana, () => !!document.querySelector('.reaction'));
  await bia.page.fill('.composer-input', '@Ana sounds good');
  await bia.page.keyboard.press('Escape');
  await bia.page.press('.composer-input', 'Enter');
  await waitFor(ana, () => !!document.querySelector('.msg.mentioned'));
  log('messages, markdown, reactions and mentions sync to every member');
  await shot(ana, 'e2e-chat.png');

  // Voice
  for (const p of [ana, bia, caio]) {
    await p.page.click('.ch-row.voice .ch >> nth=0');
    await waitFor(p, () => !!window.howlden.media.current);
  }
  for (const p of [ana, bia, caio]) await waitFor(p, () => document.querySelectorAll('.stage .tile').length === 3, null, 30000);
  await ana.page.waitForTimeout(2500);
  const grew = [];
  for (const [p, q] of [
    [ana, bia],
    [bia, caio],
    [caio, ana],
  ])
    grew.push(await audioFlows(p, ids[q.name], `${p.name} hears ${q.name}`));
  log(`voice: audio flows on every pair (bytesReceived grew by ${grew.join(', ')} bytes in 1.5 s)`);

  const canShare = await evalApp(ana, async () => {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
      return true;
    } catch (e) {
      return e.name;
    }
  });
  if (canShare === true || !process.env.CI) {
    ok(canShare === true, `getDisplayMedia works in this browser (${canShare})`);
    await evalApp(ana, () => window.howlden.media.toggleScreen());
    for (const p of [bia, caio]) await waitFor(p, () => [...document.querySelectorAll('.screen-tile video')].some((v) => v.videoWidth > 0), null, 30000);
    log('screen share from Ana is decoded by Bia and Caio');
  } else {
    log(`screen share skipped: this CI browser has no capture source (${canShare})`);
  }
  await shot(bia, 'e2e-voice.png');
  if (await evalApp(ana, () => !!window.howlden.media.screen)) await evalApp(ana, () => window.howlden.media.toggleScreen());
  for (const p of [ana, bia, caio]) await evalApp(p, () => window.howlden.media.leave());

  // Identity and friends
  for (const [p, q] of [
    [ana, bia],
    [bia, ana],
  ]) {
    await waitFor(p, (id) => window.howlden.activeDen.identityOf(id)?.status === 'verified', ids[q.name]);
    await waitFor(p, (id) => !!window.howlden.friends.get(id), ids[q.name]);
  }
  log('identity proofs verified on every link; members saved as friends');

  // Direct message and 1 to 1 call
  await ana.page.click('.rail-home .rail-btn');
  await ana.page.waitForSelector('.friend');
  await ana.page.click(`.friend:has-text("Bia") button[aria-label="Start a voice call with Bia"]`);
  link = await inviteLink(ana);
  const dm = await acceptInvite(bia, link);
  ok(/Verified friend/.test(dm.hero), 'Bia sees Ana as a verified friend on the call invite');
  await pasteReply(ana, dm.reply);
  await waitFor(bia, () => !!document.querySelector('.call-ring'));
  await bia.page.click('.call-ring button[aria-label="Accept call"]');
  await waitFor(ana, () => window.howlden.activeDen?.isDirect && window.howlden.media.current);
  await waitFor(bia, () => window.howlden.activeDen?.isDirect && window.howlden.media.current);
  await ana.page.waitForTimeout(2500);
  const dmGrew = await audioFlows(bia, ids.Ana, 'Bia hears Ana in the 1 to 1 call');
  await bia.page.fill('.composer-input', 'private hello');
  await bia.page.press('.composer-input', 'Enter');
  await waitFor(ana, () => [...document.querySelectorAll('.msg-content')].some((e) => e.textContent.includes('private hello')));
  log(`direct message and 1 to 1 voice call work (audio grew ${dmGrew} bytes)`);
  await shot(ana, 'e2e-dm-call.png');
  await evalApp(ana, () => window.howlden.media.leave());

  // Reconnect after Bia reloads: the invite shows the verified key and the header gets the badge
  await bia.page.reload();
  await bia.page.waitForSelector('#app:not([hidden]) .rail');
  await waitFor(ana, () => !window.howlden.activeDen.mesh?.links.size);
  await ana.page.click('.main-head button:has-text("Reconnect")');
  link = await inviteLink(ana);
  const again = await acceptInvite(bia, link);
  ok(/Verified friend/.test(again.hero), 'reconnect invite recognized by key');
  await pasteReply(ana, again.reply);
  await waitFor(bia, () => window.howlden.activeDen?.isDirect && window.howlden.activeDen.status === 'online');
  await waitFor(bia, () => !!document.querySelector('.main-head .verified'), null, 20000);
  await waitFor(ana, () => !!document.querySelector('.main-head .verified'), null, 20000);
  log('reconnect: both sides show the verified badge for a known key');
  await shot(bia, 'e2e-verified.png');

  // PIN lock and backup round trip on Caio's account
  const before = await evalApp(caio, () => ({ id: window.howlden.profile.id, msgs: [...window.howlden.sessions.values()].reduce((n, s) => n + s.messages.size, 0) }));
  await evalApp(caio, () => window.howlden.account.setPin('2468', window.howlden.profile));
  const sealed = await evalApp(caio, () => new Promise((resolve) => {
    const req = indexedDB.open('howlden');
    req.onsuccess = () => {
      const tx = req.result.transaction('messages').objectStore('messages').getAll();
      tx.onsuccess = () => resolve(tx.result.every((r) => r.sealed && !('text' in r)));
    };
  }));
  ok(sealed, 'messages are sealed at rest with the PIN key');
  await caio.page.reload();
  await caio.page.waitForSelector('#pin');
  await caio.page.fill('#pin', '1111');
  await caio.page.click('.login-card button[type="submit"]');
  await caio.page.waitForSelector('.form-error:not(:empty)');
  await caio.page.fill('#pin', '2468');
  await caio.page.click('.login-card button[type="submit"]');
  await caio.page.waitForSelector('#app:not([hidden]) .rail');
  const after = await evalApp(caio, () => ({ id: window.howlden.profile.id, msgs: [...window.howlden.sessions.values()].reduce((n, s) => n + s.messages.size, 0) }));
  ok(after.id === before.id && after.msgs === before.msgs && after.msgs > 0, `PIN unlock restores the account and history ${JSON.stringify([before, after])}`);
  const backup = await evalApp(caio, () => window.howlden.account.exportAccount('backup password', window.howlden.profile));
  const dan = await browser.newContext({ locale: 'en-US' }).then((c) => c.newPage());
  await dan.goto(base);
  await dan.waitForSelector('#login-name');
  await dan.evaluate(([text]) => window.howlden.restoreAccount(text, 'backup password'), [backup]);
  await dan.waitForSelector('#app:not([hidden]) .rail');
  const moved = await dan.evaluate(() => [window.howlden.profile.id, window.howlden.identity.id, window.howlden.friends.list().length]);
  ok(moved[0] === before.id && moved[1] === before.id && moved[2] >= 2, 'backup moves the identity and friends to a new browser');
  log('PIN lock seals local data and unlocks; the encrypted backup moves the account');

  const real = errors.filter((e) => !/favicon|net::ERR_|Failed to load resource/.test(e));
  ok(!real.length, `no console errors:\n${real.join('\n')}`);
  log('no console errors');
  console.log('e2e: all checks passed');
} catch (err) {
  console.error(err.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
  rmSync(profileDir, { recursive: true, force: true });
}
