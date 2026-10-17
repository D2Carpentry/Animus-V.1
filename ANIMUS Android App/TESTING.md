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

## Google Sign-In Preview 0.3.0

- Install the APK on an Android phone with Google Play services.
- App settings > Account and sign-in > Continue with Google.
- Choose d2carpentryanddesign@gmail.com yourself. Do not send passwords or codes.
- Verify that the account email and Account ID appear. No customer records should
  appear: authentication testing stays separate from the preview data transport.
- Cancel account selection, deny prompts, switch accounts, disconnect the network,
  sign out, then restart. Never interpret local identity as a server admin grant.
- Browser preview intentionally disables Google sign-in. It must not manufacture
  an authenticated user.
- In 0.3.1 the owner UID is verified in Firebase and pinned server-side. After
  installing the update, use Account and sign-in > Verify administrator access.
  Check for Administrator verified and the explicit test-records-only status.
- Owner reported successful Administrator verified status on October 16, 2026.
  This confirms the identity step, not access to live CRM data.

## Staged API Access

- `security/api-access.mjs` is not mounted or deployed on live CRM routes.
- Sixty-one automated tests pass, including API denial before handler access,
  allowlisted CORS, private media responses, audit-header replacement, preserved
  conflicts, and canonical synthetic note save/read-back without altering another
  file or its financial data.
- Prepared authenticated-client tests also cover token-origin restrictions,
  expired/sign-out sessions, account changes during refresh, no automatic write
  retry, intact conflict responses, bounded media and sign-out during downloads.
  This client is not yet connected to live desktop/mobile callers.
- No live customer read/write test was performed. Desktop login, backup identity,
  account revocation and staging deployment tests remain required before rollout.

## Live Rollout Preparation - October 17, 2026

- Current cloud snapshot copied read-only to a separate local recovery directory
  and verified by SHA-256 read-back. No cloud writes or restores were performed.
- Staged live verifier now checks signed identity followed by Google's current
  account status on every request. Tests cover disabled, deleted, revoked,
  mismatched and unverified accounts, missing configuration, malformed responses,
  redirects, provider errors and network outages. Denials never reach handlers.
- These new tests use synthetic signed identities and stub Google account lookup;
  they are not evidence of a commissioned live account-status integration.
- Live API enforcement, all desktop/mobile callers, private document handling,
  backup-only service authentication and realistic 54 MB snapshot staging tests
  remain required before enabling the Android live build.

## Browser Identity Test - October 17, 2026

- ANIMUS Web registered without Firebase Hosting or billing changes.
- Exact `animus-v-1.pages.dev` domain authorized for Google sign-in.
- Verifier deployed with exact desktop/Android origins. Live smoke: both allowed
  origins receive 204 preflight; unrelated origin receives 403; anonymous desktop
  request receives 401. Same administrator identity remains pinned.
- SDK adapter initializes in-memory persistence, projects only public user fields,
  sanitizes OAuth errors and prevents a late response restoring a signed-out grant.
- Layout checked at 1366x900, 390x844 and 320x568: no horizontal overflow, logo
  renders, primary controls are 48px tall. Screenshots saved for desktop/mobile.
- Browser build includes app/auth only, not Firestore, gRPC or analytics. No CRM
  endpoint is called from this page. Production dependency audit has zero findings;
  existing iOS build-tool development dependencies have three moderate findings.
- Real Google sign-in on the deployed page in Brave verified the approved company
  administrator server-side twice. Sign-out cleared the grant; refreshing after
  the second successful sign-in returned to Signed out, as expected with in-memory
  persistence. No customer records were read or modified during these tests.
- Before live rollout, protect all canonical API and document routes, check
  revocation and expiry, and regression-test desktop login and saving. The pinned
  owner identity and deployed verifier do not yet protect the live CRM API.
