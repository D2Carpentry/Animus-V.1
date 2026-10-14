const API = 'https://animus-v-1.pages.dev/api/dashboard';

export function isEasternBackupTime(timestamp) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(timestamp));
  return parts.find(part => part.type === 'weekday')?.value === 'Sun' && parts.find(part => part.type === 'hour')?.value === '03';
}

export async function verifyCloudConnection(fetcher = fetch) {
  const response = await fetcher(`${API}?backups=list&limit=3`, { signal: AbortSignal.timeout(60000) });
  const result = await response.json();
  if (!response.ok || result.ok !== true || !Array.isArray(result.backups) || !result.backups.length) throw new Error('Cloud backup storage could not be verified.');
  return { ok: true, backupsAvailable: result.backups.length };
}

export async function runBackup(fetcher = fetch) {
  const response = await fetcher(API, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'createCurrentCloudBackup' }),
    signal: AbortSignal.timeout(180000),
  });
  const result = await response.json();
  if (!response.ok || result.ok !== true || result.verified !== true || !result.backupKey?.startsWith('dashboard/backups/') || !Array.isArray(result.kept) || result.kept.length !== 3 || !result.kept.includes(result.backupKey)) throw new Error('Weekly cloud backup was not confirmed. Check Worker logs and backup list before retrying.');
  console.log(JSON.stringify({ event: 'weekly-backup-verified', backupKey: result.backupKey, copiesKept: result.kept.length, deletedCount: result.deletedCount }));
  return result;
}

export default {
  async scheduled(event) {
    // Temporary commissioning trigger only checks connectivity; it never saves
    // or prunes. Production triggers are 07:00 and 08:00 UTC on Sundays.
    if (event.cron === '* * * * *') {
      console.log(JSON.stringify({ event: 'backup-scheduler-smoke-test', ...await verifyCloudConnection() }));
      return;
    }
    if (!isEasternBackupTime(event.scheduledTime)) return;
    await runBackup();
  },
  async fetch(request) {
    if (new URL(request.url).pathname !== '/health') return new Response('ANIMUS weekly cloud backup scheduler. No public backup trigger.', { status: 200 });
    try { return Response.json(await verifyCloudConnection()); }
    catch { return Response.json({ ok: false, error: 'Cloud backup connection check failed.' }, { status: 503 }); }
  },
};
