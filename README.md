<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/howlden@5a825300d45710bd67a8134cb2591ac638670bca/assets/banner-dark.svg">
    <img src="https://cdn.jsdelivr.net/gh/kwy404/howlden@5a825300d45710bd67a8134cb2591ac638670bca/assets/banner.svg" width="880" alt="howlden banner: Luna the wolf howls into her headset mic">
  </picture>
</p>

<h1 align="center">howlden</h1>

<p align="center">Group chat, voice and video between browsers, for up to 5 friends. No account, and no server of ours in the middle.</p>

<p align="center">
  <a href="https://github.com/kwy404/howlden/actions/workflows/ci.yml"><img src="https://github.com/kwy404/howlden/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="https://github.com/kwy404/howlden/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-7c5cff" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://kwy404.github.io/howlden/app/"><b>Open the app</b></a> &middot;
  <a href="https://kwy404.github.io/howlden/">Website</a> &middot;
  <a href="https://kwy404.github.io/howlden/guides.html">Guides</a> &middot;
  <a href="https://github.com/kwy404/howlden/blob/main/i18n/README.pt-BR.md">Português</a>
</p>

howlden is a small group chat that runs entirely in the browser: dens with text channels, voice channels, video and screen share. You pick a name and an avatar, share six words with a friend, and you are talking. Messages, calls and files go straight between the browsers over WebRTC, end to end encrypted.

## Quick start

1. Open **[kwy404.github.io/howlden/app](https://kwy404.github.io/howlden/app/)** and pick a name and an avatar.
2. Create a den and click **Invite**. Read the six words to a friend, or send them in any messenger.
3. Your friend types the words and reads six confirmation words back. Type them, and you are connected.

Nothing to install. It works in current Chrome, Edge, Firefox and Safari, on desktop and on phones, and you can install it as an app from the browser.

## Features

- **Dens** with text channels, voice channels and a member list, for up to 5 people.
- **Text chat** with formatting, replies, mentions, edits, reactions and stickers of Luna that animate when they arrive.
- **Voice, video and screen share** inside voice channels, with mute, deafen and noise suppression.
- **Call a friend** from the home screen: one tap makes the six words and opens the share menu.
- **Push to talk**, with a big Hold to talk button on phones.
- **Music mode**: no noise or echo filters, stereo where the device has it, up to 128 kbps.
- **Local recording** of a call, saved only on your device, with a Recording notice and a sound for everyone in the call.
- **Files** sent straight from browser to browser.
- **A local profile**: a name, an avatar and an identity key made on your device. Lock it with a PIN, or move it with an encrypted backup file.
- **Six word invites** with a QR code. No links to copy, nothing technical to paste.
- **Privacy extras**: an optional den passphrase and a connection fingerprint you can compare.

## How inviting works

There is no server to introduce you, so friends introduce themselves with six words. Both browsers derive a meeting place and an AES-GCM key from the words and meet on public MQTT relays, so the relays only ever see ciphertext. The words work once and expire after 10 minutes. Your friend then reads six confirmation words, made from both connection certificates, back to you. A friend whose key you already know is let in on the signature alone.

Friends can type the words, paste them or scan the QR code. The inviter always confirms the newcomer, so leaked words alone are not enough. More in [how howlden works](https://kwy404.github.io/howlden/peer-to-peer-chat-explained.html).

## Privacy and limits

- No server of ours ever sees your messages, voice, video or files. The website and the app are static files.
- WebRTC encrypts every connection with DTLS, and audio and video with SRTP.
- Your profile, settings, dens and messages live in your browser. Clearing site data removes them unless you saved a backup.
- A recording notice comes from the howlden app. It cannot stop someone who records with another program.
- Private is not anonymous: members of a den connect directly and can see each other's network address.
- Everyone has to be online at the same time. Members who are online share what you missed.
- When both sides are behind a strict NAT, you need a TURN relay. howlden says so in plain words and lets you add one in Settings. See [when a connection fails](https://kwy404.github.io/howlden/webrtc-connection-failed-strict-nat.html).

Read the [security policy](https://github.com/kwy404/howlden/blob/main/SECURITY.md) for more.

## Run it yourself

howlden is static files. Serve the `docs/` folder from any static host over HTTPS (browsers only allow the microphone and camera on secure pages):

```bash
git clone https://github.com/kwy404/howlden.git
cd howlden
npm install
npm run serve   # http://127.0.0.1:8080/
```

## Development

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests for the core modules and the site checks (Vitest) |
| `npm run lint` | ESLint |
| `npm run rules` | House rules for every text file |
| `npm run core` | Copies the shared modules from `src/` to `docs/app/core/` |
| `npm run e2e` | A real two browser connection test with fake media devices |
| `npm run site` | Builds the website, guides, sitemap and art from `scripts/site/` |
| `npm run site:check` | Fails when the built site is stale or has a broken internal link |

The website is built with [Monsoon](https://kwy404.github.io/monsoon/) and its interactive parts with [Voodoo.js](https://kwy404.github.io/Voodoo.js/). The art (Luna, her pack, the icons and the scenes) is original SVG drawn in code in `scripts/site/`. See [CONTRIBUTING.md](https://github.com/kwy404/howlden/blob/main/CONTRIBUTING.md).

## Author

Made by **Alexandre Kohler** ([GitHub](https://github.com/kwy404), [LinkedIn](https://www.linkedin.com/in/alexandre-silva-173687256/)). More projects: [Monsoon](https://kwy404.github.io/monsoon/), [Voodoo.js](https://kwy404.github.io/Voodoo.js/), [filefinch](https://kwy404.github.io/filefinch/) and others on [GitHub](https://github.com/kwy404).

## License

[MIT](https://github.com/kwy404/howlden/blob/main/LICENSE) 2026 Alexandre Kohler
