# Authentication rollout

Deployed to `https://animus-app-auth.d2carpentryanddesign.workers.dev`.
No customer data bindings. `/session` validates Firebase
RS256 signatures, project audience/issuer, expiry, issuance/authentication time,
verified Google email and a pinned UID. Set `ADMIN_UID` only after the owner signs
in on Android and the resulting Firebase user is verified in the Firebase console.
Missing configuration denies access. Never infer administrator status from the
email sent by an app or from client-side visibility.

The verified owner's UID is an encrypted Cloudflare runtime setting, not committed
here. No private signing keys are uploaded. Live smoke checks confirm anonymous
and invalid-token requests are rejected, untrusted origins are denied and Android
preflight works. A successful owner-token request still requires the phone test.

`ANIMUS_AUTH_URL` overrides the HTTPS service base URL when building the preview.
Only the installed Android app supports sign-in. A browser preview never simulates
a successful Google login. The native Firebase SDK manages its session; JS does
not put Firebase tokens in localStorage, Preferences, files, logs or URLs.

This verifier is NOT protection for the existing CRM APIs. Those handlers do not
currently verify Firebase identity. Before enabling real customer records, apply
authenticated access consistently to every desktop/mobile API, document/image
download and backup route. Test desktop login and writes before enforcement so
existing staff do not get locked out. Do not leave an anonymous alternate route
to the same records. The app build deliberately refuses all live builds meanwhile.

JWT verification alone accepts an otherwise valid Firebase token until its expiry
(normally up to an hour); account disabling/revocation needs a server-side check
or explicit revocation policy before production. Remove the preview debug signing
fingerprint when preview testing is retired, and register the production/Play
signing certificates for release. This is not a release signing key.

No Firebase service-account private key is required for signature verification.
