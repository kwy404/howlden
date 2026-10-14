# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

The hosted app at https://kwy404.github.io/howlden/app/ always runs the latest version.

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately through [GitHub security advisories](https://github.com/kwy404/howlden/security/advisories/new). Include the browser and version, the steps to reproduce and what an attacker could gain. You will get an answer within 7 days, and a fix or a plan within 30 days for confirmed issues. Credit is given in the changelog unless you prefer otherwise.

## The security model, in plain words

What howlden does:

- **No server of ours.** The site and the app are static files. There is no howlden backend, database or account system, so no server of ours ever sees your messages, voice, video or files.
- **WebRTC encryption.** Every peer connection is encrypted end to end with DTLS; audio and video use SRTP. Browsers do not allow this to be turned off.
- **STUN** servers (public Google STUN by default) only tell each browser its public address. They never see conversations.
- **TURN relays**, when used, only forward encrypted packets and cannot read them. You can configure your own TURN servers; they are stored only in your browser.
- **Optional den passphrase.** PBKDF2 (SHA-256, 600,000 iterations) derives an AES-GCM key, salted with the den id, that adds a second layer of encryption to chat payloads and file chunks.
- **Local identity.** Each profile has a signing key pair (Ed25519 where supported, ECDSA P-256 otherwise) made with WebCrypto on the device. The everyday key is non extractable; a copy of the private key is stored only encrypted, under a device key or a PIN derived key. On every connection, peers sign a challenge bound to the DTLS fingerprints of that very connection.
- **Connection fingerprint.** A short code derived from both sides' DTLS fingerprints. If both people read the same code, nobody is in the middle.
- **Invites.** An invite link only works after the inviting member accepts the reply code from the guest's browser.
- **Untrusted text** from other peers is never parsed as HTML: chat formatting is rendered with DOM nodes from a fixed list of tags.

What howlden does not protect against:

- A compromised device or browser, or a malicious extension, can read everything you can read.
- Members of a den connect directly, so they can see each other's IP address. howlden is private, not anonymous.
- Anyone in a den can copy, screenshot or record what they see and hear.
- If the person you invite forwards the invite link and you accept the wrong reply code, the wrong person gets in. Compare the fingerprint when it matters.
- The hosted app is served by GitHub Pages; you trust that the files you load are the ones in this repository. You can host the static files yourself.

Nothing in howlden is "impossible to hack". If you find a gap between this page and the code, that is a bug: please report it.
