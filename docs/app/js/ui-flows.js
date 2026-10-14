// Invite, join, scan and den management flows.

import { h, replace, copyText } from './dom.js';
import { icon } from './icons.js';
import { confirmDialog, modal, promptDialog, toast } from './ui-modal.js';
import { avatarSrc } from './ui-account.js';
import { encodeQR, qrPath } from '../core/qr.js';
import { CodeError, findCode, readReply, unpackCode } from '../core/invite.js';
import { MeshError } from '../core/mesh.js';

const NS = 'http://www.w3.org/2000/svg';

/** A QR code as an SVG element (no markup parsing). */
export function qrElement(text, label) {
  const qr = encodeQR(text, { ecl: 'L' });
  const side = qr.size + 8;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${side} ${side}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  svg.setAttribute('class', 'qr');
  const bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('width', side);
  bg.setAttribute('height', side);
  bg.setAttribute('fill', '#fff');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', qrPath(qr, 4));
  path.setAttribute('fill', '#0d0e12');
  svg.append(bg, path);
  return svg;
}

/** Translate a code or mesh error into words. */
export function codeErrorText(t, err) {
  if (err instanceof CodeError || err instanceof MeshError) {
    const key = `fail.${err.reason}`;
    const text = t(key, { name: '' });
    return text === key ? err.message : text;
  }
  return String(err?.message || err);
}

function failureBox(app, diagnosis, retry) {
  const t = app.t;
  return h(
    'div',
    { class: 'fail-box', role: 'alert' },
    h('div', { class: 'fail-head' }, icon('warning', { size: 20 }), h('strong', null, t('fail.title'))),
    h('p', null, t(`fail.${diagnosis}`)),
    h(
      'div',
      { class: 'row-btns' },
      h('button', { class: 'btn btn-brand btn-sm', type: 'button', onclick: () => app.openSettings('connection') }, icon('gear', { size: 16 }), t('fail.turn')),
      retry ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: retry }, icon('shuffle', { size: 16 }), t('fail.retry')) : null,
    ),
  );
}

function shareRow(app, link, title) {
  const t = app.t;
  const copyBtn = h(
    'button',
    {
      class: 'btn btn-brand btn-sm',
      type: 'button',
      onclick: async () => {
        await copyText(link);
        copyBtn.lastChild.textContent = t('invite.copied');
        setTimeout(() => (copyBtn.lastChild.textContent = t('invite.copy')), 1600);
      },
    },
    icon('copy', { size: 16 }),
    h('span', null, t('invite.copy')),
  );
  return h(
    'div',
    { class: 'share' },
    h('div', { class: 'share-qr' }, qrElement(link, title)),
    h(
      'div',
      { class: 'share-side' },
      h('input', { class: 'input field-input mono', readonly: true, value: link, 'aria-label': title, onfocus: (e) => e.target.select() }),
      h('div', { class: 'row-btns' }, copyBtn, navigator.share ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => navigator.share({ title: 'howlden', url: link }).catch(() => {}) }, icon('share', { size: 16 }), t('invite.share')) : null),
    ),
  );
}

/** Try the share sheet, then fall back to copying. Returns 'shared', 'copied' or 'none'. */
export async function shareOrCopy(link, title) {
  if (navigator.share) {
    try {
      await navigator.share({ title, url: link });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'none';
    }
  }
  return (await copyText(link)) ? 'copied' : 'none';
}

/**
 * Invite modal for a den, a 1 to 1 conversation, or a new friend.
 * options.friend makes a friend invite (the conversation is known only after the reply).
 * options.autoShare opens the share sheet as soon as the link is ready.
 */
export async function inviteModal(app, { session, friend = false, autoShare = false, title }) {
  const t = app.t;
  const status = h('div', { class: 'invite-status', 'aria-live': 'polite' }, h('span', { class: 'spinner spinner-xs' }), t('invite.making'));
  const body = h('div', { class: 'stack' }, status);
  let invite = null;
  let done = false;
  let peerName = '';
  const offs = [];
  const m = modal({
    title: title || t('invite.title', { den: session?.den.name || '' }),
    className: 'invite-modal',
    closeLabel: t('common.close'),
    body: [body],
    onClose: () => {
      offs.forEach((off) => off());
      if (invite) app.invites.delete(invite.inviteId);
      if (invite && !done) invite.cancel?.();
    },
  });

  const watch = (s, peerId) => {
    offs.push(
      s.on('link-open', (id) => {
        if (id !== peerId || done) return;
        done = true;
        replace(status, icon('check', { size: 18 }), t('invite.connected', { name: peerName }));
        status.className = 'invite-status ok';
        setTimeout(() => m.close(), 1300);
      }),
      s.on('link-failed', (f) => {
        if (f.peerId !== peerId || done) return;
        replace(body, failureBox(app, f.diagnosis, () => (m.close(), inviteModal(app, { session, friend, title }))));
      }),
    );
  };

  async function submit(text) {
    const found = findCode(text);
    if (!found) return setError(t('fail.empty'));
    if (found.kind === 'i') return setError(t('fail.notReply'));
    try {
      const reply = readReply(await unpackCode(found.code));
      if (reply.inviteId !== invite.inviteId) {
        const other = app.invites.get(reply.inviteId);
        if (other) return other.submit(text);
        throw new MeshError('expired', t('fail.expired'));
      }
      peerName = reply.peer.name;
      replace(status, h('span', { class: 'spinner spinner-xs' }), t('invite.connecting', { name: reply.peer.name }));
      status.className = 'invite-status';
      const target = await invite.accept(reply);
      watch(target, reply.peer.id);
      setError('');
    } catch (err) {
      setError(codeErrorText(t, err));
    }
  }

  const replyInput = h('textarea', { class: 'input field-input mono', rows: 2, placeholder: t('invite.replyPlaceholder'), 'aria-label': t('invite.step2') });
  const err = h('p', { class: 'form-error', role: 'alert' });
  const setError = (text) => (err.textContent = text);

  try {
    if (friend) {
      invite = await app.newFriendInvite();
    } else {
      const made = await session.createInvite();
      invite = { ...made, accept: async (reply) => (await session.acceptReply(reply), session), cancel: () => session.cancelInvite(made.inviteId) };
    }
  } catch (e) {
    replace(body, h('p', { class: 'form-error' }, codeErrorText(t, e)));
    return;
  }
  if (!m.open) return invite.cancel?.();
  app.invites.set(invite.inviteId, { submit });
  replace(status, h('span', { class: 'dot alone' }), t('invite.waiting'));
  replace(
    body,
    h('section', { class: 'step' }, h('h3', { class: 'step-title' }, h('span', { class: 'step-num' }, '1'), t('invite.step1')), h('p', { class: 'muted' }, t('invite.step1Hint')), shareRow(app, invite.link, t('invite.step1')), session?.den.locked ? h('p', { class: 'callout-warn' }, icon('lock', { size: 16 }), t('invite.locked')) : null),
    h(
      'section',
      { class: 'step' },
      h('h3', { class: 'step-title' }, h('span', { class: 'step-num' }, '2'), t('invite.step2')),
      h('p', { class: 'muted' }, t('invite.step2Hint')),
      replyInput,
      err,
      h(
        'div',
        { class: 'row-btns' },
        h('button', { class: 'btn btn-brand', type: 'button', onclick: () => submit(replyInput.value) }, t('invite.connect')),
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => app.scanFlow((text) => ((replyInput.value = text), submit(text))) }, icon('scan', { size: 16 }), t('invite.scan')),
      ),
    ),
    status,
  );
  replyInput.addEventListener('paste', () => setTimeout(() => findCode(replyInput.value)?.kind === 'r' && submit(replyInput.value), 0));
  if (autoShare) {
    const how = await shareOrCopy(invite.link, 'howlden');
    if (how === 'copied') toast(t('notice.copied'), 'ok');
  }
}

/** Guest side: show an invite, accept it, and hand back the reply. */
export async function joinModal(app, invite) {
  const t = app.t;
  const known = app.friends.get(invite.host.id);
  const clash = !known && app.friends.list().some((f) => f.name.toLowerCase() === invite.host.name.toLowerCase());
  const keyOk = known && known.publicKey === invite.host.publicKey;
  const badge = keyOk
    ? h('span', { class: 'verified' }, icon('shield', { size: 14 }), t('id.knownFriend'))
    : known
      ? h('span', { class: 'warn-tag' }, icon('warning', { size: 14 }), t('id.keyChanged'))
      : clash
        ? h('span', { class: 'warn-tag' }, icon('warning', { size: 14 }), t('id.nameClash'))
        : h('span', { class: 'new-tag' }, t('id.newPerson'));
  const pass = invite.den.locked ? h('input', { class: 'input field-input', type: 'password', autocomplete: 'off', required: true, id: 'join-pass' }) : null;
  const err = h('p', { class: 'form-error', role: 'alert' });
  const body = h('div', { class: 'stack' });
  const hostName = invite.host.tag ? `${invite.host.name}#${invite.host.tag}` : invite.host.name;
  const accept = h('button', { class: 'btn btn-brand btn-lg btn-block', type: 'button' }, t(invite.kind === 'dm' ? 'join.acceptDm' : 'join.accept'));
  replace(
    body,
    h(
      'div',
      { class: 'join-hero' },
      h('img', { class: 'avatar', src: avatarSrc(invite.host.avatar || invite.host.id), alt: '', width: 72, height: 72 }),
      h('p', { class: 'muted' }, invite.kind === 'dm' ? t('join.dmFrom', { host: hostName }) : t('join.invited', { host: hostName })),
      invite.kind === 'dm' ? null : h('h3', { class: 'join-den' }, invite.den.name),
      badge,
    ),
    (known && !keyOk) || clash ? h('p', { class: 'callout-warn' }, icon('warning', { size: 16 }), t(known ? 'id.keyChangedHint' : 'id.nameClashHint', { name: invite.host.name })) : null,
    pass ? h('label', { class: 'field', for: 'join-pass' }, h('span', { class: 'field-label' }, t('join.passphrase')), pass, h('span', { class: 'field-hint' }, t('join.passphraseHint'))) : null,
    h('div', { class: 'join-as' }, h('span', { class: 'muted' }, t('join.as')), h('img', { class: 'avatar', src: avatarSrc(app.profile.avatar), alt: '', width: 24, height: 24 }), h('strong', null, `${app.profile.name}#${app.profile.tag}`)),
    err,
    accept,
  );
  const m = modal({ title: t('join.title'), className: 'join-modal', closeLabel: t('common.close'), body: [body] });
  accept.addEventListener('click', async () => {
    if (pass && !pass.value) return pass.focus();
    accept.disabled = true;
    accept.textContent = t('join.making');
    let session;
    let reply;
    try {
      ({ session, reply } = await app.answerInvite(invite, pass?.value));
    } catch (e) {
      err.textContent = codeErrorText(t, e);
      accept.disabled = false;
      accept.textContent = t('join.accept');
      return;
    }
    if (!m.open) return;
    const status = h('div', { class: 'invite-status', 'aria-live': 'polite' }, h('span', { class: 'spinner spinner-xs' }), t('join.waiting', { host: invite.host.name }));
    replace(body, h('section', { class: 'step' }, h('h3', { class: 'step-title' }, t('join.replyTitle', { host: invite.host.name })), h('p', { class: 'muted' }, t('join.replyHint', { host: invite.host.name })), shareRow(app, reply.link, t('join.replyTitle', { host: invite.host.name }))), status);
    const offs = [
      session.on('link-open', (id) => {
        if (id !== invite.host.id) return;
        offs.forEach((off) => off());
        replace(status, icon('check', { size: 18 }), t('join.connected', { den: session.isDirect ? invite.host.name : session.den.name }));
        status.className = 'invite-status ok';
        setTimeout(() => {
          m.close();
          app.openSession(session);
        }, 900);
      }),
      session.on('link-failed', (f) => {
        if (f.peerId !== invite.host.id) return;
        replace(body, failureBox(app, f.diagnosis));
      }),
    ];
    if (invite.kind === 'dm') shareOrCopy(reply.link, 'howlden').then((how) => how === 'copied' && toast(t('notice.copied'), 'ok'));
  });
}

/** Paste an invite link by hand. */
export function pasteInviteModal(app) {
  const t = app.t;
  const input = h('input', { class: 'input field-input', id: 'paste-invite', placeholder: t('join.pastePlaceholder'), autocomplete: 'off' });
  const err = h('p', { class: 'form-error', role: 'alert' });
  const go = async (text) => {
    const found = findCode(text);
    if (!found) return (err.textContent = t('fail.empty'));
    m.close();
    await app.handleCode(found, { onError: (msg) => toast(msg, 'error') });
  };
  const m = modal({
    title: t('join.title'),
    lead: t('home.joinHint'),
    closeLabel: t('common.close'),
    body: [h('label', { class: 'field', for: 'paste-invite' }, h('span', { class: 'field-label' }, t('join.paste')), input), err],
    footer: [h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => app.scanFlow((text) => go(text)) }, icon('scan', { size: 16 }), t('invite.scan')), h('button', { class: 'btn btn-brand', type: 'button', onclick: () => go(input.value) }, t('join.continue'))],
  });
  input.addEventListener('keydown', (e) => e.key === 'Enter' && go(input.value));
  setTimeout(() => input.focus(), 30);
}

/** Scan a QR code with the camera through BarcodeDetector. */
export async function scanModal(app, onText) {
  const t = app.t;
  const msg = h('p', { class: 'muted' }, t('scan.hint'));
  const video = h('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true });
  let stream = null;
  let timer = null;
  const m = modal({
    title: t('scan.title'),
    closeLabel: t('common.close'),
    className: 'scan-modal',
    body: [h('div', { class: 'scan-box' }, video, h('div', { class: 'scan-frame', 'aria-hidden': 'true' })), msg],
    onClose: () => {
      clearInterval(timer);
      for (const tr of stream?.getTracks() || []) tr.stop();
    },
  });
  let supported = false;
  try {
    supported = 'BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats()).includes('qr_code');
  } catch {
    supported = false;
  }
  if (!supported) {
    msg.textContent = t('scan.unsupported');
    video.hidden = true;
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch {
    msg.textContent = t('scan.denied');
    video.hidden = true;
    return;
  }
  if (!m.open) return stream.getTracks().forEach((tr) => tr.stop());
  video.srcObject = stream;
  const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
  timer = setInterval(async () => {
    if (video.readyState < 2) return;
    try {
      const codes = await detector.detect(video);
      const text = codes.find((c) => findCode(c.rawValue))?.rawValue;
      if (text) {
        m.close();
        onText(text);
      }
    } catch {
      // keep trying
    }
  }, 250);
}

/** Create a den. */
export function createDenModal(app) {
  const t = app.t;
  const name = h('input', { class: 'input field-input', id: 'den-name', maxlength: 60, value: t('den.defaultName', { name: app.profile.name }), required: true });
  const pass = h('input', { class: 'input field-input', id: 'den-pass', type: 'password', autocomplete: 'new-password', maxlength: 200 });
  const show = h('input', { class: 'checkbox', type: 'checkbox', onchange: (e) => (pass.type = e.target.checked ? 'text' : 'password') });
  const form = h(
    'form',
    {
      class: 'stack',
      onsubmit: async (e) => {
        e.preventDefault();
        if (!name.value.trim()) return name.focus();
        m.close();
        await app.createDen({ name: name.value.trim(), passphrase: pass.value });
      },
    },
    h('div', { class: 'create-ico' }, icon('logo', { size: 44 })),
    h('label', { class: 'field', for: 'den-name' }, h('span', { class: 'field-label' }, t('create.name')), name),
    h('label', { class: 'field', for: 'den-pass' }, h('span', { class: 'field-label' }, t('pass.optional')), pass, h('span', { class: 'field-hint' }, t('pass.optionalHint'))),
    h('label', { class: 'check-row' }, show, t('pass.show')),
    h('div', { class: 'modal-foot flush' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, t('common.cancel')), h('button', { class: 'btn btn-brand', type: 'submit' }, t('create.submit'))),
  );
  const m = modal({ title: t('create.title'), lead: t('create.lead'), closeLabel: t('common.close'), body: [form] });
  setTimeout(() => name.select(), 30);
}

/** Create a channel. */
export function createChannelModal(app, session, kind = 'text') {
  const t = app.t;
  const name = h('input', { class: 'input field-input', id: 'ch-name', maxlength: 32, required: true, placeholder: kind === 'text' ? 'new-channel' : 'Voice' });
  const radio = (value, title, hint, ico) =>
    h(
      'label',
      { class: 'radio-card-row' },
      h('input', { type: 'radio', name: 'kind', value, checked: kind === value, onchange: () => (kind = value) }),
      icon(ico, { size: 22 }),
      h('span', null, h('strong', null, title), h('small', null, hint)),
    );
  const form = h(
    'form',
    {
      class: 'stack',
      onsubmit: (e) => {
        e.preventDefault();
        const id = session.addChannel(kind, name.value);
        if (!id) return name.focus();
        m.close();
        if (kind === 'text') app.openChannel(id);
      },
    },
    h('fieldset', { class: 'stack-sm' }, h('legend', { class: 'field-label' }, t('create.channelName')), radio('text', t('create.text'), t('create.textHint'), 'hash'), radio('voice', t('create.voice'), t('create.voiceHint'), 'speaker')),
    h('label', { class: 'field', for: 'ch-name' }, h('span', { class: 'field-label' }, t('create.channelName')), name),
    h('div', { class: 'modal-foot flush' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, t('common.cancel')), h('button', { class: 'btn btn-brand', type: 'submit' }, t('create.channelSubmit'))),
  );
  const m = modal({ title: t('create.channelTitle'), closeLabel: t('common.close'), body: [form] });
  setTimeout(() => name.focus(), 30);
}

export async function renameChannelFlow(app, session, channel) {
  const t = app.t;
  const name = await promptDialog(t, { title: t('den.renameChannel'), label: t('create.channelName'), value: channel.name, maxlength: 32 });
  if (name) session.renameChannel(channel.id, name);
}

export async function deleteChannelFlow(app, session, channel) {
  const t = app.t;
  if (await confirmDialog(t, { title: t('den.deleteChannel'), text: t('den.deleteChannelConfirm', { name: channel.name }), ok: t('common.delete'), danger: true })) {
    session.deleteChannel(channel.id);
    if (app.channelId === channel.id) app.openDen(session.id);
  }
}

/** Den settings: name, passphrase, local data. */
export function denSettingsModal(app, session) {
  const t = app.t;
  const name = h('input', { class: 'input field-input', id: 'ds-name', maxlength: 60, value: session.den.name });
  const m = modal({
    title: t('den.settings'),
    closeLabel: t('common.close'),
    body: [
      h('label', { class: 'field', for: 'ds-name' }, h('span', { class: 'field-label' }, t('settings.denName')), name),
      h(
        'div',
        { class: 'field' },
        h('span', { class: 'field-label' }, t('settings.denPass')),
        h('p', null, icon(session.den.locked ? 'lock' : 'shield', { size: 16 }), ' ', t(session.den.locked ? 'settings.denPassOn' : 'settings.denPassOff')),
        session.den.locked ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => app.askPassphrase(session) }, t('settings.denPassSet')) : null,
      ),
      h('p', { class: 'muted' }, t('settings.messages', { n: session.messages.size })),
    ],
    footer: [
      h('button', { class: 'btn btn-danger btn-soft', type: 'button', onclick: () => (m.close(), app.removeDenFlow(session)) }, t('den.remove')),
      h(
        'button',
        {
          class: 'btn btn-brand',
          type: 'button',
          onclick: () => {
            if (name.value.trim() && name.value.trim() !== session.den.name) session.rename(name.value);
            m.close();
          },
        },
        t('common.save'),
      ),
    ],
  });
}

/** Ask for a den passphrase. Resolves true when set. */
export async function passphraseFlow(app, session) {
  const t = app.t;
  const value = await promptDialog(t, { title: t('pass.title', { den: session.den.name }), label: t('pass.label'), type: 'password', hint: t('pass.hint'), ok: t('pass.unlock'), maxlength: 200 });
  if (!value) return false;
  await session.setPassphrase(value);
  return true;
}

/** Handle a code found in the URL or pasted somewhere. */
export async function readCode(app, found) {
  return unpackCode(found.code);
}
