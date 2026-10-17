# Preview verification - October 16, 2026

## Calendar update 0.2.0

- 21 automated JavaScript tests pass, including local dates/DST, multi-day/all-day boundaries, stable-key deduplication, search, validation, and isolated appointment CRUD.
- Browser testing confirmed calendar navigation stays inside ANIMUS, workfile links open the right file, invalid time ranges preserve the form, creation and edits update the agenda, and notes are searchable.
- Appointment deletion now uses an in-app confirmation instead of a blocking JavaScript prompt. Cancel preserves the appointment; confirmed deletion removes it from the preview.
- Unsaved appointment confirmation preserves typed values when cancelled. Three-day all-day appointments remain visible on all three dates after the app's Refresh action.
- Month layout has no page overflow at 320/360/390/430/768 pixels; Agenda has no overflow at 320/390/768 pixels. Day view provides a scoped vertical time grid.
- Agenda, Month, and Day views are implemented with FullCalendar 6.1.22. Live Google sync and production calendar writes are not enabled.

## Passed

- Android debug APK compilation (JDK 21, SDK 36).
- Android lint. The first lint attempt was invalidated by syncing generated assets during lint; it was rerun after sync and passed.
- APK signature verification, v2 signing scheme.
- 14 automated JavaScript tests: isolated data transport, targeted notes and payment edits, receipt ownership, URL routing protections, reminders, default live-data gate, secure-storage configuration, push-service authentication, CORS, single-use and expired codes, token registration/revocation, request-size limits, and mock FCM delivery with a cryptographically verified OAuth assertion.
- Browser UI: added note stayed visible and its workfile stayed open; total paid changed from $2,000 to $3,000 and balance changed from $6,450 to $5,450 without changing the $8,450 estimate.
- Browser UI: selected a photo, reviewed it, and saved it to the dummy workfile. Image rendered without a broken asset.
- Browser UI: uploaded a sample receipt image, manually entered $89.10, saw that total before submission, then verified the saved receipt and expense total.
- Browser layout: no page-level horizontal overflow at 320, 360, 390, 430, and 768 pixels.
- Runtime dependency audit: no production advisories. Three development-only advisories in upstream Capacitor CLI/Xcode tooling remain without an upstream fix.

## Still Required

- Install on a real Android device and test native camera, gallery, permission denial, interrupted camera return, native PDF/contact-card sharing, Back, reminders, offline/reconnection, and process restart.
- Run the Android instrumentation security test on a device/emulator; it is provided but has not been executed.
- Create/configure Firebase, deploy the separate notification worker/database, and verify actual push delivery in foreground, background, and after dismissal.
- Add authenticated per-user CRM access and review roles/conflict handling before a live-data build.
- Wire confirmed CRM server events to push notifications. No automatic lead/payment/estimate-view alerts are active yet.
- Production signing, privacy disclosures, and Google Play testing/release.

The desktop CRM, current customer records, backup retention, and existing cloud API code were not changed for this preview.
