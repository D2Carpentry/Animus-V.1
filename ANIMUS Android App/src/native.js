import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { createIcons, Bell, Settings, Share2, X, ArrowLeft, Camera as CameraIcon, ImagePlus } from 'lucide';
import { createDemoTransport } from './demo.js';
import { safeExternalUrl, routeFromNotification, safeFilename, nextReminder } from './policy.js';
import {mountCalendar,calendarIcons} from './calendar.js';
import {localDateKey,eventDate} from './calendar-model.js';

const native = Capacitor.isNativePlatform();
const config = window.ANIMUS_APP_CONFIG || {demo:true};
const originalFetch = window.fetch.bind(window);
const demoFetch = createDemoTransport();
const SecureStorage = registerPlugin('AnimusSecureStorage');
let captureBusy = false;
let pendingRestore = null;
let pushReady = false;
let foregroundNotifications = [];
let dismissConfirmation = null;
const $ = id => document.getElementById(id);
const icons = () => createIcons({icons:{...calendarIcons,Bell,Settings,Share2,X,ArrowLeft,Camera:CameraIcon,ImagePlus}});

// Only the packaged preview uses this transport. The production website is untouched.
if (config.demo) window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href);
  if (url.origin === location.origin || ['data:','blob:'].includes(url.protocol)) return originalFetch(input, init);
  return demoFetch(input, init);
};

function message(text) {
  const toast = $('nativeToast');
  if (!toast) return;
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(message.timer);
  message.timer = setTimeout(() => toast.hidden = true, 6000);
}
function cancelled(error) { return /cancel|dismiss|no image/i.test(error?.message || String(error)); }
async function guard(task) { try { return await task(); } catch(error) { if (!cancelled(error)) message(error.message || 'The action could not be completed. Please try again.'); } }
function confirmAction({title,description,confirmLabel='Continue',danger=false}) {
  const dialog=$('nativeConfirm');
  if(dialog.open)return Promise.resolve(false);
  dialog.innerHTML='<h2 id="nativeConfirmTitle"></h2><p id="nativeConfirmDescription"></p><footer><button type="button" id="nativeConfirmCancel">Cancel</button><button type="button" id="nativeConfirmProceed"></button></footer>';
  $('nativeConfirmTitle').textContent=title;$('nativeConfirmDescription').textContent=description;
  $('nativeConfirmProceed').textContent=confirmLabel;$('nativeConfirmProceed').className=danger?'danger':'primary-action';
  return new Promise(resolve=>{
    const finish=value=>{dialog.close();dismissConfirmation=null;resolve(value);};
    dismissConfirmation=finish;$('nativeConfirmCancel').onclick=()=>finish(false);$('nativeConfirmProceed').onclick=()=>finish(true);
    dialog.oncancel=e=>{e.preventDefault();finish(false);};dialog.onclick=e=>{if(e.target===dialog)finish(false);};
    dialog.showModal();$('nativeConfirmCancel').focus();
  });
}
async function closePanel(force = false) {
  if(force!==true&&window.AnimusCalendar?.hasDraft()&&!await confirmAction({title:'Discard appointment?',description:'Your unsaved changes will be lost.',confirmLabel:'Discard',danger:true}))return;
  $('nativeDialog')?.close();
}
function panel(title, content) {
  const dialog = $('nativeDialog');
  dialog.innerHTML = `<header><h2>${title}</h2><button type="button" id="nativeClose" aria-label="Close"><i data-lucide="x"></i></button></header><div class="native-dialog-body">${content}</div>`;
  $('nativeClose').onclick = closePanel;
  if (!dialog.open) dialog.showModal();
  icons();
}
async function openExternal(value) {
  const url = safeExternalUrl(value);
  if (native && url.startsWith('https:')) return Browser.open({url});
  if (/^(tel:|sms:|mailto:|geo:|intent:)/.test(url)) { location.href = url; return; }
  window.openOriginal(url, '_blank', 'noopener');
}
function blobBase64(blob) {
  return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(new Error('File could not be prepared.'));r.readAsDataURL(blob);});
}
async function shareFile(url, filename = 'ANIMUS-document.pdf') {
  const safeUrl = new URL(url, location.href);
  if (!['https:','data:','blob:'].includes(safeUrl.protocol)) throw new Error('Unsupported document link.');
  if (safeUrl.protocol === 'data:' && !/^data:(application\/pdf|text\/vcard|text\/x-vcard)/i.test(url)) throw new Error('Unsupported document type.');
  const response = await originalFetch(url);
  if (!response.ok) throw new Error('The document could not be downloaded. Please try again.');
  const blob = await response.blob();
  if (blob.size > 30 * 1024 * 1024) throw new Error('This file is too large to share from the app.');
  if (/\.pdf$/i.test(filename) && new TextDecoder().decode(await blob.slice(0,5).arrayBuffer()) !== '%PDF-') throw new Error('This link did not return a PDF. Open the work file and check its attached document.');
  if (!native) {
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=safeFilename(filename); a.dataset.nativeBypass='true'; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),60000); return;
  }
  const saved = await Filesystem.writeFile({path:`shares/${Date.now()}-${safeFilename(filename)}`,data:await blobBase64(blob),directory:Directory.Cache,recursive:true});
  await Share.share({title:filename,files:[saved.uri],dialogTitle:'Open, save, or share'});
}
window.openOriginal = window.open.bind(window);
window.AnimusNative = {openExternal, shareFile};
window.open = (url, target, features) => {
  if (!native) return window.openOriginal(url,target,features);
  const documentUrl = new URL(String(url), location.href);
  if (documentUrl.origin === location.origin && documentUrl.pathname.endsWith('/mobile-document.html')) {
    if(config.demo) message('No saved estimate PDF is attached to this preview file.');
    else { documentUrl.protocol='https:';documentUrl.host='animus-v-1.pages.dev';guard(()=>openExternal(documentUrl.href)); }
    return null;
  }
  if (/^(data:application\/pdf|blob:)|\.pdf(?:[?#]|$)/i.test(String(url))) guard(()=>shareFile(String(url)));
  else guard(()=>openExternal(String(url)));
  return null;
};

async function selectCapture(workPhoto, library = false) {
  if (captureBusy) return;
  if (!native) {
    $(workPhoto ? (library?'workPhotoUploadInput':'workPhotoCameraInput') : (library?'uploadInput':'cameraInput')).click();
    return;
  }
  const fileId = window.AnimusMobile?.selectedFileId;
  if (!fileId) throw new Error('Select a work file before taking a photo.');
  captureBusy = true;
  await Preferences.set({key:'capture-context',value:JSON.stringify({fileId,workPhoto,at:Date.now()})});
  try {
    const photo = await Camera.getPhoto({quality:85, resultType:CameraResultType.Uri, source:library?CameraSource.Photos:CameraSource.Camera, correctOrientation:true, allowEditing:false, width:1800, height:1800, saveToGallery:false});
    await Preferences.set({key:'captured-photo',value:JSON.stringify({photo,context:{fileId,workPhoto,at:Date.now()}})});
    await acceptPhoto(photo,{fileId,workPhoto});
    await Preferences.remove({key:'capture-context'});
  } catch(error) {
    // Keep the context only when an image was captured but could not be attached for review.
    if (!pendingRestore) await Preferences.remove({key:'capture-context'});
    else showPendingPhoto();
    throw error;
  } finally { captureBusy=false; }
}
async function waitForFile(fileId) {
  for(let attempt=0;attempt<40;attempt++) {
    if (window.AnimusMobile?.openFile(fileId)) return true;
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  return false;
}
async function acceptPhoto(photo, context) {
  if (!photo?.webPath) throw new Error('The camera did not return a photo. Please try again.');
  pendingRestore = {photo,context};
  if (!await waitForFile(context.fileId)) {
    pendingRestore = {photo,context};
    showPendingPhoto();
    throw new Error('The original work file is not available. Your captured photo is waiting for review.');
  }
  const response = await originalFetch(photo.webPath);
  if (!response.ok) throw new Error('The captured photo could not be opened.');
  const blob = await response.blob();
  const file = new File([blob],`ANIMUS-${new Date().toISOString().replace(/[:.]/g,'-')}.${photo.format||'jpeg'}`,{type:blob.type||'image/jpeg'});
  window.AnimusMobile.closeSheet();
  await window.AnimusMobile.acceptCapture(file,context.workPhoto);
  await Preferences.remove({key:'captured-photo'});
  pendingRestore=null;
  $('nativePendingPhoto')?.remove();
}
function showPendingPhoto() {
  if ($('nativePendingPhoto')) return;
  const button=document.createElement('button');button.id='nativePendingPhoto';button.textContent='Review captured photo';button.type='button';
  button.onclick=()=>guard(async()=>{await acceptPhoto(pendingRestore.photo,pendingRestore.context);await Preferences.remove({key:'capture-context'});});
  document.body.append(button);
}

async function scheduleTest() {
  if (!native) { message('Notification delivery can be tested in the installed Android app.'); return; }
  const permission=await LocalNotifications.requestPermissions();
  if(permission.display!=='granted') throw new Error('Notifications are disabled. Enable ANIMUS notifications in Android settings.');
  await LocalNotifications.schedule({notifications:[{id:901,title:'ANIMUS test',body:'Your ANIMUS notifications are working on this phone.',channelId:'animus-updates',isExactNotification:false,schedule:{at:new Date(Date.now()+5000)}}]});
  message('Test notification scheduled. Android may delay delivery to conserve battery.');
}
async function scheduleReminder(form) {
  if (!native) throw new Error('Install the Android app to schedule phone reminders.');
  const at=nextReminder(form.get('date'),form.get('time'));
  const permission=await LocalNotifications.requestPermissions();
  if(permission.display!=='granted') throw new Error('Allow notifications to create a reminder.');
  const id=crypto.getRandomValues(new Uint32Array(1))[0] % 2000000000 + 1000;
  const fileId=form.get('workFileId')||(['detail','expenses'].includes(window.AnimusMobile?.view)?window.AnimusMobile.selectedFileId:'');
  const extra=fileId?{fileId}:{view:'calendar'};
  await LocalNotifications.schedule({notifications:[{id,title:'ANIMUS reminder',body:String(form.get('title')||'Work follow-up').slice(0,150),channelId:'animus-updates',isExactNotification:false,schedule:{at},extra}]});
  closePanel();message('Reminder scheduled on this phone.');
}
function reminderPanel(event = null) {
  panel('New reminder',`<form id="reminderForm"><input type="hidden" name="workFileId"><label>Reminder<input name="title" maxlength="150" required placeholder="Follow up with customer"></label><label>Date<input type="date" name="date" required></label><label>Time<input type="time" name="time" required></label><button class="primary-action" type="submit">Schedule reminder</button></form>`);
  if(event?.start){
    const at=new Date(Math.max(Date.now()+15*60000,eventDate(event.start).getTime()-15*60000));
    const form=$('reminderForm');form.elements.title.value=event.title.slice(0,150);form.elements.workFileId.value=event.fileId||'';form.elements.date.value=localDateKey(at);form.elements.time.value=`${String(at.getHours()).padStart(2,'0')}:${String(at.getMinutes()).padStart(2,'0')}`;
  }
  $('reminderForm').onsubmit=event=>{event.preventDefault();guard(()=>scheduleReminder(new FormData(event.currentTarget)));};
}
async function notificationsPanel() {
  const pending=native?await LocalNotifications.getPending():{notifications:[]};
  const device=await credentials();
  panel('Notifications',`<p id="pushState" role="status">${config.firebaseConfigured&&config.pushUrl?'Remote notifications available to connect.':'Remote notifications need Firebase setup.'}</p><div class="native-setting-actions"><button type="button" id="testNotification">Send test notification</button><button type="button" id="newReminder">New reminder</button>${config.firebaseConfigured&&config.pushUrl?'<form id="pairForm"><label>Device pairing code<input name="code" required autocomplete="off" placeholder="Code from your administrator"></label><button type="submit" class="primary-action">Connect notifications</button></form>':''}</div><h3>Scheduled reminders</h3><div id="reminderList"></div><h3>Received this session</h3><div id="receivedList"></div>`);
  $('testNotification').onclick=()=>guard(scheduleTest);
  $('newReminder').onclick=reminderPanel;
  for(const entry of pending.notifications) {
    if(entry.id===901) continue;
    const row=document.createElement('div');row.className='native-reminder';
    const span=document.createElement('span');span.textContent=`${entry.body} · ${new Date(entry.schedule?.at).toLocaleString()}`;
    const button=document.createElement('button');button.type='button';button.textContent='Cancel';
    button.onclick=()=>guard(async()=>{await LocalNotifications.cancel({notifications:[{id:entry.id}]});row.remove();});row.append(span,button);$('reminderList').append(row);
  }
  if(!$('reminderList').children.length) $('reminderList').textContent='No reminders scheduled.';
  $('receivedList').textContent=foregroundNotifications.map(entry=>entry.title||'ANIMUS update').join('\n')||'No notifications received.';
  if($('pairForm')) $('pairForm').onsubmit=event=>{event.preventDefault();guard(()=>pairPush(new FormData(event.currentTarget).get('code')));};
  if(device&&config.pushUrl){
    const disconnect=document.createElement('button');disconnect.type='button';disconnect.textContent='Disconnect remote notifications';
    disconnect.onclick=()=>guard(async()=>{
      const response=await originalFetch(`${config.pushUrl}/devices/${encodeURIComponent(device.id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${device.secret}`}});
      if(!response.ok)throw new Error('Could not disconnect this phone. Try again when connected.');
      await PushNotifications.unregister();await SecureStorage.remove({key:'push-device'});pushReady=false;await notificationsPanel();message('Remote notifications disconnected.');
    });
    document.querySelector('.native-setting-actions').append(disconnect);
  }
}
async function credentials() { if(!native)return null; const stored=await SecureStorage.get({key:'push-device'});return stored.value?JSON.parse(stored.value):null; }
async function pairPush(code) {
  if(!native||!config.firebaseConfigured||!config.pushUrl) throw new Error('Firebase is not configured in this build.');
  $('pushState').textContent='Connecting...';
  const response=await originalFetch(`${config.pushUrl}/pair`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:String(code).trim()})});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Device pairing failed.');
  await SecureStorage.set({key:'push-device',value:JSON.stringify(result)});
  const permission=await PushNotifications.requestPermissions();
  if(permission.receive!=='granted')throw new Error('Device paired, but Android notification permission was not granted.');
  await PushNotifications.register();
}
async function registerPushToken(value) {
  const device=await credentials();if(!device)return;
  const response=await originalFetch(`${config.pushUrl}/devices/${encodeURIComponent(device.id)}`,{method:'PUT',headers:{'Content-Type':'application/json','Authorization':`Bearer ${device.secret}`},body:JSON.stringify({token:value})});
  if(!response.ok)throw new Error('Notification registration failed. Reconnect from notification settings.');
  pushReady=true;if($('pushState'))$('pushState').textContent='Remote notifications connected.';
}
async function handleNotification(data) {
  const route=routeFromNotification(data);
  if(!route)return;
  if(window.AnimusMobile?.hasDraft){message('Finish your current edit, then open the work file from Files.');return;}
  closePanel();
  if(route.fileId&&window.AnimusMobile) await window.AnimusMobile.refresh();
  if(route.fileId&&!await waitForFile(route.fileId))message('That work file is unavailable. Refresh the file list and try again.');
  else if(!route.fileId)window.AnimusMobile?.openView(route.view);
}
function settingsPanel() {
  panel('App settings',`<p>${config.demo?'Isolated preview. Test records reset when the app restarts.':'Live cloud connection. Records remain in ANIMUS cloud.'}</p><div class="native-setting-actions"><button type="button" id="notificationSettings">Notifications and reminders</button><button type="button" id="shareApp">Share ANIMUS link</button></div><p class="native-meta">ANIMUS Android ${config.version}<br>${pushReady?'Remote notifications connected':'Remote notifications not connected'}</p>`);
  $('notificationSettings').onclick=()=>guard(notificationsPanel);
  $('shareApp').onclick=()=>guard(async()=>native?Share.share({title:'ANIMUS',text:'ANIMUS Field CRM',url:'https://animus-v-1.pages.dev/mobile-cloud'}):navigator.clipboard.writeText('https://animus-v-1.pages.dev/mobile-cloud'));
}
async function initialize() {
  document.body.classList.add('native-app');
  document.body.insertAdjacentHTML('beforeend','<dialog id="nativeDialog" aria-modal="true"></dialog><dialog id="nativeConfirm" role="alertdialog" aria-labelledby="nativeConfirmTitle" aria-describedby="nativeConfirmDescription"></dialog><div id="nativeToast" role="status" hidden></div>');
  const actions=document.querySelector('.top-actions');
  actions.insertAdjacentHTML('beforeend','<button type="button" id="nativeNotifications" aria-label="Notifications" title="Notifications"><i data-lucide="bell"></i></button><button type="button" id="nativeSettings" aria-label="App settings" title="App settings"><i data-lucide="settings"></i></button>');
  $('nativeNotifications').onclick=()=>guard(notificationsPanel);$('nativeSettings').onclick=settingsPanel;
  $('nativeDialog').addEventListener('click',event=>{if(event.target===$('nativeDialog'))closePanel();});
  $('nativeDialog').addEventListener('cancel',event=>{event.preventDefault();closePanel();});
  window.AnimusCalendar=mountCalendar({demo:config.demo,panel,closePanel,message,reminder:reminderPanel,openExternal,confirmAction});
  const banner=document.createElement('div');banner.id='nativeEnvironment';banner.textContent=config.demo?'PREVIEW · Test records only':'ANIMUS · Live cloud';document.querySelector('.content').prepend(banner);
  const connection=document.createElement('div');connection.id='nativeConnection';connection.hidden=true;connection.role='status';connection.textContent='Offline. Edits are not uploaded. Keep this screen open and retry when connected.';document.querySelector('.content').prepend(connection);
  document.addEventListener('click',event=>{
    const target=event.target.closest('button,a');if(!target)return;
    const camera=target.id==='detailWorkPhoto'||target.id==='takePhoto'||target.dataset.receiptSource==='camera';
    const library=target.id==='detailPhotoRoll';
    if(native&&(camera||library)) {event.preventDefault();event.stopImmediatePropagation();guard(()=>selectCapture(target.id==='detailWorkPhoto'||library,library));return;}
    if(native&&target.tagName==='A'&&!target.dataset.nativeBypass){
      if(target.download){event.preventDefault();event.stopImmediatePropagation();guard(()=>shareFile(target.href,target.download));}
      else if(target.href&&/^(https:|tel:|sms:|mailto:|geo:)/.test(target.href)){event.preventDefault();event.stopImmediatePropagation();guard(()=>openExternal(target.href));}
    }
  },true);
  icons();
  if(!native)return;
  await guard(()=>StatusBar.setStyle({style:Style.Dark}));
  await guard(()=>SplashScreen.hide());
  const updateConnection=({connected})=>{connection.hidden=connected;};
  updateConnection(await Network.getStatus());
  await Network.addListener('networkStatusChange',updateConnection);
  await LocalNotifications.createChannel({id:'animus-updates',name:'ANIMUS reminders',importance:4,visibility:0});
  await LocalNotifications.addListener('localNotificationActionPerformed',event=>guard(()=>handleNotification(event.notification.extra)));
  await App.addListener('backButton',async()=>{
    if($('nativeConfirm').open){dismissConfirmation?.(false);return;}
    if($('nativeDialog').open){closePanel();return;}
    if(!$('sheet').hidden){if(window.AnimusMobile.hasDraft&&!await confirmAction({title:'Close this form?',description:'Unsaved entries will be lost.',confirmLabel:'Close form',danger:true}))return;window.AnimusMobile.closeSheet();return;}
    if(window.AnimusMobile?.view!=='files'){if(window.AnimusMobile.hasDraft&&!await confirmAction({title:'Leave this screen?',description:'Unsaved entries will be lost.',confirmLabel:'Leave',danger:true}))return;window.AnimusMobile.openView('files');return;}
    await App.minimizeApp();
  });
  await App.addListener('appUrlOpen',event=>{
    try{const url=new URL(event.url);if(url.protocol==='animus:'&&url.hostname==='file')guard(()=>handleNotification({fileId:url.pathname.slice(1)}));}catch{message('The ANIMUS link is invalid.');}
  });
  if(config.firebaseConfigured&&config.pushUrl){
    await PushNotifications.createChannel({id:'animus-updates',name:'ANIMUS updates',importance:4,visibility:0});
    await PushNotifications.addListener('registration',token=>guard(()=>registerPushToken(token.value)));
    await PushNotifications.addListener('registrationError',()=>message('Push registration failed. Reconnect in notification settings.'));
    await PushNotifications.addListener('pushNotificationReceived',entry=>{foregroundNotifications.unshift(entry);foregroundNotifications=foregroundNotifications.slice(0,30);});
    await PushNotifications.addListener('pushNotificationActionPerformed',event=>guard(()=>handleNotification(event.notification.data)));
    const device=await credentials();if(device&&(await PushNotifications.checkPermissions()).receive==='granted')await guard(()=>PushNotifications.register());
  }
  // Camera can restart the activity under memory pressure; recover the original file binding.
  await App.addListener('appRestoredResult',async result=>{
    if(result.pluginId!=='Camera'||result.methodName!=='getPhoto'||!result.success)return;
    const stored=await Preferences.get({key:'capture-context'});if(!stored.value)return;
    const context=JSON.parse(stored.value);if(Date.now()-context.at>86400000)return;
    pendingRestore={photo:result.data,context};
    await Preferences.set({key:'captured-photo',value:JSON.stringify(pendingRestore)});
    await guard(async()=>{await acceptPhoto(result.data,context);await Preferences.remove({key:'capture-context'});});
  });
  const staged=await Preferences.get({key:'captured-photo'});
  if(staged.value&&!pendingRestore){
    const saved=JSON.parse(staged.value);
    if(Date.now()-saved.context.at<86400000){pendingRestore=saved;showPendingPhoto();}
    else await Preferences.remove({key:'captured-photo'});
  }
  const launch=await App.getLaunchUrl();if(launch?.url){const url=new URL(launch.url);if(url.protocol==='animus:'&&url.hostname==='file')guard(()=>handleNotification({fileId:url.pathname.slice(1)}));}
  await Haptics.impact({style:ImpactStyle.Light}).catch(()=>{});
}
document.addEventListener('DOMContentLoaded',()=>guard(initialize),{once:true});
