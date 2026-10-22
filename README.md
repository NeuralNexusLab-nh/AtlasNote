# AtlasNote · Puter cloud preview

Write it freely, keep it closely.

A buildless notebook with Markdown, images, encryption and Atlas Agent. Puter provides identity, account-owned cloud storage and AI. No AtlasNote backend, developer AI key or shared billing credentials are required.

## Local preview

Run `npm start` with Node 22 or newer, then open http://127.0.0.1:4321. The Node process only serves static files and security headers. Use HTTPS on the production domain, atlasnote.nxlabtw.com. Do not open files through file://.

This is a local integration preview, not an assertion that a real Puter account has passed every cloud operation. The official remote SDK and authorization-window launch have been exercised without credentials; account storage, synchronization and AI tests use a contract double in isolated browser contexts. No original personal notes or accounts are used.

## Features

- Puter login is required for dashboard, notes, editing, trash and settings. Home, docs and policies are public. Online identity is checked on entry, data operations, focus and periodically while visible. Connection failure locks the UI rather than enabling offline use.
- Dashboard with note count, recent notes, account-wide used/remaining storage, and monthly resource allowance. Storage/allowance cards appear only on the dashboard. The right-hand storage value is **remaining**, not total. Allowance is shared across Puter apps, not an Atlas Agent-specific quota. Unknown API values remain unavailable rather than becoming zero.
- Public navigation includes Home and Docs only; installation remains on Home and Settings. The product homepage follows AstraNote's practical notes/images, fast retrieval, private content and Agent positioning, with organization/recovery details. Navbar account actions sit after the language selector; theme stays in Settings. Trashed notes open read-only and can be restored, exported or permanently removed. Eight documentation topics include task steps, diagrams, responsive comparisons and FAQs.
- English, Traditional Chinese, Japanese and lightly transformed l33t. Dark/light themes, responsive menus and reduced-motion support.
- Markdown with raw HTML disabled, no remotely loaded Markdown images, up to three PNG/JPEG/WebP attachments, inline `{img_ID}`, compression, drawing and text annotations.
- Title search, pin/archive, batch operations, configurable trash retention and 0/1/3/5/10/20 reverse text versions (default 3). Restoring text keeps current images.
- No encryption, Basic encryption and Secure encryption (AtlasEncrypt).
- Atlas Agent uses the currently listed GPT-6 Luna model, streams an indeterminate activity indicator, validates JSON, previews title/text and saves only after confirmation. It sends the chosen note's plaintext title/text, prompt and explicitly selected images, never PINs or keys. GPT-6 Luna is an image-input/text-output model: it proposes validated shape/text/crop/rotate/brightness/contrast commands, applied locally, not generative photo editing.
- Single-note JSON export/import. Imports get a new ID and new encryption for the current account. No app-level JSON file-size gate; browser memory, string and Puter constraints still apply.
- Installable PWA with illustrated browser instructions. Application-shell caching does **not** permit offline note access.

## Account isolation and storage

Puter's app-private root contains:

```
atlasnote-v1/
  account.json             # random account root key; do not delete/replace
  notes/<note-id>/<change-id>.json
  blobs/<sha256>.json      # immutable snapshots and image objects
```

The private KV key `atlasnote.retention.v1` holds text-history/trash preferences. Each account's local cache is isolated in IndexedDB `atlasnote-cloud-<uuid>`, with atomic note/outbox/head transactions. Pending cloud failures do not discard saved data. Authorization comes from Puter, not from a frontend “logged in” flag. A different account never adopts another account's cache.

Cloud change files are immutable and published after referenced objects are uploaded. Head ancestry detects concurrent changes; edits stop on conflict until the user reviews/exports and selects a continuation. Cached change metadata avoids re-downloading every old journal entry. Images are separate content-addressed objects, with encrypted image envelopes reused when unchanged. Network retries retain their change IDs.

**Preview limitation:** internal snapshots/journal records have no verified garbage-collection or provider secure-erasure mechanism yet. Removing a note hides it through a synchronized deletion record, but older objects can remain and consume space. This is explicitly disclosed in policies and deletion UI. Do not claim immediate remote erasure or deploy this as a finished retention/space-reclamation service before that work and real-account QA are complete. Text history does not expose image restoration, but internal synchronization data may still retain older image objects.

Do not manually modify app files in Puter. Lost keys or altered sync data can make notes unreadable. Ordinary JSON backups are portable exports, **not** the cloud serialization format; basic exports contain a note decryption key and must not be reused as “secret” storage envelopes.

## Encryption boundaries

Basic mode derives separate AES-256-GCM content/title keys from a random 256-bit account root using HKDF-SHA-256 and note/purpose-bound AAD. The account root syncs through Puter and is held in client memory during use, so **Puter is not cryptographically excluded from basic-mode decryption**. A local non-secret key fingerprint detects missing/replaced cloud keys on previously used devices; missing keys are not silently regenerated over existing cloud notes.

AtlasEncrypt uses a random 256-bit per-note key wrapped by a 4–16 printable ASCII PIN with Argon2id (96 MiB, four passes, parallelism 1) and note-bound HKDF. Plaintext PINs and unwrapped secure content keys are not uploaded. Encrypted titles use the account root and remain visible/searchable after sign-in. Unlocked content keys (not PINs) are cached in account/session/note-bound sessionStorage; explicit note lock and successful logout clear them. Reloads retain them, and browser session restoration may preserve them after closing a tab. Weak PINs can be guessed offline. Compromised devices, scripts or malicious client updates remain risks; no independent cryptographic audit is claimed.

The original `atlasnote-v1` device database and `atlasnote.device-root.v1` localStorage key are preserved. Nothing auto-uploads original notes. Settings offers an explicit single-note copy flow, reads the original data without altering it, and re-encrypts the imported copy. Never test migration against personal data.

## Limits and deployment

The original image safeguards remain: 100 MB source files, 67.1 MP decoded images, 8192 px dimensions and 16 MB stored images. These are memory safeguards, not paid plans. Whole-file JSON parsing is not a guarantee of multi-GB import success.

Puter's app identity defines the cloud namespace. Test localhost separately from the final production origin and verify app registration/origin identity before release. No broad filesystem, mailbox or public-file sharing permissions are requested. SDK access is limited in CSP to official Puter script/API/frame origins. `_headers` is a static-host configuration template; verify its actual application when deploying. The service worker caches only own-origin application assets, not cloud responses, decrypted notes or keys.

For Puter account, billing, allowance or service incidents use Puter support. For AtlasNote code/UI bugs contact atlasnote@nxlabtw.com. No guarantee is made that a third party compensates losses; applicable non-waivable rights remain.

## Verification

With the local server running, `npm test` runs isolated Puter-contract cloud tests, existing image/drawing/version/trash interactions, compression tests and import validation. `npm run test:puter-login` opens the real official SDK/login window **without** entering credentials. Browser scripts currently use the bundled local Playwright runtime path; adapt that path on other machines.

Cloud QA covers separate devices, account isolation, real WebCrypto/Argon2, incorrect PIN, concurrent edits, conflict resolution, AI preview/confirmation and selected-image commands, tab-key cache reuse/locking/account isolation, offline locking and in-memory unsaved-draft restoration, four languages/two themes/eight viewport sizes. A 6 GB import test mocks only file metadata; it is not an actual 6 GB parsing test. Historic local-only test scripts remain for reference and are not evidence of current cloud behavior.

Original software and branding: all rights reserved by NXLabTW. Third-party licenses remain in NOTICE and vendor directories. Contact: atlasnote@nxlabtw.com.
