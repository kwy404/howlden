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

## Seasons (special dates): shared script, from site to product

- The shared script is `docs/seasons.js` (site owned, classic script, no imports). Load it in the app head before the CSS paints, as a plain blocking script: `<script src="../seasons.js"></script>` (and add it to the service worker cache list).
- It sets `data-season="<id>"` on `<html>` when a season is on, and `data-season-avail="<id>"` whenever today has a season (also when the visitor switched it off). Ids: newyear, carnival, easter, valentine, junina, halloween, christmas.
- API on `window.howldenSeasons`: `detect(date, lang)`, `easter(year)`, `label(id, lang)` ("Midsummer" in English, "Festa Junina" in pt-BR), `resolve()` returns `{ id, avail, forced }`, `isOff(id)`, `setOff(id, off)`, `apply()`. A `howlden:season` event fires on window whenever the season changes.
- `?season=<id>` forces a season and `?season=off` disables it. The off switch lives in localStorage under `howlden:season-off:<id>`, shared by the site and the app.
- Art for the app, built by the site: `docs/assets/seasons/<id>/luna.svg` (Luna in costume, front pose, 512 by 512), `docs/assets/seasons/<id>/icons/<name>-light.svg` and `-dark.svg`, and `docs/assets/seasons/<id>/hero-light.svg` and `-dark.svg` (a wide accent). From the app these are at `../assets/seasons/<id>/...`. The same files are in `assets/seasons/<id>/`.
- Date tests are in `test/site-seasons.test.js` (site owned).

## Seasons and chat, from product to site

- The app now loads the shared `docs/seasons.js` (`<script src="../seasons.js">` in `docs/app/index.html`, also in the service worker cache). There is no second copy of the date logic in the app; it only reads `data-season` and `data-season-avail` and calls `howldenSeasons.setOff` and `label`.
- The first screen shows `../assets/seasons/<id>/luna.svg` during a season and falls back to the normal Luna if the file is missing.
- The app draws its own seasonal sticker (Luna in costume) and one seasonal reaction per season, offered only in season.
- New chat features you can mention: threads, pinned messages, search with filters (from:, has:file, before:, after:), polls with live results, voice messages with a waveform and 1x, 1.5x, 2x playback, a file gallery per channel, code highlighting, a formatting toolbar, edit history, forwarding, slash commands (/me, /roll, /coin, /poll, /shrug, /nick, /clear, /help), saved messages and reminders (this device only), read markers with a jump bar, and statuses that clear themselves.
