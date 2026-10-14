# Changelog

All notable changes to howlden are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-14

### Added

- The howlden web app: dens with text channels and voice channels, video, screen share, files sent browser to browser, reactions, mentions and replies, for up to 8 people per den.
- Local profiles with no email, password or phone: a username, an avatar and a signing key pair (Ed25519 where supported, ECDSA P-256 otherwise) made on the device, with an optional PIN lock and encrypted backups.
- Serverless invites: the WebRTC offer, compressed with deflate-raw and written as base64url, travels in a link and a QR code; the guest answers with a reply code. The den then introduces newcomers to every member over existing encrypted links.
- An own QR code encoder (byte mode, error correction, masking) and camera scanning with BarcodeDetector where available, with paste as a fallback.
- End to end encryption by WebRTC (DTLS and SRTP), an optional den passphrase (PBKDF2 to AES-GCM) and a connection fingerprint to compare.
- Detection of failed connections behind strict NAT, explained in plain words, and a setting for your own TURN servers, stored locally.
- An installable PWA with a service worker that opens offline once loaded.
- The website: a landing page with a live, interactive preview of the app, honest limits, a comparison of server based and direct chat, an FAQ, 12 English guides and 3 Portuguese guides with hreflang, a sitemap, robots.txt, an Open Graph image per page and a 404 page.
- Luna the wolf, her pack, 44 icons and 14 illustrations, each in a dusk and a night version.

[0.1.0]: https://github.com/kwy404/howlden/releases/tag/v0.1.0
