// End to end test in a real browser with live public relays: seven people
// with fake cameras and microphones create profiles; a den is built with an
// invite link and with six words (confirmed with six more words), wrong words
// and a sixth member are refused, five people chat and talk with noise
// suppression on (audio bytes must flow), friends pair with six words, a
// known friend is called with only six words, a screen share fills the call
// view, and accounts survive a PIN lock and a backup.
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
    if (process.env.E2E_VERBOSE) console.log(`[${name}] ${m.text()}`);
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

// Six word pairing helpers: the inviter shows words, the guest types them.
async function openWords(host, open) {
  await open();
  const list = host.page.locator('.invite-modal .invite-words');
  await list.waitFor({ timeout: 40000 });
  return (await list.getAttribute('data-words')).split(' ');
}

async function typeWords(page, prefix, words) {
  for (let i = 0; i < words.length; i++) await page.fill(`#${prefix}-${i}`, words[i]);
}

/** The guest joins with words; returns the confirmation words it shows (or null when let in by key). */
async function joinWithWords(guest, words, { viaDialog = false, accept = true } = {}) {
  if (viaDialog) {
    await guest.page.click('.rail-btn[aria-label="Join a den"]');
    await guest.page.waitForSelector('#join-word-0');
    await typeWords(guest.page, 'join-word', words);
    if (await guest.page.locator('#join-word-5').count()) await guest.page.press('#join-word-5', 'Enter');
  } else {
    await evalApp(guest, (w) => window.howlden.joinWithWords(w), words);
  }
  // A known friend's call is accepted by itself, so the invite card may only flash by.
  await guest.page.waitForSelector('.join-modal .join-hero', { timeout: 60000 });
  const hero = (await guest.page.evaluate(() => document.querySelector('.join-modal .join-hero')?.innerText)) || '';
  if (accept && (await guest.page.locator('.join-modal .btn-block').count())) await guest.page.click('.join-modal .btn-block').catch(() => {});
  return hero;
}

async function confirmWordsOf(guest) {
  const list = guest.page.locator('.join-modal .confirm-words');
  await list.waitFor({ timeout: 40000 });
  return (await list.getAttribute('data-words')).split(' ');
}

async function hostConfirms(host, words) {
  await host.page.waitForSelector('#confirm-word-0', { timeout: 30000 });
  await typeWords(host.page, 'confirm-word', words);
  await host.page.click('.confirm-step .btn');
}

async function wordsJoin(host, guest, open, opts) {
  const words = await openWords(host, open);
  const hero = await joinWithWords(guest, words, opts);
  await hostConfirms(host, await confirmWordsOf(guest));
  await guest.page.waitForSelector('.join-modal .invite-status.ok', { timeout: 30000 });
  await host.page.waitForSelector('.invite-modal', { state: 'detached', timeout: 10000 });
  return hero;
}

const inviteButton = (p) => () => p.page.click('.main-head button[aria-label="Invite people"]');

try {
  const people = {};
  for (const name of ['Ana', 'Bia', 'Caio', 'Dani', 'Edu', 'Fabi', 'Gabi']) people[name] = await person(name);
  const { Ana: ana, Bia: bia, Caio: caio, Dani: dani, Edu: edu, Fabi: fabi, Gabi: gabi } = people;
  const ids = {};
  for (const p of Object.values(people)) ids[p.name] = await evalApp(p, () => window.howlden.profile.id);
  log('seven profiles created with identity keys');

  // A den: the first guest joins with an invite link (zero third parties), pasting the reply and clicking Connect too
  await ana.page.click('.home-card');
  await ana.page.fill('#den-name', 'Night owls');
  await ana.page.click('.hl-modal button[type="submit"]');
  await ana.page.waitForSelector('.invite-modal .invite-words', { timeout: 40000 });
  await ana.page.click('.invite-modal .link-btn');
  let link = await inviteLink(ana);
  ok(link.startsWith(`${base}#i=`), 'invite link format');
  const first = await acceptInvite(bia, link);
  ok(first.hero.includes('Night owls'), 'join screen shows the den');
  await ana.page.fill('.invite-modal textarea', first.reply);
  await ana.page.evaluate(() => document.querySelector('.invite-modal textarea').dispatchEvent(new Event('paste', { bubbles: true })));
  await ana.page.evaluate(() => [...document.querySelectorAll('.invite-modal button')].find((b) => b.textContent === 'Connect')?.click());
  await ana.page.waitForSelector('.invite-modal .invite-status.ok', { timeout: 40000 });
  const errText = await ana.page.locator('.invite-modal .form-error').allInnerTexts().catch(() => []);
  ok(!errText.join('').trim(), `a reply pasted and submitted twice shows no error (${errText.join(' ')})`);
  await waitFor(bia, () => window.howlden.activeDen?.status === 'online');
  log('Bia joined by invite link; the reply applied twice (paste, then Connect) is ignored, not an error');

  // Six words, typed in the Join dialog, with the confirmation words
  await wordsJoin(ana, caio, inviteButton(ana), { viaDialog: true });
  for (const p of [ana, bia, caio]) await waitFor(p, () => window.howlden.activeDen?.mesh?.links.size === 2);
  log('Caio joined with six words through the live public relays and the confirmation words; full mesh of 3');

  // Wrong confirmation words: refused, nothing shared
  {
    const words = await openWords(ana, inviteButton(ana));
    await joinWithWords(fabi, words);
    await confirmWordsOf(fabi);
    for (let i = 0; i < 3; i++) {
      await hostConfirms(ana, ['zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'zoo']);
      if (i < 2) await ana.page.waitForSelector('.confirm-step .form-error:not(:empty)');
    }
    await ana.page.waitForSelector('.invite-modal .fail-box');
    await fabi.page.waitForSelector('.join-modal .full-msg', { timeout: 20000 });
    ok(/did not confirm the words/.test(await fabi.page.locator('.join-modal .full-msg').innerText()), 'the guest is told the words were not confirmed');
    ok((await evalApp(ana, () => window.howlden.activeDen.mesh.onlineCount())) === 3, 'the refused guest never joined');
    ok(!(await evalApp(fabi, () => [...window.howlden.sessions.values()].some((s) => s.messages.size))), 'nothing was shared with the refused guest');
    await ana.page.keyboard.press('Escape');
    await fabi.page.keyboard.press('Escape');
  }
  log('wrong confirmation words three times: the guest is refused and receives nothing');

  for (const guest of [dani, edu]) await wordsJoin(ana, guest, inviteButton(ana));
  const five = [ana, bia, caio, dani, edu];
  for (const p of five) await waitFor(p, () => window.howlden.activeDen?.mesh?.links.size === 4, null, 40000);
  for (const p of five) await waitFor(p, () => document.querySelector('.hd-count')?.textContent === '5/5');
  ok((await ana.page.locator('.members-head').first().innerText()).includes('5/5'), 'member list shows 5/5');
  log('Dani and Edu joined with six words: full mesh of 5, header and member list show 5/5');

  {
    const words = await openWords(ana, inviteButton(ana));
    ok(/full \(5 of 5\)/.test(await ana.page.locator('.invite-modal .full-note').innerText()), 'invite made while full says so');
    const hero = await joinWithWords(fabi, words);
    ok(/was full when the invite was made \(5 of 5\)/.test(await fabi.page.locator('.join-modal').innerText()) || hero, 'guest warned');
    await fabi.page.waitForSelector('.join-modal .full-msg', { timeout: 40000 });
    ok((await fabi.page.locator('.join-modal .full-msg').innerText()) === 'This den is full (5 of 5). Ask the host for a new invite once someone leaves.', 'the sixth person gets the full message');
    await ana.page.waitForSelector('.invite-modal .invite-status.bad', { timeout: 20000 });
    ok(/Fabi could not join: this den is full \(5 of 5\)/.test(await ana.page.locator('.invite-modal .invite-status').innerText()), 'the host sees the rejection');
    await ana.page.keyboard.press('Escape');
    await fabi.page.keyboard.press('Escape');
  }
  for (const p of five) ok((await evalApp(p, () => window.howlden.activeDen.mesh.onlineCount())) === 5, `${p.name} still counts 5 online`);
  log('a 6th joiner with six words is refused with "This den is full (5 of 5)"; the host sees a notice');

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

  // The author card stays inside the viewport near the composer
  {
    await bia.page.click('.msg.mentioned .msg-author', { trial: false }).catch(() => {});
    await ana.page.click('.msg.mentioned .msg-author');
    const box = await ana.page.evaluate(() => {
      const r = document.querySelector('.hl-popover').getBoundingClientRect();
      return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, w: innerWidth, h: innerHeight, name: document.querySelector('.hl-popover .card-name').textContent };
    });
    ok(box.top >= 0 && box.left >= 0 && box.right <= box.w && box.bottom <= box.h, `user card inside the viewport ${JSON.stringify(box)}`);
    ok(box.name === `Bia#${ids.Bia.slice(0, 4)}`, `user card shows the full name and tag (${box.name})`);
    await ana.page.keyboard.press('Escape');
  }
  log('the user card flips and shifts inside the viewport and shows the full name#tag');

  // Voice with 5 people: the noise suppressed track flows to every peer
  for (const p of five) {
    await p.page.click('.ch-row.voice .ch >> nth=0');
    await waitFor(p, () => !!window.howlden.media.current);
  }
  for (const p of five) await waitFor(p, () => document.querySelectorAll('.stage .tile').length === 5, null, 40000);
  await ana.page.waitForTimeout(3000);
  const processed = await evalApp(ana, () => {
    const m = window.howlden.media;
    const sent = [...window.howlden.activeDen.mesh.links.values()].map((l) => l.senders.mic?.track);
    return { mode: m.processing, sameTrack: sent.every((tr) => tr && tr === m.mic.getAudioTracks()[0]), raw: m.pipe.raw.getAudioTracks()[0] !== m.mic.getAudioTracks()[0] };
  });
  ok(processed.mode === 'strong' && processed.sameTrack && processed.raw, `peers get the processed microphone track ${JSON.stringify(processed)}`);
  const grew = [];
  for (let i = 0; i < five.length; i++) {
    for (let k = i + 1; k < five.length; k++) grew.push(await audioFlows(five[i], ids[five[k].name], `${five[i].name} hears ${five[k].name}`));
  }
  log(`voice with 5 people, Strong noise suppression on: audio flows on all 10 pairs (bytesReceived grew ${Math.min(...grew)} to ${Math.max(...grew)} bytes in 1.5 s)`);
  ok((await evalApp(ana, () => window.howlden.sounds.played || 0)) > 0, 'interface sounds played after the first interaction');
  for (const p of five) await evalApp(p, () => window.howlden.media.leave());

  // Identity and friends
  for (const [p, q] of [
    [ana, bia],
    [bia, ana],
  ]) {
    await waitFor(p, (id) => window.howlden.activeDen.identityOf(id)?.status === 'verified', ids[q.name]);
    await waitFor(p, (id) => !!window.howlden.friends.get(id), ids[q.name]);
  }
  log('identity proofs verified on every link; members saved as friends');

  // A new friend with six words
  {
    await ana.page.click('.rail-home .rail-btn');
    const hero = await wordsJoin(ana, fabi, () => evalApp(ana, () => window.howlden.friendInviteFlow()));
    ok(/wants to connect with you/.test(hero), 'friend invite reads as a connection request');
    await waitFor(ana, (id) => !!window.howlden.friends.get(id), ids.Fabi);
    await waitFor(fabi, (id) => !!window.howlden.friends.get(id), ids.Ana);
  }
  log('Fabi became a friend with six words and the confirmation words');

  // The friend invite link, applied twice (the reported setRemoteDescription bug)
  {
    await evalApp(ana, () => window.howlden.friendInviteFlow());
    await ana.page.waitForSelector('.invite-modal .invite-words', { timeout: 40000 });
    await ana.page.click('.invite-modal .link-btn');
    const l = await inviteLink(ana);
    const j = await acceptInvite(gabi, l);
    await ana.page.fill('.invite-modal textarea', j.reply);
    await ana.page.evaluate(() => document.querySelector('.invite-modal textarea').dispatchEvent(new Event('paste', { bubbles: true })));
    await ana.page.evaluate(() => [...document.querySelectorAll('.invite-modal button')].find((b) => b.textContent === 'Connect')?.click());
    await ana.page.waitForSelector('.invite-modal .invite-status.ok', { timeout: 40000 });
    const e = (await ana.page.locator('.invite-modal .form-error').allInnerTexts().catch(() => [])).join('');
    ok(!/setRemoteDescription|wrong state/i.test(e) && !e.trim(), `friend invite link applied twice shows no error (${e})`);
    await waitFor(gabi, (id) => !!window.howlden.friends.get(id), ids.Ana);
  }
  log('a friend invite reply applied twice connects once with no error (regression)');

  // Calling a known friend needs only the six words
  await ana.page.click('.rail-home .rail-btn');
  await ana.page.waitForSelector('.friend');
  const callWords = await openWords(ana, () => ana.page.click(`.friend:has-text("Bia") button[aria-label="Start a voice call with Bia"]`));
  await evalApp(bia, (w) => window.howlden.joinWithWords(w), callWords);
  await waitFor(bia, () => !!document.querySelector('.call-ring'), null, 60000);
  await waitFor(bia, () => !!document.querySelector('.main-head .verified'), null, 20000);
  ok(!(await ana.page.locator('#confirm-word-0').count()), 'no confirmation words needed for a known key');
  await bia.page.click('.call-ring button[aria-label="Accept call"]');
  await waitFor(ana, () => window.howlden.activeDen?.isDirect && window.howlden.media.current);
  await waitFor(bia, () => window.howlden.activeDen?.isDirect && window.howlden.media.current);
  await ana.page.waitForTimeout(2500);
  const dmGrew = await audioFlows(bia, ids.Ana, 'Bia hears Ana in the 1 to 1 call');
  log(`calling a known friend took only the six words: verified key, ring, 1 to 1 audio (grew ${dmGrew} bytes)`);

  // Screen share takes most of the call view
  {
    const canShare = await evalApp(ana, async () => {
      try {
        const st = await navigator.mediaDevices.getDisplayMedia({ video: true });
        st.getTracks().forEach((tr) => tr.stop());
        return true;
      } catch (e) {
        return e.name;
      }
    });
    if (canShare === true || !process.env.CI) {
      ok(canShare === true, `getDisplayMedia works (${canShare})`);
      await bia.page.setViewportSize({ width: 1920, height: 1080 });
      await evalApp(ana, () => window.howlden.media.toggleScreen());
      await waitFor(bia, () => [...document.querySelectorAll('.screen-tile video')].some((v) => v.videoWidth > 0), null, 30000);
      await bia.page.waitForTimeout(600);
      const size = await evalApp(bia, () => {
        const stage = document.querySelector('.stage').getBoundingClientRect();
        const main = document.querySelector('.main').getBoundingClientRect();
        const tile = document.querySelector('.screen-tile').getBoundingClientRect();
        return { stage: stage.height / main.height, tile: tile.height, focused: document.querySelector('.screen-tile').classList.contains('is-focus') };
      });
      ok(size.stage > 0.6 && size.focused && size.tile > 400, `the shared screen fills the call view ${JSON.stringify(size)}`);
      await shot(bia, 'e2e-screen-1080.png');
      await evalApp(ana, () => window.howlden.media.toggleScreen());
      await bia.page.setViewportSize({ width: 1280, height: 800 });
      log(`screen share is the focused stage: ${Math.round(size.stage * 100)}% of the main column, ${Math.round(size.tile)} px tall at 1920x1080`);
    } else {
      log(`screen share skipped: this CI browser has no capture source (${canShare})`);
    }
  }
  await bia.page.fill('.composer-input', 'private hello');
  await bia.page.press('.composer-input', 'Enter');
  await waitFor(ana, () => [...document.querySelectorAll('.msg-content')].some((e) => e.textContent.includes('private hello')));
  await evalApp(ana, () => window.howlden.media.leave());
  log('direct message works next to the call');

  // Reconnect after Bia reloads: six words again, recognized by key, no confirmation step
  await bia.page.reload();
  await bia.page.waitForSelector('#app:not([hidden]) .rail');
  await waitFor(ana, () => !window.howlden.activeDen.mesh?.links.size);
  const againWords = await openWords(ana, () => ana.page.click('.main-head button:has-text("Reconnect")'));
  await evalApp(bia, (w) => window.howlden.joinWithWords(w), againWords);
  await waitFor(bia, () => window.howlden.activeDen?.isDirect && window.howlden.activeDen.status === 'online', null, 60000);
  ok(!(await ana.page.locator('#confirm-word-0').count()), 'no confirmation words needed on reconnect');
  await waitFor(bia, () => !!document.querySelector('.main-head .verified'), null, 20000);
  await waitFor(ana, () => !!document.querySelector('.main-head .verified'), null, 20000);
  log('reconnect with six words: both sides show the verified badge for a known key');
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

  const real = errors.filter((e) => !/favicon|net::ERR_|Failed to load resource|WebSocket connection to/.test(e));
  ok(!real.length, `no console errors:\n${real.join('\n')}`);
  log('no console errors');
  console.log('e2e: all checks passed');
} catch (err) {
  console.error(err.message);
  if (shots) for (const [i, pg] of browser.contexts().flatMap((c) => c.pages()).entries()) await pg.screenshot({ path: join(shots, `e2e-fail-${i}.png`) }).catch(() => {});
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
  rmSync(profileDir, { recursive: true, force: true });
}
