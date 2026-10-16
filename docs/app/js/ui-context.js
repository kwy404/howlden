// Context menus for people, channels, dens, conversations, friends, links,
// images and files. Messages and call tiles add their own in ui-chat.js and
// ui-voice.js. Everything here acts on this device or through the den, never
// through a server.

import { copyText } from './dom.js';
import { contextMenu, setCopyLabel } from './menu.js';
import { memberCard } from './ui-shell.js';
import { toast } from './ui-modal.js';
import { DM_TEXT } from './session.js';

/** The notification level submenu for a den (this device only). */
export function notifyItems(app, s) {
  const t = app.t;
  const level = s.notifyLevel;
  const pick = (key) => ({ label: t(`settings.notifyLevel.${key}`), checked: level === key, radio: true, run: () => (s.setLocal('notify', key), s.emit('unread'), toast(t('settings.notifySaved'), 'ok', 2500)) });
  return [pick('default'), pick('all'), pick('mentions'), pick('none')];
}

/** Items for a person: profile, message, call, local volume and mute, copy, add friend. */
export function memberItems(app, s, m, anchor) {
  const t = app.t;
  const self = m.id === app.profile.id;
  const media = app.media;
  const friend = app.friends.get(m.id);
  const person = friend || { id: m.id, name: m.name, avatar: m.avatar };
  const inCall = !!media.current && (media.current.session.voice.get(m.id) || self);
  const ids = s?.identityOf?.(m.id);
  const claim = ids?.status === 'verified' ? ids.claim : null;
  return [
    { label: t('members.ctx.profile'), icon: 'user', run: () => (anchor?.isConnected ? memberCard(app, s, { ...m, online: m.online ?? true }, anchor) : null) },
    self ? { label: t('members.ctx.editProfile'), icon: 'edit', run: () => app.openSettings('profile') } : null,
    self ? null : { label: t('members.ctx.message'), icon: 'chat', run: () => app.messageFriend(person) },
    self ? null : { label: t('members.ctx.call'), icon: 'phone', run: () => app.callFriend(person, false) },
    self ? null : { label: t('members.ctx.videoCall'), icon: 'camera', run: () => app.callFriend(person, true) },
    app.view === 'chat' && s && !s.isDirect && !self ? { label: t('members.mention'), icon: 'at', run: () => app.mention(m) } : null,
    '-',
    self ? null : { range: { label: t('members.volume'), value: media.volumeOf(m.id), min: 0, max: 100, oninput: (v) => media.setVolume(m.id, v) } },
    self ? null : { label: t('members.ctx.mute'), icon: 'volume-off', checked: media.isLocalMuted(m.id), hint: t('members.ctx.muteHint'), run: () => media.setLocalMute(m.id, !media.isLocalMuted(m.id)) },
    !self && inCall ? { label: t('members.ctx.hideVideo'), icon: 'eye-off', checked: media.isVideoHidden(m.id), run: () => media.setVideoHidden(m.id, !media.isVideoHidden(m.id)) } : null,
    '-',
    { label: t('members.ctx.copyName'), icon: 'copy', run: async () => (await copyText(m.name)) && toast(t('notice.copied'), 'ok', 2000) },
    !self && !friend
      ? {
          label: t('members.ctx.addFriend'),
          icon: 'invite',
          hint: claim ? null : t('members.ctx.addFriendHint'),
          run: async () => {
            if (claim) {
              await app.friends.verified({ id: m.id, name: m.name, avatar: m.avatar, status: m.status, statusUntil: m.statusUntil || 0, accent: m.accent, publicKey: claim.publicKey, alg: claim.alg, tag: claim.tag || m.id.slice(0, 4) });
              toast(t('members.ctx.friendAdded', { name: m.name }), 'ok');
            } else app.friendInviteFlow();
          },
        }
      : null,
  ];
}

function sessionOf(app, el) {
  const id = el.closest('[data-den]')?.dataset.den;
  return (id && app.sessions.get(id)) || app.activeDen;
}

function memberOf(app, s, id) {
  if (id === app.profile.id) return { ...app.profile, online: true };
  const m = s?.member(id) || app.friends.get(id);
  return m ? { ...m, id, online: m.online ?? !!s?.mesh?.links.has(id) } : { id, name: app.t('chat.unknown'), avatar: id };
}

/** Copy an image to the clipboard as PNG (the only image type browsers accept). */
export async function copyImage(app, url) {
  const t = app.t;
  try {
    const blob = await fetch(url).then((r) => r.blob());
    let png = blob;
    if (blob.type !== 'image/png') {
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      canvas.getContext('2d').drawImage(bmp, 0, 0);
      png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    toast(t('chat.ctx.imageCopied'), 'ok', 2000);
  } catch {
    toast(t('chat.ctx.copyFailed'), 'error');
  }
}

/** Save a file the way a download link does. */
export function saveFile(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'file';
  document.body.append(a);
  a.click();
  a.remove();
}

export function initContexts(app) {
  const t = (k, v) => app.t(k, v);
  setCopyLabel(t('chat.ctx.copySelection'));

  // People: member list, voice channel list, friends, conversations, authors.
  contextMenu(
    '[data-member]',
    (el) => {
      const s = sessionOf(app, el);
      const m = memberOf(app, s, el.dataset.member);
      return memberItems(app, s, m, el);
    },
    { label: (el) => el.dataset.memberName || '' },
  );

  contextMenu('.friend[data-friend]', (el) => {
    const f = app.friends.get(el.dataset.friend);
    if (!f) return [];
    return [
      { label: t('members.ctx.message'), icon: 'chat', run: () => app.messageFriend(f) },
      { label: t('members.ctx.call'), icon: 'phone', run: () => app.callFriend(f, false) },
      { label: t('members.ctx.videoCall'), icon: 'camera', run: () => app.callFriend(f, true) },
      '-',
      { range: { label: t('members.volume'), value: app.media.volumeOf(f.id), oninput: (v) => app.media.setVolume(f.id, v) } },
      { label: t('members.ctx.mute'), icon: 'volume-off', checked: app.media.isLocalMuted(f.id), run: () => app.media.setLocalMute(f.id, !app.media.isLocalMuted(f.id)) },
      '-',
      { label: t('members.ctx.copyName'), icon: 'copy', run: async () => (await copyText(f.name)) && toast(t('notice.copied'), 'ok', 2000) },
      { label: t('home.removeFriend'), icon: 'trash', danger: true, run: () => app.removeFriendFlow(f) },
    ];
  });

  contextMenu('.dm-link[data-den]', (el) => {
    const s = app.sessions.get(el.dataset.den);
    if (!s) return [];
    const f = app.friends.get(s.den.peer) || s.member(s.den.peer) || { id: s.den.peer, name: s.den.name };
    const u = s.unread(DM_TEXT);
    return [
      { label: t('channel.ctx.open'), icon: 'chat', run: () => app.openSession(s) },
      { label: t('members.ctx.call'), icon: 'phone', run: () => app.callFriend(f, false) },
      { label: t('members.ctx.videoCall'), icon: 'camera', run: () => app.callFriend(f, true) },
      '-',
      { label: t('channel.ctx.markRead'), icon: 'check', disabled: !u.count, run: () => s.markRead(DM_TEXT) },
      { label: t('channel.ctx.mute'), icon: 'bell-off', checked: s.isMuted(DM_TEXT), run: () => s.setMuted(DM_TEXT, !s.isMuted(DM_TEXT)) },
      '-',
      { label: t('members.ctx.copyName'), icon: 'copy', run: async () => (await copyText(f.name)) && toast(t('notice.copied'), 'ok', 2000) },
      { label: t('channel.ctx.removeDm'), icon: 'trash', danger: true, run: () => app.removeDenFlow(s) },
    ];
  });

  // Channels in the sidebar.
  contextMenu('.ch-row[data-channel]', (el) => {
    const s = app.activeDen;
    const c = s?.den.channels.find((x) => x.id === el.dataset.channel);
    if (!s || !c) return [];
    const voice = c.kind === 'voice';
    const inHere = app.media.inVoice(s, c.id);
    const u = voice ? { count: 0 } : s.unread(c.id);
    return [
      voice
        ? { label: t(inHere ? 'voice.disconnect' : 'voice.join'), icon: inHere ? 'hangup' : 'speaker', run: () => (inHere ? app.media.leave() : app.openVoice(c.id, true)) }
        : { label: t('channel.ctx.markRead'), icon: 'check', disabled: !u.count, run: () => s.markRead(c.id) },
      voice ? null : { label: t('channel.ctx.mute'), icon: 'bell-off', checked: s.isMuted(c.id), hint: t('channel.ctx.muteHint'), run: () => s.setMuted(c.id, !s.isMuted(c.id)) },
      { label: t('channel.ctx.notifications'), icon: 'bell', items: () => notifyItems(app, s) },
      '-',
      { label: t('channel.ctx.copyInvite'), icon: 'invite', brand: true, run: () => app.inviteFlow(s, { copy: true }) },
      { label: t('channel.ctx.copyName'), icon: 'copy', run: async () => (await copyText(`${voice ? '' : '#'}${c.name}`)) && toast(t('notice.copied'), 'ok', 2000) },
      '-',
      { label: t('den.renameChannel'), icon: 'edit', run: () => app.renameChannelFlow(s, c) },
      { label: t('den.settings'), icon: 'gear', run: () => app.denSettingsFlow(s) },
      { label: t('den.deleteChannel'), icon: 'trash', danger: true, run: () => app.deleteChannelFlow(s, c) },
    ];
  });

  // Dens in the rail.
  contextMenu('.rail-item[data-den]', (el) => {
    const s = app.sessions.get(el.dataset.den);
    if (!s) return [];
    const u = s.unreadTotal();
    return [
      { label: t('channel.ctx.markAllRead'), icon: 'check', disabled: !u.count && !u.mention, run: () => s.markAllRead() },
      { label: t('channel.ctx.notifications'), icon: 'bell', items: () => notifyItems(app, s) },
      '-',
      { label: t('den.invite'), icon: 'invite', brand: true, run: () => (app.openDen(s.id), app.inviteFlow(s)) },
      { label: t('den.settings'), icon: 'gear', run: () => app.denSettingsFlow(s) },
      { label: t('den.createChannel'), icon: 'plus', run: () => (app.openDen(s.id), app.createChannelFlow(s, 'text')) },
      '-',
      s.status !== 'offline' ? { label: t('den.disconnect'), icon: 'logout', run: () => s.leave() } : null,
      { label: t('den.remove'), icon: 'trash', danger: true, run: () => app.removeDenFlow(s) },
    ];
  });

  // Links inside messages: open or copy. A link to a message jumps to it.
  contextMenu(
    '.msg-content a[href]',
    (el) => {
      const href = el.href;
      const jump = app.parseMessageLink?.(href);
      return [
        { label: t(jump ? 'chat.ctx.goToMessage' : 'chat.ctx.openLink'), icon: jump ? 'chat' : 'external', run: () => (jump ? app.openMessageLink(jump) : window.open(href, '_blank', 'noopener,noreferrer')) },
        { label: t('chat.ctx.copyLink'), icon: 'link', run: async () => (await copyText(href)) && toast(t('notice.copied'), 'ok', 2000) },
      ];
    },
    { merge: true },
  );

  // Images and files: open, save, copy.
  contextMenu(
    '[data-file]',
    (el) => {
      const s = sessionOf(app, el);
      const id = el.dataset.file;
      const meta = s?.fileMeta(id);
      if (!meta) return [];
      const url = s.fileUrl(id);
      const image = /^image\//.test(meta.type);
      return [
        image ? { label: t('chat.ctx.openImage'), icon: 'image', disabled: !url, run: () => app.lightbox?.(meta, url) } : null,
        { label: t(image ? 'chat.ctx.saveImage' : 'chat.ctx.saveFile'), icon: 'download', disabled: !url, run: () => saveFile(url, meta.name) },
        image ? { label: t('chat.ctx.copyImage'), icon: 'copy', disabled: !url || typeof ClipboardItem === 'undefined', run: () => copyImage(app, url) } : null,
        { label: t('chat.ctx.copyFileName'), icon: 'file', run: async () => (await copyText(meta.name)) && toast(t('notice.copied'), 'ok', 2000) },
        url ? null : { label: t('chat.request'), icon: 'download', run: () => el.querySelector('.file-get')?.click() },
      ];
    },
    { merge: true },
  );

}
