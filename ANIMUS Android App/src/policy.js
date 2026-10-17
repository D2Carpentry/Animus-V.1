export function safeExternalUrl(value) {
  const url = new URL(value);
  if (!['https:','tel:','sms:','mailto:','geo:','intent:'].includes(url.protocol)) throw new Error('This link type is not allowed.');
  if (url.username || url.password) throw new Error('Links containing credentials are not allowed.');
  if (url.protocol === 'intent:' && !/^intent:\/\/calendar\.google\.com\//.test(value)) throw new Error('Unsupported app link.');
  return url.href;
}
export function safeFilename(value) { return String(value).replace(/[^a-zA-Z0-9 ._-]/g,'_').replace(/^\.+/,'').slice(0,120)||'ANIMUS-document.pdf'; }
export function routeFromNotification(data = {}) {
  if (data.fileId && /^[a-zA-Z0-9_-]{1,160}$/.test(data.fileId)) return {fileId:data.fileId};
  if (['files','expenses','calendar','revenue'].includes(data.view)) return {view:data.view};
  return null;
}
export function nextReminder(date, time, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date||'') || !/^\d{2}:\d{2}$/.test(time||'')) throw new Error('Choose a valid reminder date and time.');
  const at = new Date(`${date}T${time}:00`);
  if (!Number.isFinite(at.getTime()) || at.getTime() <= now) throw new Error('Choose a future date and time.');
  return at;
}
