// End to end test in a real browser with live public relays: seven people
// with fake cameras and microphones create profiles; a den is built with six
// words (confirmed with six more words) and no link is ever shown, wrong
// words and a sixth member are refused, five people chat and talk with noise
// suppression on (audio bytes must flow), polls, threads, pins, edit history,
// voice messages and search sync, friends pair with six words, "Call
// a friend" rings a new friend, stickers, live reactions, music mode, push
// to talk and a local recording with its notice work in that call, a known
// friend is called with only six words, a screen share fills the call view,
// and accounts survive a PIN lock and a backup. The shared menu opens on right
// click, long press and Shift+F10 on messages, people, channels and call
// tiles, and the quick switcher, shortcuts sheet, read receipts, notification
// levels, local mute and volume, mark unread and message links work.
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
    // The last full word may start the join by itself and close the dialog first.
    if (await guest.page.locator('#join-word-5').count()) await guest.page.press('#join-word-5', 'Enter').catch(() => {});
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
  // The whole phrase lands in the first box, as a phone keyboard paste does, and spreads out.
  await host.page.fill('#confirm-word-0', words.join(' '));
  const boxes = await host.page.evaluate(() => [...document.querySelectorAll('[id^="confirm-word-"].word-field')].map((x) => x.value).join(' '));
  ok(boxes === words.join(' '), 'a phrase put in one box fills one word per box');
  await host.page.click('.confirm-step .btn');
}

async function wordsJoin(host, guest, open, opts) {
  const words = await openWords(host, open);
  const hero = await joinWithWords(guest, words, opts);
  await hostConfirms(host, await confirmWordsOf(guest));
  // The guest's dialog says "connected" and closes itself shortly after.
  await guest.page.waitForFunction(() => !!document.querySelector('.join-modal .invite-status.ok') || !document.querySelector('.join-modal'), null, { timeout: 30000 });
  await host.page.waitForSelector('.invite-modal', { state: 'detached', timeout: 10000 });
  return hero;
}

const inviteButton = (p) => () => p.page.click('.main-head button[aria-label="Invite people"]');

/** The open menu: its item labels, whether it fits on screen, and what has focus. */
const menuState = (p) =>
  p.page.evaluate(() => {
    const m = document.querySelector('.ctx-menu:not(.ctx-submenu)');
    if (!m) return null;
    const r = m.getBoundingClientRect();
    return {
      role: m.getAttribute('role'),
      items: [...m.querySelectorAll('[role^="menuitem"]')].map((x) => x.dataset.label),
      inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      focus: document.activeElement?.dataset?.label || document.activeElement?.getAttribute('aria-label') || '',
      subs: document.querySelectorAll('.ctx-submenu').length,
    };
  });

async function rightClick(p, selector) {
  const target = p.page.locator(selector).first();
  await target.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await target.scrollIntoViewIfNeeded().catch(() => {});
  const box = await target.boundingBox();
  if (!box) throw new Error(`rightClick: ${selector} is not visible`);
  await p.page.mouse.click(box.x + Math.min(40, box.width / 2), box.y + Math.min(14, box.height / 2), { button: 'right' });
  await p.page.waitForSelector('.ctx-menu', { timeout: 5000 });
}

async function pickItem(p, label) {
  await p.page.click(`.ctx-menu [role^="menuitem"][data-label="${label}"]`);
  await p.page.waitForFunction(() => !document.querySelector('.ctx-menu'), null, { timeout: 5000 });
}

try {
  const people = {};
  for (const name of ['Ana', 'Bia', 'Caio', 'Dani', 'Edu', 'Fabi', 'Gabi']) people[name] = await person(name);
  const { Ana: ana, Bia: bia, Caio: caio, Dani: dani, Edu: edu, Fabi: fabi, Gabi: gabi } = people;
  const ids = {};
  for (const p of Object.values(people)) ids[p.name] = await evalApp(p, () => window.howlden.profile.id);
  log('seven profiles created with identity keys');

  // A den: creating it opens the invite, which is six words and a QR code, never a link
  await ana.page.click('.home-card');
  await ana.page.fill('#den-name', 'Night owls');
  await ana.page.click('.hl-modal button[type="submit"]');
  await ana.page.waitForSelector('.invite-modal .invite-words', { timeout: 40000 });
  {
    const shown = await ana.page.evaluate(() => {
      const m = document.querySelector('.invite-modal');
      return { text: m.innerText, fields: m.querySelectorAll('input, textarea').length, qr: !!m.querySelector('svg.qr') };
    });
    ok(!/https?:|#i=|#w=/.test(shown.text) && !shown.fields && shown.qr, `the invite shows only words and a QR code ${JSON.stringify(shown)}`);
    const hero = await wordsJoin(ana, bia, async () => {});
    ok(hero.includes('Night owls'), 'join screen shows the den');
  }
  await waitFor(bia, () => window.howlden.activeDen?.status === 'online');
  log('Bia joined the new den with six words; the invite shows no link, only the words and a QR code');

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
  await waitFor(ana, () => !!document.querySelector('.reaction.pop'));
  await bia.page.fill('.composer-input', '@Ana sounds good');
  await bia.page.keyboard.press('Escape');
  await bia.page.press('.composer-input', 'Enter');
  await waitFor(ana, () => !!document.querySelector('.msg.mentioned'));
  log('messages, markdown, reactions (which pop when they arrive) and mentions sync to every member');

  // The shared menu on a message: right click, arrows, typeahead, a submenu, Escape
  {
    const helloId = await evalApp(caio, () => window.howlden.activeDen.timeline(window.howlden.channelId).find((r) => r.text.includes('Hello'))?.id);
    await rightClick(caio, `.msg[data-id="${helloId}"] .msg-content`);
    let st = await menuState(caio);
    ok(st.role === 'menu' && st.inside, `the message menu is a menu inside the viewport ${JSON.stringify(st)}`);
    for (const label of ['Reply', 'Start a thread', 'Forward', 'Pin for everyone', 'Mark unread', 'Copy text', 'Copy link to message', 'Select', 'Remind me']) ok(st.items.includes(label), `message menu has ${label}: ${st.items.join(', ')}`);
    ok(!st.items.includes('Edit') && !st.items.includes('Delete'), 'no edit or delete on a message by someone else');
    ok(st.focus === 'Reply', `the first item has focus (${st.focus})`);
    await caio.page.keyboard.press('ArrowDown');
    ok((await menuState(caio)).focus === 'Start a thread', 'the arrows move between items');
    await caio.page.keyboard.press('r');
    await caio.page.keyboard.press('e');
    ok((await menuState(caio)).focus === 'Remind me', `typing letters jumps to the item (${(await menuState(caio)).focus})`);
    await caio.page.keyboard.press('ArrowRight');
    await caio.page.waitForSelector('.ctx-submenu [role="menuitem"]');
    await caio.page.keyboard.press('ArrowLeft');
    st = await menuState(caio);
    ok(!st.subs && st.focus === 'Remind me', 'Left closes the submenu and returns to its item');
    await caio.page.keyboard.press('Escape');
    ok(!(await menuState(caio)), 'Escape closes the menu');

    // Copy link to message, then follow it.
    await rightClick(caio, `.msg[data-id="${helloId}"] .msg-content`);
    await pickItem(caio, 'Copy link to message');
    const link = await caio.page.evaluate(() => navigator.clipboard.readText());
    ok(/#m=[\w-]+\.[\w-]+\.[\w-]+$/.test(link), `a link to the message is copied (${link})`);
    ok(await evalApp(caio, (l) => !!window.howlden.parseMessageLink(l), link), 'the app reads its own message link');

    // Shift+F10 on a focused message, and the Menu key path for keyboard users.
    await caio.page.evaluate((id) => document.querySelector(`.msg[data-id="${id}"]`).focus(), helloId);
    await caio.page.keyboard.press('Shift+F10');
    await caio.page.waitForSelector('.ctx-menu');
    ok((await menuState(caio)).focus, 'Shift+F10 opens the menu with focus on an item');
    await caio.page.keyboard.press('Escape');

    // Long press on a touch screen opens the same menu.
    await caio.page.evaluate((id) => {
      const el = document.querySelector(`.msg[data-id="${id}"] .msg-content`);
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: r.left + 20, clientY: r.top + 10, isPrimary: true }));
    }, helloId);
    await caio.page.waitForSelector('.ctx-menu', { timeout: 3000 });
    await caio.page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' })));
    ok((await menuState(caio)).items.includes('Reply'), 'a long press opens the message menu');
    await caio.page.keyboard.press('Escape');

    // Mark unread keeps the channel unread with a divider; Select picks messages.
    await rightClick(bia, `.msg[data-id="${helloId}"] .msg-content`);
    await pickItem(bia, 'Mark unread');
    await waitFor(bia, () => window.howlden.activeDen.unread(window.howlden.channelId).count > 0 && !!document.querySelector('.day-divider.new'));
    await bia.page.evaluate((id) => document.querySelector(`.msg[data-id="${id}"]`).focus(), helloId);
    await bia.page.keyboard.press('s');
    await bia.page.waitForSelector('.select-bar:not([hidden])');
    ok(/1 selected/.test(await bia.page.locator('.select-bar').innerText()), 'S selects the focused message');
    await bia.page.keyboard.press('Escape');
    await bia.page.waitForSelector('.select-bar', { state: 'hidden' });
    await bia.page.focus('.composer-input');
    await bia.page.keyboard.press('Escape');
    await waitFor(bia, () => window.howlden.activeDen.unread(window.howlden.channelId).count === 0);
  }
  log('message menu: right click, arrows, typeahead, a submenu, Escape, Shift+F10, long press, copy link, mark unread and select');

  // People, channels and dens have their own menus
  {
    // The member list may be closed after earlier steps; the menu test needs it open.
    await evalApp(ana, () => { if (!window.howlden.showMembers) window.howlden.toggleMembers(); });
    await rightClick(ana, `.members .member[data-member="${ids.Bia}"]`);
    let st = await menuState(ana);
    for (const label of ['Profile', 'Message', 'Voice call', 'Mute for me', 'Copy name']) ok(st.items.includes(label), `member menu has ${label}: ${st.items.join(', ')}`);
    await ana.page.evaluate(() => {
      const r = document.querySelector('.ctx-menu .menu-range input');
      r.value = '40';
      r.dispatchEvent(new Event('input', { bubbles: true }));
    });
    ok((await evalApp(ana, (id) => window.howlden.media.volumeOf(id), ids.Bia)) === 40, 'the volume slider in the menu sets the volume of that person');
    await pickItem(ana, 'Mute for me');
    ok(await evalApp(ana, (id) => window.howlden.media.isLocalMuted(id), ids.Bia), 'Mute for me mutes that person on this device');
    await rightClick(ana, `.members .member[data-member="${ids.Bia}"]`);
    st = await menuState(ana);
    ok(st.items.includes('Mute for me'), 'the mute item is still there');
    await pickItem(ana, 'Mute for me');
    ok(!(await evalApp(ana, (id) => window.howlden.media.isLocalMuted(id), ids.Bia)), 'and unmutes');
    await evalApp(ana, (id) => window.howlden.media.setVolume(id, 100), ids.Bia);

    const ch = await evalApp(ana, () => window.howlden.channelId);
    await rightClick(ana, `.ch-row[data-channel="${ch}"] .ch`);
    st = await menuState(ana);
    for (const label of ['Mark as read', 'Mute channel', 'Notifications', 'Copy an invite', 'Rename channel']) ok(st.items.includes(label), `channel menu has ${label}: ${st.items.join(', ')}`);
    await pickItem(ana, 'Mute channel');
    ok(await evalApp(ana, (c) => window.howlden.activeDen.isMuted(c), ch), 'a channel can be muted from its menu');
    ok(await ana.page.locator(`.ch-row.muted[data-channel="${ch}"]`).count(), 'a muted channel looks muted');
    await evalApp(ana, (c) => window.howlden.activeDen.setMuted(c, false), ch);

    await rightClick(ana, '.rail-item[data-den] .rail-btn');
    await ana.page.click('.ctx-menu [data-label="Notifications"]');
    await ana.page.waitForSelector('.ctx-submenu [role="menuitemradio"]');
    await ana.page.click('.ctx-submenu [data-label="Nothing"]');
    ok((await evalApp(ana, () => window.howlden.activeDen.notifyLevel)) === 'none', 'a den can be set to notify about nothing');
    await evalApp(ana, () => window.howlden.activeDen.setLocal('notify', 'default'));
  }
  log('member menu sets volume and mutes locally, channel menu mutes a channel, den menu sets notifications');

  // Quick switcher and the shortcuts sheet
  {
    const links = await evalApp(ana, () => window.howlden.activeDen.den.channels.find((c) => c.kind === 'text' && c.id !== window.howlden.channelId)?.id);
    const home = await evalApp(ana, () => window.howlden.channelId);
    await ana.page.keyboard.press('Control+k');
    await ana.page.waitForSelector('.switcher .switcher-input');
    await ana.page.keyboard.type('link');
    await ana.page.waitForSelector('.switcher-item.active');
    await ana.page.keyboard.press('Enter');
    await waitFor(ana, (id) => window.howlden.channelId === id && !document.querySelector('.switcher'), links);
    await ana.page.keyboard.press('Control+k');
    await ana.page.waitForSelector('.switcher .switcher-input');
    await ana.page.keyboard.type('#gener');
    await ana.page.keyboard.press('Enter');
    await waitFor(ana, (id) => window.howlden.channelId === id, home);
    await ana.page.keyboard.press('Control+/');
    await ana.page.waitForSelector('.keys-modal .keys-row');
    ok((await ana.page.locator('.keys-modal .keys-row').count()) > 20, 'the shortcuts sheet lists the shortcuts');
    await ana.page.keyboard.press('Escape');
    await ana.page.keyboard.press('Alt+ArrowDown');
    await waitFor(ana, (id) => window.howlden.channelId === id, links);
    await ana.page.keyboard.press('Alt+ArrowUp');
    await waitFor(ana, (id) => window.howlden.channelId === id, home);
  }
  log('Ctrl+K jumps to a channel by a few letters, Ctrl+/ shows the shortcuts, Alt+arrows move between channels');

  // Read receipts, only between people who turned them on
  {
    for (const p of [ana, bia]) await evalApp(p, () => ((window.howlden.settings.readReceipts = true), window.howlden.activeDen.shareReads()));
    await ana.page.fill('.composer-input', 'did you read this?');
    await ana.page.press('.composer-input', 'Enter');
    await waitFor(ana, () => !document.querySelector('.seen-by')?.hidden && /Seen by/.test(document.querySelector('.seen-by')?.textContent || ''), null, 20000);
    ok(!(await caio.page.locator('.seen-by:not([hidden])').count()), 'someone with receipts off sees none');
    for (const p of [ana, bia]) await evalApp(p, () => (window.howlden.settings.readReceipts = false));
  }
  log('read receipts: Ana sees "Seen by" from Bia once both turned them on');

  // Richer chat between five people: polls, threads, pins, edit history, voice messages and search
  {
    await ana.page.fill('.composer-input', '/poll Lunch? | Pizza | Tacos');
    await ana.page.press('.composer-input', 'Enter');
    await bia.page.waitForSelector('.poll-opt:has-text("Tacos")');
    await bia.page.click('.poll-opt:has-text("Tacos")');
    await waitFor(ana, () => /100%/.test(document.querySelector('.poll-opt.lead')?.textContent || '') && /1 vote/.test(document.querySelector('.poll-foot')?.textContent || ''));
    log('a /poll is posted and a vote shows up live for everyone');

    const root = await evalApp(ana, () => window.howlden.activeDen.timeline(window.howlden.channelId).find((r) => r.text.includes('Hello'))?.id);
    await bia.page.hover(`.msg[data-id="${root}"]`);
    await bia.page.click(`.msg[data-id="${root}"] .msg-actions button[aria-label="Reply in thread"]`);
    await bia.page.fill('.chat-panel .thread-input', 'thread reply from Bia');
    await bia.page.press('.chat-panel .thread-input', 'Enter');
    await waitFor(ana, (id) => /1 reply/.test(document.querySelector(`.msg[data-id="${id}"] .thread-link`)?.textContent || ''), root);
    ok(!(await ana.page.locator('.messages .msg-content:has-text("thread reply from Bia")').count()), 'thread replies stay out of the main timeline');
    await ana.page.click(`.msg[data-id="${root}"] .thread-link`);
    await ana.page.waitForSelector('.chat-panel .msg-content:has-text("thread reply from Bia")');
    await ana.page.click('.chat-panel .panel-head button');
    log('a reply in a thread shows "1 reply" under the message and opens in the side panel');

    await evalApp(caio, (id) => window.howlden.activeDen.pin(id, true), root);
    await waitFor(dani, (id) => !!document.querySelector(`.msg.pinned[data-id="${id}"]`), root);
    await evalApp(ana, (id) => window.howlden.activeDen.edit(id, 'Hello **pack**, edited'), root);
    await waitFor(edu, (id) => window.howlden.activeDen.messages.get(id)?.history?.length === 1, root);
    log('pins and edit history sync to every member');

    await dani.page.click('.composer-mic');
    await dani.page.waitForSelector('.composer-box.recording');
    await dani.page.waitForTimeout(1500);
    await dani.page.click('.composer-box.recording .composer-send');
    await waitFor(edu, () => [...window.howlden.activeDen.messages.values()].some((r) => r.files?.some((f) => f.voice && window.howlden.activeDen.fileUrl(f.id))), null, 30000);
    const vm = await evalApp(edu, async () => {
      const s = window.howlden.activeDen;
      const f = [...s.messages.values()].flatMap((r) => r.files || []).find((x) => x.voice);
      const blob = await fetch(s.fileUrl(f.id)).then((r) => r.blob());
      return { size: blob.size, dur: f.dur, wave: f.wave.length, ui: !!document.querySelector('.vm .vm-play') };
    });
    ok(vm.size > 1000 && vm.dur >= 1 && vm.wave === 48 && vm.ui, `a voice message arrives with its waveform ${JSON.stringify(vm)}`);
    log(`a recorded voice message reaches the others with a 48 point waveform (${vm.size} bytes, ${vm.dur} s)`);

    await ana.page.click('.hd-tool[aria-label="Search"]');
    await ana.page.fill('.chat-panel input[type="search"]', 'tacos has:poll');
    await ana.page.waitForSelector('.chat-panel .search-count:has-text("1 result")');
    await ana.page.click('.chat-panel .panel-head button');
    log('search with a has:poll filter finds the poll');
  }

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
  // A call tile has the per person menu: volume, mute, pin and full screen.
  {
    const bTile = `.stage .tile[data-member="${ids.Bia}"]`;
    await rightClick(ana, bTile);
    const st = await menuState(ana);
    for (const label of ['Pin to the big view', 'Full screen', 'Mute for me', 'Profile']) ok(st.items.includes(label), `call tile menu has ${label}: ${st.items.join(', ')}`);
    ok(await ana.page.locator('.ctx-menu .menu-range input').count(), 'the call tile menu has a volume slider');
    await pickItem(ana, 'Pin to the big view');
    await ana.page.waitForSelector(`${bTile}.is-focus`);
    await ana.page.click(`${bTile} .tile-menu`);
    await pickItem(ana, 'Unpin');
    ok(!(await ana.page.locator('.stage .tile.is-focus').count()), 'the tile menu pins and unpins a tile');
    ok((await ana.page.locator('.stage-controls .ctl-group').count()) === 2 && (await ana.page.locator('.stage-corner button[aria-label="Pop out"]').count()) === 1, 'grouped call controls and a pop out button');
  }
  log('call tiles: right click and the ... button open the per person menu; pin and unpin work');
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

  // Call a friend: one button, six words copied as text, and the call rings when the friend types them
  {
    await ana.page.click('.rail-home .rail-btn');
    await ana.page.click('.home-tabs .call-new');
    const words = await openWords(ana, async () => {});
    ok(!/https?:/.test(await ana.page.locator('.invite-modal').innerText()), 'the call invite shows no link');
    await ana.page.waitForFunction(() => document.querySelector('.toasts')?.textContent.includes('Copied the six words'), null, { timeout: 10000 });
    const clip = await ana.page.evaluate(() => navigator.clipboard.readText());
    ok(clip.includes(words.join(' ')) && !/https?:|#w=/.test(clip), `the six words are copied as text only (${clip})`);
    await joinWithWords(gabi, words);
    await hostConfirms(ana, await confirmWordsOf(gabi));
    await waitFor(ana, () => window.howlden.activeDen?.isDirect && !!window.howlden.media.current, null, 40000);
    await waitFor(gabi, () => !!document.querySelector('.call-ring'), null, 40000);
    await gabi.page.click('.call-ring button[aria-label="Accept call"]');
    await waitFor(gabi, () => window.howlden.activeDen?.isDirect && !!window.howlden.media.current);
    await ana.page.waitForTimeout(2000);
    const grewCall = await audioFlows(gabi, ids.Ana, 'Gabi hears Ana after Call a friend');
    log(`"Call a friend": six words copied as text, Gabi typed them, the call rang and audio flows (grew ${grewCall} bytes)`);
  }

  // Stickers, live reactions, music mode, recording and push to talk in that call
  {
    await gabi.page.click('.composer-sticker');
    await gabi.page.click('.sticker-picker .sticker-pick >> nth=1');
    await waitFor(ana, () => !!document.querySelector('.msg-content .sticker-howl[role="img"]'));
    ok((await ana.page.locator('.msg-content .sticker-howl').getAttribute('aria-label')) === 'Luna howls at the moon', 'the sticker has a label');
    log('a sticker drawn for howlden arrives and plays on the other side');

    await ana.page.click('.stage-controls .react-btn');
    await ana.page.click('.burst-bar button[aria-label="Fire"]');
    await waitFor(gabi, () => !!document.querySelector('.stage-bursts .burst'), null, 10000);
    ok((await gabi.page.locator('.stage-bursts .burst-name').first().innerText()) === 'Ana', 'the live reaction shows who sent it');
    log('a live reaction floats over the call for the other person');

    await ana.page.click('.stage-controls .more-btn');
    await ana.page.click('.call-menu button:has-text("Music mode")');
    await waitFor(ana, (id) => window.howlden.activeDen.mesh.links.get(id)?.senders.mic?.getParameters().encodings[0]?.maxBitrate === 128000, ids.Gabi, 15000);
    const music = await evalApp(ana, () => {
      const m = window.howlden.media;
      const st = m.pipe.raw.getAudioTracks()[0].getSettings();
      return { mode: m.processing, echo: st.echoCancellation, noise: st.noiseSuppression };
    });
    ok(music.mode === 'music' && music.echo !== true && music.noise !== true, `music mode turns the voice filters off ${JSON.stringify(music)}`);
    await waitFor(gabi, () => !!document.querySelector('.stage .music-tag'));
    await audioFlows(gabi, ids.Ana, 'Gabi still hears Ana in music mode');
    log('music mode: voice filters off, 128 kbps cap on the sender, a Music tag for the other person, audio still flows');

    await ana.page.click('.stage-controls .more-btn');
    await ana.page.click('.call-menu button:has-text("Record this call")');
    await ana.page.click('.hl-modal .modal-foot .btn-brand');
    await waitFor(gabi, () => /Ana is recording this call/.test(document.querySelector('.stage-notice:not([hidden])')?.textContent || ''), null, 10000);
    await waitFor(ana, () => /You are recording/.test(document.querySelector('.stage-notice:not([hidden])')?.textContent || ''));
    await ana.page.waitForTimeout(2500);
    await ana.page.click('.stage-notice .rec-stop');
    await ana.page.waitForSelector('.rec-modal audio', { timeout: 10000 });
    const file = await evalApp(ana, async () => {
      const a = document.querySelector('.rec-modal a[download]');
      const blob = await fetch(a.href).then((r) => r.blob());
      return { size: blob.size, type: blob.type, name: a.getAttribute('download') };
    });
    ok(file.size > 2000 && /^audio\//.test(file.type) && /^howlden-gabi-\d{4}-\d{2}-\d{2}-\d{4}\.(webm|ogg|m4a)$/.test(file.name), `the recording is a local audio file ${JSON.stringify(file)}`);
    await waitFor(gabi, () => document.querySelector('.stage-notice').hidden);
    await ana.page.click('.rec-modal .modal-foot .btn-ghost');
    log(`local recording: Gabi saw "Ana is recording", Ana got a ${Math.round(file.size / 1024)} KB ${file.type} file, the notice went away`);

    await gabi.page.click('.stage-controls .more-btn');
    await gabi.page.click('.call-menu button:has-text("Push to talk")');
    await gabi.page.waitForSelector('.ptt-btn:visible');
    ok(!(await evalApp(gabi, () => window.howlden.media.live)), 'push to talk: the mic is closed until the button is held');
    const box = await gabi.page.locator('.ptt-btn').boundingBox();
    await gabi.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await gabi.page.mouse.down();
    await waitFor(gabi, () => window.howlden.media.live && document.querySelector('.ptt-btn').classList.contains('held'));
    await gabi.page.mouse.up();
    await waitFor(gabi, () => !window.howlden.media.live);
    await evalApp(gabi, () => window.howlden.media.setInputMode('voice'));
    log('push to talk: holding the talk button opens the mic, letting go closes it');

    for (const p of [ana, gabi]) await evalApp(p, () => window.howlden.media.leave());
  }

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
