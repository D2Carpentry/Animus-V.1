# ANIMUS Android

Android app reusing the existing ANIMUS mobile interface and canonical cloud operations. Default builds remain isolated previews. Version 0.4.0 adds an explicitly selected internal live test build; real-device verification is still required before general release.

## What exists

- October 17: owner-only authentication is deployed over production CRM APIs and static documents. Browser sign-in uses an HttpOnly session; the scheduled backup service has signed backup-only access. See [the rollout record](security/LIVE-ROLLOUT-2026-10-17.md).
- Version 0.4.0 internal live builds require both `ANIMUS_LIVE_CLOUD=1` and `ANIMUS_INTERNAL_LIVE_TEST=1`, then run network preflight against deployed access restrictions and backup connectivity. An environment assertion alone cannot enable them. The installed app verifies the owner before using the canonical cloud operations.
- Remote push notifications are not connected yet. Local reminders remain available. Live calendar views read the current CRM schedule; preview-only appointment editing is not a live Google Calendar synchronization feature.

The following entries describe earlier isolated preview versions:

- The separate `/auth-preview/` page tests real Google sign-in in a browser and
  the same administrator verifier, without loading CRM data. Source is in
  `web-sign-in/`; run `npm run build:web-sign-in` to regenerate the standalone
  page. This does not replace or gate the current desktop CRM.

- Version 0.3.1 connects the Account panel to the deployed administrator verifier
  and adds Verify administrator access for an already-signed-in owner. No customer
  data is connected. The owner confirmed successful phone verification on
  October 16, 2026 after the server certificate-fetch compatibility fix.
- `security/` contains the API/static guards, session transport, tests, and rollout inventory. The October 17 record supersedes earlier staging-only checklist entries.
- Version 0.3.0 adds Account and sign-in in App settings. Google authentication runs
  only in the configured installed Android app. Browser previews do not simulate
  sign-in. The separate `auth-worker` verifies server-side administrator identity
  with a pinned Firebase UID and verified Google email.
  Signing in does not unlock customer records; this build still uses test records.

- Version 0.2.0 adds an in-app Agenda, Month, and Day calendar with workfile dates, search, appointment-type filters, event details, phone/maps/workfile actions, and reminder shortcuts. Calendar navigation no longer leaves ANIMUS. The separate Google button is an external shortcut, not an automatic sync connection.
- Preview appointments can be created, edited, and deleted without modifying workfile dates or contacting the live CRM. Source workfile/cloud events remain read-only until a reviewed scheduling API is available. Appointments and test records reset when the preview restarts.

- Capacitor Android project with a bundled, locally loaded mobile interface (not a remote website with unrestricted native access).
- Camera and gallery return photos to the existing receipt or work-photo review workflow before upload. Camera activity restoration preserves the original workfile binding.
- Android Back closes dialogs or returns to Files, with an unsaved-form warning.
- Offline indicator; no automatic offline writes or stale dashboard uploads.
- Native sharing of attached PDF files and contact cards, external links, local reminders, notification permission controls, and test notification.
- Firebase push registration, notification channels, workfile routing, and Android Keystore-encrypted device credentials.
- Separate Cloudflare notification service with expiring one-use pairing codes, authenticated registration, server-only Firebase credentials, device revocation, and FCM sending.
- Default build uses dummy records and blocks calls to the live CRM APIs. Preview edits reset on restart. Receipt AI is deliberately not contacted in preview; enter amounts manually.
- Four clearly marked sample PDFs are bundled for testing estimate, supplement, invoice, and work-order sharing. They are not real customer documents.

## Not yet enabled

The Firebase project and Android app are registered and Google sign-in is enabled.
The matching configuration is installed locally but excluded from Git; another
build machine must supply it. Google sign-in has been confirmed by the owner on
Android and matched in Firebase. Actual-device server-side administrator
verification, production CRM authentication/security review, release signing,
Google Play distribution and automatic CRM-event triggers remain unfinished.
The authentication service is deployed without customer-data bindings. The
notification service is source code, not deployed.
A notification is only reported connected after its token is confirmed by the
server. This is not a production release yet.

## Build

Install Node 22+, Android Studio with its JDK and Android SDK, then:

```sh
npm ci
npm run android:sync
npm run android:open
```

Android Studio can run the app on a connected Android phone or emulator. For a locally installable preview APK:

```sh
npm run android:apk
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`. This uses a debug signing key and is for testing only, not Google Play. Keep a future release signing key backed up securely and out of Git.

Browser preview: `npm run build` then `npm run preview`, open http://127.0.0.1:8792. Native features need the installed Android app.

## Firebase setup, with guidance

1. Create a Firebase project in https://console.firebase.google.com/. Register Android package `com.animuscrm.app`.
2. Download `google-services.json` into `android/app/`. It is excluded from Git. No Firebase billing upgrade is inherently required solely for FCM; review any other enabled services separately.
3. Create the separate Cloudflare D1 notification database. Replace the placeholder ID in `push-worker/wrangler.jsonc`, apply `migrations/0001_devices.sql`, then deploy this worker. Do not bind it to the CRM data bucket.
4. Add `ADMIN_KEY` and `FCM_SERVICE_ACCOUNT` as worker secrets. Service-account credentials stay server-side. Do not paste them into this app, browser, or repository.
5. Build with `ANIMUS_PUSH_URL=https://your-notification-worker.example`. The packaged UI detects the Firebase file. Send an authenticated POST to `/admin/pairing-codes`, then enter the resulting five-minute code under Notifications on the phone.
6. Test `/admin/send` with that paired device ID and `type: "test"`. Test foreground, background, dismissed app, denied permission, revoked device, and expired pairing code. Remote delivery requires internet and is subject to Android notification and battery settings.

The app can schedule local reminders without Firebase. Reminder delivery is best effort, not an exact-alarm guarantee. Reboot rescheduling is provided by the local-notifications plugin. Uninstalling clears reminders and app-only preferences.

Dependency audit at creation: zero production dependency advisories. The Capacitor CLI has three moderate development-only advisories through its Xcode tooling dependency; npm reports no upstream fix. That tooling is not bundled into the Android app. Recheck the audit before release.

## Live release gate

`ANIMUS_SECURITY_REVIEWED=YES` does not enable live builds. Internal live testing requires the explicit flags above and successful deployed preflight checks. General release still requires actual-device persistence, uploads, private document sharing, and account-switch tests. An app-only login does not protect anonymous alternate routes; production APIs, static documents, historical deployments and private bucket access were addressed together.

No admin API key is shipped to the phone. Notifications do not modify workfiles. Adding automatic lead/payment/estimate-view notifications later must happen only after confirmed server-side events, not from client guesses. Store minimal notification text to avoid customer details on a locked phone.

## Feature boundaries

This initial app preserves current mobile workfiles, notes, receipt review, manual total adjustment, paid/balance editing, revenue, and photos. In a reviewed live build, estimator, price database, and other desktop-only tools open securely outside the native bridge for now. In the isolated preview these links are blocked so testing cannot accidentally open the live CRM. They are not yet native mobile screens. Attached PDFs use Android sharing; generating a new PDF from an editable estimate still uses the existing web workflow and requires further device work. The app does not claim to fully replace every desktop workflow.

## Sources

- https://capacitorjs.com/docs
- https://capacitorjs.com/docs/apis/camera
- https://capacitorjs.com/docs/apis/push-notifications
- https://capacitorjs.com/docs/apis/local-notifications
- https://firebase.google.com/docs/cloud-messaging/send/v1-api
