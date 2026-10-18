# AtlasNote · Local prototype

Write it freely, keep it closely.

A buildless, device-first notebook adapted from the AstraNote interface. No account, backend, AI, payment, analytics, remote fonts, cloud sync, or network storage. This is an independent local project; it does not modify AstraNote data.

## Preview

Run `npm start` with Node 22 or newer, then open **http://127.0.0.1:4321**. No npm install or environment keys are required. The Node process only serves static files and security headers; all application data stays in the browser. Do not open the HTML through file://.

Keep using the same origin (scheme + hostname + port). `localhost`, `127.0.0.1`, and a future atlasnote.nxlabtw.com each have different storage. Export JSON before changing origins. HTTPS is required for a non-local deployment.

## Included

- English, Traditional Chinese, Japanese, and playful l33t; dark/light themes.
- IndexedDB notes, title search, pin/archive, batch management, trash with 1/3/7/14/30-day retention.
- Markdown rendering (raw HTML disabled; no externally loaded Markdown images), up to 3 local image attachments, captions, inline `{img_ID}` placement, compression, drawing and text annotation.
- 0/1/3/5/10/20 reverse text versions (default 3). Images/captions are not versioned. Restore keeps the current images.
- No encryption, Basic encryption, Secure encryption (AtlasEncrypt v1).
- Single-note JSON backup/import, fresh note IDs and re-encryption, atomic import. The backup picker exports exactly one note at a time, never the entire library.
- PWA application-shell caching, install entry, StorageManager estimates and persistence request.

## Encryption boundaries

AtlasEncrypt names only the third, passphrase-protected mode. It is not the name of the entire encryption selection. Internal v1 AAD labels are unchanged to preserve existing local notes.

Basic encryption: a random 256-bit device root lives in localStorage. HKDF-SHA-256 derives separate per-note and title keys. AES-256-GCM uses a fresh 96-bit IV and purpose/ID-bound AAD. Basic JSON exports include only the individual content key as Base64, never the device root. **Anyone holding that export can decrypt that note. Base64 is not encryption.**

Secure encryption: a random 256-bit per-note content key is wrapped using Argon2id (96 MiB, four passes, parallelism 1) and HKDF bound to the note ID. ASCII passphrases are 4–16 characters; weak passphrases remain vulnerable to offline guesses. Plaintext passphrases and unwrapped keys are never persisted. Imported secure copies require their old passphrase and a passphrase for a newly generated key.

Encrypted titles also use an independent device-key envelope for visible/searchable lists. This is **not** passphrase-only title protection. There is no protection against malicious same-origin code or a compromised device while data is unlocked. Keep exported backups; clearing site data or localStorage can destroy device keys. The prototype has not had an independent security audit.

## Safety and migration

- No destructive import overwrites; note mutations use IndexedDB revision checks to reject stale cross-tab saves.
- Fixed KDF costs; imports cannot supply arbitrary parameters. No application-level JSON file-size ceiling; exactly one note per backup. Imports still use whole-file JSON parsing, so browser string limits, available memory and IndexedDB quota apply; this is not a guarantee that multi-GB files work on any particular device. Original PNG/JPEG/WebP files up to 100 MB, decoded images up to 67.1 MP, stored images up to 8192 px per dimension and 16 MB each. Compact and Balanced reduce dimensions more than Clear. Header dimensions are checked before decoding; imported dimensions must match. These are memory safeguards, not paid quotas; a device can run out of memory below them.
- Trash is expired lazily when the app opens, not by a server. JSON backups contain current notes even when exported from trash; imports restore them outside trash.
- `_headers` is a deployment template, not a guarantee a hosting provider applies it. Verify actual headers before public deployment. No public deployment or GitHub repository has been created.
- Static assets are vendored locally. Their licenses are preserved under `script/vendor` and `asset/fontawesome`. Original AtlasNote code: all rights reserved by NXLabTW.

Contact: atlasnote@nxlabtw.com
