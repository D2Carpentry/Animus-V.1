# Mobile workspace 0.5.0

## Scope

- Remove mobile desktop-CRM navigation. Google Calendar remains an intentional external integration.
- Add mobile workfile creation and customer/status/date editing, revenue editing, and price CRUD.
- Reuse the canonical estimate engine, calculation code, warranties, and customer PDF exporter through a generated mobile presentation. No edits to desktop CRM or estimator source.
- Save estimate, invoice, supplement, and work-order PDFs to private R2 document objects and attach their canonical authenticated URLs to the selected workfile.
- Preserve customer identity when importing document contents. Invoices do not replace original editable estimates. Supplements append separately.

## Persistence and access

`/api/mobile-workspace` is covered by the existing API middleware and independently requires its verified administrator identity. It reads `dashboard/latest.json`, applies one targeted operation, and uses the R2 ETag condition to prevent conflicting replacement. It does not use the inactive D1 CRM or import browser snapshots.

Touched-field comparisons reject stale edits. Creation identifiers make retries idempotent, with changed-payload replays rejected. Document replay hashes include both editable data and PDF bytes. New file numbers advance above existing, reserved/deleted, and high-water numbers. Receipt totals for a newly linked revenue row come from a fresh canonical receipt read, never the submitted phone snapshot.

The shared editor uses session memory instead of browser localStorage. It supports editable import/export, private cloud save, native PDF sharing, and navigation confirmation for unsaved changes. Failed saves retain the open form. Leaving/reloading without saving can still discard RAM-only drafts; export an editable copy or save before closing. PDF-only existing attachments cannot supply missing editable line items and require confirmation before replacement.

## Verification

- 110 automated tests pass, including 11 new targeted-operation, stale-edit, retry, document, and privacy checks.
- Synthetic browser workflows: new workfile, estimate save and linked revenue creation, invoice prefill, paid/balance calculation, work-order save, price add, revenue labor edit and net recalculation.
- No page-level overflow observed for revenue at 320, 360, 390, 430, and 768 pixels; estimator and work-order controls checked at 320 and 390 pixels.
- A real generated invoice PDF was rendered and visually inspected; $1,200 total less $200 paid produced $1,000 balance.
- Android assembleDebug and lintDebug passed. Same signing certificate as 0.4.0; versionCode 6.
- APK SHA-256: `e774935c91e0ddbb0bf34457c7a1c7c3ca14666405089627745e70d128abda55`.

Physical-device camera, Android sharing targets, and live owner-authorized writes require the owner's device check after installation. Synthetic testing did not modify any live customer records. This release does not enable remote push delivery or OTA code updates.
