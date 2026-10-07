/* =====================================================================
   SOMDEJ TalentGate · staff.js — หน้ากรรมการ/ผู้ดูแล: รอบสอบ · ภาพรวม · ติดตามสอบ · ตรวจ · สรุปผล
   ===================================================================== */
var BD = { id: null, data: null, at: 0, tab: null, essays: null, mon: null, monT: null, tickT: null, essayQ: null, docs: null };
var ST_TH = { DRAFT: 'ร่าง', OPEN: 'เปิดสอบ', GRADING: 'ปิดรับคำตอบ · กำลังตรวจ', FINAL: 'ยืนยันผลแล้ว' };
var CS_TH = { ACTIVE: 'มีสิทธิ์สอบ', WITHDRAWN: 'สละสิทธิ์', ABSENT: 'ขาดสอบ', BLOCKED: 'ระงับสิทธิ์' };
var TYPE_TH = { PROFILE: 'ทัศนคติ/บุคลิกภาพ', THEORY: 'ทฤษฎี', PRACTICAL: 'ปฏิบัติ (ส่งไฟล์)' };
var DUTY_TH = { PROCTOR: 'คุมสอบ', WRITTEN: 'ตรวจข้อเขียน', PRACTICAL: 'ตรวจภาคปฏิบัติ', IV: 'สัมภาษณ์' }, DUTY_KEYS = ['PROCTOR', 'WRITTEN', 'PRACTICAL', 'IV'];
function dutyTags(a, cls) { return DUTY_KEYS.filter(function (k) { return (a || []).indexOf(k) >= 0; }).map(function (k) { return '<span class="tag du du-' + k + (cls ? ' ' + cls : '') + '">' + DUTY_TH[k] + '</span>'; }).join(''); }
function stPill(s) { return '<span class="st st-' + s + '">' + ST_TH[s] + '</span>'; }
function boardStop() { clearInterval(BD.monT); clearInterval(BD.tickT); BD.monT = BD.tickT = null; }

/* ---------- หน้าแรกของเจ้าหน้าที่: รายการรอบสอบ ---------- */
function viewStaffHome() {
  boardStop(); TG.view = 'staffHome'; markNav();
  function draw() {
    var h = TG.home, ex = h.exams;
    var html = '<div class="wrap"><div class="phead"><div><span class="eyebrow">' + roleLabel() + '</span><h1>รอบสอบ</h1><p class="muted">' + (h.isAdmin ? 'จัดการรอบสอบทั้งหมด ตั้งค่าข้อสอบ ผู้เข้าสอบ และกรรมการ' : h.isHr ? 'ดูภาพรวมและรายงานของทุกรอบสอบ (ไม่มีสิทธิ์ให้คะแนน)' : 'รอบสอบที่ท่านได้รับแต่งตั้งเป็นกรรมการ') + '</p></div>' +
      (h.isAdmin ? '<button class="btn primary" id="shNew">' + ICON.plus + 'สร้างรอบสอบใหม่</button>' : '') + '</div>';
    if (!ex.length) html += '<div class="card empty"><h3>ยังไม่มีรอบสอบ</h3><p class="muted">' + (h.isAdmin ? 'กด "สร้างรอบสอบใหม่" เพื่อเริ่มต้น' : h.isAuthor && !hasRole('COMMITTEE') ? 'ท่านมีสิทธิ์ผู้ออกข้อสอบ — เข้าเมนู <a href="#/admin/bank">คลังข้อสอบ</a> เพื่อจัดทำข้อสอบในโฟลเดอร์ที่ได้รับสิทธิ์' : 'เมื่อผู้ดูแลระบบแต่งตั้งท่านเป็นกรรมการ รอบสอบจะแสดงที่นี่') + '</p></div>';
    html += '<div class="excards">' + ex.map(function (e, i) {
      return '<a class="card excard" href="#/staff/' + encodeURIComponent(e.examId) + '" style="--i:' + i + '"><div class="exc-top">' + stPill(e.status) + '<span class="muted sm">' + esc(e.examId) + '</span></div><h3>' + esc(e.title) + '</h3><p class="muted">' + esc(e.posName) + '</p>' +
        '<p class="exc-m">' + ICON.clock + esc(e.examDate || 'ยังไม่กำหนดวัน') + '</p><div class="exc-f"><span><b>' + e.nActive + '</b> ผู้มีสิทธิ์สอบ' + (e.nCand > e.nActive ? ' <small>(จาก ' + e.nCand + ')</small>' : '') + '</span><span><b>' + e.committee.length + '</b> กรรมการ</span></div>' + (e.myDuties && e.myDuties.length ? '<div class="exc-d"><small>หน้าที่ของท่าน</small>' + dutyTags(e.myDuties) + '</div>' : '') + '</a>';
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
    var first = !BD.data; BD.data = d; BD.at = Date.now(); if (TG.view === 'board' && !editingNow() && (first || BD.tab !== 'mail' || !$('#shF'))) { if (first) enterAnim(); drawBoard(); } return d; })
    .catch(function (e) { toast(e.message, 'bad'); if (!BD.data) { location.hash = '#/staff'; } });
}
/** ไม่วาดหน้าใหม่ทับขณะกรรมการกำลังพิมพ์คะแนน */
function editingNow() { var a = document.activeElement; return a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest && a.closest('#tab') && (BD.tab === 'essay' || BD.tab === 'practical' || BD.tab === 'setup' || BD.tab === 'cands' || BD.tab === 'interview' || BD.tab === 'mail' || BD.tab === 'survey' || BD.tab === 'reports'); }
function drawBoard() {
  var d = BD.data, e = d.exam, can = d.can || {}, boss = d.isAdmin || d.isHr, tabs = [['overview', 'ภาพรวม'], ['monitor', 'ติดตามสอบ']];
  // แท็บตามหน้าที่: กรรมการเห็นเฉพาะส่วนที่ได้รับมอบ · ผู้ดูแลและ HR เห็นทุกส่วน (HR ดูได้ ให้คะแนนไม่ได้)
  if (boss || can.written) tabs.push(['essay', 'ตรวจข้อเขียน']);
  if (boss || can.practical) tabs.push(['practical', 'ตรวจภาคปฏิบัติ']);
  if (can.scores) tabs.push(['profile', 'ทัศนคติและบุคลิกภาพ']);
  if (boss || can.iv) tabs.push(['interview', 'สัมภาษณ์']);
  if (can.scores) tabs.push(['results', 'สรุปผล'], ['reports', 'รายงาน']);
  tabs.push(['survey', 'ความพึงพอใจ']);
  if (d.isAdmin) tabs.push(['cands', 'ผู้เข้าสอบ'], ['mail', 'ประกาศและอีเมล'], ['setup', 'ตั้งค่ารอบสอบ']);
  if (!tabs.some(function (t) { return t[0] === BD.tab; })) BD.tab = 'overview';
  $('#app').innerHTML = '<div class="wrap"><a class="backlink" href="#/staff">' + ICON.back + 'รอบสอบทั้งหมด</a><div class="phead"><div><span class="eyebrow">' + esc(e.posName) + '</span><h1>' + esc(e.title) + '</h1><p class="muted">' + esc(e.examDate) + (e.place ? ' · ' + esc(e.place) : '') + '</p></div>' +
    '<div class="phead-r">' + stPill(e.status) + '<button class="icon-btn dark" id="bdRef" title="โหลดข้อมูลใหม่" aria-label="โหลดข้อมูลใหม่">' + ICON.refresh + '</button></div></div>' +
    '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<a class="tab' + (t[0] === BD.tab ? ' on' : '') + '" href="#/staff/' + encodeURIComponent(e.examId) + '/' + t[0] + '">' + t[1] + '</a>'; }).join('') + '</div><div id="tab"></div></div>';
  $('#bdRef').onclick = function () { var b = this; b.classList.add('spinning'); BD.essays = null; loadBoard().then(function () { b.classList.remove('spinning'); toast('โหลดข้อมูลล่าสุดแล้ว', 'ok'); }); };
  proctorAsk();
  ({ overview: tabOverview, monitor: tabMonitor, essay: tabEssay, practical: tabPractical, profile: tabProfile, results: tabResults, survey: tabSurvey, cands: tabCands, setup: tabSetup, interview: tabInterview, reports: tabReports, mail: tabMail })[BD.tab]();
  countUp($('#tab'));
}
/** ป้ายผู้เข้าสอบ — ในหน้าตรวจ (grading) ถ้ารอบนี้ตั้ง "ปิดชื่อ" จะแสดงเฉพาะเลขประจำตัวสอบ แม้เป็นผู้ดูแล */
function cLabel(c, grading) { var hide = grading && BD.data && BD.data.exam.blind; return '<b class="cno">' + esc(no3(c.examNo)) + '</b>' + (c.name && !hide ? '<span class="cname">' + esc(c.name) + '</span>' : ''); }
/** สวิตช์แสดง/ปิดชื่อระหว่างตรวจ (ผู้ดูแลเปลี่ยนได้ทันที · ค่าเดียวกับในหน้าตั้งค่ารอบสอบ) */
function blindBar() {
  var d = BD.data, on = !d.exam.blind;
  if (!d.isAdmin) return d.exam.blind && !d.isHr ? '<div class="blindbar"><span class="tag">ปิดชื่อผู้เข้าสอบ</span><span class="muted sm">รอบนี้ให้ตรวจโดยเห็นเฉพาะเลขประจำตัวสอบ</span></div>' : '';
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
  h += '<div class="grid2"><div class="card"><h2 class="card-t">ตอนสอบ</h2><div class="tblwrap"><table class="tbl"><thead><tr><th>ตอน</th><th class="r">เวลา</th><th class="r">จำนวนข้อ</th><th class="r">คะแนนเต็ม</th>' + (d.can.proctor ? '<th class="c">เปิดให้เริ่ม</th>' : '') + '</tr></thead><tbody>' +
    secs.map(function (s) { return '<tr><td><b>' + esc(s.title) + '</b><br><small class="muted">' + TYPE_TH[s.type] + '</small></td><td class="r">' + s.minutes + ' นาที</td><td class="r">' + (s.nQuestions || '–') + '</td><td class="r">' + (s.maxScore || 'ไม่คิด') + '</td>' +
      (d.can.proctor ? '<td class="c"><label class="sw"><input type="checkbox" data-open="' + esc(s.secId) + '"' + (s.open ? ' checked' : '') + (readonly() ? ' disabled' : '') + '><i></i></label></td>' : '') + '</tr>'; }).join('') +
    '</tbody><tfoot><tr><td>รวม</td><td class="r">' + secs.reduce(function (a, s) { return a + s.minutes; }, 0) + ' นาที</td><td></td><td class="r">' + d.totals.totalMax + '</td>' + (d.can.proctor ? '<td></td>' : '') + '</tr></tfoot></table></div>' +
    '<p class="muted sm">เกณฑ์ผ่าน ร้อยละ ' + e.passPct + ' (' + d.totals.passMin + ' คะแนนขึ้นไป)' + (d.can.proctor ? ' · ปิดสวิตช์ "เปิดให้เริ่ม" เพื่อให้ผู้เข้าสอบรอสัญญาณก่อนเริ่มตอนนั้นพร้อมกัน' : '') + '</p></div>';
  var itemsOf = function (du) { return d.items.filter(function (it) { return du.indexOf(it.kind === 'PRACTICAL' ? 'PRACTICAL' : 'WRITTEN') >= 0; }); };
  var boss = d.isAdmin || d.isHr;
  h += '<div class="card"><h2 class="card-t">คณะกรรมการและหน้าที่</h2>' + (e.committee.length ? '<ul class="plist">' + e.committee.map(function (m) {
    var its = itemsOf(m.duties || []), n = 0, need = started.length * its.length, show = (boss || m.empCode === TG.me.empCode) && d.can.scores;
    if (boss) started.forEach(function (c) { its.forEach(function (it) { if (((c.avg[it.item] || {}).by || []).some(function (x) { return x.g === m.empCode; })) n++; }); });
    else if (m.empCode === TG.me.empCode) started.forEach(function (c) { its.forEach(function (it) { if (c.my[it.item] && c.my[it.item].score !== null) n++; }); });
    return '<li><span class="ava">' + esc(m.name.replace(/^(นาย|นางสาว|นาง|ดร\.|พญ\.|นพ\.)\s*/, '').charAt(0)) + '</span><div><b>' + esc(m.name) + '</b><small>' + esc(m.empCode) + (show && need ? ' · ให้คะแนนข้อเขียน/ปฏิบัติแล้ว ' + n + ' / ' + need + ' รายการ' : '') + '</small><div class="du-row">' + (dutyTags(m.duties) || '<span class="tag">ยังไม่กำหนดหน้าที่</span>') + '</div>' + (show && need ? '<div class="bar"><i style="width:' + Math.round(n / need * 100) + '%"></i></div>' : '') + '</div></li>';
  }).join('') + '</ul>' : '<p class="muted">ยังไม่ได้แต่งตั้งกรรมการ</p>') +
    '<p class="muted sm">กรรมการแต่ละท่านเห็นและให้คะแนนได้เฉพาะส่วนที่ได้รับมอบ · ' + (e.blind ? 'รอบนี้ <b>ปิดชื่อผู้เข้าสอบ</b>ในหน้าตรวจ: เห็นเฉพาะเลขประจำตัวสอบ · ' : '') + 'คะแนนของแต่ละรายการคือค่าเฉลี่ยของกรรมการทุกท่านที่ให้คะแนน</p>' +
    (d.can.scores ? '<p class="ov-sign">' + ICON.shield + '<span>ยืนยันคะแนนแล้ว <b>' + d.signoffs.length + '</b> รายการ' + (!d.myDuties.some(function (x) { return x !== 'PROCTOR'; }) || d.signoffs.some(function (s) { return s.grader === d.me; }) ? '' : ' · ท่านยังไม่ได้ยืนยันคะแนน') + '</span><a class="btn link" href="#/staff/' + encodeURIComponent(e.examId) + '/reports">ยืนยันคะแนน / พิมพ์รายงาน</a></p>' : '<p class="ov-sign">' + ICON.shield + '<span>ท่านมีหน้าที่ <b>คุมสอบ</b>: ใช้แท็บ "ติดตามสอบ" เพื่อดูสถานะ เพิ่มเวลา หรือล้างตอนให้ผู้เข้าสอบที่เครื่องขัดข้อง และทำแบบประเมินที่แท็บ "ความพึงพอใจ"</span></p>') + '</div></div>';
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
    '<p class="muted sm">ปรับปรุงอัตโนมัติทุก 20 วินาที · "ออกจอ" = จำนวนครั้งที่ผู้เข้าสอบสลับไปหน้าต่างอื่นระหว่างทำข้อสอบ' + (BD.data.can.proctor ? ' · คลิกที่ช่องของผู้เข้าสอบเพื่อเพิ่มเวลาหรือล้างตอน (ทุกครั้งต้องระบุเหตุผล ระบบบันทึกไว้ในประวัติ)' : '') + '</p></div>';
  function load() { return api('getMonitor', { examId: BD.id }).then(function (m) { BD.mon = m; if (BD.tab === 'monitor' && TG.view === 'board') draw(); }).catch(function (e) { var el = $('#mnInfo'); if (el) el.textContent = 'โหลดไม่สำเร็จ: ' + e.message; }); }
  function draw() {
    var m = BD.mon, secs = m.sections, act = m.candidates.filter(function (c) { return c.status === 'ACTIVE'; }), cnt = {};
    secs.forEach(function (s) { cnt[s.secId] = { DOING: 0, DONE: 0 }; });
    act.forEach(function (c) { secs.forEach(function (s) { var a = c.secs[s.secId]; if (a) cnt[s.secId][a.status]++; }); });
    if (!$('#mnInfo')) return;
    $('#mnInfo').textContent = 'ข้อมูล ณ ' + tTime(m.now, true) + ' น. · ผู้มีสิทธิ์สอบ ' + act.length + ' คน · เข้าระบบแล้ว ' + act.filter(function (c) { return c.lastLogin; }).length + ' คน';
    var rooms = []; m.candidates.forEach(function (c) { if (c.room && rooms.indexOf(c.room) < 0) rooms.push(c.room); }); rooms.sort(thCmp); if (BD.room && rooms.indexOf(BD.room) < 0) BD.room = '';
    $('#mnActs').innerHTML = (rooms.length ? '<select id="mnRoom" class="sm-sel" aria-label="ห้อง/รอบ"><option value="">ทุกห้อง/รอบ</option>' + rooms.map(function (r) { return '<option' + (r === BD.room ? ' selected' : '') + '>' + esc(r) + '</option>'; }).join('') + '</select>' : '') + (m.isAdmin && m.exam.status === 'OPEN' ? secs.map(function (s) { return cnt[s.secId].DOING ? '<button class="btn ghost-dark sm" data-ext="' + esc(s.secId) + '">+ เวลาทุกคนที่กำลังทำ ' + esc(s.title.split(' ').slice(0, 2).join(' ')) + '</button>' : ''; }).join('') : '');
    if ($('#mnRoom')) $('#mnRoom').onchange = function () { BD.room = this.value; draw(); };
    $('#mnBody').innerHTML = '<table class="tbl mon"><thead><tr><th>ผู้เข้าสอบ</th><th>เข้าระบบ</th>' + secs.map(function (s) { return '<th>' + esc(s.title) + '<small>กำลังทำ ' + cnt[s.secId].DOING + ' · ส่งแล้ว ' + cnt[s.secId].DONE + '</small></th>'; }).join('') + '</tr></thead><tbody>' +
      m.candidates.filter(function (c) { return !BD.room || c.room === BD.room; }).map(function (c) {
        var off = c.status !== 'ACTIVE';
        return '<tr class="' + (off ? 'off' : '') + '"><td>' + cLabel(c) + (c.room ? '<span class="tag">' + esc(c.room) + '</span>' : '') + (off ? '<span class="tag">' + CS_TH[c.status] + '</span>' : '') + '</td><td>' + (c.lastLogin ? tTime(c.lastLogin) : '<span class="muted">–</span>') + '</td>' +
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

/* ---------- ตรวจข้อเขียน (ข้อเขียน · ตอบสั้น · ตอบเป็นตาราง) + ทบทวนคำตอบเติมคำ ---------- */
function canGrade(duty, part) { var d = BD.data; return !!d.can[duty] && !readonly() && !signOf(d.me, part || 'EXAM'); }
function gradeNote(duty, part) {
  var d = BD.data, s = signOf(d.me, part || 'EXAM');
  if (readonly()) return '';
  if (!d.can[duty]) return '<div class="note info">ท่านดูส่วนนี้ได้ในฐานะ' + (d.isAdmin ? 'ผู้ดูแลระบบ' : 'ผู้สังเกตการณ์') + ' แต่ไม่ได้รับมอบหน้าที่ให้คะแนนส่วนนี้ จึงให้คะแนนไม่ได้' + (d.isAdmin ? ' (กำหนดหน้าที่ได้ที่แท็บ "ตั้งค่ารอบสอบ")' : '') + '</div>';
  if (s) return '<div class="note ok">' + ICON.shield + ' ท่านยืนยันคะแนนส่วนนี้แล้วเมื่อ ' + tLong(s.at) + ' — คะแนนถูกล็อก หากต้องแก้ไขโปรดแจ้งผู้ดูแลระบบให้ปลดล็อก</div>';
  return '';
}
function tabEssay() {
  var d = BD.data, items = d.items.filter(function (i) { return i.kind === 'ESSAY'; });
  if (!items.length && !d.hasFill) { $('#tab').innerHTML = '<div class="card empty"><h3>รอบสอบนี้ไม่มีข้อที่กรรมการต้องตรวจ</h3><p class="muted">ข้อสอบทุกข้อในรอบนี้ระบบตรวจให้อัตโนมัติ</p></div>'; return; }
  if (BD.essayQ !== 'FILL' && (!BD.essayQ || !items.some(function (i) { return i.item === BD.essayQ; }))) BD.essayQ = items.length ? items[0].item : 'FILL';
  if (BD.essayQ === 'FILL' && !d.hasFill) BD.essayQ = items[0].item;
  function seg() {
    return '<div class="seg wide">' + items.map(function (i) { return '<button data-q="' + esc(i.item) + '" class="' + (i.item === BD.essayQ ? 'on' : '') + '">' + esc(i.label) + ' <small>(' + i.max + ' คะแนน)</small></button>'; }).join('') +
      (d.hasFill ? '<button data-q="FILL" class="' + (BD.essayQ === 'FILL' ? 'on' : '') + '">ทบทวนคำตอบเติมคำ <small>(ระบบตรวจ)</small></button>' : '') + '</div>';
  }
  function bindSeg(redraw) { $$('.seg.wide button').forEach(function (b) { b.onclick = function () { BD.essayQ = b.dataset.q; if (BD.essayQ === 'FILL') fill(); else if (BD.essays) redraw(); else tabEssay(); }; }); }
  function draw() {
    if (BD.essayQ === 'FILL') return fill();
    var it = items.filter(function (i) { return i.item === BD.essayQ; })[0], ans = BD.essays.answers, ro = !canGrade('written');
    var list = activeCands().filter(function (c) { return ans[c.examNo]; });
    var mine = list.filter(function (c) { return c.my[it.item] && c.my[it.item].score !== null; }).length, only = sess('tg_only') === 1;
    var h = blindBar() + gradeNote('written') + seg() +
      '<div class="gradegrid"><aside class="card rubric"><span class="eyebrow">' + esc(it.cat || it.label) + ' · ' + esc(qtName(it.qtype)) + '</span><div class="qt">' + nl2br(it.text) + '</div><h3>เกณฑ์ให้คะแนน / แนวคำตอบ (เต็ม ' + it.max + ')</h3><div class="rub">' + (it.rubric ? nl2br(it.rubric) : '<span class="muted">ไม่ได้ระบุแนวคำตอบ</span>') + '</div></aside><div>' +
      '<div class="gbar"><span>' + (d.can.written ? 'ท่านให้คะแนนแล้ว <b>' + mine + ' / ' + list.length + '</b> คน' : 'ผู้ส่งคำตอบ <b>' + list.length + '</b> คน') + '</span><label class="chk"><input type="checkbox" id="esOnly"' + (only ? ' checked' : '') + '> แสดงเฉพาะที่ยังไม่ให้คะแนน</label></div>';
    if (!list.length) h += '<div class="card empty"><h3>ยังไม่มีคำตอบ</h3><p class="muted">คำตอบจะแสดงเมื่อผู้เข้าสอบเริ่มทำตอนทฤษฎี</p></div>';
    list.forEach(function (c) {
      var my = c.my[it.item] || {}, av = c.avg[it.item] || {}, v = ans[c.examNo][it.item];
      if (only && my.score !== null && my.score !== undefined) return;
      h += '<article class="card gcard" data-no="' + esc(c.examNo) + '"><header>' + cLabel(c, true) + (ans[c.examNo]._status !== 'DONE' ? '<span class="tag warn">ยังทำไม่เสร็จ</span>' : '') + '<span class="muted sm">' + ansLen(it, v).toLocaleString() + ' ตัวอักษร</span></header>' + ansHtml(it, v) +
        '<footer><label class="sc">คะแนน<input type="number" class="g-s" min="0" max="' + it.max + '" step="0.5" value="' + (my.score === null || my.score === undefined ? '' : my.score) + '"' + (ro ? ' disabled' : '') + '><span>/ ' + it.max + '</span></label>' +
        '<input class="g-c" maxlength="500" placeholder="ความเห็น (ไม่บังคับ)" value="' + esc(my.comment || '') + '"' + (ro ? ' disabled' : '') + '><span class="gavg">' + (av.n && (d.isAdmin || d.isHr || readonly() || my.score !== null && my.score !== undefined) ? 'เฉลี่ย ' + num(av.avg) + ' (' + av.n + ' ท่าน)' : '') + '</span><span class="gsave"></span></footer></article>';
    });
    keepScroll(function () { $('#tab').innerHTML = h + '</div></div>'; });
    bindSeg(draw);
    $('#esOnly').onchange = function () { sess('tg_only', this.checked ? 1 : null); draw(); };
    bindBlind(draw);
    $$('.gcard').forEach(function (card) {
      var sc = $('.g-s', card), cm = $('.g-c', card), st = $('.gsave', card);
      function save() { var v = scoreVal(sc, it.max); if (v === null) { st.className = 'gsave bad'; st.textContent = 'คะแนนต้องอยู่ระหว่าง 0–' + it.max; return; } saveGrade(card.dataset.no, [{ item: it.item, score: v, comment: cm.value }], st).catch(function () { }); }
      sc.onchange = save; cm.onchange = save;
    });
  }
  /** คำตอบเติมคำ: ระบบตรวจจากเฉลยในคลัง · กรรมการรับคำตอบที่ถูกแต่สะกด/เขียนต่างจากเฉลยเพิ่มได้ (มีผลกับทุกคนเท่ากัน) */
  function fill() {
    var ro = !canGrade('written') && !(d.isAdmin && !readonly());
    $('#tab').innerHTML = blindBar() + seg() + '<div class="boot"><div class="boot-ring"></div><p>กำลังโหลดคำตอบเติมคำ…</p></div>'; bindSeg(draw);
    api('getFillReview', { examId: BD.id }).then(function (r) {
      if (BD.tab !== 'essay' || BD.essayQ !== 'FILL' || !$('#tab')) return;
      var h = blindBar() + seg() + '<div class="note info">ข้อเติมคำระบบตรวจให้อัตโนมัติจากรายการคำตอบที่ยอมรับ (ไม่สนใจช่องว่าง ตัวพิมพ์เล็ก-ใหญ่ และเครื่องหมายวรรคตอน) · หากพบคำตอบที่ถูกต้องแต่เขียนต่างจากเฉลย กด "รับคำตอบนี้" ระบบจะตรวจคะแนนของ<b>ทุกคน</b>ใหม่ทันที และบันทึกผู้ที่รับคำตอบไว้ในประวัติ</div>';
      if (!r.questions.length) h += '<div class="card empty"><h3>รอบสอบนี้ไม่มีข้อเติมคำ</h3></div>';
      r.questions.forEach(function (q, qi) {
        h += '<article class="card fr"><header><span class="qn">ข้อเติมคำ ' + (qi + 1) + '</span><span class="qp">' + q.points + ' คะแนน</span><span class="bq-id">' + esc(q.qId) + '</span></header><div class="qt">' + qTextHtml({ type: 'FILL', text: q.text }) + '</div><div class="fr-grid">' +
          q.blanks.map(function (b, bi) {
            return '<div class="fr-b"><h3><span class="fl-b">' + (bi + 1) + '</span> เฉลย: ' + b.key.map(esc).join(' <span class="muted">หรือ</span> ') + '</h3>' + (b.answers.length ? '<table class="tbl sm"><tbody>' + b.answers.map(function (a) {
              return '<tr><td>' + esc(a.text) + '</td><td class="r nowrap">' + a.n + ' คน</td><td class="nowrap">' + (a.base ? '<span class="tag ok">ตรงเฉลย</span>' : a.added ? '<span class="tag info">กรรมการรับเพิ่ม</span>' : '<span class="tag bad">ไม่ได้คะแนน</span>') + '</td><td class="nowrap">' +
                (a.base || ro || r.locked ? '' : '<button class="btn link fr-t" data-q="' + esc(q.qId) + '" data-b="' + bi + '" data-on="' + (a.added ? 0 : 1) + '" data-t="' + esc(a.text) + '">' + (a.added ? 'ยกเลิกการรับ' : 'รับคำตอบนี้') + '</button>') + '</td></tr>';
            }).join('') + '</tbody></table>' : '<p class="muted sm">ยังไม่มีผู้ตอบช่องนี้</p>') + '</div>';
          }).join('') + '</div></article>';
      });
      keepScroll(function () { $('#tab').innerHTML = h; }); bindSeg(draw); bindBlind(fill);
      $$('.fr-t').forEach(function (b) {
        b.onclick = function () {
          busy(b, true, 'กำลังตรวจใหม่…');
          api('saveFillAccept', { examId: BD.id, qId: b.dataset.q, blank: +b.dataset.b, text: b.dataset.t, accept: b.dataset.on === '1' }).then(function (x) { toast((b.dataset.on === '1' ? 'รับคำตอบแล้ว' : 'ยกเลิกการรับแล้ว') + ' · คะแนนเปลี่ยน ' + x.changed + ' คน', 'ok'); BD.at = 0; loadBoard(true); fill(); }).catch(function (e) { busy(b, false); toast(e.message, 'bad', 8000); });
        };
      });
    }).catch(function (e) { toast(e.message, 'bad'); });
  }
  if (BD.essayQ === 'FILL') return fill();
  // แสดงข้อมูลที่มีอยู่ทันที แล้วโหลดคำตอบล่าสุดทุกครั้งที่เปิดแท็บ
  if (BD.essays && BD.essays.examId === BD.id) draw(); else $('#tab').innerHTML = '<div class="boot"><div class="boot-ring"></div><p>กำลังโหลดคำตอบ…</p></div>';
  var seq = tabEssay._seq = (tabEssay._seq || 0) + 1;
  api('getEssays', { examId: BD.id }).then(function (r) { r.examId = BD.id; var first = !BD.essays; BD.essays = r; if (BD.tab === 'essay' && BD.essayQ !== 'FILL' && TG.view === 'board' && seq === tabEssay._seq && (first || !editingNow())) draw(); }).catch(function (e) { toast(e.message, 'bad'); });
}

/* ---------- ตรวจภาคปฏิบัติ ---------- */
function tabPractical() {
  var d = BD.data, items = d.items.filter(function (i) { return i.kind === 'PRACTICAL'; }), ro = !canGrade('practical');
  if (!items.length) { $('#tab').innerHTML = '<div class="card empty"><h3>รอบสอบนี้ไม่มีภาคปฏิบัติ</h3></div>'; return; }
  var secId = items[0].secId, max = items.reduce(function (a, i) { return a + i.max; }, 0), list = activeCands().filter(function (c) { return c.secs[secId]; });
  var h = blindBar() + gradeNote('practical') + '<details class="card rubric-d"><summary><b>เกณฑ์ให้คะแนนภาคปฏิบัติ (เต็ม ' + max + ')</b><span class="muted sm">คลิกเพื่อเปิด/ปิด</span></summary><table class="tbl"><thead><tr><th>หัวข้อ</th><th class="r">เต็ม</th><th>เกณฑ์</th></tr></thead><tbody>' +
    items.map(function (i) { return '<tr><td><b>' + esc(i.label) + '</b></td><td class="r">' + i.max + '</td><td>' + esc(i.rubric) + '</td></tr>'; }).join('') + '</tbody></table></details>';
  if (!list.length) h += '<div class="card empty"><h3>ยังไม่มีผู้เข้าสอบเริ่มทำภาคปฏิบัติ</h3></div>';
  list.forEach(function (c) {
    var a = c.secs[secId], sum = 0, any = false;
    items.forEach(function (i) { var m = c.my[i.item]; if (m && m.score !== null) { sum += m.score; any = true; } });
    h += '<article class="card pcard" data-no="' + esc(c.examNo) + '"><header>' + cLabel(c, true) + (a.status === 'DONE' ? '<span class="tag ok">ส่งแล้ว ' + tTime(a.submitAt) + '</span>' : '<span class="tag warn">กำลังทำ</span>') + flagTags(a.flag) +
      (a.hasFile ? '<button class="btn ghost-dark sm p-dl">' + ICON.down + 'ดาวน์โหลดไฟล์คำตอบ</button><span class="muted sm">' + esc(a.fileName) + ' · ' + tTime(a.fileAt, true) + ' น.</span>' : '<span class="muted sm">ไม่มีไฟล์</span>') + '</header>' +
      '<div class="pitems">' + items.map(function (i) { var m = c.my[i.item] || {}, av = c.avg[i.item] || {}; return '<label title="' + esc(i.rubric) + '"><span>' + esc(i.label) + '</span><div><input type="number" class="p-s" data-item="' + esc(i.item) + '" data-max="' + i.max + '" min="0" max="' + i.max + '" step="0.5" value="' + (m.score === null || m.score === undefined ? '' : m.score) + '"' + (ro ? ' disabled' : '') + '><i>/ ' + i.max + '</i></div><small>' + (av.n && (d.isAdmin || d.isHr || readonly() || m.score !== null && m.score !== undefined) ? 'เฉลี่ย ' + num(av.avg) + ' (' + av.n + ')' : '&nbsp;') + '</small></label>'; }).join('') + '</div>' +
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
function lkLevel(v) { return v >= 4.2 ? ['เด่นมาก', 'ok'] : v >= 3.5 ? ['เด่น', 'info'] : v >= 2.8 ? ['ปานกลาง', 'warn'] : ['ควรซักถามเพิ่ม', 'bad']; }
function tabProfile() {
  var d = BD.data, list = activeCands().filter(function (c) { return c.profile; }), byAtt = sess('tg_pfsort') === 1;
  var anySjt = list.some(function (c) { return c.profile.nAtt; }), anyLk = list.some(function (c) { return c.profile.nLk; }), anyMb = list.some(function (c) { return c.profile.mbti; });
  var key = function (c) { return anySjt ? (c.profile.att || 0) : (c.profile.lkAvg || 0); };
  if (byAtt) list = list.slice().sort(function (a, b) { return key(b) - key(a); });
  var h = blindBar() + '<div class="note info">ข้อมูลส่วนนี้ <b>ไม่นำไปคิดคะแนน</b> ใช้ประกอบการสัมภาษณ์เท่านั้น' +
    (anySjt ? ' · <b>คะแนนทัศนคติ</b> (เต็ม 4) คือค่าเฉลี่ยระดับความเหมาะสมของตัวเลือกที่เลือกในข้อสถานการณ์' : '') +
    (anyLk ? ' · <b>แบบสำรวจลักษณะการทำงาน</b> (เต็ม 5) เป็นการประเมินตนเองของผู้เข้าสอบ ด้านที่ได้สูงสุดคือจุดแข็งที่เจ้าตัวมองเห็น ด้านที่ต่ำสุดคือประเด็นที่ควรซักถามเพิ่ม' : '') +
    (anyMb ? ' · แบบทดสอบบุคลิกภาพ 4 ข้อมีความเที่ยงต่ำ ใช้เปิดบทสนทนา ไม่ควรใช้ตัดสินรับ/ไม่รับ' : '') + '</div>';
  if (!list.length) { $('#tab').innerHTML = h + '<div class="card empty"><h3>ยังไม่มีผู้เข้าสอบส่งตอนทัศนคติและบุคลิกภาพ</h3></div>'; bindBlind(tabProfile); return; }
  var types = {}; list.forEach(function (c) { if (c.profile.mbti) types[c.profile.mbti] = (types[c.profile.mbti] || 0) + 1; });
  var sj = list.filter(function (c) { return c.profile.nAtt; }), avg = sj.length ? sj.reduce(function (a, c) { return a + (c.profile.att || 0); }, 0) / sj.length : null;
  h += '<div class="gbar"><span>ผู้ส่งแล้ว <b>' + list.length + '</b> คน' + (avg !== null ? ' · คะแนนทัศนคติเฉลี่ย <b>' + num(avg, 2) + '</b> / 4' : '') + (anyMb ? ' · บุคลิกภาพที่พบ: ' + Object.keys(types).sort(function (a, b) { return types[b] - types[a]; }).map(function (t) { return '<span class="mbti sm">' + esc(t) + '</span>×' + types[t]; }).join(' ') : '') +
    '</span><label class="chk"><input type="checkbox" id="pfSort"' + (byAtt ? ' checked' : '') + '> เรียงจากคะแนนสูงไปต่ำ</label></div><div class="pfcards">';
  list.forEach(function (c, i) {
    var p = c.profile, t = MB_T[p.mbti], lv = attLevel(p.att || 0), showMb = !!p.mbti || (!p.nLk && anyMb), showAt = !!p.nAtt;
    h += '<article class="card pfcard" data-no="' + esc(c.examNo) + '" style="--i:' + Math.min(i, 12) + '"><header>' + cLabel(c, true) + '<button class="btn link pf-open">ดูคำตอบรายข้อ</button></header>';
    if (showMb || showAt) h += '<div class="pf-grid' + (showMb && showAt ? '' : ' one') + '">' +
      (showMb ? '<div class="pf-mb">' + (p.mbti ? '<div class="mbti-big">' + p.mbti.split('').map(function (x, j) { return '<span style="--j:' + j + '">' + esc(x) + '</span>'; }).join('') + '</div><b class="pf-nick">' + esc(t ? t[0] : 'บุคลิกภาพ ' + p.mbti) + '</b>' + (t ? '<p class="pf-desc">' + esc(t[1]) + '</p>' : '') +
        '<ul class="pf-let">' + p.mbti.split('').map(function (x) { var m = MB_L[x]; return m ? '<li><i>' + x + '</i><span><b>' + m[0] + '</b> ' + m[1] + '</span></li>' : ''; }).join('') + '</ul>' +
        (t ? '<p class="pf-x"><b>จุดแข็งในงาน:</b> ' + esc(t[2]) + '</p><p class="pf-x ask"><b>ชวนคุยตอนสัมภาษณ์:</b> ' + esc(t[3]) + '</p>' : '') : '<p class="muted">ตอบแบบทดสอบบุคลิกภาพไม่ครบ</p>') + '</div>' : '') +
      (showAt ? '<div class="pf-at"><div class="pf-score">' + gauge(p.att || 0, 4) + '<div class="pf-num"><b data-cu="' + (p.att || 0).toFixed(2) + '">' + num(p.att, 2) + '</b><small>เต็ม 4</small></div></div><div class="pf-lab"><span class="eyebrow">คะแนนทัศนคติ</span><span class="tag ' + lv[1] + '">' + lv[0] + '</span><small class="muted">จาก ' + p.nAtt + ' ข้อสถานการณ์</small></div>' +
        '<div class="pf-dims">' + d.dims.map(function (x) { var v = p.dims[x]; return '<div class="pf-dim"><span>' + esc(x) + '</span>' + (v ? '<div class="lv lv' + Math.round(v) + '"><i style="width:' + (v / 4 * 100) + '%"></i></div><b>' + num(v, 1) + '</b>' : '<div class="lv"></div><b>–</b>') + '</div>'; }).join('') + '</div></div>' : '') + '</div>';
    if (p.nLk) {
      var ds = (d.lkDims || []).filter(function (x) { return p.lk[x]; }).map(function (x) { return { k: x, v: p.lk[x] }; }), sorted = ds.slice().sort(function (a, b) { return b.v - a.v; });
      var nTop = sorted.length >= 4 ? 2 : 1, top = sorted.slice(0, nTop), low = sorted.length >= 2 ? sorted.slice(-nTop).reverse() : [];
      h += '<div class="pf-lk"><div class="pf-lk-h"><span class="eyebrow">แบบสำรวจลักษณะการทำงาน (ประเมินตนเอง)</span><span class="muted sm">เฉลี่ย ' + num(p.lkAvg, 2) + ' / 5 · ตอบ ' + p.nLk + ' ข้อ</span></div><div class="pf-lk-g"><div class="pf-dims">' +
        ds.map(function (x) { var l = lkLevel(x.v); return '<div class="pf-dim"><span>' + esc(x.k) + '</span><div class="lv lk-' + l[1] + '"><i style="width:' + (x.v / 5 * 100) + '%"></i></div><b>' + num(x.v, 1) + '</b></div>'; }).join('') + '</div>' +
        '<div class="pf-sw"><p class="pf-x"><b>จุดแข็งที่เด่น:</b> ' + top.map(function (x) { return esc(x.k) + ' (' + num(x.v, 1) + ')'; }).join(' · ') + '</p>' +
        (low.length ? '<p class="pf-x ask"><b>ประเด็นที่ควรซักถามเพิ่ม:</b> ' + low.map(function (x) { return esc(x.k) + ' (' + num(x.v, 1) + ')'; }).join(' · ') + '</p>' : '') +
        (sorted.length && sorted[0].v - sorted[sorted.length - 1].v < 0.4 ? '<p class="muted sm">คะแนนทุกด้านใกล้เคียงกันมาก — อาจตอบแบบกลาง ๆ หรือตอบให้ดูดีทุกข้อ ควรใช้คำถามเชิงพฤติกรรมยืนยันตอนสัมภาษณ์</p>' : '') + '</div></div></div>';
    }
    h += '</article>';
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
          '<div class="pfl">' + p.items.map(function (it) {
            return it.type === 'SJT' ? '<div class="pfi"><div class="pfh"><span class="tag">' + esc(it.cat) + '</span>' + (it.level ? '<span class="lvb lv' + it.level + '">ระดับ ' + it.level + '</span>' : '<span class="tag">ไม่ได้ตอบ</span>') + '</div><p>' + esc(it.text) + '</p><p class="pfa"><b>เลือก:</b> ' + esc(it.choice || '–') + '</p>' + (it.level && it.level < 4 ? '<p class="pfb"><b>ตัวเลือกระดับ 4:</b> ' + esc(it.best) + '</p>' : '') + '</div>'
              : it.type === 'LIKERT' ? '<div class="pfi"><div class="pfh"><span class="tag">' + esc(it.cat) + '</span>' + (it.level ? '<span class="lvb lk' + it.level + '">' + it.level + ' / 5</span>' : '<span class="tag">ไม่ได้ตอบ</span>') + (it.rev ? '<span class="tag" title="ข้อความเชิงลบ ระบบกลับคะแนนให้แล้ว">ข้อกลับคะแนน</span>' : '') + '</div><p>' + esc(it.text) + '</p><p class="pfa"><b>ตอบ:</b> ' + esc(it.choice || '–') + '</p></div>'
              : '<div class="pfi"><div class="pfh"><span class="tag">บุคลิกภาพ</span><span class="mbti sm">' + esc(it.letter || '?') + '</span></div><p>' + esc(it.text) + '</p><p class="pfa"><b>เลือก:</b> ' + esc(it.choice || '–') + '</p></div>';
          }).join('') + '</div>', { cls: 'lg' });
      }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); });
    };
  });
}

/* ---------- ความพึงพอใจ: ผู้เข้าสอบ + กรรมการคุมสอบ ---------- */
function svFields(items, pre) {
  return '<div class="sv-scale"><span>1 = น้อยที่สุด</span><span>5 = มากที่สุด</span></div>' + items.map(function (t, i) {
    return '<div class="sv-q" role="radiogroup" aria-label="' + esc(t) + '"><p><b>' + (i + 1) + '.</b> ' + esc(t) + '</p><div class="sv-r">' + [1, 2, 3, 4, 5].map(function (n) { return '<label><input type="radio" name="' + pre + i + '" value="' + n + '"><span>' + n + '</span></label>'; }).join('') + '</div></div>';
  }).join('') + '<label class="sv-c">ข้อเสนอแนะเพิ่มเติม (ถ้ามี)<textarea class="sv-cm" rows="3" maxlength="1500" placeholder="ปัญหาที่พบระหว่างคุมสอบ สิ่งที่ควรปรับปรุง หรือสิ่งที่ช่วยให้ทำงานง่ายขึ้น"></textarea></label>';
}
function svSend(form, items, pre, examId, after) {
  var scores = items.map(function (t, i) { var x = $('[name=' + pre + i + ']:checked', form); return x ? Number(x.value) : ''; }), cm = $('.sv-cm', form).value.trim();
  if (!cm && scores.every(function (v) { return v === ''; })) return toast('กรุณาให้คะแนนอย่างน้อย 1 ข้อ หรือเขียนข้อเสนอแนะ', 'warn');
  var b = $('.sv-send', form); busy(b, true, 'กำลังส่ง…');
  api('submitProctorSurvey', { examId: examId, scores: scores, comment: cm }).then(function () { toast('ขอบคุณสำหรับความเห็นของท่าน', 'ok'); after(); }).catch(function (er) { busy(b, false); toast(er.message, 'bad'); });
}
/** เชิญกรรมการคุมสอบตอบแบบประเมินหลังปิดรับคำตอบ — ถามครั้งเดียวต่อการเข้าใช้ 1 ครั้ง ข้ามได้ */
function proctorAsk() {
  var d = BD.data, id = BD.id, k = 'tg_pvAsk_' + id;
  if (!d || (d.myDuties || []).indexOf('PROCTOR') < 0 || (d.exam.status !== 'GRADING' && d.exam.status !== 'FINAL') || sess(k) || !$('#modal').hidden) return;
  sess(k, 1);
  api('getSurvey', { examId: id }, { quiet: true }).then(function (r) {
    if (!r.mine || r.mine.done || !r.on || TG.view !== 'board' || BD.id !== id || !$('#modal').hidden) return;
    var b = modal('<form id="pvF"><span class="eyebrow">ใช้เวลาไม่เกิน 1 นาที</span><h2 class="card-t">แบบประเมินสำหรับกรรมการคุมสอบ</h2><p class="card-s">ไม่บังคับ · ระบบไม่บันทึกว่าใครเป็นผู้ตอบ — ความเห็นของท่านช่วยให้การจัดสอบครั้งต่อไปราบรื่นขึ้น</p>' + svFields(r.mine.items, 'pv') +
      '<div class="modal-act"><button type="button" class="btn ghost-dark" id="pvSkip">ข้ามไปก่อน</button><button class="btn primary sv-send">ส่งแบบประเมิน</button></div></form>', { cls: 'lg' });
    $('#pvSkip', b).onclick = closeModal;
    $('#pvF', b).onsubmit = function (e) { e.preventDefault(); svSend(this, r.mine.items, 'pv', id, function () { closeModal(); if (BD.tab === 'survey') tabSurvey(); }); };
  }).catch(function () { });
}
function tabSurvey() {
  $('#tab').innerHTML = '<div class="boot"><div class="boot-ring"></div><p>กำลังโหลดผลแบบประเมิน…</p></div>';
  api('getSurvey', { examId: BD.id }).then(function (r) {
    if (BD.tab !== 'survey' || TG.view !== 'board') return;
    var e = BD.data.exam, mean = function (a) { var n = a.reduce(function (x, y) { return x + y; }, 0); return n ? a.reduce(function (x, y, i) { return x + y * (i + 1); }, 0) / n : null; };
    function agg(rows, items) {
      var o = { agg: {}, order: items.slice(), all: [], cms: rows.filter(function (x) { return x.comment; }) };
      rows.forEach(function (x) { x.items.forEach(function (t, i) { var v = Number(x.scores[i]); if (!(v >= 1 && v <= 5)) return; if (!o.agg[t]) { o.agg[t] = [0, 0, 0, 0, 0]; if (o.order.indexOf(t) < 0) o.order.push(t); } o.agg[t][v - 1]++; o.all.push(v); }); });
      o.tot = o.all.length ? o.all.reduce(function (a, b) { return a + b; }, 0) / o.all.length : null; o.top = o.all.filter(function (v) { return v >= 4; }).length;
      return o;
    }
    function block(id, title, sub, rows, a, total, who) {
      var h = '<div class="kpis"><div class="kpi"><b data-cu="' + rows.length + '">' + rows.length + '</b><span>ผู้ตอบแบบประเมิน</span><small>จาก' + who + ' ' + total + ' คน</small></div><div class="kpi ok"><b' + (a.tot ? ' data-cu="' + a.tot.toFixed(2) + '"' : '') + '>' + (a.tot ? num(a.tot, 2) : '–') + '</b><span>ค่าเฉลี่ยรวม</span><small>เต็ม 5 คะแนน</small></div>' +
        '<div class="kpi"><b>' + (a.all.length ? Math.round(a.top / a.all.length * 100) + '%' : '–') + '</b><span>ให้ 4–5 คะแนน</span><small>สัดส่วนคำตอบระดับพอใจ</small></div><div class="kpi"><b data-cu="' + a.cms.length + '">' + a.cms.length + '</b><span>ข้อเสนอแนะ</span><small>ข้อความจาก' + who + '</small></div></div>' +
        '<div class="card"><div class="card-head"><div><h2 class="card-t">' + title + '</h2><p class="card-s">' + sub + '</p></div><div class="acts noprint"><button class="btn ghost-dark sm" data-csv="' + id + '">' + ICON.down + 'ส่งออก CSV</button><button class="btn ghost-dark sm" data-pr="' + id + '">' + ICON.print + 'พิมพ์</button></div></div>';
      if (!rows.length) h += '<div class="empty"><h3>ยังไม่มีผู้ตอบแบบประเมิน</h3></div>';
      else h += resHtml(a);
      return h + '</div>' + (a.cms.length ? '<div class="card"><h2 class="card-t">ข้อเสนอแนะจาก' + who + '</h2><ul class="svcm">' + a.cms.map(function (x) { return '<li>' + nl2br(x.comment) + '<small>' + tDate(x.at) + '</small></li>'; }).join('') + '</ul></div>' : '');
    }
    function resHtml(a) {
      return '<div class="svres">' + a.order.filter(function (t) { return a.agg[t]; }).map(function (t, i) {
        var v = a.agg[t], m = mean(v), n = v.reduce(function (x, y) { return x + y; }, 0);
        return '<div class="svrow" style="--i:' + i + '"><p><b>' + (i + 1) + '.</b> ' + esc(t) + '</p><div class="svbar"><div class="bar big"><i style="width:' + (m / 5 * 100) + '%"></i></div><b>' + num(m, 2) + '</b></div><div class="svdist">' + v.map(function (x, k) { return '<span title="ให้ ' + (k + 1) + ' คะแนน ' + x + ' คน"><i style="height:' + (n ? Math.round(x / n * 100) : 0) + '%"></i><small>' + (k + 1) + '</small><em>' + x + '</em></span>'; }).join('') + '</div></div>';
      }).join('') + '</div>';
    }
    var ca = agg(r.rows, r.items), pa = agg(r.proctor.rows, r.proctor.items), h = '';
    if (r.mine && !r.mine.done && r.on) h += '<div class="card"><form id="pvIn"><span class="eyebrow">สำหรับท่านในฐานะกรรมการคุมสอบ</span><h2 class="card-t">แบบประเมินสำหรับกรรมการคุมสอบ</h2><p class="card-s">ไม่บังคับ · ตอบได้ 1 ครั้งต่อรอบสอบ · ระบบไม่บันทึกว่าใครเป็นผู้ตอบ</p>' + svFields(r.mine.items, 'pi') + '<div class="modal-act"><button class="btn primary sv-send">ส่งแบบประเมิน</button></div></form></div>';
    else if (r.mine && r.mine.done) h += '<div class="note ok">ท่านตอบแบบประเมินสำหรับกรรมการคุมสอบของรอบนี้แล้ว ขอบคุณครับ</div>';
    h += block('C', 'ผลแบบประเมินความพึงพอใจของผู้เข้าสอบ', 'ผู้เข้าสอบตอบหลังส่งครบทุกตอน (ระบบเด้งแบบประเมินให้ ข้ามได้) · ไม่ระบุตัวผู้ตอบ' + (r.on ? '' : ' · <b class="bad-t">ขณะนี้ปิดแบบประเมินอยู่ (เปิดได้ที่เมนูตั้งค่า)</b>'), r.rows, ca, r.nActive, 'ผู้มีสิทธิ์สอบ');
    if (r.canSee) h += '<h2 class="sect">กรรมการคุมสอบ</h2>' + block('P', 'ผลแบบประเมินของกรรมการคุมสอบ', 'กรรมการที่ได้รับหน้าที่คุมสอบตอบหลังปิดรับคำตอบ · ไม่ระบุตัวผู้ตอบ · เห็นเฉพาะผู้ดูแลระบบและผู้สังเกตการณ์', r.proctor.rows, pa, r.proctor.n, 'กรรมการคุมสอบ');
    $('#tab').innerHTML = h; countUp($('#tab'));
    if ($('#pvIn')) $('#pvIn').onsubmit = function (ev) { ev.preventDefault(); svSend(this, r.mine.items, 'pi', BD.id, tabSurvey); };
    var sets = { C: [r.rows, ca, 'ความพึงพอใจของผู้เข้าสอบ', 'Survey'], P: [r.proctor.rows, pa, 'แบบประเมินของกรรมการคุมสอบ', 'ProctorSurvey'] };
    $$('[data-csv]').forEach(function (b) {
      b.onclick = function () {
        var s = sets[b.dataset.csv], a = s[1], rows = [[e.title], [s[2] + ' · ส่งออกเมื่อ ' + tDate(now()) + ' · ผู้ตอบ ' + s[0].length + ' คน'], [], ['เวลาที่ตอบ'].concat(a.order, ['ข้อเสนอแนะ'])];
        s[0].forEach(function (x) { rows.push([tDate(x.at)].concat(a.order.map(function (t) { var i = x.items.indexOf(t); return i < 0 ? '' : x.scores[i]; }), [x.comment])); });
        rows.push([]); rows.push(['ค่าเฉลี่ย'].concat(a.order.map(function (t) { return a.agg[t] ? Math.round(mean(a.agg[t]) * 100) / 100 : ''; })));
        saveCsv('TalentGate_' + s[3] + '_' + e.examId + '.csv', rows);
      };
    });
    $$('[data-pr]').forEach(function (b) {
      b.onclick = function () {
        var s = sets[b.dataset.pr], a = s[1];
        printDoc(prWrap(letterHead('สรุปผล' + s[2], e.title + (e.examDate ? ' · ' + e.examDate : '')) + '<p class="pr-p">ผู้ตอบแบบประเมิน ' + s[0].length + ' คน · ค่าเฉลี่ยรวม ' + (a.tot ? num(a.tot, 2) : '–') + ' จากคะแนนเต็ม 5 · ให้ 4–5 คะแนนร้อยละ ' + (a.all.length ? Math.round(a.top / a.all.length * 100) : '–') + '</p>' +
          '<table class="pr-t"><thead><tr><th class="c" style="width:8mm">ที่</th><th>รายการประเมิน</th><th class="c">5</th><th class="c">4</th><th class="c">3</th><th class="c">2</th><th class="c">1</th><th class="c">ผู้ตอบ</th><th class="c">ค่าเฉลี่ย</th></tr></thead><tbody>' +
          a.order.filter(function (t) { return a.agg[t]; }).map(function (t, i) { var v = a.agg[t]; return '<tr><td class="c">' + (i + 1) + '</td><td>' + esc(t) + '</td>' + [4, 3, 2, 1, 0].map(function (k) { return '<td class="c">' + v[k] + '</td>'; }).join('') + '<td class="c">' + v.reduce(function (x, y) { return x + y; }, 0) + '</td><td class="c"><b>' + num(mean(v), 2) + '</b></td></tr>'; }).join('') +
          '</tbody></table>' + (a.cms.length ? '<h3 class="pr-h">ข้อเสนอแนะ (' + a.cms.length + ' รายการ)</h3><ol class="pr-ol">' + a.cms.map(function (x) { return '<li>' + nl2br(x.comment) + '</li>'; }).join('') + '</ol>' : '')), { portrait: true, title: 'สรุปผล' + s[2] });
      };
    });
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
    (d.isAdmin ? '<button class="btn ghost-dark sm" id="rsItem">วิเคราะห์ข้อสอบรายข้อ</button>' + (readonly() ? '' : '<button class="btn ghost-dark sm" id="rsRe">ตรวจข้อที่ระบบตรวจใหม่</button>') : '') + '<button class="btn ghost-dark sm" id="rsCsv">' + ICON.down + 'ส่งออก CSV</button><a class="btn ghost-dark sm" id="rsPrint" href="#/staff/' + encodeURIComponent(d.exam.examId) + '/reports">' + ICON.print + 'พิมพ์รายงาน</a></div></div>';
  if (!list.length) h += '<p class="muted">ยังไม่มีผู้เข้าสอบเริ่มทำข้อสอบ</p>';
  else h += '<div class="tblwrap"><table class="tbl res"><thead><tr><th class="c">ลำดับ</th><th>ผู้เข้าสอบ</th><th class="r">ระบบตรวจ<small>/' + mcqMax + '</small></th>' + (hasEssay ? '<th class="r">ข้อเขียน<small>/' + (t.theoryMax - mcqMax) + '</small></th>' : '') + (hasPr ? '<th class="r">ทฤษฎีรวม<small>/' + t.theoryMax + '</small></th><th class="r">ปฏิบัติ<small>/' + t.practMax + '</small></th>' : '') + '<th class="r">' + (iv ? 'รวมสอบ' : 'รวม') + '<small>/' + t.totalMax + '</small></th><th>' + (iv ? 'ผลสอบ' : 'ผล') + '</th>' + (iv ? '<th class="r">สัมภาษณ์<small>/' + d.ivMax + '</small></th><th class="r">คะแนนรวม<small>/100</small></th><th>ผลรวม</th>' : '') + (hasProf ? '<th class="c">ทัศนคติ<small>/4 · ไม่คิดคะแนน</small></th><th class="c">บุคลิกภาพ</th>' : '') + '<th>หมายเหตุ</th></tr></thead><tbody>' +
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
    var e = d.exam, head = ['ลำดับ', 'เลขประจำตัวสอบ'].concat(d.blind ? [] : ['ชื่อ-สกุล'], ['ระบบตรวจ', 'ข้อเขียน', 'ทฤษฎีรวม', 'ปฏิบัติ', 'รวม', 'ผล'], iv ? ['เข้าสัมภาษณ์', 'สัมภาษณ์ (เต็ม ' + d.ivMax + ')', 'คะแนนรวม (เต็ม 100)', 'ลำดับคะแนนรวม', 'ผลรวม'] : [], ['บุคลิกภาพ', 'คะแนนทัศนคติ (เต็ม 4 ไม่คิดคะแนน)'], d.dims, d.items.map(function (i) { return i.label + ' (เฉลี่ย)'; }), ['จำนวนกรรมการที่ให้คะแนน', 'หมายเหตุ', 'สลับหน้าจอ (ครั้ง)']);
    var rows = [[e.title], [e.examDate + ' ' + e.place], ['ส่งออกเมื่อ ' + tDate(now()) + ' โดย ' + printWho() + ' · สถานะ ' + ST_TH[e.status] + ' · เกณฑ์ผ่าน ' + (iv ? 'ร้อยละ ' + e.passPct + ' ของคะแนนรวม (สอบ ' + (100 - e.ivWeight) + ' : สัมภาษณ์ ' + e.ivWeight + ')' : t.passMin + '/' + t.totalMax)], [], head];
    list.forEach(function (c) {
      var r = c.result, fl = []; Object.keys(c.secs).forEach(function (k) { String(c.secs[k].flag || '').split(',').filter(String).forEach(function (f) { fl.push(FLAG_TH[f] || f); }); });
      rows.push([r.rank || '', c.examNo].concat(d.blind ? [] : [c.name], [r.mcq, r.essay, r.theory, r.practical, r.total, r.complete ? (r.pass ? 'ผ่าน' : 'ไม่ผ่าน') : 'รอตรวจ'], iv ? [c.iv ? 'ใช่' : '', c.final.iv, c.final.score, c.final.rank || '', !c.iv ? '' : c.final.complete ? (c.final.pass ? 'ผ่าน' : 'ไม่ผ่าน') : 'รอคะแนน'] : [], [c.profile ? c.profile.mbti : '', c.profile ? c.profile.att : ''], d.dims.map(function (x) { return c.profile ? c.profile.dims[x] : ''; }),
        d.items.map(function (i) { return c.avg[i.item].avg; }), [Math.max.apply(null, d.items.map(function (i) { return c.avg[i.item].n; }).concat([0])), fl.join(' / '), Object.keys(c.secs).reduce(function (a, k) { return a + (c.secs[k].blur || 0); }, 0)]));
    });
    saveCsv('TalentGate_Result_' + e.examId + '.csv', rows);
  };
  if ($('#rsRe')) $('#rsRe').onclick = function () { confirmBox('ตรวจข้อที่ระบบตรวจใหม่', '<p>ใช้หลังแก้ไขเฉลยในคลังข้อสอบ ระบบจะตรวจคำตอบของทุกคนในข้อที่ระบบตรวจอัตโนมัติ (ปรนัย ถูก/ผิด จับคู่ เรียงลำดับ เติมคำ) ใหม่ตามเฉลยปัจจุบัน</p>', 'คำนวณใหม่').then(function (y) { if (y) api('rescore', { examId: BD.id }).then(function (r) { toast('ตรวจใหม่ ' + r.n + ' คน คะแนนเปลี่ยน ' + r.changed + ' คน', 'ok'); loadBoard(); }).catch(function (e) { toast(e.message, 'bad'); }); }); };
  if ($('#rsItem')) $('#rsItem').onclick = function () { var b = this; busy(b, true, 'กำลังคำนวณ…'); api('getExport', { examId: BD.id }).then(function (x) { busy(b, false); itemAnalysis(x); }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); }); };
}
/** วิเคราะห์ข้อสอบที่ระบบตรวจ: ค่าความยาก (p) · อำนาจจำแนก (r: กลุ่มสูง 27% − กลุ่มต่ำ 27%) · การเลือกตัวเลือก · ความเที่ยง (แอลฟาของครอนบาค) */
function itemAnalysis(x) {
  var e = BD.data.exam, per = {}, tot = {};
  x.rows.forEach(function (r) { var o = per[r.examNo] = per[r.examNo] || {}; Object.keys(r.scores).forEach(function (k) { o[k] = r.scores[k]; }); });
  var nos = Object.keys(per), qs = x.questions.filter(function (q) { return q.points > 0; });
  nos.forEach(function (no) { tot[no] = qs.reduce(function (a, q) { return a + (Number(per[no][q.qId]) || 0); }, 0); });
  var cat = {};
  var out = qs.map(function (q, i) {
    var who = nos.filter(function (no) { return per[no][q.qId] !== undefined; }), n = who.length, frac = function (no) { return (Number(per[no][q.qId]) || 0) / q.points; };
    var p = n ? who.reduce(function (a, no) { return a + frac(no); }, 0) / n : null, disc = null;
    if (n >= 8) {
      var s = who.slice().sort(function (a, b) { return (tot[b] - (Number(per[b][q.qId]) || 0)) - (tot[a] - (Number(per[a][q.qId]) || 0)); }), k = Math.max(2, Math.round(n * 0.27));
      var up = s.slice(0, k).reduce(function (a, no) { return a + frac(no); }, 0) / k, lo = s.slice(-k).reduce(function (a, no) { return a + frac(no); }, 0) / k; disc = up - lo;
    }
    var dist = null, skip = 0;
    if (q.type === 'MCQ') { dist = q.choices.map(function () { return 0; }); x.rows.forEach(function (r) { if (r.scores[q.qId] === undefined) return; var v = Number(r.answers[q.qId]); if (v >= 1 && v <= dist.length) dist[v - 1]++; else skip++; }); }
    var full = n ? who.filter(function (no) { return frac(no) >= 0.999; }).length : 0;
    if (p !== null) (cat[q.cat || 'ไม่ระบุหมวด'] = cat[q.cat || 'ไม่ระบุหมวด'] || []).push(p);
    var flag = p === null ? ['ไม่มีผู้ตอบ', ''] : disc !== null && disc < 0 ? ['อำนาจจำแนกติดลบ — ตรวจเฉลย', 'bad'] : p < 0.2 ? ['ยากมาก — ทบทวนโจทย์/เฉลย', 'bad'] : p > 0.9 ? ['ง่ายมาก', 'warn'] : disc !== null && disc < 0.2 ? ['จำแนกได้น้อย', 'warn'] : ['ใช้ได้', 'ok'];
    return { no: i + 1, q: q, n: n, p: p, disc: disc, dist: dist, skip: skip, full: full, flag: flag };
  });
  // ความเที่ยงทั้งฉบับ (เฉพาะผู้ที่มีคะแนนครบทุกข้อ)
  var comp = nos.filter(function (no) { return qs.every(function (q) { return per[no][q.qId] !== undefined; }); }), alpha = null;
  var vr = function (a) { var m = a.reduce(function (s, v) { return s + v; }, 0) / a.length; return a.reduce(function (s, v) { return s + (v - m) * (v - m); }, 0) / (a.length - 1); };
  if (comp.length >= 8 && qs.length >= 2) { var vt = vr(comp.map(function (no) { return tot[no]; })), sv = qs.reduce(function (a, q) { return a + vr(comp.map(function (no) { return Number(per[no][q.qId]) || 0; })); }, 0); if (vt > 0) alpha = qs.length / (qs.length - 1) * (1 - sv / vt); }
  var sort = sess('tg_iasort') || 'no';
  function body() {
    var l = out.slice().sort(function (a, b) { return sort === 'p' ? (a.p === null ? 9 : a.p) - (b.p === null ? 9 : b.p) : sort === 'd' ? (a.disc === null ? 9 : a.disc) - (b.disc === null ? 9 : b.disc) : a.no - b.no; });
    return l.map(function (o) {
      var q = o.q, key = q.type === 'MCQ' ? 'เฉลย ' + TH[q.answer - 1] + '. ' + esc(String(q.choices[q.answer - 1] || '')) : '';
      return '<tr><td class="c">' + o.no + '<br><small class="muted">' + esc(q.qId) + '</small></td><td><span class="tag">' + esc(qtName(q.type)) + '</span> ' + esc(String(q.text).replace(/\s+/g, ' ').slice(0, 130)) + (String(q.text).length > 130 ? '…' : '') + (key ? '<br><small class="muted">' + key + '</small>' : '') + '</td><td class="c">' + q.points + '</td><td class="c">' + o.n + '</td>' +
        '<td class="r">' + (o.p === null ? '–' : '<b>' + o.p.toFixed(2) + '</b>') + '</td><td class="r">' + (o.disc === null ? '–' : o.disc.toFixed(2)) + '</td><td>' + (o.dist ? o.dist.map(function (v, i) { return (i + 1 === q.answer ? '<b>' : '') + TH[i] + ' ' + v + (i + 1 === q.answer ? '</b>' : ''); }).join(' · ') + (o.skip ? ' · ไม่ตอบ ' + o.skip : '') : 'ได้เต็ม ' + o.full + ' คน') + '</td><td><span class="tag ' + o.flag[1] + '">' + o.flag[0] + '</span></td></tr>';
    }).join('');
  }
  var head = '<thead><tr><th class="c">ข้อ</th><th>โจทย์</th><th class="c">คะแนน</th><th class="c">ผู้ตอบ</th><th class="r">ความยาก (p)</th><th class="r">อำนาจจำแนก (r)</th><th>การตอบ</th><th>ข้อสังเกต</th></tr></thead>';
  var info = 'ผู้ส่งคำตอบ ' + nos.length + ' คน · ข้อที่ระบบตรวจ ' + qs.length + ' ข้อ' + (alpha !== null ? ' · ความเที่ยงทั้งฉบับ (แอลฟาของครอนบาค) ' + alpha.toFixed(2) : '');
  var b = modal('<h2>วิเคราะห์ข้อสอบรายข้อ</h2><p class="muted">' + info + '</p>' +
    '<div class="note info"><b>ความยาก (p)</b> = สัดส่วนคะแนนที่ได้ต่อคะแนนเต็มของข้อ (0–1) ค่าที่เหมาะคือ 0.20–0.80 · <b>อำนาจจำแนก (r)</b> = p ของกลุ่มคะแนนสูง 27% ลบ p ของกลุ่มคะแนนต่ำ 27% (คิดคะแนนรวมโดยไม่นับข้อนั้น) ค่าตั้งแต่ 0.20 ขึ้นไปถือว่าใช้ได้ · ค่าติดลบแปลว่าคนเก่งตอบผิดมากกว่าคนอ่อน ควรตรวจเฉลย' + (nos.length < 8 ? ' · <b>ผู้สอบน้อยกว่า 8 คน จึงยังไม่คำนวณอำนาจจำแนกและความเที่ยง</b>' : nos.length < 30 ? ' · ผู้สอบน้อยกว่า 30 คน ค่าที่ได้ใช้เป็นแนวทางเท่านั้น' : '') + '</div>' +
    (Object.keys(cat).length > 1 ? '<div class="catbars">' + Object.keys(cat).map(function (k) { var m = cat[k].reduce(function (a, v) { return a + v; }, 0) / cat[k].length; return '<div><span>' + esc(k) + '</span><div class="bar"><i style="width:' + Math.round(m * 100) + '%"></i></div><b>' + Math.round(m * 100) + '%</b></div>'; }).join('') + '</div>' : '') +
    '<div class="gbar"><div class="seg sm" id="iaS"><button data-s="no">เรียงตามลำดับข้อ</button><button data-s="p">ยากสุดก่อน</button><button data-s="d">จำแนกต่ำสุดก่อน</button></div><div class="acts"><button class="btn ghost-dark sm" id="iaCsv">' + ICON.down + 'ส่งออก CSV</button><button class="btn ghost-dark sm" id="iaPr">' + ICON.print + 'พิมพ์</button></div></div>' +
    '<div class="tblwrap tall"><table class="tbl sm"> ' + head + '<tbody id="iaB"></tbody></table></div>', { cls: 'xl' });
  function paint() { $('#iaB', b).innerHTML = body(); $$('#iaS button', b).forEach(function (x) { x.classList.toggle('on', x.dataset.s === sort); }); }
  $$('#iaS button', b).forEach(function (x) { x.onclick = function () { sort = x.dataset.s; sess('tg_iasort', sort); paint(); }; });
  paint();
  $('#iaCsv', b).onclick = function () {
    var rows = [[e.title], ['วิเคราะห์ข้อสอบรายข้อ · ' + info + ' · ส่งออกเมื่อ ' + tDate(now())], [], ['ข้อ', 'รหัสข้อ', 'ชนิด', 'หมวด', 'โจทย์', 'คะแนนเต็ม', 'ผู้ตอบ', 'ความยาก (p)', 'อำนาจจำแนก (r)', 'ได้เต็ม (คน)', 'เลือก ก', 'เลือก ข', 'เลือก ค', 'เลือก ง', 'เลือก จ', 'เลือก ฉ', 'ไม่ตอบ', 'เฉลย', 'ข้อสังเกต']];
    out.forEach(function (o) { var q = o.q, dd = o.dist || []; rows.push([o.no, q.qId, qtName(q.type), q.cat, q.text, q.points, o.n, o.p === null ? '' : o.p.toFixed(3), o.disc === null ? '' : o.disc.toFixed(3), o.full, dd[0], dd[1], dd[2], dd[3], dd[4], dd[5], o.dist ? o.skip : '', q.type === 'MCQ' ? TH[q.answer - 1] : '', o.flag[0]]); });
    saveCsv('TalentGate_ItemAnalysis_' + e.examId + '.csv', rows);
  };
  $('#iaPr', b).onclick = function () {
    sort = 'no';
    printDoc(prWrap(prHead('ผลการวิเคราะห์ข้อสอบรายข้อ', [e.title, info]) + '<table class="pr-t">' + head + '<tbody>' + body() + '</tbody></table><p class="pr-small">ความยาก (p) = สัดส่วนคะแนนที่ได้ต่อคะแนนเต็ม · อำนาจจำแนก (r) = p กลุ่มสูง 27% − p กลุ่มต่ำ 27% · เกณฑ์ทั่วไป: p 0.20–0.80 และ r ตั้งแต่ 0.20</p>'), { landscape: true, title: 'ผลการวิเคราะห์ข้อสอบรายข้อ' });
  };
}

/* ---------- ประกาศและอีเมล (ผู้ดูแลระบบ) ---------- */
var MAIL_ST = { PENDING: ['รอส่ง', 'warn'], SENT: ['ส่งแล้ว', 'ok'], FAILED: ['ส่งไม่สำเร็จ', 'bad'], CANCELLED: ['ยกเลิก', ''] };
var MAIL_VARS = ['ชื่อ', 'เลขประจำตัวสอบ', 'ตำแหน่ง', 'รอบสอบ', 'วันสอบ', 'สถานที่', 'ลิงก์ประกาศ', 'วันหมดอายุลิงก์', 'รหัสเข้าสอบ'];
function tabMail() {
  var d = BD.data, e = d.exam, st = tabMail.st = tabMail.st && tabMail.st.id === BD.id ? tabMail.st : { id: BD.id, type: 'ELIGIBLE', sel: null, subject: null, body: null, share: '', when: 'now', at: '', saveTpl: false };
  if (!tabMail.r || tabMail.r.examId !== BD.id) $('#tab').innerHTML = '<div class="boot"><div class="boot-ring"></div><p>กำลังโหลด…</p></div>';
  function load() { return api('getMails', { examId: BD.id }).then(function (r) { r.examId = BD.id; tabMail.r = r; if (BD.tab === 'mail' && TG.view === 'board') { keep(); draw(); } }).catch(function (er) { toast(er.message, 'bad'); }); }
  function defSel(type) {
    var o = {};
    d.candidates.forEach(function (c) { var oc = outcomeOf(c); if (!c.hasEmail) return; if (type === 'PASS' ? oc === 'pass' : type === 'FAIL' ? oc === 'fail' : type === 'CUSTOM' ? false : c.status === 'ACTIVE') o[c.examNo] = 1; });
    return o;
  }
  function keep() { if ($('#mlSub')) { st.subject = $('#mlSub').value; st.body = $('#mlBody').value; st.share = $('#mlShare').value; st.when = $('#mlWhen').value; st.at = $('#mlAt').value; st.saveTpl = $('#mlTpl').checked; } }
  function draw() {
    var r = tabMail.r, tp = r.templates[st.type] || { subject: '', body: '' }, open = r.shares.filter(function (s) { return s.status === 'OPEN'; });
    if (st.subject === null) { st.subject = tp.subject; st.body = tp.body; }
    if (!st.sel) st.sel = defSel(st.type);
    if (!st.share && open.length && /\{\{\s*ลิงก์ประกาศ/.test(st.body)) { var want = st.type === 'ELIGIBLE' || st.type === 'SCHEDULE' ? 'ANN' : 'RES', m = open.filter(function (s) { return s.kind === want; })[0] || open[0]; st.share = m.fileId; }
    var noMail = d.candidates.filter(function (c) { return c.status === 'ACTIVE' && !c.hasEmail; }).length, nSel = Object.keys(st.sel).length;
    var h = '<div class="note info"><b>ลำดับการทำงาน:</b> ① พิมพ์ประกาศจากแท็บ <a href="#/staff/' + encodeURIComponent(e.examId) + '/reports">รายงาน</a> แล้วลงนาม/ประทับตรา → ② สแกนเป็น PDF แล้วอัปโหลดที่ "ไฟล์ประกาศ" ด้านล่าง (ระบบเปิดลิงก์ให้ผู้สมัครดู และ<b>ปิดลิงก์เองเมื่อครบจำนวนวัน</b>) → ③ เขียนอีเมล เลือกผู้รับ แล้วส่งทันทีหรือตั้งเวลา</div>';
    // ----- ไฟล์ประกาศ -----
    h += '<div class="card"><div class="card-head"><div><h2 class="card-t">ไฟล์ประกาศ (ลิงก์สำหรับผู้สมัคร)</h2><p class="card-s">ผู้ที่มีลิงก์เท่านั้นจึงเปิดดูได้ · ครบกำหนดแล้วระบบเปลี่ยนไฟล์เป็นส่วนตัวอัตโนมัติ (ตรวจทุก 10 นาที) · ปิดลิงก์เองได้ทุกเมื่อ</p></div></div>' +
      '<form class="inrow fw" id="shF"><label class="inl">ชนิด <select id="shK"><option value="ANN">ประกาศรายชื่อผู้มีสิทธิ์สอบ</option><option value="RES">ประกาศผลการสอบ</option><option value="OTHER">เอกสารอื่น</option></select></label><label class="inl">เปิดให้ดู <input id="shD" type="number" min="1" max="365" value="14" style="width:5.5em"> วัน</label><input type="file" id="shI" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required><button class="btn primary sm" id="shB">' + ICON.up + 'อัปโหลดและเปิดลิงก์</button></form>' +
      (r.shares.length ? '<div class="tblwrap"><table class="tbl sm"><thead><tr><th>ชนิด</th><th>ไฟล์</th><th>เปิดลิงก์ถึง</th><th>สถานะ</th><th></th></tr></thead><tbody>' + r.shares.map(function (s) {
        var on = s.status === 'OPEN';
        return '<tr><td>' + esc(s.kindTh) + '</td><td>' + (on ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a>' : esc(s.name)) + '<br><small class="muted">อัปโหลด ' + tDate(s.at) + '</small></td><td class="nowrap">' + tDate(s.until) + '</td><td>' + (on ? '<span class="tag ok">เปิดลิงก์อยู่</span>' : '<span class="tag">ปิดลิงก์แล้ว</span>') + '</td><td class="nowrap">' + (on ? '<button class="btn link" data-cp="' + esc(s.url) + '">คัดลอกลิงก์</button> <button class="btn link danger-t" data-cl="' + esc(s.fileId) + '">ปิดลิงก์</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="muted sm">ยังไม่มีไฟล์ประกาศของรอบสอบนี้</p>') + '</div>';
    // ----- เขียนอีเมล -----
    h += '<div class="card"><div class="card-head"><div><h2 class="card-t">เขียนอีเมลถึงผู้สมัคร</h2><p class="card-s">ส่งจากบัญชี Google ที่ติดตั้งระบบ ในชื่อ "' + esc(r.from || 'SOMDEJ TalentGate') + '"' + (r.reply ? ' · ตอบกลับไปที่ ' + esc(r.reply) : '') + ' · อีเมลมีหัวจดหมายโลโก้และชื่อโรงพยาบาล · โควตาวันนี้เหลือ <b>' + (r.quota === null ? 'ไม่ทราบ' : r.quota) + '</b> ฉบับ' + (noMail ? ' · <b class="bad-t">ผู้มีสิทธิ์สอบ ' + noMail + ' คนยังไม่มีอีเมล</b> (เพิ่มได้ที่แท็บผู้เข้าสอบ)' : '') + '</p></div></div>' +
      '<div class="seg wide" id="mlType">' + Object.keys(r.types).map(function (k) { return '<button data-t="' + k + '" class="' + (k === st.type ? 'on' : '') + '">' + esc(r.types[k]) + '</button>'; }).join('') + '</div>' +
      '<div class="mlgrid"><div class="form"><label>หัวเรื่อง<input id="mlSub" maxlength="300" value="' + esc(st.subject) + '"></label><label>เนื้อความ<textarea id="mlBody" rows="16" maxlength="6000">' + esc(st.body) + '</textarea></label>' +
      '<div class="mlvars"><small class="muted">แทรกข้อมูลของแต่ละคน:</small>' + MAIL_VARS.map(function (v) { return '<button type="button" class="chip" data-v="' + v + '">{{' + v + '}}</button>'; }).join('') + '</div>' +
      '<label>ไฟล์ประกาศที่ใช้กับ {{ลิงก์ประกาศ}}<select id="mlShare"><option value="">— ไม่แนบลิงก์ —</option>' + open.map(function (s) { return '<option value="' + esc(s.fileId) + '"' + (s.fileId === st.share ? ' selected' : '') + '>' + esc(s.kindTh) + ': ' + esc(s.name) + ' (ถึง ' + tDate(s.until) + ')</option>'; }).join('') + '</select></label>' +
      '<div class="row2"><label>เวลาส่ง<select id="mlWhen"><option value="now"' + (st.when === 'now' ? ' selected' : '') + '>ส่งทันที</option><option value="at"' + (st.when === 'at' ? ' selected' : '') + '>ตั้งเวลาส่ง</option></select></label><label>วันและเวลาที่ส่ง<input type="datetime-local" id="mlAt" value="' + esc(st.at) + '"' + (st.when === 'at' ? '' : ' disabled') + '></label></div>' +
      (st.type === 'CUSTOM' ? '<input type="checkbox" id="mlTpl" hidden>' : '<label class="chk"><input type="checkbox" id="mlTpl"' + (st.saveTpl ? ' checked' : '') + '> บันทึกข้อความนี้เป็นแม่แบบของ "' + esc(r.types[st.type]) + '" สำหรับรอบต่อไป</label>') + (tp.custom ? '<button type="button" class="btn link" id="mlDef">ใช้แม่แบบที่บันทึกไว้อีกครั้ง</button>' : '') + '</div>' +
      '<div><div class="gbar"><span>ผู้รับ <b id="mlN">' + nSel + '</b> คน</span><div class="acts"><button class="btn ghost-dark sm" data-g="active">ผู้มีสิทธิ์สอบทั้งหมด</button><button class="btn ghost-dark sm" data-g="pass">ผู้ผ่าน</button><button class="btn ghost-dark sm" data-g="fail">ผู้ไม่ผ่าน</button><button class="btn ghost-dark sm" data-g="none">ล้าง</button></div></div>' +
      '<input id="mlQ" class="srch" placeholder="ค้นหาเลขประจำตัวสอบหรือชื่อ"><div class="tblwrap tall mlrc"><table class="tbl sm"><tbody>' + d.candidates.map(function (c) {
        var oc = outcomeOf(c), t = OUT_TH[oc];
        return '<tr data-no="' + esc(c.examNo) + '" data-o="' + oc + '" data-q="' + esc((no3(c.examNo) + ' ' + c.name).toLowerCase()) + '"><td class="c"><input type="checkbox" class="ml-c"' + (st.sel[c.examNo] ? ' checked' : '') + (c.hasEmail ? '' : ' disabled') + '></td><td>' + cLabel(c) + '</td><td>' + (c.status !== 'ACTIVE' ? '<span class="tag">' + esc(CS_TH[c.status] || c.status) + '</span>' : '<span class="tag ' + t[1] + '">' + t[0] + '</span>') + (c.hasEmail ? '' : ' <span class="tag bad">ไม่มีอีเมล</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="muted sm">ผู้ที่ไม่ได้เข้าสอบจะไม่ถูกเลือกในกลุ่ม "ผู้ผ่าน/ผู้ไม่ผ่าน" — ติ๊กเพิ่มเองได้</p></div></div>' +
      '<div class="acts mlact"><button class="btn ghost-dark" id="mlPrev">ดูตัวอย่างอีเมล</button><button class="btn primary" id="mlSend">ส่งอีเมล</button><span class="gsave" id="mlS"></span></div></div>';
    // ----- รายการอีเมล -----
    var cnt = {}; r.mails.forEach(function (m) { cnt[m.status] = (cnt[m.status] || 0) + 1; });
    h += '<div class="card"><div class="card-head"><div><h2 class="card-t">รายการอีเมลของรอบสอบนี้</h2><p class="card-s">' + (r.mails.length ? Object.keys(MAIL_ST).filter(function (k) { return cnt[k]; }).map(function (k) { return MAIL_ST[k][0] + ' ' + cnt[k]; }).join(' · ') : 'ยังไม่มีอีเมล') + ' · ระบบส่งรอบละไม่เกิน ' + r.batch + ' ฉบับ ที่เหลือส่งต่อเองทุก 10 นาที' + (r.nPending && !r.trigger ? ' · <b class="bad-t">ตัวตั้งเวลายังไม่ทำงาน — กด "ส่งที่ค้างตอนนี้"</b>' : '') + '</p></div><div class="acts">' +
      (r.nPending ? '<button class="btn ghost-dark sm" id="mlNow">ส่งที่ค้างตอนนี้</button><button class="btn ghost-dark sm danger-t" id="mlCan">ยกเลิกที่รอส่งทั้งหมด</button>' : '') + (cnt.FAILED ? '<button class="btn ghost-dark sm" id="mlRe">ส่งซ้ำที่ไม่สำเร็จ</button>' : '') + '<button class="btn ghost-dark sm" id="mlRef">' + ICON.refresh + 'โหลดใหม่</button></div></div>' +
      (r.mails.length ? '<div class="tblwrap tall"><table class="tbl sm"><thead><tr><th>ผู้รับ</th><th>อีเมล</th><th>ประเภท / หัวเรื่อง</th><th>กำหนดส่ง</th><th>สถานะ</th></tr></thead><tbody>' + r.mails.map(function (m) {
        var s = MAIL_ST[m.status] || [m.status, ''];
        return '<tr><td><b class="cno">' + esc(no3(m.examNo)) + '</b> ' + esc(m.name) + '</td><td>' + esc(m.to) + '</td><td>' + esc(m.typeTh) + '<br><small class="muted">' + esc(m.subject) + '</small></td><td class="nowrap">' + tDate(m.sendAt) + '</td><td><span class="tag ' + s[1] + '">' + s[0] + '</span>' + (m.sentAt && m.status === 'SENT' ? '<br><small class="muted">' + tDate(m.sentAt) + '</small>' : '') + (m.err ? '<br><small class="bad-t">' + esc(m.err) + '</small>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '') + '</div>';
    var of = $('#shI'), ok = $('#shK') ? $('#shK').value : '', od = $('#shD') ? $('#shD').value : '';   // เก็บไฟล์ที่เลือกค้างไว้ ไม่ให้หายเมื่อหน้าจอรีเฟรช
    keepScroll(function () { $('#tab').innerHTML = h; });
    if (of && of.files && of.files.length && $('#shI')) { $('#shI').replaceWith(of); if (ok) $('#shK').value = ok; if (od) $('#shD').value = od; }
    bind();
  }
  function bind() {
    var r = tabMail.r;
    function count() { st.sel = {}; $$('.ml-c').forEach(function (x) { if (x.checked) st.sel[x.closest('tr').dataset.no] = 1; }); $('#mlN').textContent = Object.keys(st.sel).length; }
    $$('#mlType button').forEach(function (b) { b.onclick = function () { st.type = b.dataset.t; st.subject = null; st.body = null; st.sel = null; st.share = ''; st.saveTpl = false; draw(); }; });
    $$('[data-g]').forEach(function (b) { b.onclick = function () { var g = b.dataset.g; $$('.ml-c').forEach(function (x) { if (x.disabled) return; var tr = x.closest('tr'), c = d.candidates.filter(function (y) { return y.examNo === tr.dataset.no; })[0]; x.checked = g === 'none' ? false : g === 'active' ? c.status === 'ACTIVE' : tr.dataset.o === g; }); count(); }; });
    $$('.ml-c').forEach(function (x) { x.onchange = count; });
    $('#mlQ').oninput = function () { var q = this.value.trim().toLowerCase(); $$('.mlrc tr').forEach(function (tr) { tr.hidden = !!q && tr.dataset.q.indexOf(q) < 0; }); };
    $('#mlWhen').onchange = function () { $('#mlAt').disabled = this.value !== 'at'; };
    $$('.mlvars [data-v]').forEach(function (b) { b.onclick = function () { var t = $('#mlBody'), v = '{{' + b.dataset.v + '}}', a = t.selectionStart || 0, z = t.selectionEnd || 0; t.value = t.value.slice(0, a) + v + t.value.slice(z); t.focus(); t.selectionStart = t.selectionEnd = a + v.length; }; });
    if ($('#mlDef')) $('#mlDef').onclick = function () { st.subject = null; st.body = null; draw(); };
    $('#mlPrev').onclick = function () {
      var b = this; keep(); busy(b, true, 'กำลังเตรียม…');
      api('getMails', { examId: BD.id, preview: { body: st.body, share: st.share } }).then(function (x) { busy(b, false); modal('<h2>ตัวอย่างอีเมล</h2><p class="muted sm">หัวเรื่อง: <b>' + esc(st.subject.replace(/\{\{\s*ตำแหน่ง\s*\}\}/g, e.posName)) + '</b> · ข้อมูลในตัวอย่างเป็นผู้สมัครสมมติ · โลโก้จะแสดงในอีเมลจริง</p><div class="mailprev">' + x.preview + '</div>', { cls: 'lg' }); }).catch(function (er) { busy(b, false); toast(er.message, 'bad'); });
    };
    $('#mlSend').onclick = function () {
      keep(); count();
      var nos = Object.keys(st.sel), at = 0;
      if (!nos.length) return toast('กรุณาเลือกผู้รับอย่างน้อย 1 คน', 'warn');
      if (!st.subject.trim() || !st.body.trim()) return toast('กรุณากรอกหัวเรื่องและเนื้อความ', 'warn');
      if (st.when === 'at') { at = st.at ? new Date(st.at).getTime() : 0; if (!at || isNaN(at)) return toast('กรุณาเลือกวันและเวลาที่ต้องการส่ง', 'warn'); if (at < now() - 60000) return toast('เวลาที่ตั้งส่งผ่านไปแล้ว', 'warn'); }
      var code = /\{\{\s*รหัสเข้าสอบ\s*\}\}/.test(st.body), over = r.quota !== null && !at && nos.length > r.quota;
      askPass('ยืนยันการส่งอีเมล', '<p><b>' + esc(r.types[st.type]) + '</b> ถึงผู้สมัคร <b>' + nos.length + ' คน</b> · ' + (at ? 'ตั้งเวลาส่ง ' + tLong(at) : 'ส่งทันที') + '</p>' + (code ? '<div class="note warn">เนื้อความมี <b>รหัสเข้าสอบ</b> ของผู้สมัคร — ตรวจให้แน่ใจว่าอีเมลของแต่ละคนถูกต้อง</div>' : '') + (over ? '<div class="note warn">โควตาอีเมลวันนี้เหลือ ' + r.quota + ' ฉบับ ส่วนที่เกินจะรอส่งเมื่อโควตากลับมา (รอบถัดไปของวันพรุ่งนี้)</div>' : '') + '<p class="muted">อีเมลที่ส่งแล้วเรียกคืนไม่ได้ · ระบบบันทึกผู้ส่งและเวลาไว้ในประวัติ</p>', at ? 'ตั้งเวลาส่ง' : 'ส่งอีเมล').then(function (p) {
        if (!p) return;
        var b = $('#mlSend'); busy(b, true, 'กำลังส่ง…');
        api('queueMails', { examId: BD.id, type: st.type, examNos: nos, subject: st.subject, body: st.body, share: st.share, sendAt: at, saveTpl: st.saveTpl, password: p.password }, { timeout: 240000 }).then(function (x) {
          toast(x.scheduled ? 'ตั้งเวลาส่งแล้ว ' + x.queued + ' ฉบับ' : 'ส่งแล้ว ' + x.sent + ' ฉบับ' + (x.failed ? ' · ไม่สำเร็จ ' + x.failed : '') + (x.left ? ' · รอส่งต่ออัตโนมัติ ' + x.left : ''), x.failed ? 'bad' : 'ok', 8000);
          if (x.noEmail && x.noEmail.length) toast('ข้าม ' + x.noEmail.length + ' คนที่ไม่มีอีเมล', 'warn');
          st.sel = null; st.saveTpl = false; load();
        }).catch(function (er) { busy(b, false); toast(er.message, 'bad', 9000); });
      });
    };
    $('#shF').onsubmit = function (ev) {
      ev.preventDefault(); keep();
      var f = $('#shI').files[0], b = $('#shB'); if (!f) return;
      if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) return toast('รับเฉพาะไฟล์ PDF, JPG หรือ PNG', 'bad');
      if (f.size > 20 * 1048576) return toast('ไฟล์ใหญ่เกิน 20 MB', 'bad');
      busy(b, true, 'กำลังอัปโหลด…');
      fileB64(f).then(function (b64) { return api('uploadShare', { examId: BD.id, kind: $('#shK').value, days: $('#shD').value, name: f.name, b64: b64 }, { timeout: 180000 }); })
        .then(function (s) { toast('อัปโหลดแล้ว เปิดลิงก์ถึง ' + tDate(s.until), 'ok'); st.share = s.fileId; load(); }).catch(function (er) { busy(b, false); toast(er.message, 'bad'); });
    };
    $$('[data-cp]').forEach(function (b) { b.onclick = function () { var u = b.dataset.cp; (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { toast('คัดลอกลิงก์แล้ว', 'ok'); }, function () { modal('<h2>ลิงก์ประกาศ</h2><input readonly value="' + esc(u) + '" onfocus="this.select()">', { cls: 'sm' }); }); }; });
    $$('[data-cl]').forEach(function (b) { b.onclick = function () { confirmBox('ปิดลิงก์ไฟล์ประกาศ', '<p>ผู้ที่มีลิงก์จะเปิดไฟล์นี้ไม่ได้อีก (ไฟล์ยังอยู่ในโฟลเดอร์ของรอบสอบ)</p>', 'ปิดลิงก์', true).then(function (y) { if (!y) return; keep(); api('closeShare', { examId: BD.id, fileId: b.dataset.cl }).then(function () { toast('ปิดลิงก์แล้ว', 'ok'); if (st.share === b.dataset.cl) st.share = ''; load(); }).catch(function (er) { toast(er.message, 'bad'); }); }); }; });
    var act = function (id, fn) { var b = $(id); if (b) b.onclick = function () { keep(); fn(b); }; };
    act('#mlRef', function (b) { busy(b, true, 'กำลังโหลด…'); load(); });
    act('#mlNow', function (b) { busy(b, true, 'กำลังส่ง…'); api('sendMailsNow', { examId: BD.id }, { timeout: 240000 }).then(function (x) { toast('ส่งแล้ว ' + x.sent + ' ฉบับ' + (x.failed ? ' · ไม่สำเร็จ ' + x.failed : '') + (x.left ? ' · คงค้าง ' + x.left : ''), x.failed ? 'bad' : 'ok'); load(); }).catch(function (er) { busy(b, false); toast(er.message, 'bad'); }); });
    act('#mlRe', function (b) { busy(b, true, 'กำลังส่ง…'); api('sendMailsNow', { examId: BD.id, retry: true }, { timeout: 240000 }).then(function (x) { toast('ส่งซ้ำแล้ว สำเร็จ ' + x.sent + ' ฉบับ' + (x.failed ? ' · ไม่สำเร็จ ' + x.failed : ''), x.failed ? 'bad' : 'ok'); load(); }).catch(function (er) { busy(b, false); toast(er.message, 'bad'); }); });
    act('#mlCan', function () { confirmBox('ยกเลิกอีเมลที่รอส่ง', '<p>อีเมลที่ยังไม่ได้ส่งของรอบสอบนี้ทั้งหมดจะถูกยกเลิก (ที่ส่งไปแล้วไม่มีผล)</p>', 'ยกเลิกอีเมลที่รอส่ง', true).then(function (y) { if (y) api('cancelMails', { examId: BD.id, all: true }).then(function (x) { toast('ยกเลิกแล้ว ' + x.n + ' ฉบับ', 'ok'); load(); }).catch(function (er) { toast(er.message, 'bad'); }); }); });
  }
  if (tabMail.r && tabMail.r.examId === BD.id) draw();
  load();
}
