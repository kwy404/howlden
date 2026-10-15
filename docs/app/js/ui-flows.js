// Invite, join, scan and den management flows.

import { h } from './dom.js';
import { icon } from './icons.js';
import { confirmDialog, modal, promptDialog } from './ui-modal.js';
import { encodeQR, qrPath } from '../core/qr.js';
import { CodeError, findCode, unpackCode } from '../core/invite.js';
import { wordsFromLink } from '../core/words.js';
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

/**
 * Translate any error into plain words. Raw exception text (often a browser
 * message in English about SDP states) is never shown; it goes to the console.
 */
export function codeErrorText(t, err) {
  if (err instanceof CodeError || err instanceof MeshError) {
    const key = `fail.${err.reason}`;
    const text = t(key, { name: '', count: '', max: '' });
    if (text !== key) return text;
  }
  console.warn('howlden:', err);
  return t('fail.generic');
}

export function failureBox(app, diagnosis, retry) {
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
      const text = codes.find((c) => findCode(c.rawValue) || wordsFromLink(c.rawValue))?.rawValue;
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
      class: 'hl-stack',
      onsubmit: async (e) => {
        e.preventDefault();
        if (!name.value.trim()) return name.focus();
        m.close();
        await app.createDen({ name: name.value.trim(), passphrase: pass.value });
      },
    },
    h('div', { class: 'create-ico' }, icon('logo', { size: 44 })),
    h('label', { class: 'hl-field', for: 'den-name' }, h('span', { class: 'field-label' }, t('create.name')), name),
    h('label', { class: 'hl-field', for: 'den-pass' }, h('span', { class: 'field-label' }, t('pass.optional')), pass, h('span', { class: 'field-hint' }, t('pass.optionalHint'))),
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
      class: 'hl-stack',
      onsubmit: (e) => {
        e.preventDefault();
        const id = session.addChannel(kind, name.value);
        if (!id) return name.focus();
        m.close();
        if (kind === 'text') app.openChannel(id);
      },
    },
    h('fieldset', { class: 'stack-sm' }, h('legend', { class: 'field-label' }, t('create.channelName')), radio('text', t('create.text'), t('create.textHint'), 'hash'), radio('voice', t('create.voice'), t('create.voiceHint'), 'speaker')),
    h('label', { class: 'hl-field', for: 'ch-name' }, h('span', { class: 'field-label' }, t('create.channelName')), name),
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
      h('label', { class: 'hl-field', for: 'ds-name' }, h('span', { class: 'field-label' }, t('settings.denName')), name),
      h(
        'div',
        { class: 'hl-field' },
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
