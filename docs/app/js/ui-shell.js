// The frame around the chat: den rail, channel sidebar, header, member list,
// voice panel and user panel, plus menus and popouts.

import { h, replace } from './dom.js';
import { icon } from './icons.js';
import { avatarTraits, nameColor } from '../core/avatar.js';
import { avatarSrc } from './ui-account.js';
import { renderHomeSide } from './ui-home.js';
import { DM_TEXT } from './session.js';
import { visibleChannels } from '../core/denstate.js';
import { activeStatus } from '../core/mesh.js';
import { openMenu } from './menu.js';
import { notifyItems } from './ui-context.js';
import { promptDialog } from './ui-modal.js';

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

// Rail

function railItem({ label, active, unread, mention, content, cls = '', onclick, offline, hue, den }) {
  return h(
    'div',
    { class: `rail-item${active ? ' active' : ''}${unread ? ' unread' : ''}${offline ? ' offline' : ''} ${cls}`, style: hue != null ? { '--den-hue': hue } : null, dataset: den ? { den } : null },
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
        den: s.id,
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
      const collapsed = !!s.den.collapsed?.[kind];
      const listId = `cat-${s.id}-${kind}`;
      nav.append(
        h(
          'div',
          { class: `cat${collapsed ? ' collapsed' : ''}` },
          h(
            'button',
            { class: 'cat-toggle', type: 'button', 'aria-expanded': String(!collapsed), 'aria-controls': listId, onclick: () => (s.setLocal('collapsed', { ...s.den.collapsed, [kind]: !collapsed }), app.render()) },
            icon('chevron-down', { size: 12, cls: 'cat-chev' }),
            h('span', { class: 'cat-label' }, t(kind === 'text' ? 'den.textChannels' : 'den.voiceChannels')),
          ),
          h('button', { class: 'icon-btn cat-add', type: 'button', 'aria-label': t(kind === 'text' ? 'den.addText' : 'den.addVoice'), 'data-tip': t(kind === 'text' ? 'den.addText' : 'den.addVoice'), onclick: () => app.createChannelFlow(s, kind) }, icon('plus', { size: 16 })),
        ),
      );
      // A collapsed category still shows the open channel and the one I am talking in.
      const group = h('div', { class: 'cat-list', id: listId });
      for (const c of visibleChannels(s.den, kind)) {
        const keep = !collapsed || app.channelId === c.id || app.media.inVoice(s, c.id) || (kind === 'text' && s.unread(c.id).mention);
        if (keep) group.append(kind === 'text' ? textChannel(app, s, c) : voiceChannel(app, s, c));
      }
      nav.append(group);
    }
    parts.push(nav);
  }
  parts.push(voicePanel(app), userPanel(app));
  replace(el, parts);
}

function channelMenu(app, s, c, anchor) {
  const t = app.t;
  openMenu(
    [
      c.kind === 'text' ? { label: t('channel.ctx.mute'), icon: 'bell-off', checked: s.isMuted(c.id), run: () => s.setMuted(c.id, !s.isMuted(c.id)) } : null,
      { label: t('channel.ctx.notifications'), icon: 'bell', items: () => notifyItems(app, s) },
      '-',
      { label: t('den.renameChannel'), icon: 'edit', run: () => app.renameChannelFlow(s, c) },
      { label: t('den.deleteChannel'), icon: 'trash', danger: true, run: () => app.deleteChannelFlow(s, c) },
    ],
    { anchor, placement: 'right', label: c.name },
  );
}

function rowTools(app, s, c) {
  const t = app.t;
  return h(
    'span',
    { class: 'ch-tools' },
    h('button', { class: 'icon-btn ch-tool', type: 'button', 'aria-label': `${t('den.invite')}: ${c.name}`, 'data-tip': t('den.invite'), onclick: () => app.inviteFlow(s) }, icon('invite', { size: 16 })),
    h('button', { class: 'icon-btn ch-gear', type: 'button', 'aria-label': `${app.t('den.channelSettings')}: ${c.name}`, 'data-tip': t('den.channelSettings'), 'aria-haspopup': 'menu', onclick: (e) => channelMenu(app, s, c, e.currentTarget) }, icon('gear', { size: 16 })),
  );
}

function textChannel(app, s, c) {
  const active = app.view === 'chat' && app.channelId === c.id;
  const u = s.unread(c.id);
  const muted = s.isMuted(c.id);
  const draft = !active && !!s.den.drafts?.[c.id];
  return h(
    'div',
    { class: `ch-row${active ? ' active' : ''}${u.count && !active && !muted ? ' unread' : ''}${muted ? ' muted' : ''}`, dataset: { channel: c.id } },
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
      draft ? icon('edit', { size: 14, cls: 'ch-draft', label: app.t('channel.draft') }) : null,
      muted ? icon('bell-off', { size: 14, cls: 'ch-muted', label: app.t('channel.ctx.muted') }) : null,
      u.mention && !active ? h('span', { class: 'badge-count', 'aria-label': `${u.mention}` }, String(u.mention)) : null,
    ),
    rowTools(app, s, c),
  );
}

function voiceChannel(app, s, c) {
  const active = app.view === 'voice' && app.channelId === c.id;
  const inHere = app.media.inVoice(s, c.id);
  const people = voiceMembers(app, s, c.id);
  return h(
    'div',
    { class: `ch-row voice${active ? ' active' : ''}${inHere ? ' joined' : ''}`, dataset: { channel: c.id } },
    h(
      'button',
      { class: 'ch', type: 'button', 'aria-current': active ? 'page' : null, onclick: () => app.openVoice(c.id, true) },
      icon('speaker', { size: 20, cls: 'ch-ico' }),
      h('span', { class: 'ch-name' }, c.name),
      people.length ? h('span', { class: 'ch-count', 'aria-label': app.t('app.switch.inVoice', { n: people.length }) }, String(people.length)) : null,
    ),
    rowTools(app, s, c),
    people.length
      ? h(
          'ul',
          { class: 'vc-users' },
          people.map((p) =>
            h(
              'li',
              { class: `vc-user${app.media.isSpeaking(p.id) && app.media.inVoice(s, c.id) ? ' speaking' : ''}`, tabindex: '0', dataset: { member: p.self ? app.profile.id : p.id, memberName: p.name } },
              avatarImg(p.avatar, { size: 24 }),
              h('span', { class: 'vc-name' }, p.name),
              p.rec ? h('span', { class: 'rec-dot', role: 'img', 'aria-label': app.t('voice.rec.tag'), title: app.t('voice.rec.tag') }) : null,
              p.screen ? h('span', { class: 'live-tag' }, 'LIVE') : null,
              p.music ? icon('music', { size: 14, cls: 'vc-ico', label: app.t('voice.music.tag') }) : null,
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
  const m = app.media;
  const quiet = m.processing === 'off';
  const tile = (label, ico, onclick, on, extra = {}) => h('button', { class: `vp-btn${on ? ' on' : ''}`, type: 'button', 'aria-label': label, 'data-tip': label, 'aria-pressed': on == null ? null : String(!!on), onclick, ...extra }, icon(ico, { size: 20 }));
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
        h('span', { class: 'vp-where' }, s.isDirect ? s.den.name : `${ch?.name || ''} / ${s.den.name}`),
      ),
      h('span', { class: `vp-wave${quiet ? '' : ' on'}`, role: 'img', 'aria-label': t(`voice.noise.${m.processing === 'music' ? 'off' : m.processing || 'strong'}`), title: t('voice.ctx.noise', { mode: t(`voice.noise.${m.processing === 'music' ? 'off' : m.processing || 'strong'}`) }) }, icon('wave', { size: 18 })),
      h('button', { class: 'icon-btn vp-hang', type: 'button', 'aria-label': t('voice.disconnect'), 'data-tip': t('voice.disconnect'), onclick: () => app.media.leave() }, icon('hangup', { size: 20 })),
    ),
    h(
      'div',
      { class: 'vp-actions' },
      tile(t(m.camera ? 'voice.cameraOff' : 'voice.camera'), m.camera ? 'camera' : 'camera-off', () => m.toggleCamera(), !!m.camera),
      tile(t(m.screen ? 'voice.screenOff' : 'voice.screen'), 'screen', () => m.toggleScreen(), !!m.screen),
      tile(t('voice.react'), 'react', (e) => app.burstBar?.(e.currentTarget, s), null, { 'aria-haspopup': 'menu' }),
      tile(t('voice.popout'), 'popout', () => app.popOutCall?.(), !!app.callPopped?.()),
    ),
  );
}

/** Choose the microphone, the speakers or the camera, from the call controls or the user panel. */
export async function deviceMenu(app, anchor, kind) {
  const t = app.t;
  const m = app.media;
  const d = await m.devices();
  const s = app.settings;
  const pick = (list, key, apply, fallback) => {
    const items = list.filter((x) => x.deviceId && x.deviceId !== 'default' && x.deviceId !== 'communications');
    return [
      { label: t('voice.ctx.systemDefault'), checked: !s[key], radio: true, run: () => apply('') },
      ...items.map((x, i) => ({ label: x.label || `${fallback} ${i + 1}`, checked: s[key] === x.deviceId, radio: true, run: () => apply(x.deviceId) })),
    ];
  };
  const items =
    kind === 'camera'
      ? [{ heading: t('settings.cameraDevice') }, ...pick(d.videoinput, 'cameraId', async (v) => ((s.cameraId = v), app.saveSettings(), m.camera && (await m.toggleCamera(), await m.toggleCamera())), t('settings.cameraDevice')), '-', { label: t('voice.ctx.voiceSettings'), icon: 'gear', run: () => app.openSettings('voice') }]
      : [
          { heading: t('settings.input') },
          ...pick(d.audioinput, 'inputId', (v) => ((s.inputId = v), app.saveSettings(), m.restartMic()), t('settings.input')),
          '-',
          { heading: t('settings.output') },
          ...pick(d.audiooutput, 'outputId', (v) => m.setOutput(v), t('settings.output')),
          '-',
          { label: t('voice.noise.title'), icon: 'wave', items: () => ['off', 'standard', 'strong'].map((k) => ({ label: t(`voice.noise.${k}`), checked: m.noiseMode === k, radio: true, run: () => ((s.noiseMode = k), app.saveSettings(), m.restartMic()) })) },
          { label: t('voice.ctx.voiceSettings'), icon: 'gear', run: () => app.openSettings('voice') },
        ];
  openMenu(items, { anchor, placement: anchor.closest('.stage') ? 'above' : 'right', label: kind === 'camera' ? t('settings.cameraDevice') : t('settings.input'), className: 'device-menu' });
}

/** The menu on my own card: status, do not disturb, profile. */
function meMenu(app, anchor) {
  const t = app.t;
  const p = app.profile;
  const set = (status, minutes) => app.updateProfile({ status, statusUntil: minutes ? Date.now() + minutes * 60000 : 0 });
  const status = activeStatus(p);
  openMenu(
    [
      { heading: status ? t('user.ctx.statusNow', { status }) : t('user.online') },
      { label: t(status ? 'user.ctx.editStatus' : 'user.ctx.setStatus'), icon: 'chat', run: async () => {
        const v = await promptDialog(t, { title: t('user.ctx.setStatus'), label: t('profile.status'), value: status, ok: t('common.save'), maxlength: 128 });
        if (v != null) set(v.trim(), 0);
      } },
      status ? { label: t('user.ctx.clearStatus'), icon: 'x', run: () => set('', 0) } : null,
      { label: t('user.ctx.quickStatus'), icon: 'clock', items: () => [
        { label: t('user.ctx.qsBrb'), run: () => set(t('user.ctx.qsBrb'), 30) },
        { label: t('user.ctx.qsFocus'), run: () => set(t('user.ctx.qsFocus'), 60) },
        { label: t('user.ctx.qsGaming'), run: () => set(t('user.ctx.qsGaming'), 240) },
        { label: t('user.ctx.qsAway'), run: () => set(t('user.ctx.qsAway'), 0) },
      ] },
      '-',
      { label: t('sound.dnd'), icon: 'bell-off', checked: !!app.settings.dnd, run: () => ((app.settings.dnd = !app.settings.dnd), app.saveSettings(), app.render()) },
      '-',
      { label: t('members.ctx.editProfile'), icon: 'user', run: () => app.openSettings('profile') },
      { label: t('app.keys.title'), icon: 'keyboard', keys: 'Ctrl+/', run: () => app.shortcuts?.() },
    ],
    { anchor, placement: 'above', label: p.name },
  );
}

function userPanel(app) {
  const t = app.t;
  const m = app.media;
  const ptt = app.settings.inputMode === 'ptt';
  const status = activeStatus(app.profile);
  const muted = m.muted || m.deafened;
  return h(
    'section',
    { class: 'user-panel', 'aria-label': t('user.settings') },
    h(
      'button',
      { class: 'up-me', type: 'button', 'aria-haspopup': 'menu', 'aria-label': t('user.ctx.title', { name: app.profile.name }), onclick: (e) => meMenu(app, e.currentTarget), dataset: { member: app.profile.id } },
      h('span', { class: 'avatar-wrap s32' }, avatarImg(app.profile.avatar, { size: 32, speaking: m.isSpeaking(app.profile.id) && !!m.current }), h('span', { class: `status-dot ${app.settings.dnd ? 'dnd' : 'on'}` })),
      h('span', { class: 'up-text' }, h('span', { class: 'up-name' }, app.profile.name), h('span', { class: 'up-sub' }, app.settings.dnd ? t('sound.dnd') : ptt ? t('voice.pttHint', { key: keyName(app.settings.pttKey) }) : status || t('user.online'))),
    ),
    h(
      'div',
      { class: 'up-actions' },
      h(
        'span',
        { class: `up-split${muted ? ' red' : ''}` },
        h('button', { class: `icon-btn${muted ? ' red' : ''}`, type: 'button', 'aria-pressed': String(muted), 'aria-label': t(muted ? 'voice.unmute' : 'voice.mute'), 'data-tip': t(muted ? 'voice.unmute' : 'voice.mute'), onclick: () => m.toggleMute() }, icon(muted ? 'mic-off' : 'mic', { size: 20 })),
        h('button', { class: 'icon-btn up-chev', type: 'button', 'aria-haspopup': 'menu', 'aria-label': t('voice.ctx.devices'), 'data-tip': t('voice.ctx.devices'), onclick: (e) => deviceMenu(app, e.currentTarget, 'mic') }, icon('chevron-up', { size: 14 })),
      ),
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
  const u = s.unreadTotal();
  openMenu(
    [
      { label: t('den.invite'), icon: 'invite', brand: true, run: () => app.inviteFlow(s) },
      { label: t('den.settings'), icon: 'gear', run: () => app.denSettingsFlow(s) },
      { label: t('den.createChannel'), icon: 'plus', run: () => app.createChannelFlow(s, 'text') },
      '-',
      { label: t('channel.ctx.markAllRead'), icon: 'check', disabled: !u.count && !u.mention, run: () => s.markAllRead() },
      { label: t('channel.ctx.notifications'), icon: 'bell', items: () => notifyItems(app, s) },
      '-',
      s.status !== 'offline' ? { label: t('den.disconnect'), icon: 'logout', run: () => s.leave() } : null,
      { label: t('den.remove'), icon: 'trash', danger: true, run: () => app.removeDenFlow(s) },
    ],
    { anchor, label: s.den.name, className: 'den-menu' },
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
    app.view === 'chat' ? chatTools(app) : null,
    h('button', { class: 'icon-btn hd-invite', type: 'button', 'aria-label': t('den.invite'), 'data-tip': t('den.invite'), onclick: () => app.inviteFlow(s) }, icon('invite', { size: 22 })),
    h('button', { class: `icon-btn${app.showMembers ? ' on' : ''}`, type: 'button', 'aria-pressed': String(app.showMembers), 'aria-label': t('members.toggle'), 'data-tip': t('members.toggle'), onclick: () => app.toggleMembers() }, icon('members', { size: 22 })),
  );
}

/** Search, pins, and a small menu with the file gallery and saved messages. */
export function chatTools(app) {
  const t = app.t;
  const open = app.chatPanelKind?.();
  const tool = (kind, ico, label) => h('button', { class: `icon-btn hd-tool tool-${kind}${open === kind ? ' on' : ''}`, type: 'button', 'aria-pressed': String(open === kind), 'aria-label': label, 'data-tip': label, onclick: () => app.chatPanel(kind) }, icon(ico, { size: 22 }));
  return [
    tool('search', 'search', t('search.title')),
    tool('pins', 'pin', t('pins.title')),
    h(
      'button',
      {
        class: `icon-btn hd-tool${open === 'gallery' || open === 'saved' ? ' on' : ''}`,
        type: 'button',
        'aria-haspopup': 'menu',
        'aria-label': t('chat.moreTools'),
        'data-tip': t('chat.moreTools'),
        onclick: (e) =>
          openMenu(
            [
              { label: t('pins.title'), icon: 'pin', run: () => app.chatPanel('pins') },
              { label: t('gallery.title'), icon: 'image', run: () => app.chatPanel('gallery') },
              { label: t('saved.title'), icon: 'bookmark', run: () => app.chatPanel('saved') },
              '-',
              { label: t('app.switch.title'), icon: 'search', keys: 'Ctrl+K', run: () => app.switcher?.() },
              { label: t('app.keys.title'), icon: 'keyboard', keys: 'Ctrl+/', run: () => app.shortcuts?.() },
            ],
            { anchor: e.currentTarget, label: t('chat.moreTools') },
          ),
      },
      icon('dots', { size: 22 }),
    ),
  ];
}

// Info panel: the den or friend, notifications, shared media and the member list

function sharedMedia(app, s) {
  const t = app.t;
  const tab = app.infoTab || 'media';
  const recs = [...s.messages.values()].filter((r) => !r.deleted && r.files?.length).sort((a, b) => b.ts - a.ts);
  const images = [];
  const files = [];
  for (const r of recs) for (const f of r.files) (/^image\//.test(f.type) && !f.voice ? images : files).push({ r, f });
  const tabBtn = (key, label, n) => h('button', { class: `info-tab${tab === key ? ' active' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(tab === key), onclick: () => ((app.infoTab = key), app.render()) }, label, n ? h('span', { class: 'info-n' }, String(n)) : null);
  let body;
  if (tab === 'media') {
    const shown = images.slice(0, 6);
    const more = images.length - shown.length;
    body = shown.length
      ? h(
          'div',
          { class: 'info-media' },
          shown.map(({ f }, i) => {
            const url = s.fileUrl(f.id);
            const last = more > 0 && i === shown.length - 1;
            return h(
              'button',
              { class: 'info-thumb', type: 'button', 'aria-label': last ? t('info.more', { n: more }) : f.name, dataset: { file: f.id, den: s.id }, onclick: () => (last ? app.chatPanel('gallery') : url ? app.lightbox?.(f, url) : null) },
              f.thumb || url ? h('img', { src: url || f.thumb, alt: '', loading: 'lazy' }) : icon('image', { size: 22 }),
              last ? h('span', { class: 'img-more' }, `+${more}`) : null,
            );
          }),
        )
      : h('p', { class: 'info-empty' }, t('info.noMedia'));
  } else {
    body = files.length
      ? h(
          'ul',
          { class: 'info-files' },
          files.slice(0, 6).map(({ f }) => h('li', { dataset: { file: f.id, den: s.id } }, icon(f.voice ? 'mic' : 'file', { size: 18 }), h('span', { class: 'info-file-name' }, f.voice ? t('voice.msg.title') : f.name), h('small', { class: 'muted' }, formatBytes(f.size)))),
        )
      : h('p', { class: 'info-empty' }, t('info.noFiles'));
  }
  return h('section', { class: 'info-sec' }, h('h3', { class: 'info-title' }, t('info.shared')), h('div', { class: 'info-tabs', role: 'tablist' }, tabBtn('media', t('info.media'), images.length), tabBtn('files', t('info.files'), files.length)), body);
}

function formatBytes(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function infoHead(app, s) {
  const t = app.t;
  const level = s.notifyLevel;
  const on = level !== 'none';
  const notify = h(
    'label',
    { class: 'info-row' },
    icon(on ? 'bell' : 'bell-off', { size: 18 }),
    h('span', null, t('info.notifications')),
    h('input', { class: 'toggle', type: 'checkbox', checked: on, 'aria-label': t('info.notifications'), onchange: (e) => (s.setLocal('notify', e.target.checked ? 'default' : 'none'), s.emit('unread')) }),
  );
  if (s.isDirect) {
    const f = app.friends.get(s.den.peer) || s.member(s.den.peer) || { id: s.den.peer, name: s.den.name };
    return [
      h('div', { class: 'info-hero' }, h('span', { class: 'avatar-wrap s80' }, avatarImg(f.avatar || f.id, { size: 72 })), h('h2', { class: 'info-name' }, f.name), activeStatus(f) ? h('p', { class: 'info-sub' }, activeStatus(f)) : null),
      h('section', { class: 'info-sec' }, notify),
    ];
  }
  const hue = avatarTraits(s.id).hue;
  return [
    h('div', { class: 'info-hero' }, h('span', { class: 'info-den', style: { '--den-hue': hue } }, initials(s.den.name)), h('h2', { class: 'info-name' }, s.den.name), h('p', { class: 'info-sub' }, t('info.members', { n: s.members().length, max: s.maxMembers }))),
    h('section', { class: 'info-sec' }, notify, h('button', { class: 'info-row', type: 'button', onclick: () => app.inviteFlow(s) }, icon('invite', { size: 18 }), h('span', null, t('den.invite')), icon('chevron-right', { size: 16 }))),
  ];
}

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
        { class: `member${m.online ? '' : ' away'}`, type: 'button', 'aria-haspopup': 'dialog', dataset: { member: m.id, memberName: m.name }, onclick: (e) => memberCard(app, s, m, e.currentTarget) },
        avatarWithStatus(m, 32, app),
        h(
          'span',
          { class: 'member-text' },
          h('span', { class: 'member-name', style: { color: colorOf(m) } }, m.name, m.id === app.profile.id ? h('span', { class: 'member-you' }, ` (${t('members.you')})`) : null),
          s.voice.get(m.id) || (m.id === app.profile.id && app.media.inVoice(s)) ? h('span', { class: 'member-sub' }, icon('speaker', { size: 12 }), t('members.inVoice')) : activeStatus(m) ? h('span', { class: 'member-sub' }, activeStatus(m)) : null,
        ),
        m.id === app.profile.id ? null : idBadge(app, s, m.id),
        s.relay === m.id && m.online ? h('span', { class: 'relay-badge', title: t('members.relayHint'), 'aria-label': t('members.relay') }, icon('relay', { size: 14 })) : null,
      ),
    );
  replace(
    el,
    infoHead(app, s),
    sharedMedia(app, s),
    s.isDirect ? null : h('h2', { class: 'members-head', 'aria-label': t('den.countLabel', { count: online.length, max: s.maxMembers }) }, t('members.online', { n: t('den.count', { count: online.length, max: s.maxMembers }) })),
    s.isDirect ? null : h('ul', { class: 'member-list' }, online.map(row)),
    offline.length && !s.isDirect ? h('h2', { class: 'members-head' }, t('members.offline', { n: offline.length })) : null,
    offline.length && !s.isDirect ? h('ul', { class: 'member-list' }, offline.map(row)) : null,
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
      h('div', { class: 'card-inner' }, h('h3', { class: 'card-name' }, m.name, h('span', { class: 'friend-tag' }, `#${m.id.slice(0, 4)}`)), activeStatus(m) ? h('p', { class: 'card-status' }, activeStatus(m)) : null, self ? null : idBadgeLine(app, s, m.id), s.relay === m.id ? h('p', { class: 'card-tag' }, icon('relay', { size: 14 }), t('members.relay')) : null, s.verified.has(m.id) ? h('p', { class: 'card-tag ok' }, icon('shield', { size: 14 }), t('members.verified')) : null),
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
