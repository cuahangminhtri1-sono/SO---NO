/* nhan-lienhe-sw.js — NHẬN NGƯỜI ĐƯỢC CHIA SẺ TỪ DANH BẠ (bản NL1 · 2026-11-19)
   Dùng chung, y hệt nhau cho 4 kho: can-ga-pro · GA-NOI · MINH-TRI · SO---NO. Đặt CÙNG THƯ MỤC với index.html.

   Cách chạy: trong app Danh bạ của điện thoại chạm vào người → Chia sẻ → chọn app (đã cài ra màn hình chính bằng Chrome).
   Chrome mở app bằng lệnh gửi (POST) tới …/nhan-lienhe/ kèm tệp danh bạ (.vcf) hoặc chữ. Tệp này nhận lệnh đó, cất tên + số
   vào bộ nhớ đệm của máy (Cache Storage, không gửi đi đâu), rồi đưa app về trang chính kèm dấu #nhanlienhe=<mã>.
   Trang chính đọc ra (đọc xong xoá ngay) và điền vào app.

   Phạm vi RIÊNG …/nhan-lienhe/ ⇒ không đụng service worker chính của app (sw.js, sw-qt.js, sono-push-sw.js…),
   không điều khiển trang app, không lưu trang nào. Thiếu tệp này thì app vẫn chạy bình thường, chỉ không nhận được Chia sẻ. */
'use strict';
var NL_VER = 'NL1';
var KHO = 'mt-nhan-lienhe-v1';              /* tên bộ nhớ đệm — trang app đọc đúng tên này */
var TOI_DA_TEP = 3 * 1024 * 1024;           /* đọc tối đa 3 MB mỗi tệp */
var TOI_DA_CHU = 60000;                     /* giữ tối đa 60 000 chữ mỗi phần (bỏ ảnh đại diện trong thẻ danh bạ trước) */
var TOI_DA_THE = 40;                        /* chia sẻ cả loạt người: giữ 40 người đầu */

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(Promise.resolve()); });

self.addEventListener('fetch', function (e) {
  var r = e.request, u;
  try { u = new URL(r.url); } catch (x) { return; }
  if (u.origin !== self.location.origin || !/\/nhan-lienhe\/?$/.test(u.pathname)) return;   /* chỉ lo đúng địa chỉ nhận */
  if (r.method === 'POST') { e.respondWith(nhan(r, u)); return; }
  if (r.mode === 'navigate') e.respondWith(Response.redirect(veApp(u), 302));                /* lỡ mở thẳng …/nhan-lienhe/ ⇒ về app */
});

/* …/GA-NOI/nhan-lienhe/ ⇒ …/GA-NOI/   ·   …/MINH-TRI/indexQTC.html/nhan-lienhe/ ⇒ …/MINH-TRI/indexQTC.html */
function veApp(u) {
  var b = u.origin + u.pathname.replace(/nhan-lienhe\/?$/, '');
  if (/\.html?\/$/i.test(b)) b = b.slice(0, -1);
  return b;
}
function khoaKho(u) { return u.origin + u.pathname.replace(/\/?$/, '/') + 'du-lieu'; }

async function nhan(req, u) {
  var ve = veApp(u);
  var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  var goi = { v: 1, nl: NL_VER, id: id, at: Date.now(), title: '', text: '', url: '', tep: [] };
  try {
    var fd = await req.formData();
    ['title', 'text', 'url'].forEach(function (k) {
      var v = fd.get(k);
      if (typeof v === 'string') goi[k] = gon(v).slice(0, TOI_DA_CHU);
    });
    var ds = fd.getAll('lienhe');
    for (var i = 0; i < ds.length && goi.tep.length < 5; i++) {
      var f = ds[i];
      if (typeof f === 'string') { if (f.trim()) goi.tep.push({ ten: '', loai: 'text/plain', chu: gon(f).slice(0, TOI_DA_CHU) }); continue; }
      if (!f || typeof f.text !== 'function') continue;
      goi.tep.push({ ten: String(f.name || '').slice(0, 120), loai: String(f.type || '').slice(0, 60), chu: await docTep(f) });
    }
  } catch (err) {
    return Response.redirect(ve + '#nhanlienhe=loi', 303);
  }
  try {
    var c = await caches.open(KHO);
    await c.put(new Request(khoaKho(u)), new Response(JSON.stringify(goi), { headers: { 'content-type': 'application/json; charset=utf-8' } }));
    return Response.redirect(ve + '#nhanlienhe=' + id, 303);
  } catch (err2) {
    /* máy không cho cất (đầy bộ nhớ…) ⇒ gửi thẳng trên địa chỉ, đã rút gọn */
    var nho = { v: 1, nl: NL_VER, id: id, at: goi.at, title: goi.title.slice(0, 300), text: goi.text.slice(0, 3000), url: '',
      tep: goi.tep.slice(0, 2).map(function (x) { return { ten: '', loai: x.loai, chu: x.chu.slice(0, 6000) }; }) };
    return Response.redirect(ve + '#nhanlienhe=d:' + encodeURIComponent(JSON.stringify(nho)), 303);
  }
}

async function docTep(f) {
  var b = f, t = '';
  try { if (f.size > TOI_DA_TEP) b = f.slice(0, TOI_DA_TEP); } catch (e) { b = f; }
  try { t = await b.text(); } catch (e) { t = ''; }
  return gon(t).slice(0, TOI_DA_CHU);
}

/* thẻ danh bạ (vCard): bỏ ảnh đại diện / logo / âm thanh / khoá (dữ liệu dài, không cần), giữ tối đa 40 người. Chữ thường: giữ nguyên */
function gon(t) {
  t = String(t == null ? '' : t);
  if (!/BEGIN:VCARD/i.test(t)) return t;
  var L = t.replace(/\r\n?/g, '\n').split('\n'), out = [], bo = false, n = 0;
  for (var i = 0; i < L.length; i++) {
    var l = L[i];
    if (bo) { if (/^[ \t]/.test(l) || l === '') continue; bo = false; }   /* dòng nối tiếp (bắt đầu bằng khoảng trắng) của phần đang bỏ */
    if (/^(?:[\w-]+\.)?(?:PHOTO|LOGO|SOUND|KEY)[;:]/i.test(l)) { bo = true; continue; }
    out.push(l);
    if (/^END:VCARD/i.test(l) && ++n >= TOI_DA_THE) break;
  }
  return out.join('\n');
}
