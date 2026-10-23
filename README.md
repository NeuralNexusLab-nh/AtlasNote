# AtlasNote · Puter cloud preview

Write it freely, keep it closely.

A buildless notebook with Markdown, images, encryption and Atlas Agent. Puter provides identity, account-owned cloud storage and AI. No AtlasNote backend, developer AI key or shared billing credentials are required.

AtlasNote can be installed as a web app for quick access. Installation does not provide offline note access: an internet connection to AtlasNote and Puter is still required for authentication, notes, synchronization and AI.

## Local preview

Run `npm start` with Node 22 or newer to serve files at http://127.0.0.1:4321 for the isolated browser tests. Tests intercept the canonical HTTPS origin and serve those local files; they do not contact the production site or use a real account. Opening localhost directly intentionally shows the main-site notice. The application runs only at `https://atlasnote.nxlabtw.com/`. Do not open files through file://.

This is a local integration preview, not an assertion that a real Puter account has passed every cloud operation. The official remote SDK and authorization-window launch have been exercised without credentials; account storage, synchronization and AI tests use a contract double in isolated browser contexts. No original personal notes or accounts are used.

## Features

- Puter login is required for dashboard, notes, editing, trash and settings. Home, docs and policies are public. Online identity is checked on entry, data operations, focus and periodically while visible. Connection failure locks the UI rather than enabling offline use.
- Dashboard with note count, recent notes, account-wide used/remaining storage, and monthly resource allowance. Storage/allowance cards appear only on the dashboard. The right-hand storage value is **remaining**, not total. Allowance is shared across Puter apps, not an Atlas Agent-specific quota. Unknown API values remain unavailable rather than becoming zero.
- Public navigation includes Home and Docs only; installation remains on Home and Settings. The product homepage follows AstraNote's practical notes/images, fast retrieval, private content and Agent positioning, with organization/recovery details. Navbar account actions sit after the language selector; theme stays in Settings. Trashed notes open read-only and can be restored or permanently removed. Seven documentation topics include task steps, diagrams, responsive comparisons and FAQs.
- English, Traditional Chinese, Japanese and lightly transformed l33t. Dark/light themes, responsive menus and reduced-motion support.
- Markdown with raw HTML disabled, no remotely loaded Markdown images, up to three PNG/JPEG/WebP attachments, inline `{img_ID}`, compression, drawing and text annotations.
- Title search, pin/archive, batch operations, configurable trash retention and 0/1/3/5/10/20 reverse text versions (default 3). Restoring text keeps current images.
- No encryption, Basic encryption and Secure encryption (AtlasEncrypt).
- Atlas Agent uses the currently listed GPT-6 Luna model, streams an indeterminate activity indicator, validates JSON, previews title/text and saves only after confirmation. It sends the chosen note's plaintext title/text, prompt and explicitly selected images, never PINs or keys. GPT-6 Luna is an image-input/text-output model: it proposes validated shape/text/crop/rotate/brightness/contrast commands, applied locally, not generative photo editing.
- Installable PWA with illustrated browser instructions. Application-shell caching does **not** permit offline note access.

## Account isolation and storage

Puter's app-private root contains:

```
atlasnote-v1/
  account.json             # random account root key; do not delete/replace
  notes/<note-id>/<change-id>.json
  blobs/<sha256>.json      # immutable snapshots and image objects
```

Notes, images, account encryption data, and preferences are stored in the signed-in user's Puter account. AtlasNote keeps working records in page memory only; it does not persist notes/settings in its own IndexedDB or localStorage. A save is not complete until the Puter write is confirmed. If a change is still unsynced, leaving or reloading the page can lose it. AtlasEncrypt's unlocked content key (never the PIN) is the deliberate exception: it is temporarily held in tab-scoped sessionStorage to preserve unlock across same-origin page navigation, and is cleared by locking or signing out. A normal tab close clears it, but browser session restore may retain it.

The app uses only its own Puter app namespace at `atlasnote.nxlabtw.com`. Secondary host sharing, cross-domain authorization, and secondary-domain cleanup have been removed. EdgeOne's root `middleware.js` rejects other origins with HTTP 421 before serving app resources and redirects canonical HTTP requests to HTTPS. The client and cloud SDK boundary independently enforce the same exact origin. Secondary hosts do not initialize Puter or clear local data. Existing main-site Puter paths and keys are unchanged.

Cloud change files are immutable and published after referenced objects are uploaded. Head ancestry detects concurrent changes; edits stop on conflict until the user reviews versions and selects a continuation. Cached change metadata avoids re-downloading every old journal entry. Images are separate content-addressed objects, with encrypted image envelopes reused when unchanged. Network retries retain their change IDs.

Cloud reads are staged and validated before a complete scan is published to page memory. A failed initial scan stays on the retry screen; a failed background scan leaves the last successful notebook intact. An incomplete response is never interpreted as a deletion. Saves wait for their own immutable change record, including when another sync is already in progress. Pending changes survive reconnecting the same account within the open page; navigation and sign-out are blocked while a failed upload remains pending. Closing or force-reloading the page can still lose memory-only work.

A shared page-level request queue limits SDK work to two concurrent requests, spaces writes, budgets rolling read/list/write calls and applies a shared bounded backoff for HTTP 429. Recent identity checks are coalesced for five seconds; provider authentication rejection immediately locks access. Queued requests are tied to the current authentication session. These controls reduce requests from this page; they cannot guarantee against provider quotas shared with other tabs/apps or service failures.

**Preview limitation:** internal snapshots/journal records have no verified garbage-collection or provider secure-erasure mechanism yet. Removing a note hides it through a synchronized deletion record, but older objects can remain and consume space. This is explicitly disclosed in policies and deletion UI. Do not claim immediate remote erasure or deploy this as a finished retention/space-reclamation service before that work and real-account QA are complete. Text history does not expose image restoration, but internal synchronization data may still retain older image objects.

Do not manually modify app files in Puter. Lost keys or altered sync data can make notes unreadable. Note-file import and export are not supported; cloud serialization stays private to the app.

## Encryption boundaries

Basic mode derives separate AES-256-GCM content/title keys from a random 256-bit account root using HKDF-SHA-256 and note/purpose-bound AAD. The account root syncs through Puter and is held in client memory during use, so **Puter is not cryptographically excluded from basic-mode decryption**. Missing keys are not silently regenerated over an existing cloud note tree. No persistent local key fingerprint or offline recovery copy is kept.

AtlasEncrypt uses a random 256-bit per-note key wrapped by a 4–16 printable ASCII PIN with Argon2id (96 MiB, four passes, parallelism 1) and note-bound HKDF. Plaintext PINs and unwrapped secure content keys are not uploaded. Encrypted titles use the account root and remain visible/searchable after sign-in. Unlocked content keys (not PINs) are cached in account/session/note-bound sessionStorage; explicit note lock and successful logout clear them. Reloads retain them, and browser session restoration may preserve them after closing a tab. Weak PINs can be guessed offline. Compromised devices, scripts or malicious client updates remain risks; no independent cryptographic audit is claimed.

On every app load, AtlasNote automatically and permanently deletes its own legacy localStorage keys, retired note databases (including prior account caches), and app-shell caches, without confirmation, migration, or upload. This also runs while signed out. If an old tab blocks deletion, close the old tab to let deletion finish. Cleanup does not clear unrelated sites' browser data, Puter sign-in, the main Puter namespace, or tab unlock data. No original local-only notes are uploaded. Browser deletion is not a guarantee of physical secure erasure or removal of external backups.

## Limits and deployment

The original image safeguards remain: 100 MB source files, 67.1 MP decoded images, 8192 px dimensions and 16 MB stored images. These are memory safeguards, not paid plans. Whole-file JSON parsing is not a guarantee of multi-GB import success.

Puter's app identity defines the cloud namespace. Production access is restricted to the exact canonical hostname; alternate hostnames are not authorized to read, write, or share the app namespace. No broad filesystem, mailbox or public-file sharing permissions are requested. The service worker is unregistered and app-shell caches are cleared by the current migration.

### Canonical-domain security headers

`edgeone.json` and `_headers` define the response policy for `atlasnote.nxlabtw.com` and every path on that host, including worker scripts. EdgeOne middleware performs hostname rejection; header files themselves are path rules and cannot restrict domain bindings. Remove obsolete secondary domain bindings at the hosting provider. Render does not execute the EdgeOne middleware: any retained Render deployment needs its own host restriction; the browser and SDK guards still reject noncanonical origins. The local test server reads `edgeone.json`, omitting HTTPS upgrade/HSTS only because it listens on HTTP loopback. No wildcard CORS is enabled.

- CSP defaults to denying resources. Own-origin files use `'self'`; only the official Puter SDK, API/subdomain connections and authentication frame are allowlisted. Inline scripts, event handlers, JavaScript eval, plugins, foreign base URLs and embedding AtlasNote in frames are blocked. WebAssembly compilation remains allowed for the PIN derivation worker; the code does not require arbitrary JavaScript eval. Raw Markdown HTML and remote Markdown images remain disabled.
- `X-Frame-Options: DENY`, `nosniff`, no-referrer, same-origin resource policy, origin-keyed agent clusters and restrictive feature permissions provide additional boundaries. Clipboard writing remains available for Copy Content; unused device/sensor permissions are denied.
- `Cross-Origin-Opener-Policy: same-origin-allow-popups` intentionally preserves Puter authorization-window communication. COEP is not forced, since unverified cross-origin isolation can break the external SDK. HSTS lasts one year without forcing policies onto unrelated subdomains or preloading an arbitrary domain.
- HTTPS, correct MIME types and host-level delivery of these headers are deployment requirements. EdgeOne's own CAPTCHA/error responses may be generated before site-level rules; verify application responses separately. Headers do not eliminate compromised clients, trusted SDK supply-chain risks, provider incidents or the need for security review.

Run `node tools/security-headers.test.mjs` with the local preview running to check policy parity, error/worker responses and browser enforcement at the canonical hostname. The test exercises real WebCrypto/Argon2 with synthetic notes and blocks malicious scripts, connections, base changes and iframe embedding. `node tools/host-gate.test.mjs` confirms another hostname cannot access Puter or trigger local-data cleanup. Neither test authenticates a real Puter account.

For Puter account, billing, allowance or service incidents use Puter support. For AtlasNote code/UI bugs contact atlasnote@nxlabtw.com. No guarantee is made that a third party compensates losses; applicable non-waivable rights remain.

## Verification

With the local server running, `npm test` runs isolated Puter-contract cloud tests, image/drawing/version/trash interactions, compression tests, legacy cleanup and checks that note-file transfer functions, controls and instructions are absent. `npm run test:puter-login` opens the real official SDK/login window **without** entering credentials. Browser scripts currently use the bundled local Playwright runtime path; adapt that path on other machines.

Cloud QA covers separate devices, account isolation, real WebCrypto/Argon2, incorrect PIN, concurrent edits, conflict resolution, AI preview/confirmation and selected-image commands, tab-key cache reuse/locking/account isolation, connection-loss locking and in-memory unsaved-draft restoration, four languages/two themes/eight viewport sizes. Tests use synthetic data; they are not evidence that every provider-side behavior has been verified against a real account.

`tools/cloud-integrity.test.mjs` injects cold-load and background throttling, verifies byte-for-byte preservation of remote files, exercises concurrent saves, failed-save retry and reconnect retention. `tools/cloud-requests.test.mjs` checks the queue's concurrency, rolling budgets and bounded retry behavior. Passing these tests does not establish the cause of an earlier production loss or recover missing provider files.

`/cloud-check.html` is a standalone, no-index incident-support page. It reads only AtlasNote folder names and change records, reports active/deletion/conflict counts, and checks key-file presence without reading it. It never initializes an account, opens snapshots, decrypts content, runs local cleanup, or writes/deletes cloud files. It uses the existing Puter sign-in; if signed out, open AtlasNote and sign in first. Incomplete scans show an error rather than partial counts. This is an inspection aid, not automatic recovery or proof of provider-side erasure. `tools/cloud-audit.test.mjs` verifies these read-only boundaries with disposable synthetic records.

Original software and branding: all rights reserved by NXLabTW. Third-party licenses remain in NOTICE and vendor directories. Contact: atlasnote@nxlabtw.com.

## Copyright and source visibility

Copyright (c) 2026 NXLabTW. All rights reserved. Original AtlasNote code uses the proprietary terms in LICENSE, not an open-source license. Public GitHub visibility permits viewing and platform-supported forking under GitHub's Terms of Service; it does not grant general reuse, redistribution or commercial rights to original code. Third-party components retain their own licenses.
