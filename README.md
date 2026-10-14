<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/howlden@main/assets/banner-dark.svg">
    <img src="https://cdn.jsdelivr.net/gh/kwy404/howlden@main/assets/banner.svg" width="880" alt="howlden banner: Luna the wolf howls into her headset mic. Serverless group chat, voice and video in your browser, with no account, end to end encryption, invites only and up to 5 people">
  </picture>
</p>

<h1 align="center">howlden: serverless group chat, voice and video in your browser</h1>

<p align="center">
  <a href="https://github.com/kwy404/howlden/actions/workflows/ci.yml"><img src="https://github.com/kwy404/howlden/actions/workflows/ci.yml/badge.svg" alt="CI status of howlden"></a>
  <a href="https://github.com/kwy404/howlden/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-7c5cff" alt="MIT license"></a>
  <a href="https://kwy404.github.io/howlden/app/"><img src="https://img.shields.io/badge/open-the%20app-ff8a3d" alt="Open the howlden app in your browser"></a>
  <img src="https://img.shields.io/badge/server-none%20of%20ours-1b1240" alt="No server of ours">
  <img src="https://img.shields.io/badge/account-none-1b1240" alt="No account, no sign up">
  <img src="https://img.shields.io/badge/encryption-end%20to%20end-3ee6a0" alt="End to end encrypted with WebRTC">
</p>

<p align="center">
  <a href="https://kwy404.github.io/howlden/app/"><b>Open a den</b></a> &middot;
  <a href="https://kwy404.github.io/howlden/">Website</a> &middot;
  <a href="https://kwy404.github.io/howlden/#invite">How inviting works</a> &middot;
  <a href="https://kwy404.github.io/howlden/guides.html">Guides</a> &middot;
  <a href="https://github.com/kwy404/howlden/blob/main/i18n/README.pt-BR.md">Leia em Português (pt-BR)</a>
</p>

**howlden is a free, open source group chat that runs entirely in your browser, with the layout you know from gaming chat apps: dens (servers), text channels, voice channels, video and screen share.** There is no account and no sign up: you create a local profile (a username, an avatar and an identity key made on your device). You invite friends with a link or a QR code, and everything flows directly between your browsers over WebRTC, end to end encrypted. No server of ours ever sees your messages, voice, video or files. A den holds up to 5 people, or just you and one friend.

<p align="center">
  <a href="https://kwy404.github.io/howlden/"><img src="https://cdn.jsdelivr.net/gh/kwy404/howlden@main/assets/social-preview.png" width="820" alt="The howlden website: a den for your pack, no server in sight, with a pack of wolves around a campfire"></a>
</p>

## Table of contents

- [Open the app](#open-the-app)
- [Features](#features)
- [How inviting works](#how-inviting-works)
- [Why it is private](#why-it-is-private)
- [Honest limits](#honest-limits)
- [Server based or direct](#server-based-or-direct)
- [Run it yourself](#run-it-yourself)
- [Development](#development)
- [FAQ](#faq)
- [Guides](#guides)
- [Art](#art)
- [More from kwy404](#more-from-kwy404)
- [Author](#author)
- [License](#license)

## Open the app

Go to **[kwy404.github.io/howlden/app](https://kwy404.github.io/howlden/app/)**, pick a username and an avatar, open a den and send an invite. That is it: nothing to download, no email, no password, no phone number. Works in current Chrome, Edge, Firefox and Safari, on desktop and on phones. You can install it from the browser as an app, and it opens offline once loaded (calls still need a network, of course).

## Features

| | |
| --- | --- |
| **Dens** | A group space with text channels, voice channels and a member list. Each den is its own private circle of up to 5 people. |
| **Text channels** | Messages with bold, italic, strike, spoilers, code, quotes, lists and links. Mentions, replies, edits, deletes and reactions. |
| **Voice channels** | Take a seat and howl. A ring lights up around whoever is speaking. Mute and deafen are one click away. |
| **Video and screen share** | Turn on a camera or share a window, a tab or the whole screen inside any voice channel. |
| **Files** | Drop a file in the chat and it goes straight from your browser to your friends. Nothing is uploaded anywhere. |
| **Local profile** | A username, an avatar and a signing key pair (Ed25519 where the browser supports it) made on your device. Your tag, like `luna#7c1f`, comes from that key. Lock it with a PIN, or move it with an encrypted backup file. |
| **Invites** | A link and a QR code out, a reply code back. Camera scanning where the browser supports it, paste everywhere. |
| **Privacy extras** | An optional den passphrase for a second layer of encryption and a connection fingerprint you can compare. |
| **Network help** | Clear words when a strict network blocks a direct connection, and a setting for your own TURN server. |
| **Installable** | A PWA with a service worker: install it, and it opens offline once loaded. |

## How inviting works

There is no server to introduce you, so friends introduce themselves. One round trip:

1. **Send an invite.** Click Invite in your den. howlden packs the WebRTC connection offer (compressed with `deflate-raw`, written as base64url) into a link and a QR code. Send the link through any messenger you already use, or let your friend scan the QR.
2. **Get a reply code.** Your friend opens the link and their browser makes a short reply code, also a link or a QR. They send it back the same way.
3. **Howl together.** Paste or scan the reply and your friend is in. howlden then connects them to everyone else in the den by itself, passing the setup messages over the encrypted links that already exist, so every member ends up linked to every other member.

The member who invited has to accept the reply code, so a leaked invite link alone is not enough to get in. Nobody ever sees JSON or anything technical. More in [peer to peer chat, explained](https://kwy404.github.io/howlden/peer-to-peer-chat-explained.html).

## Why it is private

- **No server of ours.** There is no howlden backend, database or account system. No server of ours ever sees your messages, voice, video or files. The website and the app are static files on GitHub Pages.
- **Encrypted by WebRTC.** Every connection is encrypted end to end with DTLS, and audio and video with SRTP. This is built into the browser and cannot be switched off.
- **STUN only asks one question.** To find a route, each browser asks a public STUN server "what is my public address?". STUN servers never see your conversations.
- **Relays cannot read.** When a strict network blocks a direct path, a TURN relay can forward the traffic. A TURN relay only forwards encrypted packets and cannot read them.
- **Nothing stored online.** Your profile, settings, dens and messages live in your own browser.
- **Optional passphrase.** A den passphrase adds a second layer: PBKDF2 derives an AES-GCM key, so only members who know it can read messages and files.
- **Fingerprint.** howlden shows a short connection fingerprint. Compare it on a call: if both sides see the same code, nobody is in the middle.

Private is not the same as anonymous: members of a den connect directly, so they can see each other's network address. And your security still depends on your device and your browser. Read the [security policy](https://github.com/kwy404/howlden/blob/main/SECURITY.md).

## Honest limits

- **Up to 5 people per den.** A den is a full mesh: everyone sends their audio and video to everyone else. Upload bandwidth grows with each person, so for large communities a server based tool is the better fit.
- **Everyone has to be online.** There is no server holding messages. When you come back, members who are online share what you missed; if nobody is online, the den is quiet.
- **Strict NAT on both sides** (some office, school, hotel and mobile carrier networks) can block a direct connection. Then you need a TURN relay; howlden tells you when this happens. See [fixing a failed connection](https://kwy404.github.io/howlden/webrtc-connection-failed-strict-nat.html).
- **Video is heavy.** Audio stays light even in a full den; five cameras ask a lot of a home connection.
- **Clearing your browser data removes your profile**, unless you saved an encrypted backup.

## Server based or direct

Both approaches are good at different things. This compares approaches, not brands.

| | Server based chat apps | howlden (direct) |
| --- | --- | --- |
| Where messages go | Through the provider's servers, which store and forward them | Straight between the members' browsers |
| Account | Usually an email or a phone number and a password | A local profile on your device |
| Group size | Large communities | Up to 5 per den, or just two of you |
| Friends who are away | Messages wait on the server | Everyone chats while online; history syncs from members who are online |
| How people join | Public servers, search and invite links | Invite only |
| Encryption | Depends on the app | End to end by WebRTC, plus an optional passphrase |
| Moderation and bots | Often rich | Kept simple, for small groups who know each other |
| Who runs it | The provider | Nobody: the members' browsers do the work |

## Run it yourself

howlden is static files. Serve the `docs/` folder from any static host (GitHub Pages, Netlify, your own nginx) over HTTPS, because browsers only allow the microphone and camera on secure pages:

```bash
git clone https://github.com/kwy404/howlden.git
cd howlden
npm install
npm run serve   # http://127.0.0.1:8080/ for local testing
```

## Development

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests for the core modules (QR encoder, invites, crypto, mesh, history, identity) and the site checks, with Vitest |
| `npm run lint` | ESLint |
| `npm run rules` | House rules: no emoji, no en or em dashes, no names of other CSS frameworks |
| `npm run core` | Copies the shared modules from `src/` to `docs/app/core/` |
| `npm run e2e` | A real two browser connection test with fake media devices |
| `npm run site` | Builds the website pages, guides, sitemap and art from `scripts/site/` |
| `npm run site:check` | Fails when the built site is stale or has a broken internal link |
| `npm run site:images` | Renders the Open Graph images and the social preview |

The website is built with [Monsoon](https://kwy404.github.io/monsoon/) and its interactive parts with [Voodoo.js](https://kwy404.github.io/Voodoo.js/). See [CONTRIBUTING.md](https://github.com/kwy404/howlden/blob/main/CONTRIBUTING.md).

## FAQ

### Is there a chat app that needs no sign up and no account?
Yes. howlden asks for no email, password or phone number. You create a local profile on your device and share an invite link. See [chat without signing up](https://kwy404.github.io/howlden/chat-without-signing-up.html).

### How do I voice chat in the browser with no download?
Open the app, join a voice channel and allow the microphone. Everything runs on WebRTC, which every modern browser ships. See [voice chat in the browser with no download](https://kwy404.github.io/howlden/voice-chat-in-browser-no-download.html).

### Is there a Discord alternative without an account?
For small private groups, yes: howlden has dens, text and voice channels and screen share, with no account and no server in the middle. It is not built for big public communities. See [a Discord alternative without an account](https://kwy404.github.io/howlden/discord-alternative-without-account.html).

### Is howlden end to end encrypted?
Yes. WebRTC encrypts every connection with DTLS and SRTP, a passphrase can add a second layer, and a fingerprint lets you check that nobody is in the middle.

### Why does my WebRTC connection fail?
Usually because both sides are behind a strict NAT. Add a TURN server in Settings. See [WebRTC connection failed](https://kwy404.github.io/howlden/webrtc-connection-failed-strict-nat.html).

### How many people can join?
Up to 5 per den. It works just as well for two.

## Guides

- [Chat without signing up](https://kwy404.github.io/howlden/chat-without-signing-up.html)
- [Voice chat in the browser with no download](https://kwy404.github.io/howlden/voice-chat-in-browser-no-download.html)
- [Discord alternative without an account](https://kwy404.github.io/howlden/discord-alternative-without-account.html)
- [Private group voice call](https://kwy404.github.io/howlden/private-group-voice-call.html)
- [Peer to peer chat explained](https://kwy404.github.io/howlden/peer-to-peer-chat-explained.html)
- [Screen share without an app](https://kwy404.github.io/howlden/screen-share-without-app.html)
- [Encrypted group chat for free](https://kwy404.github.io/howlden/free-encrypted-group-chat.html)
- [Voice chat for gaming in the browser](https://kwy404.github.io/howlden/browser-voice-chat-for-gaming.html)
- [How WebRTC voice chat works](https://kwy404.github.io/howlden/how-webrtc-voice-works.html)
- [A safe chat for kids' study groups](https://kwy404.github.io/howlden/safe-chat-for-kids-study-groups.html)
- [WebRTC connection failed: strict NAT and TURN](https://kwy404.github.io/howlden/webrtc-connection-failed-strict-nat.html)
- [Group video call without an account](https://kwy404.github.io/howlden/group-video-call-without-account.html)
- Em português: [chat sem cadastro](https://kwy404.github.io/howlden/pt/chat-sem-cadastro.html), [chamada de voz no navegador](https://kwy404.github.io/howlden/pt/chamada-de-voz-no-navegador.html), [alternativa ao Discord sem conta](https://kwy404.github.io/howlden/pt/alternativa-ao-discord-sem-conta.html)

## Art

Luna (a young wolf with a gaming headset), her pack, 44 icons and 14 night scenes are original SVG, each in a dusk and a night version, drawn in code in [scripts/site](https://github.com/kwy404/howlden/tree/main/scripts/site) and exported to [assets](https://github.com/kwy404/howlden/tree/main/assets). They are MIT licensed like the code.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/howlden@main/assets/icons-sheet-dark.svg">
    <img src="https://cdn.jsdelivr.net/gh/kwy404/howlden@main/assets/icons-sheet.svg" width="640" alt="The howlden icon set: den, text and voice channels, mute, deafen, screen share, camera, invite, QR, lock, fingerprint, mesh, campfire, relay and more">
  </picture>
</p>

## More from kwy404

- [Monsoon](https://kwy404.github.io/monsoon/): utility first CSS with no build step and a theme from one seed color.
- [Voodoo.js](https://kwy404.github.io/Voodoo.js/): reactive attributes and JSX in plain HTML.
- [filefinch](https://kwy404.github.io/filefinch/): send files peer to peer in the browser, no server.
- [breakhound](https://kwy404.github.io/breakhound/): find bugs in any JavaScript library automatically.
- [vueleap](https://kwy404.github.io/vueleap/): Vue 2 to Vue 3 migration.
- [graphemely](https://kwy404.github.io/graphemely/): grapheme aware string utilities.
- [numberparrot](https://kwy404.github.io/numberparrot/): parse localized numbers.
- [edgegoat](https://kwy404.github.io/edgegoat/): edge case inputs for JavaScript testing.
- [cookieowl](https://kwy404.github.io/cookieowl/): cookie consent for LGPD and GDPR that really blocks trackers.
- [installkite](https://kwy404.github.io/installkite/): make any website installable and offline capable.
- [a11ymedic](https://kwy404.github.io/a11ymedic/): accessibility checker with exact fixes.
- [fontsketch](https://kwy404.github.io/fontsketch/): turn your handwriting into a font.
- [kastor](https://kwy404.github.io/kastor/): TypeScript ORM for many databases.

## Author

Created by **Alexandre Kohler** ([GitHub](https://github.com/kwy404) and [LinkedIn](https://www.linkedin.com/in/alexandre-silva-173687256/)).

## License

[MIT](https://github.com/kwy404/howlden/blob/main/LICENSE) 2026 Alexandre Kohler
