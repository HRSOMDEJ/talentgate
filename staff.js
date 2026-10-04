/* =====================================================================
   SOMDEJ TalentGate · staff.js — หน้ากรรมการ/ผู้ดูแล: รอบสอบ · ภาพรวม · ติดตามสอบ · ตรวจ · สรุปผล
   ===================================================================== */
var BD = { id: null, data: null, at: 0, tab: null, essays: null, mon: null, monT: null, tickT: null, essayQ: null, docs: null };
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
  if (BD.id !== examId) { BD.data = null; BD.essays = null; BD.mon = null; BD.essayQ = null; BD.docs = null; }
  BD.id = examId; BD.tab = tab;
  if (BD.data) drawBoard(); else $('#app').innerHTML = '<div class="boot"><div class="boot-ring"></div><p>กำลังโหลดข้อมูลรอบสอบ…</p></div>';
  if (!fresh) loadBoard();
}
function loadBoard(quiet) {
  var ver = saveGrade._ver || 0;
  return api('getBoard', { examId: BD.id }).then(function (d) {
    // มีการบันทึกคะแนนระหว่างที่โหลด → ข้อมูลชุดนี้อาจเก่ากว่าที่เพิ่งกรอก: ทิ้ง แล้วโหลดใหม่เมื่อบันทึกเสร็จ (กันคะแนนบนจอย้อนกลับ)
    if (BD.data && BD.data.exam.examId === BD.id && ((saveGrade._n || 0) > 0 || (saveGrade._ver || 0) !== ver)) return savesIdle().then(function () { return loadBoard(quiet); });
    var first = !BD.data; BD.data = d; BD.at = Date.now(); if (TG.view === 'board' && !editingNow()) { if (first) enterAnim(); drawBoard(); } return d; })
    .catch(function (e) { toast(e.message, 'bad'); if (!BD.data) { location.hash = '#/staff'; } });
}
/** ไม่วาดหน้าใหม่ทับขณะกรรมการกำลังพิมพ์คะแนน */
function editingNow() { var a = document.activeElement; return a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest && a.closest('#tab') && (BD.tab === 'essay' || BD.tab === 'practical' || BD.tab === 'setup' || BD.tab === 'cands' || BD.tab === 'interview'); }
function drawBoard() {
  var d = BD.data, e = d.exam, tabs = [['overview', 'ภาพรวม'], ['monitor', 'ติดตามสอบ'], ['essay', 'ตรวจข้อเขียน'], ['practical', 'ตรวจภาคปฏิบัติ'], ['profile', 'ทัศนคติและบุคลิกภาพ'], ['interview', 'สัมภาษณ์'], ['results', 'สรุปผล'], ['reports', 'รายงาน'], ['survey', 'ความพึงพอใจ']];
  if (d.isAdmin) tabs.push(['cands', 'ผู้เข้าสอบ'], ['setup', 'ตั้งค่ารอบสอบ']);
  if (!tabs.some(function (t) { return t[0] === BD.tab; })) BD.tab = 'overview';
  $('#app').innerHTML = '<div class="wrap"><a class="backlink" href="#/staff">' + ICON.back + 'รอบสอบทั้งหมด</a><div class="phead"><div><span class="eyebrow">' + esc(e.posName) + '</span><h1>' + esc(e.title) + '</h1><p class="muted">' + esc(e.examDate) + (e.place ? ' · ' + esc(e.place) : '') + '</p></div>' +
    '<div class="phead-r">' + stPill(e.status) + '<button class="icon-btn dark" id="bdRef" title="โหลดข้อมูลใหม่" aria-label="โหลดข้อมูลใหม่">' + ICON.refresh + '</button></div></div>' +
    '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<a class="tab' + (t[0] === BD.tab ? ' on' : '') + '" href="#/staff/' + encodeURIComponent(e.examId) + '/' + t[0] + '">' + t[1] + '</a>'; }).join('') + '</div><div id="tab"></div></div>';
  $('#bdRef').onclick = function () { var b = this; b.classList.add('spinning'); BD.essays = null; loadBoard().then(function () { b.classList.remove('spinning'); toast('โหลดข้อมูลล่าสุดแล้ว', 'ok'); }); };
  ({ overview: tabOverview, monitor: tabMonitor, essay: tabEssay, practical: tabPractical, profile: tabProfile, results: tabResults, survey: tabSurvey, cands: tabCands, setup: tabSetup, interview: tabInterview, reports: tabReports })[BD.tab]();
  countUp($('#tab'));
}
/** ป้ายผู้เข้าสอบ — ในหน้าตรวจ (grading) ถ้ารอบนี้ตั้ง "ปิดชื่อ" จะแสดงเฉพาะเลขประจำตัวสอบ แม้เป็นผู้ดูแล */
function cLabel(c, grading) { var hide = grading && BD.data && BD.data.exam.blind; return '<b class="cno">' + esc(no3(c.examNo)) + '</b>' + (c.name && !hide ? '<span class="cname">' + esc(c.name) + '</span>' : ''); }
/** สวิตช์แสดง/ปิดชื่อระหว่างตรวจ (ผู้ดูแลเปลี่ยนได้ทันที · ค่าเดียวกับในหน้าตั้งค่ารอบสอบ) */
function blindBar() {
  var d = BD.data, on = !d.exam.blind;
  if (!d.isAdmin) return d.exam.blind ? '<div class="blindbar"><span class="tag">ปิดชื่อผู้เข้าสอบ</span><span class="muted sm">รอบนี้ให้ตรวจโดยเห็นเฉพาะเลขประจำตัวสอบ</span></div>' : '';
  return '<div class="blindbar"><label class="sw"><input type="checkbox" id="blSw"' + (on ? ' checked' : '') + (readonly() ? ' disabled' : '') + '><i></i></label><span><b>แสดงชื่อผู้เข้าสอบในหน้าตรวจ</b> <small class="muted">' + (on ? 'กรรมการเห็นชื่อ-สกุลคู่กับเลขประจำตัวสอบ' : 'ปิดชื่อ: ทุกคนเห็นเฉพาะเลขประจำตัวสอบขณะตรวจ') + '</small></span></div>';
}
function bindBlind(redraw) {
  var sw = $('#blSw'); if (!sw) return;
  sw.onchange = function () {
    var blind = !sw.checked;
    api('setExamBlind', { examId: BD.id, blind: blind }).then(function () { BD.data.exam.blind = blind; AD.at = 0; toast(blind ? 'ปิดชื่อผู้เข้าสอบในหน้าตรวจแล้ว' : 'แสดงชื่อผู้เข้าสอบในหน้าตรวจแล้ว', 'ok'); return loadBoard(); }).then(function () { if (redraw) redraw(); }).catch(function (e) { sw.checked = !sw.checked; toast(e.message, 'bad'); });
  };
}
function activeCands() { return BD.data.candidates.filter(function (c) { return c.status === 'ACTIVE'; }); }
function readonly() { return BD.data.exam.status === 'FINAL'; }

/* ---------- ภาพรวม ---------- */
function tabOverview() {
  var d = BD.data, e = d.exam, act = activeCands(), secs = d.sections;
  var logged = act.filter(function (c) { return c.lastLogin; }).length, allDone = act.filter(function (c) { return secs.every(function (s) { return c.secs[s.secId] && c.secs[s.secId].status === 'DONE'; }); }).length;
  var started = act.filter(function (c) { return c.result.started; }), graded = started.filter(function (c) { return c.result.complete; }).length;
  var h = '<div class="kpis"><div class="kpi"><b data-cu="' + act.length + '">' + act.length + '</b><span>ผู้มีสิทธิ์สอบ</span><small>จากรายชื่อ ' + d.candidates.length + ' คน</small></div><div class="kpi"><b data-cu="' + logged + '">' + logged + '</b><span>เข้าระบบแล้ว</span><small>' + (act.length - logged) + ' คนยังไม่เข้า</small></div>' +
    '<div class="kpi"><b data-cu="' + allDone + '">' + allDone + '</b><span>ส่งครบทุกตอน</span><small>จากผู้เริ่มสอบ ' + started.length + ' คน</small></div><div class="kpi"><b data-cu="' + graded + '">' + graded + '</b><span>ตรวจครบแล้ว</span><small>' + (started.length - graded) + ' คนรอตรวจ</small></div></div>';
  if (d.isAdmin) {
    var i = ['DRAFT', 'OPEN', 'GRADING', 'FINAL'].indexOf(e.status), next = [['OPEN', 'เปิดสอบ', 'ผู้เข้าสอบจะเข้าสู่ระบบและเริ่มทำข้อสอบได้'], ['GRADING', 'ปิดรับคำตอบ', 'ผู้เข้าสอบจะเข้าระบบไม่ได้อีก ตอนที่ยังทำค้างจะถูกปิดด้วยคำตอบที่บันทึกไว้ล่าสุด'], ['FINAL', 'ยืนยันผลสอบ', 'คะแนนทั้งหมด' + (e.ivOn ? ' (รวมคะแนนสัมภาษณ์) ' : '') + 'จะถูกล็อก กรรมการแก้ไขไม่ได้อีก' + (e.ivOn ? ' — กดเมื่อสัมภาษณ์และให้คะแนนเสร็จทุกคนแล้วเท่านั้น' : '')], null][i];
    h += '<div class="card"><div class="card-head"><div><h2 class="card-t">ขั้นตอนของรอบสอบ</h2><p class="card-s">สถานะปัจจุบัน: ' + ST_TH[e.status] + '</p></div><div class="acts">' + (i > 0 ? '<button class="btn ghost-dark sm" id="ovBack">ย้อนเป็น "' + ST_TH[['DRAFT', 'OPEN', 'GRADING'][i - 1]] + '"</button>' : '') + (next ? '<button class="btn primary" id="ovNext">' + next[1] + '</button>' : '') + '</div></div>' +
      '<ol class="flow">' + ['DRAFT', 'OPEN', 'GRADING', 'FINAL'].map(function (s, j) { return '<li class="' + (j < i ? 'done' : j === i ? 'cur' : '') + '"><i>' + (j < i ? ICON.check : j + 1) + '</i><span>' + ['เตรียมรอบสอบ', 'เปิดสอบ', e.ivOn ? 'ตรวจ สัมภาษณ์ และให้คะแนน' : 'ตรวจและให้คะแนน', 'ยืนยันผล'][j] + '</span></li>'; }).join('') + '</ol>';
    if (e.status === 'DRAFT') {
      var pr = secs.filter(function (s) { return s.type === 'PRACTICAL' && !s.hasTemplate; });
      h += '<ul class="checks"><li class="' + (act.length ? 'ok' : 'no') + '">รายชื่อผู้เข้าสอบ ' + act.length + ' คน <a href="#/staff/' + encodeURIComponent(e.examId) + '/cands">จัดการรายชื่อและพิมพ์ใบรหัส</a></li>' +
        '<li class="' + (e.committee.length ? 'ok' : 'no') + '">กรรมการ ' + e.committee.length + ' คน <a href="#/staff/' + encodeURIComponent(e.examId) + '/setup">ตั้งค่ารอบสอบ</a></li>' +
        '<li class="' + (pr.length ? 'no' : 'ok') + '">ไฟล์โจทย์ภาคปฏิบัติ ' + (pr.length ? 'ยังไม่ได้อัปโหลด' : 'พร้อม') + '</li>' +
        (started.length || logged ? '<li class="no">มีข้อมูลการทำข้อสอบค้างอยู่ ' + started.length + ' คน (เช่น จากการซ้อมสอบ) <button class="btn link danger-t" id="ovClear">ล้างข้อมูลซ้อมสอบทั้งรอบ</button></li>' : '') + '</ul>';
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
    '<p class="muted sm">' + (e.blind ? 'รอบนี้ <b>ปิดชื่อผู้เข้าสอบ</b>ในหน้าตรวจ: เห็นเฉพาะเลขประจำตัวสอบ (เปลี่ยนได้ที่สวิตช์ในแท็บตรวจ) · คะแนนของแต่ละรายการคือค่าเฉลี่ยของกรรมการทุกท่านที่ให้คะแนน' : 'คะแนนของแต่ละรายการคือค่าเฉลี่ยของกรรมการทุกท่านที่ให้คะแนน') + '</p>' +
    '<p class="ov-sign">' + ICON.shield + '<span>ยืนยันคะแนนแล้ว <b>' + d.signoffs.length + '</b> รายการ' + (d.signoffs.some(function (s) { return s.grader === d.me; }) ? '' : ' · ท่านยังไม่ได้ยืนยันคะแนน') + '</span><a class="btn link" href="#/staff/' + encodeURIComponent(e.examId) + '/reports">ยืนยันคะแนน / พิมพ์รายงาน</a></p></div></div>';
  $('#tab').innerHTML = h;
  $$('[data-open]').forEach(function (x) { x.onchange = function () { api('setSectionOpen', { secId: x.dataset.open, open: x.checked }).then(function () { toast(x.checked ? 'เปิดให้เริ่มตอนนี้แล้ว' : 'ปิดไว้ก่อน ผู้เข้าสอบจะเห็นว่า "รอกรรมการเปิดให้เริ่ม"', 'ok'); loadBoard(); }).catch(function (er) { x.checked = !x.checked; toast(er.message, 'bad'); }); }; });
  function setSt(st, title, msg, needPass) {
    var p = needPass ? askPass(title, '<p>' + msg + '</p>', title) : confirmBox(title, '<p>' + msg + '</p>', title).then(function (y) { return y ? {} : null; });
    p.then(function (r) { if (!r) return; api('setExamStatus', { examId: e.examId, status: st, password: r.password }).then(function () { toast('เปลี่ยนสถานะเป็น "' + ST_TH[st] + '" แล้ว', 'ok'); TG.home = null; loadBoard(); }).catch(function (er) { toast(er.message, 'bad'); }); });
  }
  if ($('#ovClear')) $('#ovClear').onclick = function () {
    askPass('ล้างข้อมูลซ้อมสอบทั้งรอบ', '<div class="note bad">คำตอบ ไฟล์ คะแนน และแบบประเมินของ<b>ทุกคน</b>ในรอบนี้จะถูกลบถาวร ใช้หลังซ้อมสอบก่อนวันสอบจริงเท่านั้น</div><p class="muted">รายชื่อผู้เข้าสอบและรหัสเข้าสอบคงเดิม ไม่ต้องพิมพ์ใบรหัสใหม่</p>', 'ล้างข้อมูล').then(function (r) {
      if (!r) return; api('clearExamData', { examId: e.examId, password: r.password }, { timeout: 120000 }).then(function (x) { toast('ล้างแล้ว: คำตอบ ' + x.attempts + ' รายการ · คะแนน ' + x.grades + ' รายการ', 'ok'); BD.essays = null; AD.at = 0; AD.cands = null; loadBoard(); }).catch(function (er) { toast(er.message, 'bad'); });
    });
  };
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
  // ส่งทีละคำสั่งต่อผู้เข้าสอบ 1 คน ตามลำดับที่กรอก — กันคำสั่งเก่าที่ช้ากว่าไปทับคะแนนใหม่เมื่อเครือข่ายสะดุด
  var q = saveGrade._q = saveGrade._q || {}, k = BD.id + '|' + examNo, prev = q[k] || Promise.resolve(), examId = BD.id;
  saveGrade._n = (saveGrade._n || 0) + 1; saveGrade._ver = (saveGrade._ver || 0) + 1;
  var run = prev.then(function () { return api('saveGrades', { examId: examId, examNo: examNo, items: items }, { quiet: true }); });
  q[k] = run.catch(function () { }).then(function () { saveGrade._n--; saveGrade._ver++; });
  return run.then(function () {
    var c = BD.data.candidates.filter(function (x) { return x.examNo === examNo; })[0];
    items.forEach(function (it) { c.my[it.item] = { score: it.score === '' || it.score === null ? null : Number(it.score), comment: it.comment || '' }; });
    BD.at = 0; if (el) { el.className = 'gsave ok'; el.textContent = 'บันทึกแล้ว ' + new Date().toLocaleTimeString('th-TH', { hour12: false }); }
  }).catch(function (e) { if (el) { el.className = 'gsave bad'; el.textContent = e.message; } toast(e.message, 'bad'); throw e; });
}
/** รอให้คำสั่งบันทึกคะแนนที่ค้างอยู่เสร็จทั้งหมด */
function savesIdle() { var q = saveGrade._q || {}; return Promise.all(Object.keys(q).map(function (k) { return q[k]; })).then(function () { return (saveGrade._n || 0) > 0 ? savesIdle() : null; }); }
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
    var h = blindBar() + '<div class="seg wide">' + items.map(function (i) { return '<button data-q="' + esc(i.item) + '" class="' + (i.item === it.item ? 'on' : '') + '">' + esc(i.label) + ' <small>(' + i.max + ' คะแนน)</small></button>'; }).join('') + '</div>' +
      '<div class="gradegrid"><aside class="card rubric"><span class="eyebrow">' + esc(it.cat || it.label) + '</span><div class="qt">' + nl2br(it.text) + '</div><h3>เกณฑ์ให้คะแนน (เต็ม ' + it.max + ')</h3><div class="rub">' + nl2br(it.rubric) + '</div></aside><div>' +
      '<div class="gbar"><span>ท่านให้คะแนนแล้ว <b>' + mine + ' / ' + list.length + '</b> คน</span><label class="chk"><input type="checkbox" id="esOnly"' + (only ? ' checked' : '') + '> แสดงเฉพาะที่ยังไม่ให้คะแนน</label></div>';
    if (!list.length) h += '<div class="card empty"><h3>ยังไม่มีคำตอบข้อเขียน</h3><p class="muted">คำตอบจะแสดงเมื่อผู้เข้าสอบเริ่มทำตอนทฤษฎี</p></div>';
    list.forEach(function (c) {
      var my = c.my[it.item] || {}, av = c.avg[it.item] || {}, txt = ans[c.examNo][it.item] || '';
      if (only && my.score !== null && my.score !== undefined) return;
      h += '<article class="card gcard" data-no="' + esc(c.examNo) + '"><header>' + cLabel(c, true) + (ans[c.examNo]._status !== 'DONE' ? '<span class="tag warn">ยังทำไม่เสร็จ</span>' : '') + '<span class="muted sm">' + txt.length.toLocaleString() + ' ตัวอักษร</span></header>' +
        (txt.trim() ? '<div class="ans">' + nl2br(txt) + '</div>' : '<div class="ans none">— ไม่ได้ตอบ —</div>') +
        '<footer><label class="sc">คะแนน<input type="number" class="g-s" min="0" max="' + it.max + '" step="0.5" value="' + (my.score === null || my.score === undefined ? '' : my.score) + '"' + (ro ? ' disabled' : '') + '><span>/ ' + it.max + '</span></label>' +
        '<input class="g-c" maxlength="500" placeholder="ความเห็น (ไม่บังคับ)" value="' + esc(my.comment || '') + '"' + (ro ? ' disabled' : '') + '><span class="gavg">' + (av.n && (d.isAdmin || ro || my.score !== null && my.score !== undefined) ? 'เฉลี่ย ' + num(av.avg) + ' (' + av.n + ' ท่าน)' : '') + '</span><span class="gsave"></span></footer></article>';
    });
    $('#tab').innerHTML = h + '</div></div>';
    $$('.seg.wide button').forEach(function (b) { b.onclick = function () { BD.essayQ = b.dataset.q; draw(); }; });
    $('#esOnly').onchange = function () { sess('tg_only', this.checked ? 1 : null); draw(); };
    bindBlind(draw);
    $$('.gcard').forEach(function (card) {
      var s = $('.g-s', card), cm = $('.g-c', card), st = $('.gsave', card);
      function save() { var v = scoreVal(s, it.max); if (v === null) { st.className = 'gsave bad'; st.textContent = 'คะแนนต้องอยู่ระหว่าง 0–' + it.max; return; } saveGrade(card.dataset.no, [{ item: it.item, score: v, comment: cm.value }], st).catch(function () { }); }
      s.onchange = save; cm.onchange = save;
    });
  }
  // แสดงข้อมูลที่มีอยู่ทันที แล้วโหลดคำตอบล่าสุดทุกครั้งที่เปิดแท็บ (เดิมจำค่าครั้งแรกไว้ ทำให้คำตอบใหม่ไม่ขึ้น)
  if (BD.essays && BD.essays.examId === BD.id) draw(); else $('#tab').innerHTML = '<div class="boot"><div class="boot-ring"></div><p>กำลังโหลดคำตอบ…</p></div>';
  var seq = tabEssay._seq = (tabEssay._seq || 0) + 1;
  api('getEssays', { examId: BD.id }).then(function (r) { r.examId = BD.id; var first = !BD.essays; BD.essays = r; if (BD.tab === 'essay' && TG.view === 'board' && seq === tabEssay._seq && (first || !editingNow())) draw(); }).catch(function (e) { toast(e.message, 'bad'); });
}

/* ---------- ตรวจภาคปฏิบัติ ---------- */
function tabPractical() {
  var d = BD.data, items = d.items.filter(function (i) { return i.kind === 'PRACTICAL'; }), ro = readonly();
  if (!items.length) { $('#tab').innerHTML = '<div class="card empty"><h3>รอบสอบนี้ไม่มีภาคปฏิบัติ</h3></div>'; return; }
  var secId = items[0].secId, max = items.reduce(function (a, i) { return a + i.max; }, 0), list = activeCands().filter(function (c) { return c.secs[secId]; });
  var h = blindBar() + '<details class="card rubric-d"><summary><b>เกณฑ์ให้คะแนนภาคปฏิบัติ (เต็ม ' + max + ')</b><span class="muted sm">คลิกเพื่อเปิด/ปิด</span></summary><table class="tbl"><thead><tr><th>หัวข้อ</th><th class="r">เต็ม</th><th>เกณฑ์</th></tr></thead><tbody>' +
    items.map(function (i) { return '<tr><td><b>' + esc(i.label) + '</b></td><td class="r">' + i.max + '</td><td>' + esc(i.rubric) + '</td></tr>'; }).join('') + '</tbody></table></details>';
  if (!list.length) h += '<div class="card empty"><h3>ยังไม่มีผู้เข้าสอบเริ่มทำภาคปฏิบัติ</h3></div>';
  list.forEach(function (c) {
    var a = c.secs[secId], sum = 0, any = false;
    items.forEach(function (i) { var m = c.my[i.item]; if (m && m.score !== null) { sum += m.score; any = true; } });
    h += '<article class="card pcard" data-no="' + esc(c.examNo) + '"><header>' + cLabel(c, true) + (a.status === 'DONE' ? '<span class="tag ok">ส่งแล้ว ' + tTime(a.submitAt) + '</span>' : '<span class="tag warn">กำลังทำ</span>') + flagTags(a.flag) +
      (a.hasFile ? '<button class="btn ghost-dark sm p-dl">' + ICON.down + 'ดาวน์โหลดไฟล์คำตอบ</button><span class="muted sm">' + esc(a.fileName) + ' · ' + tTime(a.fileAt, true) + ' น.</span>' : '<span class="muted sm">ไม่มีไฟล์</span>') + '</header>' +
      '<div class="pitems">' + items.map(function (i) { var m = c.my[i.item] || {}, av = c.avg[i.item] || {}; return '<label title="' + esc(i.rubric) + '"><span>' + esc(i.label) + '</span><div><input type="number" class="p-s" data-item="' + esc(i.item) + '" data-max="' + i.max + '" min="0" max="' + i.max + '" step="0.5" value="' + (m.score === null || m.score === undefined ? '' : m.score) + '"' + (ro ? ' disabled' : '') + '><i>/ ' + i.max + '</i></div><small>' + (av.n && (d.isAdmin || ro || m.score !== null && m.score !== undefined) ? 'เฉลี่ย ' + num(av.avg) + ' (' + av.n + ')' : '&nbsp;') + '</small></label>'; }).join('') + '</div>' +
      '<footer><span class="ptotal">คะแนนของท่าน <b>' + (any ? num(sum) : '–') + '</b> / ' + max + '</span><input class="p-c" maxlength="500" placeholder="บันทึกของกรรมการ เช่น ประเด็นที่ควรซักถามในการสัมภาษณ์" value="' + esc((c.my.NOTE || {}).comment || '') + '"' + (ro ? ' disabled' : '') + '>' +
      (ro ? '' : '<button class="btn primary sm p-save">บันทึกคะแนน</button>') + '<span class="gsave"></span></footer></article>';
  });
  $('#tab').innerHTML = h; bindBlind(tabPractical);
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
/* คำอธิบายบุคลิกภาพ 16 แบบ: เรียบเรียงใหม่จากกรอบแนวคิด Myers–Briggs (ชื่อเล่น · ลักษณะเด่น · จุดแข็งในงาน · ประเด็นชวนคุยตอนสัมภาษณ์) */
var MB_L = { E: ['Extravert', 'ได้พลังจากการพบปะและพูดคุยกับผู้คน'], I: ['Introvert', 'ได้พลังจากการคิดทบทวนและทำงานเงียบ ๆ'], S: ['Sensing', 'ยึดข้อเท็จจริง รายละเอียด และประสบการณ์จริง'], N: ['iNtuition', 'มองภาพรวม ความเป็นไปได้ และแนวคิดใหม่'],
  T: ['Thinking', 'ตัดสินใจด้วยเหตุผลและหลักเกณฑ์'], F: ['Feeling', 'ตัดสินใจโดยคำนึงถึงคนและความรู้สึก'], J: ['Judging', 'ชอบวางแผน เป็นระเบียบ ปิดงานตามกำหนด'], P: ['Perceiving', 'ยืดหยุ่น ปรับตามสถานการณ์ เปิดรับทางเลือก'] };
var MB_T = {
  ISTJ: ['ผู้ตรวจการ', 'รอบคอบ เป็นระบบ รับผิดชอบสูง ยึดข้อเท็จจริงและระเบียบ', 'งานเอกสาร ทะเบียน และงานที่ต้องการความถูกต้องสม่ำเสมอ', 'วิธีรับมือเมื่อระเบียบเปลี่ยนกะทันหัน หรือต้องทำงานที่ยังไม่มีขั้นตอนชัดเจน'],
  ISFJ: ['ผู้พิทักษ์', 'ใส่ใจผู้อื่น ละเอียด อดทน ทำงานเบื้องหลังได้สม่ำเสมอ', 'งานบริการบุคลากร งานสนับสนุนที่ต้องดูแลรายละเอียดของคน', 'การปฏิเสธคำขอที่เกินหน้าที่ และการบอกเมื่อภาระงานมากเกินไป'],
  INFJ: ['ผู้ให้คำปรึกษา', 'มองลึก มีอุดมคติ ใส่ใจความหมายของงานและผู้คน', 'งานพัฒนาบุคลากร งานที่ต้องเข้าใจความต้องการของคน', 'การทำงานซ้ำ ๆ ที่เน้นปริมาณ และการรับคำวิจารณ์ตรง ๆ'],
  INTJ: ['นักวางกลยุทธ์', 'คิดเชิงกลยุทธ์ วางแผนระยะยาว เป็นตัวของตัวเอง', 'งานวิเคราะห์ ปรับปรุงระบบ และออกแบบขั้นตอนงาน', 'การทำงานร่วมกับผู้ที่คิดต่าง และการอธิบายแนวคิดให้ผู้อื่นเข้าใจง่าย'],
  ISTP: ['นักแก้ปัญหา', 'ลงมือแก้ปัญหาเฉพาะหน้าได้ดี ชอบทดลอง ยืดหยุ่น', 'งานที่ต้องแก้ไขสถานการณ์จริง ใช้เครื่องมือและข้อมูล', 'การทำงานเอกสารตามขั้นตอนยาว ๆ และการสื่อสารความคืบหน้าให้ทีมทราบ'],
  ISFP: ['ผู้ประสานอ่อนโยน', 'อ่อนโยน ปรับตัวง่าย ใส่ใจรายละเอียดและความรู้สึก', 'งานบริการที่ต้องการความสุภาพและความใส่ใจรายบุคคล', 'การทำงานภายใต้เส้นตายที่เร่ง และการแสดงความเห็นที่ไม่ตรงกับคนส่วนใหญ่'],
  INFP: ['นักอุดมคติ', 'ยึดคุณค่า มีความคิดสร้างสรรค์ เห็นอกเห็นใจผู้อื่น', 'งานสื่อสารภายใน งานที่ต้องเข้าใจและดูแลความรู้สึกของบุคลากร', 'การทำงานประจำที่มีกฎเกณฑ์เข้มงวด และการจัดการเมื่อถูกตำหนิ'],
  INTP: ['นักคิดวิเคราะห์', 'ช่างวิเคราะห์ ชอบหาเหตุผลและหลักการ เรียนรู้ด้วยตนเอง', 'งานข้อมูล งานตรวจสอบตรรกะ และการหาสาเหตุของปัญหา', 'การปิดงานให้ทันกำหนด และการทำงานที่ต้องประสานคนจำนวนมาก'],
  ESTP: ['นักปฏิบัติ', 'กระตือรือร้น ตัดสินใจเร็ว ถนัดงานที่ต้องลงมือทันที', 'งานหน้างาน งานประสานเร่งด่วน และการแก้ปัญหาเฉพาะหน้า', 'ความละเอียดของเอกสาร และการทำตามขั้นตอนที่ใช้เวลานาน'],
  ESFP: ['ผู้สร้างบรรยากาศ', 'ร่าเริง เข้ากับคนง่าย สร้างบรรยากาศที่ดีในทีม', 'งานต้อนรับ งานกิจกรรมบุคลากร และงานบริการที่พบผู้คน', 'การทำงานเอกสารคนเดียวเป็นเวลานาน และการวางแผนล่วงหน้า'],
  ENFP: ['นักจุดประกาย', 'มีพลัง คิดริเริ่ม จูงใจผู้อื่นได้ดี ชอบสิ่งใหม่', 'งานสื่อสารองค์กร งานกิจกรรม และการริเริ่มโครงการใหม่', 'การติดตามงานให้จบครบทุกขั้น และการทำงานที่ต้องละเอียดซ้ำ ๆ'],
  ENTP: ['นักคิดริเริ่ม', 'คิดเร็ว ชอบถกเถียงเชิงความคิด มองหาวิธีใหม่ ๆ', 'งานปรับปรุงกระบวนการ การเสนอแนวทางใหม่ และการแก้โจทย์ที่ไม่เคยมีคำตอบ', 'การทำตามระเบียบที่ตนไม่เห็นด้วย และความสม่ำเสมอในงานประจำ'],
  ESTJ: ['ผู้จัดการ', 'จัดการเก่ง ตรงไปตรงมา ทำตามแผนและกำหนดเวลา', 'งานบริหารทั่วไป การกำกับขั้นตอน และการติดตามงานให้เสร็จตามกำหนด', 'การรับฟังความเห็นที่ต่าง และความยืดหยุ่นเมื่อแผนเปลี่ยน'],
  ESFJ: ['ผู้ประสานงาน', 'เอาใจใส่ผู้อื่น ประสานงานดี ให้ความสำคัญกับความร่วมมือ', 'งานบริการบุคลากร งานประสานระหว่างหน่วยงาน และการดูแลสวัสดิการ', 'การตัดสินใจที่อาจทำให้บางคนไม่พอใจ และการรักษาความลับเมื่อถูกขอร้อง'],
  ENFJ: ['ผู้นำที่ใส่ใจคน', 'เป็นผู้นำที่ใส่ใจคน สื่อสารดี สนับสนุนการพัฒนาผู้อื่น', 'งานฝึกอบรม งานพัฒนาบุคลากร และการสื่อสารกับคนหลายกลุ่ม', 'การแบ่งเวลาระหว่างช่วยผู้อื่นกับงานของตนเอง และการให้ข้อมูลย้อนกลับเชิงลบ'],
  ENTJ: ['ผู้บัญชาการ', 'มุ่งเป้าหมาย ตัดสินใจเด็ดขาด ชอบวางระบบและนำทีม', 'งานวางระบบ การขับเคลื่อนโครงการ และการตัดสินใจภายใต้ข้อมูลจำกัด', 'การทำงานในบทบาทผู้ตามหรือผู้สนับสนุน และความอดทนต่อขั้นตอนที่ช้า']
};
function attLevel(v) { return v >= 3.5 ? ['สอดคล้องสูง', 'ok'] : v >= 3 ? ['สอดคล้อง', 'info'] : v >= 2.5 ? ['ปานกลาง', 'warn'] : ['ควรซักถามเพิ่ม', 'bad']; }
function gauge(v, max) {
  var r = 34, c = 2 * Math.PI * r, k = Math.max(0, Math.min(1, v / max));
  return '<svg class="gauge" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="' + r + '" class="g0"/><circle cx="42" cy="42" r="' + r + '" class="g1 ' + attLevel(v)[1] + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - k)).toFixed(1) + '" style="--c:' + c.toFixed(1) + '"/></svg>';
}
function tabProfile() {
  var d = BD.data, list = activeCands().filter(function (c) { return c.profile; }), byAtt = sess('tg_pfsort') === 1;
  if (byAtt) list = list.slice().sort(function (a, b) { return (b.profile.att || 0) - (a.profile.att || 0); });
  var h = blindBar() + '<div class="note info">ข้อมูลส่วนนี้ <b>ไม่นำไปคิดคะแนน</b> ใช้ประกอบการสัมภาษณ์เท่านั้น · <b>คะแนนทัศนคติ</b> (เต็ม 4) คือค่าเฉลี่ยระดับความเหมาะสมของตัวเลือกที่ผู้เข้าสอบเลือกในข้อสถานการณ์ทั้งหมด · แบบทดสอบบุคลิกภาพ 4 ข้อมีความเที่ยงต่ำ ใช้เปิดบทสนทนา ไม่ควรใช้ตัดสินรับ/ไม่รับ</div>';
  if (!list.length) { $('#tab').innerHTML = h + '<div class="card empty"><h3>ยังไม่มีผู้เข้าสอบส่งตอนทัศนคติและบุคลิกภาพ</h3></div>'; bindBlind(tabProfile); return; }
  var avg = list.reduce(function (a, c) { return a + (c.profile.att || 0); }, 0) / list.length, types = {}; list.forEach(function (c) { if (c.profile.mbti) types[c.profile.mbti] = (types[c.profile.mbti] || 0) + 1; });
  h += '<div class="gbar"><span>ผู้ส่งแล้ว <b>' + list.length + '</b> คน · คะแนนทัศนคติเฉลี่ย <b>' + num(avg, 2) + '</b> / 4 · บุคลิกภาพที่พบ: ' + (Object.keys(types).sort(function (a, b) { return types[b] - types[a]; }).map(function (t) { return '<span class="mbti sm">' + esc(t) + '</span>×' + types[t]; }).join(' ') || '–') + '</span><label class="chk"><input type="checkbox" id="pfSort"' + (byAtt ? ' checked' : '') + '> เรียงตามคะแนนทัศนคติ</label></div><div class="pfcards">';
  list.forEach(function (c, i) {
    var p = c.profile, t = MB_T[p.mbti], lv = attLevel(p.att || 0);
    h += '<article class="card pfcard" data-no="' + esc(c.examNo) + '" style="--i:' + Math.min(i, 12) + '"><header>' + cLabel(c, true) + '<button class="btn link pf-open">ดูคำตอบรายข้อ</button></header><div class="pf-grid">' +
      '<div class="pf-mb">' + (p.mbti ? '<div class="mbti-big">' + p.mbti.split('').map(function (x, j) { return '<span style="--j:' + j + '">' + esc(x) + '</span>'; }).join('') + '</div><b class="pf-nick">' + esc(t ? t[0] : 'บุคลิกภาพ ' + p.mbti) + '</b>' + (t ? '<p class="pf-desc">' + esc(t[1]) + '</p>' : '') +
        '<ul class="pf-let">' + p.mbti.split('').map(function (x) { var m = MB_L[x]; return m ? '<li><i>' + x + '</i><span><b>' + m[0] + '</b> ' + m[1] + '</span></li>' : ''; }).join('') + '</ul>' +
        (t ? '<p class="pf-x"><b>จุดแข็งในงาน:</b> ' + esc(t[2]) + '</p><p class="pf-x ask"><b>ชวนคุยตอนสัมภาษณ์:</b> ' + esc(t[3]) + '</p>' : '') : '<p class="muted">ตอบแบบทดสอบบุคลิกภาพไม่ครบ</p>') + '</div>' +
      '<div class="pf-at"><div class="pf-score">' + gauge(p.att || 0, 4) + '<div class="pf-num"><b data-cu="' + (p.att || 0).toFixed(2) + '">' + num(p.att, 2) + '</b><small>เต็ม 4</small></div></div><div class="pf-lab"><span class="eyebrow">คะแนนทัศนคติ</span><span class="tag ' + lv[1] + '">' + lv[0] + '</span><small class="muted">จาก ' + p.nAtt + ' ข้อสถานการณ์</small></div>' +
      '<div class="pf-dims">' + d.dims.map(function (x) { var v = p.dims[x]; return '<div class="pf-dim"><span>' + esc(x) + '</span>' + (v ? '<div class="lv lv' + Math.round(v) + '"><i style="width:' + (v / 4 * 100) + '%"></i></div><b>' + num(v, 1) + '</b>' : '<div class="lv"></div><b>–</b>') + '</div>'; }).join('') + '</div></div></div></article>';
  });
  $('#tab').innerHTML = h + '</div>'; bindBlind(tabProfile);
  $('#pfSort').onchange = function () { sess('tg_pfsort', this.checked ? 1 : null); tabProfile(); };
  $$('.pf-open').forEach(function (b) {
    b.onclick = function () {
      var no = b.closest('[data-no]').dataset.no; busy(b, true, 'กำลังโหลด…');
      api('getProfile', { examId: BD.id, examNo: no }).then(function (p) {
        busy(b, false);
        var c = d.candidates.filter(function (x) { return x.examNo === no; })[0], t = MB_T[p.mbti];
        modal('<h2>เลขประจำตัวสอบ ' + esc(no3(no)) + (c.name && !d.exam.blind ? ' · ' + esc(c.name) : '') + '</h2>' + (p.mbti ? '<div class="note"><span class="mbti">' + esc(p.mbti) + '</span> <b>' + esc(t ? t[0] : '') + '</b> — ' + esc(t ? t[1] : p.mbtiDesc) + '</div>' : '') +
          '<div class="pfl">' + p.items.map(function (it, i) {
            return it.type === 'SJT' ? '<div class="pfi"><div class="pfh"><span class="tag">' + esc(it.cat) + '</span>' + (it.level ? '<span class="lvb lv' + it.level + '">ระดับ ' + it.level + '</span>' : '<span class="tag">ไม่ได้ตอบ</span>') + '</div><p>' + esc(it.text) + '</p><p class="pfa"><b>เลือก:</b> ' + esc(it.choice || '–') + '</p>' + (it.level && it.level < 4 ? '<p class="pfb"><b>ตัวเลือกระดับ 4:</b> ' + esc(it.best) + '</p>' : '') + '</div>'
              : '<div class="pfi"><div class="pfh"><span class="tag">บุคลิกภาพ</span><span class="mbti sm">' + esc(it.letter || '?') + '</span></div><p>' + esc(it.text) + '</p><p class="pfa"><b>เลือก:</b> ' + esc(it.choice || '–') + '</p></div>';
          }).join('') + '</div>', { cls: 'lg' });
      }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); });
    };
  });
}

/* ---------- ความพึงพอใจของผู้เข้าสอบ ---------- */
function tabSurvey() {
  $('#tab').innerHTML = '<div class="boot"><div class="boot-ring"></div><p>กำลังโหลดผลแบบประเมิน…</p></div>';
  api('getSurvey', { examId: BD.id }).then(function (r) {
    if (BD.tab !== 'survey' || TG.view !== 'board') return;
    var agg = {}, order = r.items.slice(), all = [], cms = r.rows.filter(function (x) { return x.comment; });
    r.rows.forEach(function (x) { x.items.forEach(function (t, i) { var v = Number(x.scores[i]); if (!(v >= 1 && v <= 5)) return; if (!agg[t]) { agg[t] = [0, 0, 0, 0, 0]; if (order.indexOf(t) < 0) order.push(t); } agg[t][v - 1]++; all.push(v); }); });
    var mean = function (a) { var n = a.reduce(function (x, y) { return x + y; }, 0); return n ? a.reduce(function (x, y, i) { return x + y * (i + 1); }, 0) / n : null; };
    var tot = all.length ? all.reduce(function (a, b) { return a + b; }, 0) / all.length : null, top = all.filter(function (v) { return v >= 4; }).length;
    var h = '<div class="kpis"><div class="kpi"><b data-cu="' + r.rows.length + '">' + r.rows.length + '</b><span>ผู้ตอบแบบประเมิน</span><small>จากผู้มีสิทธิ์สอบ ' + r.nActive + ' คน</small></div><div class="kpi ok"><b' + (tot ? ' data-cu="' + tot.toFixed(2) + '"' : '') + '>' + (tot ? num(tot, 2) : '–') + '</b><span>ค่าเฉลี่ยรวม</span><small>เต็ม 5 คะแนน</small></div>' +
      '<div class="kpi"><b>' + (all.length ? Math.round(top / all.length * 100) + '%' : '–') + '</b><span>ให้ 4–5 คะแนน</span><small>สัดส่วนคำตอบระดับพอใจ</small></div><div class="kpi"><b data-cu="' + cms.length + '">' + cms.length + '</b><span>ข้อเสนอแนะ</span><small>ข้อความจากผู้เข้าสอบ</small></div></div>' +
      '<div class="card"><div class="card-head"><div><h2 class="card-t">ผลแบบประเมินความพึงพอใจการใช้ระบบสอบ</h2><p class="card-s">ผู้เข้าสอบตอบหลังส่งครบทุกตอน · ไม่บังคับ · ไม่ระบุตัวผู้ตอบ (ระบบไม่เก็บเลขประจำตัวสอบคู่กับคำตอบ)' + (r.on ? '' : ' · <b class="bad-t">ขณะนี้ปิดแบบประเมินอยู่ (เปิดได้ที่เมนูตั้งค่า)</b>') + '</p></div><div class="acts noprint"><button class="btn ghost-dark sm" id="svCsv">' + ICON.down + 'ส่งออก CSV</button><button class="btn ghost-dark sm" id="svPr">' + ICON.print + 'พิมพ์</button></div></div>';
    if (!r.rows.length) h += '<div class="empty"><h3>ยังไม่มีผู้ตอบแบบประเมิน</h3><p class="muted">แบบประเมินจะแสดงให้ผู้เข้าสอบเมื่อส่งคำตอบครบทุกตอน</p></div>';
    else h += '<div class="svres">' + order.filter(function (t) { return agg[t]; }).map(function (t, i) {
      var a = agg[t], m = mean(a), n = a.reduce(function (x, y) { return x + y; }, 0);
      return '<div class="svrow" style="--i:' + i + '"><p><b>' + (i + 1) + '.</b> ' + esc(t) + '</p><div class="svbar"><div class="bar big"><i style="width:' + (m / 5 * 100) + '%"></i></div><b>' + num(m, 2) + '</b></div><div class="svdist">' + a.map(function (v, k) { return '<span title="ให้ ' + (k + 1) + ' คะแนน ' + v + ' คน"><i style="height:' + (n ? Math.round(v / n * 100) : 0) + '%"></i><small>' + (k + 1) + '</small><em>' + v + '</em></span>'; }).join('') + '</div></div>';
    }).join('') + '</div>';
    h += '</div>' + (cms.length ? '<div class="card"><h2 class="card-t">ข้อเสนอแนะจากผู้เข้าสอบ</h2><ul class="svcm">' + cms.map(function (x) { return '<li>' + nl2br(x.comment) + '<small>' + tDate(x.at) + '</small></li>'; }).join('') + '</ul></div>' : '');
    $('#tab').innerHTML = h; countUp($('#tab'));
    $('#svPr').onclick = function () { window.print(); };
    $('#svCsv').onclick = function () {
      var e = BD.data.exam, rows = [[e.title], ['แบบประเมินความพึงพอใจการใช้ระบบสอบ · ส่งออกเมื่อ ' + tDate(now()) + ' · ผู้ตอบ ' + r.rows.length + ' คน'], [], ['เวลาที่ตอบ'].concat(order, ['ข้อเสนอแนะ'])];
      r.rows.forEach(function (x) { rows.push([tDate(x.at)].concat(order.map(function (t) { var i = x.items.indexOf(t); return i < 0 ? '' : x.scores[i]; }), [x.comment])); });
      rows.push([]); rows.push(['ค่าเฉลี่ย'].concat(order.map(function (t) { return agg[t] ? Math.round(mean(agg[t]) * 100) / 100 : ''; })));
      saveCsv('TalentGate_Survey_' + e.examId + '.csv', rows);
    };
  }).catch(function (e) { if (BD.tab === 'survey' && $('#tab')) $('#tab').innerHTML = '<div class="card empty"><h3>โหลดผลแบบประเมินไม่สำเร็จ</h3><p class="muted">' + esc(e.message) + '</p></div>'; });
}

/* ---------- สรุปผล ---------- */
function tabResults() {
  var d = BD.data, t = d.totals, list = activeCands().filter(function (c) { return c.result.started; }).sort(function (a, b) { return (a.result.rank || 999) - (b.result.rank || 999); });
  var iv = d.exam.ivOn;
  if (iv) list = activeCands().filter(function (c) { return c.result.started || c.iv; }).sort(function (a, b) { return ((a.final.rank || 9999) - (b.final.rank || 9999)) || ((a.result.rank || 9999) - (b.result.rank || 9999)) || byNo(a, b); });
  var hasProf = list.some(function (c) { return c.profile; });
  var hasEssay = d.items.some(function (i) { return i.kind === 'ESSAY'; }), hasPr = t.practMax > 0, mcqMax = d.sections.reduce(function (a, s) { return a + s.mcqMax; }, 0);
  var done = list.filter(function (c) { return c.result.complete; }), pass = done.filter(function (c) { return c.result.pass; }).length, tot = list.filter(function (c) { return c.result.started; }).map(function (c) { return c.result.total; });
  var fpass = list.filter(function (c) { return c.final && c.final.complete && c.final.pass; }).length, nIv = list.filter(function (c) { return c.iv; }).length, nStart = tot.length;
  var h = '<div class="kpis"><div class="kpi"><b data-cu="' + list.length + '">' + list.length + '</b><span>ผู้เข้าสอบ</span><small>ตรวจครบ ' + done.length + ' คน</small></div>' + (iv ? '<div class="kpi ok"><b data-cu="' + fpass + '">' + fpass + '</b><span>ผ่านเกณฑ์ (คะแนนรวม)</span><small>เข้าสัมภาษณ์ ' + nIv + ' คน · ผ่านเกณฑ์สอบ ' + pass + ' คน</small></div>' : '<div class="kpi ok"><b data-cu="' + pass + '">' + pass + '</b><span>ผ่านเกณฑ์</span><small>ตั้งแต่ ' + t.passMin + ' คะแนน</small></div>') +
    '<div class="kpi"><b>' + (tot.length ? num(tot.reduce(function (a, b) { return a + b; }, 0) / tot.length, 1) : '–') + '</b><span>คะแนนเฉลี่ย</span><small>จากเต็ม ' + t.totalMax + '</small></div><div class="kpi"><b>' + (tot.length ? num(Math.max.apply(null, tot)) : '–') + '</b><span>คะแนนสูงสุด</span><small>ต่ำสุด ' + (tot.length ? num(Math.min.apply(null, tot)) : '–') + '</small></div></div>';
  h += '<div class="card"><div class="card-head"><div><h2 class="card-t">ผลคะแนนเรียงตามลำดับ</h2><p class="card-s">' + (iv ? '<b>คะแนนรวม</b> (เต็ม 100) = คะแนนสอบ ' + (100 - d.exam.ivWeight) + '% + สัมภาษณ์ ' + d.exam.ivWeight + '% · เกณฑ์ผ่านร้อยละ ' + d.exam.passPct + ' ของคะแนนรวม · ' : '') + 'คะแนนข้อเขียน' + (iv ? ' ภาคปฏิบัติ และสัมภาษณ์' : 'และภาคปฏิบัติ') + 'เป็นค่าเฉลี่ยของกรรมการ · คะแนนเท่ากันให้ผู้ได้ภาคปฏิบัติสูงกว่าอยู่ลำดับดีกว่า' + (done.length < nStart ? ' · <b>ยังตรวจไม่ครบ ' + (nStart - done.length) + ' คน ลำดับอาจเปลี่ยน</b>' : '') + '</p></div><div class="acts noprint">' +
    (d.isAdmin ? '<button class="btn ghost-dark sm" id="rsItem">วิเคราะห์ข้อสอบ</button>' + (readonly() ? '' : '<button class="btn ghost-dark sm" id="rsRe">คำนวณคะแนนปรนัยใหม่</button>') : '') + '<button class="btn ghost-dark sm" id="rsCsv">' + ICON.down + 'ส่งออก CSV</button><a class="btn ghost-dark sm" id="rsPrint" href="#/staff/' + encodeURIComponent(d.exam.examId) + '/reports">' + ICON.print + 'พิมพ์รายงาน</a></div></div>';
  if (!list.length) h += '<p class="muted">ยังไม่มีผู้เข้าสอบเริ่มทำข้อสอบ</p>';
  else h += '<div class="tblwrap"><table class="tbl res"><thead><tr><th class="c">ลำดับ</th><th>ผู้เข้าสอบ</th><th class="r">ปรนัย<small>/' + mcqMax + '</small></th>' + (hasEssay ? '<th class="r">ข้อเขียน<small>/' + (t.theoryMax - mcqMax) + '</small></th>' : '') + (hasPr ? '<th class="r">ทฤษฎีรวม<small>/' + t.theoryMax + '</small></th><th class="r">ปฏิบัติ<small>/' + t.practMax + '</small></th>' : '') + '<th class="r">' + (iv ? 'รวมสอบ' : 'รวม') + '<small>/' + t.totalMax + '</small></th><th>' + (iv ? 'ผลสอบ' : 'ผล') + '</th>' + (iv ? '<th class="r">สัมภาษณ์<small>/' + d.ivMax + '</small></th><th class="r">คะแนนรวม<small>/100</small></th><th>ผลรวม</th>' : '') + (hasProf ? '<th class="c">ทัศนคติ<small>/4 · ไม่คิดคะแนน</small></th><th class="c">บุคลิกภาพ</th>' : '') + '<th>หมายเหตุ</th></tr></thead><tbody>' +
    list.map(function (c) {
      var r = c.result, fl = []; Object.keys(c.secs).forEach(function (k) { String(c.secs[k].flag || '').split(',').filter(String).forEach(function (f) { if (fl.indexOf(f) < 0) fl.push(f); }); });
      var bl = Object.keys(c.secs).reduce(function (a, k) { return a + (c.secs[k].blur || 0); }, 0);
      var f = c.final, rk = iv ? (f && f.rank) : r.rank, rowCls = iv ? (f && f.complete ? (f.pass ? 'pass' : 'fail') : '') : (r.complete ? (r.pass ? 'pass' : 'fail') : '');
      return '<tr class="' + rowCls + '"><td class="c"><span class="rank' + (rk && rk <= 3 ? ' top' : '') + '">' + (rk || '–') + '</span></td><td>' + cLabel(c) + '</td><td class="r">' + num(r.mcq) + '</td>' + (hasEssay ? '<td class="r">' + num(r.essay) + '</td>' : '') + (hasPr ? '<td class="r">' + num(r.theory) + '</td><td class="r">' + num(r.practical) + '</td>' : '') +
        '<td class="r"><b class="tot">' + num(r.total) + '</b></td><td>' + (!r.started ? '<span class="tag">ไม่ได้เข้าสอบ</span>' : r.complete ? (r.pass ? '<span class="tag ok">ผ่าน</span>' : '<span class="tag bad">ไม่ผ่าน</span>') : '<span class="tag warn">รอตรวจ</span>') + '</td>' +
        (iv ? '<td class="r">' + (c.iv ? num(f.iv !== null ? f.iv : f.ivPart) + (f.iv === null && f.ivPart !== null ? '*' : '') : '<span class="muted">–</span>') + '</td><td class="r"><b class="tot">' + (f && f.score !== null ? num(f.score) : '–') + '</b></td><td>' + (!c.iv ? '<span class="tag">ไม่ได้สัมภาษณ์</span>' : f.complete ? (f.pass ? '<span class="tag ok">ผ่าน</span>' : '<span class="tag bad">ไม่ผ่าน</span>') : '<span class="tag warn">รอคะแนน</span>') + '</td>' : '') +
        (hasProf ? '<td class="c">' + (c.profile && c.profile.nAtt ? '<span class="tag ' + attLevel(c.profile.att)[1] + '" title="' + attLevel(c.profile.att)[0] + '">' + num(c.profile.att, 2) + '</span>' : '–') + '</td><td class="c">' + (c.profile && c.profile.mbti ? '<span class="mbti sm" title="' + esc((MB_T[c.profile.mbti] || [''])[0]) + '">' + esc(c.profile.mbti) + '</span>' : '–') + '</td>' : '') + '<td>' + flagTags(fl.join(',')) + (bl ? '<span class="tag ' + (bl >= 3 ? 'bad' : 'warn') + '">ออกจอ ' + bl + '</span>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  $('#tab').innerHTML = h + '</div>';
  $('#rsCsv').onclick = function () {
    var e = d.exam, head = ['ลำดับ', 'เลขประจำตัวสอบ'].concat(d.blind ? [] : ['ชื่อ-สกุล'], ['ปรนัย', 'ข้อเขียน', 'ทฤษฎีรวม', 'ปฏิบัติ', 'รวม', 'ผล'], iv ? ['เข้าสัมภาษณ์', 'สัมภาษณ์ (เต็ม ' + d.ivMax + ')', 'คะแนนรวม (เต็ม 100)', 'ลำดับคะแนนรวม', 'ผลรวม'] : [], ['บุคลิกภาพ', 'คะแนนทัศนคติ (เต็ม 4 ไม่คิดคะแนน)'], d.dims, d.items.map(function (i) { return i.label + ' (เฉลี่ย)'; }), ['จำนวนกรรมการที่ให้คะแนน', 'หมายเหตุ', 'สลับหน้าจอ (ครั้ง)']);
    var rows = [[e.title], [e.examDate + ' ' + e.place], ['ส่งออกเมื่อ ' + tDate(now()) + ' โดย ' + printWho() + ' · สถานะ ' + ST_TH[e.status] + ' · เกณฑ์ผ่าน ' + (iv ? 'ร้อยละ ' + e.passPct + ' ของคะแนนรวม (สอบ ' + (100 - e.ivWeight) + ' : สัมภาษณ์ ' + e.ivWeight + ')' : t.passMin + '/' + t.totalMax)], [], head];
    list.forEach(function (c) {
      var r = c.result, fl = []; Object.keys(c.secs).forEach(function (k) { String(c.secs[k].flag || '').split(',').filter(String).forEach(function (f) { fl.push(FLAG_TH[f] || f); }); });
      rows.push([r.rank || '', c.examNo].concat(d.blind ? [] : [c.name], [r.mcq, r.essay, r.theory, r.practical, r.total, r.complete ? (r.pass ? 'ผ่าน' : 'ไม่ผ่าน') : 'รอตรวจ'], iv ? [c.iv ? 'ใช่' : '', c.final.iv, c.final.score, c.final.rank || '', !c.iv ? '' : c.final.complete ? (c.final.pass ? 'ผ่าน' : 'ไม่ผ่าน') : 'รอคะแนน'] : [], [c.profile ? c.profile.mbti : '', c.profile ? c.profile.att : ''], d.dims.map(function (x) { return c.profile ? c.profile.dims[x] : ''; }),
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
