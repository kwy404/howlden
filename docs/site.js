// Interactive parts of the howlden site, built with Voodoo.js
// (https://kwy404.github.io/Voodoo.js/). Voodoo is loaded with data-manual:
// this module publishes reactive stores and helpers on V.config.globals, then
// calls V.start(). Pages declare behavior in HTML (v-data, v-model, @click,
// v-for, v-show, v-copy-from, v-theme-toggle, v-hotkey).
// The home page has three animated parts, all scripted and local:
//   the two window demo (DM): Luna and Nova connect with six words;
//   the 30 second tour (TR): six scenes, driven by CSS progress bars;
//   the live preview (PV): a pretend den with scripted messages, a speaking
//   ring, reactions, mute and deafen, and a composer that posts locally.
// Every part pauses when it is off screen or the tab is hidden, and nothing
// plays by itself when the visitor prefers reduced motion. Nothing leaves the page.

const V = window.V;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const S = V.reactive({ ready: 0 });
// The site root, so search also works from the 404 page and from pt/.
const BASE = new URL('./', import.meta.url);

// ---------- Search (Ctrl K) ----------

let index = [];
let loading = null;
function loadSearch() {
  if (!loading) {
    loading = fetch(new URL('search.json', BASE))
      .then((r) => r.json())
      .then((j) => {
        index = j.map((e) => ({ ...e, url: new URL(e.url, BASE).href, hay: `${e.title} ${e.sub} ${e.kind}`.toLowerCase() }));
        S.ready++;
      })
      .catch(() => {
        loading = null;
      });
  }
  return loading;
}
function hits(q) {
  const query = String(q || '').trim().toLowerCase();
  if (!query) return index.filter((e) => e.kind === 'Page' || e.kind === 'Guide').slice(0, 9);
  const words = query.split(/\s+/);
  return index
    .map((e) => {
      if (!words.every((w) => e.hay.includes(w))) return null;
      const t = e.title.toLowerCase();
      return { e, score: (t.startsWith(query) ? 4 : t.includes(query) ? 2 : 0) + (e.kind === 'Guide' ? 1 : 0) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((x) => x.e);
}
const dialog = $('#search');
function openSearch() {
  if (!dialog) return;
  loadSearch();
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => $('#search-input')?.focus());
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-search-open]')) openSearch();
  if (dialog?.open && e.target.closest('#search a[href]')) dialog.close();
});
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !e.target.closest('input, textarea, select, [contenteditable]')) {
    e.preventDefault();
    openSearch();
  }
});

// ---------- Table of contents: mark the section in view ----------

const tocLinks = $$('.side-toc a[href^="#"]');
if (tocLinks.length && 'IntersectionObserver' in window) {
  const byId = new Map(tocLinks.map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        tocLinks.forEach((a) => a.classList.remove('on'));
        byId.get(en.target.id)?.classList.add('on');
      }
    },
    { rootMargin: '-20% 0px -70% 0px' },
  );
  for (const id of byId.keys()) {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  }
}

// ---------- The live preview ----------

const PEOPLE = {
  luna: { name: 'Luna', color: '#b79dff' },
  fang: { name: 'Fang', color: '#9fb0e6' },
  pip: { name: 'Pip', color: '#e9e1ff' },
  nova: { name: 'Nova', color: '#ffb27a' },
};
const TOPICS = { campfire: 'Tonight\'s plans', memes: 'Only the good ones', homework: 'Exam on Friday', lounge: 'Voice' };

let nextId = 1;
const at = (h, m) => `Today at ${h}:${String(m).padStart(2, '0')} PM`;
const msg = (who, text, extra = {}) => ({ id: nextId++, who, text, time: extra.time || at(9, 41), react: extra.react || [], file: extra.file || '', fresh: false });

const SCRIPT = [
  ['fang', 'Who is up for a match tonight?', { react: [{ k: 'gamepad', n: 2, mine: false }] }],
  ['pip', 'Me! Homework is done, for once.'],
  ['luna', 'Sent Nova six words. Scan the QR if you are on your phone.'],
  ['nova', 'Read the confirmation words back. I am in!', { react: [{ k: 'paw', n: 3, mine: false }] }],
  ['fang', 'Fingerprint matches on my side: 4F2A 91C3.', { react: [{ k: 'shield', n: 1, mine: false }] }],
  ['nova', 'Here is the map for the strategy.', { file: 'raid-map.png' }],
  ['luna', 'Jump in Howl lounge, Nova is sharing her screen.', { react: [{ k: 'campfire', n: 2, mine: false }] }],
];

const PV = V.reactive({
  ch: 'campfire',
  msgs: {
    campfire: [msg('luna', 'Welcome to the den, everyone. Grab a spot by the fire.', { time: at(9, 30), react: [{ k: 'campfire', n: 3, mine: true }] })],
    memes: [
      msg('pip', 'When the whole squad says "one more game" at 2 AM', { time: at(8, 12), react: [{ k: 'reaction', n: 4, mine: false }] }),
      msg('fang', 'No server, no sign up, no excuses. Just vibes.', { time: at(8, 20) }),
    ],
    homework: [
      msg('pip', 'Can someone explain question 4? The one about fractions.', { time: at(7, 5) }),
      msg('luna', 'Hop in Howl lounge, I can share my screen and walk you through it.', { time: at(7, 6), react: [{ k: 'study', n: 1, mine: false }] }),
      msg('nova', 'Notes from class, if they help.', { time: at(7, 9), file: 'chapter-4-notes.pdf' }),
    ],
  },
  unread: { campfire: 0, memes: 2, homework: 3, lounge: 0 },
  typing: '',
  speaking: 'fang',
  muted: false,
  deaf: false,
  cam: false,
  share: true,
  side: false,
  draft: '',
  toast: '',
});

let toastTimer = 0;
function toast(text) {
  PV.toast = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (PV.toast = ''), 4200);
}

function scrollChat() {
  const box = $('.app-msgs');
  if (box) requestAnimationFrame(() => (box.scrollTop = box.scrollHeight));
}

function pick(ch) {
  PV.ch = ch;
  PV.unread[ch] = 0;
  PV.side = false;
  scrollChat();
}

function react(m, i) {
  const r = m.react[i];
  r.mine = !r.mine;
  r.n += r.mine ? 1 : -1;
  if (r.n <= 0) m.react.splice(i, 1);
}

function send() {
  const text = PV.draft.trim();
  if (!text) return;
  const list = PV.msgs[PV.ch];
  list.push({ ...msg('luna', text, { time: 'Just now' }), fresh: !reduced });
  PV.draft = '';
  scrollChat();
  if (PV.ch === 'campfire' && list.length < 30) {
    setTimeout(() => {
      PV.typing = 'Pip';
      setTimeout(() => {
        PV.typing = '';
        list.push({ ...msg('pip', 'Got it! (This preview runs only in your browser, like the real dens do.)', { time: 'Just now', react: [] }), fresh: !reduced });
        scrollChat();
      }, 1400);
    }, 600);
  }
}

function deafen() {
  PV.deaf = !PV.deaf;
  if (PV.deaf) PV.muted = true;
}

// Play the scripted conversation once the preview is on screen.
function play() {
  const list = PV.msgs.campfire;
  if (reduced) {
    for (const [who, text, extra] of SCRIPT) list.push(msg(who, text, extra));
    scrollChat();
    return;
  }
  let i = 0;
  const step = () => {
    if (i >= SCRIPT.length) return;
    const [who, text, extra] = SCRIPT[i++];
    PV.typing = PEOPLE[who].name;
    setTimeout(() => {
      PV.typing = '';
      list.push({ ...msg(who, text, { ...extra, time: at(9, 41 + i) }), fresh: true });
      if (PV.ch !== 'campfire') PV.unread.campfire++;
      scrollChat();
      setTimeout(step, 1500 + Math.random() * 900);
    }, 1100 + text.length * 14);
  };
  setTimeout(step, 700);
}

// Move the speaking ring around the voice channel.
function speak() {
  const order = ['fang', 'luna', 'nova', 'pip', 'luna', 'fang', 'nova'];
  let i = 0;
  setInterval(() => {
    if (!pvVisible || document.hidden) return;
    let who = order[i++ % order.length];
    if (who === 'luna' && PV.muted) who = '';
    if (PV.deaf) who = who === 'luna' ? '' : who;
    PV.speaking = who;
  }, 1700);
}

const preview = $('#preview');
let pvVisible = true;
if (preview) {
  let started = false;
  const start = () => {
    started = true;
    play();
    if (!reduced) speak();
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      pvVisible = entries.some((e) => e.isIntersecting);
      if (pvVisible && !started) start();
    }).observe(preview);
  } else start();
}

// ---------- The two window demo: Luna and Nova connect ----------
// Steps: 0 idle, 1 invite, 2 share, 3 type, 4 find, 5 confirm, 6 talk.

const DM = V.reactive({ step: 0, typed: 0, ctyped: 0, playing: false, speaking: '' });
const DEMO_MS = [1800, 2400, 2600, 3200, 2800, 3600, 7000];
const LINK = ['', '', 'Read aloud or sent in a messenger', '', 'Sealed handshake through public relays', 'Six words back', 'Direct and end to end encrypted'];
let demoText = [];
try {
  demoText = JSON.parse($('#demo-steps')?.textContent || '[]');
} catch {
  demoText = [];
}
let dmTimers = [];
let dmVisible = false;
let dmWanted = !reduced;
const dmLater = (fn, ms) => dmTimers.push(setTimeout(fn, ms));
function dmStop() {
  dmTimers.forEach(clearTimeout);
  dmTimers = [];
}
function dmType(key) {
  if (reduced) {
    DM[key] = 6;
    return;
  }
  for (let i = 1; i <= 6; i++) dmLater(() => (DM[key] = i), 260 + i * 330);
}
function demoGo(step, fromTimer = false) {
  dmStop();
  if (!fromTimer) {
    DM.playing = false;
    dmWanted = false;
  }
  DM.step = step;
  DM.typed = step > 3 ? 6 : 0;
  DM.ctyped = step > 5 ? 6 : 0;
  DM.speaking = '';
  if (step === 3) dmType('typed');
  if (step === 5) dmType('ctyped');
  if (step === 6 && !reduced) {
    let n = 0;
    const talk = () => {
      DM.speaking = ['nova', '', 'luna', '', 'nova', 'luna'][n++ % 6];
      dmLater(talk, 900);
    };
    dmLater(talk, 500);
  }
  if (DM.playing) dmLater(() => demoGo((step + 1) % DEMO_MS.length, true), DEMO_MS[step]);
}
function demoPlay() {
  DM.playing = true;
  demoGo(DM.step === 6 ? 0 : DM.step, true);
}
function demoToggle() {
  if (DM.playing) {
    DM.playing = false;
    dmWanted = false;
    dmStop();
  } else {
    dmWanted = true;
    demoPlay();
  }
}
const demoEl = $('#demo');
if (demoEl) {
  // Reduced motion: no autoplay, start on the connected state.
  if (reduced) demoGo(6);
  const sync = () => {
    const should = dmWanted && dmVisible && !document.hidden;
    if (should && !DM.playing) demoPlay();
    if (!should && DM.playing) {
      DM.playing = false;
      dmStop();
    }
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      dmVisible = entries.some((e) => e.isIntersecting);
      sync();
    }, { threshold: 0.25 }).observe(demoEl);
  } else {
    dmVisible = true;
    sync();
  }
  document.addEventListener('visibilitychange', sync);
}

// ---------- The 30 second tour ----------
// Six scenes of 5 seconds. The progress bar of the current chapter is a CSS
// animation; when it ends, the next scene starts. With reduced motion there
// is no animation, so the chapters are plain tabs.

const TR = V.reactive({ i: 0, playing: false, ended: false });
const tourEl = $('#tour-player');
const TOUR_N = tourEl ? $$('.tr-scene', tourEl).length : 0;
let trWanted = false;
let trStarted = false;
let trVisible = false;
function tourGo(i) {
  TR.i = i;
  TR.ended = false;
  // Restart the progress animation of this chapter even if it was current.
  const fill = tourEl && $$('.tr-fill i', tourEl)[i];
  if (fill) {
    fill.style.animation = 'none';
    void fill.offsetWidth;
    fill.style.animation = '';
  }
}
function tourNext(i) {
  if (i !== TR.i || !TR.playing) return;
  if (i + 1 < TOUR_N) TR.i = i + 1;
  else {
    TR.playing = false;
    trWanted = false;
    TR.ended = true;
  }
}
function tourToggle() {
  if (reduced) {
    tourGo((TR.i + 1) % TOUR_N);
    return;
  }
  if (TR.playing) {
    TR.playing = false;
    trWanted = false;
  } else {
    if (TR.ended) tourGo(0);
    TR.playing = true;
    trWanted = true;
    trStarted = true;
  }
}
if (tourEl && !reduced) {
  const sync = () => {
    if (trVisible && !trStarted) {
      trStarted = true;
      trWanted = true;
    }
    TR.playing = trWanted && trVisible && !document.hidden;
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      trVisible = entries.some((e) => e.isIntersecting);
      sync();
    }, { threshold: 0.4 }).observe(tourEl);
  }
  document.addEventListener('visibilitychange', sync);
}

// ---------- Special dates (docs/seasons.js sets data-season) ----------
// The chip names the season and has an off switch. The pack wears costumes,
// and the hero gets one light canvas of particles that pauses off screen,
// in a hidden tab, and does not run at all with reduced motion.

const SEASONS = window.howldenSeasons;
const CHIP_ICON = { halloween: 'pumpkin', christmas: 'tree', carnival: 'mask', junina: 'bonfire', valentine: 'heart', easter: 'egg', newyear: 'firework' };
const chip = $('#season-chip');
const seasonNow = () => document.documentElement.getAttribute('data-season') || '';

function dressPack(id) {
  for (const img of $$('img[data-char]')) {
    const who = img.dataset.char;
    const src = new URL(id ? `assets/seasons/${id}/${who}.svg` : `assets/art/characters/${who}.svg`, BASE).href;
    if (img.src !== src) img.src = src;
  }
}

function showChip() {
  const avail = document.documentElement.getAttribute('data-season-avail') || '';
  if (!chip || !SEASONS) return;
  chip.hidden = !avail;
  if (!avail) return;
  const pt = document.documentElement.lang === 'pt-BR';
  const name = SEASONS.label(avail, pt ? 'pt-BR' : 'en');
  const on = seasonNow() === avail;
  $('.sc-label', chip).textContent = pt ? `Modo ${name}` : `${name} mode`;
  $('use', chip).setAttribute('href', `#s-${avail}-${CHIP_ICON[avail]}`);
  $('.sc-switch', chip).setAttribute('aria-checked', on ? 'true' : 'false');
  chip.classList.toggle('off', !on);
}

chip?.querySelector('.sc-switch').addEventListener('click', () => {
  const avail = document.documentElement.getAttribute('data-season-avail');
  if (avail) SEASONS.setOff(avail, seasonNow() === avail);
});

// Particles: a few shapes per season, drawn on one canvas in the hero.
const FX = {
  halloween: { n: 16, kind: 'leaf', colors: ['#ff8a3d', '#d9601a', '#ffd166', '#a8452a'], fall: 1 },
  christmas: { n: 46, kind: 'snow', colors: ['#ffffff', '#efeaff'], fall: 1 },
  carnival: { n: 34, kind: 'confetti', colors: ['#ff7eb3', '#ffd166', '#3ee6a0', '#8b6bff', '#ff8a3d'], fall: 1 },
  junina: { n: 26, kind: 'spark', colors: ['#ffd166', '#ff8a3d', '#ff5e3a'], fall: -1 },
  valentine: { n: 20, kind: 'petal', colors: ['#ff5e7e', '#ff9fb8', '#ffc4d4'], fall: 1 },
  easter: { n: 18, kind: 'petal', colors: ['#9be3c6', '#ffd166', '#ffb3c6', '#cdbdff'], fall: 1 },
  newyear: { n: 0, kind: 'firework', colors: ['#ffd166', '#ff7eb3', '#3ee6a0', '#cdbdff'], fall: 0 },
};
const canvas = $('.season-fx');
let fx = null;
function startFx(id) {
  if (fx) {
    fx.stop();
    fx = null;
  }
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
  clear();
  const cfg = FX[id];
  if (!cfg || reduced) return;
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  let w = 0;
  let h = 0;
  const size = () => {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = () => cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
  const make = (spread) => ({ x: rnd(0, w), y: spread ? rnd(0, h) : cfg.fall < 0 ? h + 10 : -10, s: rnd(0.6, 1.2), vy: rnd(0.3, 0.9) * cfg.fall, vx: rnd(-0.25, 0.25), r: rnd(0, 6.28), vr: rnd(-0.03, 0.03), c: pick(), ph: rnd(0, 6.28), life: 1 });
  const parts = Array.from({ length: cfg.n }, () => make(true));
  let bursts = [];
  let next = 0;
  const draw = (p) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.r);
    ctx.fillStyle = p.c;
    ctx.globalAlpha = cfg.kind === 'spark' ? Math.max(0, p.life) * 0.9 : 0.75;
    if (cfg.kind === 'snow' || cfg.kind === 'spark') {
      ctx.beginPath();
      ctx.arc(0, 0, (cfg.kind === 'snow' ? 2.2 : 1.8) * p.s, 0, 6.28);
      ctx.fill();
    } else if (cfg.kind === 'confetti') {
      ctx.scale(1, Math.cos(p.ph));
      ctx.fillRect(-4 * p.s, -2.5 * p.s, 8 * p.s, 5 * p.s);
    } else {
      // A leaf or a petal: a pointed oval, with a vein for leaves.
      const k = cfg.kind === 'leaf' ? 7 : 5;
      ctx.scale(p.s, p.s * Math.max(0.35, Math.abs(Math.cos(p.ph))));
      ctx.beginPath();
      ctx.moveTo(-k, 0);
      ctx.quadraticCurveTo(0, -k * 0.9, k, 0);
      ctx.quadraticCurveTo(0, k * 0.9, -k, 0);
      ctx.fill();
      if (cfg.kind === 'leaf') {
        ctx.strokeStyle = 'rgba(80, 30, 10, .45)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-k, 0);
        ctx.lineTo(k, 0);
        ctx.stroke();
      }
    }
    ctx.restore();
  };
  let raf = 0;
  const tick = (t) => {
    raf = requestAnimationFrame(tick);
    clear();
    for (const p of parts) {
      p.ph += 0.03;
      p.x += p.vx + Math.sin(p.ph) * 0.35;
      p.y += p.vy;
      p.r += p.vr;
      if (cfg.kind === 'spark') p.life -= 0.004;
      if (p.y > h + 12 || p.y < -14 || p.x < -14 || p.x > w + 14 || p.life <= 0) Object.assign(p, make(false));
      draw(p);
    }
    if (cfg.kind === 'firework') {
      if (t > next) {
        next = t + rnd(900, 1800);
        const x = rnd(w * 0.1, w * 0.9);
        const y = rnd(h * 0.08, h * 0.45);
        const c = pick();
        bursts.push(...Array.from({ length: 22 }, (_, i) => ({ x, y, vx: Math.cos((i / 22) * 6.28) * rnd(1, 2.2), vy: Math.sin((i / 22) * 6.28) * rnd(1, 2.2), c, life: 1 })));
      }
      bursts = bursts.filter((b) => b.life > 0);
      for (const b of bursts) {
        b.x += b.vx;
        b.y += b.vy;
        b.vy += 0.02;
        b.vx *= 0.985;
        b.life -= 0.014;
        ctx.globalAlpha = Math.max(0, b.life);
        ctx.fillStyle = b.c;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 1.8, 0, 6.28);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  };
  let running = false;
  let seen = true;
  const run = (go) => {
    if (go === running) return;
    running = go;
    if (go) {
      size();
      raf = requestAnimationFrame(tick);
    } else cancelAnimationFrame(raf);
  };
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    seen = entries.some((e) => e.isIntersecting);
    run(seen && !document.hidden);
  }) : null;
  io?.observe(canvas);
  const onVis = () => run(seen && !document.hidden);
  const onSize = () => running && size();
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('resize', onSize);
  fx = {
    stop() {
      run(false);
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onSize);
      clear();
    },
  };
  run(!document.hidden);
}

function seasonChanged() {
  const id = seasonNow();
  dressPack(id);
  showChip();
  startFx(id);
}
window.addEventListener('howlden:season', seasonChanged);
seasonChanged();

// ---------- Reveal on scroll ----------

const reveal = $$('.rv');
if (!reduced && reveal.length && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('motion');
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        en.target.classList.add('in');
        io.unobserve(en.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  for (const el of reveal) {
    // Anything already on screen shows at once, without a fade.
    if (el.getBoundingClientRect().top < innerHeight) el.classList.add('in');
    else io.observe(el);
  }
}

Object.assign(V.config.globals, {
  S,
  PV,
  DM,
  TR,
  demoGo: (step) => demoGo(step),
  demoToggle,
  demoLink: (step) => LINK[step] || '',
  demoCaption: (step) => (step ? `${step}. ${demoText[step - 1] || ''}` : 'Luna wants to call Nova. Watch them connect with six words.'),
  tourGo: (i) => {
    tourGo(i);
    if (!TR.playing) TR.ended = false;
  },
  tourNext,
  tourToggle,
  tourLabel: (playing, ended) => (reduced ? 'Next scene' : playing ? 'Pause' : ended ? 'Watch again' : 'Play the tour'),
  hits: (q) => hits(q),
  go(q, sel) {
    const r = hits(q)[sel];
    if (!r) return;
    dialog?.close();
    location.href = r.url;
  },
  pick,
  react,
  send,
  deafen,
  toast,
  topic: (ch) => TOPICS[ch] || '',
  name: (who) => PEOPLE[who]?.name || who,
  color: (who) => PEOPLE[who]?.color || 'inherit',
});

setTimeout(loadSearch, 2500);
V.start();
