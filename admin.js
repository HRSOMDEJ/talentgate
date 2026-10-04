/* =====================================================================
   SOMDEJ TalentGate · admin.js — ผู้ดูแลระบบ: ตั้งค่ารอบสอบ · ผู้เข้าสอบ · คลังข้อสอบ · ตำแหน่ง · เจ้าหน้าที่ · ตั้งค่า
   ===================================================================== */
var AD = { data: null, at: 0, setId: null, qs: null, showCodes: false, cands: null };
var QT_TH = { MCQ: 'ปรนัย 4 ตัวเลือก', ESSAY: 'ข้อเขียน', SJT: 'สถานการณ์ (ทัศนคติ)', MBTI: 'บุคลิกภาพ 2 ตัวเลือก' };
function loadAdmin(force) {
  if (AD.data && !force && Date.now() - AD.at < 20000) return Promise.resolve(AD.data);
  return api('getAdminData').then(function (d) { AD.data = d; AD.at = Date.now(); return d; });
}
function adminRoute(parts) {
  boardStop(); TG.view = 'admin'; markNav();
  var fn = { bank: viewBank, positions: viewPositions, staff: viewPeople, settings: viewSettings }[parts[0]];
  if (!fn) { location.hash = '#/staff'; return; }
  if (!AD.data) $('#app').innerHTML = '<div class="boot"><div class="boot-ring"></div></div>';
  var first = !AD.data;
  loadAdmin().then(function () { if (TG.view === 'admin') { if (first) enterAnim(); fn(parts[1]); } }).catch(function (e) { toast(e.message, 'bad'); });
}
function val(id, el) { var x = $('#' + id, el); return x ? x.value.trim() : ''; }

/* ====================== สร้างรอบสอบใหม่ ====================== */
function newExamModal() {
  loadAdmin(true).then(function (d) {
    var pos = d.positions.filter(function (p) { return p.active; });
    if (!pos.length) return toast('กรุณาเพิ่มตำแหน่งก่อน ที่เมนู "ตำแหน่ง"', 'bad');
    var b = modal('<h2>สร้างรอบสอบใหม่</h2><form class="form" id="neF"><label>ตำแหน่งที่เปิดสอบ<select id="nePos">' + pos.map(function (p) { return '<option value="' + esc(p.posId) + '">' + esc(p.name) + (p.dept ? ' · ' + esc(p.dept) : '') + '</option>'; }).join('') + '</select></label>' +
      '<label>ชื่อรอบสอบ<input id="neT" maxlength="200" required placeholder="เช่น สอบคัดเลือกบุคลากรสัญญาจ้าง ตำแหน่ง…"></label><div class="row2"><label>วันและเวลาสอบ<input id="neD" maxlength="100" placeholder="เช่น วันจันทร์ที่ 2 พฤศจิกายน 2569 เวลา 09.00 น."></label><label>สถานที่<input id="neP" maxlength="200"></label></div>' +
      '<label>โครงตอนสอบเริ่มต้น<select id="neC"><option value="">โครงมาตรฐาน (ทัศนคติ + ทฤษฎีจากชุดกลาง)</option>' + d.exams.map(function (e) { return '<option value="' + esc(e.examId) + '">คัดลอกจาก: ' + esc(e.title) + '</option>'; }).join('') + '</select></label>' +
      '<p class="muted sm">สร้างแล้วระบบจะพาไปหน้า "ตั้งค่ารอบสอบ" เพื่อเลือกชุดข้อสอบ เวลา และกรรมการ</p><div class="modal-act"><button type="button" class="btn ghost-dark" id="neX">ยกเลิก</button><button class="btn primary" id="neS">สร้างรอบสอบ</button></div></form>');
    $('#neX', b).onclick = closeModal;
    $('#neF', b).onsubmit = function (ev) {
      ev.preventDefault(); var src = d.exams.filter(function (e) { return e.examId === val('neC', b); })[0], secs;
      if (src) secs = src.sections.map(function (s) { return { type: s.type, title: s.title, minutes: s.minutes, sets: s.sets, shuffle: s.shuffle, instructions: s.instructions, rubric: s.rubric }; });
      else {
        var c = d.sets.filter(function (s) { return s.active && s.kind === 'CENTRAL' && !/^ชุดเสริม/.test(s.note || ''); });   // ชุดเสริมไม่ถูกเลือกอัตโนมัติ
        secs = [{ type: 'PROFILE', title: 'ตอนที่ 1 ทัศนคติและบุคลิกภาพ', minutes: 10, sets: c.filter(function (s) { return s.qtype === 'SJT' || s.qtype === 'MBTI'; }).map(function (s) { return s.setId; }), instructions: 'ตอนนี้ไม่มีคำตอบถูกหรือผิด และไม่นำไปคิดคะแนน โปรดเลือกคำตอบที่ตรงกับสิ่งที่ท่านจะทำจริงมากที่สุด' },
          { type: 'THEORY', title: 'ตอนที่ 2 ภาคทฤษฎี', minutes: 50, shuffle: true, sets: c.filter(function (s) { return s.qtype === 'MCQ'; }).map(function (s) { return s.setId; }), instructions: 'เลือกคำตอบที่ถูกต้องที่สุดเพียงข้อเดียว ไม่อนุญาตให้ใช้อุปกรณ์สื่อสารหรือเครื่องมือ AI' }].filter(function (s) { return s.sets.length; });
      }
      busy($('#neS', b), true);
      api('saveExam', { exam: { posId: val('nePos', b), title: val('neT', b), examDate: val('neD', b), place: val('neP', b), passPct: src ? src.passPct : 60, blind: src ? src.blind : true, committee: src ? src.committee : [] }, sections: secs })
        .then(function (r) { AD.at = 0; TG.home = null; closeModal(); toast('สร้างรอบสอบแล้ว', 'ok'); location.hash = '#/staff/' + encodeURIComponent(r.examId) + '/setup'; })
        .catch(function (e) { busy($('#neS', b), false); toast(e.message, 'bad'); });
    };
  }).catch(function (e) { toast(e.message, 'bad'); });
}

/* ====================== ตั้งค่ารอบสอบ (แท็บในกระดาน) ====================== */
function tabSetup() {
  $('#tab').innerHTML = '<div class="boot"><div class="boot-ring"></div></div>';
  loadAdmin(true).then(function (d) {
    if (BD.tab !== 'setup' || TG.view !== 'board' || !$('#tab')) return;
    var ex = d.exams.filter(function (e) { return e.examId === BD.id; })[0]; if (!ex) return;
    var secs = JSON.parse(JSON.stringify(ex.sections)), ro = ex.status === 'FINAL', lock = ex.hasAttempts, staff = d.staff.filter(function (u) { return u.active; });
    function setChips(s, i) {
      var want = s.type === 'PROFILE' ? ['SJT', 'MBTI'] : ['MCQ', 'ESSAY'], list = d.sets.filter(function (x) { return want.indexOf(x.qtype) >= 0 && (x.active || s.sets.indexOf(x.setId) >= 0); });
      function grp(kind, label) {
        var l = list.filter(function (x) { return x.kind === kind; }); if (!l.length) return '';
        return '<div class="setgrp"><small>' + label + '</small>' + l.map(function (x) { return '<label class="setchip"><input type="checkbox" data-set="' + i + '" value="' + esc(x.setId) + '"' + (s.sets.indexOf(x.setId) >= 0 ? ' checked' : '') + (ro || lock && s.secId ? ' disabled' : '') + '><span><b>' + esc(x.name) + '</b><i>' + x.n + ' ข้อ' + (x.pts ? ' · ' + x.pts + ' คะแนน' : '') + '</i></span></label>'; }).join('') + '</div>';
      }
      return grp('CENTRAL', 'ชุดกลาง (เลือกใช้ได้ทุกตำแหน่ง)') + grp('POSITION', 'ชุดเฉพาะตำแหน่ง') || '<p class="muted sm">ยังไม่มีชุดข้อสอบประเภทนี้ในคลัง</p>';
    }
    function secMax(s) { return s.type === 'PROFILE' ? 0 : s.type === 'PRACTICAL' ? (s.rubric || []).reduce(function (a, r) { return a + (Number(r.max) || 0); }, 0) : s.sets.reduce(function (a, id) { var x = d.sets.filter(function (q) { return q.setId === id; })[0]; return a + (x ? x.pts : 0); }, 0); }
    function draw() {
      var total = secs.reduce(function (a, s) { return a + secMax(s); }, 0), mins = secs.reduce(function (a, s) { return a + (Number(s.minutes) || 0); }, 0);
      var h = (lock ? '<div class="note warn">มีผู้เข้าสอบเริ่มทำข้อสอบแล้ว จึงเปลี่ยนประเภทตอน ชุดข้อสอบ หรือเพิ่ม/ลบตอนไม่ได้ (แก้ชื่อ เวลา คำชี้แจง เกณฑ์ และกรรมการได้)</div>' : '') + (ro ? '<div class="note warn">รอบสอบนี้ยืนยันผลแล้ว แก้ไขไม่ได้</div>' : '') +
        '<div class="card"><h2 class="card-t">ข้อมูลรอบสอบ</h2><div class="form"><label>ชื่อรอบสอบ<input id="sxT" maxlength="200" value="' + esc(ex.title) + '"></label><div class="row2"><label>ตำแหน่ง<select id="sxPos">' + d.positions.map(function (p) { return '<option value="' + esc(p.posId) + '"' + (p.posId === ex.posId ? ' selected' : '') + '>' + esc(p.name) + (p.dept ? ' · ' + esc(p.dept) : '') + '</option>'; }).join('') + '</select></label>' +
        '<label>เกณฑ์ผ่าน (ร้อยละของคะแนนเต็ม)<input id="sxPass" type="number" min="0" max="100" value="' + ex.passPct + '"></label></div><div class="row2"><label>วันและเวลาสอบ<input id="sxD" maxlength="100" value="' + esc(ex.examDate) + '"></label><label>สถานที่<input id="sxP" maxlength="200" value="' + esc(ex.place) + '"></label></div>' +
        '<label>หมายเหตุ<input id="sxN" maxlength="500" value="' + esc(ex.note) + '"></label><label class="chk"><input type="checkbox" id="sxBlind"' + (ex.blind ? ' checked' : '') + '> ปิดชื่อผู้เข้าสอบในหน้าตรวจ (เห็นเฉพาะเลขประจำตัวสอบ) — ไม่ติ๊ก = แสดงชื่อ-สกุลให้กรรมการเห็นขณะตรวจ · สลับได้จากสวิตช์ในแท็บตรวจเช่นกัน</label></div></div>' +
        '<div class="card"><h2 class="card-t">คณะกรรมการสอบรอบนี้</h2><p class="card-s">กรรมการเห็นและให้คะแนนได้เฉพาะรอบสอบที่ได้รับแต่งตั้ง · เพิ่มรายชื่อเจ้าหน้าที่ได้ที่เมนู "เจ้าหน้าที่"</p><div class="setgrp">' +
        staff.map(function (u) { return '<label class="setchip"><input type="checkbox" class="sx-cm" value="' + esc(u.empCode) + '"' + (ex.committee.indexOf(u.empCode) >= 0 ? ' checked' : '') + '><span><b>' + esc(u.name) + '</b><i>' + esc(u.empCode) + (u.roles.indexOf('ADMIN') >= 0 ? ' · ผู้ดูแล' : '') + '</i></span></label>'; }).join('') + '</div></div>' +
        '<div class="card-head"><h2 class="sec-h">ตอนสอบ <small class="muted">รวม ' + mins + ' นาที · ' + total + ' คะแนน</small></h2>' + (ro || lock ? '' : '<button class="btn ghost-dark sm" id="sxAdd">' + ICON.plus + 'เพิ่มตอน</button>') + '</div>';
      secs.forEach(function (s, i) {
        h += '<div class="card secedit" data-i="' + i + '"><div class="se-h"><span class="se-n">' + (i + 1) + '</span><input class="se-t" data-f="title" maxlength="160" value="' + esc(s.title) + '" placeholder="ชื่อตอน">' +
          '<select data-f="type"' + (lock && s.secId || ro ? ' disabled' : '') + '>' + ['PROFILE', 'THEORY', 'PRACTICAL'].map(function (t) { return '<option value="' + t + '"' + (s.type === t ? ' selected' : '') + '>' + TYPE_TH[t] + '</option>'; }).join('') + '</select>' +
          '<label class="se-m"><input type="number" data-f="minutes" min="1" max="300" value="' + s.minutes + '"> นาที</label><span class="se-x"><button class="icon-btn dark" data-mv="-1" title="เลื่อนขึ้น"' + (i === 0 ? ' disabled' : '') + '>↑</button><button class="icon-btn dark" data-mv="1" title="เลื่อนลง"' + (i === secs.length - 1 ? ' disabled' : '') + '>↓</button>' +
          (lock || ro ? '' : '<button class="icon-btn dark" data-rm="1" title="ลบตอน">×</button>') + '</span></div><label class="se-l">คำชี้แจงที่ผู้เข้าสอบเห็น<textarea data-f="instructions" rows="2" maxlength="4000">' + esc(s.instructions) + '</textarea></label>';
        if (s.type !== 'PRACTICAL') h += '<div class="se-l">ชุดข้อสอบที่ใช้ในตอนนี้</div>' + setChips(s, i) + (s.type === 'THEORY' ? '<label class="chk"><input type="checkbox" data-f="shuffle"' + (s.shuffle ? ' checked' : '') + '> สลับลำดับข้อปรนัยไม่เหมือนกันในแต่ละคน (ข้อเขียนอยู่ท้ายเสมอ)</label><p class="muted sm">คะแนนเต็มของตอนนี้ = ' + secMax(s) + ' (รวมจากข้อสอบในชุดที่เลือก)</p>' : '<p class="muted sm">ตอนนี้ไม่คิดคะแนน ใช้เป็นข้อมูลประกอบการสัมภาษณ์</p>');
        else h += '<div class="se-l">ไฟล์โจทย์ (.xlsx)</div><div class="tplrow">' + ICON.file + '<span>' + (s.hasTemplate ? esc(s.tplName) : '<b class="bad-t">ยังไม่มีไฟล์โจทย์</b>') + '</span>' + (s.secId ? (ro ? '' : '<label class="btn ghost-dark sm">อัปโหลดไฟล์โจทย์' + (s.hasTemplate ? 'ใหม่' : '') + '<input type="file" accept=".xlsx" hidden data-tpl="' + esc(s.secId) + '"></label>') : '<small class="muted">บันทึกการตั้งค่าก่อน จึงอัปโหลดไฟล์ได้</small>') + '</div>' +
          '<div class="se-l">เกณฑ์ให้คะแนน (กรรมการให้คะแนนตามหัวข้อเหล่านี้) — รวม ' + secMax(s) + ' คะแนน</div><table class="tbl rub-e"><thead><tr><th>หัวข้อ</th><th class="r">คะแนนเต็ม</th><th>แนวทางให้คะแนน</th><th></th></tr></thead><tbody>' +
          (s.rubric || []).map(function (r, j) { return '<tr data-j="' + j + '"><td><input data-r="label" maxlength="120" value="' + esc(r.label) + '"></td><td class="r"><input data-r="max" type="number" min="0" max="100" step="0.5" value="' + r.max + '"></td><td><textarea data-r="guide" rows="2" maxlength="1500">' + esc(r.guide || '') + '</textarea></td><td>' + (ro ? '' : '<button class="icon-btn dark" data-rr="' + j + '" title="ลบหัวข้อ">×</button>') + '</td></tr>'; }).join('') +
          '</tbody></table>' + (ro ? '' : '<button class="btn link" data-ra="1">' + ICON.plus + 'เพิ่มหัวข้อ</button>');
        h += '</div>';
      });
      h += ro ? '' : '<div class="savebar"><button class="btn primary lg" id="sxSave">บันทึกการตั้งค่า</button>' + (lock ? '' : '<button class="btn link danger-t" id="sxDel">ลบรอบสอบนี้</button>') + '</div>';
      $('#tab').innerHTML = h; bind();
    }
    function pull() {   // อ่านค่าจากหน้าจอกลับเข้าตัวแปร
      $$('.secedit').forEach(function (card) {
        var s = secs[+card.dataset.i];
        $$('[data-f]', card).forEach(function (x) { s[x.dataset.f] = x.type === 'checkbox' ? x.checked : x.type === 'number' ? Number(x.value) : x.value; });
        if (s.type !== 'PRACTICAL') { var cb = $$('[data-set]', card); if (cb.length) s.sets = cb.filter(function (x) { return x.checked; }).map(function (x) { return x.value; }); }
        $$('.rub-e tbody tr', card).forEach(function (tr) { var r = s.rubric[+tr.dataset.j]; $$('[data-r]', tr).forEach(function (x) { r[x.dataset.r] = x.dataset.r === 'max' ? Number(x.value) : x.value; }); });
      });
      ex.title = val('sxT'); ex.posId = val('sxPos'); ex.passPct = Number(val('sxPass')); ex.examDate = val('sxD'); ex.place = val('sxP'); ex.note = val('sxN'); ex.blind = $('#sxBlind').checked;
      ex.committee = $$('.sx-cm').filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
    }
    function bind() {
      $$('.secedit').forEach(function (card) {
        var i = +card.dataset.i, s = secs[i];
        $$('[data-mv]', card).forEach(function (b) { b.onclick = function () { pull(); var j = i + Number(b.dataset.mv), t = secs[i]; secs[i] = secs[j]; secs[j] = t; draw(); }; });
        var rm = $('[data-rm]', card); if (rm) rm.onclick = function () { pull(); secs.splice(i, 1); draw(); };
        var ty = $('[data-f=type]', card); ty.onchange = function () { pull(); s.sets = []; if (s.type === 'PRACTICAL' && !(s.rubric || []).length) s.rubric = [{ label: 'งานที่ 1', max: 10, guide: '' }]; draw(); };
        $$('[data-set]', card).forEach(function (x) { x.onchange = function () { pull(); draw(); }; });
        $$('[data-rr]', card).forEach(function (b) { b.onclick = function () { pull(); s.rubric.splice(+b.dataset.rr, 1); draw(); }; });
        var ra = $('[data-ra]', card); if (ra) ra.onclick = function () { pull(); (s.rubric = s.rubric || []).push({ label: '', max: 5, guide: '' }); draw(); };
        $$('[data-r=max]', card).forEach(function (x) { x.onchange = function () { pull(); draw(); }; });
        var tp = $('[data-tpl]', card); if (tp) tp.onchange = function () {
          var f = tp.files[0]; if (!f) return; if (!/\.xlsx$/i.test(f.name)) return toast('ไฟล์โจทย์ต้องเป็น .xlsx', 'bad');
          toast('กำลังอัปโหลดไฟล์โจทย์…'); fileB64(f).then(function (b64) { return api('uploadTemplate', { secId: tp.dataset.tpl, name: f.name, b64: b64 }, { timeout: 180000 }); }).then(function () { toast('อัปโหลดไฟล์โจทย์แล้ว', 'ok'); s.hasTemplate = true; s.tplName = f.name; AD.at = 0; BD.at = 0; pull(); draw(); }).catch(function (e) { toast(e.message, 'bad'); });
        };
      });
      if ($('#sxAdd')) $('#sxAdd').onclick = function () { pull(); secs.push({ type: 'THEORY', title: 'ตอนที่ ' + (secs.length + 1), minutes: 30, sets: [], shuffle: true, instructions: '', rubric: [] }); draw(); };
      if ($('#sxSave')) $('#sxSave').onclick = function () {
        pull(); var b = this; busy(b, true, 'กำลังบันทึก…');
        api('saveExam', { exam: ex, sections: secs }).then(function () { toast('บันทึกการตั้งค่าแล้ว', 'ok'); AD.at = 0; TG.home = null; BD.at = 0; return loadBoard(); }).then(function () { if (BD.tab === 'setup') tabSetup(); }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); });
      };
      if ($('#sxDel')) $('#sxDel').onclick = function () { askPass('ลบรอบสอบ', '<div class="note bad">รอบสอบ ตอนสอบ และรายชื่อผู้เข้าสอบของรอบนี้จะถูกลบถาวร</div>', 'ลบรอบสอบ').then(function (r) { if (r) api('deleteExam', { examId: ex.examId, password: r.password }).then(function () { toast('ลบรอบสอบแล้ว', 'ok'); AD.at = 0; TG.home = null; BD.data = null; location.hash = '#/staff'; }).catch(function (e) { toast(e.message, 'bad'); }); }); };
    }
    draw();
  }).catch(function (e) { toast(e.message, 'bad'); });
}

/* ====================== ผู้เข้าสอบ (แท็บในกระดาน) ====================== */
function tabCands() {
  var ro = readonly();
  function load() { return api('getCandidates', { examId: BD.id }).then(function (r) { AD.cands = r; if (BD.tab === 'cands' && TG.view === 'board') draw(); }).catch(function (e) { toast(e.message, 'bad'); }); }
  function draw() {
    var r = AD.cands, list = r.candidates, act = list.filter(function (c) { return c.status === 'ACTIVE'; }).length;
    var h = '<div class="card"><div class="card-head"><div><h2 class="card-t">รายชื่อผู้เข้าสอบ</h2><p class="card-s">ทั้งหมด ' + list.length + ' คน · มีสิทธิ์สอบ ' + act + ' คน · รหัสเข้าสอบ 6 หลักใช้ได้เฉพาะรอบนี้และเฉพาะช่วงที่สถานะเป็น "เปิดสอบ"</p></div><div class="acts">' +
      (ro ? '' : '<button class="btn primary sm" id="cdImp">นำเข้ารายชื่อ</button><button class="btn ghost-dark sm" id="cdAdd">' + ICON.plus + 'เพิ่มรายคน</button>') + '<button class="btn ghost-dark sm" id="cdShow">' + (AD.showCodes ? 'ซ่อนรหัส' : 'แสดงรหัส') + '</button><button class="btn ghost-dark sm" id="cdPrint">' + ICON.print + 'พิมพ์ใบรหัสเข้าสอบ</button><button class="btn ghost-dark sm" id="cdCheck">' + ICON.print + 'พิมพ์ใบลงชื่อ</button>' +
      (ro ? '' : '<button class="btn ghost-dark sm" id="cdRegen">ออกรหัสใหม่ทั้งรอบ</button>') + '</div></div>';
    if (!list.length) h += '<div class="empty"><h3>ยังไม่มีรายชื่อ</h3><p class="muted">กด "นำเข้ารายชื่อ" แล้ววางรายชื่อจาก Excel (เลขประจำตัวสอบ และชื่อ-สกุล)</p></div>';
    else h += '<div class="tblwrap"><table class="tbl"><thead><tr><th>เลขประจำตัวสอบ</th><th>ชื่อ-สกุล</th><th>รหัสเข้าสอบ</th><th>สถานะ</th><th>หมายเหตุ</th><th>เข้าระบบล่าสุด</th><th></th></tr></thead><tbody>' + list.map(function (c) {
      return '<tr data-no="' + esc(c.examNo) + '" class="' + (c.status !== 'ACTIVE' ? 'off' : '') + '"><td><b class="cno">' + esc(no3(c.examNo)) + '</b></td><td>' + esc(c.name) + '</td><td><code class="code">' + (AD.showCodes ? esc(c.code) : '••••••') + '</code></td><td><select class="cd-st"' + (ro ? ' disabled' : '') + '>' + Object.keys(CS_TH).map(function (k) { return '<option value="' + k + '"' + (c.status === k ? ' selected' : '') + '>' + CS_TH[k] + '</option>'; }).join('') + '</select></td><td>' + esc(c.note) + '</td><td>' + (c.lastLogin ? tDate(c.lastLogin) : '<span class="muted">–</span>') + '</td><td class="nowrap">' +
        (ro ? '' : '<button class="btn link cd-ed">แก้ไข</button><button class="btn link cd-rg">รหัสใหม่</button>' + (c.hasAttempts ? '' : '<button class="btn link danger-t cd-del">ลบ</button>')) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
    $('#tab').innerHTML = h + '</div><div id="printArea"></div>';
    var find = function (no) { return list.filter(function (c) { return c.examNo === no; })[0]; };
    $('#cdShow').onclick = function () { AD.showCodes = !AD.showCodes; draw(); };
    $('#cdPrint').onclick = function () { printSlips(r); };
    $('#cdCheck').onclick = function () { printSignSheet(r); };
    if ($('#cdImp')) $('#cdImp').onclick = importBox;
    if ($('#cdAdd')) $('#cdAdd').onclick = function () { editBox(null); };
    if ($('#cdRegen')) $('#cdRegen').onclick = function () { askPass('ออกรหัสเข้าสอบใหม่ทั้งรอบ', '<div class="note bad">รหัสเดิมของทุกคนจะใช้ไม่ได้ ต้องพิมพ์ใบรหัสใหม่ทั้งหมด และผู้ที่เข้าระบบอยู่จะถูกออกจากระบบ</div>', 'ออกรหัสใหม่').then(function (x) { if (x) api('regenCodes', { examId: BD.id, password: x.password }).then(function (q) { toast('ออกรหัสใหม่ ' + q.n + ' คน', 'ok'); load(); }).catch(function (e) { toast(e.message, 'bad'); }); }); };
    $$('tr[data-no]').forEach(function (tr) {
      var c = find(tr.dataset.no), st = $('.cd-st', tr);
      st.onchange = function () { api('saveCandidate', { examId: BD.id, examNo: c.examNo, name: c.name, status: st.value, note: c.note }).then(function () { toast('เปลี่ยนสถานะเป็น "' + CS_TH[st.value] + '" แล้ว', 'ok'); BD.at = 0; load(); }).catch(function (e) { st.value = c.status; toast(e.message, 'bad'); }); };
      if ($('.cd-ed', tr)) $('.cd-ed', tr).onclick = function () { editBox(c); };
      if ($('.cd-rg', tr)) $('.cd-rg', tr).onclick = function () { askPass('ออกรหัสใหม่ของเลขประจำตัวสอบ ' + no3(c.examNo), '<p>รหัสเดิมจะใช้ไม่ได้ทันที ใช้เมื่อผู้เข้าสอบทำใบรหัสหายหรือสงสัยว่ารหัสรั่วไหล</p>', 'ออกรหัสใหม่').then(function (x) { if (x) api('regenCodes', { examId: BD.id, examNo: c.examNo, password: x.password }).then(function () { AD.showCodes = true; toast('ออกรหัสใหม่แล้ว', 'ok'); load(); }).catch(function (e) { toast(e.message, 'bad'); }); }); };
      if ($('.cd-del', tr)) $('.cd-del', tr).onclick = function () { confirmBox('ลบผู้เข้าสอบ', '<p>ลบเลขประจำตัวสอบ ' + esc(no3(c.examNo)) + ' ' + esc(c.name) + ' ออกจากรอบนี้</p>', 'ลบ', true).then(function (y) { if (y) api('deleteCandidate', { examId: BD.id, examNo: c.examNo }).then(function () { toast('ลบแล้ว', 'ok'); BD.at = 0; load(); }).catch(function (e) { toast(e.message, 'bad'); }); }); };
    });
  }
  function editBox(c) {
    var b = modal('<h2>' + (c ? 'แก้ไขผู้เข้าสอบ' : 'เพิ่มผู้เข้าสอบ') + '</h2><form class="form" id="ceF"><label>เลขประจำตัวสอบ<input id="ceNo" maxlength="12" required value="' + esc(c ? c.examNo : '') + '"' + (c ? ' disabled' : ' autofocus') + '></label><label>ชื่อ-สกุล<input id="ceN" maxlength="160" required value="' + esc(c ? c.name : '') + '"></label>' +
      '<label>สถานะ<select id="ceS">' + Object.keys(CS_TH).map(function (k) { return '<option value="' + k + '"' + (c && c.status === k ? ' selected' : '') + '>' + CS_TH[k] + '</option>'; }).join('') + '</select></label><label>หมายเหตุ<input id="ceT" maxlength="300" value="' + esc(c ? c.note : '') + '"></label><div class="modal-act"><button type="button" class="btn ghost-dark" id="ceX">ยกเลิก</button><button class="btn primary">บันทึก</button></div></form>', { cls: 'sm' });
    $('#ceX', b).onclick = closeModal;
    $('#ceF', b).onsubmit = function (e) { e.preventDefault(); api('saveCandidate', { examId: BD.id, examNo: c ? c.examNo : val('ceNo', b), name: val('ceN', b), status: val('ceS', b), note: val('ceT', b) }).then(function () { closeModal(); toast('บันทึกแล้ว', 'ok'); BD.at = 0; load(); }).catch(function (er) { toast(er.message, 'bad'); }); };
  }
  function parseList(txt) {
    return txt.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(String).map(function (l) {
      var p = l.split(/\t|,|\s{2,}/).map(function (x) { return x.trim(); }).filter(String), m;
      if (p.length < 2 && (m = l.match(/^(\S+)\s+(.+)$/))) p = [m[1], m[2]];
      var name = p.slice(1).join(' '), st = 'ACTIVE';
      if (/สละสิทธิ์/.test(name)) { st = 'WITHDRAWN'; name = name.replace(/\s*สละสิทธิ์\s*/g, ' ').trim(); }
      if (/ขาดสอบ/.test(name)) { st = 'ABSENT'; name = name.replace(/\s*ขาดสอบ\s*/g, ' ').trim(); }
      return { examNo: p[0] || '', name: name.replace(/\s+/g, ' '), status: st, bad: !p[0] || !name || !/^[0-9A-Za-z-]{1,12}$/.test(p[0]) };
    });
  }
  function importBox() {
    var b = modal('<h2>นำเข้ารายชื่อผู้เข้าสอบ</h2><p class="muted">คัดลอก 2 คอลัมน์จาก Excel (เลขประจำตัวสอบ และชื่อ-สกุล) แล้ววางในช่องด้านล่าง บรรทัดละ 1 คน · ถ้าชื่อมีคำว่า "สละสิทธิ์" ระบบจะตั้งสถานะสละสิทธิ์ให้ · เลขที่มีอยู่แล้วจะคงรหัสเข้าสอบเดิม</p>' +
      '<textarea id="imT" rows="9" placeholder="1&#9;นางสาว ตัวอย่าง ใจดี&#10;2&#9;นาย สมมติ รักเรียน สละสิทธิ์" autofocus></textarea><div id="imP" class="imprev"></div><div class="modal-act"><button class="btn ghost-dark" id="imX">ยกเลิก</button><button class="btn primary" id="imS" disabled>นำเข้า</button></div>', { cls: 'lg' });
    var rows = [];
    $('#imX', b).onclick = closeModal;
    $('#imT', b).oninput = function () {
      rows = parseList(this.value); var bad = rows.filter(function (x) { return x.bad; }).length, dup = {}, d2 = 0; rows.forEach(function (x) { var k = String(Number(x.examNo)) === 'NaN' ? x.examNo : String(Number(x.examNo)); if (dup[k]) { x.bad = true; d2++; } dup[k] = 1; });
      $('#imP', b).innerHTML = rows.length ? '<p class="' + (bad + d2 ? 'bad-t' : 'ok-t') + '">อ่านได้ ' + rows.length + ' คน' + (bad ? ' · รูปแบบไม่ถูก ' + bad + ' บรรทัด' : '') + (d2 ? ' · เลขซ้ำ ' + d2 + ' บรรทัด' : '') + ' · มีสิทธิ์สอบ ' + rows.filter(function (x) { return x.status === 'ACTIVE'; }).length + ' คน</p><div class="tblwrap sm"><table class="tbl"><tbody>' +
        rows.map(function (x) { return '<tr class="' + (x.bad ? 'badrow' : '') + '"><td><b>' + esc(x.examNo) + '</b></td><td>' + esc(x.name) + '</td><td>' + CS_TH[x.status] + '</td></tr>'; }).join('') + '</tbody></table></div>' : '';
      $('#imS', b).disabled = !rows.length || bad + d2 > 0;
    };
    $('#imS', b).onclick = function () { var bt = this; busy(bt, true, 'กำลังนำเข้า…'); api('importCandidates', { examId: BD.id, rows: rows }).then(function (r) { closeModal(); toast('เพิ่ม ' + r.added + ' คน · แก้ไข ' + r.updated + ' คน', 'ok'); BD.at = 0; TG.home = null; load(); }).catch(function (e) { busy(bt, false); toast(e.message, 'bad'); }); };
  }
  if (AD.cands && AD.cands.exam.examId === BD.id) draw(); else $('#tab').innerHTML = '<div class="boot"><div class="boot-ring"></div></div>';
  load();
}
function printDoc(html) { var p = $('#printArea'); p.innerHTML = html; document.body.classList.add('printing'); setTimeout(function () { window.print(); setTimeout(function () { document.body.classList.remove('printing'); p.innerHTML = ''; }, 500); }, 80); }
function printSlips(r) {
  var url = location.origin + location.pathname, list = r.candidates.filter(function (c) { return c.status === 'ACTIVE'; });
  if (!list.length) return toast('ไม่มีผู้มีสิทธิ์สอบ', 'bad');
  printDoc('<div class="slips">' + list.map(function (c) {
    return '<div class="slip"><div class="slip-h"><b>SOMDEJ TalentGate</b><span>ใบรหัสเข้าสอบ</span></div><p class="slip-e">' + esc(r.exam.title) + '</p><p class="slip-d">' + esc(r.exam.examDate) + (r.exam.place ? ' · ' + esc(r.exam.place) : '') + '</p>' +
      '<div class="slip-r"><div><small>เลขประจำตัวสอบ</small><b>' + esc(no3(c.examNo)) + '</b></div><div><small>รหัสเข้าสอบ</small><b class="mono">' + esc(c.code.replace(/(\d{3})(\d{3})/, '$1 $2')) + '</b></div></div><p class="slip-n">' + esc(c.name) + '</p>' +
      '<p class="slip-u">เข้าสอบที่ <b>' + esc(url.replace(/^https?:\/\//, '')) + '</b> › ผู้เข้าสอบ</p><p class="slip-w">ห้ามเปิดเผยรหัสนี้แก่ผู้อื่น · รหัสใช้ได้เฉพาะในวันสอบ · โปรดคืนใบนี้แก่กรรมการเมื่อสอบเสร็จ</p></div>';
  }).join('') + '</div>');
}
function printSignSheet(r) {
  var list = r.candidates.filter(function (c) { return c.status === 'ACTIVE'; });
  printDoc('<div class="sheet"><h2>ใบลงชื่อผู้เข้าสอบ</h2><p>' + esc(r.exam.title) + '<br>' + esc(r.exam.examDate) + (r.exam.place ? ' · ' + esc(r.exam.place) : '') + '</p><table><thead><tr><th>เลขประจำตัวสอบ</th><th>ชื่อ-สกุล</th><th>ลงชื่อเข้าสอบ</th><th>รับใบรหัส</th><th>หมายเหตุ</th></tr></thead><tbody>' +
    list.map(function (c) { return '<tr><td class="c">' + esc(no3(c.examNo)) + '</td><td>' + esc(c.name) + '</td><td></td><td></td><td></td></tr>'; }).join('') + '</tbody></table><p class="sign">ลงชื่อ ............................................................ กรรมการคุมสอบ</p></div>');
}

/* ====================== คลังข้อสอบ ====================== */
function viewBank(setId) {
  var d = AD.data; if (setId) AD.setId = setId;
  if (!AD.setId || !d.sets.some(function (s) { return s.setId === AD.setId; })) AD.setId = d.sets.length ? d.sets[0].setId : null;
  function side() {
    function grp(kind, label) { var l = AD.data.sets.filter(function (s) { return s.kind === kind; }); return '<div class="bk-g"><small>' + label + '</small>' + (l.length ? l.map(function (s) { return '<a class="bk-s' + (s.setId === AD.setId ? ' on' : '') + (s.active ? '' : ' off') + '" href="#/admin/bank/' + encodeURIComponent(s.setId) + '"><b>' + esc(s.name) + '</b><i>' + QT_TH[s.qtype].split(' ')[0] + ' · ' + s.n + ' ข้อ' + (s.active ? '' : ' · ปิดใช้งาน') + '</i></a>'; }).join('') : '<p class="muted sm">ยังไม่มี</p>') + '</div>'; }
    return grp('CENTRAL', 'ชุดกลาง — ใช้ได้กับทุกตำแหน่ง') + grp('POSITION', 'ชุดเฉพาะตำแหน่ง');
  }
  $('#app').innerHTML = '<div class="wrap"><div class="phead"><div><span class="eyebrow">ผู้ดูแลระบบ</span><h1>คลังข้อสอบ</h1><p class="muted">จัดข้อสอบเป็นชุด แล้วเลือกชุดไปใช้ในแต่ละรอบสอบที่หน้า "ตั้งค่ารอบสอบ" · ชุดกลางใช้ซ้ำได้ทุกตำแหน่ง</p></div><div class="acts"><a class="btn ghost-dark" href="TalentGate_Import_Template.xlsx" download>' + ICON.down + 'แม่แบบนำเข้า (Excel)</a><button class="btn ghost-dark" id="bkImp">' + ICON.up + 'นำเข้าข้อสอบทั้งชุด</button><button class="btn primary" id="bkNew">' + ICON.plus + 'สร้างชุดข้อสอบ</button></div></div>' +
    '<div class="bank"><aside class="card bk-side">' + side() + '</aside><div id="bkMain"></div></div><div id="printArea"></div></div>';
  $('#bkNew').onclick = function () { setBox(null); };
  $('#bkImp').onclick = function () { importQBox(null, function (r) { AD.setId = r.setId; AD.at = 0; AD.qs = null; if ($('#bkMain')) $('#bkMain').innerHTML = '<div class="boot"><div class="boot-ring"></div></div>'; go('#/admin/bank/' + encodeURIComponent(r.setId)); }); };
  function setBox(s) {
    var b = modal('<h2>' + (s ? 'แก้ไขชุดข้อสอบ' : 'สร้างชุดข้อสอบ') + '</h2><form class="form" id="sbF"><label>ชื่อชุด<input id="sbN" maxlength="160" required value="' + esc(s ? s.name : '') + '" placeholder="เช่น ตำแหน่งนักวิชาการเงินและบัญชี · ความรู้เฉพาะ" autofocus></label>' +
      '<div class="row2"><label>ประเภทชุด<select id="sbK"><option value="CENTRAL"' + (s && s.kind === 'CENTRAL' ? ' selected' : '') + '>ชุดกลาง (ทุกตำแหน่ง)</option><option value="POSITION"' + (s && s.kind === 'POSITION' ? ' selected' : '') + '>ชุดเฉพาะตำแหน่ง</option></select></label>' +
      '<label>ชนิดข้อสอบ<select id="sbQ"' + (s ? ' disabled' : '') + '>' + Object.keys(QT_TH).map(function (k) { return '<option value="' + k + '"' + (s && s.qtype === k ? ' selected' : '') + '>' + QT_TH[k] + '</option>'; }).join('') + '</select></label></div><label>หมายเหตุ<input id="sbT" maxlength="300" value="' + esc(s ? s.note : '') + '"></label>' +
      (s ? '<label class="chk"><input type="checkbox" id="sbA"' + (s.active ? ' checked' : '') + '> เปิดใช้งาน (ให้เลือกในรอบสอบใหม่ได้)</label>' : '') + '<div class="modal-act"><button type="button" class="btn ghost-dark" id="sbX">ยกเลิก</button><button class="btn primary">บันทึก</button></div></form>', { cls: 'sm' });
    $('#sbX', b).onclick = closeModal;
    $('#sbF', b).onsubmit = function (e) { e.preventDefault(); api('saveSet', { setId: s ? s.setId : '', name: val('sbN', b), kind: val('sbK', b), qtype: val('sbQ', b), note: val('sbT', b), active: s ? $('#sbA', b).checked : true }).then(function (r) { closeModal(); toast('บันทึกชุดข้อสอบแล้ว', 'ok'); AD.setId = r.setId; if ($('#bkMain')) $('#bkMain').innerHTML = '<div class="boot"><div class="boot-ring"></div></div>'; return loadAdmin(true); }).then(function () { if (TG.view === 'admin' && $('.bank')) viewBank(); }).catch(function (er) { toast(er.message, 'bad'); }); };
  }
  function main() {
    var r = AD.qs, s = r.set, qs = r.questions, pts = qs.filter(function (q) { return q.active; }).reduce(function (a, q) { return a + q.points; }, 0), nOn = qs.filter(function (q) { return q.active; }).length;
    var h = '<div class="card"><div class="card-head"><div><span class="tag ' + (s.kind === 'CENTRAL' ? 'info' : '') + '">' + (s.kind === 'CENTRAL' ? 'ชุดกลาง' : 'ชุดเฉพาะตำแหน่ง') + '</span> <span class="tag">' + QT_TH[s.qtype] + '</span>' + (s.inUse ? ' <span class="tag warn">ใช้ในรอบที่มีผู้สอบแล้ว</span>' : '') + '<h2 class="card-t mt6">' + esc(s.name) + '</h2><p class="card-s" id="bkSum">เลือกใช้ <b>' + nOn + '</b> จาก ' + qs.length + ' ข้อ' + (pts ? ' · ' + pts + ' คะแนน' : '') + (s.note ? ' · ' + esc(s.note) : '') + '</p></div><div class="acts">' +
      '<button class="btn ghost-dark sm" id="bkEd">' + ICON.edit + 'แก้ไขชุด</button><button class="btn ghost-dark sm" id="bkIm2">' + ICON.up + 'นำเข้าเพิ่มในชุดนี้</button><button class="btn ghost-dark sm" id="bkEx">' + ICON.down + 'ส่งออก (CSV)</button><button class="btn ghost-dark sm" id="bkPr">' + ICON.print + 'พิมพ์พร้อมเฉลย</button><button class="btn primary sm" id="bkAdd">' + ICON.plus + 'เพิ่มข้อ</button></div></div>' +
      (qs.length ? '<div class="selbar"><span class="muted sm">สวิตช์หน้าข้อ = เลือกใช้ข้อนั้นในรอบสอบที่ติ๊กชุดนี้ (ข้อที่ปิดจะไม่ออกสอบและไม่นับคะแนน)</span><span class="acts"><button class="btn link" id="bkAll">เลือกทั้งหมด</button><button class="btn link" id="bkNone">ไม่เลือกทั้งหมด</button></span></div>' : '') +
      (s.inUse ? '<div class="note warn">ชุดนี้ถูกใช้ในรอบสอบที่มีผู้เข้าสอบทำแล้ว การแก้เฉลยจะมีผลต่อคะแนนเมื่อกด "คำนวณคะแนนปรนัยใหม่" ในหน้าสรุปผลของรอบนั้น</div>' : '') + '</div>';
    if (!qs.length) h += '<div class="card empty"><h3>ชุดนี้ยังไม่มีข้อสอบ</h3><p class="muted">กด "เพิ่มข้อ" เพื่อเริ่มต้น</p></div>';
    qs.forEach(function (q, i) {
      var body = '';
      if (q.type === 'MCQ') body = '<ol class="bq-c">' + q.choices.map(function (c, j) { return '<li class="' + (String(j + 1) === q.answer ? 'key' : '') + '"><i>' + TH[j] + '</i>' + esc(c) + '</li>'; }).join('') + '</ol>' + (q.rubric ? '<p class="bq-x"><b>คำอธิบาย:</b> ' + esc(q.rubric) + '</p>' : '');
      else if (q.type === 'SJT') { var lv = q.answer.split(','); body = '<ol class="bq-c">' + q.choices.map(function (c, j) { return '<li><i>' + TH[j] + '</i>' + esc(c) + '<span class="lvb lv' + lv[j] + '">ระดับ ' + lv[j] + '</span></li>'; }).join('') + '</ol>'; }
      else if (q.type === 'MBTI') body = '<ol class="bq-c">' + q.choices.map(function (c) { var p = c.split('|'); return '<li><i>' + esc(p[0]) + '</i>' + esc(p.slice(1).join('|')) + '</li>'; }).join('') + '</ol>';
      else body = '<div class="bq-r"><b>เกณฑ์ให้คะแนน</b><br>' + nl2br(q.rubric) + '</div>';
      h += '<article class="card bq' + (q.active ? '' : ' off') + '" data-q="' + esc(q.qId) + '"><header><label class="sw sm" title="เลือกใช้ข้อนี้"><input type="checkbox" class="bq-on"' + (q.active ? ' checked' : '') + '><i></i></label><span class="qn">ข้อ ' + (i + 1) + '</span>' + (q.cat ? '<span class="tag">' + esc(q.cat) + '</span>' : '') + (q.points ? '<span class="qp">' + q.points + ' คะแนน</span>' : '') + '<span class="tag bad bq-offtag"' + (q.active ? ' hidden' : '') + '>ไม่ใช้ข้อนี้</span><span class="bq-id">' + esc(q.qId) + '</span>' +
        '<button class="btn link bq-ed">' + ICON.edit + 'แก้ไข</button><button class="btn link danger-t bq-del">ลบ</button></header><div class="qt">' + nl2br(q.text) + '</div>' + body + '<p class="bq-ref"><b>ที่มา:</b> ' + (q.ref ? esc(q.ref) : '<span class="bad-t">ยังไม่ได้ระบุ</span>') + '</p></article>';
    });
    $('#bkMain').innerHTML = h + '<div class="savebar float" id="bkSave" hidden><span id="bkChg"></span><button class="btn ghost-dark sm" id="bkUndo">ยกเลิก</button><button class="btn primary" id="bkDo">บันทึกการเลือกข้อสอบ</button></div>';
    function pending() { var ch = {}; $$('.bq').forEach(function (card) { var q = qs.filter(function (x) { return x.qId === card.dataset.q; })[0], on = $('.bq-on', card).checked; card.classList.toggle('off', !on); $('.bq-offtag', card).hidden = on; if (on !== q.active) ch[q.qId] = on; }); return ch; }
    function selPaint() {
      var ch = pending(), n = Object.keys(ch).length, on = $$('.bq-on').filter(function (x) { return x.checked; }).length, p2 = 0;
      $$('.bq').forEach(function (card) { if ($('.bq-on', card).checked) p2 += qs.filter(function (x) { return x.qId === card.dataset.q; })[0].points; });
      $('#bkSum').innerHTML = 'เลือกใช้ <b>' + on + '</b> จาก ' + qs.length + ' ข้อ' + (p2 ? ' · ' + p2 + ' คะแนน' : '') + (s.note ? ' · ' + esc(s.note) : '');
      $('#bkSave').hidden = !n; $('#bkChg').textContent = 'เปลี่ยนการเลือก ' + n + ' ข้อ — ยังไม่ได้บันทึก';
    }
    $$('.bq-on').forEach(function (x) { x.onchange = selPaint; });
    if ($('#bkAll')) $('#bkAll').onclick = function () { $$('.bq-on').forEach(function (x) { x.checked = true; }); selPaint(); };
    if ($('#bkNone')) $('#bkNone').onclick = function () { $$('.bq-on').forEach(function (x) { x.checked = false; }); selPaint(); };
    $('#bkUndo').onclick = function () { main(); };
    $('#bkDo').onclick = function () { var b = this; busy(b, true, 'กำลังบันทึก…'); api('setQuestionsActive', { setId: s.setId, active: pending() }).then(function (x) { toast('บันทึกการเลือกแล้ว ' + x.n + ' ข้อ', 'ok'); AD.at = 0; BD.at = 0; loadQs(); loadAdmin(true).then(function () { if ($('.bk-side')) $('.bk-side').innerHTML = side(); }); }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); }); };
    $('#bkIm2').onclick = function () { importQBox(s, function () { AD.at = 0; loadQs(); loadAdmin(true).then(function () { if ($('.bk-side')) $('.bk-side').innerHTML = side(); }); }); };
    $('#bkEx').onclick = function () { saveCsv('TalentGate_Bank_' + s.setId + '.csv', [IMP_HEAD].concat(qs.map(qToRow))); toast('ส่งออกแล้ว — เปิดด้วย Excel แก้ไข แล้วนำเข้ากลับได้ด้วยแม่แบบเดียวกัน', 'ok', 6000); };
    $('#bkEd').onclick = function () { setBox(s); };
    $('#bkAdd').onclick = function () { qBox(null, s); };
    $('#bkPr').onclick = function () {
      printDoc('<div class="sheet"><h2>' + esc(s.name) + '</h2><p>เอกสารลับ — ข้อสอบพร้อมเฉลยและที่มา · พิมพ์จาก SOMDEJ TalentGate เมื่อ ' + tDate(now()) + '</p>' + qs.filter(function (q) { return q.active; }).map(function (q, i) {
        var lv = q.type === 'SJT' ? q.answer.split(',') : [];
        return '<div class="pq"><p><b>' + (i + 1) + '.</b> ' + nl2br(q.text) + (q.points ? ' <i>(' + q.points + ' คะแนน)</i>' : '') + '</p>' + (q.choices.length ? '<ol>' + q.choices.map(function (c, j) { return '<li>' + (q.type === 'MBTI' ? esc(c.replace('|', ') ')).replace(/^/, '(') : TH[j] + '. ' + esc(c)) + (String(j + 1) === q.answer && q.type === 'MCQ' ? ' <b>✓ เฉลย</b>' : '') + (lv[j] ? ' <i>[ระดับ ' + lv[j] + ']</i>' : '') + '</li>'; }).join('') + '</ol>' : '') + (q.rubric ? '<p class="pr">' + nl2br(q.rubric) + '</p>' : '') + '<p class="pref">ที่มา: ' + esc(q.ref || '-') + '</p></div>';
      }).join('') + '</div>');
    };
    $$('.bq').forEach(function (card) {
      var q = qs.filter(function (x) { return x.qId === card.dataset.q; })[0];
      $('.bq-ed', card).onclick = function () { qBox(q, s); };
      $('.bq-del', card).onclick = function () { confirmBox('ลบข้อสอบ', '<p>ลบ ' + esc(q.qId) + ' ออกจากคลังถาวร</p>', 'ลบ', true).then(function (y) { if (y) api('deleteQuestion', { qId: q.qId }).then(function () { toast('ลบแล้ว', 'ok'); AD.at = 0; loadQs(); loadAdmin(true); }).catch(function (e) { toast(e.message, 'bad'); }); }); };
    });
  }
  function qBox(q, s) {
    var t = q ? q.type : s.qtype, ch = q ? q.choices : [], lv = q && t === 'SJT' ? q.answer.split(',') : ['', '', '', ''], body = '';
    if (t === 'MCQ') body = '<div class="se-l">ตัวเลือก (เลือกวงกลมหน้าข้อที่เป็นเฉลย)</div>' + [0, 1, 2, 3].map(function (j) { return '<div class="qc-row"><input type="radio" name="qbA" value="' + (j + 1) + '"' + (q && q.answer === String(j + 1) ? ' checked' : '') + ' required><i>' + TH[j] + '</i><textarea class="qb-c" rows="1" maxlength="1000" required>' + esc(ch[j] || '') + '</textarea></div>'; }).join('');
    if (t === 'SJT') body = '<div class="se-l">ตัวเลือก และระดับความเหมาะสม (4 = เหมาะสมที่สุด · 1 = ควรซักถามเพิ่ม)</div>' + [0, 1, 2, 3].map(function (j) { return '<div class="qc-row"><i>' + TH[j] + '</i><textarea class="qb-c" rows="2" maxlength="1000" required>' + esc(ch[j] || '') + '</textarea><select class="qb-l" required><option value="">ระดับ</option>' + [4, 3, 2, 1].map(function (n) { return '<option' + (String(n) === String(lv[j]) ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>'; }).join('');
    if (t === 'MBTI') body = '<div class="se-l">ตัวเลือก 2 ข้อ (อักษรบุคลิกภาพ + ข้อความ)</div>' + [0, 1].map(function (j) { var p = (ch[j] || '|').split('|'); return '<div class="qc-row"><input class="qb-k" maxlength="1" size="2" required value="' + esc(p[0]) + '" placeholder="I"><textarea class="qb-c" rows="2" maxlength="900" required>' + esc(p.slice(1).join('|')) + '</textarea></div>'; }).join('');
    var b = modal('<h2>' + (q ? 'แก้ไขข้อสอบ ' + esc(q.qId) : 'เพิ่มข้อสอบ') + ' <small class="muted">' + QT_TH[t] + '</small></h2><form class="form" id="qbF"><div class="row2"><label>' + (t === 'SJT' ? 'มิติที่วัด' : 'หมวด/หัวข้อ') + '<input id="qbCat" maxlength="120" value="' + esc(q ? q.cat : '') + '"' + (t === 'SJT' ? ' required' : '') + ' list="qbCats"><datalist id="qbCats">' + uniq(AD.qs.questions.map(function (x) { return x.cat; })).map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></label>' +
      (t === 'MCQ' || t === 'ESSAY' ? '<label>คะแนน<input id="qbP" type="number" min="0.5" max="100" step="0.5" value="' + (q ? q.points : (t === 'ESSAY' ? 5 : 1)) + '" required></label>' : '<label>ลำดับในชุด<input id="qbO" type="number" min="1" value="' + (q ? q.order : AD.qs.questions.length + 1) + '"></label>') + '</div>' +
      '<label>โจทย์<textarea id="qbT" rows="' + (t === 'ESSAY' ? 6 : 3) + '" maxlength="6000" required>' + esc(q ? q.text : '') + '</textarea></label>' + body +
      (t === 'MCQ' || t === 'ESSAY' ? '<label>' + (t === 'ESSAY' ? 'เกณฑ์ให้คะแนน / แนวคำตอบ (กรรมการเห็นขณะตรวจ)' : 'คำอธิบายเฉลย (ไม่บังคับ)') + '<textarea id="qbR" rows="' + (t === 'ESSAY' ? 6 : 2) + '" maxlength="6000"' + (t === 'ESSAY' ? ' required' : '') + '>' + esc(q ? q.rubric : '') + '</textarea></label>' : '') +
      '<label>ที่มา / แหล่งอ้างอิง<textarea id="qbRef" rows="2" maxlength="1000" required placeholder="เช่น ระเบียบสำนักนายกฯ ว่าด้วยงานสารบรรณ ข้อ 28 · ถ้าแต่งเองให้ระบุ “ผู้ออกข้อสอบแต่งขึ้นใหม่”">' + esc(q ? q.ref : '') + '</textarea></label>' +
      (q ? '<label class="chk"><input type="checkbox" id="qbA"' + (q.active ? ' checked' : '') + '> ใช้งานข้อนี้</label>' : '') + '<div class="modal-act"><button type="button" class="btn ghost-dark" id="qbX">ยกเลิก</button><button class="btn primary" id="qbS">บันทึกข้อสอบ</button></div></form>', { cls: 'lg' });
    $('#qbX', b).onclick = closeModal;
    $('#qbF', b).onsubmit = function (e) {
      e.preventDefault();
      var choices = $$('.qb-c', b).map(function (x) { return x.value.trim(); }), ans = '';
      if (t === 'MCQ') ans = ($('[name=qbA]:checked', b) || {}).value || '';
      if (t === 'SJT') ans = $$('.qb-l', b).map(function (x) { return x.value; }).join(',');
      if (t === 'MBTI') choices = choices.map(function (c, j) { return $$('.qb-k', b)[j].value.trim().toUpperCase() + '|' + c; });
      busy($('#qbS', b), true);
      api('saveQuestion', { qId: q ? q.qId : '', setId: s.setId, type: t, cat: val('qbCat', b), text: val('qbT', b), choices: choices, answer: ans, points: $('#qbP', b) ? Number(val('qbP', b)) : 0, order: $('#qbO', b) ? Number(val('qbO', b)) : (q ? q.order : 0), rubric: val('qbR', b), ref: val('qbRef', b), active: q ? $('#qbA', b).checked : true })
        .then(function () { closeModal(); toast('บันทึกข้อสอบแล้ว', 'ok'); loadQs(); loadAdmin(true).then(function () { if ($('.bk-side')) $('.bk-side').innerHTML = side(); }); }).catch(function (er) { busy($('#qbS', b), false); toast(er.message, 'bad'); });
    };
  }
  function loadQs() { if (!$('#bkMain')) return; if (!AD.setId) { $('#bkMain').innerHTML = '<div class="card empty"><h3>ยังไม่มีชุดข้อสอบ</h3></div>'; return; } $('#bkMain').innerHTML = '<div class="boot"><div class="boot-ring"></div></div>'; api('getQuestions', { setId: AD.setId }).then(function (r) { AD.qs = r; if (TG.view === 'admin' && $('#bkMain')) main(); }).catch(function (e) { toast(e.message, 'bad'); }); }
  loadQs();
}
function uniq(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); }

/* ====================== นำเข้า/ส่งออกข้อสอบทั้งชุด (แม่แบบ Excel · CSV · วางจากตาราง) ====================== */
var IMP_HEAD = ['ประเภท', 'หมวด', 'โจทย์', 'ตัวเลือก ก', 'ตัวเลือก ข', 'ตัวเลือก ค', 'ตัวเลือก ง', 'เฉลย', 'คะแนน', 'คำอธิบายเฉลย / เกณฑ์ให้คะแนน', 'ที่มา', 'ใช้งาน'];
var IMP_TYPE = { MCQ: 'ปรนัย', ESSAY: 'ข้อเขียน', SJT: 'สถานการณ์', MBTI: 'บุคลิกภาพ' };
function qToRow(q) {
  var c = q.choices || [], ans = q.type === 'MCQ' ? (TH[Number(q.answer) - 1] || '') : q.answer;
  return [IMP_TYPE[q.type], q.cat, q.text, c[0] || '', c[1] || '', c[2] || '', c[3] || '', ans, q.type === 'MCQ' || q.type === 'ESSAY' ? q.points : '', q.rubric, q.ref, q.active ? 1 : 0];
}
/** แยกข้อความแบบตาราง (คั่นด้วยแท็บหรือจุลภาค รองรับเซลล์ที่มีเครื่องหมายคำพูดและขึ้นบรรทัดใหม่) → [[เซลล์]] */
function parseDelimited(txt, sep) {
  txt = String(txt || '').replace(/^﻿/, '');
  if (!sep) sep = txt.indexOf('\t') >= 0 ? '\t' : ',';
  var rows = [], row = [], cell = '', q = false, i = 0, n = txt.length, ch;
  while (i < n) {
    ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"' && cell === '') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; row.push(cell); cell = ''; rows.push(row); row = []; }
    else cell += ch;
    i++;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
}
/** อ่านไฟล์ .xlsx ในเบราว์เซอร์โดยไม่ใช้ไลบรารีภายนอก (แตก zip ด้วย DecompressionStream) → [[เซลล์]] ของชีต "ข้อสอบ" หรือชีตแรก */
function readXlsx(file) {
  if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('เบราว์เซอร์นี้อ่านไฟล์ Excel โดยตรงไม่ได้ — ให้เปิดไฟล์ใน Excel คัดลอกตารางแล้ววางในช่องด้านล่างแทน'));
  return file.arrayBuffer().then(function (buf) {
    var dv = new DataView(buf), i = buf.byteLength - 22, files = {}, dec = new TextDecoder();
    while (i >= 0 && dv.getUint32(i, true) !== 0x06054b50) i--;
    if (i < 0) throw new Error('ไฟล์นี้ไม่ใช่ไฟล์ Excel (.xlsx)');
    var cnt = dv.getUint16(i + 10, true), off = dv.getUint32(i + 16, true);
    for (var k = 0; k < cnt; k++) {
      var nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true);
      files[dec.decode(new Uint8Array(buf, off + 46, nl))] = { method: dv.getUint16(off + 10, true), csize: dv.getUint32(off + 20, true), lho: dv.getUint32(off + 42, true) };
      off += 46 + nl + el + cl;
    }
    function text(name) {
      var f = files[name]; if (!f) return Promise.resolve('');
      var start = f.lho + 30 + dv.getUint16(f.lho + 26, true) + dv.getUint16(f.lho + 28, true), data = new Uint8Array(buf, start, f.csize);
      if (f.method === 0) return Promise.resolve(dec.decode(data));
      return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    }
    var xml = function (t) { return new DOMParser().parseFromString(t, 'application/xml'); };
    var tags = function (el, name) { return Array.prototype.slice.call(el.getElementsByTagName(name)); };
    return Promise.all([text('xl/workbook.xml'), text('xl/_rels/workbook.xml.rels'), text('xl/sharedStrings.xml')]).then(function (a) {
      if (!a[0]) throw new Error('ไฟล์นี้ไม่ใช่ไฟล์ Excel (.xlsx)');
      var sheets = tags(xml(a[0]), 'sheet').map(function (x) { return { name: x.getAttribute('name'), rid: x.getAttribute('r:id') }; }), rel = {};
      tags(xml(a[1]), 'Relationship').forEach(function (x) { rel[x.getAttribute('Id')] = x.getAttribute('Target'); });
      var pick = sheets.filter(function (x) { return x.name === 'ข้อสอบ'; })[0] || sheets[0], tgt = rel[pick.rid] || 'worksheets/sheet1.xml';
      tgt = tgt.charAt(0) === '/' ? tgt.slice(1) : 'xl/' + tgt.replace(/^\.\//, '');
      var sst = a[2] ? tags(xml(a[2]), 'si').map(function (si) { return tags(si, 't').filter(function (t) { return t.parentNode.nodeName !== 'rPh'; }).map(function (t) { return t.textContent; }).join(''); }) : [];
      return text(tgt).then(function (st) {
        if (!st) throw new Error('อ่านชีตในไฟล์ไม่ได้');
        var rows = [];
        tags(xml(st), 'row').forEach(function (r) {
          var out = [];
          tags(r, 'c').forEach(function (c) {
            var ref = c.getAttribute('r') || '', col = 0, m = ref.match(/^[A-Z]+/);
            if (m) { for (var j = 0; j < m[0].length; j++) col = col * 26 + (m[0].charCodeAt(j) - 64); col--; } else col = out.length;
            var t = c.getAttribute('t'), v = tags(c, 'v')[0], val = '';
            if (t === 's') val = sst[Number(v ? v.textContent : -1)] || '';
            else if (t === 'inlineStr') val = tags(c, 't').map(function (x) { return x.textContent; }).join('');
            else val = v ? v.textContent : '';
            while (out.length < col) out.push('');
            out[col] = val;
          });
          rows.push(out);
        });
        return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
      });
    });
  });
}
/** แปลงตาราง → ข้อสอบ + ตรวจเบื้องต้น (หลังบ้านตรวจซ้ำอีกครั้ง) */
function rowsToQuestions(rows) {
  if (!rows.length) return [];
  var norm = function (x) { return String(x === undefined || x === null ? '' : x).replace(/\r\n?/g, '\n').trim(); };
  var hi = -1; for (var i = 0; i < Math.min(rows.length, 6); i++) if (rows[i].some(function (x) { return /^(โจทย์|คำถาม|question|text)$/i.test(norm(x)); })) { hi = i; break; }
  var map = { type: 0, cat: 1, text: 2, c1: 3, c2: 4, c3: 5, c4: 6, answer: 7, points: 8, rubric: 9, ref: 10, active: 11 };
  if (hi >= 0) {
    map = {};
    rows[hi].forEach(function (h, j) {
      h = norm(h).toLowerCase();
      var k = /^(ประเภท|ชนิด|type)/.test(h) ? 'type' : /^(หมวด|มิติ|หัวข้อ|cat)/.test(h) ? 'cat' : /^(โจทย์|คำถาม|question|text)/.test(h) ? 'text' : /^(ตัวเลือก\s*)?(ก|a|1)\.?$/.test(h) ? 'c1' : /^(ตัวเลือก\s*)?(ข|b|2)\.?$/.test(h) ? 'c2' : /^(ตัวเลือก\s*)?(ค|c|3)\.?$/.test(h) ? 'c3' : /^(ตัวเลือก\s*)?(ง|d|4)\.?$/.test(h) ? 'c4' :
        /^(เฉลย|คำตอบ|answer|ระดับ)/.test(h) ? 'answer' : /^(คะแนน|point|score)/.test(h) ? 'points' : /^(คำอธิบาย|เกณฑ์|แนว|rubric|explain)/.test(h) ? 'rubric' : /^(ที่มา|อ้างอิง|แหล่ง|ref|source)/.test(h) ? 'ref' : /^(ใช้งาน|ใช้|active)/.test(h) ? 'active' : null;
      if (k && map[k] === undefined) map[k] = j;
    });
    if (map.text === undefined) return [];
  }
  var g = function (r, k) { return map[k] === undefined ? '' : norm(r[map[k]]); };
  return rows.slice(hi + 1).map(function (r) {
    var t = g(r, 'type').toLowerCase(), ch = [g(r, 'c1'), g(r, 'c2'), g(r, 'c3'), g(r, 'c4')], ans = g(r, 'answer'), pts = g(r, 'points'), act = g(r, 'active').toLowerCase(), err = '';
    var type = /ปรนัย|mcq|เลือกตอบ/.test(t) ? 'MCQ' : /เขียน|อัตนัย|essay/.test(t) ? 'ESSAY' : /สถานการณ์|ทัศนคติ|sjt/.test(t) ? 'SJT' : /บุคลิก|mbti/.test(t) ? 'MBTI' : (ch[0] && ch[2] ? 'MCQ' : ch[0] ? 'MBTI' : 'ESSAY');
    var q = { type: type, cat: g(r, 'cat'), text: g(r, 'text'), choices: [], answer: '', points: 0, rubric: g(r, 'rubric'), ref: g(r, 'ref'), active: !/^(0|ไม่|no|n|false|ปิด)/.test(act) };
    if (!q.text) err = 'ไม่มีโจทย์';
    if (type === 'MCQ') {
      q.choices = ch; var a = ans.replace(/[.\s)]/g, '').toLowerCase(), ix = { 'ก': 1, 'ข': 2, 'ค': 3, 'ง': 4, a: 1, b: 2, c: 3, d: 4, '1': 1, '2': 2, '3': 3, '4': 4 }[a];
      q.answer = ix ? String(ix) : ''; q.points = pts === '' ? 1 : Number(pts);
      if (ch.some(function (x) { return !x; })) err = err || 'ตัวเลือกไม่ครบ 4 ข้อ';
      if (!ix) err = err || 'เฉลยต้องเป็น ก ข ค หรือ ง';
      if (!(q.points > 0)) err = err || 'คะแนนต้องมากกว่า 0';
    } else if (type === 'SJT') {
      q.choices = ch; q.answer = ans.replace(/[^1-4]/g, '').split('').join(',');
      if (ch.some(function (x) { return !x; })) err = err || 'ตัวเลือกไม่ครบ 4 ข้อ';
      if (q.answer.split(',').length !== 4) err = err || 'ช่องเฉลยต้องเป็นระดับ 1–4 ของตัวเลือก ก ข ค ง เช่น 4,2,1,3';
      if (!q.cat) err = err || 'ต้องระบุมิติที่วัดในช่องหมวด';
    } else if (type === 'MBTI') {
      q.choices = ch.slice(0, 2).map(function (x) { return x.replace(/^([A-Za-z])\s*[|:)\-]\s*/, function (m, l) { return l.toUpperCase() + '|'; }); });
      if (q.choices.some(function (x) { return !/^[A-Z]\|.+/.test(x); })) err = err || 'ตัวเลือก ก และ ข ต้องเป็นรูปแบบ "อักษร|ข้อความ" เช่น E|ชอบพบปะผู้คน';
    } else { q.points = pts === '' ? 5 : Number(pts); if (!(q.points > 0)) err = err || 'คะแนนต้องมากกว่า 0'; if (!q.rubric) err = err || 'ข้อเขียนต้องมีเกณฑ์ให้คะแนน'; }
    q.err = err; return q;
  }).filter(function (q) { return q.text || q.choices.some(String); });
}
function importQBox(set, done) {
  var d = AD.data, qs = [];
  var b = modal('<h2>นำเข้าข้อสอบ' + (set ? 'เพิ่มในชุด "' + esc(set.name) + '"' : 'ทั้งชุด') + '</h2>' +
    '<ol class="impsteps"><li><b>ดาวน์โหลดแม่แบบ</b> แล้วกรอกข้อสอบ 1 ข้อต่อ 1 แถว (ดูตัวอย่างในชีต "ตัวอย่างและคำอธิบาย") <a class="btn ghost-dark sm" href="TalentGate_Import_Template.xlsx" download>' + ICON.down + 'แม่แบบ Excel</a></li>' +
    '<li><b>เลือกไฟล์</b> .xlsx หรือ .csv <label class="btn primary sm">' + ICON.up + 'เลือกไฟล์<input type="file" id="iqF" accept=".xlsx,.csv,.tsv,.txt" hidden></label> <span class="muted sm">หรือคัดลอกตารางจาก Excel (รวมแถวหัวตาราง) มาวางที่ช่องนี้</span><textarea id="iqT" rows="3" placeholder="วางข้อมูลที่คัดลอกจาก Excel ที่นี่ (Ctrl+V)"></textarea></li>' +
    (set ? '' : '<li><b>นำเข้าเป็นชุดใหม่</b><div class="row2"><label>ชื่อชุดข้อสอบ<input id="iqN" maxlength="160" placeholder="เช่น ตำแหน่งนักวิชาการเงินและบัญชี · ความรู้เฉพาะ"></label><label>ประเภทชุด<select id="iqK"><option value="POSITION">ชุดเฉพาะตำแหน่ง</option><option value="CENTRAL">ชุดกลาง (ทุกตำแหน่ง)</option></select></label></div></li>') +
    '</ol><div id="iqP" class="imprev"></div><div class="modal-act"><button class="btn ghost-dark" id="iqX">ยกเลิก</button><button class="btn primary" id="iqS" disabled>นำเข้า</button></div>', { cls: 'xl' });
  function show(rows) {
    qs = rowsToQuestions(rows); var bad = qs.filter(function (q) { return q.err; }).length;
    $('#iqP', b).innerHTML = !qs.length ? '<p class="bad-t">อ่านข้อสอบไม่ได้ — ตรวจว่ามีแถวหัวตารางที่มีคอลัมน์ "โจทย์" ตามแม่แบบ</p>' :
      '<p class="' + (bad ? 'bad-t' : 'ok-t') + '">อ่านได้ ' + qs.length + ' ข้อ' + (bad ? ' · <b>มีข้อผิดพลาด ' + bad + ' ข้อ</b> (แก้ในไฟล์แล้วเลือกใหม่)' : ' · พร้อมนำเข้า') + ' — ' + Object.keys(IMP_TYPE).map(function (k) { var n = qs.filter(function (q) { return q.type === k; }).length; return n ? IMP_TYPE[k] + ' ' + n : ''; }).filter(String).join(' · ') + '</p>' +
      '<div class="tblwrap sm"><table class="tbl sm"><thead><tr><th>#</th><th>ประเภท</th><th>หมวด</th><th>โจทย์</th><th>เฉลย</th><th class="r">คะแนน</th><th>ที่มา</th><th>ตรวจ</th></tr></thead><tbody>' + qs.map(function (q, i) {
        return '<tr class="' + (q.err ? 'badrow' : '') + '"><td>' + (i + 1) + '</td><td>' + IMP_TYPE[q.type] + '</td><td>' + esc(q.cat) + '</td><td>' + esc(q.text.slice(0, 90)) + (q.text.length > 90 ? '…' : '') + '</td><td>' + (q.type === 'MCQ' ? (TH[q.answer - 1] || '?') + '. ' + esc((q.choices[q.answer - 1] || '').slice(0, 40)) : esc(q.answer)) + '</td><td class="r">' + (q.points || '') + '</td><td>' + (q.ref ? '<span class="ok-t">มี</span>' : '<span class="bad-t">ไม่มี</span>') + '</td><td>' + (q.err ? '<b class="bad-t">' + esc(q.err) + '</b>' : '<span class="ok-t">ถูกต้อง</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    $('#iqS', b).disabled = !qs.length || bad > 0; $('#iqS', b).textContent = qs.length && !bad ? 'นำเข้า ' + qs.length + ' ข้อ' : 'นำเข้า';
  }
  $('#iqX', b).onclick = closeModal;
  $('#iqT', b).oninput = function () { show(parseDelimited(this.value)); };
  $('#iqF', b).onchange = function () {
    var f = this.files[0]; if (!f) return; this.value = '';
    $('#iqP', b).innerHTML = '<p class="muted"><i class="spin dark"></i> กำลังอ่านไฟล์ ' + esc(f.name) + '…</p>';
    if (!$('#iqN', b) || $('#iqN', b).value) { } else $('#iqN', b).value = f.name.replace(/\.[^.]+$/, '').slice(0, 160);
    (/\.xlsx$/i.test(f.name) ? readXlsx(f) : f.text().then(function (t) { return parseDelimited(t); })).then(show).catch(function (e) { $('#iqP', b).innerHTML = '<p class="bad-t">' + esc(e.message) + '</p>'; });
  };
  $('#iqS', b).onclick = function () {
    var bt = this, p = { rows: qs.map(function (q) { return { type: q.type, cat: q.cat, text: q.text, choices: q.choices, answer: q.answer, points: q.points, rubric: q.rubric, ref: q.ref, active: q.active }; }) };
    if (set) p.setId = set.setId; else { if (!val('iqN', b)) return toast('กรุณากรอกชื่อชุดข้อสอบ', 'bad'); p.newSet = { name: val('iqN', b), kind: val('iqK', b) }; }
    busy(bt, true, 'กำลังนำเข้า…');
    api('importQuestions', p, { timeout: 120000 }).then(function (r) { closeModal(); toast('นำเข้าข้อสอบ ' + r.n + ' ข้อเรียบร้อย', 'ok'); AD.at = 0; BD.at = 0; done(r); }).catch(function (e) { busy(bt, false); toast(e.message, 'bad', 12000); });
  };
}

/* ====================== ตำแหน่ง ====================== */
function viewPositions() {
  var d = AD.data;
  $('#app').innerHTML = '<div class="wrap"><div class="phead"><div><span class="eyebrow">ผู้ดูแลระบบ</span><h1>ตำแหน่งที่เปิดสอบ</h1><p class="muted">กำหนดตำแหน่งไว้ล่วงหน้า แล้วเลือกใช้เมื่อสร้างรอบสอบ</p></div><button class="btn primary" id="psNew">' + ICON.plus + 'เพิ่มตำแหน่ง</button></div><div class="card"><div class="tblwrap"><table class="tbl"><thead><tr><th>ตำแหน่ง</th><th>ฝ่าย/หน่วยงาน</th><th>หมายเหตุ</th><th class="r">รอบสอบ</th><th>สถานะ</th><th></th></tr></thead><tbody>' +
    d.positions.map(function (p) { var n = d.exams.filter(function (e) { return e.posId === p.posId; }).length; return '<tr data-id="' + esc(p.posId) + '" class="' + (p.active ? '' : 'off') + '"><td><b>' + esc(p.name) + '</b></td><td>' + esc(p.dept) + '</td><td>' + esc(p.note) + '</td><td class="r">' + n + '</td><td>' + (p.active ? '<span class="tag ok">ใช้งาน</span>' : '<span class="tag">ปิดใช้งาน</span>') + '</td><td class="nowrap"><button class="btn link ps-ed">แก้ไข</button>' + (n ? '' : '<button class="btn link danger-t ps-del">ลบ</button>') + '</td></tr>'; }).join('') + '</tbody></table></div></div></div>';
  function box(p) {
    var b = modal('<h2>' + (p ? 'แก้ไขตำแหน่ง' : 'เพิ่มตำแหน่ง') + '</h2><form class="form" id="pbF"><label>ชื่อตำแหน่ง<input id="pbN" maxlength="160" required value="' + esc(p ? p.name : '') + '" autofocus></label><label>ฝ่าย/หน่วยงาน<input id="pbD" maxlength="160" value="' + esc(p ? p.dept : '') + '"></label><label>หมายเหตุ<input id="pbT" maxlength="300" value="' + esc(p ? p.note : '') + '" placeholder="เช่น บุคลากรสัญญาจ้าง"></label>' + (p ? '<label class="chk"><input type="checkbox" id="pbA"' + (p.active ? ' checked' : '') + '> ใช้งาน</label>' : '') + '<div class="modal-act"><button type="button" class="btn ghost-dark" id="pbX">ยกเลิก</button><button class="btn primary">บันทึก</button></div></form>', { cls: 'sm' });
    $('#pbX', b).onclick = closeModal;
    $('#pbF', b).onsubmit = function (e) { e.preventDefault(); api('savePosition', { posId: p ? p.posId : '', name: val('pbN', b), dept: val('pbD', b), note: val('pbT', b), active: p ? $('#pbA', b).checked : true }).then(function () { closeModal(); toast('บันทึกแล้ว', 'ok'); return loadAdmin(true); }).then(viewPositions).catch(function (er) { toast(er.message, 'bad'); }); };
  }
  $('#psNew').onclick = function () { box(null); };
  $$('tr[data-id]').forEach(function (tr) {
    var p = d.positions.filter(function (x) { return x.posId === tr.dataset.id; })[0];
    $('.ps-ed', tr).onclick = function () { box(p); };
    if ($('.ps-del', tr)) $('.ps-del', tr).onclick = function () { confirmBox('ลบตำแหน่ง', '<p>ลบ "' + esc(p.name) + '"</p>', 'ลบ', true).then(function (y) { if (y) api('deletePosition', { posId: p.posId }).then(function () { toast('ลบแล้ว', 'ok'); return loadAdmin(true); }).then(viewPositions).catch(function (e) { toast(e.message, 'bad'); }); }); };
  });
}

/* ====================== เจ้าหน้าที่ (ผู้ดูแล / กรรมการ) ====================== */
function viewPeople() {
  var d = AD.data;
  $('#app').innerHTML = '<div class="wrap"><div class="phead"><div><span class="eyebrow">ผู้ดูแลระบบ</span><h1>เจ้าหน้าที่ในระบบ</h1><p class="muted">กำหนดผู้ดูแลระบบและกรรมการสอบ · เข้าระบบด้วยเลขเจ้าหน้าที่ ครั้งแรกใช้เลขประจำตัวประชาชนเป็นรหัสผ่าน แล้วระบบบังคับให้ตั้งรหัสใหม่ (ระบบไม่เก็บเลขประจำตัวประชาชน เก็บเฉพาะค่าที่เข้ารหัสทางเดียว)</p></div><button class="btn primary" id="plNew">' + ICON.plus + 'เพิ่มเจ้าหน้าที่</button></div><div class="card"><div class="tblwrap"><table class="tbl"><thead><tr><th>เลขเจ้าหน้าที่</th><th>ชื่อ-สกุล</th><th>หน่วยงาน</th><th>บทบาท</th><th>สถานะ</th><th>เข้าระบบล่าสุด</th><th></th></tr></thead><tbody>' +
    d.staff.map(function (u) { return '<tr data-id="' + esc(u.empCode) + '" class="' + (u.active ? '' : 'off') + '"><td><b>' + esc(u.empCode) + '</b></td><td>' + esc(u.name) + '</td><td>' + esc(u.unit) + '</td><td>' + (u.roles.indexOf('ADMIN') >= 0 ? '<span class="tag info">ผู้ดูแลระบบ</span>' : '') + (u.roles.indexOf('COMMITTEE') >= 0 ? '<span class="tag">กรรมการสอบ</span>' : '') + '</td><td>' + (u.active ? (u.mustChange ? '<span class="tag warn">รอตั้งรหัสผ่าน</span>' : '<span class="tag ok">ใช้งาน</span>') : '<span class="tag">ปิดใช้งาน</span>') + '</td><td>' + (u.lastLogin ? tDate(u.lastLogin) : '<span class="muted">ยังไม่เคยเข้า</span>') + '</td><td><button class="btn link pl-ed">แก้ไข</button></td></tr>'; }).join('') + '</tbody></table></div></div></div>';
  function box(u) {
    var b = modal('<h2>' + (u ? 'แก้ไขเจ้าหน้าที่' : 'เพิ่มเจ้าหน้าที่') + '</h2><form class="form" id="ubF" autocomplete="off"><label>เลขเจ้าหน้าที่<div class="inrow"><input id="ubC" inputmode="numeric" maxlength="10" required value="' + esc(u ? u.empCode : '') + '"' + (u ? ' disabled' : ' autofocus') + '>' + (d.smartApi ? '<button type="button" class="btn ghost-dark sm" id="ubL">ดึงชื่อจากระบบ HR</button>' : '') + '</div></label>' +
      '<label>ชื่อ-สกุล<input id="ubN" maxlength="120" required value="' + esc(u ? u.name : '') + '"></label><label>หน่วยงาน<input id="ubU" maxlength="160" value="' + esc(u ? u.unit : '') + '"></label>' +
      '<div class="se-l">บทบาท</div><label class="chk"><input type="checkbox" id="ubRC"' + (!u || u.roles.indexOf('COMMITTEE') >= 0 ? ' checked' : '') + '> กรรมการสอบ — ตรวจและให้คะแนนในรอบที่ได้รับแต่งตั้ง</label><label class="chk"><input type="checkbox" id="ubRA"' + (u && u.roles.indexOf('ADMIN') >= 0 ? ' checked' : '') + '> ผู้ดูแลระบบ — ตั้งค่ารอบสอบ ข้อสอบ ผู้เข้าสอบ และเจ้าหน้าที่</label>' +
      '<label>' + (u ? 'ตั้งรหัสผ่านใหม่ด้วยเลขประจำตัวประชาชน (เว้นว่างถ้าไม่เปลี่ยน)' : 'เลขประจำตัวประชาชน 13 หลัก (ใช้เป็นรหัสผ่านครั้งแรก)') + '<input id="ubI" inputmode="numeric" maxlength="17" autocomplete="off"' + (u ? '' : ' required') + ' placeholder="x-xxxx-xxxxx-xx-x"></label>' +
      (u ? '<label class="chk"><input type="checkbox" id="ubA"' + (u.active ? ' checked' : '') + '> เปิดใช้งานบัญชี</label>' : '') + '<div class="modal-act"><button type="button" class="btn ghost-dark" id="ubX">ยกเลิก</button><button class="btn primary" id="ubS">บันทึก</button></div></form>');
    $('#ubX', b).onclick = closeModal;
    if ($('#ubL', b)) $('#ubL', b).onclick = function () { var bt = this; busy(bt, true, 'กำลังค้นหา…'); api('lookupStaff', { empCode: val('ubC', b) }).then(function (r) { busy(bt, false); $('#ubN', b).value = r.name; $('#ubU', b).value = r.unit; toast('พบข้อมูล: ' + r.name + (r.position ? ' (' + r.position + ')' : ''), 'ok'); }).catch(function (e) { busy(bt, false); toast(e.message, 'bad'); }); };
    $('#ubF', b).onsubmit = function (e) {
      e.preventDefault(); var roles = []; if ($('#ubRA', b).checked) roles.push('ADMIN'); if ($('#ubRC', b).checked) roles.push('COMMITTEE');
      busy($('#ubS', b), true);
      api('saveStaff', { empCode: u ? u.empCode : val('ubC', b), name: val('ubN', b), unit: val('ubU', b), roles: roles, idCard: val('ubI', b), active: u ? $('#ubA', b).checked : true }).then(function () { closeModal(); toast('บันทึกแล้ว', 'ok'); return loadAdmin(true); }).then(viewPeople).catch(function (er) { busy($('#ubS', b), false); toast(er.message, 'bad'); });
    };
  }
  $('#plNew').onclick = function () { box(null); };
  $$('tr[data-id]').forEach(function (tr) { $('.pl-ed', tr).onclick = function () { box(d.staff.filter(function (x) { return x.empCode === tr.dataset.id; })[0]); }; });
}

/* ====================== ตั้งค่าและประวัติ ====================== */
function viewSettings() {
  var d = AD.data, s = d.settings;
  $('#app').innerHTML = '<div class="wrap"><div class="phead"><div><span class="eyebrow">ผู้ดูแลระบบ</span><h1>ตั้งค่าระบบ</h1></div></div><div class="grid2"><div class="card"><h2 class="card-t">ข้อความบนหน้าเว็บ</h2><form class="form" id="stF"><label>ชื่อหน่วยงาน (ท้ายหน้าเว็บ)<input id="stO" maxlength="300" value="' + esc(s.orgName) + '"></label><label>ช่องทางติดต่อ (หน้าผู้เข้าสอบ)<input id="stC" maxlength="300" value="' + esc(s.contact) + '"></label>' +
    '<label>ข้อปฏิบัติของผู้เข้าสอบ (บรรทัดละ 1 ข้อ)<textarea id="stR" rows="6" maxlength="1900">' + esc(String(s.candRules || '').split('|').join('\n')) + '</textarea></label><label>จำนวนครั้งที่ผู้เข้าสอบกรอกรหัสผิดได้ก่อนพัก 5 นาที<input id="stL" type="number" min="3" max="30" value="' + esc(s.candFailLimit || 8) + '"></label>' +
    '<div class="se-l">แบบประเมินความพึงพอใจ (แสดงหลังผู้เข้าสอบส่งครบทุกตอน)</div><label class="chk"><input type="checkbox" id="stSv"' + (s.surveyOn !== '0' ? ' checked' : '') + '> เปิดใช้แบบประเมิน (ไม่บังคับตอบ · ไม่ระบุตัวผู้ตอบ)</label><label>หัวข้อประเมิน บรรทัดละ 1 ข้อ ไม่เกิน 7 ข้อ (ให้คะแนน 1–5) · มีช่องข้อเสนอแนะต่อท้ายเสมอ<textarea id="stSi" rows="7" maxlength="1900">' + esc(String(s.surveyItems || '').split('|').join('\n')) + '</textarea></label>' +
    '<button class="btn primary" id="stS">บันทึกการตั้งค่า</button></form></div>' +
    '<div class="card"><h2 class="card-t">ระบบและการเชื่อมต่อ</h2><table class="kv"><tr><th>รุ่นหน้าเว็บ</th><td>' + esc(TG_BUILD) + '</td></tr><tr><th>รุ่นหลังบ้าน</th><td>' + esc(d.app.build) + ' ' + (d.app.build === TG_BUILD ? '<span class="tag ok">ตรงกัน</span>' : '<span class="tag bad">ไม่ตรงกัน</span>') + '</td></tr><tr><th>ช่วงผ่อนผันหลังหมดเวลา</th><td>' + d.app.graceSec + ' วินาที</td></tr>' +
    '<tr><th>ฐานข้อมูล</th><td>' + (d.links.sheet ? '<a href="' + esc(d.links.sheet) + '" target="_blank" rel="noopener">เปิด Google Sheet</a>' : '–') + '</td></tr><tr><th>ไฟล์สอบ</th><td>' + (d.links.folder ? '<a href="' + esc(d.links.folder) + '" target="_blank" rel="noopener">เปิดโฟลเดอร์ Google Drive</a>' : '–') + '</td></tr>' +
    '<tr><th>ระบบ HR (SmartAPI)</th><td>' + (d.smartApi ? '<span class="tag ok">ตั้งค่าแล้ว</span> <button class="btn link" id="stT">ทดสอบการเชื่อมต่อ</button>' : '<span class="tag">ยังไม่ได้เชื่อมต่อ</span><br><small class="muted">ไม่บังคับ — ใช้ดึงชื่อเจ้าหน้าที่จากเลขเจ้าหน้าที่ ตั้ง SMARTAPI_USER / SMARTAPI_PASS ใน Script Properties</small>') + '</td></tr>' +
    '<tr><th>ชุดข้อสอบของรุ่นนี้</th><td><button class="btn link" id="stX">ตรวจและติดตั้งชุดข้อสอบที่ยังไม่มีในคลัง</button><br><small class="muted">ปกติระบบติดตั้งให้เองหลังอัปเดต · ไม่แตะข้อสอบเดิม</small></td></tr></table>' +
    '<p class="muted sm">Google Sheet และโฟลเดอร์ Drive เปิดได้เฉพาะเจ้าของบัญชีที่ติดตั้งระบบ ห้ามแชร์ให้ผู้อื่น เพราะมีเฉลยข้อสอบและรหัสเข้าสอบ</p></div></div>' +
    '<div class="card"><h2 class="card-t">ทดสอบรับโหลด</h2><p class="card-s">จำลองผู้เข้าสอบหลายคนเข้าระบบ ทำข้อสอบ บันทึก ส่งคำตอบ และส่งไฟล์<b>พร้อมกัน</b>บนระบบจริง เพื่อวัดว่าระบบรับได้หรือไม่ · ใช้รอบสอบจำลองแยกต่างหาก ไม่กระทบข้อมูลจริง และลบทิ้งเองเมื่อจบ · <b>ห้ามรันระหว่างการสอบจริง</b></p>' +
    '<div class="form ltform"><div class="row2"><label>คัดลอกตอนสอบจากรอบ<select id="ltE">' + d.exams.filter(function (e) { return e.examId !== 'LOADTEST'; }).map(function (e) { return '<option value="' + esc(e.examId) + '">' + esc(e.title) + '</option>'; }).join('') + '</select></label><label>จำนวนผู้เข้าสอบจำลอง<input id="ltN" type="number" min="1" max="40" value="25"></label></div><button class="btn primary" id="ltGo">เริ่มทดสอบรับโหลด</button></div><div id="ltOut"></div></div>' +
    '<div class="card"><div class="card-head"><div><h2 class="card-t">ประวัติการใช้งาน</h2><p class="card-s">300 รายการล่าสุด · ทุกการเข้าสู่ระบบ การส่งคำตอบ การให้คะแนน และการแก้ไขของผู้ดูแลถูกบันทึกไว้</p></div><input id="auQ" class="search" placeholder="ค้นหา เช่น resetSection, 5660101"></div><div class="tblwrap tall" id="auB"><p class="muted">กำลังโหลด…</p></div></div></div>';
  $('#stF').onsubmit = function (e) { e.preventDefault(); var b = $('#stS'); busy(b, true); api('saveSettings', { settings: { orgName: val('stO'), contact: val('stC'), candRules: val('stR').split(/\n/).map(function (x) { return x.trim(); }).filter(String).join('|'), candFailLimit: val('stL'), surveyOn: $('#stSv').checked ? '1' : '0', surveyItems: val('stSi').split(/\n/).map(function (x) { return x.trim(); }).filter(String).slice(0, 7).join('|') } }).then(function () { busy(b, false); toast('บันทึกแล้ว', 'ok'); AD.at = 0; }).catch(function (er) { busy(b, false); toast(er.message, 'bad'); }); };
  $('#stX').onclick = function () { var b = this; busy(b, true, 'กำลังตรวจ…'); api('installExtraSets', {}, { timeout: 120000 }).then(function (r) { busy(b, false); AD.at = 0; toast(r.sets ? 'ติดตั้งเพิ่ม ' + r.sets + ' ชุด ' + r.questions + ' ข้อ' : 'คลังข้อสอบมีครบทุกชุดของรุ่นนี้แล้ว', 'ok'); }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); }); };
  $('#ltGo').onclick = function () { loadTest(val('ltE'), Number(val('ltN')) || 25, this); };
  if ($('#stT')) $('#stT').onclick = function () { var b = this; busy(b, true, 'กำลังทดสอบ…'); api('testSmartApi', {}, { timeout: 60000 }).then(function (r) { busy(b, false); toast('เชื่อมต่อ SmartAPI ได้ (' + r.ms + ' ms)', 'ok'); }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); }); };
  api('getAudit', { limit: 300 }).then(function (r) {
    function draw() { var q = val('auQ').toLowerCase(), rows = r.rows.filter(function (x) { return !q || (x.who + ' ' + x.action + ' ' + x.detail).toLowerCase().indexOf(q) >= 0; }); $('#auB').innerHTML = '<table class="tbl sm"><thead><tr><th>เวลา</th><th>ผู้ทำ</th><th>การกระทำ</th><th>รายละเอียด</th></tr></thead><tbody>' + rows.map(function (x) { return '<tr><td class="nowrap">' + tDate(x.at) + '</td><td>' + esc(x.who) + '</td><td><code>' + esc(x.action) + '</code></td><td>' + esc(x.detail) + '</td></tr>'; }).join('') + '</tbody></table>'; }
    if ($('#auB')) { draw(); $('#auQ').oninput = draw; }
  }).catch(function (e) { if ($('#auB')) $('#auB').textContent = e.message; });
}

/* ====================== ทดสอบรับโหลด (ผู้เข้าสอบจำลองทำข้อสอบพร้อมกันบนระบบจริง) ====================== */
function loadTest(examId, n, btn) {
  var out = $('#ltOut'), stat = [], t00 = performance.now(), doneU = 0, failU = 0, phase = 'เตรียมข้อมูลจำลอง';
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function call(action, payload, token) {
    var rid = rid_(), t0 = performance.now(), tries = 0;
    function once() {
      tries++;
      return fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: action, token: token, payload: payload || {}, rid: rid }), redirect: 'follow', credentials: 'omit' }).then(function (r) { return r.text(); }).then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) { }
        if (!j || j.rpc !== 1 || (!j.ok && j.busy)) { var x = new Error('soft'); x.soft = 1; throw x; }
        if (!j.ok) { var er = new Error(j.error); er.hard = 1; throw er; }
        return j.data;
      }).catch(function (e) { if (e.hard) throw e; if (tries < 5) return sleep(700 * tries + Math.random() * 900).then(once); throw new Error('เชื่อมต่อไม่สำเร็จหลังลอง 5 ครั้ง'); });
    }
    return once().then(function (dd) { stat.push({ a: action, ms: performance.now() - t0, tries: tries, ok: true }); return dd; }, function (e) { stat.push({ a: action, ms: performance.now() - t0, tries: tries, ok: false, err: e.message }); throw e; });
  }
  function paint(final) {
    var by = {}, order = ['loginCand', 'startSection', 'saveProgress', 'submitSection', 'getTemplate', 'uploadFile', 'submitSurvey'], TH2 = { loginCand: 'เข้าสู่ระบบ', startSection: 'เริ่มตอน (รับข้อสอบ)', saveProgress: 'บันทึกระหว่างทำ', submitSection: 'ส่งคำตอบ', getTemplate: 'ดาวน์โหลดไฟล์โจทย์', uploadFile: 'ส่งไฟล์คำตอบ', submitSurvey: 'ส่งแบบประเมิน' };
    stat.forEach(function (x) { (by[x.a] = by[x.a] || []).push(x); });
    var q = function (a, p) { var v = a.map(function (x) { return x.ms; }).sort(function (x, y) { return x - y; }); return v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] / 1000 : 0; };
    var fails = stat.filter(function (x) { return !x.ok; }), retr = stat.filter(function (x) { return x.tries > 1; }).length, sec = Math.round((performance.now() - t00) / 1000), worst = stat.length ? Math.max.apply(null, stat.map(function (x) { return x.ms; })) / 1000 : 0;
    var verdict = !final ? '' : (failU === 0 && fails.length === 0 ? '<div class="note ok"><b>ผ่าน:</b> ผู้เข้าสอบจำลอง ' + n + ' คนทำครบทุกขั้นโดยไม่มีคำสั่งล้มเหลว' + (retr ? ' (มี ' + retr + ' คำสั่งที่ระบบต้องส่งซ้ำอัตโนมัติ ซึ่งผู้ใช้ไม่ต้องทำอะไร)' : '') + ' · คำสั่งที่ช้าที่สุดใช้ ' + num(worst, 1) + ' วินาที' + (worst > 30 ? ' — ช้ากว่าที่ควร แนะนำให้ผู้เข้าสอบเริ่มไม่พร้อมกันเป๊ะ (ทยอยกดเริ่ม) และเผื่อเวลา' : '') + '</div>'
      : '<div class="note bad"><b>ไม่ผ่าน:</b> ทำครบ ' + doneU + ' จาก ' + n + ' คน · คำสั่งล้มเหลว ' + fails.length + ' ครั้ง — ตัวอย่าง: ' + esc((fails[0] || {}).err || '') + '</div>');
    out.innerHTML = '<div class="ltbox"><p><b>' + (final ? 'ทดสอบเสร็จ' : '<i class="spin dark"></i> ' + esc(phase)) + '</b> · ผ่านไป ' + sec + ' วินาที · ทำครบ ' + doneU + '/' + n + ' คน · ส่งคำสั่งแล้ว ' + stat.length + ' ครั้ง</p>' + verdict +
      '<div class="tblwrap"><table class="tbl sm"><thead><tr><th>ขั้นตอน</th><th class="r">จำนวน</th><th class="r">ค่ากลาง (วินาที)</th><th class="r">ช้าสุด 5% (วินาที)</th><th class="r">ช้าที่สุด</th><th class="r">ส่งซ้ำอัตโนมัติ</th><th class="r">ล้มเหลว</th></tr></thead><tbody>' +
      order.filter(function (k) { return by[k]; }).map(function (k) { var a = by[k]; return '<tr><td>' + TH2[k] + '</td><td class="r">' + a.length + '</td><td class="r">' + num(q(a, .5), 1) + '</td><td class="r">' + num(q(a, .95), 1) + '</td><td class="r">' + num(q(a, 1), 1) + '</td><td class="r">' + a.filter(function (x) { return x.tries > 1; }).length + '</td><td class="r">' + (a.filter(function (x) { return !x.ok; }).length || '–') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }
  function user(c, secs, i) {
    var tok;
    return sleep(Math.random() * 4000).then(function () { return call('loginCand', { examNo: c.examNo, code: c.code, ua: 'loadtest' }); }).then(function (r) {
      tok = r.token;
      return secs.reduce(function (p, s) {
        return p.then(function () { return sleep(300 + Math.random() * 1500); }).then(function () { return call('startSection', { secId: s.secId }, tok); }).then(function (st) {
          if (s.type === 'PRACTICAL') {
            if (!s.hasTemplate) return call('submitSection', { secId: s.secId }, tok);
            return call('getTemplate', { secId: s.secId }, tok).then(function (t) { return sleep(1500 + Math.random() * 2500).then(function () { return call('uploadFile', { secId: s.secId, name: 'loadtest_' + c.examNo + '.xlsx', b64: t.b64 }, tok); }); }).then(function () { return call('submitSection', { secId: s.secId }, tok); });
          }
          var ans = {}; st.questions.forEach(function (q) { ans[q.id] = q.type === 'ESSAY' ? 'คำตอบจำลองสำหรับทดสอบรับโหลด '.repeat(12) : 1 + Math.floor(Math.random() * (q.choices.length || 2)); });
          var half = {}; Object.keys(ans).slice(0, Math.ceil(st.questions.length / 2)).forEach(function (k) { half[k] = ans[k]; });
          return sleep(1500 + Math.random() * 2500).then(function () { return call('saveProgress', { secId: s.secId, answers: half, blur: 0 }, tok); })
            .then(function () { return sleep(1500 + Math.random() * 2500); }).then(function () { return call('saveProgress', { secId: s.secId, answers: ans, blur: 0 }, tok); })
            .then(function () { return sleep(500 + Math.random() * 1500); }).then(function () { return call('submitSection', { secId: s.secId, answers: ans, blur: 0 }, tok); });
        });
      }, Promise.resolve());
    }).then(function (st) { if (st && st.survey && !st.survey.done) return call('submitSurvey', { scores: st.survey.items.map(function () { return 4 + Math.round(Math.random()); }), comment: '' }, tok); }).then(function () { doneU++; }, function () { failU++; });
  }
  confirmBox('ทดสอบรับโหลด', '<p>ระบบจะสร้างรอบสอบจำลองและผู้เข้าสอบจำลอง <b>' + n + ' คน</b> แล้วให้ทุกคนเข้าระบบ ทำ และส่งข้อสอบพร้อมกัน ใช้เวลาประมาณ 1–3 นาที</p><div class="note warn">ห้ามรันระหว่างการสอบจริง · เปิดหน้านี้ค้างไว้จนจบ</div>', 'เริ่มทดสอบ').then(function (y) {
    if (!y) return;
    busy(btn, true, 'กำลังทดสอบ…'); paint();
    var iv = setInterval(function () { paint(); }, 1000);
    api('loadTestStart', { examId: examId, n: n }, { quiet: true, timeout: 120000 }).then(function (r) {
      phase = 'ผู้เข้าสอบจำลอง ' + r.cands.length + ' คนกำลังทำข้อสอบพร้อมกัน';
      return Promise.all(r.cands.map(function (c, i) { return user(c, r.sections, i); }));
    }).then(function () { phase = 'กำลังลบข้อมูลจำลอง'; return api('loadTestEnd', {}, { quiet: true, timeout: 120000 }); }).then(function () {
      clearInterval(iv); busy(btn, false); paint(true); AD.at = 0; TG.home = null; toast('ทดสอบรับโหลดเสร็จ และลบข้อมูลจำลองแล้ว', 'ok');
    }).catch(function (e) {
      clearInterval(iv); busy(btn, false); paint(true); toast('ทดสอบไม่จบ: ' + e.message, 'bad', 9000);
      api('loadTestEnd', {}, { quiet: true, timeout: 120000 }).catch(function () { });
    });
  });
}
