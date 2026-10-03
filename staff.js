/* =====================================================================
   SOMDEJ TalentGate · staff.js — หน้ากรรมการ/ผู้ดูแล: รอบสอบ · ภาพรวม · ติดตามสอบ · ตรวจ · สรุปผล
   ===================================================================== */
var BD = { id: null, data: null, at: 0, tab: null, essays: null, mon: null, monT: null, tickT: null, essayQ: null };
var ST_TH = { DRAFT: 'ร่าง', OPEN: 'เปิดสอบ', GRADING: 'ปิดรับคำตอบ · กำลังตรวจ', FINAL: 'ยืนยันผลแล้ว' };
var CS_TH = { ACTIVE: 'มีสิทธิ์สอบ', WITHDRAWN: 'สละสิทธิ์', ABSENT: 'ขาดสอบ', BLOCKED: 'ระงับสิทธิ์' };
var TYPE_TH = { PROFILE: 'ทัศนคติ/บุคลิกภาพ', THEORY: 'ทฤษฎี', PRACTICAL: 'ปฏิบัติ (ส่งไฟล์)' };
function stPill(s) { return '<span class="st st-' + s + '">' + ST_TH[s] + '</span>'; }
function boardStop() { clearInterval(BD.monT); clearInterval(BD.tickT); BD.monT = BD.tickT = null; }

/* ---------- หน้าแรกของเจ้าหน้าที่: รายการรอบสอบ ---------- */
function viewStaffHome() {
  boardStop(); TG.view = 'staffHome'; markNav();
  function draw() {
    var h = TG.home, ex = h.exams;
    var html = '<div class="wrap"><div class="phead"><div><span class="eyebrow">' + (h.isAdmin ? 'ผู้ดูแลระบบ' : 'กรรมการสอบ') + '</span><h1>รอบสอบ</h1><p class="muted">' + (h.isAdmin ? 'จัดการรอบสอบทั้งหมด ตั้งค่าข้อสอบ ผู้เข้าสอบ และกรรมการ' : 'รอบสอบที่ท่านได้รับแต่งตั้งเป็นกรรมการ') + '</p></div>' +
      (h.isAdmin ? '<button class="btn primary" id="shNew">' + ICON.plus + 'สร้างรอบสอบใหม่</button>' : '') + '</div>';
    if (!ex.length) html += '<div class="card empty"><h3>ยังไม่มีรอบสอบ</h3><p class="muted">' + (h.isAdmin ? 'กด "สร้างรอบสอบใหม่" เพื่อเริ่มต้น' : 'เมื่อผู้ดูแลระบบแต่งตั้งท่านเป็นกรรมการ รอบสอบจะแสดงที่นี่') + '</p></div>';
    html += '<div class="excards">' + ex.map(function (e, i) {
      return '<a class="card excard" href="#/staff/' + encodeURIComponent(e.examId) + '" style="--i:' + i + '"><div class="exc-top">' + stPill(e.status) + '<span class="muted sm">' + esc(e.examId) + '</span></div><h3>' + esc(e.title) + '</h3><p class="muted">' + esc(e.posName) + '</p>' +
        '<p class="exc-m">' + ICON.clock + esc(e.examDate || 'ยังไม่กำหนดวัน') + '</p><div class="exc-f"><span><b>' + e.nActive + '</b> ผู้มีสิทธิ์สอบ' + (e.nCand > e.nActive ? ' <small>(จาก ' + e.nCand + ')</small>' : '') + '</span><span><b>' + e.committee.length + '</b> กรรมการ</span></div></a>';
    }).join('') + '</div></div>';
    $('#app').innerHTML = html;
    if ($('#shNew')) $('#shNew').onclick = function () { newExamModal(); };
  }
  if (TG.home) draw(); else $('#app').innerHTML = '<div class="boot"><div class="boot-ring"></div></div>';
  api('getStaffHome').then(function (h) { TG.home = h; TG.me = h.me; if (TG.view === 'staffHome') draw(); }).catch(function (e) { toast(e.message, 'bad'); });
}

/* ---------- กระดานรอบสอบ ---------- */
function boardRoute(examId, tab) {
  boardStop(); TG.view = 'board';
  var fresh = BD.id === examId && BD.data && Date.now() - BD.at < 15000;
  if (BD.id !== examId) { BD.data = null; BD.essays = null; BD.mon = null; BD.essayQ = null; }
  BD.id = examId; BD.tab = tab;
  if (BD.data) drawBoard(); else $('#app').innerHTML = '<div class="boot"><div class="boot-ring"></div><p>กำลังโหลดข้อมูลรอบสอบ…</p></div>';
  if (!fresh) loadBoard();
}
function loadBoard(quiet) {
  return api('getBoard', { examId: BD.id }).then(function (d) { BD.data = d; BD.at = Date.now(); if (TG.view === 'board' && !editingNow()) drawBoard(); return d; })
    .catch(function (e) { toast(e.message, 'bad'); if (!BD.data) { location.hash = '#/staff'; } });
}
/** ไม่วาดหน้าใหม่ทับขณะกรรมการกำลังพิมพ์คะแนน */
function editingNow() { var a = document.activeElement; return a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest && a.closest('#tab') && (BD.tab === 'essay' || BD.tab === 'practical' || BD.tab === 'setup' || BD.tab === 'cands'); }
function drawBoard() {
  var d = BD.data, e = d.exam, tabs = [['overview', 'ภาพรวม'], ['monitor', 'ติดตามสอบ'], ['essay', 'ตรวจข้อเขียน'], ['practical', 'ตรวจภาคปฏิบัติ'], ['profile', 'ทัศนคติและบุคลิกภาพ'], ['results', 'สรุปผล']];
  if (d.isAdmin) tabs.push(['cands', 'ผู้เข้าสอบ'], ['setup', 'ตั้งค่ารอบสอบ']);
  if (!tabs.some(function (t) { return t[0] === BD.tab; })) BD.tab = 'overview';
  $('#app').innerHTML = '<div class="wrap"><a class="backlink" href="#/staff">' + ICON.back + 'รอบสอบทั้งหมด</a><div class="phead"><div><span class="eyebrow">' + esc(e.posName) + '</span><h1>' + esc(e.title) + '</h1><p class="muted">' + esc(e.examDate) + (e.place ? ' · ' + esc(e.place) : '') + '</p></div>' +
    '<div class="phead-r">' + stPill(e.status) + '<button class="icon-btn dark" id="bdRef" title="โหลดข้อมูลใหม่" aria-label="โหลดข้อมูลใหม่">' + ICON.refresh + '</button></div></div>' +
    '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<a class="tab' + (t[0] === BD.tab ? ' on' : '') + '" href="#/staff/' + encodeURIComponent(e.examId) + '/' + t[0] + '">' + t[1] + '</a>'; }).join('') + '</div><div id="tab"></div></div>';
  $('#bdRef').onclick = function () { var b = this; b.classList.add('spinning'); BD.essays = null; loadBoard().then(function () { b.classList.remove('spinning'); toast('โหลดข้อมูลล่าสุดแล้ว', 'ok'); }); };
  ({ overview: tabOverview, monitor: tabMonitor, essay: tabEssay, practical: tabPractical, profile: tabProfile, results: tabResults, cands: tabCands, setup: tabSetup })[BD.tab]();
}
function cLabel(c) { return '<b class="cno">' + esc(no3(c.examNo)) + '</b>' + (c.name ? '<span class="cname">' + esc(c.name) + '</span>' : ''); }
function activeCands() { return BD.data.candidates.filter(function (c) { return c.status === 'ACTIVE'; }); }
function readonly() { return BD.data.exam.status === 'FINAL'; }

/* ---------- ภาพรวม ---------- */
function tabOverview() {
  var d = BD.data, e = d.exam, act = activeCands(), secs = d.sections;
  var logged = act.filter(function (c) { return c.lastLogin; }).length, allDone = act.filter(function (c) { return secs.every(function (s) { return c.secs[s.secId] && c.secs[s.secId].status === 'DONE'; }); }).length;
  var started = act.filter(function (c) { return c.result.started; }), graded = started.filter(function (c) { return c.result.complete; }).length;
  var h = '<div class="kpis"><div class="kpi"><b>' + act.length + '</b><span>ผู้มีสิทธิ์สอบ</span><small>จากรายชื่อ ' + d.candidates.length + ' คน</small></div><div class="kpi"><b>' + logged + '</b><span>เข้าระบบแล้ว</span><small>' + (act.length - logged) + ' คนยังไม่เข้า</small></div>' +
    '<div class="kpi"><b>' + allDone + '</b><span>ส่งครบทุกตอน</span><small>จากผู้เริ่มสอบ ' + started.length + ' คน</small></div><div class="kpi"><b>' + graded + '</b><span>ตรวจครบแล้ว</span><small>' + (started.length - graded) + ' คนรอตรวจ</small></div></div>';
  if (d.isAdmin) {
    var i = ['DRAFT', 'OPEN', 'GRADING', 'FINAL'].indexOf(e.status), next = [['OPEN', 'เปิดสอบ', 'ผู้เข้าสอบจะเข้าสู่ระบบและเริ่มทำข้อสอบได้'], ['GRADING', 'ปิดรับคำตอบ', 'ผู้เข้าสอบจะเข้าระบบไม่ได้อีก ตอนที่ยังทำค้างจะถูกปิดด้วยคำตอบที่บันทึกไว้ล่าสุด'], ['FINAL', 'ยืนยันผลสอบ', 'คะแนนจะถูกล็อก กรรมการแก้ไขไม่ได้อีก'], null][i];
    h += '<div class="card"><div class="card-head"><div><h2 class="card-t">ขั้นตอนของรอบสอบ</h2><p class="card-s">สถานะปัจจุบัน: ' + ST_TH[e.status] + '</p></div><div class="acts">' + (i > 0 ? '<button class="btn ghost-dark sm" id="ovBack">ย้อนเป็น "' + ST_TH[['DRAFT', 'OPEN', 'GRADING'][i - 1]] + '"</button>' : '') + (next ? '<button class="btn primary" id="ovNext">' + next[1] + '</button>' : '') + '</div></div>' +
      '<ol class="flow">' + ['DRAFT', 'OPEN', 'GRADING', 'FINAL'].map(function (s, j) { return '<li class="' + (j < i ? 'done' : j === i ? 'cur' : '') + '"><i>' + (j < i ? ICON.check : j + 1) + '</i><span>' + ['เตรียมรอบสอบ', 'เปิดสอบ', 'ตรวจและให้คะแนน', 'ยืนยันผล'][j] + '</span></li>'; }).join('') + '</ol>';
    if (e.status === 'DRAFT') {
      var pr = secs.filter(function (s) { return s.type === 'PRACTICAL' && !s.hasTemplate; });
      h += '<ul class="checks"><li class="' + (act.length ? 'ok' : 'no') + '">รายชื่อผู้เข้าสอบ ' + act.length + ' คน <a href="#/staff/' + encodeURIComponent(e.examId) + '/cands">จัดการรายชื่อและพิมพ์ใบรหัส</a></li>' +
        '<li class="' + (e.committee.length ? 'ok' : 'no') + '">กรรมการ ' + e.committee.length + ' คน <a href="#/staff/' + encodeURIComponent(e.examId) + '/setup">ตั้งค่ารอบสอบ</a></li>' +
        '<li class="' + (pr.length ? 'no' : 'ok') + '">ไฟล์โจทย์ภาคปฏิบัติ ' + (pr.length ? 'ยังไม่ได้อัปโหลด' : 'พร้อม') + '</li></ul>';
    }
    h += '</div>';
  }
  h += '<div class="grid2"><div class="card"><h2 class="card-t">ตอนสอบ</h2><div class="tblwrap"><table class="tbl"><thead><tr><th>ตอน</th><th class="r">เวลา</th><th class="r">จำนวนข้อ</th><th class="r">คะแนนเต็ม</th>' + (d.isAdmin ? '<th class="c">เปิดให้เริ่ม</th>' : '') + '</tr></thead><tbody>' +
    secs.map(function (s) { return '<tr><td><b>' + esc(s.title) + '</b><br><small class="muted">' + TYPE_TH[s.type] + '</small></td><td class="r">' + s.minutes + ' นาที</td><td class="r">' + (s.nQuestions || '–') + '</td><td class="r">' + (s.maxScore || 'ไม่คิด') + '</td>' +
      (d.isAdmin ? '<td class="c"><label class="sw"><input type="checkbox" data-open="' + esc(s.secId) + '"' + (s.open ? ' checked' : '') + (readonly() ? ' disabled' : '') + '><i></i></label></td>' : '') + '</tr>'; }).join('') +
    '</tbody><tfoot><tr><td>รวม</td><td class="r">' + secs.reduce(function (a, s) { return a + s.minutes; }, 0) + ' นาที</td><td></td><td class="r">' + d.totals.totalMax + '</td>' + (d.isAdmin ? '<td></td>' : '') + '</tr></tfoot></table></div>' +
    '<p class="muted sm">เกณฑ์ผ่าน ร้อยละ ' + e.passPct + ' (' + d.totals.passMin + ' คะแนนขึ้นไป)' + (d.isAdmin ? ' · ปิดสวิตช์ "เปิดให้เริ่ม" เพื่อให้ผู้เข้าสอบรอสัญญาณก่อนเริ่มตอนนั้นพร้อมกัน' : '') + '</p></div>';
  h += '<div class="card"><h2 class="card-t">คณะกรรมการ</h2>' + (e.committee.length ? '<ul class="plist">' + e.committee.map(function (m) {
    var n = 0, need = started.length * d.items.length;
    if (d.isAdmin) started.forEach(function (c) { d.items.forEach(function (it) { if ((c.avg[it.item].by || []).some(function (x) { return x.g === m.empCode; })) n++; }); });
    else if (m.empCode === TG.me.empCode) started.forEach(function (c) { d.items.forEach(function (it) { if (c.my[it.item] && c.my[it.item].score !== null) n++; }); });
    var show = d.isAdmin || m.empCode === TG.me.empCode;
    return '<li><span class="ava">' + esc(m.name.replace(/^(นาย|นางสาว|นาง|ดร\.|พญ\.|นพ\.)\s*/, '').charAt(0)) + '</span><div><b>' + esc(m.name) + '</b><small>' + esc(m.empCode) + (show && need ? ' · ให้คะแนนแล้ว ' + n + ' / ' + need + ' รายการ' : '') + '</small>' + (show && need ? '<div class="bar"><i style="width:' + Math.round(n / need * 100) + '%"></i></div>' : '') + '</div></li>';
  }).join('') + '</ul>' : '<p class="muted">ยังไม่ได้แต่งตั้งกรรมการ</p>') +
    '<p class="muted sm">' + (e.blind ? 'รอบนี้ <b>ปิดชื่อผู้เข้าสอบ</b>: กรรมการเห็นเฉพาะเลขประจำตัวสอบ · คะแนนของแต่ละรายการคือค่าเฉลี่ยของกรรมการทุกท่านที่ให้คะแนน' : 'คะแนนของแต่ละรายการคือค่าเฉลี่ยของกรรมการทุกท่านที่ให้คะแนน') + '</p></div></div>';
  $('#tab').innerHTML = h;
  $$('[data-open]').forEach(function (x) { x.onchange = function () { api('setSectionOpen', { secId: x.dataset.open, open: x.checked }).then(function () { toast(x.checked ? 'เปิดให้เริ่มตอนนี้แล้ว' : 'ปิดไว้ก่อน ผู้เข้าสอบจะเห็นว่า "รอกรรมการเปิดให้เริ่ม"', 'ok'); loadBoard(); }).catch(function (er) { x.checked = !x.checked; toast(er.message, 'bad'); }); }; });
  function setSt(st, title, msg, needPass) {
    var p = needPass ? askPass(title, '<p>' + msg + '</p>', title) : confirmBox(title, '<p>' + msg + '</p>', title).then(function (y) { return y ? {} : null; });
    p.then(function (r) { if (!r) return; api('setExamStatus', { examId: e.examId, status: st, password: r.password }).then(function () { toast('เปลี่ยนสถานะเป็น "' + ST_TH[st] + '" แล้ว', 'ok'); TG.home = null; loadBoard(); }).catch(function (er) { toast(er.message, 'bad'); }); });
  }
  if ($('#ovNext')) $('#ovNext').onclick = function () { setSt(next[0], next[1], next[2], next[0] === 'FINAL'); };
  if ($('#ovBack')) $('#ovBack').onclick = function () { var p = ['DRAFT', 'OPEN', 'GRADING'][i - 1]; setSt(p, 'ย้อนสถานะเป็น "' + ST_TH[p] + '"', 'ใช้เมื่อเปลี่ยนสถานะผิดพลาดเท่านั้น', e.status === 'FINAL'); };
}

/* ---------- ติดตามสอบสด ---------- */
function tabMonitor() {
  $('#tab').innerHTML = '<div class="card"><div class="card-head"><div><h2 class="card-t">ติดตามสอบ</h2><p class="card-s" id="mnInfo">กำลังโหลด…</p></div><div class="acts" id="mnActs"></div></div><div class="tblwrap" id="mnBody"></div>' +
    '<p class="muted sm">ปรับปรุงอัตโนมัติทุก 20 วินาที · "ออกจอ" = จำนวนครั้งที่ผู้เข้าสอบสลับไปหน้าต่างอื่นระหว่างทำตอนที่ 1–2' + (BD.data.isAdmin ? ' · คลิกที่ช่องของผู้เข้าสอบเพื่อเพิ่มเวลาหรือล้างตอน' : '') + '</p></div>';
  function load() { return api('getMonitor', { examId: BD.id }).then(function (m) { BD.mon = m; if (BD.tab === 'monitor' && TG.view === 'board') draw(); }).catch(function (e) { var el = $('#mnInfo'); if (el) el.textContent = 'โหลดไม่สำเร็จ: ' + e.message; }); }
  function draw() {
    var m = BD.mon, secs = m.sections, act = m.candidates.filter(function (c) { return c.status === 'ACTIVE'; }), cnt = {};
    secs.forEach(function (s) { cnt[s.secId] = { DOING: 0, DONE: 0 }; });
    act.forEach(function (c) { secs.forEach(function (s) { var a = c.secs[s.secId]; if (a) cnt[s.secId][a.status]++; }); });
    if (!$('#mnInfo')) return;
    $('#mnInfo').textContent = 'ข้อมูล ณ ' + tTime(m.now, true) + ' น. · ผู้มีสิทธิ์สอบ ' + act.length + ' คน · เข้าระบบแล้ว ' + act.filter(function (c) { return c.lastLogin; }).length + ' คน';
    $('#mnActs').innerHTML = m.isAdmin && m.exam.status === 'OPEN' ? secs.map(function (s) { return cnt[s.secId].DOING ? '<button class="btn ghost-dark sm" data-ext="' + esc(s.secId) + '">+ เวลาทุกคนที่กำลังทำ ' + esc(s.title.split(' ').slice(0, 2).join(' ')) + '</button>' : ''; }).join('') : '';
    $('#mnBody').innerHTML = '<table class="tbl mon"><thead><tr><th>ผู้เข้าสอบ</th><th>เข้าระบบ</th>' + secs.map(function (s) { return '<th>' + esc(s.title) + '<small>กำลังทำ ' + cnt[s.secId].DOING + ' · ส่งแล้ว ' + cnt[s.secId].DONE + '</small></th>'; }).join('') + '</tr></thead><tbody>' +
      m.candidates.map(function (c) {
        var off = c.status !== 'ACTIVE';
        return '<tr class="' + (off ? 'off' : '') + '"><td>' + cLabel(c) + (off ? '<span class="tag">' + CS_TH[c.status] + '</span>' : '') + '</td><td>' + (c.lastLogin ? tTime(c.lastLogin) : '<span class="muted">–</span>') + '</td>' +
          secs.map(function (s) {
            var a = c.secs[s.secId], x = '';
            if (!a) x = '<span class="muted">–</span>';
            else if (a.status === 'DOING') x = '<span class="tag warn">กำลังทำ</span> <b class="mn-t" data-due="' + a.dueAt + '">' + fmtClock(a.dueAt - now()) + '</b><small>' + (s.type === 'PRACTICAL' ? (a.hasFile ? 'ส่งไฟล์แล้ว ' + tTime(a.fileAt) : 'ยังไม่ส่งไฟล์') : 'ตอบ ' + a.answered + '/' + s.nQuestions + (a.savedAt ? ' · บันทึก ' + tTime(a.savedAt) : '')) + '</small>';
            else x = '<span class="tag ok">ส่งแล้ว ' + tTime(a.submitAt) + '</span>' + flagTags(a.flag) + '<small>' + (s.type === 'PRACTICAL' ? (a.hasFile ? 'มีไฟล์' : 'ไม่มีไฟล์') : 'ตอบ ' + a.answered + '/' + s.nQuestions) + '</small>';
            if (a && a.blur) x += '<span class="tag ' + (a.blur >= 3 ? 'bad' : 'warn') + '">ออกจอ ' + a.blur + '</span>';
            return '<td class="mn-c' + (m.isAdmin && a && !off ? ' act' : '') + '" data-no="' + esc(c.examNo) + '" data-sec="' + esc(s.secId) + '">' + x + '</td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
    $$('[data-ext]').forEach(function (b) { b.onclick = function () { extendBox(b.dataset.ext, ''); }; });
    if (m.isAdmin) $$('.mn-c.act').forEach(function (td) { td.onclick = function () { cellMenu(td.dataset.no, td.dataset.sec); }; });
  }
  function extendBox(secId, no) {
    var s = BD.mon.sections.filter(function (x) { return x.secId === secId; })[0];
    var b = modal('<h2>เพิ่มเวลา</h2><p class="muted">' + esc(s.title) + ' · ' + (no ? 'เลขประจำตัวสอบ ' + esc(no3(no)) + ' (ถ้าตอนนี้ถูกปิดไปแล้ว ระบบจะเปิดให้ทำต่อโดยนับเวลาจากตอนนี้)' : 'ทุกคนที่กำลังทำตอนนี้') + '</p><form class="form" id="exF"><label>จำนวนนาทีที่เพิ่ม<input id="exM" type="number" min="1" max="120" value="5" required autofocus></label><label>เหตุผล (บันทึกในประวัติ)<input id="exR" maxlength="200" required placeholder="เช่น ไฟดับ / เครื่องขัดข้อง"></label><div class="modal-act"><button type="button" class="btn ghost-dark" id="exX">ยกเลิก</button><button class="btn primary">เพิ่มเวลา</button></div></form>', { cls: 'sm' });
    $('#exX', b).onclick = closeModal;
    $('#exF', b).onsubmit = function (e) { e.preventDefault(); api('extendTime', { examId: BD.id, secId: secId, examNo: no, minutes: +$('#exM', b).value, reason: $('#exR', b).value }).then(function (r) { closeModal(); toast('เพิ่มเวลาให้ ' + r.n + ' คนแล้ว', 'ok'); load(); }).catch(function (er) { toast(er.message, 'bad'); }); };
  }
  function cellMenu(no, secId) {
    var c = BD.mon.candidates.filter(function (x) { return x.examNo === no; })[0], s = BD.mon.sections.filter(function (x) { return x.secId === secId; })[0], a = c.secs[secId];
    var b = modal('<h2>เลขประจำตัวสอบ ' + esc(no3(no)) + '</h2><p class="muted">' + esc(c.name) + ' · ' + esc(s.title) + '</p><table class="kv"><tr><th>สถานะ</th><td>' + (a.status === 'DOING' ? 'กำลังทำ' : 'ส่งแล้ว') + ' ' + flagTags(a.flag) + '</td></tr><tr><th>เริ่ม</th><td>' + tTime(a.startAt, true) + ' น.</td></tr><tr><th>กำหนดสิ้นสุด</th><td>' + tTime(a.dueAt, true) + ' น.</td></tr>' + (a.submitAt ? '<tr><th>ส่ง</th><td>' + tTime(a.submitAt, true) + ' น.</td></tr>' : '') + '<tr><th>สลับหน้าจอ</th><td>' + a.blur + ' ครั้ง</td></tr></table>' +
      '<div class="modal-act col"><button class="btn primary" id="cmE">เพิ่มเวลา' + (a.status === 'DONE' ? ' / เปิดให้ทำต่อ' : '') + '</button><button class="btn danger" id="cmR">ล้างตอนนี้ให้เริ่มทำใหม่</button></div>', { cls: 'sm' });
    $('#cmE', b).onclick = function () { extendBox(secId, no); };
    $('#cmR', b).onclick = function () {
      askPass('ล้างตอนให้เริ่มใหม่', '<div class="note bad">คำตอบ ไฟล์ และคะแนนของตอนนี้ของเลขประจำตัวสอบ ' + esc(no3(no)) + ' จะถูกลบ และผู้เข้าสอบจะเริ่มตอนนี้ใหม่ได้เต็มเวลา</div>', 'ล้างตอน', true).then(function (r) {
        if (!r) return; api('resetSection', { examId: BD.id, examNo: no, secId: secId, password: r.password, reason: r.reason }).then(function () { toast('ล้างตอนแล้ว', 'ok'); load(); BD.at = 0; }).catch(function (er) { toast(er.message, 'bad'); });
      });
    };
  }
  if (BD.mon && BD.mon.exam.examId === BD.id) draw();
  load();
  BD.monT = setInterval(function () { if (!document.hidden && $('#modal').hidden) load(); }, 20000);
  BD.tickT = setInterval(function () { $$('.mn-t').forEach(function (el) { var l = +el.dataset.due - now(); el.textContent = fmtClock(l); el.classList.toggle('late', l <= 0); }); }, 1000);
}

/* ---------- บันทึกคะแนน (ใช้ร่วมกัน) ---------- */
function saveGrade(examNo, items, el) {
  if (el) { el.className = 'gsave'; el.textContent = 'กำลังบันทึก…'; }
  return api('saveGrades', { examId: BD.id, examNo: examNo, items: items }).then(function () {
    var c = BD.data.candidates.filter(function (x) { return x.examNo === examNo; })[0];
    items.forEach(function (it) { c.my[it.item] = { score: it.score === '' || it.score === null ? null : Number(it.score), comment: it.comment || '' }; });
    BD.at = 0; if (el) { el.className = 'gsave ok'; el.textContent = 'บันทึกแล้ว ' + new Date().toLocaleTimeString('th-TH', { hour12: false }); }
  }).catch(function (e) { if (el) { el.className = 'gsave bad'; el.textContent = e.message; } toast(e.message, 'bad'); throw e; });
}
function scoreVal(inp, max) {
  var v = inp.value.trim(); if (v === '') return '';
  var n = Number(v); if (isNaN(n) || n < 0 || n > max) { inp.classList.add('err'); return null; }
  inp.classList.remove('err'); return Math.round(n * 100) / 100;
}

/* ---------- ตรวจข้อเขียน ---------- */
function tabEssay() {
  var d = BD.data, items = d.items.filter(function (i) { return i.kind === 'ESSAY'; });
  if (!items.length) { $('#tab').innerHTML = '<div class="card empty"><h3>รอบสอบนี้ไม่มีข้อเขียน</h3></div>'; return; }
  if (!BD.essayQ || !items.some(function (i) { return i.item === BD.essayQ; })) BD.essayQ = items[0].item;
  function draw() {
    var it = items.filter(function (i) { return i.item === BD.essayQ; })[0], ans = BD.essays.answers, ro = readonly();
    var list = activeCands().filter(function (c) { return ans[c.examNo]; });
    var mine = list.filter(function (c) { return c.my[it.item] && c.my[it.item].score !== null; }).length, only = sess('tg_only') === 1;
    var h = '<div class="seg wide">' + items.map(function (i) { return '<button data-q="' + esc(i.item) + '" class="' + (i.item === it.item ? 'on' : '') + '">' + esc(i.label) + ' <small>(' + i.max + ' คะแนน)</small></button>'; }).join('') + '</div>' +
      '<div class="gradegrid"><aside class="card rubric"><span class="eyebrow">' + esc(it.cat || it.label) + '</span><div class="qt">' + nl2br(it.text) + '</div><h3>เกณฑ์ให้คะแนน (เต็ม ' + it.max + ')</h3><div class="rub">' + nl2br(it.rubric) + '</div></aside><div>' +
      '<div class="gbar"><span>ท่านให้คะแนนแล้ว <b>' + mine + ' / ' + list.length + '</b> คน</span><label class="chk"><input type="checkbox" id="esOnly"' + (only ? ' checked' : '') + '> แสดงเฉพาะที่ยังไม่ให้คะแนน</label></div>';
    if (!list.length) h += '<div class="card empty"><h3>ยังไม่มีคำตอบข้อเขียน</h3><p class="muted">คำตอบจะแสดงเมื่อผู้เข้าสอบเริ่มทำตอนทฤษฎี</p></div>';
    list.forEach(function (c) {
      var my = c.my[it.item] || {}, av = c.avg[it.item] || {}, txt = ans[c.examNo][it.item] || '';
      if (only && my.score !== null && my.score !== undefined) return;
      h += '<article class="card gcard" data-no="' + esc(c.examNo) + '"><header>' + cLabel(c) + (ans[c.examNo]._status !== 'DONE' ? '<span class="tag warn">ยังทำไม่เสร็จ</span>' : '') + '<span class="muted sm">' + txt.length.toLocaleString() + ' ตัวอักษร</span></header>' +
        (txt.trim() ? '<div class="ans">' + nl2br(txt) + '</div>' : '<div class="ans none">— ไม่ได้ตอบ —</div>') +
        '<footer><label class="sc">คะแนน<input type="number" class="g-s" min="0" max="' + it.max + '" step="0.5" value="' + (my.score === null || my.score === undefined ? '' : my.score) + '"' + (ro ? ' disabled' : '') + '><span>/ ' + it.max + '</span></label>' +
        '<input class="g-c" maxlength="500" placeholder="ความเห็น (ไม่บังคับ)" value="' + esc(my.comment || '') + '"' + (ro ? ' disabled' : '') + '><span class="gavg">' + (av.n && (d.isAdmin || ro || my.score !== null && my.score !== undefined) ? 'เฉลี่ย ' + num(av.avg) + ' (' + av.n + ' ท่าน)' : '') + '</span><span class="gsave"></span></footer></article>';
    });
    $('#tab').innerHTML = h + '</div></div>';
    $$('.seg.wide button').forEach(function (b) { b.onclick = function () { BD.essayQ = b.dataset.q; draw(); }; });
    $('#esOnly').onchange = function () { sess('tg_only', this.checked ? 1 : null); draw(); };
    $$('.gcard').forEach(function (card) {
      var s = $('.g-s', card), cm = $('.g-c', card), st = $('.gsave', card);
      function save() { var v = scoreVal(s, it.max); if (v === null) { st.className = 'gsave bad'; st.textContent = 'คะแนนต้องอยู่ระหว่าง 0–' + it.max; return; } saveGrade(card.dataset.no, [{ item: it.item, score: v, comment: cm.value }], st).catch(function () { }); }
      s.onchange = save; cm.onchange = save;
    });
  }
  if (BD.essays) draw(); else { $('#tab').innerHTML = '<div class="boot"><div class="boot-ring"></div><p>กำลังโหลดคำตอบ…</p></div>'; api('getEssays', { examId: BD.id }).then(function (r) { BD.essays = r; if (BD.tab === 'essay') draw(); }).catch(function (e) { toast(e.message, 'bad'); }); }
}

/* ---------- ตรวจภาคปฏิบัติ ---------- */
function tabPractical() {
  var d = BD.data, items = d.items.filter(function (i) { return i.kind === 'PRACTICAL'; }), ro = readonly();
  if (!items.length) { $('#tab').innerHTML = '<div class="card empty"><h3>รอบสอบนี้ไม่มีภาคปฏิบัติ</h3></div>'; return; }
  var secId = items[0].secId, max = items.reduce(function (a, i) { return a + i.max; }, 0), list = activeCands().filter(function (c) { return c.secs[secId]; });
  var h = '<details class="card rubric-d"><summary><b>เกณฑ์ให้คะแนนภาคปฏิบัติ (เต็ม ' + max + ')</b><span class="muted sm">คลิกเพื่อเปิด/ปิด</span></summary><table class="tbl"><thead><tr><th>หัวข้อ</th><th class="r">เต็ม</th><th>เกณฑ์</th></tr></thead><tbody>' +
    items.map(function (i) { return '<tr><td><b>' + esc(i.label) + '</b></td><td class="r">' + i.max + '</td><td>' + esc(i.rubric) + '</td></tr>'; }).join('') + '</tbody></table></details>';
  if (!list.length) h += '<div class="card empty"><h3>ยังไม่มีผู้เข้าสอบเริ่มทำภาคปฏิบัติ</h3></div>';
  list.forEach(function (c) {
    var a = c.secs[secId], sum = 0, any = false;
    items.forEach(function (i) { var m = c.my[i.item]; if (m && m.score !== null) { sum += m.score; any = true; } });
    h += '<article class="card pcard" data-no="' + esc(c.examNo) + '"><header>' + cLabel(c) + (a.status === 'DONE' ? '<span class="tag ok">ส่งแล้ว ' + tTime(a.submitAt) + '</span>' : '<span class="tag warn">กำลังทำ</span>') + flagTags(a.flag) +
      (a.hasFile ? '<button class="btn ghost-dark sm p-dl">' + ICON.down + 'ดาวน์โหลดไฟล์คำตอบ</button><span class="muted sm">' + esc(a.fileName) + ' · ' + tTime(a.fileAt, true) + ' น.</span>' : '<span class="muted sm">ไม่มีไฟล์</span>') + '</header>' +
      '<div class="pitems">' + items.map(function (i) { var m = c.my[i.item] || {}, av = c.avg[i.item] || {}; return '<label title="' + esc(i.rubric) + '"><span>' + esc(i.label) + '</span><div><input type="number" class="p-s" data-item="' + esc(i.item) + '" data-max="' + i.max + '" min="0" max="' + i.max + '" step="0.5" value="' + (m.score === null || m.score === undefined ? '' : m.score) + '"' + (ro ? ' disabled' : '') + '><i>/ ' + i.max + '</i></div><small>' + (av.n && (d.isAdmin || ro || m.score !== null && m.score !== undefined) ? 'เฉลี่ย ' + num(av.avg) + ' (' + av.n + ')' : '&nbsp;') + '</small></label>'; }).join('') + '</div>' +
      '<footer><span class="ptotal">คะแนนของท่าน <b>' + (any ? num(sum) : '–') + '</b> / ' + max + '</span><input class="p-c" maxlength="500" placeholder="บันทึกของกรรมการ เช่น ประเด็นที่ควรซักถามในการสัมภาษณ์" value="' + esc((c.my.NOTE || {}).comment || '') + '"' + (ro ? ' disabled' : '') + '>' +
      (ro ? '' : '<button class="btn primary sm p-save">บันทึกคะแนน</button>') + '<span class="gsave"></span></footer></article>';
  });
  $('#tab').innerHTML = h;
  $$('.pcard').forEach(function (card) {
    var no = card.dataset.no, st = $('.gsave', card);
    function total() { var s = 0, any = false; $$('.p-s', card).forEach(function (x) { if (x.value !== '') { s += Number(x.value) || 0; any = true; } }); $('.ptotal b', card).textContent = any ? num(s) : '–'; }
    $$('.p-s', card).forEach(function (x) { x.oninput = function () { total(); st.className = 'gsave'; st.textContent = 'ยังไม่ได้บันทึก'; }; });
    var dl = $('.p-dl', card); if (dl) dl.onclick = function () { busy(dl, true, 'กำลังเตรียมไฟล์…'); api('getCandFile', { examId: BD.id, examNo: no, secId: secId }).then(function (r) { saveBlob(r.name, b64Blob(r.b64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')); busy(dl, false); }).catch(function (e) { busy(dl, false); toast(e.message, 'bad'); }); };
    var sv = $('.p-save', card); if (sv) sv.onclick = function () {
      var its = [], bad = false; $$('.p-s', card).forEach(function (x) { var v = scoreVal(x, +x.dataset.max); if (v === null) bad = true; else its.push({ item: x.dataset.item, score: v }); });
      if (bad) { st.className = 'gsave bad'; st.textContent = 'มีคะแนนที่เกินคะแนนเต็ม'; return; }
      its.push({ item: 'NOTE', comment: $('.p-c', card).value }); busy(sv, true, 'กำลังบันทึก…'); saveGrade(no, its, st).then(function () { busy(sv, false); }, function () { busy(sv, false); });
    };
  });
}

/* ---------- ทัศนคติและบุคลิกภาพ (ไม่คิดคะแนน) ---------- */
function tabProfile() {
  var d = BD.data, list = activeCands().filter(function (c) { return c.profile; });
  var h = '<div class="note info">ข้อมูลส่วนนี้ <b>ไม่นำไปคิดคะแนน</b> ใช้ประกอบการสัมภาษณ์เท่านั้น · ระดับ 1–4 คือค่าเฉลี่ยความเหมาะสมของตัวเลือกที่ผู้เข้าสอบเลือกในแต่ละมิติ (4 = เหมาะสมที่สุด) · แบบทดสอบบุคลิกภาพ 4 ข้อมีความเที่ยงต่ำ ไม่ควรใช้ตัดสินบุคคล</div>';
  if (!list.length) { $('#tab').innerHTML = h + '<div class="card empty"><h3>ยังไม่มีผู้เข้าสอบส่งตอนทัศนคติและบุคลิกภาพ</h3></div>'; return; }
  h += '<div class="card"><div class="tblwrap"><table class="tbl prof"><thead><tr><th>ผู้เข้าสอบ</th><th>บุคลิกภาพ</th>' + d.dims.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
    list.map(function (c) { return '<tr data-no="' + esc(c.examNo) + '"><td>' + cLabel(c) + '</td><td>' + (c.profile.mbti ? '<span class="mbti">' + esc(c.profile.mbti) + '</span>' : '<span class="muted">ตอบไม่ครบ</span>') + '</td>' +
      d.dims.map(function (x) { var v = c.profile.dims[x]; return '<td>' + (v ? '<div class="lv lv' + Math.round(v) + '"><i style="width:' + (v / 4 * 100) + '%"></i></div><small>' + num(v, 1) + '</small>' : '<span class="muted">–</span>') + '</td>'; }).join('') + '<td><button class="btn link pf-open">ดูคำตอบ</button></td></tr>'; }).join('') + '</tbody></table></div></div>';
  $('#tab').innerHTML = h;
  $$('.pf-open').forEach(function (b) {
    b.onclick = function () {
      var no = b.closest('tr').dataset.no; busy(b, true, 'กำลังโหลด…');
      api('getProfile', { examId: BD.id, examNo: no }).then(function (p) {
        busy(b, false);
        var c = d.candidates.filter(function (x) { return x.examNo === no; })[0];
        modal('<h2>เลขประจำตัวสอบ ' + esc(no3(no)) + (c.name ? ' · ' + esc(c.name) : '') + '</h2>' + (p.mbti ? '<div class="note"><span class="mbti">' + esc(p.mbti) + '</span> ' + esc(p.mbtiDesc) + '</div>' : '') +
          '<div class="pfl">' + p.items.map(function (it, i) {
            return it.type === 'SJT' ? '<div class="pfi"><div class="pfh"><span class="tag">' + esc(it.cat) + '</span>' + (it.level ? '<span class="lvb lv' + it.level + '">ระดับ ' + it.level + '</span>' : '<span class="tag">ไม่ได้ตอบ</span>') + '</div><p>' + esc(it.text) + '</p><p class="pfa"><b>เลือก:</b> ' + esc(it.choice || '–') + '</p>' + (it.level && it.level < 4 ? '<p class="pfb"><b>ตัวเลือกระดับ 4:</b> ' + esc(it.best) + '</p>' : '') + '</div>'
              : '<div class="pfi"><div class="pfh"><span class="tag">บุคลิกภาพ</span><span class="mbti sm">' + esc(it.letter || '?') + '</span></div><p>' + esc(it.text) + '</p><p class="pfa"><b>เลือก:</b> ' + esc(it.choice || '–') + '</p></div>';
          }).join('') + '</div>', { cls: 'lg' });
      }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); });
    };
  });
}

/* ---------- สรุปผล ---------- */
function tabResults() {
  var d = BD.data, t = d.totals, list = activeCands().filter(function (c) { return c.result.started; }).sort(function (a, b) { return (a.result.rank || 999) - (b.result.rank || 999); });
  var hasEssay = d.items.some(function (i) { return i.kind === 'ESSAY'; }), hasPr = t.practMax > 0, mcqMax = d.sections.reduce(function (a, s) { return a + s.mcqMax; }, 0);
  var done = list.filter(function (c) { return c.result.complete; }), pass = done.filter(function (c) { return c.result.pass; }).length, tot = list.map(function (c) { return c.result.total; });
  var h = '<div class="kpis"><div class="kpi"><b>' + list.length + '</b><span>ผู้เข้าสอบ</span><small>ตรวจครบ ' + done.length + ' คน</small></div><div class="kpi ok"><b>' + pass + '</b><span>ผ่านเกณฑ์</span><small>ตั้งแต่ ' + t.passMin + ' คะแนน</small></div>' +
    '<div class="kpi"><b>' + (tot.length ? num(tot.reduce(function (a, b) { return a + b; }, 0) / tot.length, 1) : '–') + '</b><span>คะแนนเฉลี่ย</span><small>จากเต็ม ' + t.totalMax + '</small></div><div class="kpi"><b>' + (tot.length ? num(Math.max.apply(null, tot)) : '–') + '</b><span>คะแนนสูงสุด</span><small>ต่ำสุด ' + (tot.length ? num(Math.min.apply(null, tot)) : '–') + '</small></div></div>';
  h += '<div class="card"><div class="card-head"><div><h2 class="card-t">ผลคะแนนเรียงตามลำดับ</h2><p class="card-s">คะแนนข้อเขียนและภาคปฏิบัติเป็นค่าเฉลี่ยของกรรมการ · คะแนนเท่ากันให้ผู้ได้ภาคปฏิบัติสูงกว่าอยู่ลำดับดีกว่า' + (done.length < list.length ? ' · <b>ยังตรวจไม่ครบ ' + (list.length - done.length) + ' คน ลำดับอาจเปลี่ยน</b>' : '') + '</p></div><div class="acts noprint">' +
    (d.isAdmin ? '<button class="btn ghost-dark sm" id="rsItem">วิเคราะห์ข้อสอบ</button>' + (readonly() ? '' : '<button class="btn ghost-dark sm" id="rsRe">คำนวณคะแนนปรนัยใหม่</button>') : '') + '<button class="btn ghost-dark sm" id="rsCsv">' + ICON.down + 'ส่งออก CSV</button><button class="btn ghost-dark sm" id="rsPrint">' + ICON.print + 'พิมพ์</button></div></div>';
  if (!list.length) h += '<p class="muted">ยังไม่มีผู้เข้าสอบเริ่มทำข้อสอบ</p>';
  else h += '<div class="tblwrap"><table class="tbl res"><thead><tr><th class="c">ลำดับ</th><th>ผู้เข้าสอบ</th><th class="r">ปรนัย<small>/' + mcqMax + '</small></th>' + (hasEssay ? '<th class="r">ข้อเขียน<small>/' + (t.theoryMax - mcqMax) + '</small></th>' : '') + (hasPr ? '<th class="r">ทฤษฎีรวม<small>/' + t.theoryMax + '</small></th><th class="r">ปฏิบัติ<small>/' + t.practMax + '</small></th>' : '') + '<th class="r">รวม<small>/' + t.totalMax + '</small></th><th>ผล</th><th>หมายเหตุ</th></tr></thead><tbody>' +
    list.map(function (c) {
      var r = c.result, fl = []; Object.keys(c.secs).forEach(function (k) { String(c.secs[k].flag || '').split(',').filter(String).forEach(function (f) { if (fl.indexOf(f) < 0) fl.push(f); }); });
      var bl = Object.keys(c.secs).reduce(function (a, k) { return a + (c.secs[k].blur || 0); }, 0);
      return '<tr class="' + (r.complete ? (r.pass ? 'pass' : 'fail') : '') + '"><td class="c"><span class="rank' + (r.rank <= 3 ? ' top' : '') + '">' + (r.rank || '–') + '</span></td><td>' + cLabel(c) + '</td><td class="r">' + num(r.mcq) + '</td>' + (hasEssay ? '<td class="r">' + num(r.essay) + '</td>' : '') + (hasPr ? '<td class="r">' + num(r.theory) + '</td><td class="r">' + num(r.practical) + '</td>' : '') +
        '<td class="r"><b class="tot">' + num(r.total) + '</b></td><td>' + (r.complete ? (r.pass ? '<span class="tag ok">ผ่าน</span>' : '<span class="tag bad">ไม่ผ่าน</span>') : '<span class="tag warn">รอตรวจ</span>') + '</td><td>' + flagTags(fl.join(',')) + (bl ? '<span class="tag ' + (bl >= 3 ? 'bad' : 'warn') + '">ออกจอ ' + bl + '</span>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  $('#tab').innerHTML = h + '</div>';
  $('#rsPrint').onclick = function () { window.print(); };
  $('#rsCsv').onclick = function () {
    var e = d.exam, head = ['ลำดับ', 'เลขประจำตัวสอบ'].concat(d.blind ? [] : ['ชื่อ-สกุล'], ['ปรนัย', 'ข้อเขียน', 'ทฤษฎีรวม', 'ปฏิบัติ', 'รวม', 'ผล', 'บุคลิกภาพ'], d.dims, d.items.map(function (i) { return i.label + ' (เฉลี่ย)'; }), ['จำนวนกรรมการที่ให้คะแนน', 'หมายเหตุ', 'สลับหน้าจอ (ครั้ง)']);
    var rows = [[e.title], [e.examDate + ' ' + e.place], ['ส่งออกเมื่อ ' + tDate(now()) + ' · สถานะ ' + ST_TH[e.status] + ' · เกณฑ์ผ่าน ' + t.passMin + '/' + t.totalMax], [], head];
    list.forEach(function (c) {
      var r = c.result, fl = []; Object.keys(c.secs).forEach(function (k) { String(c.secs[k].flag || '').split(',').filter(String).forEach(function (f) { fl.push(FLAG_TH[f] || f); }); });
      rows.push([r.rank || '', c.examNo].concat(d.blind ? [] : [c.name], [r.mcq, r.essay, r.theory, r.practical, r.total, r.complete ? (r.pass ? 'ผ่าน' : 'ไม่ผ่าน') : 'รอตรวจ', c.profile ? c.profile.mbti : ''], d.dims.map(function (x) { return c.profile ? c.profile.dims[x] : ''; }),
        d.items.map(function (i) { return c.avg[i.item].avg; }), [Math.max.apply(null, d.items.map(function (i) { return c.avg[i.item].n; }).concat([0])), fl.join(' / '), Object.keys(c.secs).reduce(function (a, k) { return a + (c.secs[k].blur || 0); }, 0)]));
    });
    saveCsv('TalentGate_Result_' + e.examId + '.csv', rows);
  };
  if ($('#rsRe')) $('#rsRe').onclick = function () { confirmBox('คำนวณคะแนนปรนัยใหม่', '<p>ใช้หลังแก้ไขเฉลยในคลังข้อสอบ ระบบจะตรวจคำตอบปรนัยของทุกคนใหม่ตามเฉลยปัจจุบัน</p>', 'คำนวณใหม่').then(function (y) { if (y) api('rescore', { examId: BD.id }).then(function (r) { toast('ตรวจใหม่ ' + r.n + ' คน คะแนนเปลี่ยน ' + r.changed + ' คน', 'ok'); loadBoard(); }).catch(function (e) { toast(e.message, 'bad'); }); }); };
  if ($('#rsItem')) $('#rsItem').onclick = function () {
    var b = this; busy(b, true, 'กำลังคำนวณ…');
    api('getExport', { examId: BD.id }).then(function (x) {
      busy(b, false); var n = x.rows.length, cat = {};
      var qs = x.questions.map(function (q) { var ok = 0, dist = [0, 0, 0, 0], skip = 0; x.rows.forEach(function (r) { var v = r.answers[q.qId]; if (!v) skip++; else { dist[v - 1]++; if (v === q.answer) ok++; } }); var p = n ? ok / n : 0; (cat[q.cat] = cat[q.cat] || []).push(p); return { q: q, p: p, dist: dist, skip: skip }; }).sort(function (a, b) { return a.p - b.p; });
      modal('<h2>วิเคราะห์ข้อสอบปรนัย</h2><p class="muted">จากผู้ส่งคำตอบ ' + n + ' คน · เรียงจากข้อที่ตอบถูกน้อยที่สุด · ข้อที่ตอบถูกต่ำกว่าร้อยละ 20 หรือสูงกว่าร้อยละ 95 ควรทบทวนโจทย์/เฉลย</p>' +
        '<div class="catbars">' + Object.keys(cat).map(function (k) { var m = cat[k].reduce(function (a, b) { return a + b; }, 0) / cat[k].length; return '<div><span>' + esc(k) + '</span><div class="bar"><i style="width:' + Math.round(m * 100) + '%"></i></div><b>' + Math.round(m * 100) + '%</b></div>'; }).join('') + '</div>' +
        '<div class="tblwrap"><table class="tbl"><thead><tr><th>ข้อ</th><th>โจทย์</th><th class="r">ตอบถูก</th><th>การเลือก ก / ข / ค / ง (ไม่ตอบ)</th></tr></thead><tbody>' + qs.map(function (o) {
          return '<tr><td><small>' + esc(o.q.qId) + '</small></td><td>' + esc(o.q.text.slice(0, 110)) + (o.q.text.length > 110 ? '…' : '') + '<br><small class="muted">เฉลย ' + TH[o.q.answer - 1] + '. ' + esc(o.q.choices[o.q.answer - 1]) + '</small></td><td class="r"><span class="tag ' + (o.p < .2 || o.p > .95 ? 'bad' : o.p < .4 ? 'warn' : 'ok') + '">' + Math.round(o.p * 100) + '%</span></td><td>' + o.dist.map(function (v, i) { return i + 1 === o.q.answer ? '<b>' + v + '</b>' : v; }).join(' / ') + ' (' + o.skip + ')</td></tr>';
        }).join('') + '</tbody></table></div>', { cls: 'xl' });
    }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); });
  };
}
