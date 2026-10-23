/* ═══════════════════════════════════════════════════════════════
   sono-push-sw.js — SW RIÊNG cho THÔNG BÁO ĐẨY của Sổ Nợ + Bán hàng
   • Đặt CẠNH index.html trong repo SO---NO (cùng thư mục với sw.js).
   • KHÔNG thay sw.js: file này chạy ở phạm vi riêng ./sono-push/ nên
     không đụng bộ nhớ đệm / cập nhật bản mới của sw.js.
   • Nhận tin đẩy từ máy chủ (Cloud Functions) ⇒ hiện thông báo kể cả
     khi app đã TẮT HẲN. Bấm thông báo ⇒ mở / đưa app lên trước.
   • [v2 2026-10-23] REO NHẮC ĐƠN như chuông điện thoại: máy chủ
     "chuongdon" gửi lại thông báo của đơn (cùng tag, cờ lap='1') tới
     khi có người nhận đơn (tối đa 8 phút). Trên máy này:
       – app đang tắt / chạy nền ⇒ KÊU LẠI;
       – app đang mở trên màn hình, hoặc đơn đã "tắt chuông" trên máy
         này (bấm "Đã nghe" / "Xem đơn" trong app · bấm vào thông báo ·
         vuốt bỏ thông báo) ⇒ KHÔNG kêu, chỉ cập nhật chữ (hoặc thôi hiện).
     Tin không có cờ lap (đơn mới lần đầu, tin nhắn, nhắc nợ…) y như v1.
   ═══════════════════════════════════════════════════════════════ */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(Promise.resolve()); });

function gocApp(){
  /* .../SO---NO/sono-push/  ⇒  .../SO---NO/ */
  return String(self.registration.scope || '').replace(/sono-push\/?$/, '');
}

/* ───── [v2] ĐƠN ĐÃ "TẮT CHUÔNG" TRÊN MÁY NÀY ─────
   Ghi trong Cache Storage 'sn-push-v1' (app ghi được, SW đọc được), nhớ 1 ngày.
   sw.js chỉ xoá cache có tên đuôi "-<phạm vi>" nên không đụng kho này. */
var KHO_IM  = 'sn-push-v1';
var HAN_IM  = 86400000;
var DONG_TU = {};          /* tag SW tự đóng trên máy Apple ⇒ không tính là người dùng vuốt bỏ */
function khoaIm(tag){ return String(self.registration.scope || '') + 'im/' + encodeURIComponent(String(tag)); }
function docIm(c, k){ return c.match(k).then(function(r){ return r ? r.text() : ''; }).then(function(t){ return Number(t) || 0; }); }
function daIm(tag){
  try{
    if(!self.caches) return Promise.resolve(false);
    return caches.open(KHO_IM).then(function(c){ return docIm(c, khoaIm(tag)); })
      .then(function(x){ return x > 0 && Date.now() - x < HAN_IM; }, function(){ return false; });
  }catch(e){ return Promise.resolve(false); }
}
function danhDauIm(tag){
  try{
    if(!self.caches) return Promise.resolve();
    var bay = Date.now();
    return caches.open(KHO_IM).then(function(c){
      return c.put(khoaIm(tag), new Response(String(bay))).then(function(){
        return c.keys().then(function(ks){                     /* dọn đơn quá 1 ngày */
          return Promise.all(ks.map(function(k){
            return docIm(c, k).then(function(x){ if(!(x > 0 && bay - x < HAN_IM)) return c.delete(k); }, function(){});
          }));
        });
      });
    }).then(function(){}, function(){});
  }catch(e){ return Promise.resolve(); }
}

/* ───── [v2] REO NHẮC ĐƠN (tin có cờ lap='1') ───── */
function appDangXem(){
  try{
    var goc = gocApp().toLowerCase();                           /* GitHub Pages: SO---NO hay so---no đều là 1 app */
    return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(ds){
      for(var i = 0; i < ds.length; i++){
        var c = ds[i], u = String(c.url || '').toLowerCase();
        if(u.indexOf(goc) === 0 && !/\/(menu|cuahang|shop)\.html/.test(u) && u.indexOf('/sono-push/') < 0
           && (c.visibilityState === 'visible' || c.focused === true)) return true;
      }
      return false;
    }, function(){ return false; });
  }catch(e){ return Promise.resolve(false); }
}
function dsThongBao(){
  try{ return Promise.resolve(self.registration.getNotifications()).then(function(ds){ return ds || []; }, function(){ return null; }); }
  catch(e){ return Promise.resolve(null); }
}
function uaMay(){ try{ return String((self.navigator && self.navigator.userAgent) || ''); }catch(e){ return ''; } }
function laChromium(){ return /Chrome\/|Chromium\//.test(uaMay()); }
function laApple(){ var u = uaMay(); return /AppleWebKit/.test(u) && !/Chrome\/|Chromium\/|Android/.test(u); }
function hien(title, opt){ return self.registration.showNotification(title, opt); }
function hienIm(title, opt){                                    /* cập nhật chữ, KHÔNG kêu, không rung */
  var o = {}, k;
  for(k in opt) if(Object.prototype.hasOwnProperty.call(opt, k)) o[k] = opt[k];
  o.renotify = false; o.silent = true; delete o.vibrate;
  return hien(title, o).then(null, function(){ return hien(title, opt); });
}
/* iPhone / máy Mac (Safari) chưa biết THAY thông báo cùng tag ⇒ tự đóng cái cũ rồi mới hiện cái mới (khỏi chồng cả chục cái) */
function dongCu(tag, ds){
  if(!ds || !laApple()) return;
  for(var i = 0; i < ds.length; i++){
    var x = ds[i];
    if(x && x.tag === tag){ DONG_TU[tag] = Date.now(); try{ x.close(); }catch(e){} }
  }
}
function reoLai(title, opt){
  var tag = opt.tag;
  return Promise.all([daIm(tag), appDangXem(), dsThongBao()]).then(function(kq){
    var im = kq[0], xem = kq[1], ds = kq[2], con = false, khac = false;
    if(ds) for(var i = 0; i < ds.length; i++){ if(!ds[i]) continue; if(ds[i].tag === tag) con = true; else khac = true; }
    if(!im && !xem){ dongCu(tag, ds); return hien(title, opt); }    /* app tắt / chạy nền ⇒ KÊU LẠI */
    /* Đã bấm / vuốt bỏ thông báo này: Chrome cho phép không hiện lại khi app đang mở trên màn hình
       hoặc máy còn thông báo khác của Sổ Nợ. Safari / Firefox thì tin nào cũng phải hiện ⇒ hiện lặng lẽ. */
    if(ds && !con && (xem || khac) && laChromium()) return;
    dongCu(tag, ds);
    return hienIm(title, opt);
  }).then(null, function(){ return hien(title, opt); });
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
  if(d.lap === '1' && opt.tag){ e.waitUntil(reoLai(title, opt)); return; }   /* [v2] máy chủ chuongdon reo nhắc đơn */
  e.waitUntil(self.registration.showNotification(title, opt));
});

self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var goc = gocApp();
  var url = (e.notification.data && e.notification.data.url) || goc;
  if(e.notification.tag) e.waitUntil(danhDauIm(e.notification.tag));   /* [v2] bấm vào thông báo ⇒ máy này thôi reo nhắc đơn đó */
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

/* [v2] Vuốt bỏ / bấm ✕ thông báo ⇒ máy này thôi reo nhắc đơn đó (SW tự đóng trên máy Apple thì không tính) */
self.addEventListener('notificationclose', function(e){
  var tag = e.notification && e.notification.tag;
  if(!tag || (DONG_TU[tag] && Date.now() - DONG_TU[tag] < 10000)) return;
  e.waitUntil(danhDauIm(tag));
});
