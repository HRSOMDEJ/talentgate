/* =====================================================================
   SOMDEJ TalentGate · app.js — แกนกลาง · เข้าสู่ระบบ · ตัวช่วยที่ใช้ร่วมกัน
   BUILD ต้องตรงกัน 3 ที่: Config.gs · app.js (TG_BUILD) · version.json (+ ?v= ใน index.html)
   ===================================================================== */
var TG_BUILD = '2569-10-03.1';
var TG = { boot: null, token: null, kind: null, me: null, home: null, state: null, offset: 0, view: null };

/* ---------- ตัวช่วยทั่วไป ---------- */
function $(s, el) { return (el || document).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }
function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
function sess(k, v) { try { if (v === undefined) return JSON.parse(sessionStorage.getItem(k)); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
function now() { return Date.now() + TG.offset; }
function syncClock(serverNow) { if (serverNow) TG.offset = serverNow - Date.now(); }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function fmtClock(ms) { if (ms < 0) ms = 0; var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' + pad2(m) : m) + ':' + pad2(s % 60); }
function tTime(ms, sec) { return ms ? new Date(ms).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: sec ? '2-digit' : undefined, hour12: false, timeZone: 'Asia/Bangkok' }) : '–'; }
function tDate(ms) { return ms ? new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' }) + ' ' + tTime(ms) : '–'; }
function num(x, d) { return x === null || x === undefined || x === '' ? '–' : Number(x).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: d === undefined ? 2 : d }); }
function no3(n) { return /^\d+$/.test(String(n)) ? ('00' + n).slice(-3) : String(n); }
function isAdmin() { return TG.kind === 'staff' && TG.me && TG.me.roles.indexOf('ADMIN') >= 0; }
function toast(msg, kind, ms) {
  var t = $('#toast'); t.textContent = msg; t.className = 'toast show ' + (kind || '');
  clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = 'toast'; }, ms || (kind === 'bad' ? 6000 : 3600));
}
function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.disabled = true; btn.dataset.l = btn.innerHTML; btn.innerHTML = '<i class="spin"></i>' + esc(label || 'กำลังดำเนินการ…'); }
  else { btn.disabled = false; if (btn.dataset.l) btn.innerHTML = btn.dataset.l; }
}
var ICON = {
  lock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V5m0 0L7.5 9.5M12 5l4.5 4.5M5 20h14"/></svg>',
  flag: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4h11l-2 4 2 4H5"/></svg>',
  out: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>',
  print: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M7 14h10v7H7z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/></svg>',
  file: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>'
};

/* ---------- กล่องโต้ตอบ (อยู่ใน body เสมอ) ---------- */
function modal(html, opt) {
  opt = opt || {};
  var m = $('#modal');
  m.innerHTML = '<div class="modal-bg"></div><div class="modal-box ' + (opt.cls || '') + '" role="dialog" aria-modal="true">' + (opt.noClose ? '' : '<button class="modal-x" aria-label="ปิด">×</button>') + html + '</div>';
  m.hidden = false; document.body.classList.add('no-scroll');
  if (!opt.noClose) { $('.modal-x', m).onclick = closeModal; $('.modal-bg', m).onclick = closeModal; }
  modal._onClose = opt.onClose || null; modal._lock = !!opt.noClose;
  var f = $('[autofocus]', m) || $('input,textarea,select,button.primary', m); if (f) { try { f.focus(); } catch (e) { } }
  return $('.modal-box', m);
}
function closeModal() { var m = $('#modal'); if (m.hidden) return; m.hidden = true; m.innerHTML = ''; document.body.classList.remove('no-scroll'); var f = modal._onClose; modal._onClose = null; modal._lock = false; if (f) f(); }
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#modal').hidden && !modal._lock) closeModal(); });
/** ยืนยันก่อนทำ → Promise<boolean> */
function confirmBox(title, body, okLabel, danger) {
  return new Promise(function (res) {
    var done = false, b = modal('<h2>' + esc(title) + '</h2><div class="modal-body">' + body + '</div><div class="modal-act"><button class="btn ghost-dark" data-a="n">ยกเลิก</button><button class="btn ' + (danger ? 'danger' : 'primary') + '" data-a="y" autofocus>' + esc(okLabel || 'ยืนยัน') + '</button></div>',
      { cls: 'sm', onClose: function () { if (!done) res(false); } });
    $('[data-a=y]', b).onclick = function () { done = true; closeModal(); res(true); };
    $('[data-a=n]', b).onclick = function () { closeModal(); };
  });
}
/** ขอรหัสผ่านยืนยัน (และเหตุผล ถ้าต้องการ) → Promise<{password, reason}|null> */
function askPass(title, body, okLabel, withReason) {
  return new Promise(function (res) {
    var done = false, b = modal('<h2>' + esc(title) + '</h2><div class="modal-body">' + body + '</div><form class="form" id="apF">' +
      (withReason ? '<label>เหตุผล<input id="apR" maxlength="200" placeholder="เช่น เครื่องขัดข้อง" required></label>' : '') +
      '<label>รหัสผ่านของท่าน (ยืนยันตัวตน)<input id="apP" type="password" autocomplete="current-password" required autofocus></label>' +
      '<div class="modal-act"><button type="button" class="btn ghost-dark" data-a="n">ยกเลิก</button><button class="btn danger">' + esc(okLabel || 'ยืนยัน') + '</button></div></form>',
      { cls: 'sm', onClose: function () { if (!done) res(null); } });
    $('[data-a=n]', b).onclick = function () { closeModal(); };
    $('#apF', b).onsubmit = function (e) { e.preventDefault(); done = true; var o = { password: $('#apP', b).value, reason: withReason ? $('#apR', b).value : '' }; closeModal(); res(o); };
  });
}
function saveBlob(name, blob) {
  var a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
}
function b64Blob(b64, type) { var bin = atob(b64), n = bin.length, u = new Uint8Array(n); for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: type || 'application/octet-stream' }); }
function saveCsv(name, rows) {
  var txt = rows.map(function (r) { return r.map(function (v) { v = v === null || v === undefined ? '' : String(v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
  saveBlob(name, new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
}
function fileB64(file) {
  return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.onerror = function () { rej(new Error('อ่านไฟล์ไม่ได้ กรุณาปิดไฟล์ในโปรแกรม Excel ก่อน แล้วลองอีกครั้ง')); }; r.readAsDataURL(file); });
}

/* ---------- เรียกหลังบ้าน (ไม่ตั้ง Content-Type เพื่อไม่ให้เกิด preflight) · พร้อมกันไม่เกิน 4 ---------- */
var _run = 0, _wait = [], _pending = 0, _pillT = null;
function pill() {
  clearTimeout(_pillT);
  if (_pending > 0) _pillT = setTimeout(function () { if (_pending > 0) $('#netpill').hidden = false; }, 4000); else $('#netpill').hidden = true;
}
function api(action, payload, opt) {
  opt = opt || {};
  var canRetry = /^(get|bootstrap|ping)/.test(action) || opt.retry, tries = canRetry ? (opt.tries || 3) : 1;
  function once(n) {
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, opt.timeout || 60000);
    return fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: action, token: TG.token, payload: payload || {} }), redirect: 'follow', credentials: 'omit', signal: ctl.signal })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        clearTimeout(timer);
        if (t.charAt(0) === '<') throw new Error('เซิร์ฟเวอร์ไม่ว่างชั่วคราว กรุณาลองใหม่อีกครั้ง');
        var j = JSON.parse(t);
        if (!j.ok) { var e = new Error(j.error || 'เกิดข้อผิดพลาด'); e.server = true; e.auth = j.auth; e.mustChange = j.mustChange; throw e; }
        if (j.data && j.data.now) syncClock(j.data.now);
        return j.data;
      })
      .catch(function (e) {
        clearTimeout(timer);
        if (e.server) throw e;
        if (n < tries) return new Promise(function (res) { setTimeout(res, 1200 * n); }).then(function () { return once(n + 1); });
        if (e.name === 'AbortError') throw new Error('การเชื่อมต่อใช้เวลานานเกินไป กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
        if (/Failed to fetch|NetworkError|Load failed/i.test(e.message)) throw new Error('เชื่อมต่อระบบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
        throw e;
      });
  }
  return new Promise(function (res, rej) {
    function go() {
      _run++; _pending++; pill();
      once(1).then(res, function (e) {
        if (e.auth === false && TG.token && !opt.keepSession) authLost(e.message);
        else if (e.mustChange) { TG.me.mustChange = true; route(); }
        rej(e);
      }).then(function () { _run--; _pending--; pill(); var f = _wait.shift(); if (f) f(); });
    }
    if (_run < 4) go(); else _wait.push(go);
  });
}
function authLost(msg) {
  setSession(null); closeModal();
  if (typeof candStop === 'function') candStop();
  TG._msg = msg;
  go('#/');
}
function setSession(o) {
  if (!o) { TG.token = TG.kind = TG.me = TG.home = TG.state = null; sess('tg_s', null); }
  else { TG.token = o.token; TG.kind = o.kind; TG.me = o.me || null; sess('tg_s', { token: o.token, kind: o.kind, me: o.me || null }); }
  topRight();
}

/* ---------- แถบบน ---------- */
function topRight() {
  var el = $('#topRight'), h = '';
  if (TG.kind === 'staff' && TG.me) {
    if (!TG.me.mustChange) {
      h += '<nav class="nav" aria-label="เมนูหลัก"><a href="#/staff" data-nav="staff">รอบสอบ</a>';
      if (isAdmin()) h += '<a href="#/admin/bank" data-nav="bank">คลังข้อสอบ</a><a href="#/admin/positions" data-nav="positions">ตำแหน่ง</a><a href="#/admin/staff" data-nav="people">เจ้าหน้าที่</a><a href="#/admin/settings" data-nav="settings">ตั้งค่า</a>';
      h += '</nav>';
    }
    h += '<div class="who"><span class="who-n">' + esc(TG.me.name) + '</span><span class="who-r">' + (isAdmin() ? 'ผู้ดูแลระบบ' : 'กรรมการสอบ') + ' · ' + esc(TG.me.empCode) + '</span></div>' +
      '<button class="icon-btn" id="tbPass" title="เปลี่ยนรหัสผ่าน" aria-label="เปลี่ยนรหัสผ่าน">' + ICON.lock + '</button><button class="icon-btn" id="tbOut" title="ออกจากระบบ" aria-label="ออกจากระบบ">' + ICON.out + '</button>';
  } else if (TG.kind === 'cand' && TG.state) {
    h += '<div class="who"><span class="who-n">' + esc(TG.state.me.name) + '</span><span class="who-r">เลขประจำตัวสอบ ' + esc(no3(TG.state.me.examNo)) + '</span></div>';
  }
  el.innerHTML = h;
  if ($('#tbOut')) $('#tbOut').onclick = function () { confirmBox('ออกจากระบบ', 'ต้องการออกจากระบบใช่หรือไม่', 'ออกจากระบบ').then(function (y) { if (y) logout(); }); };
  if ($('#tbPass')) $('#tbPass').onclick = function () { viewChangePass(false); };
  markNav();
}
function markNav() {
  var p = location.hash.replace(/^#\/?/, '').split('/'), key = p[0] === 'admin' ? ({ staff: 'people' }[p[1]] || p[1]) : 'staff';
  $$('.nav a').forEach(function (a) { a.classList.toggle('active', a.dataset.nav === key); });
}
function logout() {
  var t = TG.token; api('logout', {}, { keepSession: true }).catch(function () { });
  setSession(null); if (t) toast('ออกจากระบบแล้ว'); go('#/');
}

/* ---------- หน้าเข้าสู่ระบบ ---------- */
function gateArt() {
  return '<svg class="gate-art" viewBox="0 0 420 320" aria-hidden="true"><defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="M70 320V150a140 140 0 0 1 280 0v170" fill="url(#gA)"/><path class="ga1" d="M70 320V150a140 140 0 0 1 280 0v170" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>' +
    '<path class="ga2" d="M112 320V156a98 98 0 0 1 196 0v164" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="2"/><path class="ga3" d="M154 320V162a56 56 0 0 1 112 0v158" fill="none" stroke="#ff5a6e" stroke-width="3"/>' +
    '<path class="ga4" d="M186 236l24-28 24 28M210 208v78" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function viewLogin(tab, msg) {
  TG.view = 'login'; document.body.className = 'pg-login';
  if (!msg && TG._msg) { msg = TG._msg; TG._msg = null; }
  sess('tg_tab', tab);
  var info = openInfo();
  $('#app').innerHTML =
    '<section class="login"><div class="login-hero">' + gateArt() +
    '<div class="hero-in"><span class="pill gold">ฝ่ายทรัพยากรบุคคล · HR Transformation</span><h1>SOMDEJ <em>TalentGate</em></h1>' +
    '<p class="hero-sub">ระบบสอบคัดเลือกบุคลากรออนไลน์<br>โรงพยาบาลสมเด็จพระบรมราชเทวี ณ ศรีราชา สภากาชาดไทย</p>' +
    '<ul class="hero-pts"><li>' + ICON.shield + 'โปร่งใส ตรวจสอบได้ทุกขั้นตอน</li><li>' + ICON.clock + 'จับเวลาและบันทึกคำตอบอัตโนมัติ</li><li>' + ICON.check + 'มาตรฐานเดียวกันทุกตำแหน่ง</li></ul><div id="lgOpen">' + info + '</div></div></div>' +
    '<div class="login-side"><div class="card login-card"><div class="seg" role="tablist"><button role="tab" data-t="cand" class="' + (tab === 'cand' ? 'on' : '') + '">' + ICON.user + 'ผู้เข้าสอบ</button><button role="tab" data-t="staff" class="' + (tab === 'staff' ? 'on' : '') + '">' + ICON.lock + 'กรรมการ / ผู้ดูแล</button></div>' +
    (msg ? '<div class="note bad">' + esc(msg) + '</div>' : '') +
    (tab === 'cand'
      ? '<form class="form" id="lgF" autocomplete="off"><h2>เข้าสู่ระบบสอบ</h2><p class="muted">กรอกเลขประจำตัวสอบ และรหัสเข้าสอบ 6 หลักจากใบรหัสที่ได้รับตอนลงทะเบียน</p>' +
        '<label>เลขประจำตัวสอบ<input id="lgNo" inputmode="numeric" maxlength="12" placeholder="เช่น 7" required autofocus></label>' +
        '<label>รหัสเข้าสอบ 6 หลัก<input id="lgCode" class="code-in" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" placeholder="••••••" autocomplete="off" required></label>' +
        '<button class="btn primary block lg" id="lgBtn">เข้าสู่ระบบสอบ</button></form>'
      : '<form class="form" id="lgF"><h2>สำหรับเจ้าหน้าที่</h2><p class="muted">กรรมการสอบและผู้ดูแลระบบ เข้าด้วยเลขเจ้าหน้าที่ · ครั้งแรกใช้เลขประจำตัวประชาชนเป็นรหัสผ่าน แล้วระบบจะให้ตั้งรหัสใหม่</p>' +
        '<label>เลขเจ้าหน้าที่<input id="lgEmp" inputmode="numeric" maxlength="10" autocomplete="username" required autofocus></label>' +
        '<label>รหัสผ่าน<input id="lgPass" type="password" autocomplete="current-password" required></label>' +
        '<button class="btn primary block lg" id="lgBtn">เข้าสู่ระบบ</button></form>') +
    '<p class="conn" id="lgConn"></p></div></div></section>';
  $$('.seg button').forEach(function (x) { x.onclick = function () { viewLogin(x.dataset.t); }; });
  conn();
  $('#lgF').onsubmit = function (e) {
    e.preventDefault(); var btn = $('#lgBtn'); busy(btn, true, 'กำลังตรวจสอบ…');
    var p = tab === 'cand' ? api('loginCand', { examNo: $('#lgNo').value, code: $('#lgCode').value, ua: navigator.userAgent })
      : api('loginStaff', { empCode: $('#lgEmp').value.trim(), password: $('#lgPass').value });
    p.then(function (r) {
      if (tab === 'cand') { TG.state = r.state; setSession({ token: r.token, kind: 'cand' }); go('#/exam'); }
      else { TG.home = r.home; setSession({ token: r.token, kind: 'staff', me: r.me }); go('#/staff'); }
    }).catch(function (err) { busy(btn, false); toast(err.message, 'bad'); });
  };
  topRight();
}
function openInfo() {
  var open = (TG.boot || {}).openExams || [];
  return open.length ? open.map(function (e) { return '<div class="open-ex"><span class="dot live"></span><div><b>' + esc(e.title) + '</b><small>' + esc(e.examDate) + (e.place ? ' · ' + esc(e.place) : '') + '</small></div></div>'; }).join('')
    : '<div class="open-ex idle"><span class="dot"></span><div><b>ขณะนี้ยังไม่มีรอบสอบที่เปิดอยู่</b><small>ผู้เข้าสอบโปรดรอสัญญาณจากกรรมการคุมสอบ</small></div></div>';
}
function conn() {
  var el = $('#lgConn'); if (!el) return;
  if ($('#lgOpen') && TG.boot) $('#lgOpen').innerHTML = openInfo();
  if (!TG.boot) { el.textContent = 'กำลังเชื่อมต่อระบบ…'; el.className = 'conn'; return; }
  el.innerHTML = '<span class="dot live"></span>เชื่อมต่อระบบแล้ว · v' + esc(TG.boot.version) + ' (' + esc(TG.boot.buildTh) + ')'; el.className = 'conn ok';
}

/* ---------- ตั้งรหัสผ่านใหม่ ---------- */
function viewChangePass(forced) {
  var html = '<h2>' + (forced ? 'ตั้งรหัสผ่านใหม่ก่อนใช้งาน' : 'เปลี่ยนรหัสผ่าน') + '</h2>' +
    (forced ? '<p class="muted">เพื่อความปลอดภัย ระบบให้ตั้งรหัสผ่านใหม่แทนเลขประจำตัวประชาชนในการเข้าครั้งแรก</p>' : '') +
    '<form class="form" id="cpF"><label>' + (forced ? 'รหัสผ่านครั้งแรก (เลขประจำตัวประชาชน)' : 'รหัสผ่านเดิม') + '<input id="cpO" type="password" autocomplete="current-password" required autofocus></label>' +
    '<label>รหัสผ่านใหม่<input id="cpN" type="password" autocomplete="new-password" minlength="8" required></label>' +
    '<label>ยืนยันรหัสผ่านใหม่<input id="cpC" type="password" autocomplete="new-password" minlength="8" required></label>' +
    '<ul class="rules"><li>ยาวอย่างน้อย 8 ตัวอักษร</li><li>มีทั้งตัวอักษรและตัวเลข</li><li>ไม่มีเลขเจ้าหน้าที่ของท่าน และไม่ซ้ำรหัสเดิม</li></ul>' +
    '<div class="modal-act">' + (forced ? '<button type="button" class="btn ghost-dark" id="cpOut">ออกจากระบบ</button>' : '<button type="button" class="btn ghost-dark" id="cpX">ยกเลิก</button>') + '<button class="btn primary" id="cpBtn">บันทึกรหัสผ่านใหม่</button></div></form>';
  var box;
  if (forced) { TG.view = 'pass'; document.body.className = 'pg-plain'; $('#app').innerHTML = '<div class="wrap narrow"><div class="card pad-xl">' + html + '</div></div>'; box = $('#app'); $('#cpOut').onclick = logout; }
  else { box = modal(html, { cls: 'sm' }); $('#cpX', box).onclick = closeModal; }
  $('#cpF', box).onsubmit = function (e) {
    e.preventDefault();
    if ($('#cpN', box).value !== $('#cpC', box).value) return toast('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน', 'bad');
    var btn = $('#cpBtn', box); busy(btn, true);
    api('changePassword', { oldPassword: $('#cpO', box).value, newPassword: $('#cpN', box).value }).then(function (r) {
      TG.home = r.home; setSession({ token: TG.token, kind: 'staff', me: r.me }); closeModal(); toast('ตั้งรหัสผ่านใหม่เรียบร้อย', 'ok');
      if (forced) go('#/staff');
    }).catch(function (err) { busy(btn, false); toast(err.message, 'bad'); });
  };
}

/* ---------- เส้นทาง ---------- */
/** ไปยังหน้าใหม่โดยวาดหน้าเพียงครั้งเดียว */
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function route() {
  var parts = location.hash.replace(/^#\/?/, '').split('/').filter(String).map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } });
  if (typeof candLeaving === 'function' && candLeaving(parts)) return;
  closeModal(); window.scrollTo(0, 0);
  if (!TG.token) return viewLogin(parts[0] === 'staff' || parts[0] === 'admin' ? 'staff' : (sess('tg_tab') || 'cand'));
  if (TG.kind === 'cand') return candRoute(parts);
  if (TG.me.mustChange) return viewChangePass(true);
  document.body.className = 'pg-staff'; topRight();
  if (parts[0] === 'admin' && isAdmin()) return adminRoute(parts.slice(1));
  if (parts[0] === 'staff' && parts[1]) return boardRoute(parts[1], parts[2] || 'overview');
  return viewStaffHome();
}
window.addEventListener('hashchange', route);

/* ---------- เริ่มต้น ---------- */
function afterBoot() {
  var b = TG.boot; if (!b) return;
  $('#footOrg').textContent = b.orgName; $('#footVer').textContent = b.app + ' v' + b.version + ' · ' + b.buildTh;
  if (b.build !== TG_BUILD) $('#banner').innerHTML = '<div class="banner warn">หน้าเว็บ (' + esc(TG_BUILD) + ') และหลังบ้าน (' + esc(b.build) + ') เป็นคนละรุ่น — ผู้ดูแล: ตรวจว่าอัปโหลดไฟล์หน้าเว็บครบ และ Deploy › Manage deployments › New version แล้ว จากนั้นกด Ctrl+F5</div>';
  conn();
}
function checkVersion() {
  fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (v) {
    if (v.build && v.build !== TG_BUILD && !TG._newVer) { TG._newVer = 1; if (TG.kind !== 'cand') $('#banner').innerHTML = '<div class="banner info">มีรุ่นใหม่ของระบบ (' + esc(v.buildTh || v.build) + ') <button class="btn sm" onclick="location.reload()">โหลดใหม่</button></div>'; }
  }).catch(function () { });
}
(function init() {
  if (typeof API_URL === 'undefined' || /วาง_ID/.test(API_URL)) {
    $('#app').innerHTML = '<div class="wrap narrow"><div class="card pad-xl center"><h2>ยังไม่ได้ตั้งค่าการเชื่อมต่อ</h2><p class="muted mt">ผู้ดูแล: เปิดไฟล์ <b>config.js</b> แล้ววางลิงก์ Web app (ลงท้าย /exec) จาก Apps Script</p></div></div>'; return;
  }
  var s = sess('tg_s');
  if (s && s.token) { TG.token = s.token; TG.kind = s.kind; TG.me = s.me; }
  var bootP = api('bootstrap').then(function (b) { TG.boot = b; store('tg_boot', b); afterBoot(); }).catch(function (e) { if (!TG.boot) { var el = $('#lgConn'); if (el) { el.textContent = e.message; el.className = 'conn bad'; } } });
  var cached = store('tg_boot'); if (cached && !TG.boot) { TG.boot = cached; afterBoot(); }
  if (!TG.token) { route(); return; }
  var p = TG.kind === 'cand' ? api('getCandState').then(function (st) { TG.state = st; }) : (TG.me && TG.me.mustChange ? Promise.resolve() : api('getStaffHome').then(function (h) { TG.home = h; TG.me = h.me; }));
  p.then(function () { topRight(); route(); }).catch(function (e) { if (TG.token) { $('#app').innerHTML = '<div class="wrap narrow"><div class="card pad-xl center"><h2>เชื่อมต่อระบบไม่ได้</h2><p class="muted mt">' + esc(e.message) + '</p><button class="btn primary mt" onclick="location.reload()">ลองอีกครั้ง</button></div></div>'; } });
  setInterval(checkVersion, 600000);
})();
