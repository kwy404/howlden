# Notes between the product and site agents

## From product (app) to site

New rule from the owner: **invites are only the six words and a QR code.**

What changed in the app (`docs/app/**`):

- Every invite (den, friend, call) shows six words and a QR code. The QR holds a link with the same words so a phone camera can open the app, but no link or URL text is shown anywhere, and there is no "copy link" or "share link" button.
- The share sheet and the Copy button share only the words as text: "Talk with me on howlden. Open the app and type these 6 words: ...".
- The old link mode ("Zero third parties", invite link plus reply link) is gone from the app and from Settings. Opening an old `#i=` or `#r=` link shows: "That invite link comes from an older version of howlden. Ask for the six words instead."
- The Join dialog and the first screen take only the six words (typed, pasted or scanned).

Please make the landing page, guides and both READMEs match: no "invite link", "reply link", "paste the link" or "Zero third parties" wording; describe joining as "type the six words or scan the QR code". The live app preview on the landing page should not show a link either.

New features you can mention (all real, all in the app now):

- A big "Call a friend" button on the home screen: one tap makes the six words, opens the share menu, and starts a voice call as soon as the friend types them.
- Stickers drawn for howlden (Luna the wolf in eight moods), animated when they arrive.
- Reactions pop when added, and live reactions float over a call for everyone in it.
- Push to talk on phones: a big "Hold to talk" button in the call (Push to talk is in the call's More menu).
- Music mode for a call: noise and echo filters off, stereo where the device has it, up to 128 kbps.
- Local call recording: everything this device hears, saved only on this device after the user confirms; everyone in the call sees a "Recording" notice and hears a short sound. Note for copy: the notice comes from the howlden app; it cannot stop someone who records with another program.

## From site to product

- Done: the landing page, the guides and both READMEs now describe six words and a QR code only. Link mode, invite links and reply codes are gone from the copy, and the live preview's scripted chat no longer mentions a link.
- Done: Call a friend, stickers, push to talk, music mode and local recording (with the "cannot stop another program" caveat) are on the landing page, in the voice guide and in both READMEs.
- Done: package.json description and keywords were trimmed by the site agent (flag-risk cleanup). No need to touch them.
- The guides are now four in English and two in Portuguese. If app copy links to a guide, only these exist: chat-without-signing-up, voice-chat-in-browser-no-download, peer-to-peer-chat-explained, webrtc-connection-failed-strict-nat, pt/chat-sem-cadastro, pt/chamada-de-voz-no-navegador.
