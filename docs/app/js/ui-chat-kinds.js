// Special message kinds and the dialogs around them: polls, voice messages
// (recording and playback), the formatting toolbar, edit history, forwarding
// and reminders.

import { h, replace } from './dom.js';
import { icon } from './icons.js';
import { modal, toast } from './ui-modal.js';
import { render as renderMarkdown } from '../core/markdown.js';
import { POLL_LIMITS, WAVE_POINTS, pollResults } from '../core/history.js';
import { downsample, formatDuration, micConstraints, pickRecordingType } from '../core/call.js';
import { visibleChannels } from '../core/denstate.js';

// Polls

/** A poll with live results. Clicking an option votes (again to take it back). */
export function pollBlock(app, s, rec) {
  const t = app.t;
  const res = pollResults(rec, app.profile.id);
  const most = Math.max(1, ...res.per.map((p) => p.length));
  const names = (ids) => ids.map((id) => s.member(id)?.name || t('chat.unknown')).join(', ');
  return h(
    'div',
    { class: 'poll', role: 'group', 'aria-label': rec.poll.q },
    h('p', { class: 'poll-q' }, icon('poll', { size: 18 }), h('strong', null, rec.poll.q)),
    h(
      'div',
      { class: 'poll-opts', role: rec.poll.multi ? 'group' : 'radiogroup' },
      rec.poll.options.map((label, i) => {
        const n = res.per[i].length;
        const pct = res.total ? Math.round((n / res.total) * 100) : 0;
        return h(
          'button',
          {
            class: `poll-opt${res.mine[i] ? ' mine' : ''}${n === most && n ? ' lead' : ''}`,
            type: 'button',
            role: rec.poll.multi ? 'checkbox' : 'radio',
            'aria-checked': String(res.mine[i]),
            title: n ? names(res.per[i]) : '',
            onclick: () => s.vote(rec.id, i),
            style: { '--pct': `${pct}%` },
          },
          h('span', { class: 'poll-bar', 'aria-hidden': 'true' }),
          h('span', { class: 'poll-check', 'aria-hidden': 'true' }, res.mine[i] ? icon('check', { size: 14 }) : null),
          h('span', { class: 'poll-label' }, label),
          h('span', { class: 'poll-count' }, `${pct}%`, h('small', null, ` ${n}`)),
        );
      }),
    ),
    h('p', { class: 'poll-foot' }, t(res.total === 1 ? 'poll.voter' : 'poll.voters', { n: res.total }), ' ', t(rec.poll.multi ? 'poll.multi' : 'poll.single')),
  );
}

/** Ask for a question and options. Resolves { q, options, multi } or null. */
export function pollDialog(app) {
  const t = app.t;
  return new Promise((resolve) => {
    let result = null;
    const q = h('input', { class: 'input field-input', id: 'poll-q', maxlength: POLL_LIMITS.question, required: true, placeholder: t('poll.questionPlaceholder') });
    const list = h('div', { class: 'poll-edit' });
    const multi = h('input', { class: 'toggle', type: 'checkbox', id: 'poll-multi' });
    const err = h('p', { class: 'form-error', role: 'alert' });
    const addOpt = (value = '') => {
      if (list.childElementCount >= POLL_LIMITS.max) return;
      const n = list.childElementCount + 1;
      const input = h('input', { class: 'input field-input poll-option', maxlength: POLL_LIMITS.option, value, 'aria-label': t('poll.option', { n }), placeholder: t('poll.option', { n }) });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (input === list.lastChild.firstChild && input.value.trim()) {
            addOpt();
            list.lastChild.firstChild.focus();
          }
        }
      });
      list.append(h('div', { class: 'poll-edit-row' }, input));
      addBtn.disabled = list.childElementCount >= POLL_LIMITS.max;
    };
    const addBtn = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => (addOpt(), list.lastChild.firstChild.focus()) }, icon('plus', { size: 16 }), t('poll.add'));
    addOpt();
    addOpt();
    const m = modal({
      title: t('poll.title'),
      className: 'poll-modal',
      closeLabel: t('common.close'),
      body: [
        h('label', { class: 'hl-field', for: 'poll-q' }, h('span', { class: 'field-label' }, t('poll.question')), q),
        h('div', { class: 'hl-field' }, h('span', { class: 'field-label' }, t('poll.options')), list, addBtn),
        h('label', { class: 'switch-row', for: 'poll-multi' }, multi, h('span', null, t('poll.allowMulti'))),
        err,
      ],
      footer: [
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, t('common.cancel')),
        h(
          'button',
          {
            class: 'btn btn-brand',
            type: 'button',
            onclick: () => {
              const options = [...list.querySelectorAll('input')].map((i) => i.value.trim()).filter(Boolean);
              if (!q.value.trim()) return (err.textContent = t('poll.needQuestion'), q.focus());
              if (options.length < POLL_LIMITS.min) return (err.textContent = t('poll.needOptions'));
              result = { q: q.value.trim(), options, multi: multi.checked };
              m.close();
            },
          },
          t('poll.create'),
        ),
      ],
      onClose: () => resolve(result),
    });
    setTimeout(() => q.focus(), 30);
  });
}

// Voice messages

const RATES = [1, 1.5, 2];

/** Bars for a waveform (0 to 100 each). */
function waveBars(wave) {
  const points = wave?.length ? wave : Array(WAVE_POINTS).fill(12);
  return points.map((v) => h('span', { class: 'vm-bar', style: { height: `${Math.max(8, v)}%` } }));
}

/** A voice message player: play and pause, the waveform with progress and seeking, the speed. */
export function voicePlayer(app, s, rec, f) {
  const t = app.t;
  const url = s.fileUrl(f.id);
  const progress = s.progress.get(f.id);
  const bars = waveBars(f.wave);
  const wave = h('div', { class: 'vm-wave', role: 'slider', tabindex: '0', 'aria-label': t('voice.msg.seek'), 'aria-valuemin': '0', 'aria-valuemax': String(Math.round(f.dur || 0)), 'aria-valuenow': '0' }, bars);
  const time = h('span', { class: 'vm-time' }, formatDuration((f.dur || 0) * 1000));
  const rate = () => app.settings.voiceRate || 1;
  const speed = h('button', { class: 'vm-speed', type: 'button', 'aria-label': t('voice.msg.speed', { rate: rate() }) }, `${rate()}x`);
  const play = h('button', { class: 'vm-play', type: 'button', 'aria-label': t('voice.msg.play') }, icon('play', { size: 18 }));
  const box = h('div', { class: `vm${url ? '' : ' waiting'}` }, play, wave, time, speed);
  let audio = null;
  let raf = 0;
  const paint = () => {
    if (!audio) return;
    const dur = audio.duration && Number.isFinite(audio.duration) ? audio.duration : f.dur || 1;
    const p = Math.min(1, audio.currentTime / dur);
    const lit = Math.round(p * bars.length);
    bars.forEach((b, i) => b.classList.toggle('on', i < lit));
    time.textContent = formatDuration((audio.paused && !audio.currentTime ? dur : audio.currentTime) * 1000);
    wave.setAttribute('aria-valuenow', String(Math.round(audio.currentTime)));
    if (!audio.paused) raf = requestAnimationFrame(paint);
  };
  const ensure = () => {
    if (audio) return audio;
    const src = s.fileUrl(f.id);
    if (!src) {
      if (!s.requestFile(f.id, rec.author)) toast(t('chat.unavailable'), 'error');
      return null;
    }
    audio = new Audio(src);
    audio.preload = 'auto';
    audio.playbackRate = rate();
    audio.addEventListener('play', () => {
      box.classList.add('playing');
      replace(play, icon('pause', { size: 18 }));
      play.setAttribute('aria-label', t('voice.msg.pause'));
      // One voice message at a time.
      for (const other of document.querySelectorAll('.vm.playing')) if (other !== box) other.dispatchEvent(new Event('vm-stop'));
      paint();
    });
    const stopped = () => {
      box.classList.remove('playing');
      replace(play, icon('play', { size: 18 }));
      play.setAttribute('aria-label', t('voice.msg.play'));
      cancelAnimationFrame(raf);
      paint();
    };
    audio.addEventListener('pause', stopped);
    audio.addEventListener('ended', () => {
      audio.currentTime = 0;
      stopped();
    });
    return audio;
  };
  box.addEventListener('vm-stop', () => audio?.pause());
  play.addEventListener('click', () => {
    const a = ensure();
    if (!a) return;
    if (a.paused) a.play().catch(() => toast(t('voice.msg.cannotPlay'), 'error'));
    else a.pause();
  });
  speed.addEventListener('click', () => {
    const next = RATES[(RATES.indexOf(rate()) + 1) % RATES.length];
    app.settings.voiceRate = next;
    app.saveSettings();
    speed.textContent = `${next}x`;
    speed.setAttribute('aria-label', t('voice.msg.speed', { rate: next }));
    if (audio) audio.playbackRate = next;
  });
  const seek = (fraction) => {
    const a = ensure();
    if (!a) return;
    const dur = a.duration && Number.isFinite(a.duration) ? a.duration : f.dur || 0;
    a.currentTime = Math.max(0, Math.min(dur, fraction * dur));
    paint();
  };
  wave.addEventListener('click', (e) => {
    const r = wave.getBoundingClientRect();
    seek((e.clientX - r.left) / r.width);
  });
  wave.addEventListener('keydown', (e) => {
    if (!audio && e.key !== 'Enter') return;
    const step = 5 / Math.max(1, f.dur || 1);
    const at = audio ? audio.currentTime / Math.max(0.1, audio.duration || f.dur || 1) : 0;
    if (e.key === 'ArrowRight') seek(at + step);
    else if (e.key === 'ArrowLeft') seek(at - step);
    else return;
    e.preventDefault();
  });
  if (!url && progress != null) box.append(h('span', { class: 'vm-recv' }, t('chat.receiving', { pct: Math.round(progress * 100) })));
  return box;
}

/**
 * Record a voice message from the microphone. Resolves to a controller with
 * stop() (resolves { blob, dur, wave }), cancel(), elapsed() and level().
 */
export async function recordVoice(app) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: micConstraints({ noiseMode: app.settings.noiseMode || 'strong', inputId: app.settings.inputId }) });
  const type = pickRecordingType((x) => MediaRecorder.isTypeSupported(x));
  const mr = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : {});
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Uint8Array(analyser.fftSize);
  const samples = [];
  const chunks = [];
  const started = performance.now();
  let current = 0;
  const timer = setInterval(() => {
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += ((v - 128) / 128) ** 2;
    current = Math.sqrt(sum / buf.length);
    samples.push(current);
  }, 50);
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  mr.start(250);
  const close = () => {
    clearInterval(timer);
    for (const tr of stream.getTracks()) tr.stop();
    ctx.close().catch(() => {});
  };
  return {
    elapsed: () => performance.now() - started,
    level: () => current,
    cancel() {
      mr.ondataavailable = null;
      try {
        mr.stop();
      } catch {
        // already stopped
      }
      close();
    },
    stop() {
      return new Promise((resolve) => {
        mr.onstop = () => {
          close();
          const dur = (performance.now() - started) / 1000;
          resolve({ blob: new Blob(chunks, { type: mr.mimeType || type || 'audio/webm' }), dur, wave: downsample(samples, WAVE_POINTS) });
        };
        mr.stop();
      });
    },
  };
}

// Formatting toolbar

const FORMATS = [
  { key: 'bold', icon: 'bold', before: '**', after: '**' },
  { key: 'italic', icon: 'italic', before: '*', after: '*' },
  { key: 'strike', icon: 'strike', before: '~~', after: '~~' },
  { key: 'spoiler', icon: 'eye', before: '||', after: '||' },
  { key: 'code', icon: 'code', before: '`', after: '`' },
  { key: 'codeblock', icon: 'codeblock', before: '```\n', after: '\n```', block: true },
  { key: 'quote', icon: 'quote', line: '> ' },
];

/** Wrap the selection (or the word placeholder) in markdown, or prefix the lines. */
export function applyFormat(input, f, placeholder = '') {
  const { selectionStart: a, selectionEnd: b, value } = input;
  const picked = value.slice(a, b) || placeholder;
  let next;
  let selFrom;
  let selTo;
  if (f.line) {
    const start = value.lastIndexOf('\n', a - 1) + 1;
    const block = value.slice(start, b);
    const quoted = block
      .split('\n')
      .map((l) => (l.startsWith(f.line) ? l.slice(f.line.length) : f.line + l))
      .join('\n');
    next = value.slice(0, start) + quoted + value.slice(b);
    selFrom = start;
    selTo = start + quoted.length;
  } else {
    const lead = f.block && a > 0 && value[a - 1] !== '\n' ? '\n' : '';
    next = value.slice(0, a) + lead + f.before + picked + f.after + value.slice(b);
    selFrom = a + lead.length + f.before.length;
    selTo = selFrom + picked.length;
  }
  input.value = next;
  input.setSelectionRange(selFrom, selTo);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
}

export function formatBar(app, input) {
  const t = app.t;
  return h(
    'div',
    { class: 'format-bar', role: 'toolbar', 'aria-label': t('format.title') },
    FORMATS.map((f) =>
      h(
        'button',
        {
          class: 'icon-btn',
          type: 'button',
          'aria-label': t(`format.${f.key}`),
          'data-tip': t(`format.${f.key}`),
          onmousedown: (e) => e.preventDefault(),
          onclick: () => applyFormat(input, f, t('format.text')),
        },
        icon(f.icon, { size: 18 }),
      ),
    ),
  );
}

// Edit history

export function historyModal(app, rec, resolveMention) {
  const t = app.t;
  const versions = [...(rec.history || []), [rec.editedAt || rec.ts, rec.text]].reverse();
  const when = (ts) => new Date(ts).toLocaleString(app.lang, { dateStyle: 'medium', timeStyle: 'short' });
  modal({
    title: t('chat.historyTitle'),
    className: 'history-modal',
    closeLabel: t('common.close'),
    body: [
      h(
        'ol',
        { class: 'edit-history' },
        versions.map(([ts, text], i) => h('li', { class: i === 0 ? 'current' : '' }, h('p', { class: 'eh-when' }, i === 0 ? t('chat.historyNow', { when: when(ts) }) : when(ts)), h('div', { class: 'msg-content' }, renderMarkdown(text, { document, resolveMention })))),
      ),
    ],
  });
}

// Forwarding

/** Every text channel and conversation that can receive a forward. */
function forwardTargets(app) {
  const out = [];
  for (const s of app.sessions.values()) {
    if (s.isDirect) {
      const f = app.friends.get(s.den.peer);
      out.push({ s, channel: s.den.channels[0]?.id, label: f?.name || s.den.name, sub: app.t('forward.direct'), avatar: f?.avatar || s.den.peer });
    } else {
      for (const c of visibleChannels(s.den)) if (c.kind === 'text') out.push({ s, channel: c.id, label: `#${c.name}`, sub: s.den.name });
    }
  }
  return out;
}

export function forwardModal(app, s, rec) {
  const t = app.t;
  const author = s.member(rec.author)?.name || t('chat.unknown');
  const from = s.isDirect ? '' : s.den.name;
  const search = h('input', { class: 'input field-input', type: 'search', placeholder: t('forward.search'), 'aria-label': t('forward.search') });
  const list = h('ul', { class: 'fwd-list' });
  const targets = forwardTargets(app);
  const send = async (target) => {
    m.close();
    const opts = { fwd: { name: author, from } };
    try {
      if (rec.sticker) await target.s.postSticker(target.channel, rec.sticker, opts);
      else if (rec.poll) await target.s.postPoll(target.channel, { ...rec.poll }, opts);
      else {
        const files = [];
        for (const f of rec.files || []) {
          const url = s.fileUrl(f.id);
          if (url) files.push(new File([await fetch(url).then((r) => r.blob())], f.name, { type: f.type }));
        }
        if (files.length) await target.s.postFiles(target.channel, rec.text, files, null, opts);
        else await target.s.post(target.channel, rec.text, opts);
        if (files.length < (rec.files || []).length) toast(t('forward.filesMissing'), 'info', 6000);
      }
      toast(t('forward.done', { where: target.label }), 'ok');
    } catch (err) {
      console.warn('howlden forward:', err);
      toast(t('chat.sendFailed'), 'error');
    }
  };
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const shown = targets.filter((x) => !q || `${x.label} ${x.sub}`.toLowerCase().includes(q));
    replace(
      list,
      shown.length
        ? shown.map((x) => h('li', null, h('button', { class: 'fwd-item', type: 'button', onclick: () => send(x) }, icon(x.avatar ? 'members' : 'hash', { size: 18 }), h('span', { class: 'fwd-label' }, x.label), h('small', null, x.sub), icon('forward', { size: 16, cls: 'fwd-go' }))))
        : h('li', { class: 'muted pad' }, t('forward.none')),
    );
  };
  search.addEventListener('input', draw);
  draw();
  const m = modal({ title: t('forward.title'), className: 'fwd-modal', closeLabel: t('common.close'), body: [search, list] });
  setTimeout(() => search.focus(), 30);
}

// Reminders

/** Reminder choices for a message, as menu items. */
export function remindItems(app, s, rec) {
  const t = app.t;
  const at = (minutes) => Date.now() + minutes * 60000;
  const tomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  };
  const set = (when) => {
    s.remind(rec.id, when);
    toast(t('remind.set', { when: new Date(when).toLocaleString(app.lang, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) }), 'ok');
  };
  return [
    { label: t('remind.in20'), run: () => set(at(20)) },
    { label: t('remind.in1h'), run: () => set(at(60)) },
    { label: t('remind.in3h'), run: () => set(at(180)) },
    { label: t('remind.tomorrow'), run: () => set(tomorrow()) },
  ];
}
