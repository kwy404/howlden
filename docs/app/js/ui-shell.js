// The frame around the chat: den rail, channel sidebar, header, member list,
// voice panel and user panel, plus menus and popouts.

import { h, replace } from './dom.js';
import { icon } from './icons.js';
import { avatarTraits, nameColor } from '../core/avatar.js';
import { avatarSrc } from './ui-account.js';
import { renderHomeSide } from './ui-home.js';
import { DM_TEXT } from './session.js';
import { visibleChannels } from '../core/denstate.js';

/** Display color for a member: their accent, or a color from their avatar. */
export const colorOf = (m, id = '') => m?.accent || nameColor(m?.avatar || id || m?.id || '');

/** A small badge for the identity check of a peer, or null. */
export function idBadge(app, s, peerId) {
  const st = s?.identityOf?.(peerId);
  if (!st?.status || st.status === 'pending') return null;
  if (st.status !== 'verified') return h('span', { class: 'id-badge bad', title: app.t('id.failedHint'), 'aria-label': app.t('id.failed') }, icon('warning', { size: 14 }));
  if (st.friend === 'name-clash') return h('span', { class: 'id-badge bad', title: app.t('id.nameClashHint', { name: s.member(peerId)?.name || '' }), 'aria-label': app.t('id.nameClash') }, icon('warning', { size: 14 }));
  if (st.friend === 'known') return h('span', { class: 'id-badge ok', title: app.t('id.verifiedHint'), 'aria-label': app.t('id.verified') }, icon('shield', { size: 14 }));
  return h('span', { class: 'id-badge new', title: app.t('id.newHint'), 'aria-label': app.t('id.newPerson') }, icon('shield', { size: 14 }));
}

export function initials(name) {
  const words = String(name || '?').trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2);
  return [...letters].slice(0, 2).join('').toUpperCase();
}

export function avatarImg(seed, { size = 32, speaking = false, cls = '' } = {}) {
  return h('img', { class: `av${speaking ? ' speaking' : ''}${cls ? ` ${cls}` : ''}`, src: avatarSrc(seed), width: size, height: size, alt: '', draggable: 'false' });
}

function avatarWithStatus(m, size, app) {
  const speaking = app.media.isSpeaking(m.id) && app.media.inVoice(app.activeDen) && (m.id === app.profile.id || app.activeDen?.voice.get(m.id)?.channel === app.media.current?.channel);
  return h('span', { class: `avatar-wrap s${size}` }, avatarImg(m.avatar, { size, speaking }), h('span', { class: `status-dot ${m.online ? 'on' : 'off'}`, 'aria-hidden': 'true' }));
}

// Popover menus

let openPopover = null;

export function closePopover() {
  if (!openPopover) return;
  const p = openPopover;
  openPopover = null;
  p.cleanup?.();
  p.el.remove();
  p.anchor?.setAttribute('aria-expanded', 'false');
  document.removeEventListener('mousedown', p.outside, true);
  document.removeEventListener('keydown', p.key, true);
  if (p.restore) p.anchor?.focus();
}

export function popover(anchor, content, { placement = 'below', className = '' } = {}) {
  closePopover();
  const el = h('div', { class: `hl-popover ${className}`, role: 'dialog' }, content);
  el.style.visibility = 'hidden';
  document.body.append(el);
  const gap = 10;
  const edge = 8;
  // Place next to the anchor, flip to the other side when there is no room,
  // then shift inside the viewport. Runs again whenever the card changes size.
  const place = () => {
    const r = anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    el.style.maxHeight = `${vh - edge * 2}px`;
    const pw = el.offsetWidth;
    const ph = el.offsetHeight;
    let left;
    let top;
    if (placement === 'right' || placement === 'left') {
      const right = r.right + gap;
      const leftSide = r.left - pw - gap;
      const fitsRight = right + pw <= vw - edge;
      const fitsLeft = leftSide >= edge;
      left = placement === 'right' ? (fitsRight || !fitsLeft ? right : leftSide) : fitsLeft || !fitsRight ? leftSide : right;
      if (!fitsRight && !fitsLeft) left = (vw - pw) / 2;
      top = r.top;
    } else {
      left = placement === 'above' ? r.right - pw : r.left;
      const below = r.bottom + 6;
      const above = r.top - ph - 6;
      top = placement === 'above' ? (above >= edge ? above : below) : below + ph <= vh - edge ? below : above;
    }
    el.style.left = `${Math.round(Math.max(edge, Math.min(left, vw - pw - edge)))}px`;
    el.style.top = `${Math.round(Math.max(edge, Math.min(top, vh - ph - edge)))}px`;
  };
  place();
  el.style.visibility = '';
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
  ro?.observe(el);
  const outside = (e) => {
    if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover();
  };
  const key = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      openPopover.restore = true;
      closePopover();
    }
  };
  const onResize = () => place();
  window.addEventListener('resize', onResize);
  document.addEventListener('mousedown', outside, true);
  document.addEventListener('keydown', key, true);
  anchor.setAttribute('aria-expanded', 'true');
  openPopover = { el, anchor, outside, key, restore: false, cleanup: () => (ro?.disconnect(), window.removeEventListener('resize', onResize)) };
  const first = el.querySelector('button, [href], input, select, [tabindex]');
  first?.focus({ preventScroll: true });
  return el;
}

function menu(items) {
  return h(
    'div',
    { class: 'hl-menu', role: 'menu' },
    items.filter(Boolean).map((it) =>
      it === '-'
        ? h('div', { class: 'menu-sep', role: 'separator' })
        : h(
            'button',
            {
              class: `hl-menu-item${it.danger ? ' danger' : ''}${it.brand ? ' brand' : ''}`,
              type: 'button',
              role: 'menuitem',
              onclick: () => {
                closePopover();
                it.run();
              },
            },
            h('span', null, it.label),
            it.icon ? icon(it.icon, { size: 18 }) : null,
          ),
    ),
  );
}

// Rail

function railItem({ label, active, unread, mention, content, cls = '', onclick, offline, hue }) {
  return h(
    'div',
    { class: `rail-item${active ? ' active' : ''}${unread ? ' unread' : ''}${offline ? ' offline' : ''} ${cls}`, style: hue != null ? { '--den-hue': hue } : null },
    h('span', { class: 'rail-pill', 'aria-hidden': 'true' }),
    h('button', { class: 'rail-btn', type: 'button', 'aria-label': label + (mention ? `, ${mention}` : ''), 'data-tip': label, 'aria-current': active ? 'page' : null, onclick }, content),
    mention ? h('span', { class: 'rail-badge', 'aria-hidden': 'true' }, mention > 99 ? '99+' : String(mention)) : null,
  );
}

export function renderRail(app, el) {
  const t = app.t;
  const dens = [...app.sessions.values()].filter((s) => !s.isDirect).sort((a, b) => (a.den.createdAt || 0) - (b.den.createdAt || 0));
  let dmUnread = 0;
  for (const s of app.sessions.values()) if (s.isDirect && app.activeDen !== s) dmUnread += s.unread(DM_TEXT).count;
  replace(
    el,
    railItem({ label: t('rail.home'), active: !app.activeDen || app.activeDen.isDirect, mention: dmUnread, cls: 'rail-home', content: icon('logo', { size: 30 }), onclick: () => app.openHome() }),
    h('div', { class: 'rail-sep', role: 'separator' }),
    dens.map((s) => {
      const u = s.unreadTotal();
      return railItem({
        label: s.den.name,
        active: app.activeDen === s,
        unread: u.count > 0,
        mention: u.mention,
        offline: s.status === 'offline',
        hue: avatarTraits(s.id).hue,
        content: h('span', { class: 'den-initials' }, initials(s.den.name)),
        onclick: () => app.openDen(s.id),
      });
    }),
    railItem({ label: t('rail.create'), cls: 'rail-action', content: icon('plus', { size: 22 }), onclick: () => app.createDenFlow() }),
    railItem({ label: t('rail.join'), cls: 'rail-action', content: icon('compass', { size: 22 }), onclick: () => app.joinFlow() }),
  );
}

// Sidebar

export function renderSide(app, el) {
  const t = app.t;
  const s = app.activeDen;
  const parts = [];
  if (!s || s.isDirect) {
    parts.push(...renderHomeSide(app));
  } else {
    const head = h(
      'button',
      { class: 'side-head', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: (e) => denMenu(app, e.currentTarget) },
      h('span', { class: 'side-title' }, s.den.locked ? icon('lock', { size: 14, cls: 'lock-ico' }) : null, s.den.name),
      icon('chevron-down', { size: 18 }),
    );
    parts.push(head);
    if (s.status !== 'online') {
      parts.push(
        h(
          'div',
          { class: 'side-status' },
          h('div', { class: 'side-status-row' }, h('span', { class: `dot ${s.status}` }), h('strong', null, s.status === 'offline' ? t('den.offline') : t('den.alone'))),
          h('p', null, t('den.offlineHint')),
          h('button', { class: 'btn btn-brand btn-sm btn-block', type: 'button', onclick: () => app.inviteFlow(s) }, icon('invite', { size: 16 }), t('den.invite')),
        ),
      );
    }
    const nav = h('nav', { class: 'channels', 'aria-label': s.den.name });
    for (const kind of ['text', 'voice']) {
      nav.append(
        h(
          'div',
          { class: 'cat' },
          h('span', { class: 'cat-label' }, t(kind === 'text' ? 'den.textChannels' : 'den.voiceChannels')),
          h('button', { class: 'icon-btn cat-add', type: 'button', 'aria-label': t(kind === 'text' ? 'den.addText' : 'den.addVoice'), 'data-tip': t(kind === 'text' ? 'den.addText' : 'den.addVoice'), onclick: () => app.createChannelFlow(s, kind) }, icon('plus', { size: 16 })),
        ),
      );
      for (const c of visibleChannels(s.den, kind)) nav.append(kind === 'text' ? textChannel(app, s, c) : voiceChannel(app, s, c));
    }
    parts.push(nav);
  }
  parts.push(voicePanel(app), userPanel(app));
  replace(el, parts);
}

function channelMenu(app, s, c, anchor) {
  const t = app.t;
  popover(
    anchor,
    menu([
      { label: t('den.renameChannel'), icon: 'edit', run: () => app.renameChannelFlow(s, c) },
      { label: t('den.deleteChannel'), icon: 'trash', danger: true, run: () => app.deleteChannelFlow(s, c) },
    ]),
    { placement: 'right' },
  );
}

function textChannel(app, s, c) {
  const active = app.view === 'chat' && app.channelId === c.id;
  const u = s.unread(c.id);
  return h(
    'div',
    { class: `ch-row${active ? ' active' : ''}${u.count && !active ? ' unread' : ''}` },
    h(
      'a',
      {
        class: 'ch',
        href: `#c=${c.id}`,
        'aria-current': active ? 'page' : null,
        onclick: (e) => {
          e.preventDefault();
          app.openChannel(c.id);
        },
      },
      icon('hash', { size: 20, cls: 'ch-ico' }),
      h('span', { class: 'ch-name' }, c.name),
      u.mention && !active ? h('span', { class: 'badge-count', 'aria-label': `${u.mention}` }, String(u.mention)) : null,
    ),
    h('button', { class: 'icon-btn ch-gear', type: 'button', 'aria-label': `${app.t('den.channelSettings')}: ${c.name}`, 'aria-haspopup': 'menu', onclick: (e) => channelMenu(app, s, c, e.currentTarget) }, icon('gear', { size: 16 })),
  );
}

function voiceChannel(app, s, c) {
  const active = app.view === 'voice' && app.channelId === c.id;
  const inHere = app.media.inVoice(s, c.id);
  const people = voiceMembers(app, s, c.id);
  return h(
    'div',
    { class: `ch-row voice${active ? ' active' : ''}${inHere ? ' joined' : ''}` },
    h(
      'button',
      { class: 'ch', type: 'button', 'aria-current': active ? 'page' : null, onclick: () => app.openVoice(c.id, true) },
      icon('speaker', { size: 20, cls: 'ch-ico' }),
      h('span', { class: 'ch-name' }, c.name),
    ),
    h('button', { class: 'icon-btn ch-gear', type: 'button', 'aria-label': `${app.t('den.channelSettings')}: ${c.name}`, 'aria-haspopup': 'menu', onclick: (e) => channelMenu(app, s, c, e.currentTarget) }, icon('gear', { size: 16 })),
    people.length
      ? h(
          'ul',
          { class: 'vc-users' },
          people.map((p) =>
            h(
              'li',
              { class: `vc-user${app.media.isSpeaking(p.id) && app.media.inVoice(s, c.id) ? ' speaking' : ''}` },
              avatarImg(p.avatar, { size: 24 }),
              h('span', { class: 'vc-name' }, p.name),
              p.screen ? h('span', { class: 'live-tag' }, 'LIVE') : null,
              p.camera ? icon('camera', { size: 14, cls: 'vc-ico' }) : null,
              p.deafened ? icon('headphones-off', { size: 14, cls: 'vc-ico red' }) : p.muted ? icon('mic-off', { size: 14, cls: 'vc-ico red' }) : null,
            ),
          ),
        )
      : null,
  );
}

/** Members in a voice channel, me first. */
export function voiceMembers(app, s, channelId) {
  const out = [];
  const mine = app.media.stateFor(s);
  if (mine && mine.channel === channelId) out.push({ ...app.profile, ...mine, self: true });
  for (const [peerId, v] of s.voice) {
    if (v.channel !== channelId) continue;
    const m = s.member(peerId);
    out.push({ id: peerId, name: m?.name || app.t('chat.unknown'), avatar: m?.avatar || peerId, ...v });
  }
  return out;
}

function voicePanel(app) {
  const t = app.t;
  const cur = app.media.current;
  if (!cur) return null;
  const s = cur.session;
  const ch = s.den.channels.find((c) => c.id === cur.channel);
  return h(
    'div',
    { class: 'voice-panel' },
    h(
      'div',
      { class: 'vp-row' },
      h(
        'button',
        { class: 'vp-info', type: 'button', onclick: () => app.openDen(s.id, cur.channel) },
        h('span', { class: 'vp-status' }, icon('signal', { size: 16 }), t('voice.connected')),
        h('span', { class: 'vp-where' }, `${ch?.name || ''} / ${s.den.name}`),
      ),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('voice.disconnect'), 'data-tip': t('voice.disconnect'), onclick: () => app.media.leave() }, icon('hangup', { size: 20 })),
    ),
    h(
      'div',
      { class: 'vp-actions' },
      h('button', { class: `vp-btn${app.media.camera ? ' on' : ''}`, type: 'button', 'aria-pressed': String(!!app.media.camera), 'aria-label': t(app.media.camera ? 'voice.cameraOff' : 'voice.camera'), onclick: () => app.media.toggleCamera() }, icon(app.media.camera ? 'camera' : 'camera-off', { size: 18 })),
      h('button', { class: `vp-btn${app.media.screen ? ' on' : ''}`, type: 'button', 'aria-pressed': String(!!app.media.screen), 'aria-label': t(app.media.screen ? 'voice.screenOff' : 'voice.screen'), onclick: () => app.media.toggleScreen() }, icon('screen', { size: 18 })),
    ),
  );
}

function userPanel(app) {
  const t = app.t;
  const m = app.media;
  const ptt = app.settings.inputMode === 'ptt';
  return h(
    'section',
    { class: 'user-panel', 'aria-label': t('user.settings') },
    h(
      'button',
      { class: 'up-me', type: 'button', onclick: () => app.openSettings('profile') },
      h('span', { class: 'avatar-wrap s32' }, avatarImg(app.profile.avatar, { size: 32, speaking: m.isSpeaking(app.profile.id) && !!m.current }), h('span', { class: `status-dot ${app.settings.dnd ? 'dnd' : 'on'}` })),
      h('span', { class: 'up-text' }, h('span', { class: 'up-name' }, app.profile.name), h('span', { class: 'up-sub' }, app.settings.dnd ? t('sound.dnd') : ptt ? t('voice.pttHint', { key: keyName(app.settings.pttKey) }) : t('user.online'))),
    ),
    h(
      'div',
      { class: 'up-actions' },
      h('button', { class: `icon-btn${m.muted || m.deafened ? ' red' : ''}`, type: 'button', 'aria-pressed': String(m.muted || m.deafened), 'aria-label': t(m.muted || m.deafened ? 'voice.unmute' : 'voice.mute'), 'data-tip': t(m.muted || m.deafened ? 'voice.unmute' : 'voice.mute'), onclick: () => m.toggleMute() }, icon(m.muted || m.deafened ? 'mic-off' : 'mic', { size: 20 })),
      h('button', { class: `icon-btn${m.deafened ? ' red' : ''}`, type: 'button', 'aria-pressed': String(m.deafened), 'aria-label': t(m.deafened ? 'voice.undeafen' : 'voice.deafen'), 'data-tip': t(m.deafened ? 'voice.undeafen' : 'voice.deafen'), onclick: () => m.toggleDeafen() }, icon(m.deafened ? 'headphones-off' : 'headphones', { size: 20 })),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('user.settings'), 'data-tip': t('user.settings'), onclick: () => app.openSettings() }, icon('gear', { size: 20 })),
    ),
  );
}

export function keyName(code) {
  if (!code) return '';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const names = { Backquote: '`', Space: 'Space', ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Left Alt', AltRight: 'Right Alt', CapsLock: 'Caps Lock' };
  return names[code] || code;
}

function denMenu(app, anchor) {
  const t = app.t;
  const s = app.activeDen;
  popover(
    anchor,
    menu([
      { label: t('den.invite'), icon: 'invite', brand: true, run: () => app.inviteFlow(s) },
      { label: t('den.settings'), icon: 'gear', run: () => app.denSettingsFlow(s) },
      { label: t('den.createChannel'), icon: 'plus', run: () => app.createChannelFlow(s, 'text') },
      '-',
      s.status !== 'offline' ? { label: t('den.disconnect'), icon: 'logout', run: () => s.leave() } : null,
      { label: t('den.remove'), icon: 'trash', danger: true, run: () => app.removeDenFlow(s) },
    ]),
    { className: 'den-menu' },
  );
}

function idBadgeLine(app, s, peerId) {
  const st = s.identityOf(peerId);
  if (!st?.status || st.status === 'pending') return null;
  const t = app.t;
  if (st.status !== 'verified') return h('p', { class: 'card-tag bad' }, icon('warning', { size: 14 }), t('id.failed'));
  if (st.friend === 'name-clash') return h('p', { class: 'card-tag bad' }, icon('warning', { size: 14 }), t('id.nameClash'));
  return h('p', { class: `card-tag ${st.friend === 'known' ? 'ok' : ''}` }, icon('shield', { size: 14 }), t(st.friend === 'known' ? 'id.verified' : 'id.newPerson'));
}

// Header

export function renderHeader(app, el) {
  const t = app.t;
  const s = app.activeDen;
  const menuBtn = h('button', { class: 'icon-btn only-mobile', type: 'button', 'aria-label': t('common.menu'), onclick: () => app.drawer('left') }, icon('menu', { size: 22 }));
  if (!s) {
    replace(el, menuBtn, h('span', { class: 'hd-ico' }, icon('logo', { size: 22 })), h('h1', { class: 'hd-title' }, t('app.home')));
    return;
  }
  const c = s.den.channels.find((x) => x.id === app.channelId);
  const status = s.status === 'online' ? t('den.online', { n: s.mesh.links.size + 1 }) : s.status === 'alone' ? t('den.alone') : t('den.offline');
  replace(
    el,
    menuBtn,
    h('span', { class: 'hd-ico' }, icon(app.view === 'voice' ? 'speaker' : 'hash', { size: 22 })),
    h('h1', { class: 'hd-title' }, c?.name || t('channel.empty')),
    h('span', { class: 'hd-divider', 'aria-hidden': 'true' }),
    h('span', { class: `hd-status ${s.status}` }, h('span', { class: `dot ${s.status}` }), status, s.den.locked ? h('span', { class: 'hd-lock', title: t('den.locked') }, icon('lock', { size: 14 })) : null),
    h('span', { class: `hd-count${s.onlineCount >= s.maxMembers ? ' full' : ''}`, title: t('den.countLabel', { count: s.onlineCount, max: s.maxMembers }), 'aria-label': t('den.countLabel', { count: s.onlineCount, max: s.maxMembers }) }, icon('members', { size: 14 }), t('den.count', { count: s.onlineCount, max: s.maxMembers })),
    h('span', { class: 'hd-spacer' }),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('den.invite'), 'data-tip': t('den.invite'), onclick: () => app.inviteFlow(s) }, icon('invite', { size: 22 })),
    h('button', { class: `icon-btn${app.showMembers ? ' on' : ''}`, type: 'button', 'aria-pressed': String(app.showMembers), 'aria-label': t('members.toggle'), 'data-tip': t('members.toggle'), onclick: () => app.toggleMembers() }, icon('members', { size: 22 })),
  );
}

// Member list

export function renderMembers(app, el) {
  const t = app.t;
  const s = app.activeDen;
  if (!s) return replace(el);
  const list = s.members();
  const online = list.filter((m) => m.online);
  const offline = list.filter((m) => !m.online);
  const row = (m) =>
    h(
      'li',
      null,
      h(
        'button',
        { class: `member${m.online ? '' : ' away'}`, type: 'button', 'aria-haspopup': 'dialog', onclick: (e) => memberCard(app, s, m, e.currentTarget) },
        avatarWithStatus(m, 32, app),
        h(
          'span',
          { class: 'member-text' },
          h('span', { class: 'member-name', style: { color: colorOf(m) } }, m.name, m.id === app.profile.id ? h('span', { class: 'member-you' }, ` (${t('members.you')})`) : null),
          s.voice.get(m.id) || (m.id === app.profile.id && app.media.inVoice(s)) ? h('span', { class: 'member-sub' }, icon('speaker', { size: 12 }), t('members.inVoice')) : m.status ? h('span', { class: 'member-sub' }, m.status) : null,
        ),
        m.id === app.profile.id ? null : idBadge(app, s, m.id),
        s.relay === m.id && m.online ? h('span', { class: 'relay-badge', title: t('members.relayHint'), 'aria-label': t('members.relay') }, icon('relay', { size: 14 })) : null,
      ),
    );
  replace(
    el,
    h('h2', { class: 'members-head', 'aria-label': t('den.countLabel', { count: online.length, max: s.maxMembers }) }, t('members.online', { n: t('den.count', { count: online.length, max: s.maxMembers }) })),
    h('ul', { class: 'member-list' }, online.map(row)),
    offline.length ? h('h2', { class: 'members-head' }, t('members.offline', { n: offline.length })) : null,
    offline.length ? h('ul', { class: 'member-list' }, offline.map(row)) : null,
  );
}

/** Profile card with fingerprint, route and volume. */
export function memberCard(app, s, m, anchor) {
  const t = app.t;
  const self = m.id === app.profile.id;
  const link = s.mesh?.links.get(m.id);
  const fp = h('code', { class: 'fp' }, link ? '...' : t('members.notLinked'));
  const route = h('span', null, link ? '...' : t('members.notLinked'));
  if (link) {
    link.fingerprint().then((v) => (fp.textContent = v || t('members.notLinked')));
    link.stats().then((st) => (route.textContent = st.route === 'relay' ? t('members.relayed') : t('members.direct')));
  }
  const vol = self
    ? null
    : h(
        'label',
        { class: 'card-field' },
        h('span', { class: 'card-label' }, `${t('members.volume')}`),
        h('input', { class: 'range', type: 'range', min: 0, max: 100, value: app.media.volumeOf(m.id), oninput: (e) => app.media.setVolume(m.id, Number(e.target.value)) }),
      );
  popover(
    anchor,
    h(
      'div',
      { class: 'm-card' },
      h('div', { class: 'card-banner', style: { '--den-hue': avatarTraits(m.avatar || m.id).hue, background: m.accent || null } }),
      h('div', { class: 'card-avatar' }, avatarWithStatus(m, 80, app)),
      h('div', { class: 'card-inner' }, h('h3', { class: 'card-name' }, m.name, h('span', { class: 'friend-tag' }, `#${m.id.slice(0, 4)}`)), m.status ? h('p', { class: 'card-status' }, m.status) : null, self ? null : idBadgeLine(app, s, m.id), s.relay === m.id ? h('p', { class: 'card-tag' }, icon('relay', { size: 14 }), t('members.relay')) : null, s.verified.has(m.id) ? h('p', { class: 'card-tag ok' }, icon('shield', { size: 14 }), t('members.verified')) : null),
      self
        ? null
        : h(
            'div',
            { class: 'card-inner card-sec' },
            h('div', { class: 'card-field' }, h('span', { class: 'card-label' }, t('members.fingerprint')), fp, h('span', { class: 'card-hint' }, t('members.fingerprintHint', { name: m.name }))),
            h('div', { class: 'card-field' }, h('span', { class: 'card-label' }, t('members.route')), route),
            vol,
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => (closePopover(), app.mention(m)) }, icon('at', { size: 16 }), t('members.mention')),
          ),
    ),
    { placement: anchor.closest('.members') ? 'left' : 'right', className: 'member-pop' },
  );
}
