// Banners for the README and the social cards. The README banner is an SVG
// in a light and a dark variant; the social preview and the per page Open
// Graph images are HTML cards rendered to PNG with Edge headless (see
// scripts/site/render-images.mjs).
import { PAL, builder, lunaHowl, sticker } from './art.mjs';
import { scene } from './scenes.mjs';

const FONT = "'Segoe UI Variable Display','Segoe UI',Ubuntu,'Helvetica Neue',Arial,sans-serif";

function stars(P, w, h, count, seed) {
  let s = seed;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  let out = '';
  for (let i = 0; i < count; i++) out += `<circle cx="${Math.round(r() * w)}" cy="${Math.round(r() * h * 0.7)}" r="${(0.8 + r() * 1.6).toFixed(1)}" fill="${P.star}" opacity="${(0.3 + r() * 0.6).toFixed(2)}"/>`;
  return out;
}

const PILLS = ['No account', 'End to end encrypted', 'Invite only', 'Up to 8 people'];

/** README banner, 1280 by 400. */
export function banner(theme = 'light') {
  const P = PAL[theme];
  const dark = theme === 'dark';
  const luna = sticker(lunaHowl(P), P, { rim: 14 });
  const text = dark ? '#f4f0ff' : '#221a4a';
  const sub = dark ? '#c9bff5' : '#4b3f8a';
  let x = 470;
  const pills = PILLS.map((p) => {
    const w = 44 + p.length * 9.9;
    const g = `<g transform="translate(${x} 292)"><rect width="${w}" height="40" rx="20" fill="${dark ? '#2a2163' : '#ffffff'}" stroke="${dark ? '#4b3c9e' : '#d9cffd'}" stroke-width="2"/><circle cx="20" cy="20" r="5" fill="${p === 'End to end encrypted' ? P.ring : P.fire}"/><text x="34" y="26.5" font-family="${FONT}" font-size="17" font-weight="600" fill="${text}">${p}</text></g>`;
    x += w + 12;
    return g;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 400" width="1280" height="400" role="img" aria-label="howlden: serverless group chat, voice and video in your browser">
<defs><linearGradient id="bg-${theme}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${dark ? '#1d1650' : '#ece6ff'}"/><stop offset="1" stop-color="${dark ? '#0d0a1f' : '#fbf9ff'}"/></linearGradient><radialGradient id="fire-${theme}" cx=".22" cy=".9" r=".5"><stop offset="0" stop-color="${P.fire}" stop-opacity="${dark ? 0.35 : 0.22}"/><stop offset="1" stop-color="${P.fire}" stop-opacity="0"/></radialGradient><radialGradient id="moon-${theme}"><stop offset="0" stop-color="${P.moon}" stop-opacity=".6"/><stop offset="1" stop-color="${P.moon}" stop-opacity="0"/></radialGradient></defs>
<rect width="1280" height="400" rx="28" fill="url(#bg-${theme})"/><rect width="1280" height="400" rx="28" fill="url(#fire-${theme})"/>${stars(P, 1280, 400, 70, 17)}
<circle cx="1170" cy="86" r="110" fill="url(#moon-${theme})"/><circle cx="1170" cy="86" r="44" fill="${P.moon}"/><circle cx="1156" cy="76" r="8" fill="${P.moonD}" opacity=".6"/><circle cx="1184" cy="100" r="5" fill="${P.moonD}" opacity=".6"/>
<path d="M0 352 C200 320 380 336 560 350 C760 330 980 330 1280 346 V372 a28 28 0 0 1 -28 28 H28 a28 28 0 0 1 -28 -28Z" fill="${P.hill2}" opacity="${dark ? 0.9 : 0.6}"/>
<g transform="translate(60 6) scale(.74)">${luna}</g>
<text x="466" y="168" font-family="${FONT}" font-size="104" font-weight="800" letter-spacing="-3" fill="${text}">howl<tspan fill="${P.setA}">den</tspan></text>
<text x="470" y="228" font-family="${FONT}" font-size="30" font-weight="600" fill="${sub}">Serverless group chat, voice and video in your browser.</text>
<text x="470" y="266" font-family="${FONT}" font-size="22" fill="${sub}" opacity=".9">Text and voice channels, screen share, peer to peer with WebRTC.</text>
${pills}
</svg>
`;
}

const CARD_FONT = "'Unbounded','Segoe UI',Arial,sans-serif";
const CARD_CSS = `*{margin:0;box-sizing:border-box}html,body{width:100%;height:100%}body{font-family:${FONT};overflow:hidden;background:#0d0a1f;color:#f4f0ff}
.card{position:relative;width:100%;height:100%;padding:64px 70px;display:flex;flex-direction:column;justify-content:space-between;background:radial-gradient(60% 70% at 18% 100%,rgba(255,138,61,.28),transparent 70%),radial-gradient(50% 60% at 90% 0%,rgba(155,116,255,.35),transparent 70%),linear-gradient(160deg,#0b0824,#2e1899 60%,#3a1fa8)}
.top{display:flex;align-items:center;gap:16px;font-family:${CARD_FONT};font-size:30px;font-weight:800;letter-spacing:-.5px}.top img{width:62px;height:62px}.top b{color:#b79dff}
.kind{margin-left:auto;font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ffd166;background:rgba(255,209,102,.12);padding:8px 18px;border-radius:99px;border:2px solid rgba(255,209,102,.35)}
h1{font-family:${CARD_FONT};font-size:54px;line-height:1.02;letter-spacing:-1px;font-weight:900;text-transform:uppercase;max-width:60%;text-wrap:balance}
p{font-size:25px;line-height:1.35;color:#d6ceff;max-width:56%;margin-top:18px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.pills{display:flex;gap:12px;flex-wrap:wrap}.pills span{font-size:19px;font-weight:700;padding:9px 18px;border-radius:99px;background:#2a2163;border:2px solid #4b3c9e}
.pic{position:absolute;right:46px;top:50%;transform:translateY(-46%);width:39%;border-radius:28px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5),0 0 0 3px rgba(183,157,255,.35)}.pic svg{display:block;width:100%;height:auto}`;

/** One social card as a full HTML document. */
export function cardHtml({ title, sub = '', kind = '', sceneName = 'campfire-voice', head = '', pills = PILLS }) {
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@800;900&display=swap"><style>${CARD_CSS}</style></head><body><div class="card"><div class="top">${head ? `<img src="${head}" alt="">` : ''}<span>howl<b>den</b></span>${kind ? `<span class="kind">${kind}</span>` : ''}</div><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="pills">${pills.map((p) => `<span>${p}</span>`).join('')}</div><div class="pic">${scene(sceneName, 'dark')}</div></div></body></html>`;
}

/** The mascot standalone, small, for embedding in the cards. */
export function lunaBadge() {
  const P = PAL.dark;
  return sticker(lunaHowl(P, builder()), P, { rim: 14 });
}
