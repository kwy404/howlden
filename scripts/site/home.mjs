// The landing page: "the den at night". Hero with a live preview of the app
// UI, inviting in 3 steps, privacy, features, use cases, the approach
// comparison, the mesh, the FAQ, guides and a closing campfire.
import { SITE, art, esc, icon, pic } from './layout.mjs';

// ---------- The live app preview ----------

const MEMBERS = [
  { id: 'luna', name: 'Luna', role: 'den host', color: '#b79dff' },
  { id: 'fang', name: 'Fang', role: 'online', color: '#9aa3c7' },
  { id: 'pip', name: 'Pip', role: 'online', color: '#e7defc' },
  { id: 'nova', name: 'Nova', role: 'online', color: '#e3a37c' },
];

const av = (id, cls = 'av') => `<img class="${cls}" src="assets/art/avatars/${id}.svg" width="40" height="40" alt="">`;

function preview() {
  const voice = MEMBERS.map((m) => `<li :class="{ speaking: PV.speaking === '${m.id}' }">${av(m.id, 'av av-sm')}<span>${m.name}</span>${m.id === 'luna' ? `<svg class="ic st-muted" v-show="PV.muted" aria-label="muted"><use href="#i-micoff"/></svg>` : ''}${m.id === 'nova' ? '<span class="live">Live</span>' : ''}</li>`).join('');
  const tiles = MEMBERS.map((m) => `<div class="tile" :class="{ speaking: PV.speaking === '${m.id}' }"><img src="assets/art/avatars/${m.id}.svg" width="88" height="88" alt=""><span class="tile-name">${m.name}</span></div>`).join('');
  const mlist = MEMBERS.map((m) => `<li>${av(m.id, 'av av-sm')}<span><b style="color:${m.color}">${m.name}</b><small>${m.role}</small></span></li>`).join('');
  const ch = (id, label, kind = 'text') => `<button type="button" class="app-ch" :class="{ on: PV.ch === '${id}' }" :aria-current="PV.ch === '${id}' ? 'true' : 'false'" @click="pick('${id}')">${icon(kind === 'voice' ? 'speaker' : 'hash')}<span>${label}</span><span class="unread" v-show="PV.unread.${id}" v-text="PV.unread.${id}"></span></button>`;
  return `<div class="appwin" id="preview" role="group" aria-label="Interactive preview of the howlden app">
  <div class="appwin-bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="appwin-url">${icon('lock')}kwy404.github.io/howlden/app</span><span class="appwin-e2e">${art('shield')}End to end encrypted</span></div>
  <div class="app" :class="{ 'show-side': PV.side }">
    <nav class="app-rail" aria-label="Dens">
      <button type="button" class="den-btn on" aria-label="Moonlight Pack" title="Moonlight Pack">${art('moon')}</button>
      <button type="button" class="den-btn" aria-label="Study burrow" title="Study burrow" @click="toast('Study burrow is a separate den with its own members and invites.')">${art('study')}</button>
      <button type="button" class="den-btn" aria-label="Family den" title="Family den" @click="toast('Family den: each den is its own private mesh of up to 5 people.')">${art('home')}</button>
      <span class="rail-sep"></span>
      <button type="button" class="den-btn add" aria-label="Open a new den" title="Open a new den" @click="toast('In the real app this opens a new den in one click. No account needed.')">${icon('plus')}</button>
    </nav>
    <aside class="app-side" aria-label="Channels">
      <header class="app-den"><b>Moonlight Pack</b><span class="cap" title="Members in this den">4/5</span></header>
      <p class="app-cat">Text channels</p>
      ${ch('campfire', 'campfire')}${ch('memes', 'memes')}${ch('homework', 'homework')}
      <p class="app-cat">Voice channels</p>
      ${ch('lounge', 'Howl lounge', 'voice')}
      <ul class="app-vm" aria-label="In Howl lounge">${voice}</ul>
      <footer class="app-me">
        ${av('luna', 'av av-sm')}<span class="me-name"><b>Luna</b><small v-text="PV.deaf ? 'deafened' : PV.muted ? 'muted' : 'in Howl lounge'">in Howl lounge</small></span>
        <button type="button" class="me-btn" :class="{ off: PV.muted }" :aria-pressed="PV.muted ? 'true' : 'false'" aria-pressed="false" aria-label="Mute" @click="PV.muted = !PV.muted"><svg class="ic" v-show="!PV.muted" aria-hidden="true"><use href="#i-mic"/></svg><svg class="ic" v-show="PV.muted" aria-hidden="true"><use href="#i-micoff"/></svg></button>
        <button type="button" class="me-btn" :class="{ off: PV.deaf }" :aria-pressed="PV.deaf ? 'true' : 'false'" aria-pressed="false" aria-label="Deafen" @click="deafen()"><svg class="ic" v-show="!PV.deaf" aria-hidden="true"><use href="#i-head"/></svg><svg class="ic" v-show="PV.deaf" aria-hidden="true"><use href="#i-headoff"/></svg></button>
        <button type="button" class="me-btn hide-sm" aria-label="Settings" @click="toast('Settings: your name, avatar, devices, TURN servers and the den passphrase. All stored in your browser.')">${icon('gear')}</button>
      </footer>
    </aside>
    <section class="app-main" aria-label="Channel">
      <header class="app-head">
        <button type="button" class="side-toggle" aria-label="Channels" @click="PV.side = !PV.side">${icon('menu')}</button>
        <span class="head-ch" v-show="PV.ch !== 'lounge'">${icon('hash')}<b v-text="PV.ch">campfire</b></span>
        <span class="head-ch" v-show="PV.ch === 'lounge'">${icon('speaker')}<b>Howl lounge</b></span>
        <span class="head-topic hide-sm" v-text="topic(PV.ch)">Tonight's plans</span>
        <button type="button" class="fp" title="Connection fingerprint. Compare it with your friends." @click="toast('Fingerprint 4F2A 91C3 7D0E. Read it aloud on a call: if everyone sees the same code, nobody is in the middle.')">${art('fingerprint')}<span>4F2A 91C3</span></button>
      </header>
      <div class="app-body">
        <div class="app-msgs" v-show="PV.ch !== 'lounge'" aria-live="polite">
          <article class="msg" v-for="m in PV.msgs[PV.ch]" :key="m.id" :class="{ fresh: m.fresh }">
            <img class="av" :src="'assets/art/avatars/' + m.who + '.svg'" width="40" height="40" alt="">
            <div class="msg-b">
              <p class="msg-h"><b :style="'color:' + color(m.who)" v-text="name(m.who)"></b><time v-text="m.time"></time></p>
              <p class="msg-t" v-text="m.text"></p>
              <div class="msg-file" v-if="m.file">${art('file')}<span><b v-text="m.file"></b><small>sent browser to browser</small></span></div>
              <div class="reacts" v-if="m.react.length">
                <button type="button" class="react" v-for="(r, i) in m.react" :key="r.k" :class="{ mine: r.mine }" :aria-pressed="r.mine ? 'true' : 'false'" @click="react(m, i)"><svg class="hi" aria-hidden="true"><use :href="'#k-' + r.k"/></svg><span v-text="r.n"></span></button>
              </div>
            </div>
          </article>
          <p class="typing" v-show="PV.typing"><span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span><b v-text="PV.typing"></b> is typing</p>
        </div>
        <div class="app-voice" v-show="PV.ch === 'lounge'">
          <div class="share" v-show="PV.share"><img src="assets/art/dark/gaming-squad.svg" width="640" height="420" alt="Nova shares a game on screen" loading="lazy"><span class="tile-name">${icon('screen')}Nova is sharing a screen</span></div>
          <div class="tiles">${tiles}</div>
          <div class="vbar">
            <button type="button" class="vb" :class="{ off: PV.muted }" :aria-pressed="PV.muted ? 'true' : 'false'" aria-pressed="false" aria-label="Mute" @click="PV.muted = !PV.muted">${icon('mic')}</button>
            <button type="button" class="vb" :class="{ on: PV.cam }" :aria-pressed="PV.cam ? 'true' : 'false'" aria-pressed="false" aria-label="Camera" @click="PV.cam = !PV.cam">${icon('video')}</button>
            <button type="button" class="vb" :class="{ on: PV.share }" :aria-pressed="PV.share ? 'true' : 'false'" aria-pressed="true" aria-label="Screen share" @click="PV.share = !PV.share">${icon('screen')}</button>
            <button type="button" class="vb hang" aria-label="Leave voice" @click="pick('campfire')">${icon('phone')}</button>
          </div>
        </div>
      </div>
      <form class="app-compose" @submit.prevent="send()" v-show="PV.ch !== 'lounge'">
        <button type="button" class="cbtn" aria-label="Attach a file" @click="toast('Files go straight from your browser to your friends. Nothing is uploaded anywhere.')">${icon('clip')}</button>
        <input class="cin" v-model="PV.draft" maxlength="200" :placeholder="'Message #' + PV.ch" placeholder="Message #campfire" aria-label="Message">
        <button type="submit" class="cbtn send" aria-label="Send">${icon('send')}</button>
      </form>
    </section>
    <aside class="app-members" aria-label="Members"><p class="app-cat">Online, 4 of 5</p><ul>${mlist}</ul><p class="mem-note">${art('mesh', 'hi')}Everyone is connected to everyone, directly.</p></aside>
  </div>
  <p class="pv-toast" role="status" v-show="PV.toast" v-text="PV.toast"></p>
</div>`;
}

// ---------- Content ----------

const TRUTHS = [
  ['no-server', 'No server of ours', 'Messages, voice, video and files go browser to browser.'],
  ['no-account', 'No email, no password, no phone', 'Nothing to sign up for, nothing to leak.'],
  ['key', 'Your account lives on your device', 'A username, an avatar and a signing key made in your browser.'],
  ['lock', 'End to end encrypted', 'Every connection is sealed by WebRTC.'],
  ['invite', 'Invite only', 'No public directory. Nobody gets in without you.'],
  ['pack', 'Group calls or just one friend', 'A den for two or a pack of five.'],
];

const STEPS = [
  ['owl-invite', 'Show six words', 'Click <b>Invite</b> in your den and howlden shows six words, plus a small QR code. Read them out on a call or send them in any messenger.', 'invite', 'An owl carries the invite link'],
  ['reply-code', 'Your friend types them', 'The six words find your den through public relays that only ever see an encrypted handshake. Nothing to send back, and the words expire in ten minutes.', 'reply', 'The reply code travels back'],
  ['pack-mesh', 'Confirm and howl', 'Type the six confirmation words your friend sees and they are in. Known friends are let in on their verified key. Then chat, voice and files go device to device.', 'mesh', 'The pack is connected'],
];

const PRIVATE = [
  ['no-server', 'No server of ours', 'There is no howlden backend, database or account system. No server of ours ever sees your messages, voice, video or files. This website is static files.'],
  ['lock', 'Encrypted by WebRTC', 'Every connection is encrypted end to end with DTLS, and audio and video with SRTP. It is built into the browser and cannot be switched off.'],
  ['relay', 'Relays cannot read', 'The six word handshake travels encrypted through public relays (EMQX, HiveMQ, Mosquitto) that cannot read it, and a TURN relay, when a strict network needs one, only forwards encrypted packets. Prefer zero third parties? Use invite links instead.'],
  ['no-account', 'Nothing stored online', 'No email, no phone number, no profile in the cloud. Your profile, settings and dens live in your own browser.'],
  ['key', 'Optional passphrase', 'Give a den a passphrase for a second layer: PBKDF2 derives an AES-GCM key, so only members who know it can read messages and files.'],
  ['fingerprint', 'Compare a fingerprint', 'howlden shows a short connection fingerprint. Read it aloud on a call: if both sides see the same code, nobody is in the middle.'],
];

const USES = [
  ['gaming-squad', 'Friends gaming', 'gamepad', 'Hop into voice before the match, share your screen for the strategy and keep the memes in a text channel. Nothing to install for the friend with the new laptop.', 'browser-voice-chat-for-gaming.html', 'Voice chat for gaming'],
  ['study-group', 'Study groups', 'study', 'A channel per subject, a voice room for exam night, notes passed straight between classmates. No accounts for anyone.', 'safe-chat-for-kids-study-groups.html', 'A safe chat for study groups'],
  ['family-call', 'Family calls', 'home', 'Grandpa opens a link and he is in. Video with the whole family, no app store, no password to forget.', 'group-video-call-without-account.html', 'Group video call, no account'],
  ['team-tent', 'Private team chats', 'briefcase', 'A quick room for a small team with nothing in the middle: no workspace to sign up for, no data held by a provider.', 'private-group-voice-call.html', 'Private group voice calls'],
];

const COMPARE = [
  ['Where messages go', 'Through the provider\'s servers, which store and forward them', 'Straight between the members\' browsers'],
  ['Account', 'Usually an email or a phone number and a password', 'A local profile on your device: username, avatar and identity key'],
  ['Group size', 'Large communities, thousands of people', 'Up to 5 people per den, or just you and one friend'],
  ['Friends who are away', 'Messages wait on the server until they come back', 'Everyone chats while online. History syncs from members who are online'],
  ['How people join', 'Public servers, search and invite links', 'Invite only. Nothing to discover'],
  ['Encryption', 'Depends on the app: to the server, or end to end', 'End to end by WebRTC, plus an optional passphrase'],
  ['Install', 'An app, or the browser', 'The browser. Installing is optional'],
  ['Moderation and bots', 'Often rich: roles, bots, moderation tools', 'Kept simple, for small groups who know each other'],
  ['Who runs it', 'The provider runs and pays for the servers', 'Nobody. The members\' browsers do the work'],
];

export const FAQ = [
  ['Is howlden really serverless?', 'Yes. The site and the app are static files on GitHub Pages, and once the page is loaded your messages, voice, video and files go directly between browsers. To find a route, each browser asks a public STUN server one question, "what is my public address?". When no direct route exists, an optional TURN relay forwards encrypted packets it cannot read. No server of ours ever sees your conversations.'],
  ['Do I need an account or to sign up?', 'No email, no password and no phone number. You create a local profile: a username, an avatar and a cryptographic identity key (Ed25519 where the browser supports it), all made in your browser and kept on your device. The dens you join see your name, your avatar and your public key, nothing else.'],
  ['How many people can be in a den?', 'Up to 5, or just two of you. A den is a full mesh: every member sends their audio, video and messages to every other member directly. That keeps everything private, but upload bandwidth grows with each person, so for big communities a server based tool is the better fit.'],
  ['Do my friends need to be online?', 'Yes, to talk everyone has to be online at the same time, because there is no server holding messages. When you come back, members who are online share the messages you missed, but if nobody is online the den is quiet.'],
  ['Why can\'t I connect to a friend?', 'Most often both of you are behind a strict NAT (some office, school, hotel and mobile carrier networks). Then a direct connection is not possible and you need a TURN relay. howlden tells you in plain words when this happens, and you can add your own TURN server in Settings.'],
  ['Is howlden end to end encrypted?', 'Yes. WebRTC encrypts every connection end to end with DTLS (and SRTP for audio and video). You can add a den passphrase for a second layer, and compare the connection fingerprint to make sure nobody is in the middle. Your security still depends on your device: encryption cannot protect a device that is already compromised.'],
  ['Can strangers find or join my den?', 'No. A den has no public address and is not listed anywhere. To get in, someone needs an invite from a member, and the member who invited them has to accept their reply code. A link that leaks is not enough on its own.'],
  ['What happens if I clear my browser data?', 'Your local profile, identity key and dens live in your browser, so clearing site data removes them. There is no server copy to restore from, which is exactly the point, so save an encrypted backup file from Settings first: you can import it on any device, and only your backup password opens it.'],
  ['Does it work on phones?', 'Yes, in modern mobile browsers on Android and iOS, with text, voice and video. Screen sharing from a phone browser is limited by the phone, not by howlden.'],
  ['Is howlden free and open source?', 'Yes. It is free, MIT licensed and has no ads and no tracking. The code is on GitHub, so anyone can read how it works.'],
];

// ---------- Mocks for the feature panels ----------

const mav = (id, cls = 'av') => `<img class="${cls}" src="assets/art/avatars/${id}.svg" width="40" height="40" alt="" loading="lazy">`;
const rx = (k, n, mine = false) => `<span class="rx${mine ? ' mine' : ''}">${art(k)}<b>${n}</b></span>`;

function chatMock() {
  return `<div class="mock mock-chat" aria-hidden="true">
  <div class="mk-head">${icon('hash')}<b>campfire</b><span class="mk-sub">Tonight's plans</span></div>
  <div class="mk-msg">${mav('nova')}<div><p class="mk-n" style="color:#ffb27a">Nova <time>9:41 PM</time></p><p>We won!! Rematch tomorrow?</p><div class="mk-rx">${rx('campfire', 4, true)}${rx('laugh', 2)}${rx('thumbs', 3)}</div></div></div>
  <div class="mk-msg">${mav('fang')}<div><p class="mk-n" style="color:#9fb0e6">Fang <time>9:42 PM</time></p><p>Only if Pip stops <span class="spoiler">camping the bridge</span></p><div class="mk-rx">${rx('wow', 1)}${rx('heart', 2)}</div></div></div>
  <div class="mk-msg">${mav('luna')}<div><p class="mk-n" style="color:#b79dff">Luna <time>9:43 PM</time></p><p><b>Same den, same time.</b> I will send the invite.</p></div></div>
  <div class="mk-picker">${['thumbs', 'heart', 'laugh', 'wow', 'sad', 'campfire', 'paw', 'check-circle'].map((k) => `<span>${art(k)}</span>`).join('')}</div>
  <div class="mk-compose">${icon('plus')}<span>Message #campfire</span>${icon('smile')}</div>
</div>`;
}

function shareMock() {
  const tile = (id, name, extra = '') => `<div class="mk-tile${extra}" :class="{ speaking: PV.speaking === '${id}' }"><img src="assets/art/avatars/${id}.svg" width="64" height="64" alt="" loading="lazy"><span>${name}</span></div>`;
  return `<div class="mock mock-share" aria-hidden="true">
  <div class="mk-screen"><img src="assets/art/dark/gaming-squad.svg" width="640" height="420" alt="" loading="lazy"><span class="mk-live">Live</span><span class="mk-who">${icon('screen')}Nova</span></div>
  <div class="mk-tiles">${tile('luna', 'Luna')}${tile('fang', 'Fang')}${tile('pip', 'Pip')}</div>
  <div class="mk-bar"><span>${icon('mic')}</span><span>${icon('video')}</span><span class="on">${icon('screen')}</span><span class="hang">${icon('phone')}</span></div>
</div>`;
}

function voiceMock() {
  const ch = (name, people, live = '') => `<div class="mk-vc${people.length ? ' busy' : ''}"><p>${icon('speaker')}<b>${name}</b>${people.length ? `<span class="mk-count">${people.length}</span>` : ''}</p>${people.map(([id, n, st]) => `<p class="mk-vp${st === 'speaking' ? ' speaking' : ''}">${mav(id, 'av av-xs')}<span>${n}</span>${st === 'muted' ? icon('micoff', 'ic mk-muted') : ''}${st === 'live' ? '<em>Live</em>' : ''}</p>`).join('')}${live}</div>`;
  return `<div class="mock mock-voice" aria-hidden="true">
  <p class="mk-cat">Voice channels</p>
  ${ch('Howl lounge', [['luna', 'Luna', 'speaking'], ['fang', 'Fang', ''], ['nova', 'Nova', 'live']])}
  ${ch('Study burrow', [['pip', 'Pip', 'muted']])}
  ${ch('Quiet cave', [])}
  <div class="mk-join">${icon('speaker')}<span>One click to take a seat by the fire. One click to slip away.</span></div>
</div>`;
}

function membersMock() {
  const row = (id, name, status, label, color) => `<p class="mk-mem">${`<span class="mk-avw">${mav(id, 'av av-sm')}<i class="st st-${status}"></i></span>`}<span><b style="color:${color}">${name}</b><small>${label}</small></span></p>`;
  return `<div class="mock mock-members" aria-hidden="true">
  <p class="mk-cat">In the den, 4 of 5</p>
  <div class="mk-cap"><i style="width:50%"></i></div>
  ${row('luna', 'Luna', 'voice', 'In Howl lounge', '#b79dff')}
  ${row('nova', 'Nova', 'live', 'Sharing a screen', '#ffb27a')}
  ${row('fang', 'Fang', 'online', 'Online', '#9fb0e6')}
  ${row('pip', 'Pip', 'idle', 'Away, back soon', '#e9e1ff')}
  <p class="mk-cat">Offline</p>
  <p class="mk-mem off"><span class="mk-avw"><img class="av av-sm" src="assets/art/avatars/fang.svg" width="40" height="40" alt="" loading="lazy"></span><span><b>Moss</b><small>Last seen yesterday</small></span></p>
</div>`;
}

function profileMock() {
  return `<div class="mock mock-profile" aria-hidden="true">
  <div class="mk-banner"></div>
  <img class="mk-pav" src="assets/art/avatars/luna.svg" width="96" height="96" alt="" loading="lazy">
  <p class="mk-uname">luna<span>#7c1f</span></p>
  <div class="mk-field"><small>Username</small><span>luna</span></div>
  <div class="mk-field"><small>Identity key (Ed25519), made on this device</small><span class="mono">${art('fingerprint')}7C1F 9A2B 44E0 D615</span></div>
  <div class="mk-nots"><span>${icon('x')}Email</span><span>${icon('x')}Password</span><span>${icon('x')}Phone</span></div>
</div>`;
}

const FLOAT = [
  ['moon', 'f-moon'], ['lock', 'f-lock'], ['gamepad', 'f-pad'], ['paw', 'f-paw'], ['bubble', 'f-bubble'], ['headset', 'f-head'], ['flame', 'f-flame'], ['star', 'f-star1'], ['star', 'f-star2'],
];
const floaters = (list) => list.map(([n, cls]) => `<img class="float ${cls}" src="assets/art/objects/${n}.svg" alt="" loading="lazy">`).join('');

function panel({ id, flip = false, tone, media, kicker, title, text, extra = '' }) {
  return `<section id="${id}" class="panel${flip ? ' flip' : ''}" aria-labelledby="${id}-t">
  <div class="panel-media tone-${tone}">${media}</div>
  <div class="panel-copy"><p class="kicker">${kicker}</p><h2 id="${id}-t" class="mega mega-md">${title}</h2><p>${text}</p>${extra}</div>
</section>`;
}

// ---------- Body ----------

export function homeBody({ guides, qr }) {
  const truths = TRUTHS.map(([ic, t, d]) => `<li>${art(ic, 'hi hi-md')}<span><b>${t}</b><small>${d}</small></span></li>`).join('');
  const steps = STEPS.map(([sc, t, d, ic, alt], i) => `<li class="howto-step">${pic('', sc, alt)}<div class="howto-b"><span class="howto-n">${i + 1}</span><h3>${art(ic)}${t}</h3><p>${d}</p></div></li>`).join('');
  const priv = PRIVATE.map(([ic, t, d]) => `<li>${art(ic, 'hi hi-lg')}<h3>${t}</h3><p>${d}</p></li>`).join('');
  const uses = USES.map(([sc, t, ic, d, href, label]) => `<li class="use">${pic('', sc, t)}<div class="use-b"><h3>${art(ic)}${t}</h3><p>${d}</p><a href="${href}" class="more">${label}${icon('arrow')}</a></div></li>`).join('');
  const rows = COMPARE.map(([k, a, b]) => `<tr><th scope="row">${k}</th><td data-label="Server based">${esc(a)}</td><td data-label="howlden">${esc(b)}</td></tr>`).join('');
  const faq = FAQ.map(([q, a], i) => `<details class="faq-item"${i === 0 ? ' open' : ''}><summary><h3>${esc(q)}</h3>${icon('chevron', 'ic chev')}</summary><div class="faq-a"><p>${esc(a)}</p></div></details>`).join('');
  const gl = guides.slice(0, 6).map((g) => `<li><a href="${g.slug}.html" class="guide-card">${art(g.icon, 'hi hi-lg')}<span><b>${esc(g.short)}</b><small>${esc(g.description)}</small></span></a></li>`).join('');
  const words = ['Howl', 'Play', 'Study', 'Plan', 'Share screens', 'Gather the pack', 'No server', 'Invite only'];
  const band = words.map((w) => `<span>${w}</span><svg class="mq-mark" aria-hidden="true"><use href="#mark"/></svg>`).join('');
  return `
<section class="hx" aria-labelledby="hero-title">
  <div class="hx-sky" aria-hidden="true">${floaters(FLOAT)}</div>
  <div class="wrap hx-grid">
    <div class="hx-copy">
      <h1 id="hero-title" class="mega">A den for your pack. <span class="mega-glow">No server in sight.</span></h1>
      <p class="hx-lede">howlden is a den for you and your friends: text and voice channels, video and screen share, right in your browser. No email, no password, no phone. Invite your pack with a link or a QR code and everything flows straight between you, end to end encrypted.</p>
      <div class="hx-cta">
        <a href="app/" class="btn-big btn-white">${art('den')}Open howlden in your browser</a>
        <a href="#invite" class="btn-big btn-night">How it works</a>
      </div>
      <p class="hx-note">${icon('check')}Free and open source. Desktop and phone. A den for two, or a pack of up to 5.</p>
    </div>
    <div class="hx-scene">
      <div class="monitor">${preview()}</div>
      <div class="phone" aria-hidden="true">
        <div class="ph-notch"></div>
        <p class="ph-head">${icon('speaker')}<b>Howl lounge</b></p>
        <div class="ph-tiles">${['luna', 'fang', 'pip', 'nova'].map((id) => `<div class="ph-tile" :class="{ speaking: PV.speaking === '${id}' }"><img src="assets/art/avatars/${id}.svg" width="56" height="56" alt=""></div>`).join('')}</div>
        <div class="ph-bar"><span>${icon('mic')}</span><span>${icon('video')}</span><span class="hang">${icon('phone')}</span></div>
      </div>
      <img class="char ch-luna" src="assets/art/characters/luna.svg" width="512" height="512" alt="Luna the wolf howling into her headset">
      <img class="char ch-fang" src="assets/art/characters/fang.svg" width="260" height="410" alt="Fang with a game controller">
      <img class="char ch-pip" src="assets/art/characters/pip.svg" width="260" height="410" alt="Pip reading a book">
      <p class="preview-hint">${icon('arrow')}A live preview: click the channels, react, mute yourself or type a message.</p>
    </div>
  </div>
</section>

<section class="truths" aria-label="What makes howlden different">
  <ul class="wrap truth-list">${truths}</ul>
</section>

<div class="panels">
${panel({ id: 'chat', tone: 'pink', media: chatMock(), kicker: `${art('text-channel')}Text channels`, title: 'Chat, react, howl', text: 'Text channels with bold, italic, spoilers, code and quotes. Reply to a friend, mention the whole pack, react with a howl or a campfire, drop a file that goes straight from your browser to theirs. It all feels like the chat app you know, minus the company in the middle.', extra: `<a href="chat-without-signing-up.html" class="more">Chat without signing up${icon('arrow')}</a>` })}
${panel({ id: 'share', flip: true, tone: 'mint', media: shareMock(), kicker: `${art('screen-share')}Voice, video, screen share`, title: 'Show the pack your screen, no server watching', text: 'Share a game, a tab or your whole screen while the den talks it over. Turn on cameras, watch the ring light up around whoever speaks. Every stream travels directly between you, sealed with DTLS and SRTP.', extra: `<a href="screen-share-without-app.html" class="more">Screen share without an app${icon('arrow')}</a>` })}
${panel({ id: 'voice', tone: 'fire', media: voiceMock(), kicker: `${art('voice-channel')}Voice channels`, title: 'Take a seat by the fire', text: 'Voice channels are campfires that never go out. See which wolves are already howling, click to sit down, click to leave. No ringing, no meeting links, no scheduling. Mute and deafen are one click away, and a call works just as well with one friend as with the whole pack.', extra: `<a href="voice-chat-in-browser-no-download.html" class="more">Voice chat with no download${icon('arrow')}</a>` })}
${panel({ id: 'around', flip: true, tone: 'night', media: membersMock(), kicker: `${art('pack')}Members`, title: 'Know your whole pack at a glance', text: 'The member list shows which wolves are in the den, who is howling in voice, who is sharing a screen and who wandered off. A den holds up to 5, invite only, so every name on the list is someone you let in.', extra: `<a href="#mesh" class="more">Why a den holds 8${icon('arrow')}</a>` })}
</div>

<div class="marquee" aria-hidden="true"><div class="mq-track"><div class="mq-row">${band}</div><div class="mq-row">${band}</div></div></div>

<div class="panels">
${panel({ id: 'account', tone: 'gold', media: profileMock(), kicker: `${art('key')}Your account`, title: 'Your account lives on your device', text: 'No email, no password, no phone number. Pick a username and an avatar and your browser makes a signing key pair that never leaves your device. Your tag, like luna#7c1f, comes from that key, so friends know it is really you. There is no server to reset it, sell it or leak it from.', extra: `<ul class="ticks"><li>${icon('check')}<span>Lock your profile with a PIN on shared computers.</span></li><li>${icon('check')}<span>Moving to a new device? Save an encrypted backup file and import it there.</span></li><li>${icon('check')}<span>Clearing your browser data clears your profile too, unless you kept a backup.</span></li></ul>` })}
</div>

<section id="invite" class="band" aria-labelledby="invite-title">
  <div class="wrap">
    <header class="sec-head"><p class="kicker">${art('invite')}Invite only</p><h2 id="invite-title" class="mega mega-md">How inviting works</h2><p>There is no server to introduce you, so friends introduce themselves: one link out, one reply code back. That is the whole handshake.</p></header>
    <ol class="howto">${steps}</ol>
    <div class="qr-demo">
      <div class="qr-card"><div class="qr-svg">${qr}</div><p>${art('qr')}A real QR code drawn by howlden's own encoder. This one opens the app.</p></div>
      <div class="qr-copy">
        <h3>Link, QR code or paste</h3>
        <p>Invites and replies are compressed so they fit in a link and a QR code. Share them through any messenger you already trust, show the QR on your screen for someone in the room, or paste the code by hand. Your friend never sees anything technical.</p>
        <ul class="ticks"><li>${icon('check')}<span>The member who invited has to accept the reply, so a leaked link is not enough to get in.</span></li><li>${icon('check')}<span>Phones scan with the camera where the browser supports it, with paste as a fallback.</span></li><li>${icon('check')}<span>After the first link, the den connects the newcomer to everyone else by itself.</span></li></ul>
        <a href="peer-to-peer-chat-explained.html" class="more">Peer to peer chat, explained${icon('arrow')}</a>
      </div>
    </div>
  </div>
</section>

<section id="private" class="band" aria-labelledby="private-title">
  <div class="wrap private-grid">
    <div class="private-copy">
      <header class="sec-head left"><p class="kicker">${art('shield')}Why it is private</p><h2 id="private-title" class="mega mega-md">Nothing in the middle</h2><p>Most chat apps send every message through a company's servers. A howlden den is a small circle of browsers talking to each other. Here is exactly what that means, with no fine print.</p></header>
      <ul class="private-list">${priv}</ul>
      <p class="honest">${art('moon')}<span>Honest note: private is not the same as anonymous. Members of a den connect directly, so they can see each other's network address, and your security still depends on your device and your browser.</span></p>
    </div>
    <div class="private-art">
      ${pic('', 'sealed-tunnel', 'Two wolves talk through a tunnel of padlocks')}
      <div class="path-card" aria-label="Where your messages travel">
        <p class="path-row"><span class="node">${art('browser')}You</span><span class="wire direct"><i></i></span><span class="node">${art('browser')}Friend</span></p>
        <p class="path-cap">howlden: browser to browser, encrypted</p>
        <p class="path-row"><span class="node">${art('browser')}You</span><span class="wire"><i></i></span><span class="node srv">${art('no-server')}No server of ours</span><span class="wire"><i></i></span><span class="node">${art('browser')}Friend</span></p>
        <p class="path-cap">There is simply no box in the middle to store or read anything.</p>
      </div>
      ${pic('', 'fingerprint', 'Two wolves compare matching fingerprint cards')}
    </div>
  </div>
</section>

<section id="use-cases" class="band" aria-labelledby="use-title">
  <div class="wrap">
    <header class="sec-head"><p class="kicker">${art('pack')}Use cases</p><h2 id="use-title" class="mega mega-md">A den for every pack</h2><p>Small groups of people who know each other are where howlden shines.</p></header>
    <ul class="uses">${uses}</ul>
  </div>
</section>

<section id="compare" class="band" aria-labelledby="compare-title">
  <div class="wrap">
    <header class="sec-head"><p class="kicker">${art('mesh')}Two approaches</p><h2 id="compare-title" class="mega mega-md">Server based or direct?</h2><p>Both approaches are good at different things. Server based apps are great for big communities, message history and reaching friends who are offline. A direct, peer to peer den is for small groups who want nothing in the middle.</p></header>
    <div class="tbl-wrap" tabindex="0" role="region" aria-label="Comparison of server based and direct chat">
      <table class="cmp">
        <thead><tr><th scope="col"><span class="sr-only">Topic</span></th><th scope="col">${art('no-server')}Server based chat apps</th><th scope="col" class="us">${art('den')}howlden (direct)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="compare-note">Want the long version? Read <a href="discord-alternative-without-account.html">a Discord alternative without an account</a> or <a href="free-encrypted-group-chat.html">encrypted group chat for free</a>.</p>
  </div>
</section>

<section id="mesh" class="band" aria-labelledby="mesh-title">
  <div class="wrap mesh-grid">
    ${pic('', 'pack-mesh', 'Five wolves linked to each other like stars in a constellation')}
    <div>
      <header class="sec-head left"><p class="kicker">${art('pack')}Up to 5</p><h2 id="mesh-title" class="mega mega-md">Why a den holds 5 wolves</h2></header>
      <p>In a den, everyone is linked to everyone. With 4 members that is 6 links, with 5 members it is 10. Each member sends their voice and video to each of the others, so upload bandwidth grows with the size of the pack. Audio is light; video with 5 cameras on asks a lot of a home connection.</p>
      <p>Eight is where a mesh still feels good on ordinary connections. For bigger groups, a server based tool is the honest answer, and that is fine.</p>
      <ul class="ticks"><li>${icon('check')}<span>Text, reactions and files are tiny and stay quick in a full den.</span></li><li>${icon('check')}<span>If two members cannot link directly, another member forwards their messages.</span></li><li>${icon('check')}<span>When both sides sit behind a strict NAT, a TURN relay can carry the encrypted traffic. <a href="webrtc-connection-failed-strict-nat.html">Fixing a failed connection</a>.</span></li></ul>
    </div>
  </div>
</section>

<section id="faq" class="band" aria-labelledby="faq-title">
  <div class="wrap faq-grid">
    <header class="sec-head left"><p class="kicker">${art('moon')}FAQ</p><h2 id="faq-title" class="mega mega-md">Questions around the campfire</h2><p>Including the limits. A den is not the right tool for everything, and we would rather you know before you invite your pack.</p>${pic('', 'moonlit-den', 'A den glowing under the moon, no server tower in sight')}</header>
    <div class="faq">${faq}</div>
  </div>
</section>

<section id="guides" class="band" aria-labelledby="guides-title">
  <div class="wrap">
    <header class="sec-head"><p class="kicker">${art('study')}Guides</p><h2 id="guides-title" class="mega mega-md">Guides from the den</h2><p>Plain language guides about private chat, voice and video in the browser.</p></header>
    <ul class="guide-grid">${gl}</ul>
    <p class="ctr-row"><a href="guides.html" class="btn-big btn-night">All ${guides.length} guides${icon('arrow')}</a> <a href="pt/chat-sem-cadastro.html" class="btn-big btn-night" hreflang="pt-BR" lang="pt-BR">${icon('globe')}Guias em português</a></p>
  </div>
</section>

<section class="closing" aria-labelledby="final-title">
  <div class="hx-sky" aria-hidden="true">${floaters([['moon', 'c-moon'], ['star', 'c-star1'], ['star', 'c-star2'], ['flame', 'c-flame']])}</div>
  <div class="wrap closing-in">
    <h2 id="final-title" class="mega">Your pack is waiting. Start howling.</h2>
    <p>Open a den, send one link, and you are around the campfire in under a minute. No account to make, nothing to download, no server of ours.</p>
    <a href="app/" class="btn-big btn-white">${art('den')}Open howlden in your browser</a>
  </div>
  <div class="lineup" aria-hidden="true">
    <img src="assets/art/characters/moss.svg" width="260" height="410" alt="" loading="lazy">
    <img src="assets/art/characters/nova.svg" width="260" height="410" alt="" loading="lazy">
    <img class="lu-luna" src="assets/art/characters/luna.svg" width="512" height="512" alt="" loading="lazy">
    <img src="assets/art/characters/fang.svg" width="260" height="410" alt="" loading="lazy">
    <img src="assets/art/characters/pip.svg" width="260" height="410" alt="" loading="lazy">
    <img src="assets/art/characters/ember.svg" width="260" height="410" alt="" loading="lazy">
  </div>
</section>`;
}

export function homeJsonLd(guides) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'howlden',
      url: SITE,
      applicationCategory: 'CommunicationApplication',
      operatingSystem: 'Any modern browser (Windows, macOS, Linux, Android, iOS)',
      browserRequirements: 'Requires a browser with WebRTC and JavaScript',
      description: 'Serverless peer to peer group chat, voice and video in the browser, with text and voice channels, screen share and files. No account, invite only, end to end encrypted.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      isAccessibleForFree: true,
      license: 'https://opensource.org/licenses/MIT',
      softwareVersion: '0.1.0',
      featureList: ['Local profile with a cryptographic identity key, no email or password', 'Text channels', 'Voice channels', 'Video calls', 'Screen share', 'File sharing', 'Reactions', 'QR code invites', 'End to end encryption with WebRTC', 'Optional passphrase', 'Connection fingerprint', 'Installable PWA', 'Up to 5 people per den'],
      screenshot: `${SITE}og.png`,
      image: `${SITE}assets/mascot.svg`,
      author: { '@type': 'Person', name: 'Alexandre Kohler', url: 'https://github.com/kwy404', sameAs: ['https://www.linkedin.com/in/alexandre-silva-173687256/'] },
      codeRepository: 'https://github.com/kwy404/howlden',
      hasPart: guides.map((g) => ({ '@type': 'TechArticle', headline: g.h1, url: `${SITE}${g.slug}.html` })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ];
}
