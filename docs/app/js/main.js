// howlden app controller: account gate, sessions, routing and rendering.

import { $, frameThrottle, h, replace } from './dom.js';
import { icon } from './icons.js';
import { detectLang, translator } from './i18n.js';
import * as store from './store.js';
import * as account from './account.js';
import { Friends } from './friends.js';
import { DenSession, DM_CALL, DM_TEXT } from './session.js';
import { MediaManager } from './media.js';
import { createChat } from './ui-chat.js';
import { createVoice } from './ui-voice.js';
import { closePopover, renderHeader, renderMembers, renderRail, renderSide } from './ui-shell.js';
import { renderDmHeader, renderHome } from './ui-home.js';
import { avatarSrc, loginCard, pinScreen } from './ui-account.js';
import { confirmDialog, modal, toast } from './ui-modal.js';
import {
  codeErrorText,
  createChannelModal,
  createDenModal,
  deleteChannelFlow,
  denSettingsModal,
  inviteModal,
  joinModal,
  passphraseFlow,
  pasteInviteModal,
  renameChannelFlow,
  scanModal,
  shareOrCopy,
} from './ui-flows.js';
import { openSettings, restoreModal } from './ui-settings.js';
import { buildIceServers, RtcLink } from '../core/rtc.js';
import { newDen, visibleChannels } from '../core/denstate.js';
import { randomId } from '../core/crypto.js';
import { directId } from '../core/identity.js';
import { codeLink, findCode, invitePayload, packCode, readInvite, readReply, unpackCode } from '../core/invite.js';
import { MeshError } from '../core/mesh.js';
import { plainText } from '../core/markdown.js';

const settings = store.loadSettings();

const app = {
  settings,
  lang: settings.lang || detectLang(),
  t: null,
  profile: null,
  identity: null,
  account,
  friends: null,
  media: null,
  sessions: new Map(),
  invites: new Map(),
  pendingInvite: null,
  activeDen: null,
  channelId: null,
  view: 'home',
  homeTab: null,
  showMembers: settings.showMembers !== false,
  baseUrl: location.href.split('#')[0].split('?')[0],
};
app.t = translator(app.lang);
window.howlden = app;

// Settings, language and theme

app.saveSettings = () => store.save('settings', { ...settings, showMembers: app.showMembers });

app.iceServers = () => buildIceServers({ custom: settings.turn });

app.applyTheme = () => {
  const root = document.documentElement;
  const theme = settings.theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : settings.theme;
  root.dataset.theme = theme;
  root.classList.toggle('compact', !!settings.compact);
  $('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f1effb' : '#0c0a20');
};

app.setLang = (lang, gate = false) => {
  app.lang = lang;
  settings.lang = lang;
  app.saveSettings();
  app.t = translator(lang);
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
  staticText();
  if (gate && !app.profile) loginCard(app, { invite: app.pendingInvite });
  else if (app.profile) {
    chat?.rebuild();
    app.render();
  }
};

function staticText() {
  const t = app.t;
  $('#skip').textContent = t('app.skip');
  $('#rail').setAttribute('aria-label', t('rail.dens'));
  $('#members').setAttribute('aria-label', t('members.title'));
  $('#scrim').setAttribute('aria-label', t('common.close'));
}

// Account

async function boot() {
  app.applyTheme();
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', app.applyTheme);
  document.documentElement.lang = app.lang === 'pt' ? 'pt-BR' : 'en';
  staticText();
  registerWorker();
  const hash = findCode(location.hash);
  if (hash?.kind === 'r') {
    history.replaceState(null, '', location.pathname + location.search);
    if (await handOffReply(hash.code)) return;
    app.pendingReply = hash;
  }
  if (hash?.kind === 'i') {
    history.replaceState(null, '', location.pathname + location.search);
    try {
      app.pendingInvite = readInvite(await unpackCode(hash.code));
    } catch (err) {
      toast(codeErrorText(app.t, err), 'error');
    }
  }
  let acc;
  try {
    acc = await account.loadAccount();
  } catch {
    toast(app.t('notice.storage'), 'error');
    acc = { state: 'none' };
  }
  $('#boot').hidden = true;
  if (acc.state === 'ready') return enter(acc);
  if (acc.state === 'locked') return pinScreen(app);
  loginCard(app, { invite: app.pendingInvite });
}

app.createProfile = async ({ name, avatar, accent }) => {
  const acc = await account.createAccount({ name, avatar, accent });
  await enter({ state: 'ready', ...acc });
};

app.unlock = async (pin) => {
  const acc = await account.unlock(pin);
  if (!acc) return false;
  await enter(acc);
  return true;
};

app.forgotPinFlow = async () => {
  const t = app.t;
  if (await confirmDialog(t, { title: t('pin.forgot'), text: t('pin.forgotText'), ok: t('pin.reset'), danger: true })) {
    await account.deleteAccount();
    location.reload();
  }
};

app.restoreFlow = () => restoreModal(app);

app.restoreAccount = async (text, password) => {
  for (const s of app.sessions.values()) s.leave();
  await account.importAccount(text, password);
  location.reload();
};

app.deleteAccount = async () => {
  for (const s of app.sessions.values()) s.leave();
  await account.deleteAccount();
  location.href = app.baseUrl;
};

app.updateProfile = async (patch) => {
  Object.assign(app.profile, patch);
  await account.saveProfile(app.profile);
  for (const s of app.sessions.values()) s.mesh?.setProfile({ name: app.profile.name, avatar: app.profile.avatar, status: app.profile.status, accent: app.profile.accent });
  app.render();
};

async function enter(acc) {
  app.profile = acc.profile;
  app.identity = acc.identity;
  $('#gate').hidden = true;
  replace($('#gate'));
  $('#app').hidden = false;
  app.media = new MediaManager(app);
  app.friends = new Friends(app);
  await app.friends.load();
  app.friends.on('change', () => app.render());
  app.friends.on('warning', (f) => toast(app.t('id.nameClashHint', { name: f.name }), 'error', 8000));
  wireMedia();
  for (const den of await store.listDens()) await addSession(den);
  setupShell();
  app.openHome();
  if (app.pendingInvite) {
    const invite = app.pendingInvite;
    app.pendingInvite = null;
    startJoin(invite);
  }
  if (app.pendingReply) {
    const r = app.pendingReply;
    app.pendingReply = null;
    manualReply(r.code);
  }
}

// Sessions

async function addSession(den) {
  if (app.sessions.has(den.id)) return app.sessions.get(den.id);
  const s = new DenSession(app, den);
  await s.load();
  app.sessions.set(den.id, s);
  wireSession(s);
  return s;
}

function wireSession(s) {
  const t = app.t;
  const isActive = () => app.activeDen === s;
  s.on('members', () => app.render());
  s.on('status', () => app.render());
  s.on('den', () => {
    if (isActive() && app.channelId && !s.den.channels.some((c) => c.id === app.channelId && !c.deleted)) app.openDen(s.id);
    app.render();
  });
  s.on('unread', () => app.render());
  s.on('identity', () => {
    if (isActive()) chat.refresh();
    app.render();
  });
  s.on('records', () => {
    if (isActive() && app.view === 'chat') chat.refresh();
    app.render();
  });
  s.on('typing', () => isActive() && chat.typing());
  s.on('file-ready', () => isActive() && chat.refresh());
  s.on('file-progress', () => isActive() && chat.refresh());
  s.on('file-missing', () => isActive() && chat.refresh());
  s.on('voice', () => {
    if (isActive()) voice.refresh();
    if (s.isDirect) ringCheck(s);
    app.render();
  });
  s.on('link-failed', (f) => {
    if (f.peerId && s.mesh?.introducer !== f.peerId && s.member(f.peerId) && !app.invitesWatching?.has(f.peerId)) toast(t('fail.peer', { name: s.member(f.peerId).name }), 'error', 7000);
  });
  s.on('link-open', (peerId) => {
    if (s.isDirect && s.pendingCall && peerId === s.den.peer) {
      const video = s.pendingCall === 'video';
      s.pendingCall = null;
      app.openSession(s);
      app.joinVoice(s, DM_CALL, video);
    }
  });
  s.on('call-declined', () => toast(t('call.declined'), 'info'));
  s.on('notice', (n) => {
    const key = { decrypt: 'notice.decrypt', 'bad-passphrase': 'notice.badPassphrase', full: 'notice.full' }[n.kind];
    if (key) toast(t(key), 'error', 7000);
    if (n.kind === 'bad-passphrase') s.leave();
  });
  s.on('incoming', (rec) => notify(s, rec));
}

function notify(s, rec) {
  const mention = s.isDirect || s.mentionsMe(rec);
  const viewing = app.activeDen === s && app.channelId === rec.channel && document.visibilityState === 'visible';
  if (!mention || viewing || !settings.notify || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const author = s.member(rec.author)?.name || app.t('chat.unknown');
  const channel = s.den.channels.find((c) => c.id === rec.channel)?.name || '';
  const title = s.isDirect ? author : app.t('notice.mention', { name: author, channel });
  const body = plainText(rec.text, (id) => s.member(id)).slice(0, 140) || rec.files?.[0]?.name || '';
  const opts = { body, tag: rec.id, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { den: s.id, channel: rec.channel } };
  navigator.serviceWorker?.ready.then((reg) => reg.showNotification(title, opts)).catch(() => new Notification(title, opts));
}

app.createDen = async ({ name, passphrase }) => {
  const t = app.t;
  const den = newDen({ id: randomId(8), name, now: Date.now(), ids: [randomId(6), randomId(6), randomId(6), randomId(6)], labels: { general: t('den.general'), links: t('den.links'), lounge: t('den.lounge'), gaming: t('den.gaming') } });
  den.createdAt = Date.now();
  den.kind = 'den';
  den.locked = !!passphrase;
  den.members = [];
  den.lastRead = {};
  await store.putDen(den);
  const s = await addSession(den);
  if (passphrase) await s.setPassphrase(passphrase);
  app.openDen(s.id);
  app.inviteFlow(s);
};

/** The 1 to 1 conversation with a friend, created on first use. */
app.dmSession = async (friend) => {
  const id = await directId(app.profile.id, friend.id);
  if (app.sessions.has(id)) return app.sessions.get(id);
  const den = {
    id,
    kind: 'dm',
    peer: friend.id,
    name: friend.name,
    nameV: 0,
    locked: false,
    createdAt: Date.now(),
    channels: [
      { id: DM_TEXT, name: 'chat', kind: 'text', pos: 0, v: 0, deleted: false },
      { id: DM_CALL, name: 'call', kind: 'voice', pos: 1, v: 0, deleted: false },
    ],
    members: [{ id: friend.id, name: friend.name, avatar: friend.avatar, joinedAt: null }],
    lastRead: {},
  };
  await store.putDen(den);
  return addSession(den);
};

// Invites and joining

/** Host side of a friend invite: the conversation id is known only after the reply. */
app.newFriendInvite = async () => {
  const link = new RtcLink({ iceServers: app.iceServers() });
  const sdp = await link.offer();
  const inviteId = randomId(6);
  const me = { id: app.profile.id, name: app.profile.name, avatar: app.profile.avatar, publicKey: app.identity.publicKey, alg: app.identity.alg, tag: app.identity.tag };
  const code = await packCode(invitePayload({ inviteId, den: { id: '00000000', name: app.profile.name, locked: false }, host: me, sdp, kind: 'dm' }));
  return {
    inviteId,
    code,
    link: codeLink(app.baseUrl, 'i', code),
    cancel: () => link.close(),
    accept: async (reply) => {
      if (reply.peer.id === app.profile.id) throw new MeshError('self', app.t('fail.self'));
      const id = await directId(app.profile.id, reply.peer.id);
      if (reply.denId !== id) throw new MeshError('den', app.t('fail.den'));
      const friend = app.friends.get(reply.peer.id) || { id: reply.peer.id, name: reply.peer.name, avatar: reply.peer.avatar };
      const s = await app.dmSession(friend);
      if (s.mesh?.links.has(reply.peer.id)) throw new MeshError('already', app.t('fail.already', { name: reply.peer.name }));
      const mesh = s.ensureMesh(true);
      link.onopen = () => mesh.adopt(link, { id: reply.peer.id, name: reply.peer.name, avatar: reply.peer.avatar });
      link.onfail = (reason) => s.emit('link-failed', { peerId: reply.peer.id, reason, diagnosis: link.diagnose(navigator.onLine) });
      await link.complete(reply.sdp);
      return s;
    },
  };
};

/** Guest side: answer an invite. Returns { session, reply }. */
app.answerInvite = async (invite, passphrase) => {
  let s;
  if (invite.kind === 'dm') {
    const friend = app.friends.get(invite.host.id) || { id: invite.host.id, name: invite.host.name, avatar: invite.host.avatar };
    s = await app.dmSession(friend);
    invite = { ...invite, den: { ...invite.den, id: s.id } };
  } else {
    s = app.sessions.get(invite.den.id);
    if (!s) {
      const den = { id: invite.den.id, kind: 'den', name: invite.den.name, nameV: 0, locked: invite.den.locked, createdAt: Date.now(), channels: [], members: [{ id: invite.host.id, name: invite.host.name, avatar: invite.host.avatar, joinedAt: null }], lastRead: {} };
      await store.putDen(den);
      s = await addSession(den);
    }
  }
  if (s.mesh?.links.has(invite.host.id)) throw new MeshError('already', app.t('join.already'));
  if (invite.den.locked) await s.setPassphrase(passphrase);
  const reply = await s.answerInvite(invite);
  app.render();
  return { session: s, reply };
};

function startJoin(invite) {
  if (invite.host.id === app.profile.id) return toast(app.t('fail.self'), 'error');
  joinModal(app, invite);
}

/** A code from the URL, a paste or a scan. */
app.handleCode = async (found, { fromGate = false, onError = (m) => toast(m, 'error') } = {}) => {
  try {
    const data = await unpackCode(found.code);
    if (data.k === 'i') {
      const invite = readInvite(data);
      if (!app.profile) {
        app.pendingInvite = invite;
        if (fromGate) loginCard(app, { invite });
        return;
      }
      startJoin(invite);
    } else if (data.k === 'r') {
      const reply = readReply(data);
      const target = app.invites.get(reply.inviteId);
      if (target) target.submit(found.code.startsWith('#') ? found.code : `#r=${found.code}`);
      else onError(app.t('fail.expired'));
    } else onError(app.t('fail.kind'));
  } catch (err) {
    onError(codeErrorText(app.t, err));
  }
};

// Reply links opened in a new tab are handed to the tab that made the invite.
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('howlden') : null;
channel?.addEventListener('message', async (e) => {
  const msg = e.data;
  if (msg?.type !== 'reply' || !app.profile) return;
  try {
    const reply = readReply(await unpackCode(msg.code));
    const target = app.invites.get(reply.inviteId);
    if (!target) return;
    channel.postMessage({ type: 'ack', nonce: msg.nonce });
    toast(app.t('invite.tabReply'), 'ok');
    target.submit(`#r=${msg.code}`);
  } catch {
    // not ours
  }
});

function handOffReply(code) {
  if (!channel) return Promise.resolve(false);
  return new Promise((resolve) => {
    const nonce = randomId(4);
    const onAck = (e) => {
      if (e.data?.type !== 'ack' || e.data.nonce !== nonce) return;
      channel.removeEventListener('message', onAck);
      clearTimeout(timer);
      $('#boot').hidden = true;
      const gate = $('#gate');
      replace(gate, h('main', { class: 'login' }, h('div', { class: 'login-card narrow' }, h('div', { class: 'login-form is-center' }, h('div', { class: 'pin-ico ok' }, icon('check', { size: 36 })), h('h1', { class: 'login-title' }, app.t('reply.handedTitle')), h('p', { class: 'login-lead' }, app.t('join.replyOpened'))))));
      gate.hidden = false;
      resolve(true);
    };
    const timer = setTimeout(() => {
      channel.removeEventListener('message', onAck);
      resolve(false);
    }, 1500);
    channel.addEventListener('message', onAck);
    channel.postMessage({ type: 'reply', code, nonce });
  });
}

function manualReply(code) {
  const t = app.t;
  modal({ title: t('reply.manualTitle'), closeLabel: t('common.close'), body: [h('p', null, t('join.replyManual')), h('textarea', { class: 'input field-input mono', rows: 3, readonly: true }, `${app.baseUrl}#r=${code}`)] });
}

window.addEventListener('hashchange', () => {
  const found = findCode(location.hash);
  if (!found || !app.profile) return;
  history.replaceState(null, '', location.pathname + location.search);
  app.handleCode(found);
});

// Navigation

app.openHome = () => {
  app.activeDen = null;
  app.channelId = null;
  app.view = 'home';
  app.drawer(null);
  app.render();
};

app.openSession = (s) => (s.isDirect ? app.openDen(s.id, DM_TEXT) : app.openDen(s.id));

app.openDen = (id, channelId) => {
  const s = app.sessions.get(id);
  if (!s) return app.openHome();
  app.activeDen = s;
  if (s.isDirect) {
    app.channelId = DM_TEXT;
    app.view = 'chat';
  } else {
    const all = visibleChannels(s.den);
    const target = all.find((c) => c.id === channelId) || all.find((c) => c.id === s.den.lastChannel && c.kind === 'text') || all.find((c) => c.kind === 'text') || all[0];
    app.channelId = target?.id || null;
    app.view = target?.kind === 'voice' ? 'voice' : 'chat';
  }
  app.drawer(null);
  showMain();
  if (s.den.locked && !s.key && s.status === 'offline') app.askPassphrase(s);
};

app.openChannel = (channelId) => {
  const s = app.activeDen;
  if (!s) return;
  app.channelId = channelId;
  app.view = 'chat';
  s.den.lastChannel = channelId;
  s.save();
  app.drawer(null);
  showMain();
};

app.openVoice = (channelId, join) => {
  const s = app.activeDen;
  if (!s) return;
  app.channelId = channelId;
  app.view = 'voice';
  app.drawer(null);
  showMain();
  if (join && !app.media.inVoice(s, channelId)) app.joinVoice(s, channelId);
};

app.joinVoice = async (s, channelId, video = false) => {
  if (s.den.locked && !s.key && !(await app.askPassphrase(s))) return;
  await app.media.join(s, channelId);
  if (video && !app.media.camera) await app.media.toggleCamera();
  app.render();
};

function showMain() {
  const s = app.activeDen;
  if (s && app.view === 'chat' && app.channelId) {
    chat.show(s, app.channelId);
    chat.focus();
  }
  app.render();
}

app.drawer = (side) => {
  const el = $('#app');
  if (!el) return;
  if (side) el.dataset.drawer = side;
  else delete el.dataset.drawer;
};

app.toggleMembers = () => {
  if (matchMedia('(max-width: 1023px)').matches) return app.drawer($('#app').dataset.drawer === 'right' ? null : 'right');
  app.showMembers = !app.showMembers;
  app.saveSettings();
  app.render();
};

app.mention = (m) => {
  if (app.view !== 'chat') return;
  chat.mention(m);
  app.drawer(null);
};

// Flows

app.createDenFlow = () => createDenModal(app);
app.joinFlow = () => pasteInviteModal(app);
app.scanFlow = (cb) => scanModal(app, cb);
app.openSettings = (section) => openSettings(app, section);
app.createChannelFlow = (s, kind) => createChannelModal(app, s, kind);
app.renameChannelFlow = (s, c) => renameChannelFlow(app, s, c);
app.deleteChannelFlow = (s, c) => deleteChannelFlow(app, s, c);
app.denSettingsFlow = (s) => denSettingsModal(app, s);
app.askPassphrase = (s) => passphraseFlow(app, s);

app.inviteFlow = async (s, opts = {}) => {
  if (s.den.locked && !s.key && !(await app.askPassphrase(s))) return;
  inviteModal(app, { session: s, ...opts });
};

app.friendInviteFlow = () => inviteModal(app, { friend: true, title: app.t('home.friendInvite') });

app.removeDenFlow = async (s) => {
  const t = app.t;
  if (!(await confirmDialog(t, { title: t('den.remove'), text: t('den.removeConfirm', { name: s.den.name }), ok: t('common.remove'), danger: true }))) return;
  s.leave();
  app.sessions.delete(s.id);
  await store.deleteDen(s.id);
  app.openHome();
};

app.messageFriend = async (friend) => {
  const s = await app.dmSession(friend);
  app.openSession(s);
};

/** One click reconnect: make an invite for the friend and open the share sheet. */
app.reconnectFriend = async (friend, call = null) => {
  const s = await app.dmSession(friend);
  if (call) s.pendingCall = call;
  app.openSession(s);
  inviteModal(app, { session: s, autoShare: true, title: app.t('call.inviteTitle', { name: friend.name }) });
};

app.callFriend = async (friend, video) => {
  const s = await app.dmSession(friend);
  if (s.mesh?.links.has(friend.id)) {
    app.openSession(s);
    return app.joinVoice(s, DM_CALL, video);
  }
  return app.reconnectFriend(friend, video ? 'video' : 'voice');
};

// Incoming 1 to 1 calls

let ringing = null;
function ringCheck(s) {
  const peer = s.den.peer;
  const calling = s.voice.get(peer)?.channel === DM_CALL && !app.media.inVoice(s, DM_CALL);
  if (calling && !ringing) {
    const t = app.t;
    const f = app.friends.get(peer) || s.member(peer) || { name: s.den.name };
    const card = h(
      'div',
      { class: 'call-ring', role: 'alertdialog', 'aria-label': t('call.incoming', { name: f.name }) },
      h('div', { class: 'ring-pulse' }, h('img', { class: 'av', src: '', alt: '', width: 64, height: 64 })),
      h('strong', null, f.name),
      h('span', { class: 'muted' }, t('call.incoming', { name: f.name })),
      h(
        'div',
        { class: 'row-btns' },
        h('button', { class: 'round-btn danger', type: 'button', 'aria-label': t('call.decline'), onclick: () => (s.sendTo(peer, { type: 'call-decline' }), stopRing()) }, icon('hangup', { size: 22 })),
        h('button', { class: 'round-btn accept', type: 'button', 'aria-label': t('call.accept'), onclick: () => (stopRing(), app.openSession(s), app.joinVoice(s, DM_CALL)) }, icon('speaker', { size: 22 })),
      ),
    );
    card.querySelector('img').src = avatarSrc(f.avatar || peer);
    document.body.append(card);
    ringing = { card, s };
  } else if (!calling && ringing?.s === s) stopRing();
}

function stopRing() {
  ringing?.card.remove();
  ringing = null;
}

// Media wiring

function wireMedia() {
  const m = app.media;
  m.on('change', () => {
    if (ringing && app.media.inVoice(ringing.s, DM_CALL)) stopRing();
    voice.refresh();
    app.render();
  });
  m.on('video', () => voice.refresh());
  const side = frameThrottle(() => app.render());
  m.on('speaking', () => {
    voice.speaking();
    side();
  });
  m.on('error', (key) => {
    if (key === 'autoplay') {
      toast(app.t('notice.autoplay'), 'info', 6000);
      document.addEventListener('click', () => document.querySelectorAll('audio').forEach((a) => a.play().catch(() => {})), { once: true });
    } else toast(app.t(`notice.${key}`), 'error', 6000);
  });
}

// Rendering

let chat;
let voice;

function setupShell() {
  chat = createChat(app);
  voice = createVoice(app);
  $('#scrim').addEventListener('click', () => app.drawer(null));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#app').dataset.drawer && !document.querySelector('dialog[open]')) app.drawer(null);
  });
  document.addEventListener('visibilitychange', () => chat.markRead());
  window.addEventListener('focus', () => chat.markRead());
  setInterval(() => chat.typing(), 2000);
  let touch = null;
  document.addEventListener(
    'touchstart',
    (e) => {
      const p = e.touches[0];
      touch = { x: p.clientX, y: p.clientY };
    },
    { passive: true },
  );
  document.addEventListener(
    'touchend',
    (e) => {
      if (!touch || window.innerWidth >= 768 || document.querySelector('dialog[open], .settings')) return;
      const p = e.changedTouches[0];
      const dx = p.clientX - touch.x;
      const dy = Math.abs(p.clientY - touch.y);
      const open = $('#app').dataset.drawer;
      if (Math.abs(dx) > 70 && dy < 60) {
        if (dx > 0 && touch.x < 40 && !open) app.drawer('left');
        else if (dx < 0 && touch.x > window.innerWidth - 40 && !open && app.activeDen && !app.activeDen.isDirect) app.drawer('right');
        else if ((dx < 0 && open === 'left') || (dx > 0 && open === 'right')) app.drawer(null);
      }
      touch = null;
    },
    { passive: true },
  );
}

app.render = frameThrottle(() => {
  if (!app.profile || !chat) return;
  const s = app.activeDen;
  const el = $('#app');
  const hasCall = s?.isDirect && (app.media.inVoice(s, DM_CALL) || s.voice.get(s.den.peer)?.channel === DM_CALL);
  el.dataset.view = !s ? 'home' : s.isDirect ? (hasCall ? 'dm-call' : 'dm') : app.view;
  el.classList.toggle('no-members', !app.showMembers || !s || s.isDirect);
  renderRail(app, $('#rail'));
  renderSide(app, $('#side'));
  const header = $('#header');
  header.style.removeProperty('--den-hue');
  if (s?.isDirect) renderDmHeader(app, header, s);
  else renderHeader(app, header);
  renderMembers(app, $('#members'));
  const main = $('#content');
  if (!s) {
    if (main.firstChild !== homeEl) replace(main, homeEl);
    renderHome(app, homeEl);
  } else if (s.isDirect) {
    const want = hasCall ? [voice.el, chat.el] : [chat.el];
    if (main.childNodes.length !== want.length || want.some((n, i) => main.childNodes[i] !== n)) replace(main, want);
    if (hasCall) voice.show(s, DM_CALL);
    chat.refresh();
  } else if (app.view === 'voice') {
    if (main.firstChild !== voice.el || main.childNodes.length !== 1) replace(main, voice.el);
    voice.show(s, app.channelId);
  } else {
    if (main.firstChild !== chat.el || main.childNodes.length !== 1) replace(main, chat.el);
  }
  const ch = s?.den.channels.find((c) => c.id === app.channelId);
  document.title = s ? `${s.isDirect ? s.den.name : `${ch ? (ch.kind === 'voice' ? '' : '#') + ch.name : ''} | ${s.den.name}`} | howlden` : 'howlden';
});

const homeEl = h('section', { class: 'home' });

function registerWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'open' && e.data.den) app.openDen(e.data.den, e.data.channel);
  });
}

window.addEventListener('beforeunload', () => {
  for (const s of app.sessions.values()) s.mesh?.leave();
});

boot().catch((err) => {
  console.error(err);
  $('#boot').hidden = true;
  toast(String(err.message || err), 'error', 10000);
});

export { app, closePopover, shareOrCopy };
