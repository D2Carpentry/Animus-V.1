# Live rollout record

## Verified before access cutover

- Owner Google sign-in and revocation-aware browser session were verified on the canonical production origin.
- Pages is fail-closed. Historical deployment hosts require the owner Cloudflare Access policy. The R2 bucket is not public.
- Exact duplicate activity cleanup reduced the current snapshot from 53,825,571 to 6,978,791 bytes, removing 767,980 duplicate copies.
- Local structural comparison verified all distinct activity entries and every non-timeline field unchanged. A fresh live download matched every candidate byte after the conditional write.
- Full original cloud recovery object: `dashboard/recovery/2026-10-17-before-exact-activity-compaction.json`. This is outside rolling-backup retention. A private local original and verification reports are retained outside this deployment checkout.
- The repair streamed the original into R2 with SHA-256 validation, checked recovery metadata, and conditionally updated the current object using its original etag. The temporary repair endpoint is removed during cutover.
- No older snapshot or browser data was restored. No customer records were used for test writes.

## Access cutover

- Root middleware protects static CRM assets and documents. API middleware requires the pinned, verified owner identity and checks Google account status and token revocation.
- Same-origin browser sessions use an HttpOnly, Secure, SameSite=Strict cookie. The shared fetch bridge preserves canonical save operations and never automatically replays writes.
- Android source uses the same authenticated APIs; default builds remain isolated previews until live build preflight is commissioned.
- The scheduled worker has a separately signed, short-lived, backup-only request scope. It cannot download records, restore data, or use normal CRM operations.
- Existing tabs require reload and sign-in. An expired session must not be replaced with an older browser snapshot.
- 91 automated tests passed, including denied anonymous access, cookie CSRF protection, backup scope limits, record merge behavior, and concurrent repair cancellation. Real-device camera, notification delivery, and live Android workflows still require device verification.

Deployment success, owner access after cutover, anonymous denial, and backup connectivity must be verified before calling the rollout complete.
