# ANIMUS Cloud Backup Scheduler

This is a separate Cloudflare Worker, not a replacement for the CRM Pages application.

## Deployment

Connect the existing D2Carpentry/Animus-V.1 repository to a Worker named `animus-weekly-backup`. Set its root directory to `cloud-backup-worker`, production branch to `main`, leave the build command blank, and use `npx wrangler deploy` as the deploy command. No R2 binding or new API credential is required by the Worker code.

The two Sunday UTC triggers are gated by America/New_York time. Exactly one is eligible to run at 3 AM Eastern, including after seasonal clock changes. A routine backup uses the CRM's existing `createCurrentCloudBackup` operation, verifies its success response, and does not restore or upload browser state.

The endpoint retains the new verified dashboard snapshot and the two newest prior snapshots. It never modifies dashboard/latest.json or prunes receipt/photo storage. Worker failures are recorded in Cloudflare logs; this Worker does not send email/SMS notifications.

## Verification

Run `node worker.test.mjs` locally. The `/health` route performs a read-only backup-storage connectivity check; it cannot create or delete data. A temporary `* * * * *` trigger also only checks connectivity and logs `backup-scheduler-smoke-test`. Remove that temporary trigger after a successful test and retain only the two Sunday triggers from wrangler.jsonc.

Do not disable the Codex weekly schedule until the deployed Worker and its production triggers have been verified.
