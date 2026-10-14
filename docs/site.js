// Interactive parts of the howlden site, built with Voodoo.js
// (https://kwy404.github.io/Voodoo.js/). Voodoo is loaded with data-manual:
// this module publishes reactive stores and helpers on V.config.globals, then
// calls V.start(). Pages declare behavior in HTML (v-data, v-model, @click,
// v-for, v-show, v-copy-from, v-theme-toggle, v-hotkey).
// The live preview on the home page is a pretend den: scripted messages,
// a speaking ring that moves around the voice channel, reactions, mute and
// deafen, and a composer that posts locally. Nothing leaves the page.

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
  ['luna', 'Sent Nova an invite link. Scan the QR if you are on your phone.'],
  ['nova', 'Reply code sent back. I am in!', { react: [{ k: 'paw', n: 3, mine: false }] }],
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
    let who = order[i++ % order.length];
    if (who === 'luna' && PV.muted) who = '';
    if (PV.deaf) who = who === 'luna' ? '' : who;
    PV.speaking = who;
  }, 1700);
}

const preview = $('#preview');
if (preview) {
  const start = () => {
    play();
    if (!reduced) speak();
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        start();
      }
    });
    io.observe(preview);
  } else start();
}

Object.assign(V.config.globals, {
  S,
  PV,
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
