# D2 Customer Portal

## Sharing

Open a workfile's Estimate tab and choose **Customer Portal**, or use
**Share > Customer Portal** in its estimator. Save estimate changes first.
Choose an expiry and click **Create private link**. Copy or preview the link;
**Email link** opens an email draft for review, it does not send automatically.
The issued-links list allows an administrator to revoke access.

Each link shares an immutable PDF version of the current cloud-saved estimate.
An existing supported PDF attachment is copied unchanged. Otherwise the existing
CRM customer-copy renderer generates its PDF. Unsupported external attachments
must be imported first; they are never silently replaced by a sample.
Create a new link after revising an estimate and revoke the old version as needed.

## Boundaries

- Customer links expire and expose only the intended PDF and greeting.
- The access credential starts in the URL fragment, is removed immediately,
  and is exchanged for a path-scoped, Secure, HttpOnly cookie.
- Server checks apply to every PDF view and download, including revocation.
- An opaque document binding prevents another open tab switching PDFs.
- Customer sessions cannot access administrator APIs or private CRM assets.
- Link creation writes only `portal/links/` and `portal/documents/` in the
  existing private R2 bucket. It never rewrites the dashboard snapshot.
- Approval, messaging, view analytics and customer push notifications are not
  activated by this release. The welcome copy prepares for those future features.

## Implementation

- `client/`: customer welcome, PDF.js viewer and public branding.
- `functions/_portal-service.js`: owner link creation/revocation and capability checks.
- `functions/api/customer-portal.js`: administrator endpoint behind existing API auth.
- `functions/client-access.js`: narrowly scoped customer session/PDF endpoint.
- `customer-portal-admin.js` / `.css`: existing workfile/estimator sharing integration.
- `portal-pdf-renderer-client.js` and generated `portal-estimate-renderer.html`:
  private, read-only adapter around the existing estimator and PDF exporter.
- `ANIMUS Android App/security/pages-html.mjs`: explicit public asset allowlist.
- `scripts/build-customer-portal.mjs`: reproducible static asset build.

The deployment uses the existing `ANIMUS_BUCKET` binding and owner authentication.
No new database schema, billing service or email provider is required.

Private local preview HTML, synthetic preview bundles, customer snapshots and
QA screenshots must not be copied into the deployment checkout.

## Verification

Run `node --test tests/*.test.mjs` from `ANIMUS Android App`.
Portal tests cover authorization, stale estimates, exact attachment reuse,
cross-customer isolation, multiple tabs, expiry, revocation, invalid input,
public asset boundaries and preservation of CRM records.

Browser QA covers 320, 390, 768 and 1440 pixel widths, multi-page rendering,
zoom, download, focus return, repeated opens and page-level overflow.
Positive sharing tests use synthetic storage; no customer link is issued or
sent as part of automated verification.
