// Extra art for the landing page: glossy floating objects (soft 3D look made
// with gradients and highlights), the pack as standalone characters, and the
// one color wolf head mark used in the marquee and the footer wordmark.
import { PAL, builder, lunaFace, lunaHowl } from './art.mjs';
import { FURS } from './scenes.mjs';

const doc = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>\n`;

// ---------- Glossy objects ----------

const orb = (id, a, b, c) => `<radialGradient id="${id}" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`;
const shine = (x, y, rx, ry, rot = -30) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="#fff" opacity=".55"/>`;

export const OBJECTS = {
  moon: () => doc(200, 200, `<defs>${orb('m', '#fffbe8', '#ffe7a3', '#e0a94a')}</defs><circle cx="100" cy="100" r="86" fill="url(#m)"/><circle cx="72" cy="112" r="16" fill="#e8b85a" opacity=".45"/><circle cx="124" cy="72" r="11" fill="#e8b85a" opacity=".45"/><circle cx="128" cy="130" r="8" fill="#e8b85a" opacity=".45"/>${shine(70, 58, 26, 12)}`),
  lock: () => doc(200, 220, `<defs>${orb('l', '#ffd8a8', '#ff9a4d', '#c2410c')}<linearGradient id="s" x1="0" x2="1"><stop offset="0" stop-color="#e9e4ff"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#a99ae8"/></linearGradient></defs><path d="M58 104V74a42 42 0 0 1 84 0v30" fill="none" stroke="url(#s)" stroke-width="22" stroke-linecap="round"/><rect x="30" y="96" width="140" height="112" rx="34" fill="url(#l)"/><circle cx="100" cy="146" r="16" fill="#7a2a07" opacity=".6"/><rect x="93" y="150" width="14" height="30" rx="7" fill="#7a2a07" opacity=".6"/>${shine(66, 120, 26, 10, -20)}`),
  paw: () => doc(200, 200, `<defs>${orb('p', '#efe7ff', '#b79dff', '#6a45f5')}</defs><ellipse cx="100" cy="128" rx="46" ry="40" fill="url(#p)"/><ellipse cx="46" cy="82" rx="18" ry="24" fill="url(#p)"/><ellipse cx="78" cy="46" rx="18" ry="24" fill="url(#p)"/><ellipse cx="122" cy="46" rx="18" ry="24" fill="url(#p)"/><ellipse cx="154" cy="82" rx="18" ry="24" fill="url(#p)"/>${shine(84, 112, 18, 8)}${shine(72, 36, 6, 3)}`),
  gamepad: () => doc(240, 170, `<defs>${orb('g', '#c9fff0', '#3ee6a0', '#0e8f63')}</defs><path d="M70 28h100a50 50 0 0 1 49 41l12 58a24 24 0 0 1-42 20l-22-27H73l-22 27a24 24 0 0 1-42-20l12-58a50 50 0 0 1 49-41Z" fill="url(#g)"/><path d="M62 64v34M45 81h34" stroke="#065e40" stroke-width="12" stroke-linecap="round" opacity=".7"/><circle cx="168" cy="70" r="10" fill="#ff9a4d"/><circle cx="190" cy="92" r="10" fill="#ffd166"/>${shine(92, 46, 30, 9, -8)}`),
  headset: () => doc(220, 200, `<defs>${orb('h', '#f0e9ff', '#9b74ff', '#4a2ab8')}</defs><path d="M38 120V100a72 72 0 0 1 144 0v20" fill="none" stroke="#2d2552" stroke-width="18" stroke-linecap="round"/><rect x="18" y="98" width="52" height="82" rx="24" fill="url(#h)"/><rect x="150" y="98" width="52" height="82" rx="24" fill="url(#h)"/><path d="M168 176c-6 14-26 18-46 18" fill="none" stroke="#2d2552" stroke-width="9" stroke-linecap="round"/><circle cx="118" cy="194" r="9" fill="#ff8a3d"/>${shine(36, 120, 8, 18, 0)}`),
  bubble: () => doc(220, 190, `<defs>${orb('b', '#ffe3ef', '#ff7eb3', '#c2185b')}</defs><path d="M60 20h100a44 44 0 0 1 44 44v40a44 44 0 0 1-44 44H96l-46 32 10-34a44 44 0 0 1-44-42V64a44 44 0 0 1 44-44Z" fill="url(#b)"/><circle cx="72" cy="86" r="11" fill="#fff" opacity=".9"/><circle cx="110" cy="86" r="11" fill="#fff" opacity=".9"/><circle cx="148" cy="86" r="11" fill="#fff" opacity=".9"/>${shine(72, 40, 30, 9, -10)}`),
  flame: () => doc(180, 220, `<defs>${orb('f', '#fff3c4', '#ffb347', '#ff5e3a')}</defs><path d="M90 10c40 40 64 76 64 116a64 64 0 0 1-128 0c0-28 14-46 28-60 0 22 8 36 22 38C66 80 70 46 90 10Z" fill="url(#f)"/><path d="M92 110c18 18 26 32 26 46a28 28 0 0 1-56 0c0-14 10-28 30-46Z" fill="#fff3c4" opacity=".9"/>${shine(64, 92, 10, 22, 20)}`),
  star: () => doc(160, 160, `<defs>${orb('t', '#ffffff', '#cdbdff', '#8b6bff')}</defs><path d="M80 6l18 52 56 22-56 22-18 52-18-52L6 80l56-22Z" fill="url(#t)"/>`),
};

// ---------- The pack ----------

/**
 * A pack member facing front, drawn around the face center (0, 0): ears reach
 * y -122, the body ends at y 250. A costume adds layers: back (behind the
 * body), neck (over the body), hat (over the head) and held (in front).
 */
export function figure(fur, { headset = false, glasses = false, bow = false, prop = '', costume = {} } = {}) {
  const P = { ...PAL.dark, ...FURS[fur] };
  const body = `<path d="M-64 50 C-92 110 -100 200 -88 250 H88 C100 200 92 110 64 50Z" fill="${P.fur}"/><path d="M-88 250 C-96 210 -96 170 -84 130 C-70 170 -60 220 -50 250Z M88 250 C96 210 96 170 84 130 C70 170 60 220 50 250Z" fill="${P.furD}"/><path d="M-38 60 C-44 120 -32 176 0 200 C32 176 44 120 38 60Z" fill="${P.furL}"/><ellipse cx="-44" cy="250" rx="30" ry="14" fill="${P.furL}"/><ellipse cx="44" cy="250" rx="30" ry="14" fill="${P.furL}"/>`;
  const props = {
    pad: `<g transform="translate(0 150) scale(2.2)"><path d="M-22 -10 h44 a14 14 0 0 1 14 14 l3 14 a8 8 0 0 1 -15 5 l-6 -7 h-36 l-6 7 a8 8 0 0 1 -15 -5 l3 -14 a14 14 0 0 1 14 -14Z" fill="#2d2552"/><circle cx="14" cy="0" r="3.4" fill="#ff8a3d"/><circle cx="21" cy="6" r="3.4" fill="#3ee6a0"/><path d="M-18 3 h10 M-13 -2 v10" stroke="#cdbdff" stroke-width="3" stroke-linecap="round"/></g><ellipse cx="-62" cy="168" rx="20" ry="16" fill="${P.furL}"/><ellipse cx="62" cy="168" rx="20" ry="16" fill="${P.furL}"/>`,
    book: `<g transform="translate(0 150)"><path d="M0 -26 C-30 -40 -64 -38 -84 -30 V34 C-64 26 -30 26 0 40Z" fill="#f4f1ff"/><path d="M0 -26 C30 -40 64 -38 84 -30 V34 C64 26 30 26 0 40Z" fill="#d8d0f5"/><path d="M-70 -14 h52 M-70 0 h44 M18 -14 h52 M18 0 h40" stroke="#8b6bff" stroke-width="5" stroke-linecap="round"/></g><ellipse cx="-78" cy="168" rx="20" ry="16" fill="${P.furL}"/><ellipse cx="78" cy="168" rx="20" ry="16" fill="${P.furL}"/>`,
    phone: `<g transform="translate(46 140) rotate(12)"><rect x="-26" y="-46" width="52" height="92" rx="10" fill="#2d2552"/><rect x="-21" y="-38" width="42" height="72" rx="5" fill="#9b74ff"/><rect x="-14" y="-28" width="28" height="6" rx="3" fill="#fff" opacity=".8"/><rect x="-14" y="-16" width="20" height="6" rx="3" fill="#fff" opacity=".6"/></g><ellipse cx="34" cy="176" rx="20" ry="16" fill="${P.furL}"/>`,
    wave: `<ellipse cx="-96" cy="20" rx="22" ry="30" fill="${P.furL}" transform="rotate(-20 -96 20)"/>`,
  };
  const b = builder();
  lunaFace(P, b, { headset });
  let extra = '';
  if (glasses) extra += `<g fill="none" stroke="#1a1338" stroke-width="5"><circle cx="-30" cy="-14" r="19"/><circle cx="30" cy="-14" r="19"/><path d="M-11 -16 Q0 -22 11 -16"/></g>`;
  if (bow) extra += `<g transform="translate(46 -62) rotate(18)"><path d="M0 0 L-22 -14 L-22 14Z M0 0 L22 -14 L22 14Z" fill="#ff5e3a"/><circle r="6" fill="#ff8a3d"/></g>`;
  const c = costume;
  const held = c.held ? c.held : props[prop] || '';
  return `${c.back || ''}${body}${c.neck || ''}${held}${b.art.join('')}${extra}${c.face || ''}${c.hat || ''}${c.front || ''}`;
}

function front(fur, opts = {}) {
  return doc(260, 410, `<ellipse cx="130" cy="392" rx="96" ry="12" fill="#000" opacity=".22"/><g transform="translate(130 138)">${figure(fur, opts)}</g>`);
}

export const CHARACTERS = {
  luna: () => {
    const P = PAL.dark;
    return doc(512, 512, `<ellipse cx="270" cy="478" rx="150" ry="14" fill="#000" opacity=".22"/>${lunaHowl(P).art.join('')}`);
  },
  fang: () => front('grey', { headset: true, prop: 'pad' }),
  pip: () => front('snow', { bow: true, prop: 'book' }),
  nova: () => front('brown', { headset: true, prop: 'phone' }),
  moss: () => front('night', { glasses: true, prop: 'wave' }),
  ember: () => front('rust', { headset: true }),
};

// ---------- The mark ----------

/** Luna's head as a one color mark (headset included), eyes cut out. */
export function markSvg(color = '#ffffff') {
  const P = { ...PAL.dark };
  const b = builder();
  b.open('translate(128 140)');
  lunaFace(P, b, { headset: true });
  b.close();
  return doc(256, 256, `<defs><mask id="mk"><g fill="#fff" stroke="#fff" stroke-width="4" stroke-linejoin="round">${b.sil.join('')}</g><g transform="translate(128 140)"><g fill="#000"><ellipse cx="-30" cy="-12" rx="10" ry="11.5"/><ellipse cx="30" cy="-12" rx="10" ry="11.5"/><path d="M-14 12 C-6 6 6 6 14 12 C12 24 6 28 0 29 C-6 28 -12 24 -14 12 Z"/><path d="M-57 -44 L-72 -104 L-28 -66 Z M57 -44 L72 -104 L28 -66 Z"/><path d="M-9 -64 L0 -30 L9 -64 Z"/></g><path d="M-80 -8 C-84 -96 84 -96 80 -8" fill="none" stroke="#000" stroke-width="24"/><path d="M-80 -8 C-84 -96 84 -96 80 -8" fill="none" stroke="#fff" stroke-width="12"/><path d="M-100 -26 C-100 -40 -76 -42 -74 -26 L-72 18 C-74 32 -98 32 -100 18 Z" fill="#fff" stroke="#000" stroke-width="8"/><path d="M100 -26 C100 -40 76 -42 74 -26 L72 18 C74 32 98 32 100 18 Z" fill="#fff" stroke="#000" stroke-width="8"/></g></mask></defs><rect width="256" height="256" fill="${color}" mask="url(#mk)"/>`);
}

/** The mark as a symbol for the inline sprite, painted with currentColor. */
export function markSymbol() {
  const s = markSvg('currentColor');
  return s.replace(/^<svg[^>]*>/, '<symbol id="mark" viewBox="0 0 256 256">').replace(/<\/svg>\n$/, '</symbol>').replace('id="mk"', 'id="mk-s"').replace('url(#mk)', 'url(#mk-s)');
}
