// The howlden illustrations: night scenes with Luna's pack. Each scene is a
// 640 by 420 SVG in a light (dusk) and a dark (night) palette. Shapes come
// from the wolves in art.mjs plus a few props drawn here: the sky, hills,
// pines, the campfire, the den, the owl, screens and cards.
import { PAL, builder, lunaFace, lunaHowl, sticker } from './art.mjs';

export const W = 640;
export const H = 420;

export const FURS = {
  luna: {},
  grey: { fur: '#a3a8bf', furD: '#7d839c', furL: '#f2f3f8' },
  brown: { fur: '#c39272', furD: '#966a50', furL: '#f8ece2' },
  snow: { fur: '#e4dff5', furD: '#b9b0de', furL: '#ffffff' },
  night: { fur: '#5d5596', furD: '#463e7c', furL: '#d9d3f6' },
  rust: { fur: '#d08a5c', furD: '#a96541', furL: '#fbeee2' },
};

const n = (v) => Math.round(v * 100) / 100;

/** A seeded random generator so the stars land in the same place every build. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------- Props ----------

function sky(P, id, { moon = [520, 86, 40], stars = 46, seed = 7 } = {}) {
  const r = rng(seed);
  let st = '';
  for (let i = 0; i < stars; i++) {
    const x = n(r() * W);
    const y = n(r() * H * 0.62);
    const z = n(0.8 + r() * 1.8);
    st += i % 7 === 0
      ? `<path d="M${x} ${n(y - z * 2.4)}L${n(x + z * 0.7)} ${n(y - z * 0.7)}L${n(x + z * 2.4)} ${y}L${n(x + z * 0.7)} ${n(y + z * 0.7)}L${x} ${n(y + z * 2.4)}L${n(x - z * 0.7)} ${n(y + z * 0.7)}L${n(x - z * 2.4)} ${y}L${n(x - z * 0.7)} ${n(y - z * 0.7)}Z" fill="${P.star}" opacity=".9"/>`
      : `<circle cx="${x}" cy="${y}" r="${z}" fill="${P.star}" opacity="${n(0.35 + r() * 0.6)}"/>`;
  }
  const [mx, my, mr] = moon;
  const m = mr
    ? `<circle cx="${mx}" cy="${my}" r="${mr * 2.6}" fill="url(#${id}-mg)"/><circle cx="${mx}" cy="${my}" r="${mr}" fill="${P.moon}"/><circle cx="${mx - mr * 0.35}" cy="${my - mr * 0.2}" r="${mr * 0.18}" fill="${P.moonD}" opacity=".6"/><circle cx="${mx + mr * 0.3}" cy="${my + mr * 0.32}" r="${mr * 0.12}" fill="${P.moonD}" opacity=".6"/><circle cx="${mx + mr * 0.38}" cy="${my - mr * 0.38}" r="${mr * 0.08}" fill="${P.moonD}" opacity=".6"/>`
    : '';
  return `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky1}"/><stop offset="1" stop-color="${P.sky2}"/></linearGradient><radialGradient id="${id}-mg"><stop offset="0" stop-color="${P.moon}" stop-opacity=".55"/><stop offset="1" stop-color="${P.moon}" stop-opacity="0"/></radialGradient><radialGradient id="${id}-fg"><stop offset="0" stop-color="${P.fire2}" stop-opacity=".75"/><stop offset=".45" stop-color="${P.fire}" stop-opacity=".28"/><stop offset="1" stop-color="${P.fire}" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#${id}-sky)"/>${st}${m}`;
}

function hills(P, { far = true } = {}) {
  return `${far ? `<path d="M0 300 C80 250 150 262 220 282 C300 240 400 236 470 270 C540 244 600 250 640 262 V420 H0Z" fill="${P.hill1}"/>` : ''}<path d="M0 340 C110 300 200 316 300 330 C400 300 520 304 640 326 V420 H0Z" fill="${P.hill2}"/><path d="M0 380 C140 360 260 372 360 380 C470 366 560 368 640 378 V420 H0Z" fill="${P.hill3}"/>`;
}

function pine(x, y, s, c, c2) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -92 L22 -52 H12 L30 -20 H16 L36 8 H-36 L-16 -20 H-30 L-12 -52 H-22Z" fill="${c}"/><path d="M0 -92 L22 -52 H12 L30 -20 H16 L36 8 H0Z" fill="${c2}"/><rect x="-4" y="8" width="8" height="12" fill="${c2}"/></g>`;
}

function campfire(P, id, x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="-30" rx="150" ry="110" fill="url(#${id}-fg)"/><ellipse cx="0" cy="8" rx="58" ry="10" fill="${P.shade}"/><g class="flame"><path d="M0 -86 C26 -60 36 -38 34 -18 C32 2 16 10 0 10 C-16 10 -32 2 -34 -18 C-36 -36 -24 -50 -14 -58 C-14 -44 -8 -36 0 -34 C-8 -52 -6 -70 0 -86Z" fill="${P.ember}"/><path d="M2 -66 C20 -46 24 -30 22 -16 C20 0 10 6 0 6 C-10 6 -22 0 -22 -14 C-22 -26 -14 -34 -8 -40 C-6 -30 -2 -26 2 -24 C-4 -38 -2 -52 2 -66Z" fill="${P.fire}"/><path d="M0 -36 C10 -26 13 -18 12 -10 C11 0 6 4 0 4 C-6 4 -11 0 -11 -8 C-11 -16 -6 -24 0 -36Z" fill="${P.fire2}"/></g><path d="M-48 8 L44 -8" stroke="${P.log}" stroke-width="13" stroke-linecap="round"/><path d="M-44 -8 L48 8" stroke="${P.logD}" stroke-width="13" stroke-linecap="round"/><circle cx="-40" cy="-30" r="2.4" fill="${P.fire2}"/><circle cx="34" cy="-56" r="2" fill="${P.fire2}"/><circle cx="18" cy="-98" r="1.8" fill="${P.fire}"/></g>`;
}

/** A side view wolf, feet on (x, y). opts: s, flip, head, mouth, headset, fur, eyes. */
function wolf(P, x, y, opts = {}) {
  const { s = 0.3, flip = false, fur = 'luna', ring = false } = opts;
  const colors = { ...FURS[fur] };
  const b = lunaHowl(P, builder(), { head: opts.head ?? -6, mouth: opts.mouth || 'closed', headset: opts.headset ?? false, colors, eyes: opts.eyes });
  const sx = flip ? -s : s;
  const ringSvg = ring ? `<ellipse cx="290" cy="214" rx="132" ry="132" fill="none" stroke="${P.ring}" stroke-width="12" opacity=".95"/><ellipse cx="290" cy="214" rx="152" ry="152" fill="none" stroke="${P.ring}" stroke-width="6" opacity=".35"/>` : '';
  return `<g transform="translate(${x} ${y}) scale(${sx} ${s}) translate(-260 -474)">${ringSvg}${b.art.join('')}</g>`;
}

/** A front facing wolf head centered on (x, y). */
function face(P, x, y, s = 0.4, opts = {}) {
  const colors = { ...P, ...FURS[opts.fur || 'luna'] };
  const b = lunaFace(colors, builder(), { headset: opts.headset ?? false, eyes: opts.eyes || 'open' });
  let extra = '';
  if (opts.glasses) extra += `<g fill="none" stroke="${P.line}" stroke-width="5"><circle cx="-30" cy="-14" r="19"/><circle cx="30" cy="-14" r="19"/><path d="M-11 -16 Q0 -22 11 -16"/></g>`;
  if (opts.bow) extra += `<g transform="translate(46 -62) rotate(18)"><path d="M0 0 L-22 -14 L-22 14Z M0 0 L22 -14 L22 14Z" fill="${P.ember}"/><circle r="6" fill="${P.fire}"/></g>`;
  if (opts.cap) extra += `<path d="M-60 -52 C-50 -96 50 -96 60 -52 Z" fill="${P.setA}"/><path d="M40 -56 C70 -58 96 -52 104 -44 L56 -44Z" fill="${P.set}"/>`;
  const ring = opts.ring ? `<circle r="104" fill="none" stroke="${P.ring}" stroke-width="10"/>` : '';
  return `<g transform="translate(${x} ${y}) scale(${s})">${ring}${b.art.join('')}${extra}</g>`;
}

/** A front facing sitting wolf, head centered on (x, y). opts: fur, headset, glasses, pad, ring. */
function frontWolf(P, x, y, s = 0.4, opts = {}) {
  const c = { ...P, ...FURS[opts.fur || 'luna'] };
  const body = `<path d="M-64 50 C-92 110 -100 200 -88 250 H88 C100 200 92 110 64 50Z" fill="${c.fur}"/><path d="M-88 250 C-96 210 -96 170 -84 130 C-70 170 -60 220 -50 250Z M88 250 C96 210 96 170 84 130 C70 170 60 220 50 250Z" fill="${c.furD}"/><path d="M-38 60 C-44 120 -32 176 0 200 C32 176 44 120 38 60Z" fill="${c.furL}"/><ellipse cx="-44" cy="250" rx="30" ry="14" fill="${c.furL}"/><ellipse cx="44" cy="250" rx="30" ry="14" fill="${c.furL}"/>`;
  const pad = opts.pad ? `<g transform="translate(0 150) scale(2.2)"><path d="M-22 -10 h44 a14 14 0 0 1 14 14 l3 14 a8 8 0 0 1 -15 5 l-6 -7 h-36 l-6 7 a8 8 0 0 1 -15 -5 l3 -14 a14 14 0 0 1 14 -14Z" fill="${P.set}"/><circle cx="14" cy="0" r="3.4" fill="${P.fire}"/><circle cx="21" cy="6" r="3.4" fill="${P.ring}"/><path d="M-18 3 h10 M-13 -2 v10" stroke="${P.glow}" stroke-width="3" stroke-linecap="round"/></g><ellipse cx="-62" cy="168" rx="20" ry="16" fill="${c.furL}"/><ellipse cx="62" cy="168" rx="20" ry="16" fill="${c.furL}"/>` : '';
  return `<g transform="translate(${x} ${y}) scale(${s})">${body}${pad}</g>${face(P, x, y, s, opts)}`;
}

function den(P, x, y, s = 1, lit = true) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-130 0 C-126 -96 -64 -150 0 -150 C64 -150 126 -96 130 0Z" fill="${P.denC}"/><path d="M-130 0 C-126 -96 -64 -150 0 -150 C-40 -130 -80 -80 -84 0Z" fill="${P.treeD}" opacity=".45"/><path d="M-50 0 C-50 -50 -28 -76 0 -76 C28 -76 50 -50 50 0Z" fill="${P.line}"/>${lit ? `<path d="M-40 0 C-40 -42 -22 -64 0 -64 C22 -64 40 -42 40 0Z" fill="${P.fire}" opacity=".85"/><path d="M-28 0 C-28 -30 -16 -48 0 -48 C16 -48 28 -30 28 0Z" fill="${P.fire2}" opacity=".9"/>` : ''}<path d="M-96 -70 C-80 -78 -66 -76 -56 -68 M60 -96 C72 -100 84 -96 90 -88 M-20 -126 C-8 -132 8 -130 18 -124" stroke="${P.hill1}" stroke-width="6" stroke-linecap="round" fill="none" opacity=".7"/></g>`;
}

/** The owl courier with an invite envelope, centered on (x, y). */
function owl(P, x, y, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
<path d="M-30 -14 C-60 -50 -110 -58 -136 -40 C-128 -30 -124 -22 -126 -12 C-116 -16 -106 -12 -102 -2 C-92 -8 -80 -4 -76 6 C-64 0 -50 6 -32 22Z" fill="${P.owlD}"/>
<path d="M30 -14 C60 -50 110 -58 136 -40 C128 -30 124 -22 126 -12 C116 -16 106 -12 102 -2 C92 -8 80 -4 76 6 C64 0 50 6 32 22Z" fill="${P.owlD}"/>
<path d="M-34 -16 C-60 -40 -96 -46 -116 -36 C-90 -30 -60 -16 -40 6Z M34 -16 C60 -40 96 -46 116 -36 C90 -30 60 -16 40 6Z" fill="${P.owl}" opacity=".8"/>
<path d="M0 -62 C34 -62 46 -30 44 0 C42 34 24 54 0 54 C-24 54 -42 34 -44 0 C-46 -30 -34 -62 0 -62Z" fill="${P.owl}"/>
<path d="M-34 -58 L-26 -80 L-12 -60Z M34 -58 L26 -80 L12 -60Z" fill="${P.owl}"/>
<path d="M0 -10 C22 -10 30 10 28 26 C24 42 12 50 0 50 C-12 50 -24 42 -28 26 C-30 10 -22 -10 0 -10Z" fill="${P.owlL}"/>
<path d="M-12 8 l4 4 l4 -4 M4 18 l4 4 l4 -4 M-12 28 l4 4 l4 -4" stroke="${P.owlD}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<circle cx="-16" cy="-34" r="16" fill="${P.owlL}"/><circle cx="16" cy="-34" r="16" fill="${P.owlL}"/>
<circle cx="-16" cy="-34" r="8" fill="${P.line}"/><circle cx="16" cy="-34" r="8" fill="${P.line}"/>
<circle cx="-13" cy="-37" r="3" fill="#fff"/><circle cx="19" cy="-37" r="3" fill="#fff"/>
<path d="M-6 -22 L0 -10 L6 -22Z" fill="${P.fire}"/>
<g transform="translate(0 66) rotate(-6)"><rect x="-42" y="-8" width="84" height="56" rx="7" fill="${P.paper}"/><path d="M-42 -2 L0 24 L42 -2" stroke="${P.paperD}" stroke-width="4" fill="none"/>${qrMini(P, 14, 14, 3)}<circle cx="-24" cy="30" r="9" fill="${P.ember}"/><path d="M-28 29 l3 3 l6 -6" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>
<path d="M-10 52 L-10 62 M10 52 L10 62" stroke="${P.fire}" stroke-width="5" stroke-linecap="round"/>
</g>`;
}

/** A small QR like pattern (decorative), top left at (x, y). */
function qrMini(P, x, y, c = 3, color) {
  const pat = ['1110111', '1010100', '1110101', '0001010', '1101111', '0110101', '1011101'];
  let out = '';
  pat.forEach((row, j) => [...row].forEach((v, i) => {
    if (v === '1') out += `<rect x="${n(x + i * c)}" y="${n(y + j * c)}" width="${c}" height="${c}"/>`;
  }));
  return `<g fill="${color || P.line}">${out}</g>`;
}

function phoneQR(P, x, y, s = 1, rot = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><rect x="-26" y="-46" width="52" height="92" rx="10" fill="${P.set}"/><rect x="-21" y="-38" width="42" height="72" rx="5" fill="${P.paper}"/>${qrMini(P, -15, -24, 4.3)}<rect x="-8" y="38" width="16" height="3" rx="1.5" fill="${P.glow}"/></g>`;
}

function screen(P, x, y, w, h, inner = '') {
  return `<g transform="translate(${x} ${y})"><rect x="-6" y="-6" width="${w + 12}" height="${h + 12}" rx="14" fill="${P.set}"/><rect width="${w}" height="${h}" rx="9" fill="${P.scr}"/>${inner}</g>`;
}

function chip(x, y, w, fill, opacity = 1) {
  return `<rect x="${x}" y="${y}" width="${w}" height="9" rx="4.5" fill="${fill}" opacity="${opacity}"/>`;
}

function waves(P, x, y, s = 1, rot = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" fill="none" stroke="${P.ring}" stroke-width="5" stroke-linecap="round"><path d="M0 -12 Q8 0 0 12"/><path d="M12 -22 Q26 0 12 22" opacity=".6"/></g>`;
}

const frame = (id, P, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${inner}</svg>\n`;

// ---------- Scenes ----------

export const SCENES = {
  'campfire-voice': {
    alt: 'A pack of wolves sitting around a campfire at night. One of them is talking and a green ring glows around her, like a speaker in a voice channel.',
    draw(P, id) {
      return frame(id, P, `${sky(P, id, { moon: [110, 78, 34], seed: 3 })}${hills(P)}${pine(40, 330, 0.9, P.tree, P.treeD)}${pine(600, 318, 1.1, P.tree, P.treeD)}${pine(570, 340, 0.7, P.tree, P.treeD)}
${campfire(P, id, 320, 360, 0.95)}
${wolf(P, 216, 372, { s: 0.27, fur: 'brown', head: 6 })}
${wolf(P, 424, 372, { s: 0.27, flip: true, fur: 'snow', head: 2 })}
${wolf(P, 140, 390, { s: 0.36, fur: 'grey', head: -4 })}
${wolf(P, 510, 390, { s: 0.36, flip: true, fur: 'luna', head: -24, mouth: 'open', headset: true, ring: true })}
${waves(P, 440, 250, 1.1, 205)}`);
    },
  },
  'moonlit-den': {
    alt: 'A cozy wolf den glowing under a big full moon on a quiet hill, with pine trees and no server tower anywhere in sight.',
    draw(P, id) {
      return frame(id, P, `${sky(P, id, { moon: [450, 110, 62], seed: 11, stars: 60 })}${hills(P)}${pine(90, 330, 1, P.tree, P.treeD)}${pine(140, 344, 0.7, P.tree, P.treeD)}${pine(560, 336, 0.95, P.tree, P.treeD)}
${den(P, 320, 372, 1.05)}
${wolf(P, 222, 392, { s: 0.22, fur: 'luna', head: -30, mouth: 'open' })}
<g fill="${P.fire2}"><circle cx="420" cy="290" r="3"/><circle cx="450" cy="262" r="2.2"/><circle cx="196" cy="270" r="2.6"/><circle cx="380" cy="230" r="2"/></g><path d="M320 222 c-6 -12 6 -18 0 -30 c-6 -12 6 -18 0 -30" stroke="${P.hill1}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>`);
    },
  },
  'owl-invite': {
    alt: 'An owl flying over the hills at night carrying an invite envelope with a QR code to a friend\'s den.',
    draw(P, id) {
      return frame(id, P, `${sky(P, id, { moon: [96, 92, 40], seed: 21 })}${hills(P)}${pine(560, 330, 1, P.tree, P.treeD)}${den(P, 520, 386, 0.55)}
<path d="M90 300 C200 160 300 300 330 190" stroke="${P.star}" stroke-width="4" stroke-dasharray="2 14" stroke-linecap="round" fill="none" opacity=".8"/>
${owl(P, 360, 170, 1.05)}`);
    },
  },
  'reply-code': {
    alt: 'Two wolf dens on opposite hills. An invite link travels from the left den to the right one, and a short reply code travels back.',
    draw(P, id) {
      return frame(id, P, `${sky(P, id, { moon: [320, 70, 30], seed: 5 })}${hills(P)}${den(P, 120, 372, 0.62)}${den(P, 520, 372, 0.62)}
<path d="M150 250 C230 120 410 120 490 250" stroke="${P.setA}" stroke-width="5" stroke-dasharray="3 13" stroke-linecap="round" fill="none"/>
<path d="M480 286 C410 200 230 200 160 286" stroke="${P.fire}" stroke-width="5" stroke-dasharray="3 13" stroke-linecap="round" fill="none"/>
<g transform="translate(320 150) rotate(-4)"><rect x="-40" y="-26" width="80" height="52" rx="7" fill="${P.paper}"/><path d="M-40 -20 L0 6 L40 -20" stroke="${P.paperD}" stroke-width="4" fill="none"/>${qrMini(P, 10, -2, 3)}</g>
<g transform="translate(320 228) rotate(3)"><rect x="-46" y="-17" width="92" height="34" rx="17" fill="${P.fire}"/>${chip(-30, -4.5, 16, '#fff', 0.95)}${chip(-10, -4.5, 16, '#fff', 0.95)}${chip(10, -4.5, 16, '#fff', 0.95)}<circle cx="34" cy="0" r="4" fill="#fff"/></g>
${wolf(P, 196, 388, { s: 0.2, fur: 'luna', headset: true })}${wolf(P, 450, 388, { s: 0.2, flip: true, fur: 'brown' })}${phoneQR(P, 476, 316, 0.45, 8)}`);
    },
  },
  'pack-mesh': {
    alt: 'Five wolf faces shining like stars in the night sky, each one linked to all the others, like the mesh of a full howlden den.',
    draw(P, id) {
      const pts = [[320, 70], [470, 178], [413, 346], [227, 346], [170, 178]];
      let lines = '';
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) lines += `<path d="M${pts[i][0]} ${pts[i][1]}L${pts[j][0]} ${pts[j][1]}"/>`;
      const furs = ['luna', 'grey', 'brown', 'snow', 'rust'];
      const faces = pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="40" fill="${P.sky1}" stroke="${i === 0 ? P.ring : P.star}" stroke-width="${i === 0 ? 5 : 3}"/>${face(P, x, y + 6, 0.3, { fur: furs[i], headset: i === 0 })}`).join('');
      return frame(id, P, `${sky(P, id, { moon: [0, 0, 0], seed: 31, stars: 70 })}<g stroke="${P.star}" stroke-width="2" opacity=".55">${lines}</g>${faces}`);
    },
  },
  'sealed-tunnel': {
    alt: 'Two wolves on two hills talk through a glowing tunnel of padlocks. Everything that travels between them is sealed, end to end.',
    draw(P, id) {
      let locks = '';
      for (let i = 0; i < 5; i++) {
        const x = 214 + i * 53;
        const y = 196 + Math.sin(i / 4 * Math.PI) * -34;
        locks += `<g transform="translate(${n(x)} ${n(y)})"><rect x="-13" y="-6" width="26" height="20" rx="5" fill="${P.fire}"/><path d="M-7 -6 v-5 a7 7 0 0 1 14 0 v5" stroke="${P.fire}" stroke-width="4.5" fill="none"/><circle cx="0" cy="3" r="3" fill="${P.paper}"/></g>`;
      }
      return frame(id, P, `${sky(P, id, { moon: [560, 70, 30], seed: 41 })}<path d="M0 330 C60 250 140 250 200 300 C260 340 380 340 440 300 C500 250 580 250 640 330 V420 H0Z" fill="${P.hill2}"/><path d="M0 380 C140 360 260 372 360 380 C470 366 560 368 640 378 V420 H0Z" fill="${P.hill3}"/>
<path d="M170 230 C260 120 380 120 470 230" stroke="${P.setA}" stroke-width="44" stroke-linecap="round" fill="none" opacity=".22"/><path d="M170 230 C260 120 380 120 470 230" stroke="${P.glow}" stroke-width="4" stroke-dasharray="6 10" fill="none"/>${locks}
${wolf(P, 120, 334, { s: 0.3, fur: 'luna', headset: true, head: -14, mouth: 'open' })}${wolf(P, 520, 334, { s: 0.3, flip: true, fur: 'grey', headset: true, head: -8 })}`);
    },
  },
  'screen-share': {
    alt: 'Wolves sitting in a den watching a friend\'s screen shared on the cave wall, with a game map on it.',
    draw(P, id) {
      const inner = `<path d="M0 120 C60 90 110 130 170 100 C220 76 260 110 300 90 V170 H0Z" fill="${P.hill2}" opacity=".8"/><path d="M40 60 l20 -12 l20 12 l-20 12Z" fill="${P.fire}"/><circle cx="210" cy="56" r="16" fill="${P.moon}"/><path d="M60 140 C120 110 180 150 250 120" stroke="${P.setA}" stroke-width="5" stroke-dasharray="4 8" fill="none"/>${chip(16, 16, 60, P.setA, 0.9)}<rect x="252" y="12" width="36" height="20" rx="6" fill="${P.ember}"/>`;
      return frame(id, P, `<rect width="${W}" height="${H}" fill="${P.hill3}"/><path d="M0 0 H640 V60 C540 30 420 20 320 24 C200 28 90 40 0 70Z" fill="${P.treeD}"/><ellipse cx="320" cy="420" rx="420" ry="90" fill="${P.hill2}"/>
${screen(P, 170, 70, 300, 170, inner)}<path d="M320 246 l-40 60 h80Z" fill="${P.glow}" opacity=".12"/>
${wolf(P, 190, 398, { s: 0.3, fur: 'brown', head: -10 })}${wolf(P, 300, 404, { s: 0.33, fur: 'luna', headset: true, head: -12 })}${wolf(P, 450, 398, { s: 0.3, flip: true, fur: 'snow', head: -10 })}`);
    },
  },
  'study-group': {
    alt: 'Three young wolves studying together around a lantern with open books, a quiet study group in the den.',
    draw(P, id) {
      const book = (x, y, r, c) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M0 0 C-14 -6 -30 -6 -40 -2 V22 C-30 18 -14 18 0 24Z" fill="${P.paper}"/><path d="M0 0 C14 -6 30 -6 40 -2 V22 C30 18 14 18 0 24Z" fill="${P.paperD}"/><path d="M-32 4 h22 M-32 10 h18 M8 4 h22 M8 10 h16" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/></g>`;
      return frame(id, P, `${sky(P, id, { moon: [540, 80, 36], seed: 51 })}${hills(P)}${pine(60, 320, 0.8, P.tree, P.treeD)}
<rect x="150" y="318" width="340" height="16" rx="8" fill="${P.log}"/><rect x="170" y="334" width="12" height="60" fill="${P.logD}"/><rect x="458" y="334" width="12" height="60" fill="${P.logD}"/>
<ellipse cx="320" cy="250" rx="140" ry="100" fill="url(#${id}-fg)"/><g transform="translate(320 318)"><rect x="-14" y="-12" width="28" height="12" rx="3" fill="${P.set}"/><path d="M-18 -12 C-18 -40 -12 -54 0 -60 C12 -54 18 -40 18 -12Z" fill="${P.fire2}" opacity=".9"/><path d="M-18 -12 C-18 -40 -12 -54 0 -60 C12 -54 18 -40 18 -12" stroke="${P.set}" stroke-width="4" fill="none"/><path d="M-10 -60 h20" stroke="${P.set}" stroke-width="5" stroke-linecap="round"/></g>
${wolf(P, 214, 360, { s: 0.25, fur: 'snow', head: 14 })}${wolf(P, 426, 360, { s: 0.25, flip: true, fur: 'rust', head: 14 })}${frontWolf(P, 320, 236, 0.34, { fur: 'luna', glasses: true })}<rect x="150" y="318" width="340" height="16" rx="8" fill="${P.log}"/>${book(236, 300, -4, P.setA)}${book(404, 300, 4, P.fire)}${book(320, 302, 0, P.ring)}`);
    },
  },
  'family-call': {
    alt: 'A family video call between four wolves: grandpa with glasses, mom, a pup with a bow and Luna, each in their own tile.',
    draw(P, id) {
      const tile = (x, y, fur, opts, bg) => `<g transform="translate(${x} ${y})"><rect width="250" height="150" rx="16" fill="${bg}"/><path d="M0 110 C60 90 120 120 250 100 V134 a16 16 0 0 1 -16 16 H16 a16 16 0 0 1 -16 -16Z" fill="${P.hill2}" opacity=".7"/>${face(P, 125, 84, 0.42, { fur, ...opts })}${opts.ring ? `<rect width="250" height="150" rx="16" fill="none" stroke="${P.ring}" stroke-width="5"/>` : ''}<rect x="12" y="122" width="${40 + fur.length * 6}" height="18" rx="9" fill="${P.soft}" opacity=".85"/></g>`;
      return frame(id, P, `<rect width="${W}" height="${H}" fill="${P.sky2}"/>${sky(P, id, { moon: [0, 0, 0], seed: 61, stars: 24 })}
${tile(54, 40, 'grey', { glasses: true }, P.sky1)}${tile(336, 40, 'brown', { ring: true }, P.sky1)}${tile(54, 222, 'snow', { bow: true }, P.sky1)}${tile(336, 222, 'luna', { headset: true }, P.sky1)}`);
    },
  },
  'gaming-squad': {
    alt: 'Three wolves in headsets playing a game together late at night, lit by the glow of their screen.',
    draw(P, id) {
      const inner = `<rect x="18" y="16" width="70" height="10" rx="5" fill="${P.ring}"/><rect x="18" y="32" width="46" height="10" rx="5" fill="${P.fire}"/><path d="M110 120 l24 -40 l24 40Z" fill="${P.setA}"/><path d="M190 120 l18 -28 l18 28Z" fill="${P.ember}"/><circle cx="250" cy="50" r="18" fill="${P.moon}"/>`;
      return frame(id, P, `<rect width="${W}" height="${H}" fill="${P.hill3}"/>${sky(P, id, { moon: [0, 0, 0], seed: 71, stars: 0 })}<rect width="${W}" height="${H}" fill="${P.hill3}" opacity=".85"/>
<ellipse cx="320" cy="150" rx="260" ry="150" fill="${P.setA}" opacity=".22"/>${screen(P, 170, 40, 300, 160, inner)}
${frontWolf(P, 140, 262, 0.48, { fur: 'grey', headset: true, pad: true })}${frontWolf(P, 500, 262, 0.48, { fur: 'night', headset: true, pad: true })}${frontWolf(P, 320, 246, 0.54, { fur: 'luna', headset: true, pad: true, ring: true })}`);
    },
  },
  'relay-bridge': {
    alt: 'Two dens on either side of a deep canyon. A rope bridge, the relay, carries sealed boxes across without opening them.',
    draw(P, id) {
      const box = (x, y) => `<g transform="translate(${x} ${y})"><rect x="-14" y="-14" width="28" height="24" rx="4" fill="${P.log}"/><path d="M-14 -6 h28" stroke="${P.logD}" stroke-width="3"/><circle cx="0" cy="0" r="5" fill="${P.fire}"/></g>`;
      return frame(id, P, `${sky(P, id, { moon: [320, 70, 34], seed: 81 })}<path d="M0 220 C80 210 180 220 250 236 L232 420 H0Z" fill="${P.hill2}"/><path d="M640 220 C560 210 460 220 390 236 L408 420 H640Z" fill="${P.hill2}"/><path d="M250 236 L232 420 H408 L390 236 C360 300 280 300 250 236Z" fill="${P.line}" opacity=".35"/>
${den(P, 110, 232, 0.5)}${den(P, 530, 232, 0.5)}
<path d="M240 222 C290 270 350 270 400 222" stroke="${P.log}" stroke-width="6" fill="none"/><path d="M240 196 C290 236 350 236 400 196" stroke="${P.log}" stroke-width="3" fill="none"/>
${[0, 1, 2, 3, 4, 5, 6].map((i) => { const x = 250 + i * 23; const t = (x - 240) / 160; const y = 222 + 4 * 48 * t * (1 - t) * 0.75; const y2 = 196 + 4 * 40 * t * (1 - t) * 0.75; return `<path d="M${n(x)} ${n(y)} V${n(y2)}" stroke="${P.log}" stroke-width="3"/>`; }).join('')}
<rect x="236" y="190" width="10" height="44" rx="3" fill="${P.logD}"/><rect x="394" y="190" width="10" height="44" rx="3" fill="${P.logD}"/>
${box(296, 236)}${box(346, 238)}
${wolf(P, 190, 234, { s: 0.2, fur: 'luna', headset: true })}${wolf(P, 450, 234, { s: 0.2, flip: true, fur: 'rust' })}`);
    },
  },
  fingerprint: {
    alt: 'Two wolves holding up cards with the same short code, checking that their connection fingerprints match.',
    draw(P, id) {
      const card = (x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-64" y="-40" width="128" height="80" rx="12" fill="${P.paper}"/><g transform="translate(-58 -30) scale(1.2)" fill="none" stroke="${P.setA}" stroke-width="2.2" stroke-linecap="round"><path d="M8.6 21c-1-2.5-1.3-5 0-7.5a8.2 8.2 0 0 1 15 1.5M23.6 19c0 3-1 5.5-2.5 7.5"/><path d="M12.4 24.5c-.8-1.8-1.5-4-1.5-6.8a5.1 5.1 0 0 1 10.2 0c0 2.7-.6 5.1-1.8 7.1"/><path d="M16 17.6c0 3.5.8 6.5 2 8.6" stroke="${P.fire}"/></g>${[0, 1, 2, 3].map((i) => `<rect x="${-12 + i * 18}" y="-24" width="14" height="14" rx="4" fill="${[P.setA, P.fire, P.ring, P.ember][i]}"/>`).join('')}${[0, 1, 2, 3].map((i) => `<rect x="${-52 + i * 28}" y="12" width="22" height="10" rx="5" fill="${P.line}" opacity=".75"/>`).join('')}</g>`;
      return frame(id, P, `${sky(P, id, { moon: [320, 80, 40], seed: 91 })}${hills(P)}
${wolf(P, 170, 392, { s: 0.36, fur: 'luna', headset: true, head: -8 })}${wolf(P, 470, 392, { s: 0.36, flip: true, fur: 'grey', head: -8 })}${card(250, 230, -6)}${card(390, 230, 6)}
<path d="M300 172 q20 -22 40 0" stroke="${P.ring}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="320" cy="150" r="14" fill="${P.ring}"/><path d="M313 150 l5 5 l9 -10" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    },
  },
  'team-tent': {
    alt: 'A small team of wolves in a lantern lit tent planning around a board, a private team chat with no outsiders.',
    draw(P, id) {
      return frame(id, P, `${sky(P, id, { moon: [90, 70, 30], seed: 101 })}${hills(P)}
<path d="M320 70 L560 380 H80Z" fill="${P.setA}"/><path d="M320 70 L560 380 H430 Z" fill="${P.set}" opacity=".35"/><path d="M320 70 L250 380 H390Z" fill="${P.line}" opacity=".55"/>
<ellipse cx="320" cy="300" rx="150" ry="90" fill="url(#${id}-fg)"/>
<g transform="translate(320 230)"><rect x="-58" y="-40" width="116" height="74" rx="8" fill="${P.paper}"/>${chip(-46, -28, 50, P.setA)}${chip(-46, -12, 70, P.fire)}${chip(-46, 4, 40, P.ring)}<rect x="22" y="-28" width="24" height="24" rx="5" fill="${P.glow}"/></g>
${wolf(P, 230, 384, { s: 0.25, fur: 'night', head: -10 })}${wolf(P, 410, 384, { s: 0.25, flip: true, fur: 'luna', headset: true, head: -10, mouth: 'open' })}
<circle cx="320" cy="64" r="8" fill="${P.fire2}"/>`);
    },
  },
  'lost-pup': {
    alt: 'A wolf pup with a lantern looking around a dark forest for a page that is not there.',
    draw(P, id) {
      return frame(id, P, `${sky(P, id, { moon: [520, 80, 36], seed: 111 })}${hills(P)}${pine(80, 340, 1.3, P.tree, P.treeD)}${pine(170, 330, 1, P.treeD, P.tree)}${pine(470, 340, 1.2, P.tree, P.treeD)}${pine(580, 334, 1.4, P.treeD, P.tree)}
<ellipse cx="350" cy="300" rx="130" ry="90" fill="url(#${id}-fg)"/>
${wolf(P, 310, 392, { s: 0.34, fur: 'luna', head: -20 })}
<g transform="translate(392 300)"><path d="M0 -40 v14" stroke="${P.set}" stroke-width="4"/><rect x="-14" y="-26" width="28" height="36" rx="6" fill="${P.fire2}"/><rect x="-14" y="-26" width="28" height="36" rx="6" fill="none" stroke="${P.set}" stroke-width="4"/></g>
<g fill="${P.star}"><circle cx="420" cy="170" r="6"/><path d="M404 130 c0 -18 32 -18 32 0 c0 12 -16 12 -16 24" stroke="${P.star}" stroke-width="7" fill="none" stroke-linecap="round"/></g>`);
    },
  },
};

export const SCENE_NAMES = Object.keys(SCENES);

export function scene(name, theme = 'light') {
  return SCENES[name].draw(PAL[theme], `${name.replace(/[^a-z]/g, '')}${theme[0]}`);
}

/** Every scene side by side, for review. */
export function sceneSheet(theme = 'light') {
  return SCENE_NAMES.map((nm) => `<div style="display:inline-block;margin:4px">${scene(nm, theme).replace(/width="640" height="420"/, 'width="480" height="315"')}</div>`).join('');
}

export { campfire, den, face, owl, sky, hills, pine, wolf, sticker };
