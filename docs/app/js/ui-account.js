// The first screen (create a local profile or join with an invite), the PIN
// unlock screen, the friendly human check and the avatar cropper.

import { h, replace } from './dom.js';
import { icon } from './icons.js';
import { modal, toast } from './ui-modal.js';
import { avatarUrl } from '../core/avatar.js';
import { randomId } from '../core/crypto.js';
import { findCode } from '../core/invite.js';
import { LANGS } from './i18n.js';

/** Image source for an avatar value: a generated seed or an uploaded data URL. */
export function avatarSrc(value) {
  return String(value || '').startsWith('data:image/') ? value : avatarUrl(value || 'x');
}

/** A small local puzzle. Not security, just a gate against accidental taps. */
export function humanCheck(t, onPass) {
  const choices = ['logo', 'moon', 'sun', 'bell', 'globe', 'file'];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  let passed = false;
  const status = h('p', { class: 'check-status', 'aria-live': 'polite' });
  const grid = h(
    'div',
    { class: 'check-grid', role: 'group', 'aria-label': t('login.checkPrompt') },
    choices.map((name) =>
      h(
        'button',
        {
          class: 'check-btn',
          type: 'button',
          'aria-label': t(`login.pick.${name}`),
          onclick: (e) => {
            if (passed) return;
            if (name === 'logo') {
              passed = true;
              e.currentTarget.classList.add('right');
              el.classList.add('passed');
              status.textContent = t('login.checkOk');
              onPass?.();
            } else {
              e.currentTarget.classList.add('wrong');
              status.textContent = t('login.checkWrong');
              setTimeout(() => e.currentTarget.classList.remove('wrong'), 600);
            }
          },
        },
        icon(name, { size: 26 }),
      ),
    ),
  );
  const el = h('fieldset', { class: 'check' }, h('legend', { class: 'field-label' }, t('login.check')), h('p', { class: 'check-prompt' }, t('login.checkPrompt')), grid, status, h('p', { class: 'field-hint' }, t('login.checkHint')));
  return { el, get passed() {
    return passed;
  } };
}

/** Let the user crop an uploaded image to a square avatar. Resolves to a small data URL or null. */
export function cropAvatar(t, file) {
  return new Promise((resolve) => {
    let result = null;
    const url = URL.createObjectURL(file);
    const img = new Image();
    const canvas = h('canvas', { class: 'crop-canvas', width: 280, height: 280, 'aria-label': t('crop.title') });
    const zoom = h('input', { class: 'range', type: 'range', min: 1, max: 4, step: 0.01, value: 1, 'aria-label': t('crop.zoom') });
    const view = { x: 0, y: 0, scale: 1, base: 1 };
    const draw = () => {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, 280, 280);
      const s = view.base * view.scale;
      ctx.drawImage(img, 140 - (img.width * s) / 2 + view.x, 140 - (img.height * s) / 2 + view.y, img.width * s, img.height * s);
    };
    const clamp = () => {
      const s = view.base * view.scale;
      const mx = Math.max(0, (img.width * s - 280) / 2);
      const my = Math.max(0, (img.height * s - 280) / 2);
      view.x = Math.max(-mx, Math.min(mx, view.x));
      view.y = Math.max(-my, Math.min(my, view.y));
    };
    img.onload = () => {
      view.base = 280 / Math.min(img.width, img.height);
      draw();
    };
    img.onerror = () => {
      toast(t('crop.bad'), 'error');
      m.close();
    };
    img.src = url;
    zoom.addEventListener('input', () => {
      view.scale = Number(zoom.value);
      clamp();
      draw();
    });
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX - view.x, y: e.clientY - view.y };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      view.x = e.clientX - drag.x;
      view.y = e.clientY - drag.y;
      clamp();
      draw();
    });
    canvas.addEventListener('pointerup', () => (drag = null));
    canvas.tabIndex = 0;
    canvas.addEventListener('keydown', (e) => {
      const step = { ArrowLeft: [8, 0], ArrowRight: [-8, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[e.key];
      if (!step) return;
      e.preventDefault();
      view.x += step[0];
      view.y += step[1];
      clamp();
      draw();
    });
    const save = () => {
      const out = document.createElement('canvas');
      out.width = out.height = 128;
      out.getContext('2d').drawImage(canvas, 0, 0, 280, 280, 0, 0, 128, 128);
      let data = out.toDataURL('image/webp', 0.82);
      if (!data.startsWith('data:image/webp')) data = out.toDataURL('image/jpeg', 0.85);
      result = data.length < 40000 ? data : out.toDataURL('image/jpeg', 0.6);
      m.close();
    };
    const m = modal({
      title: t('crop.title'),
      closeLabel: t('common.close'),
      className: 'crop-modal',
      body: [h('div', { class: 'crop-wrap' }, canvas, h('div', { class: 'crop-ring', 'aria-hidden': 'true' })), h('label', { class: 'hl-field' }, h('span', { class: 'field-label' }, t('crop.zoom')), zoom), h('p', { class: 'field-hint' }, t('crop.hint'))],
      footer: [h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, t('common.cancel')), h('button', { class: 'btn btn-brand', type: 'button', onclick: save }, t('crop.apply'))],
      onClose: () => {
        URL.revokeObjectURL(url);
        resolve(result);
      },
    });
  });
}

/** The avatar picker used on the login card and in settings. */
export function avatarPicker(t, initial, onChange) {
  let value = initial || randomId(6);
  const img = h('img', { class: 'av av-lg', src: avatarSrc(value), alt: t('settings.avatar'), width: 88, height: 88 });
  const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true });
  const set = (v) => {
    value = v;
    img.src = avatarSrc(v);
    onChange?.(v);
  };
  file.addEventListener('change', async () => {
    const f = file.files[0];
    file.value = '';
    if (!f) return;
    const data = await cropAvatar(t, f);
    if (data) set(data);
  });
  const el = h(
    'div',
    { class: 'avatar-pick' },
    img,
    h(
      'div',
      { class: 'avatar-pick-actions' },
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => set(randomId(6)) }, icon('shuffle', { size: 16 }), t('onboard.shuffle')),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => file.click() }, icon('image', { size: 16 }), t('login.upload')),
      file,
    ),
  );
  return { el, get value() {
    return value;
  } };
}

/**
 * The first screen. Left: create a local profile. Right: join with an invite
 * (camera scan or paste). Calls app.createProfile() and app.handleCode().
 */
export function loginCard(app, { invite } = {}) {
  const t = (k, v) => app.t(k, v);
  const root = document.getElementById('gate');
  const name = h('input', { class: 'input field-input', id: 'login-name', name: 'username', autocomplete: 'nickname', maxlength: 32, required: true, placeholder: t('onboard.namePlaceholder') });
  const picker = avatarPicker(t);
  const accent = h('input', { class: 'color-swatch', type: 'color', value: '#ff8a3d', 'aria-label': t('login.accent') });
  const useAccent = h('input', { class: 'toggle', type: 'checkbox', 'aria-label': t('login.accentUse') });
  const check = humanCheck(t, () => (submit.disabled = false));
  const submit = h('button', { class: 'btn btn-brand btn-lg btn-block', type: 'submit', disabled: true }, t('login.create'));
  const error = h('p', { class: 'form-error', role: 'alert' });
  const lang = h('select', { class: 'select select-sm', 'aria-label': t('settings.language'), onchange: (e) => app.setLang(e.target.value, true) }, Object.entries(LANGS).map(([k, v]) => h('option', { value: k, selected: app.lang === k }, v)));

  const form = h(
    'form',
    {
      class: 'login-form',
      onsubmit: async (e) => {
        e.preventDefault();
        const n = name.value.trim();
        if (!n) {
          error.textContent = t('login.needName');
          return name.focus();
        }
        if (!check.passed) {
          error.textContent = t('login.needCheck');
          return;
        }
        submit.disabled = true;
        submit.textContent = t('login.creating');
        try {
          await app.createProfile({ name: n.slice(0, 32), avatar: picker.value, accent: useAccent.checked ? accent.value : '' });
        } catch (err) {
          error.textContent = String(err.message || err);
          submit.disabled = false;
          submit.textContent = t('login.create');
        }
      },
    },
    h('h1', { class: 'login-title' }, t('login.title')),
    h('p', { class: 'login-lead' }, invite ? t('login.leadInvite', { host: invite.host.name }) : t('login.lead')),
    h('label', { class: 'hl-field', for: 'login-name' }, h('span', { class: 'field-label' }, t('login.username'), h('span', { class: 'req', 'aria-hidden': 'true' }, ' *')), name),
    h('div', { class: 'hl-field' }, h('span', { class: 'field-label' }, t('settings.avatar')), picker.el),
    h('div', { class: 'hl-field field-row' }, h('label', { class: 'switch-row' }, useAccent, h('span', null, t('login.accentUse'))), accent),
    check.el,
    error,
    submit,
    h('p', { class: 'login-fine' }, icon('shield', { size: 16 }), t('login.local')),
    h('div', { class: 'login-links' }, h('button', { class: 'link-btn', type: 'button', onclick: () => app.restoreFlow() }, t('login.restore')), lang),
  );

  const paste = h('input', { class: 'input field-input', id: 'login-invite', placeholder: t('join.pastePlaceholder'), autocomplete: 'off', value: invite ? location.href : '' });
  const joinMsg = h('p', { class: 'form-error', role: 'alert' });
  const joinSide = h(
    'div',
    { class: 'login-side' },
    h('div', { class: 'login-qr' }, h('div', { class: 'qr-frame' }, icon('scan', { size: 64 })), h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => app.scanFlow((text) => ((paste.value = text), useCode())) }, icon('camera', { size: 18 }), t('login.scan'))),
    h('h2', { class: 'login-title small' }, t('login.joinTitle')),
    h('p', { class: 'login-lead' }, t('login.joinLead')),
    h('label', { class: 'hl-field', for: 'login-invite' }, h('span', { class: 'field-label' }, t('join.paste')), paste),
    joinMsg,
    h('button', { class: 'btn btn-ghost btn-block', type: 'button', onclick: () => useCode() }, t('join.continue')),
    invite ? h('div', { class: 'login-invite' }, h('img', { class: 'av', src: avatarSrc(invite.host.avatar || invite.host.id), alt: '', width: 40, height: 40 }), h('div', null, h('strong', null, invite.kind === 'dm' ? t('login.friendInvite', { host: invite.host.name }) : t('login.denInvite', { host: invite.host.name, den: invite.den.name })), h('p', null, t('login.inviteHold')))) : null,
  );

  async function useCode() {
    const found = findCode(paste.value);
    if (!found) {
      joinMsg.textContent = t('fail.empty');
      return;
    }
    joinMsg.textContent = '';
    await app.handleCode(found, { fromGate: true, onError: (msg) => (joinMsg.textContent = msg) });
    if (app.pendingInvite) {
      replace(joinMsg);
      joinMsg.className = 'form-ok';
      joinMsg.textContent = t('login.inviteSaved');
      name.focus();
    }
  }

  replace(
    root,
    h(
      'main',
      { class: 'login', id: 'main' },
      h('a', { class: 'login-brand', href: '../', 'aria-label': 'howlden' }, h('img', { src: '../assets/mascot-head.svg', alt: '', width: 40, height: 40 }), h('span', null, 'howlden')),
      h('img', { class: 'login-art', src: '../assets/art/characters/luna.svg', alt: '', width: 200, height: 200 }),
      h('img', { class: 'login-art right', src: '../assets/art/characters/ember.svg', alt: '', width: 150, height: 150 }),
      h('div', { class: 'login-card' }, form, h('div', { class: 'login-divider', 'aria-hidden': 'true' }), joinSide),
    ),
  );
  root.hidden = false;
  setTimeout(() => name.focus(), 50);
}

/** PIN unlock screen for a locked account. */
export function pinScreen(app) {
  const t = (k, v) => app.t(k, v);
  const root = document.getElementById('gate');
  const pin = h('input', { class: 'input field-input pin-input', id: 'pin', type: 'password', inputmode: 'numeric', autocomplete: 'current-password', pattern: '[0-9]*', maxlength: 12, required: true });
  const error = h('p', { class: 'form-error', role: 'alert' });
  const btn = h('button', { class: 'btn btn-brand btn-lg btn-block', type: 'submit' }, t('pin.unlock'));
  replace(
    root,
    h(
      'main',
      { class: 'login', id: 'main' },
      h('a', { class: 'login-brand', href: '../' }, h('img', { src: '../assets/mascot-head.svg', alt: '', width: 40, height: 40 }), h('span', null, 'howlden')),
      h(
        'form',
        {
          class: 'login-card narrow',
          onsubmit: async (e) => {
            e.preventDefault();
            btn.disabled = true;
            btn.textContent = t('pin.checking');
            const ok = await app.unlock(pin.value);
            if (!ok) {
              error.textContent = t('pin.wrong');
              btn.disabled = false;
              btn.textContent = t('pin.unlock');
              pin.select();
            }
          },
        },
        h('div', { class: 'login-form' }, h('div', { class: 'pin-ico' }, icon('lock', { size: 36 })), h('h1', { class: 'login-title' }, t('pin.title')), h('p', { class: 'login-lead' }, t('pin.lead')), h('label', { class: 'hl-field', for: 'pin' }, h('span', { class: 'field-label' }, t('pin.label')), pin), error, btn, h('p', { class: 'login-fine' }, h('button', { class: 'link-btn', type: 'button', onclick: () => app.forgotPinFlow() }, t('pin.forgot')))),
      ),
    ),
  );
  root.hidden = false;
  setTimeout(() => pin.focus(), 50);
}
