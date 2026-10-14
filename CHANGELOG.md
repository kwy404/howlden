# Changelog

All notable changes to howlden are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-10-14

### Added

- Connect with six words instead of a link: the inviter shows six BIP39 words and a small QR code, the friend types or scans them and is in, with nothing to send back. Both devices derive a topic and an AES-GCM key from the words (PBKDF2, then HKDF) and meet on several public MQTT relays at once (EMQX, HiveMQ, Mosquitto) through a small MQTT 3.1.1 client written for howlden. The relays only see ciphertext; replayed and stale messages are rejected; the words work once and expire after 10 minutes. The first four letters of each word are enough and single typos are fixed.
- Six confirmation words made from both DTLS certificates: the joiner reads them, the inviter types them, and three wrong tries refuse the guest before anything is shared. A known friend whose identity key verifies is let in on the signature, so calling a friend needs only the six words. Words work for den invites, friend invites and calls.
- A "Zero third parties" setting that keeps the invite link and reply link exchange.
- Strong noise suppression, on by default: an AudioWorklet runs a 90 Hz high pass, an 8 kHz low pass, spectral suppression with an adaptive noise floor and a decision directed Wiener gain, and a voice activity gate with attack, hold and release. About 10.7 ms of added latency and about 1.3% of one CPU core. On synthetic tests (pink noise, fan hum and keyboard clicks under a voice like signal) it lowers the noise by about 31 dB in the pauses right after speech and by about 73 dB when nobody talks (the spectral part alone: about 23 dB), keeps speech band energy within 0.5 dB, and keeps the gate shut for clicks, fans and hum. Echo cancellation and automatic gain are always on, voice isolation where supported. Settings offer Off, Standard and Strong, a gate sensitivity slider, a live meter and a "Test my mic" loopback; the speaking ring follows the processed signal.
- The shared screen becomes the focused stage, with a filmstrip, full screen, picture in picture, double click to focus, and a draggable divider between a 1 to 1 call and its chat.
- Original interface sounds made with WebAudio (calls, people joining and leaving, mute, deafen, messages, mentions, the incoming call ring, screen share, connection), with a volume slider, a switch per sound and a Do not disturb mode.

### Fixed

- Pasting a reply in a friend invite could show "Failed to set remote answer sdp: Called in wrong state: stable" when the reply was applied twice (paste and click, or a reply handed over by another tab). Answers are now idempotent everywhere (invites, introductions, renegotiation for video and screen share, reconnects), the Connect button waits while connecting, and errors are shown in plain words instead of browser messages.
- The user card on a message author no longer overlaps the composer or clips the name: it flips and shifts inside the viewport and shows the full name, tag, badge and status.
- A guest who is refused no longer ends up in either friends list.
- The landing preview, the mesh illustration and a guide still said 8 people: everything now says 5.

[0.1.1]: https://github.com/kwy404/howlden/releases/tag/v0.1.1

## [0.1.0] - 2026-10-14

### Added

- The howlden web app: dens with text channels and voice channels, video, screen share, files sent browser to browser, reactions, mentions and replies, for up to 5 people per den.
- Local profiles with no email, password or phone: a username, an avatar and a signing key pair (Ed25519 where supported, ECDSA P-256 otherwise) made on the device, with an optional PIN lock and encrypted backups.
- Serverless invites: the WebRTC offer, compressed with deflate-raw and written as base64url, travels in a link and a QR code; the guest answers with a reply code. The den then introduces newcomers to every member over existing encrypted links.
- An own QR code encoder (byte mode, error correction, masking) and camera scanning with BarcodeDetector where available, with paste as a fallback.
- End to end encryption by WebRTC (DTLS and SRTP), an optional den passphrase (PBKDF2 to AES-GCM) and a connection fingerprint to compare.
- Detection of failed connections behind strict NAT, explained in plain words, and a setting for your own TURN servers, stored locally.
- An installable PWA with a service worker that opens offline once loaded.
- The website: a landing page with a live, interactive preview of the app, honest limits, a comparison of server based and direct chat, an FAQ, 12 English guides and 3 Portuguese guides with hreflang, a sitemap, robots.txt, an Open Graph image per page and a 404 page.
- Luna the wolf, her pack, 44 icons and 14 illustrations, each in a dusk and a night version.

[0.1.0]: https://github.com/kwy404/howlden/releases/tag/v0.1.0
