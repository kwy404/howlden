// Keyboard: the quick switcher (Ctrl+K), the shortcuts sheet (Ctrl+/) and the
// app wide shortcuts. Everything here only moves around this device.

import { h, replace } from './dom.js';
import { icon } from './icons.js';
import { modal } from './ui-modal.js';
import { avatarImg } from './ui-shell.js';
import { closeMenus, menuOpen } from './menu.js';
import { DM_TEXT } from './session.js';
import { visibleChannels } from '../core/denstate.js';

const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
export const MOD = mac ? 'Cmd' : 'Ctrl';

/** Score how well a query matches a label: 0 means no match. Prefix and word starts win. */
export function fuzzyScore(query, label) {
  const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const l = label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!q) return 1;
  if (l.startsWith(q)) return 1000 - l.length;
  const word = l.indexOf(` ${q}`);
  if (word >= 0) return 800 - word;
  const at = l.indexOf(q);
  if (at >= 0) return 600 - at;
  // Letters in order with gaps between them, fewer gaps first.
  let i = 0;
  let gaps = 0;
  for (const ch of l) {
    if (ch === q[i]) {
      i++;
      if (i === q.length) break;
    } else if (i > 0) gaps++;
  }
  return i === q.length ? Math.max(1, 300 - gaps * 4) : 0;
}

/** Everything the switcher can open: channels, conversations, friends, dens and a few actions. */
function entries(app) {
  const t = app.t;
  const out = [];
  for (const s of app.sessions.values()) {
    if (s.isDirect) {
      const f = app.friends.get(s.den.peer) || s.member(s.den.peer) || { id: s.den.peer, name: s.den.name };
      const u = s.unread(DM_TEXT);
      out.push({ key: `dm:${s.id}`, label: f.name, sub: t('app.switch.dm'), avatar: f.avatar || f.id, unread: u.count, mention: u.count, run: () => app.openSession(s) });
      continue;
    }
    for (const c of visibleChannels(s.den)) {
      const u = c.kind === 'text' ? s.unread(c.id) : { count: 0, mention: 0 };
      const people = c.kind === 'voice' ? [...s.voice.values()].filter((v) => v.channel === c.id).length : 0;
      out.push({
        key: `ch:${s.id}:${c.id}`,
        label: c.name,
        sub: s.den.name,
        icon: c.kind === 'voice' ? 'speaker' : 'hash',
        unread: s.isMuted(c.id) ? 0 : u.count,
        mention: u.mention,
        hint: people ? t('app.switch.inVoice', { n: people }) : '',
        current: app.activeDen === s && app.channelId === c.id,
        run: () => (app.openDen(s.id, c.id), c.kind === 'voice' && app.openVoice(c.id, false)),
      });
    }
  }
  const dmPeers = new Set([...app.sessions.values()].filter((s) => s.isDirect).map((s) => s.den.peer));
  for (const f of app.friends.list()) if (!dmPeers.has(f.id)) out.push({ key: `fr:${f.id}`, label: f.name, sub: t('app.switch.friend'), avatar: f.avatar || f.id, run: () => app.messageFriend(f) });
  const actions = [
    ['home', 'logo', t('app.home'), () => app.openHome()],
    ['settings', 'gear', t('user.settings'), () => app.openSettings()],
    ['create', 'plus', t('home.create'), () => app.createDenFlow()],
    ['join', 'compass', t('home.join'), () => app.joinFlow()],
    ['call', 'phone', t('home.callButton'), () => app.callNewFriendFlow()],
    ['saved', 'bookmark', t('saved.title'), () => app.chatPanel('saved')],
    ['keys', 'keyboard', t('app.keys.title'), () => shortcutsSheet(app)],
  ];
  for (const [key, ico, label, run] of actions) out.push({ key: `act:${key}`, label, sub: t('app.switch.action'), icon: ico, action: true, run });
  return out;
}

let switcherOpen = null;

/** Ctrl+K: jump anywhere by typing a few letters. */
export function quickSwitcher(app) {
  if (switcherOpen) return switcherOpen.close();
  const t = app.t;
  const all = entries(app);
  const input = h('input', { class: 'switcher-input', type: 'text', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'switcher-list', 'aria-autocomplete': 'list', autocomplete: 'off', spellcheck: 'false', placeholder: t('app.switch.placeholder'), 'aria-label': t('app.switch.title') });
  const list = h('ul', { class: 'switcher-list', id: 'switcher-list', role: 'listbox', 'aria-label': t('app.switch.title') });
  let index = 0;
  let shown = [];
  const render = () => {
    const q = input.value.trim().replace(/^[#@]/, '');
    const mode = input.value.trim()[0];
    let pool = all;
    if (mode === '#') pool = all.filter((e) => e.key.startsWith('ch:'));
    else if (mode === '@') pool = all.filter((e) => e.key.startsWith('dm:') || e.key.startsWith('fr:'));
    shown = q
      ? pool
          .map((e) => ({ e, score: Math.max(fuzzyScore(q, e.label), fuzzyScore(q, `${e.label} ${e.sub}`) * 0.6) + (e.unread ? 20 : 0) }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((x) => x.e)
          .slice(0, 12)
      : [...pool.filter((e) => e.mention && !e.current), ...pool.filter((e) => e.unread && !e.mention && !e.current), ...pool.filter((e) => !e.unread && !e.mention && !e.action && !e.current)].slice(0, 9).concat(pool.filter((e) => e.action).slice(0, 3));
    index = Math.min(index, Math.max(0, shown.length - 1));
    replace(
      list,
      shown.length
        ? shown.map((e, i) =>
            h(
              'li',
              {
                class: `switcher-item${i === index ? ' active' : ''}`,
                id: `sw-${i}`,
                role: 'option',
                'aria-selected': String(i === index),
                onmousemove: () => {
                  if (index !== i) {
                    index = i;
                    render();
                  }
                },
                onclick: () => pick(i),
              },
              e.avatar ? avatarImg(e.avatar, { size: 24 }) : h('span', { class: 'switcher-ico' }, icon(e.icon || 'hash', { size: 18 })),
              h('span', { class: 'switcher-label' }, e.label),
              h('span', { class: 'switcher-sub' }, e.sub),
              e.hint ? h('span', { class: 'switcher-hint' }, e.hint) : null,
              e.mention ? h('span', { class: 'badge-count' }, String(e.mention)) : e.unread ? h('span', { class: 'switcher-dot', 'aria-label': t('app.switch.unread') }) : null,
            ),
          )
        : h('li', { class: 'switcher-empty', role: 'presentation' }, t('app.switch.none')),
    );
    input.setAttribute('aria-activedescendant', shown.length ? `sw-${index}` : '');
    list.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  };
  const pick = (i) => {
    const e = shown[i];
    if (!e) return;
    m.close();
    e.run();
  };
  input.addEventListener('input', () => {
    index = 0;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!shown.length) return;
      index = (index + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(index);
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  });
  const m = modal({
    className: 'switcher',
    closeLabel: t('common.close'),
    dismissable: true,
    body: [h('div', { class: 'switcher-box' }, icon('search', { size: 20, cls: 'switcher-glass' }), input), list, h('p', { class: 'switcher-foot' }, h('span', null, h('kbd', null, '↑'), h('kbd', null, '↓'), ` ${t('app.switch.move')}`), h('span', null, h('kbd', null, 'Enter'), ` ${t('app.switch.open')}`), h('span', null, h('kbd', null, '#'), ` ${t('app.switch.channels')}`), h('span', null, h('kbd', null, '@'), ` ${t('app.switch.people')}`))],
    onClose: () => (switcherOpen = null),
  });
  switcherOpen = m;
  render();
  setTimeout(() => input.focus(), 20);
  return m;
}

/** Ctrl+/: every shortcut on one sheet. */
export function shortcutsSheet(app) {
  const t = app.t;
  const k = (...keys) => h('span', { class: 'keys' }, keys.map((x) => h('kbd', null, x)));
  const groups = [
    [
      t('app.keys.navigation'),
      [
        [k(MOD, 'K'), t('app.keys.switcher')],
        [k('Alt', '↑'), t('app.keys.prevChannel')],
        [k('Alt', '↓'), t('app.keys.nextChannel')],
        [k('Alt', 'Shift', '↑'), t('app.keys.prevUnread')],
        [k('Alt', 'Shift', '↓'), t('app.keys.nextUnread')],
        [k('Esc'), t('app.keys.present')],
        [k('Shift', 'Esc'), t('app.keys.markDenRead')],
        [k(MOD, 'Shift', 'F'), t('app.keys.search')],
        [k(MOD, ','), t('app.keys.settings')],
        [k(MOD, '/'), t('app.keys.sheet')],
      ],
    ],
    [
      t('app.keys.messages'),
      [
        [k('Enter'), t('app.keys.send')],
        [k('Shift', 'Enter'), t('app.keys.newline')],
        [k('↑'), t('app.keys.editLast')],
        [k(MOD, 'B'), t('format.bold')],
        [k(MOD, 'I'), t('format.italic')],
        [k('Esc'), t('app.keys.cancelReply')],
        [k('Shift', 'F10'), t('app.keys.menu')],
      ],
    ],
    [
      t('app.keys.onMessage'),
      [
        [k('↑', '↓'), t('app.keys.moveMessages')],
        [k('R'), t('chat.reply')],
        [k('E'), t('chat.edit')],
        [k('T'), t('chat.ctx.startThread')],
        [k('P'), t('pins.pin')],
        [k('U'), t('chat.ctx.markUnread')],
        [k('S'), t('chat.ctx.select')],
        [k('C'), t('chat.copyText')],
        [k('+'), t('chat.react')],
        [k('Del'), t('chat.delete')],
      ],
    ],
    [
      t('app.keys.calls'),
      [
        [k(MOD, 'Shift', 'M'), t('app.keys.mute')],
        [k(MOD, 'Shift', 'D'), t('app.keys.deafen')],
        [k(MOD, 'Shift', 'E'), t('app.keys.camera')],
        [k(MOD, 'Shift', 'O'), t('app.keys.popout')],
      ],
    ],
  ];
  modal({
    title: t('app.keys.title'),
    className: 'keys-modal',
    closeLabel: t('common.close'),
    body: [h('div', { class: 'keys-grid' }, groups.map(([title, rows]) => h('section', { class: 'keys-group' }, h('h3', null, title), h('dl', null, rows.map(([keys, what]) => h('div', { class: 'keys-row' }, h('dt', null, what), h('dd', null, keys)))))))],
  });
}

const typing = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** Move to the previous or next channel of the den, optionally only unread ones. */
function stepChannel(app, dir, unreadOnly) {
  const s = app.activeDen;
  if (!s) return;
  if (s.isDirect) {
    const dms = [...app.sessions.values()].filter((x) => x.isDirect && (!unreadOnly || x === s || x.unread(DM_TEXT).count));
    const i = dms.indexOf(s);
    const next = dms[(i + dir + dms.length) % dms.length];
    if (next && next !== s) app.openSession(next);
    return;
  }
  const list = visibleChannels(s.den).filter((c) => !unreadOnly || c.id === app.channelId || (c.kind === 'text' && s.unread(c.id).count));
  const i = list.findIndex((c) => c.id === app.channelId);
  const next = list[(i + dir + list.length) % list.length];
  if (!next || next.id === app.channelId) return;
  if (next.kind === 'voice') app.openVoice(next.id, false);
  else app.openChannel(next.id);
}

export function initKeys(app) {
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    const modal = !!document.querySelector('dialog[open]:not(.switcher), .settings');
    if (mod && !e.altKey && key === 'k') {
      e.preventDefault();
      closeMenus();
      if (!document.querySelector('dialog[open]:not(.switcher)')) quickSwitcher(app);
      return;
    }
    if (mod && !e.altKey && (key === '/' || e.code === 'Slash')) {
      e.preventDefault();
      closeMenus();
      if (!modal) shortcutsSheet(app);
      return;
    }
    if (modal || menuOpen() || !app.profile) return;
    if (mod && !e.shiftKey && key === ',') {
      e.preventDefault();
      app.openSettings();
      return;
    }
    if (mod && e.shiftKey && !e.altKey) {
      const m = app.media;
      const act = { m: () => m.current && m.toggleMute(), d: () => m.current && m.toggleDeafen(), e: () => m.current && m.toggleCamera(), o: () => m.current && app.popOutCall?.(), f: () => app.activeDen && app.view === 'chat' && app.chatPanel('search') }[key];
      if (act) {
        e.preventDefault();
        act();
      }
      return;
    }
    if (e.altKey && !mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      stepChannel(app, e.key === 'ArrowUp' ? -1 : 1, e.shiftKey);
      return;
    }
    if (e.key === 'Escape' && e.shiftKey && !typing(e.target)) {
      if (app.activeDen) {
        e.preventDefault();
        app.activeDen.markAllRead();
      }
      return;
    }
    if (e.key === 'Escape' && !typing(e.target) && !document.querySelector('.hl-popover') && app.view === 'chat' && !$app().dataset.drawer) app.chatToPresent?.();
  });
}

const $app = () => document.getElementById('app');
