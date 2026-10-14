// The voice stage: a grid of participants with cameras and screen shares, a
// focused view, speaking rings and call controls.

import { h, replace } from './dom.js';
import { icon } from './icons.js';
import { avatarImg, voiceMembers } from './ui-shell.js';
import { avatarTraits } from '../core/avatar.js';

export function createVoice(app) {
  const t = (k, v) => app.t(k, v);
  const grid = h('div', { class: 'stage-grid' });
  const strip = h('div', { class: 'stage-strip', role: 'list' });
  const empty = h('div', { class: 'stage-empty' });
  const controls = h('div', { class: 'stage-controls' });
  const el = h('section', { class: 'stage', 'aria-label': 'Voice' }, grid, empty, controls);
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
        p.deafened ? icon('headphones-off', { size: 16, cls: 'red' }) : p.muted ? icon('mic-off', { size: 16, cls: 'red' }) : null,
        h('span', null, p.name),
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

    const m = app.media;
    if (!inHere) {
      replace(controls, h('button', { class: 'btn btn-success btn-lg', type: 'button', onclick: () => app.joinVoice(s, state.channel) }, icon('speaker', { size: 20 }), t('voice.join')));
      return;
    }
    const ctl = (label, ico, onclick, cls = '') => h('button', { class: `round-btn ${cls}`, type: 'button', 'aria-label': label, 'data-tip': label, onclick }, icon(ico, { size: 24 }));
    replace(
      controls,
      ctl(t(m.camera ? 'voice.cameraOff' : 'voice.camera'), m.camera ? 'camera' : 'camera-off', () => m.toggleCamera(), m.camera ? 'on' : ''),
      ctl(t(m.screen ? 'voice.screenOff' : 'voice.screen'), m.screen ? 'screen-off' : 'screen', () => m.toggleScreen(), m.screen ? 'on' : ''),
      ctl(t(m.muted || m.deafened ? 'voice.unmute' : 'voice.mute'), m.muted || m.deafened ? 'mic-off' : 'mic', () => m.toggleMute(), m.muted || m.deafened ? 'off' : ''),
      ctl(t(m.deafened ? 'voice.undeafen' : 'voice.deafen'), m.deafened ? 'headphones-off' : 'headphones', () => m.toggleDeafen(), m.deafened ? 'off' : ''),
      ctl(t('voice.disconnect'), 'hangup', () => m.leave(), 'danger'),
    );
    for (const b of controls.querySelectorAll('.round-btn')) b.setAttribute('aria-pressed', String(b.classList.contains('on') || b.classList.contains('off')));
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
    speaking() {
      if (!state.session) return;
      for (const [key, tile] of tiles) {
        const id = key.split(':')[0];
        tile.classList.toggle('speaking', key.endsWith(':cam') && app.media.isSpeaking(id) && app.media.inVoice(state.session, state.channel));
      }
    },
  };
}
