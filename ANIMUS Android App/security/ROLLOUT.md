# CRM Authentication Rollout

Status: preparation only. The API guard in this directory is NOT mounted in
`functions/`, is not deployed to a customer-data service, and does not secure the
existing CRM endpoints yet. Android live builds remain blocked.

The owner confirmed successful administrator verification on the installed
Android preview on October 16, 2026. This verifies identity only.

## Audited Surface

| Route | Existing behavior | Rollout requirement |
| --- | --- | --- |
| `/api/dashboard` | Snapshot reads/writes; backup list, summary, download, restore, creation and retention | Authorize every method and query variant before storage access |
| `/api/expenses` | Expense list/save/delete; receipt image/PDF download by key | Authenticate media retrieval too; private no-store responses |
| `/api/receipt` | Receipt extraction using the server's API key | Authenticate before reading uploads or contacting the extractor |
| `/api/v2/workfiles` | Versioned record CRUD; currently migration-key gated | Replace migration-key authorization with verified server identity before adopting v2 |
| `/api/v2/health` | Database readiness | Keep private during commissioning |
| `/api/v2/verify` | Data verification; migration-key gated | Administrative maintenance only |
| `/api/v2/migrate`, `/api/v2/migrate-chunk`, `/api/v2/migrate-finalize` | Migration-key gated maintenance | Keep separately controlled; no mobile migration permissions |

These findings are based on local source inspection, not an attempted anonymous
download of live customer records. Underscore-prefixed shared modules are not API
routes. Uploaded media and documents can also be embedded within dashboard data.
Audit R2 public access/custom domains before enforcement; API protection cannot
protect a separately public bucket URL.

## Client Dependencies

- Desktop `crm.js` uses dashboard and receipt endpoints directly.
- `expenses-v5.js`, `expenses-v6.js` and `mobile-expenses-v2.js` call expense/receipt APIs.
- `mobile-cloud.js`, `mobile.js`, `mobile-fresh.js`, `mobile-safe.html` and
  `mobile-document.html` are additional cloud readers/callers.
- Browser image/PDF tags and new-window document links cannot attach an
  Authorization header. Convert these to authenticated fetch + short-lived blob
  URLs, or a reviewed authenticated same-site session. Never put tokens in URLs.
- The weekly backup Worker calls dashboard anonymously today, including its
  connectivity health check. Do not enable the guard until it has a narrowly
  scoped authenticated path. No backup credentials are created here.
- Existing open tabs and older Android builds must receive a sign-in/update
  requirement rather than silently failing saves or loading browser snapshots.

## Prepared Guard

`api-access.mjs` is a Pages-style middleware factory, tested without live storage.
It verifies the Firebase signature, project, issuer, expiry, verified Google
email and pinned administrator UID through the existing verifier. There is no
email-only, migration-key, query-token or browser-cache bypass. It covers all
`/api` routes, including unknown future routes, before downstream handlers run.
Mount it only within the API subtree: it deliberately has no pathname-based
authentication bypass, including for encoded or unusual paths.

It preserves existing handler request bodies, status codes and streams. It
replaces the caller's audit header with verified identity, strips bearer tokens
and migration keys before forwarding, and replaces wildcard CORS/public media
cache headers. Trusted CORS origins are the canonical hosted CRM and the installed
Android WebView; other hosting origins require explicit review.

The v2 handlers retain their own migration-key checks and will therefore still
reject the prepared guard's forwarded request. This is intentional: do not ship
the guard over v2 until its authorization integration is implemented and tested.
Do not weaken those checks or insert a privileged migration key to make it work.

## Prepared Client

`src/authenticated-client.js` is also unconnected to live callers. It accepts the
existing native identity-provider shape; the desktop Firebase adapter is still
required. It sends tokens only in headers to the canonical HTTPS API origin,
strips client audit/migration headers, and does not retry failed writes. Existing
conflict/server responses stay intact for the canonical save logic. No tokens,
customer records or write queues are saved in browser storage by this module.

Its PDF/image loader uses authenticated fetch, bounded in-memory downloads and
disposable blob URLs, never URL credentials. Wire `invalidate()` to sign-out and
every identity change before using it in a UI. This aborts in-flight work and
revokes preview URLs. Dispose each document when its viewer closes. This cannot
erase a document a user has deliberately downloaded or already viewed.

Desktop setup is currently blocked by the Firebase console returning an error
when loading the terms-acceptance status for the company account. Reload, account
inspection and the official terms-status workflow did not resolve it. No terms,
IAM grants or new authorized domains were changed to bypass this error.

## Deployment Gates

1. Register/configure browser Google sign-in for the existing Firebase project;
   test the owner's desktop login, sign-out, expiry and retry without live writes.
2. Add the same authenticated request helper to all desktop/mobile callers and
   media/document flows. Preserve drafts when authentication expires.
3. Prepare scheduled backup authentication limited to creating verified backups
   and required metadata checks, not general customer-data reads/writes.
4. Implement a revoked/disabled-account policy. JWT signature verification alone
   is not immediate session revocation. Keep server-side role decisions.
5. Test this guard plus every canonical handler in an isolated staging deployment
   with synthetic records, including conflicts, notes, revenue, receipts, PDFs,
   backups and all alternate URLs. Prove denied calls never reach R2/D1/extraction.
6. Verify the current live backup read-only and preserve a recoverable deployment.
   Obtain approval immediately before changing live access controls.
7. Deploy client login and API enforcement together. Check desktop and phone
   authorization, private media, persistence and scheduled backups. No anonymous
   alternate route may remain open to the same records.
8. Only then remove the Android live-build block and test a release build.

Do not upload `security/api-access.mjs` into `functions/` manually. Do not enable
only a new protected mobile endpoint while leaving equivalent APIs anonymous.
