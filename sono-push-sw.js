/* ═══════════════════════════════════════════════════════════════
   sono-push-sw.js — SW RIÊNG cho THÔNG BÁO ĐẨY của Sổ Nợ + Bán hàng
   • Đặt CẠNH index.html trong repo SO---NO (cùng thư mục với sw.js).
   • KHÔNG thay sw.js: file này chạy ở phạm vi riêng ./sono-push/ nên
     không đụng bộ nhớ đệm / cập nhật bản mới của sw.js.
   • Nhận tin đẩy từ máy chủ (Cloud Functions) ⇒ hiện thông báo kể cả
     khi app đã TẮT HẲN. Bấm thông báo ⇒ mở / đưa app lên trước.
   ═══════════════════════════════════════════════════════════════ */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(Promise.resolve()); });

function gocApp(){
  /* .../SO---NO/sono-push/  ⇒  .../SO---NO/ */
  return String(self.registration.scope || '').replace(/sono-push\/?$/, '');
}

self.addEventListener('push', function(e){
  var p = {};
  try{ p = e.data ? e.data.json() : {}; }
  catch(_){ try{ p = { data: { body: e.data ? e.data.text() : '' } }; }catch(__){ p = {}; } }
  var d = (p && p.data) ? p.data : (p || {});
  var n = (p && p.notification) ? p.notification : {};
  var title = String(d.title || n.title || 'Sổ Nợ');
  var opt = {
    body: String(d.body || n.body || ''),
    data: { url: String(d.url || '') || gocApp() },
    timestamp: Date.now(),
    vibrate: [200, 100, 200, 100, 300]
  };
  if(d.tag){ opt.tag = String(d.tag); opt.renotify = true; }
  if(d.giu === '1') opt.requireInteraction = true;
  e.waitUntil(self.registration.showNotification(title, opt));
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var goc = gocApp();
  var url = (e.notification.data && e.notification.data.url) || goc;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(ds){
      for(var i = 0; i < ds.length; i++){
        var c = ds[i], u = String(c.url || '');
        if(u.indexOf(goc) === 0 && !/\/(menu|cuahang|shop)\.html/.test(u) && u.indexOf('/sono-push/') < 0 && 'focus' in c){
          return c.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(url) : null;
    })
  );
});
