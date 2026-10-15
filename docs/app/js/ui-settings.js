// The settings screen: profile, account, voice and video, connection,
// privacy, notifications, language and appearance.

import { h, replace } from './dom.js';
import { icon } from './icons.js';
import { confirmDialog, modal, promptDialog, toast } from './ui-modal.js';
import { avatarPicker } from './ui-account.js';
import { keyName } from './ui-shell.js';
import { LANGS } from './i18n.js';
import { STUN_SERVERS, parseTurn } from '../core/rtc.js';
import { BackupError } from '../core/identity.js';
import { SOUND_NAMES } from './sounds.js';
import { VERSION } from '../core/version.js';
import { activeStatus } from '../core/mesh.js';

const SECTIONS = [
  ['user', [['profile', 'edit'], ['account', 'lock'], ['privacy', 'shield']]],
  ['app', [['voice', 'mic'], ['connection', 'signal'], ['notifications', 'bell'], ['language', 'globe'], ['appearance', 'palette'], ['storage', 'file']]],
];

/** Check that a TURN server hands out relay candidates. */
export async function testTurn(server, ms = 9000) {
  const pc = new RTCPeerConnection({ iceServers: [server], iceTransportPolicy: 'relay' });
  try {
    pc.createDataChannel('t');
    const found = new Promise((resolve) => {
      pc.onicecandidate = (e) => {
        if (e.candidate && / typ relay /.test(e.candidate.candidate)) resolve(true);
        if (!e.candidate) resolve(false);
      };
      setTimeout(() => resolve(false), ms);
    });
    await pc.setLocalDescription(await pc.createOffer());
    return await found;
  } finally {
    pc.close();
  }
}

function field(label, control, hint, id) {
  return h('label', { class: 'hl-field', for: id || null }, h('span', { class: 'field-label' }, label), control, hint ? h('span', { class: 'field-hint' }, hint) : null);
}

function toggleRow(label, checked, onchange, hint) {
  const input = h('input', { class: 'toggle', type: 'checkbox', checked, onchange: (e) => onchange(e.target.checked) });
  return h('label', { class: 'toggle-row' }, h('span', null, h('span', { class: 'toggle-label' }, label), hint ? h('span', { class: 'field-hint' }, hint) : null), input);
}

export function openSettings(app, section = 'profile') {
  const t = app.t;
  const content = h('div', { class: 'settings-content', tabindex: '-1' });
  const nav = h('nav', { class: 'settings-nav', 'aria-label': t('settings.title') });
  let current = section;
  let cleanup = [];
  const overlay = h(
    'div',
    { class: 'settings', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('settings.title') },
    h('div', { class: 'settings-side' }, nav),
    h('div', { class: 'settings-main' }, content, h('div', { class: 'settings-close' }, h('button', { class: 'round-x', type: 'button', 'aria-label': t('common.close'), onclick: () => close() }, icon('x', { size: 20 })), h('span', { 'aria-hidden': 'true' }, t('settings.esc')))),
  );
  const onKey = (e) => {
    if (e.key === 'Escape' && !document.querySelector('dialog[open]')) close();
  };
  function close() {
    cleanup.forEach((fn) => fn());
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    app.render();
  }
  document.addEventListener('keydown', onKey);

  function renderNav() {
    replace(
      nav,
      SECTIONS.map(([group, items]) => [
        h('h2', { class: 'settings-group' }, t(`settings.${group}`)),
        items.map(([key, ico]) => h('button', { class: `settings-tab${key === current ? ' active' : ''}`, type: 'button', 'aria-current': key === current ? 'page' : null, onclick: () => show(key) }, icon(ico, { size: 18 }), t(`settings.${key}`))),
      ]),
      h('div', { class: 'settings-sep' }),
      h('p', { class: 'settings-ver' }, `howlden ${VERSION}`),
    );
  }

  function show(key) {
    cleanup.forEach((fn) => fn());
    cleanup = [];
    current = key;
    renderNav();
    replace(content, h('h1', { class: 'settings-title' }, t(`settings.${key}`)), PANES[key]());
    content.focus({ preventScroll: true });
    content.scrollTop = 0;
  }

  const PANES = {
    profile() {
      const p = app.profile;
      const name = h('input', { class: 'input field-input', id: 'set-name', maxlength: 32, value: p.name });
      const status = h('input', { class: 'input field-input', id: 'set-status', maxlength: 128, value: activeStatus(p), placeholder: t('profile.statusPlaceholder') });
      // How long the status stays: minutes, 'today' (until midnight) or 0 (until cleared).
      const until = h(
        'select',
        { class: 'select', id: 'set-status-until', 'aria-label': t('profile.statusUntil') },
        [
          [0, t('profile.until.never')],
          [30, t('profile.until.30m')],
          [60, t('profile.until.1h')],
          [240, t('profile.until.4h')],
          ['today', t('profile.until.today')],
        ].map(([v, label]) => h('option', { value: String(v) }, label)),
      );
      const statusEnd = () => {
        if (until.value === 'today') {
          const d = new Date();
          d.setHours(23, 59, 59, 0);
          return d.getTime();
        }
        const minutes = Number(until.value);
        return minutes ? Date.now() + minutes * 60000 : 0;
      };
      const accent = h('input', { class: 'color-swatch', id: 'set-accent', type: 'color', value: p.accent || '#ff8a3d' });
      const useAccent = h('input', { class: 'toggle', type: 'checkbox', checked: !!p.accent, 'aria-label': t('login.accentUse') });
      const picker = avatarPicker(t, p.avatar);
      return h(
        'form',
        {
          class: 'hl-stack settings-form',
          onsubmit: async (e) => {
            e.preventDefault();
            if (!name.value.trim()) return name.focus();
            const text = status.value.trim();
            const keep = text === activeStatus(p) && until.value === '0' ? p.statusUntil || 0 : statusEnd();
            await app.updateProfile({ name: name.value.trim(), status: text, statusUntil: text ? keep : 0, avatar: picker.value, accent: useAccent.checked ? accent.value : '' });
            toast(t('notice.saved'), 'ok');
          },
        },
        h('div', { class: 'profile-preview', style: { '--banner': p.accent || null } }, h('div', { class: 'profile-banner' }), picker.el, h('div', null, h('strong', { class: 'profile-handle' }, `${p.name}#${p.tag}`), h('p', { class: 'muted' }, t('profile.tagHint')))),
        field(t('settings.name'), name, null, 'set-name'),
        field(t('profile.status'), status, p.statusUntil && activeStatus(p) ? t('profile.statusEnds', { when: new Date(p.statusUntil).toLocaleString(app.lang, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) }) : t('profile.statusHint'), 'set-status'),
        field(t('profile.statusUntil'), until, null, 'set-status-until'),
        h('div', { class: 'hl-field field-row' }, h('label', { class: 'switch-row' }, useAccent, h('span', null, t('login.accentUse'))), accent),
        h('div', { class: 'hl-field' }, h('span', { class: 'field-label' }, t('profile.key')), h('code', { class: 'fp' }, `${app.identity.alg}, ${app.identity.id}`), h('span', { class: 'field-hint' }, t('profile.keyHint'))),
        h('div', null, h('button', { class: 'btn btn-brand', type: 'submit' }, t('common.save'))),
      );
    },

    account() {
      const pinState = h('div');
      const renderPin = async () => {
        const on = await app.account.hasPin();
        replace(
          pinState,
          h('p', null, icon(on ? 'lock' : 'shield', { size: 16 }), ' ', t(on ? 'account.pinOn' : 'account.pinOff')),
          h(
            'button',
            {
              class: 'btn btn-ghost btn-sm',
              type: 'button',
              onclick: async () => {
                if (on) {
                  if (await confirmDialog(t, { title: t('account.pinRemove'), text: t('account.pinRemoveText') })) await app.account.removePin(app.profile, app.identity);
                } else {
                  const pin = await promptDialog(t, { title: t('account.pinSet'), label: t('account.pinLabel'), type: 'password', hint: t('account.pinHint'), maxlength: 12 });
                  if (!pin) return;
                  if (!/^\d{4,12}$/.test(pin)) return toast(t('account.pinBad'), 'error');
                  const again = await promptDialog(t, { title: t('account.pinSet'), label: t('account.pinAgain'), type: 'password', maxlength: 12 });
                  if (again !== pin) return toast(t('account.pinMismatch'), 'error');
                  await app.account.setPin(pin, app.profile);
                }
                toast(t('notice.saved'), 'ok');
                renderPin();
              },
            },
            t(on ? 'account.pinRemove' : 'account.pinSet'),
          ),
        );
      };
      renderPin();
      return h(
        'div',
        { class: 'hl-stack' },
        h('div', { class: 'hl-callout' }, icon('info', { size: 18 }), h('div', null, h('strong', null, t('account.localTitle')), h('p', null, t('account.local')))),
        h('section', { class: 'set-sec' }, h('h2', null, t('account.pin')), h('p', { class: 'muted' }, t('account.pinText')), pinState),
        h(
          'section',
          { class: 'set-sec' },
          h('h2', null, t('account.backup')),
          h('p', { class: 'muted' }, t('account.backupText')),
          h(
            'div',
            { class: 'row-btns' },
            h(
              'button',
              {
                class: 'btn btn-brand btn-sm',
                type: 'button',
                onclick: async () => {
                  const pw = await promptDialog(t, { title: t('account.export'), label: t('account.backupPassword'), type: 'password', hint: t('account.backupPasswordHint'), maxlength: 200 });
                  if (!pw) return;
                  if (pw.length < 8) return toast(t('account.backupShort'), 'error');
                  const text = await app.account.exportAccount(pw, app.profile);
                  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
                  const a = h('a', { href: url, download: `howlden-${app.profile.name.replace(/[^\w-]+/g, '') || 'account'}-${app.profile.tag}.howlden.json` });
                  document.body.append(a);
                  a.click();
                  a.remove();
                  setTimeout(() => URL.revokeObjectURL(url), 2000);
                },
              },
              icon('download', { size: 16 }),
              t('account.export'),
            ),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => app.restoreFlow() }, icon('enter', { size: 16 }), t('account.import')),
          ),
          h('p', { class: 'field-hint' }, t('account.backupWhy')),
        ),
        h(
          'section',
          { class: 'set-sec danger-zone' },
          h('h2', null, t('account.delete')),
          h('p', { class: 'muted' }, t('account.deleteText')),
          h(
            'button',
            {
              class: 'btn btn-danger btn-soft btn-sm',
              type: 'button',
              onclick: async () => {
                if (await confirmDialog(t, { title: t('account.delete'), text: t('account.deleteConfirm'), ok: t('common.delete'), danger: true })) app.deleteAccount();
              },
            },
            t('account.delete'),
          ),
        ),
      );
    },

    voice() {
      const box = h('div', { class: 'hl-stack' });
      const s = app.settings;
      const select = (label, kind, key, onchange) => {
        const el = h('select', { class: 'select', id: `set-${key}`, onchange: (e) => onchange(e.target.value) }, h('option', { value: '' }, t('settings.default')));
        app.media.devices().then((d) => {
          for (const dev of d[kind]) if (dev.deviceId && dev.deviceId !== 'default') el.append(h('option', { value: dev.deviceId, selected: s[key] === dev.deviceId }, dev.label || `${kind} ${el.length}`));
        });
        return field(label, el, null, `set-${key}`);
      };
      // Live meter: input level, where the gate opens, and whether it is open
      const fill = h('span', { class: 'meter-fill' });
      const mark = h('span', { class: 'meter-mark', title: t('voice.gateMark') });
      const meter = h('div', { class: 'meter-bar gate-meter', role: 'img', 'aria-label': t('voice.meterLabel') }, fill, mark);
      const gateState = h('span', { class: 'gate-state' }, t('voice.gateClosed'));
      const toPct = (db) => Math.max(0, Math.min(100, ((db + 80) / 80) * 100));
      const tick = setInterval(() => {
        const lv = app.media.micLevel;
        if (lv) {
          fill.style.width = `${toPct(lv.input)}%`;
          mark.style.left = `${toPct(lv.input - lv.snr + lv.threshold)}%`;
          mark.hidden = false;
          meter.classList.toggle('open', !!lv.open);
          gateState.textContent = t(lv.open ? 'voice.gateOpen' : 'voice.gateClosed');
          gateState.classList.toggle('open', !!lv.open);
        } else {
          const level = Math.max(app.media.level('test'), app.media.level('self'));
          fill.style.width = `${Math.min(100, level * 400)}%`;
          mark.hidden = true;
          gateState.textContent = '';
        }
      }, 80);
      const testBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-pressed': 'false' }, icon('headphones', { size: 16 }), t('voice.testMic'));
      testBtn.addEventListener('click', async () => {
        if (app.media.testPipe) {
          app.media.stopMicTest();
          testBtn.lastChild.textContent = t('voice.testMic');
          testBtn.setAttribute('aria-pressed', 'false');
          return;
        }
        try {
          await app.media.startMicTest();
          testBtn.lastChild.textContent = t('voice.testMicStop');
          testBtn.setAttribute('aria-pressed', 'true');
        } catch {
          toast(t('notice.mic-failed'), 'error');
        }
      });
      cleanup.push(() => {
        clearInterval(tick);
        app.media.stopMicTest();
      });
      const pttKey = h('button', { class: 'kbd-btn', type: 'button' }, keyName(s.pttKey));
      pttKey.addEventListener('click', () => {
        pttKey.textContent = t('settings.pttPress');
        const grab = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.key !== 'Escape') {
            s.pttKey = e.code;
            app.saveSettings();
          }
          pttKey.textContent = keyName(s.pttKey);
          window.removeEventListener('keydown', grab, true);
          app.render();
        };
        window.addEventListener('keydown', grab, true);
      });
      const mode = (value, label) => h('label', { class: 'radio-row' }, h('input', { class: 'radio', type: 'radio', name: 'mode', value, checked: s.inputMode === value, onchange: () => (app.media.setInputMode(value), app.render(), renderMode()) }), label);
      const pttRow = h('div');
      const renderMode = () => replace(pttRow, s.inputMode === 'ptt' ? h('div', { class: 'hl-field' }, h('span', { class: 'field-label' }, t('settings.pttKey')), pttKey, h('p', { class: 'field-hint' }, t('settings.pttTouch'))) : null);
      renderMode();
      const noise = (value) =>
        h(
          'label',
          { class: 'radio-row' },
          h('input', { class: 'radio', type: 'radio', name: 'noise', value, checked: (s.noiseMode || 'strong') === value, onchange: () => ((s.noiseMode = value), app.saveSettings(), app.media.restartMic(), renderSens()) }),
          h('span', null, h('strong', null, t(`voice.noise.${value}`)), h('br'), h('small', { class: 'muted' }, t(`voice.noise.${value}Hint`))),
        );
      const sens = h('input', { class: 'range', type: 'range', id: 'set-sens', min: 0, max: 100, value: s.gateSensitivity ?? 50, oninput: (e) => app.media.setSensitivity(Number(e.target.value)) });
      const sensRow = h('div');
      const renderSens = () => replace(sensRow, (s.noiseMode || 'strong') === 'strong' ? field(t('voice.sensitivity'), sens, t('voice.sensitivityHint'), 'set-sens') : null);
      renderSens();
      replace(
        box,
        h('div', { class: 'grid-2' }, select(t('settings.input'), 'audioinput', 'inputId', (v) => ((s.inputId = v), app.saveSettings(), app.media.restartMic())), select(t('settings.output'), 'audiooutput', 'outputId', (v) => app.media.setOutput(v))),
        select(t('settings.cameraDevice'), 'videoinput', 'cameraId', (v) => ((s.cameraId = v), app.saveSettings())),
        h('fieldset', { class: 'set-sec' }, h('legend', { class: 'sr-only' }, t('voice.noiseTitle')), h('h2', null, t('voice.noiseTitle')), h('p', { class: 'field-hint' }, t('voice.noiseHint')), noise('off'), noise('standard'), noise('strong'), sensRow),
        h('div', { class: 'hl-field' }, h('span', { class: 'field-label' }, t('settings.micTest')), h('p', { class: 'field-hint' }, t('voice.testMicHint')), h('div', { class: 'meter-row' }, testBtn, meter, gateState)),
        h('fieldset', { class: 'hl-field' }, h('legend', { class: 'field-label' }, t('settings.inputMode')), mode('voice', t('settings.voiceActivity')), mode('ptt', t('settings.ptt'))),
        pttRow,
      );
      return box;
    },

    connection() {
      const s = app.settings;
      const list = h('ul', { class: 'turn-list' });
      const testBtn = (server, out) =>
        h(
          'button',
          {
            class: 'btn btn-ghost btn-sm',
            type: 'button',
            onclick: async (e) => {
              const b = e.currentTarget;
              b.disabled = true;
              out.textContent = t('settings.turnTesting');
              out.className = 'turn-result';
              const ok = await testTurn(server).catch(() => false);
              out.textContent = t(ok ? 'settings.turnOk' : 'settings.turnFail');
              out.className = `turn-result ${ok ? 'ok' : 'bad'}`;
              b.disabled = false;
            },
          },
          t('settings.turnTest'),
        );
      const renderList = () =>
        replace(
          list,
          s.turn.length
            ? s.turn.map((server, i) => {
                const out = h('span', { class: 'turn-result' });
                return h(
                  'li',
                  { class: 'turn-item' },
                  h('code', null, server.urls.join(' ')),
                  out,
                  testBtn(server, out),
                  h(
                    'button',
                    {
                      class: 'icon-btn danger',
                      type: 'button',
                      'aria-label': `${t('common.remove')} ${server.urls[0]}`,
                      onclick: () => {
                        s.turn.splice(i, 1);
                        app.saveSettings();
                        renderList();
                      },
                    },
                    icon('trash', { size: 16 }),
                  ),
                );
              })
            : h('li', { class: 'muted' }, t('settings.turnNone')),
        );
      renderList();
      const urls = h('input', { class: 'input field-input mono', id: 'turn-urls', placeholder: 'turn:turn.example.com:3478' });
      const user = h('input', { class: 'input field-input', id: 'turn-user', autocomplete: 'off' });
      const pass = h('input', { class: 'input field-input', id: 'turn-pass', type: 'password', autocomplete: 'new-password' });
      const err = h('p', { class: 'form-error', role: 'alert' });
      return h(
        'div',
        { class: 'hl-stack' },
        h('section', { class: 'set-sec' }, h('h2', null, t('settings.stun')), h('p', { class: 'muted' }, t('settings.stunHint')), h('ul', { class: 'mono-list' }, STUN_SERVERS.map((u) => h('li', null, h('code', null, u))))),
        h(
          'section',
          { class: 'set-sec' },
          h('h2', null, t('settings.turn')),
          h('p', { class: 'muted' }, t('settings.turnHint')),
          h('p', { class: 'muted' }, t('settings.noPublicTurn')),
          h('p', { class: 'muted' }, t('settings.turnRelayHint')),
          list,
          h(
            'form',
            {
              class: 'stack-sm turn-form',
              onsubmit: (e) => {
                e.preventDefault();
                try {
                  s.turn.push(parseTurn({ urls: urls.value, username: user.value, credential: pass.value }));
                  app.saveSettings();
                  urls.value = user.value = pass.value = '';
                  err.textContent = '';
                  renderList();
                } catch (x) {
                  err.textContent = t(`settings.turnErr.${x.reason || 'format'}`);
                }
              },
            },
            field(t('settings.turnUrls'), urls, null, 'turn-urls'),
            h('div', { class: 'grid-2' }, field(t('settings.turnUser'), user, null, 'turn-user'), field(t('settings.turnPass'), pass, null, 'turn-pass')),
            err,
            h('div', null, h('button', { class: 'btn btn-brand btn-sm', type: 'submit' }, icon('plus', { size: 16 }), t('settings.turnAdd'))),
          ),
        ),
      );
    },

    privacy() {
      const s = app.activeDen;
      const rows = h('ul', { class: 'fp-list' });
      if (s?.mesh?.links.size) {
        for (const [peerId, link] of s.mesh.links) {
          const m = s.member(peerId);
          const code = h('code', { class: 'fp' }, '...');
          const route = h('span', { class: 'muted' }, '');
          link.fingerprint().then((v) => (code.textContent = v));
          link.stats().then((st) => (route.textContent = st.route === 'relay' ? t('members.relayed') : t('members.direct')));
          const idState = s.identityOf(peerId);
          rows.append(h('li', null, h('strong', null, m?.name || peerId), idState?.status === 'verified' ? h('span', { class: 'verified' }, icon('shield', { size: 14 }), t('id.verified')) : null, code, route));
        }
      } else rows.append(h('li', { class: 'muted' }, t('settings.noPeers')));
      return h(
        'div',
        { class: 'hl-stack' },
        h('section', { class: 'set-sec' }, h('h2', null, t('settings.security')), h('ul', { class: 'check-list' }, ['security1', 'security2', 'security3', 'security4', 'security5', 'security6'].map((k) => h('li', null, icon('check', { size: 16 }), t(`settings.${k}`))))),
        h('section', { class: 'set-sec' }, h('h2', null, t('settings.fingerprints')), h('p', { class: 'muted' }, t('settings.fingerprintsHint')), rows),
      );
    },

    notifications() {
      const s = app.settings;
      const note = h('p', { class: 'field-hint' });
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') note.textContent = t('settings.notifyDenied');
      return h(
        'div',
        { class: 'hl-stack' },
        toggleRow(
          t('settings.notify'),
          s.notify,
          async (v) => {
            if (v && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
              const res = await Notification.requestPermission();
              if (res !== 'granted') {
                note.textContent = t('settings.notifyDenied');
                v = false;
              }
            }
            s.notify = v;
            app.saveSettings();
          },
          t('settings.notifyHint'),
        ),
        note,
        toggleRow(t('sound.dnd'), !!s.dnd, (v) => ((s.dnd = v), app.saveSettings(), app.render()), t('sound.dndHint')),
        h(
          'section',
          { class: 'set-sec' },
          h('h2', null, t('sound.title')),
          field(t('sound.volume'), h('input', { class: 'range', type: 'range', id: 'set-volume', min: 0, max: 100, value: app.sounds.volume, oninput: (e) => ((s.soundVolume = Number(e.target.value)), app.saveSettings()), onchange: () => app.sounds.play('message', { force: true }) }), t('sound.volumeHint'), 'set-volume'),
          h(
            'ul',
            { class: 'sound-list' },
            SOUND_NAMES.map((name) =>
              h(
                'li',
                { class: 'sound-row' },
                h('label', { class: 'switch-row' }, h('input', { class: 'toggle', type: 'checkbox', checked: s.sounds?.[name] !== false, onchange: (e) => ((s.sounds = { ...s.sounds, [name]: e.target.checked }), app.saveSettings()) }), h('span', null, t(`sound.${name}`))),
                h('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': `${t('sound.preview')}: ${t(`sound.${name}`)}`, onclick: () => app.sounds.play(name, { force: true }) }, icon('volume', { size: 16 }), t('sound.preview')),
              ),
            ),
          ),
        ),
      );
    },

    language() {
      return h(
        'fieldset',
        { class: 'stack-sm' },
        h('legend', { class: 'sr-only' }, t('settings.language')),
        Object.entries(LANGS).map(([key, label]) => h('label', { class: 'radio-row' }, h('input', { class: 'radio', type: 'radio', name: 'lang', checked: app.lang === key, onchange: () => (app.setLang(key), close(), openSettings(app, 'language')) }), label)),
      );
    },

    appearance() {
      const s = app.settings;
      return h(
        'div',
        { class: 'hl-stack' },
        h('fieldset', { class: 'stack-sm' }, h('legend', { class: 'field-label' }, t('settings.theme')), ['dark', 'light', 'system'].map((key) => h('label', { class: 'radio-row' }, h('input', { class: 'radio', type: 'radio', name: 'theme', checked: s.theme === key, onchange: () => ((s.theme = key), app.saveSettings(), app.applyTheme()) }), icon(key === 'dark' ? 'moon' : key === 'light' ? 'sun' : 'palette', { size: 18 }), t(`settings.${key}`)))),
        toggleRow(t('settings.compact'), s.compact, (v) => ((s.compact = v), app.saveSettings(), app.applyTheme())),
      );
    },

    storage() {
      return h(
        'div',
        { class: 'hl-stack' },
        h('p', { class: 'muted' }, t('settings.storageHint')),
        h(
          'ul',
          { class: 'store-list' },
          [...app.sessions.values()].map((s) => h('li', null, h('strong', null, s.isDirect ? `${t('home.dm')}: ${s.den.name}` : s.den.name), h('span', { class: 'muted' }, t('settings.messages', { n: s.messages.size })), h('button', { class: 'btn btn-danger btn-soft btn-sm', type: 'button', onclick: () => (close(), app.removeDenFlow(s)) }, t('den.remove')))),
        ),
      );
    },
  };

  document.body.append(overlay);
  show(section in PANES ? section : 'profile');
  return { close };
}

/** Restore an account from a backup file. */
export function restoreModal(app) {
  const t = app.t;
  const file = h('input', { class: 'file-input', type: 'file', accept: '.json,application/json', id: 'restore-file' });
  const pw = h('input', { class: 'input field-input', type: 'password', id: 'restore-pw', autocomplete: 'current-password' });
  const err = h('p', { class: 'form-error', role: 'alert' });
  const m = modal({
    title: t('account.import'),
    lead: t('account.importLead'),
    closeLabel: t('common.close'),
    body: [field(t('account.backupFile'), file, null, 'restore-file'), field(t('account.backupPassword'), pw, null, 'restore-pw'), err],
    footer: [
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, t('common.cancel')),
      h(
        'button',
        {
          class: 'btn btn-brand',
          type: 'button',
          onclick: async (e) => {
            const f = file.files[0];
            if (!f) return (err.textContent = t('account.pickFile'));
            e.currentTarget.disabled = true;
            try {
              await app.restoreAccount(await f.text(), pw.value);
              m.close();
            } catch (x) {
              console.warn('howlden restore:', x);
              err.textContent = t(x instanceof BackupError ? `account.err.${x.reason}` : 'account.err.other');
              e.currentTarget.disabled = false;
            }
          },
        },
        t('account.import'),
      ),
    ],
  });
}
