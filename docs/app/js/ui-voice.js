// The voice stage: a grid of participants with cameras and screen shares, a
// focused view, speaking rings, live reactions, the recording notice, a hold
// to talk button for touch screens and the call controls.

import { h, replace } from './dom.js';
import { icon, reactionIcon } from './icons.js';
import { avatarImg, closePopover, popover, voiceMembers } from './ui-shell.js';
import { confirmDialog } from './ui-modal.js';
import { avatarTraits } from '../core/avatar.js';
import { REACTIONS } from '../core/history.js';
import { formatDuration } from '../core/call.js';

export function createVoice(app) {
  const t = (k, v) => app.t(k, v);
  const grid = h('div', { class: 'stage-grid' });
  const strip = h('div', { class: 'stage-strip', role: 'list' });
  const empty = h('div', { class: 'stage-empty' });
  const controls = h('div', { class: 'stage-controls' });
  const notice = h('div', { class: 'stage-notice', role: 'status', hidden: true });
  const bursts = h('div', { class: 'stage-bursts', 'aria-hidden': 'true' });
  // The talk button lives outside the controls so a refresh never drops a press in progress.
  const pttBtn = h('button', { class: 'ptt-btn', type: 'button', 'aria-pressed': 'false' }, icon('ptt', { size: 24 }), h('span', { class: 'ptt-label' }));
  const pttWrap = h('div', { class: 'ptt-wrap', hidden: true }, pttBtn);
  const el = h('section', { class: 'stage', 'aria-label': 'Voice' }, notice, grid, empty, bursts, pttWrap, controls);
  let recTimer = null;
  const tiles = new Map();
  // focus: the tile in the big view. manual: what the user picked ('grid' or a key),
  // which wins over the automatic focus on a new screen share.
  const state = { session: null, channel: null, focus: null, manual: null };

  function tileFor(key, build) {
    let tile = tiles.get(key);
    if (!tile) {
      tile = build();
      tiles.set(key, tile);
    }
    return tile;
  }

  function setVideo(tile, stream, mirror) {
    const video = tile.querySelector('video');
    if (stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }
      video.hidden = false;
      video.classList.toggle('mirror', !!mirror);
      tile.classList.add('has-video');
    } else {
      if (video.srcObject) video.srcObject = null;
      video.hidden = true;
      tile.classList.remove('has-video');
    }
  }

  function makeTile(key) {
    const video = h('video', { autoplay: true, playsinline: true, muted: true, hidden: true });
    const focusBtn = h('button', { class: 'icon-btn tile-btn tile-focus', type: 'button' }, icon('focus', { size: 18 }));
    const fullBtn = h('button', { class: 'icon-btn tile-btn tile-full', type: 'button', 'aria-label': t('voice.fullscreen'), 'data-tip': t('voice.fullscreen') }, icon('expand', { size: 18 }));
    const pipBtn = h('button', { class: 'icon-btn tile-btn tile-pip', type: 'button', 'aria-label': t('voice.pip'), 'data-tip': t('voice.pip') }, icon('screen', { size: 18 }));
    const tile = h(
      'div',
      { class: 'tile', tabindex: '0', role: 'group', dataset: { key } },
      video,
      h('div', { class: 'tile-avatar' }),
      h('div', { class: 'tile-label' }),
      h('div', { class: 'tile-tools' }, pipBtn, fullBtn, focusBtn),
    );
    const toggle = () => {
      const focused = state.focus === key;
      state.manual = focused ? 'grid' : key;
      refresh();
    };
    focusBtn.addEventListener('click', toggle);
    tile.addEventListener('dblclick', (e) => {
      if (!e.target.closest('.tile-tools')) toggle();
    });
    tile.addEventListener('keydown', (e) => {
      if (e.target === tile && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        toggle();
      }
    });
    fullBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else (tile.requestFullscreen || tile.webkitRequestFullscreen)?.call(tile)?.catch?.(() => {});
    });
    pipBtn.addEventListener('click', async () => {
      try {
        if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
        else await video.requestPictureInPicture();
      } catch {
        // not allowed right now (no video yet, or the browser refuses)
      }
    });
    return tile;
  }

  function refresh() {
    const s = state.session;
    if (!s) return;
    const people = voiceMembers(app, s, state.channel);
    const inHere = app.media.inVoice(s, state.channel);
    const want = [];
    for (const p of people) {
      const self = !!p.self;
      const cam = self ? app.media.camera : app.media.remoteVideo(s, p.id, 'camera');
      const key = `${p.id}:cam`;
      const tile = tileFor(key, () => makeTile(key));
      tile.style.setProperty('--den-hue', avatarTraits(p.avatar || p.id).hue);
      tile.classList.toggle('speaking', app.media.isSpeaking(p.id) && inHere);
      replace(tile.querySelector('.tile-avatar'), avatarImg(p.avatar || p.id, { size: 80 }));
      replace(
        tile.querySelector('.tile-label'),
        p.rec ? h('span', { class: 'rec-dot', title: t('voice.rec.tag') }) : null,
        p.deafened ? icon('headphones-off', { size: 16, cls: 'red' }) : p.muted ? icon('mic-off', { size: 16, cls: 'red' }) : null,
        h('span', null, p.name),
        p.music ? h('span', { class: 'music-tag' }, icon('music', { size: 12 }), t('voice.music.tag')) : null,
      );
      tile.setAttribute('aria-label', `${p.name}${p.muted ? `, ${t('voice.muted')}` : ''}`);
      tile.querySelector('.tile-focus').setAttribute('aria-label', state.focus === key ? t('voice.grid') : t('voice.focus'));
      setVideo(tile, inHere || self ? cam : null, self);
      want.push(key);
      const screen = self ? app.media.screen : p.screen ? app.media.remoteVideo(s, p.id, 'screen') : null;
      if (screen && (inHere || self)) {
        const skey = `${p.id}:screen`;
        const st = tileFor(skey, () => makeTile(skey));
        st.classList.add('screen-tile');
        replace(st.querySelector('.tile-label'), h('span', { class: 'live-tag' }, 'LIVE'), h('span', null, t('voice.screenOf', { name: p.name })));
        st.setAttribute('aria-label', t('voice.screenOf', { name: p.name }));
        setVideo(st, screen, false);
        want.push(skey);
      }
    }
    for (const [key, tile] of tiles) {
      if (!want.includes(key)) {
        tile.querySelector('video').srcObject = null;
        tile.remove();
        tiles.delete(key);
      }
    }
    // A screen share takes the big view by itself, unless the user chose otherwise.
    const screens = want.filter((k) => k.endsWith(':screen'));
    if (state.manual && state.manual !== 'grid' && !want.includes(state.manual)) state.manual = null;
    if (state.manual === 'grid' && !screens.length) state.manual = null;
    state.focus = state.manual === 'grid' ? null : state.manual || screens[0] || null;
    const focused = !!state.focus && want.length > 1;
    el.classList.toggle('sharing', screens.length > 0);
    grid.classList.toggle('focused', focused);
    grid.dataset.count = String(want.length);
    for (const [key, tile] of tiles) {
      tile.classList.toggle('is-focus', focused && key === state.focus);
      const btn = tile.querySelector('.tile-focus');
      btn.setAttribute('aria-label', key === state.focus ? t('voice.grid') : t('voice.focus'));
      btn.dataset.tip = btn.getAttribute('aria-label');
      replace(btn, icon(key === state.focus && focused ? 'grid' : 'focus', { size: 18 }));
      tile.querySelector('.tile-pip').hidden = !tile.classList.contains('has-video') || !document.pictureInPictureEnabled;
    }
    if (focused) {
      const main = tiles.get(state.focus);
      if (grid.firstChild !== main) grid.prepend(main);
      if (main.nextSibling !== strip) main.after(strip);
      while (strip.nextSibling) strip.nextSibling.remove();
      const others = want.filter((k) => k !== state.focus).map((k) => tiles.get(k));
      others.forEach((tile, i) => {
        if (strip.children[i] !== tile) strip.insertBefore(tile, strip.children[i] || null);
      });
    } else {
      strip.remove();
      want.forEach((key, i) => {
        const tile = tiles.get(key);
        if (grid.children[i] !== tile) grid.insertBefore(tile, grid.children[i] || null);
      });
    }

    empty.hidden = people.length > 0;
    const c = s.den.channels.find((x) => x.id === state.channel);
    replace(empty, h('img', { class: 'empty-art', src: '../assets/art/characters/fang.svg', alt: '', width: 120, height: 120 }), h('h2', null, s.isDirect ? s.den.name : c?.name || ''), h('p', null, t('voice.emptyHint')));

    renderNotice(people);
    const m = app.media;
    if (!inHere) {
      pttWrap.hidden = true;
      replace(controls, h('button', { class: 'btn btn-success btn-lg', type: 'button', onclick: () => app.joinVoice(s, state.channel) }, icon('speaker', { size: 20 }), t('voice.join')));
      return;
    }
    renderPtt();
    const ctl = (label, ico, onclick, cls = '', extra = {}) => h('button', { class: `round-btn ${cls}`, type: 'button', 'aria-label': label, 'data-tip': label, onclick, ...extra }, icon(ico, { size: 24 }));
    const muted = m.muted || m.deafened;
    replace(
      controls,
      ctl(t(m.camera ? 'voice.cameraOff' : 'voice.camera'), m.camera ? 'camera' : 'camera-off', () => m.toggleCamera(), m.camera ? 'on' : '', { 'aria-pressed': String(!!m.camera) }),
      ctl(t(m.screen ? 'voice.screenOff' : 'voice.screen'), m.screen ? 'screen-off' : 'screen', () => m.toggleScreen(), m.screen ? 'on' : '', { 'aria-pressed': String(!!m.screen) }),
      ctl(t(muted ? 'voice.unmute' : 'voice.mute'), muted ? 'mic-off' : 'mic', () => m.toggleMute(), muted ? 'off' : '', { 'aria-pressed': String(muted) }),
      ctl(t(m.deafened ? 'voice.undeafen' : 'voice.deafen'), m.deafened ? 'headphones-off' : 'headphones', () => m.toggleDeafen(), m.deafened ? 'off' : '', { 'aria-pressed': String(m.deafened) }),
      ctl(t('voice.react'), 'react', (e) => reactBar(e.currentTarget), 'react-btn', { 'aria-haspopup': 'menu' }),
      ctl(t('voice.more'), 'dots', (e) => moreMenu(e.currentTarget), `more-btn${m.music || m.recording ? ' lit' : ''}`, { 'aria-haspopup': 'menu' }),
      ctl(t('voice.disconnect'), 'hangup', () => m.leave(), 'danger'),
    );
  }

  // Recording notice: shown to everyone in the channel, joined or not.

  function renderNotice(people) {
    const recorders = people.filter((p) => p.rec);
    clearInterval(recTimer);
    recTimer = null;
    if (!recorders.length) {
      notice.hidden = true;
      return replace(notice);
    }
    const me = recorders.find((p) => p.self);
    const others = recorders.filter((p) => !p.self).map((p) => p.name);
    const text = me ? (others.length ? t('voice.rec.youAnd', { names: others.join(', ') }) : t('voice.rec.you')) : others.length === 1 ? t('voice.rec.one', { name: others[0] }) : t('voice.rec.many', { names: others.join(', ') });
    const clock = h('span', { class: 'rec-time' });
    notice.hidden = false;
    replace(notice, h('span', { class: 'rec-dot' }), h('strong', null, t('voice.rec.tag')), h('span', { class: 'rec-text' }, text), me ? clock : null, me ? h('button', { class: 'btn btn-sm rec-stop', type: 'button', onclick: () => app.media.stopRecording() }, t('voice.rec.stop')) : null);
    if (me && app.media.recording) {
      const tick = () => (clock.textContent = formatDuration(Date.now() - (app.media.recording?.since || Date.now())));
      tick();
      recTimer = setInterval(tick, 1000);
    }
  }

  // Push to talk: hold the button (touch or mouse) or Space or Enter on it.

  function renderPtt() {
    const m = app.media;
    const on = app.settings.inputMode === 'ptt';
    pttWrap.hidden = !on;
    if (!on) return;
    const blocked = m.muted || m.deafened || !m.mic;
    pttBtn.classList.toggle('held', m.pttHeld && !blocked);
    pttBtn.classList.toggle('blocked', blocked);
    pttBtn.setAttribute('aria-pressed', String(m.pttHeld && !blocked));
    pttBtn.lastChild.textContent = blocked ? t('voice.ptt.muted') : m.pttHeld ? t('voice.ptt.talking') : t('voice.ptt.hold');
  }

  const press = (held) => {
    if (held && navigator.vibrate) navigator.vibrate(12);
    app.media.setPtt(held);
  };
  pttBtn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    pttBtn.setPointerCapture?.(e.pointerId);
    press(true);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pttBtn.addEventListener(type, () => press(false));
  pttBtn.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      press(true);
    }
  });
  pttBtn.addEventListener('keyup', (e) => (e.key === ' ' || e.key === 'Enter') && press(false));
  pttBtn.addEventListener('blur', () => press(false));
  pttBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  // Live reactions over the call

  function reactBar(anchor) {
    const s = state.session;
    popover(
      anchor,
      h(
        'div',
        { class: 'burst-bar', role: 'menu', 'aria-label': t('voice.react') },
        REACTIONS.map((key) => h('button', { class: 'icon-btn', type: 'button', role: 'menuitem', 'aria-label': t(`chat.reaction.${key}`), onclick: () => s?.sendBurst(key) }, reactionIcon(key, { size: 28 }))),
      ),
      { placement: 'above', className: 'burst-pop' },
    );
  }

  /** Float a reaction up from the sender's tile. */
  function burst(session, { from, key }) {
    if (session !== state.session || !el.isConnected) return;
    const selfId = app.profile.id;
    const people = voiceMembers(app, session, state.channel);
    const who = people.find((p) => (p.self ? selfId : p.id) === from);
    if (!who) return;
    const box = el.getBoundingClientRect();
    const tile = tiles.get(`${who.self ? selfId : who.id}:cam`);
    const r = tile?.isConnected ? tile.getBoundingClientRect() : { left: box.left + box.width / 2 - 40, width: 80, bottom: box.bottom - 80 };
    const x = r.left - box.left + r.width / 2 + (Math.random() - 0.5) * Math.min(120, r.width * 0.5);
    const y = Math.min(r.bottom, box.bottom - 70) - box.top - 24;
    const node = h('span', { class: 'burst', style: { left: `${Math.round(x)}px`, top: `${Math.round(y)}px`, '--sway': `${Math.round((Math.random() - 0.5) * 60)}px`, '--spin': `${Math.round((Math.random() - 0.5) * 40)}deg` } }, reactionIcon(key, { size: 40 }), h('span', { class: 'burst-name' }, who.self ? t('voice.you') : who.name));
    bursts.append(node);
    const done = () => node.remove();
    node.addEventListener('animationend', (e) => e.target === node && done());
    setTimeout(done, 2600);
    while (bursts.childElementCount > 24) bursts.firstChild.remove();
  }

  // More: push to talk, music mode, recording

  function moreMenu(anchor) {
    const m = app.media;
    const ptt = app.settings.inputMode === 'ptt';
    const item = (label, hint, ico, onclick, checked) =>
      h(
        'button',
        { class: 'hl-menu-item call-item', type: 'button', role: checked == null ? 'menuitem' : 'menuitemcheckbox', 'aria-checked': checked == null ? null : String(checked), onclick: () => (closePopover(), onclick()) },
        icon(ico, { size: 18 }),
        h('span', { class: 'call-item-text' }, h('span', null, label), hint ? h('small', null, hint) : null),
        checked == null ? null : h('span', { class: `mini-switch${checked ? ' on' : ''}`, 'aria-hidden': 'true' }),
      );
    popover(
      anchor,
      h(
        'div',
        { class: 'hl-menu call-menu', role: 'menu', 'aria-label': t('voice.more') },
        item(t('voice.ptt.title'), t('voice.ptt.hint'), 'ptt', () => m.setInputMode(ptt ? 'voice' : 'ptt'), ptt),
        item(t('voice.music.title'), t('voice.music.hint'), 'music', () => m.setMusic(!m.music), m.music),
        m.canRecord ? item(t(m.recording ? 'voice.rec.stop' : 'voice.rec.start'), m.recording ? null : t('voice.rec.hint'), 'record', () => (m.recording ? m.stopRecording() : startRecording())) : null,
      ),
      { placement: 'above' },
    );
  }

  async function startRecording() {
    const ok = await confirmDialog(t, { title: t('voice.rec.confirmTitle'), text: t('voice.rec.confirmText'), ok: t('voice.rec.start') });
    if (ok) app.media.startRecording();
  }

  return {
    el,
    show(session, channelId) {
      if (state.session !== session || state.channel !== channelId) state.focus = state.manual = null;
      state.session = session;
      state.channel = channelId;
      refresh();
    },
    refresh,
    burst,
    speaking() {
      if (!state.session) return;
      for (const [key, tile] of tiles) {
        const id = key.split(':')[0];
        tile.classList.toggle('speaking', key.endsWith(':cam') && app.media.isSpeaking(id) && app.media.inVoice(state.session, state.channel));
      }
    },
  };
}
