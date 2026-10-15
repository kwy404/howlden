# Changelog

All notable changes to howlden are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- A big "Call a friend" button on the home screen: one tap makes the six words, opens the share menu (or copies the words where there is none), and starts a voice call as soon as the friend types them; the friend's phone rings.
- Stickers drawn for howlden: Luna the wolf in eight moods (wave, howl, love, laugh, party, sleepy, thanks, cool), built from SVG shapes, with a small animation when they arrive and on hover.
- Reactions pop when they are added, and live reactions float over a call from the sender's tile for everyone in it (not stored, rate limited).
- Push to talk on touch screens: a big "Hold to talk" button in the call, and a Push to talk switch in the call's More menu.
- Music mode for a call: echo cancellation, noise suppression, automatic gain and our own noise suppression off, stereo where the device has it, and the Opus bitrate raised to 128 kbps. Others see a Music tag.
- Local call recording: after a confirmation, everything this device hears in the call is mixed into one audio file (WebM or Ogg Opus, or MP4) that stays on this device until you download it. Everyone in the call sees a "Recording" notice with who records, hears a short sound and gets a message; the recorder sees a timer and a Stop button. The notice comes from howlden itself and cannot stop someone who records with another program.
- Threads: "Reply in thread" opens a side panel with its own composer; the message shows how many replies it has and who replied. Thread replies sync like other messages and stay out of the main timeline.
- Pinned messages per channel (anyone may pin or unpin, the last change wins) with a Pins panel.
- Search across the den with filters: `from:name` or `from:me`, `has:file`, `has:image`, `has:voice`, `has:link`, `has:poll`, `has:sticker`, `before:` and `after:` a date, and quoted phrases. It runs on this device only.
- Polls with live results, single or multiple choice, from the attach menu or `/poll Question | A | B`. Votes merge like reactions, so late joiners get the same results.
- Voice messages: record from the composer's microphone button (up to 5 minutes), see a 48 point waveform, seek on it and play at 1x, 1.5x or 2x.
- A file gallery per channel: images in a grid, then files and voice messages.
- Syntax highlighting in code blocks for common languages, drawn with one text node per token (never parsed as markup).
- A formatting toolbar (bold, italic, strikethrough, spoiler, code, code block, quote) with Ctrl+B and Ctrl+I.
- Edit history: earlier versions of an edited message are kept (up to 10) and shown from "(edited)".
- Forwarding a message to any channel or direct conversation, labeled with who wrote it and where.
- Slash commands with suggestions: `/me`, `/roll 2d6`, `/coin`, `/poll`, `/shrug`, `/tableflip`, `/unflip`, `/nick`, `/clear` (this device only) and `/help`. Start with `//` to send a message that begins with a slash.
- Saved messages and reminders on a message, kept only on this device, with a Saved panel and a reminder card when it is time.
- Read markers: a "Jump" bar to the first unread message when it is out of view; drafts are now kept per channel across reloads; the typing line names up to three people.
- Custom status with an end time (30 minutes, 1 hour, 4 hours, today or never); peers stop showing it once it expires.
- The reaction picker shows your most used reactions first.
- Special dates, with the shared seasons script of the site: a quiet accent in the app chrome, Luna in costume on the first screen, a seasonal sticker and a seasonal reaction offered only during the season (New Year, Carnival, Easter, Valentine's, Festa Junina or Midsummer, Halloween, Christmas), seasonal empty states, a "Halloween mode" style switch on the home screen, and softer seasonal message sounds at Christmas, New Year and Halloween.

### Changed

- Invites are six words and a QR code only. No link or URL text is shown anywhere, and sharing sends the words as text. The QR code still holds the words so a phone camera opens the app with them.
- The invite link and reply link mode ("Zero third parties") is gone from the app and from Settings. Opening an invite link from an older version explains that six words are needed now.
- With reduced motion, the new animations stay still; reactions over a call fade in place instead of flying.

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
