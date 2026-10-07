/* =====================================================================
   SOMDEJ TalentGate · admin.js — รุ่น 2.0 · ผู้ดูแลระบบ: ตั้งค่ารอบสอบ · ผู้เข้าสอบ · คลังข้อสอบ · ตำแหน่ง · เจ้าหน้าที่ · ตั้งค่า · ที่เก็บข้อมูล
   ===================================================================== */
var AD = { data: null, at: 0, setId: null, qs: null, showCodes: false, cands: null, bank: null, bankToken: null, bankQ: '', room: '' };
var ROLE_TH = { ADMIN: 'ผู้ดูแลระบบ', COMMITTEE: 'กรรมการสอบ', HR: 'ผู้สังเกตการณ์ (HR)', AUTHOR: 'ผู้ออกข้อสอบ' };
function loadAdmin(force, examId) {
  if (AD.data && !force && Date.now() - AD.at < 20000) return Promise.resolve(AD.data);
  return api('getAdminData', examId ? { examId: examId } : {}).then(function (d) { AD.data = d; AD.at = Date.now(); return d; });
}
function adminRoute(parts) {
  boardStop(); TG.view = 'admin'; markNav();
  if (parts[0] === 'bank') return viewBank(parts[1]);   // คลังข้อสอบ: ผู้ดูแลและผู้ออกข้อสอบ — ต้องยืนยันรหัสผ่านทุกครั้งที่เข้า
  var fn = { positions: viewPositions, staff: viewPeople, settings: viewSettings }[parts[0]];
  if (!fn || !isAdmin()) { location.hash = '#/staff'; return; }
  if (!AD.data) $('#app').innerHTML = '<div class="boot"><div class="boot-ring"></div></div>';
  var first = !AD.data;
  loadAdmin().then(function () { if (TG.view === 'admin') { if (first) enterAnim(); fn(parts[1]); } }).catch(function (e) { toast(e.message, 'bad'); });
}
/** แสดงรหัสผ่านชั่วคราว (ครั้งเดียว) ให้ผู้ดูแลแจ้งเจ้าหน้าที่ */
function showTempPass(r) {
  var b = modal('<h2>รหัสผ่านชั่วคราว</h2><p class="muted">แจ้งรหัสนี้ให้ <b>' + esc(r.name) + '</b> (เลขเจ้าหน้าที่ ' + esc(r.empCode) + ') ใช้เข้าสู่ระบบครั้งแรก ระบบจะให้ตั้งรหัสผ่านใหม่ทันที</p><div class="tempass" id="tpV">' + esc(r.tempPass) + '</div>' +
    '<div class="note warn">รหัสนี้แสดง<b>ครั้งเดียว</b> ระบบไม่เก็บรหัสไว้ให้ดูย้อนหลัง หากทำหาย ให้ไปที่เมนู "เจ้าหน้าที่" กด "แก้ไข" แล้วเลือก "ออกรหัสผ่านชั่วคราวใหม่"</div><div class="modal-act"><button class="btn ghost-dark" id="tpC">คัดลอกรหัส</button><button class="btn primary" id="tpX" autofocus>รับทราบ ปิดหน้าต่าง</button></div>', { cls: 'sm', noClose: true });
  $('#tpX', b).onclick = function () { modal._lock = false; closeModal(); };
  $('#tpC', b).onclick = function () { var no = function () { toast('คัดลอกไม่ได้ กรุณาจดรหัสด้วยตนเอง', 'bad'); }; try { navigator.clipboard.writeText(r.tempPass).then(function () { toast('คัดลอกรหัสแล้ว', 'ok'); }, no); } catch (e) { no(); } };
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
      api('saveExam', { exam: { posId: val('nePos', b), title: val('neT', b), examDate: val('neD', b), place: val('neP', b), passPct: src ? src.passPct : 60, blind: src ? src.blind : true, committee: src ? src.committee : [], duties: src ? src.duties : {}, ivOn: src ? src.ivOn : true, ivWeight: src ? src.ivWeight : 50, ivItems: src ? src.ivItems.map(function (x) { return { label: x.label, max: x.max }; }) : undefined }, sections: secs })
        .then(function (r) { AD.at = 0; TG.home = null; closeModal(); toast('สร้างรอบสอบแล้ว', 'ok'); location.hash = '#/staff/' + encodeURIComponent(r.examId) + '/setup'; })
        .catch(function (e) { busy($('#neS', b), false); toast(e.message, 'bad'); });
    };
  }).catch(function (e) { toast(e.message, 'bad'); });
}

/* ====================== ตั้งค่ารอบสอบ (แท็บในกระดาน) ====================== */
function tabSetup() {
  $('#tab').innerHTML = '<div class="boot"><div class="boot-ring"></div></div>';
  loadAdmin(true, BD.id).then(function (d) {
    if (BD.tab !== 'setup' || TG.view !== 'board' || !$('#tab')) return;
    var ex = d.exams.filter(function (e) { return e.examId === BD.id; })[0]; if (!ex) return;
    var secs = JSON.parse(JSON.stringify(ex.sections)), ro = ex.status === 'FINAL', lock = ex.hasAttempts, staff = d.staff.filter(function (u) { return u.active; });
    ex.duties = ex.duties || {}; ex.committee.forEach(function (c) { if (!ex.duties[c]) ex.duties[c] = DUTY_KEYS.slice(); });
    /** เลือกชุดข้อสอบ: ชุดที่เลือกแล้วอยู่ด้านบน · ด้านล่างค้นหาได้ และจัดกลุ่มตามโฟลเดอร์ของคลัง (ฝ่าย › ตำแหน่ง) */
    function setChips(s, i) {
      var grp = s.type === 'PROFILE' ? 'P' : 'T', dis = ro || (lock && s.secId), list = d.sets.filter(function (x) { return x.group === grp && (x.active || s.sets.indexOf(x.setId) >= 0); });
      if (!list.length) return '<p class="muted sm">ยังไม่มีชุดข้อสอบประเภทนี้ในคลัง</p>';
      var sel = s.sets.map(function (id) { return d.sets.filter(function (x) { return x.setId === id; })[0]; }).filter(Boolean), folders = {};
      var h = '<div class="setsel">' + (sel.length ? sel.map(function (x, k) { return '<span class="setpill"><em>' + (k + 1) + '</em><span><b>' + esc(x.name) + '</b><i>' + esc(x.folder) + ' · ' + x.n + ' ข้อ' + (x.pts ? ' · ' + x.pts + ' คะแนน' : '') + '</i></span>' + (dis ? '' : '<button type="button" class="icon-btn dark" data-unset="' + esc(x.setId) + '" title="นำชุดนี้ออก">×</button>') + '</span>'; }).join('') : '<span class="muted sm">ยังไม่ได้เลือกชุดข้อสอบ</span>') + '</div>';
      if (dis) return h;
      list.forEach(function (x) { (folders[x.folder] = folders[x.folder] || []).push(x); });
      return h + '<input class="srch" data-sq="' + i + '" placeholder="ค้นหาชุดข้อสอบ — พิมพ์ชื่อชุด ตำแหน่ง หรือฝ่าย" value="' + esc(s._q || '') + '" autocomplete="off">' + Object.keys(folders).sort(thCmp).map(function (fd) {
        var l = folders[fd].sort(function (a, b) { return thCmp(a.name, b.name); }), nSel = l.filter(function (x) { return s.sets.indexOf(x.setId) >= 0; }).length;
        return '<details class="setfold"' + (nSel ? ' open' : '') + '><summary><b>' + esc(fd.split('/').join(' › ')) + '</b><small>' + (nSel ? 'เลือก ' + nSel + ' จาก ' : '') + l.length + ' ชุด</small></summary><div class="setgrp">' + l.map(function (x) {
          return '<label class="setchip" data-q="' + esc((x.name + ' ' + x.folder + ' ' + (x.note || '')).toLowerCase()) + '"><input type="checkbox" data-set="' + i + '" value="' + esc(x.setId) + '"' + (s.sets.indexOf(x.setId) >= 0 ? ' checked' : '') + '><span><b>' + esc(x.name) + '</b><i>' + x.n + ' ข้อ' + (x.pts ? ' · ' + x.pts + ' คะแนน' : '') + (x.active ? '' : ' · ปิดใช้งาน') + '</i></span></label>';
        }).join('') + '</div></details>';
      }).join('');
    }
    function setFilter(card) {
      var inp = $('[data-sq]', card); if (!inp) return; var q = inp.value.trim().toLowerCase();
      $$('.setfold', card).forEach(function (dt) {
        var any = false, has = false;
        $$('.setchip', dt).forEach(function (c) { var ok = !q || c.dataset.q.indexOf(q) >= 0; c.hidden = !ok; if (ok) any = true; if ($('input', c).checked) has = true; });
        dt.hidden = !any; if (q) dt.open = any; else dt.open = has;
      });
    }
    /** คณะกรรมการ: ค้นหาเพื่อเพิ่ม (ชื่อ/เลขเจ้าหน้าที่ หรือดึงจากระบบ HR) และกำหนดหน้าที่รายคน */
    function cmCard() {
      var by = {}; d.staff.forEach(function (u) { by[u.empCode] = u; });
      return '<div class="card"><h2 class="card-t">คณะกรรมการและหน้าที่ในรอบสอบนี้</h2><p class="card-s">กรรมการเห็นเฉพาะรอบสอบที่ได้รับแต่งตั้ง และเห็นเฉพาะแท็บตามหน้าที่ · <b>คุมสอบ</b> = ติดตามสอบ เปิด-ปิดตอน เพิ่มเวลา คืนสิทธิ์ทำตอน (ไม่เห็นคะแนน) · <b>ตรวจข้อเขียน / ตรวจภาคปฏิบัติ / สัมภาษณ์</b> = ให้คะแนนเฉพาะส่วนนั้น</p>' +
        (ro ? '' : '<div class="cmadd"><input id="sxCmQ" class="srch" placeholder="เพิ่มกรรมการ — พิมพ์ชื่อ หรือเลขเจ้าหน้าที่" autocomplete="off"><div id="sxCmR" class="cmres"></div></div>') +
        (ex.committee.length ? '<div class="tblwrap"><table class="tbl cmtbl"><thead><tr><th>กรรมการ</th>' + DUTY_KEYS.map(function (k) { return '<th class="c">' + DUTY_TH[k] + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' + ex.committee.map(function (code) {
          var u = by[code] || { name: code, unit: '' }, du = ex.duties[code] || [];
          return '<tr data-cm="' + esc(code) + '"><td><b>' + esc(u.name) + '</b><br><small class="muted">' + esc(code) + (u.unit ? ' · ' + esc(u.unit) : '') + (u.active === false ? ' · <span class="bad-t">บัญชีปิดใช้งาน</span>' : '') + '</small></td>' + DUTY_KEYS.map(function (k) { return '<td class="c"><input type="checkbox" class="cm-d" value="' + k + '"' + (du.indexOf(k) >= 0 ? ' checked' : '') + (ro ? ' disabled' : '') + ' aria-label="' + DUTY_TH[k] + '"></td>'; }).join('') + '<td>' + (ro ? '' : '<button type="button" class="icon-btn dark cm-x" title="นำออกจากคณะกรรมการ">×</button>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted">ยังไม่ได้แต่งตั้งกรรมการ — พิมพ์ชื่อหรือเลขเจ้าหน้าที่ในช่องค้นหาด้านบน</p>') + '</div>';
    }
    function cmSearch() {
      var inp = $('#sxCmQ'), box = $('#sxCmR'); if (!inp) return;
      var q = inp.value.trim().toLowerCase(); if (!q) { box.innerHTML = ''; return; }
      var hit = staff.filter(function (u) { return ex.committee.indexOf(u.empCode) < 0 && (u.empCode.indexOf(q) >= 0 || u.name.toLowerCase().indexOf(q) >= 0 || String(u.unit || '').toLowerCase().indexOf(q) >= 0); }).slice(0, 8);
      var isCode = /^\d{4,10}$/.test(q), known = d.staff.some(function (u) { return u.empCode === q; });
      box.innerHTML = hit.map(function (u) { return '<button type="button" class="cmhit" data-add="' + esc(u.empCode) + '"><b>' + esc(u.name) + '</b><small>' + esc(u.empCode) + (u.unit ? ' · ' + esc(u.unit) : '') + ' · ' + u.roles.map(function (r) { return ROLE_TH[r] || r; }).join(', ') + '</small></button>'; }).join('') +
        (isCode && !known ? (d.smartApi ? '<button type="button" class="cmhit hr" id="sxCmHr"><b>ค้นหาเลข ' + esc(q) + ' จากระบบ HR</b><small>ดึงชื่อและหน่วยงาน แล้วเพิ่มเป็นกรรมการของระบบ</small></button>' : '<p class="muted sm">ไม่พบเลข ' + esc(q) + ' ในระบบ — เพิ่มได้ที่เมนู "เจ้าหน้าที่"</p>') : (!hit.length ? '<p class="muted sm">ไม่พบ' + (isCode ? ' (อยู่ในคณะกรรมการแล้ว)' : ' — ลองพิมพ์เลขเจ้าหน้าที่เพื่อค้นจากระบบ HR') + '</p>' : ''));
      $$('[data-add]', box).forEach(function (b) { b.onclick = function () { pull(); ex.committee.push(b.dataset.add); ex.duties[b.dataset.add] = DUTY_KEYS.slice(); draw(); var x = $('#sxCmQ'); if (x) x.focus(); }; });
      if ($('#sxCmHr')) $('#sxCmHr').onclick = function () {
        var bt = this; busy(bt, true, 'กำลังค้นหา…');
        api('lookupStaff', { empCode: q }).then(function (r) {
          busy(bt, false);
          return confirmBox('เพิ่มกรรมการจากระบบ HR', '<p><b>' + esc(r.name) + '</b> (' + esc(r.empCode) + ')<br>' + esc(r.unit || '') + (r.position ? '<br>' + esc(r.position) : '') + '</p><p class="muted">ระบบจะสร้างบัญชีกรรมการสอบและสุ่มรหัสผ่านชั่วคราวให้ (แสดงครั้งเดียว)</p>', 'เพิ่มเป็นกรรมการ').then(function (y) {
            if (!y) return;
            return api('saveStaff', { empCode: r.empCode, name: r.name, unit: r.unit, roles: ['COMMITTEE'], isNew: true }).then(function (x) {
              var u = { empCode: r.empCode, name: r.name, unit: r.unit, roles: ['COMMITTEE'], bank: [], active: true, mustChange: true, lastLogin: 0 };
              d.staff.push(u); staff.push(u); pull(); ex.committee.push(u.empCode); ex.duties[u.empCode] = DUTY_KEYS.slice(); draw();
              toast('เพิ่ม ' + r.name + ' แล้ว — อย่าลืมกด "บันทึกการตั้งค่า"', 'ok', 7000); if (x.tempPass) showTempPass(x);
            });
          });
        }).catch(function (e) { busy(bt, false); toast(e.message, 'bad', 9000); });
      };
    }
    function secMax(s) { return s.type === 'PROFILE' ? 0 : s.type === 'PRACTICAL' ? (s.rubric || []).reduce(function (a, r) { return a + (Number(r.max) || 0); }, 0) : s.sets.reduce(function (a, id) { var x = d.sets.filter(function (q) { return q.setId === id; })[0]; return a + (x ? x.pts : 0); }, 0); }
    function draw() {
      var total = secs.reduce(function (a, s) { return a + secMax(s); }, 0), mins = secs.reduce(function (a, s) { return a + (Number(s.minutes) || 0); }, 0);
      var h = (lock ? '<div class="note warn">มีผู้เข้าสอบเริ่มทำข้อสอบแล้ว จึงเปลี่ยนประเภทตอน ชุดข้อสอบ หรือเพิ่ม/ลบตอนไม่ได้ (แก้ชื่อ เวลา คำชี้แจง เกณฑ์ และกรรมการได้)</div>' : '') + (ro ? '<div class="note warn">รอบสอบนี้ยืนยันผลแล้ว แก้ไขไม่ได้</div>' : '') +
        '<div class="card"><h2 class="card-t">ข้อมูลรอบสอบ</h2><div class="form"><label>ชื่อรอบสอบ<input id="sxT" maxlength="200" value="' + esc(ex.title) + '"></label><div class="row2"><label>ตำแหน่ง<select id="sxPos">' + d.positions.map(function (p) { return '<option value="' + esc(p.posId) + '"' + (p.posId === ex.posId ? ' selected' : '') + '>' + esc(p.name) + (p.dept ? ' · ' + esc(p.dept) : '') + '</option>'; }).join('') + '</select></label>' +
        '<label>เกณฑ์ผ่าน (ร้อยละของคะแนนเต็ม)<input id="sxPass" type="number" min="0" max="100" value="' + ex.passPct + '"></label></div><div class="row2"><label>วันและเวลาสอบ<input id="sxD" maxlength="100" value="' + esc(ex.examDate) + '"></label><label>สถานที่<input id="sxP" maxlength="200" value="' + esc(ex.place) + '"></label></div>' +
        '<label>หมายเหตุ<input id="sxN" maxlength="500" value="' + esc(ex.note) + '"></label><label class="chk"><input type="checkbox" id="sxBlind"' + (ex.blind ? ' checked' : '') + '> ปิดชื่อผู้เข้าสอบในหน้าตรวจ (เห็นเฉพาะเลขประจำตัวสอบ) — ไม่ติ๊ก = แสดงชื่อ-สกุลให้กรรมการเห็นขณะตรวจ · สลับได้จากสวิตช์ในแท็บตรวจเช่นกัน</label></div></div>' +
        cmCard() +
        '<div class="card ivset"><div class="card-head"><div><h2 class="card-t">การสอบสัมภาษณ์</h2><p class="card-s">กรรมการให้คะแนนสัมภาษณ์ในแท็บ "สัมภาษณ์" · คะแนนรวม = คะแนนสอบ × น้ำหนักสอบ + คะแนนสัมภาษณ์ × น้ำหนักสัมภาษณ์ (คิดเป็นร้อยละ เต็ม 100) · เกณฑ์ผ่านด้านบนใช้กับคะแนนรวม</p></div><label class="sw"><input type="checkbox" id="sxIv"' + (ex.ivOn ? ' checked' : '') + (ro ? ' disabled' : '') + '><i></i></label></div>' +
        (ex.ivOn ? '<div class="form"><div class="row2"><label>น้ำหนักคะแนนสัมภาษณ์ (ร้อยละ)<input id="sxIvW" type="number" min="0" max="100" step="1" value="' + ex.ivWeight + '"' + (ro ? ' disabled' : '') + '></label><div class="ivw"><span>สัดส่วนที่ใช้คิดคะแนนรวม</span><b id="sxIvT">สอบ ' + (100 - ex.ivWeight) + ' : สัมภาษณ์ ' + ex.ivWeight + '</b><div class="bar big"><i id="sxIvB" style="width:' + (100 - ex.ivWeight) + '%"></i></div></div></div>' +
          '<div class="se-l">หัวข้อให้คะแนนสัมภาษณ์ — รวม ' + ex.ivItems.reduce(function (a, x) { return a + (Number(x.max) || 0); }, 0) + ' คะแนน' + (ex.ivLocked ? ' <span class="tag warn">มีคะแนนแล้ว: แก้ได้เฉพาะชื่อหัวข้อ</span>' : '') + '</div><table class="tbl rub-e ivi-e"><thead><tr><th>หัวข้อ</th><th class="r">คะแนนเต็ม</th><th></th></tr></thead><tbody>' +
          ex.ivItems.map(function (x, j) { return '<tr data-j="' + j + '"><td><input data-iv="label" maxlength="80" value="' + esc(x.label) + '"' + (ro ? ' disabled' : '') + '></td><td class="r"><input data-iv="max" type="number" min="1" max="100" step="1" value="' + x.max + '"' + (ro || ex.ivLocked ? ' disabled' : '') + '></td><td>' + (ro || ex.ivLocked ? '' : '<button class="icon-btn dark" data-ivr="' + j + '" title="ลบหัวข้อ">×</button>') + '</td></tr>'; }).join('') +
          '</tbody></table>' + (ro || ex.ivLocked ? '' : '<button class="btn link" id="sxIvA">' + ICON.plus + 'เพิ่มหัวข้อ</button>') + '</div>' : '<p class="muted sm">รอบนี้ไม่ใช้การสัมภาษณ์ในระบบ: ผลสอบคิดจากคะแนนสอบอย่างเดียว</p>') + '</div>' +
        '<div class="card-head"><h2 class="sec-h">ตอนสอบ <small class="muted">รวม ' + mins + ' นาที · ' + total + ' คะแนน</small></h2>' + (ro || lock ? '' : '<button class="btn ghost-dark sm" id="sxAdd">' + ICON.plus + 'เพิ่มตอน</button>') + '</div>';
      secs.forEach(function (s, i) {
        h += '<div class="card secedit" data-i="' + i + '"><div class="se-h"><span class="se-n">' + (i + 1) + '</span><input class="se-t" data-f="title" maxlength="160" value="' + esc(s.title) + '" placeholder="ชื่อตอน">' +
          '<select data-f="type"' + (lock && s.secId || ro ? ' disabled' : '') + '>' + ['PROFILE', 'THEORY', 'PRACTICAL'].map(function (t) { return '<option value="' + t + '"' + (s.type === t ? ' selected' : '') + '>' + TYPE_TH[t] + '</option>'; }).join('') + '</select>' +
          '<label class="se-m"><input type="number" data-f="minutes" min="1" max="300" value="' + s.minutes + '"> นาที</label><span class="se-x"><button class="icon-btn dark" data-mv="-1" title="เลื่อนขึ้น"' + (i === 0 ? ' disabled' : '') + '>↑</button><button class="icon-btn dark" data-mv="1" title="เลื่อนลง"' + (i === secs.length - 1 ? ' disabled' : '') + '>↓</button>' +
          (lock || ro ? '' : '<button class="icon-btn dark" data-rm="1" title="ลบตอน">×</button>') + '</span></div><label class="se-l">คำชี้แจงที่ผู้เข้าสอบเห็น<textarea data-f="instructions" rows="2" maxlength="4000">' + esc(s.instructions) + '</textarea></label>';
        if (s.type !== 'PRACTICAL') h += '<div class="se-l">ชุดข้อสอบที่ใช้ในตอนนี้</div>' + setChips(s, i) + (s.type === 'THEORY' ? '<label class="chk"><input type="checkbox" data-f="shuffle"' + (s.shuffle ? ' checked' : '') + '> สลับลำดับข้อปรนัยไม่เหมือนกันในแต่ละคน (ข้อถูก/ผิด จับคู่ เรียงลำดับ เติมคำ อยู่ต้นตอน · ข้อที่กรรมการตรวจอยู่ท้ายเสมอ)</label><p class="muted sm">คะแนนเต็มของตอนนี้ = ' + secMax(s) + ' (รวมจากข้อสอบในชุดที่เลือก)</p>' : '<p class="muted sm">ตอนนี้ไม่คิดคะแนน ใช้เป็นข้อมูลประกอบการสัมภาษณ์</p>');
        else h += '<div class="se-l">ไฟล์โจทย์ (.xlsx)</div><div class="tplrow">' + ICON.file + '<span>' + (s.hasTemplate ? esc(s.tplName) : '<b class="bad-t">ยังไม่มีไฟล์โจทย์</b>') + '</span>' + (s.secId ? (ro ? '' : '<label class="btn ghost-dark sm">อัปโหลดไฟล์โจทย์' + (s.hasTemplate ? 'ใหม่' : '') + '<input type="file" accept=".xlsx" hidden data-tpl="' + esc(s.secId) + '"></label>') : '<small class="muted">บันทึกการตั้งค่าก่อน จึงอัปโหลดไฟล์ได้</small>') + '</div>' +
          '<div class="se-l">เกณฑ์ให้คะแนน (กรรมการให้คะแนนตามหัวข้อเหล่านี้) — รวม ' + secMax(s) + ' คะแนน</div><table class="tbl rub-e"><thead><tr><th>หัวข้อ</th><th class="r">คะแนนเต็ม</th><th>แนวทางให้คะแนน</th><th></th></tr></thead><tbody>' +
          (s.rubric || []).map(function (r, j) { return '<tr data-j="' + j + '"><td><input data-r="label" maxlength="120" value="' + esc(r.label) + '"></td><td class="r"><input data-r="max" type="number" min="0" max="100" step="0.5" value="' + r.max + '"></td><td><textarea data-r="guide" rows="2" maxlength="1500">' + esc(r.guide || '') + '</textarea></td><td>' + (ro ? '' : '<button class="icon-btn dark" data-rr="' + j + '" title="ลบหัวข้อ">×</button>') + '</td></tr>'; }).join('') +
          '</tbody></table>' + (ro ? '' : '<button class="btn link" data-ra="1">' + ICON.plus + 'เพิ่มหัวข้อ</button>');
        h += '</div>';
      });
      h += ro ? '' : '<div class="savebar"><button class="btn primary lg" id="sxSave">บันทึกการตั้งค่า</button>' + (lock ? '' : '<button class="btn link danger-t" id="sxDel">ลบรอบสอบนี้</button>') + '</div>';
      keepScroll(function () { $('#tab').innerHTML = h; }); bind();
    }
    function pull() {   // อ่านค่าจากหน้าจอกลับเข้าตัวแปร
      $$('.secedit').forEach(function (card) {
        var s = secs[+card.dataset.i];
        $$('[data-f]', card).forEach(function (x) { s[x.dataset.f] = x.type === 'checkbox' ? x.checked : x.type === 'number' ? Number(x.value) : x.value; });
        if (s.type !== 'PRACTICAL') { var cb = $$('[data-set]', card); if (cb.length) { var on = cb.filter(function (x) { return x.checked; }).map(function (x) { return x.value; }); s.sets = s.sets.filter(function (id) { return on.indexOf(id) >= 0; }).concat(on.filter(function (id) { return s.sets.indexOf(id) < 0; })); } var sq = $('[data-sq]', card); if (sq) s._q = sq.value; }
        $$('.rub-e tbody tr', card).forEach(function (tr) { var r = s.rubric[+tr.dataset.j]; $$('[data-r]', tr).forEach(function (x) { r[x.dataset.r] = x.dataset.r === 'max' ? Number(x.value) : x.value; }); });
      });
      ex.title = val('sxT'); ex.posId = val('sxPos'); ex.passPct = Number(val('sxPass')); ex.examDate = val('sxD'); ex.place = val('sxP'); ex.note = val('sxN'); ex.blind = $('#sxBlind').checked;
      $$('tr[data-cm]').forEach(function (tr) { ex.duties[tr.dataset.cm] = $$('.cm-d', tr).filter(function (x) { return x.checked; }).map(function (x) { return x.value; }); });
      if ($('#sxIv')) ex.ivOn = $('#sxIv').checked;
      if ($('#sxIvW')) ex.ivWeight = Math.max(0, Math.min(100, Number(val('sxIvW')) || 0));
      $$('.ivi-e tbody tr').forEach(function (tr) { var x = ex.ivItems[+tr.dataset.j]; $$('[data-iv]', tr).forEach(function (el) { x[el.dataset.iv] = el.dataset.iv === 'max' ? Number(el.value) : el.value; }); });
    }
    function bind() {
      $$('.secedit').forEach(function (card) {
        var i = +card.dataset.i, s = secs[i];
        $$('[data-mv]', card).forEach(function (b) { b.onclick = function () { pull(); var j = i + Number(b.dataset.mv), t = secs[i]; secs[i] = secs[j]; secs[j] = t; draw(); }; });
        var rm = $('[data-rm]', card); if (rm) rm.onclick = function () { pull(); secs.splice(i, 1); draw(); };
        var ty = $('[data-f=type]', card); ty.onchange = function () { pull(); s.sets = []; if (s.type === 'PRACTICAL' && !(s.rubric || []).length) s.rubric = [{ label: 'งานที่ 1', max: 10, guide: '' }]; draw(); };
        $$('[data-set]', card).forEach(function (x) { x.onchange = function () { pull(); draw(); }; });
        $$('[data-unset]', card).forEach(function (x) { x.onclick = function () { pull(); s.sets = s.sets.filter(function (id) { return id !== x.dataset.unset; }); draw(); }; });
        var sq = $('[data-sq]', card); if (sq) { sq.oninput = function () { setFilter(card); }; setFilter(card); }
        $$('[data-rr]', card).forEach(function (b) { b.onclick = function () { pull(); s.rubric.splice(+b.dataset.rr, 1); draw(); }; });
        var ra = $('[data-ra]', card); if (ra) ra.onclick = function () { pull(); (s.rubric = s.rubric || []).push({ label: '', max: 5, guide: '' }); draw(); };
        $$('[data-r=max]', card).forEach(function (x) { x.onchange = function () { pull(); draw(); }; });
        var tp = $('[data-tpl]', card); if (tp) tp.onchange = function () {
          var f = tp.files[0]; if (!f) return; if (!/\.xlsx$/i.test(f.name)) return toast('ไฟล์โจทย์ต้องเป็น .xlsx', 'bad');
          toast('กำลังอัปโหลดไฟล์โจทย์…'); fileB64(f).then(function (b64) { return api('uploadTemplate', { secId: tp.dataset.tpl, name: f.name, b64: b64 }, { timeout: 180000 }); }).then(function () { toast('อัปโหลดไฟล์โจทย์แล้ว', 'ok'); s.hasTemplate = true; s.tplName = f.name; AD.at = 0; BD.at = 0; pull(); draw(); }).catch(function (e) { toast(e.message, 'bad'); });
        };
      });
      if ($('#sxCmQ')) { $('#sxCmQ').oninput = cmSearch; }
      $$('.cm-x').forEach(function (b) { b.onclick = function () { pull(); var code = b.closest('tr').dataset.cm; ex.committee = ex.committee.filter(function (c) { return c !== code; }); delete ex.duties[code]; draw(); }; });
      if ($('#sxIv')) $('#sxIv').onchange = function () { pull(); draw(); };
      if ($('#sxIvW')) $('#sxIvW').oninput = function () { var w = Math.max(0, Math.min(100, Number(this.value) || 0)); $('#sxIvT').textContent = 'สอบ ' + (100 - w) + ' : สัมภาษณ์ ' + w; $('#sxIvB').style.width = (100 - w) + '%'; };
      $$('[data-ivr]').forEach(function (b) { b.onclick = function () { pull(); ex.ivItems.splice(+b.dataset.ivr, 1); draw(); }; });
      $$('.ivi-e [data-iv=max]').forEach(function (x) { x.onchange = function () { pull(); draw(); }; });
      if ($('#sxIvA')) $('#sxIvA').onclick = function () { pull(); ex.ivItems.push({ label: '', max: 10 }); draw(); };
      if ($('#sxAdd')) $('#sxAdd').onclick = function () { pull(); secs.push({ type: 'THEORY', title: 'ตอนที่ ' + (secs.length + 1), minutes: 30, sets: [], shuffle: true, instructions: '', rubric: [] }); draw(); };
      if ($('#sxSave')) $('#sxSave').onclick = function () {
        pull(); var b = this, none = ex.committee.filter(function (c) { return !(ex.duties[c] || []).length; });
        if (none.length) return toast('มีกรรมการ ' + none.length + ' ท่านที่ยังไม่ได้เลือกหน้าที่ — ติ๊กอย่างน้อย 1 หน้าที่ หรือนำออกจากรายชื่อ', 'bad', 8000);
        busy(b, true, 'กำลังบันทึก…');
        api('saveExam', { exam: ex, sections: secs.map(function (s) { var o = {}; Object.keys(s).forEach(function (k) { if (k.charAt(0) !== '_') o[k] = s[k]; }); return o; }) }).then(function () { toast('บันทึกการตั้งค่าแล้ว', 'ok'); AD.at = 0; TG.home = null; BD.at = 0; return loadBoard(); }).then(function () { if (BD.tab === 'setup') tabSetup(); }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); });
      };
      if ($('#sxDel')) $('#sxDel').onclick = function () { askPass('ลบรอบสอบ', '<div class="note bad">รอบสอบ ตอนสอบ และรายชื่อผู้เข้าสอบของรอบนี้จะถูกลบถาวร</div>', 'ลบรอบสอบ').then(function (r) { if (r) api('deleteExam', { examId: ex.examId, password: r.password }).then(function () { toast('ลบรอบสอบแล้ว', 'ok'); AD.at = 0; TG.home = null; BD.data = null; location.hash = '#/staff'; }).catch(function (e) { toast(e.message, 'bad'); }); }); };
    }
    draw();
  }).catch(function (e) { toast(e.message, 'bad'); });
}

/* ====================== ผู้เข้าสอบ (แท็บในกระดาน) ====================== */
/** ชื่อ-สกุลรูปแบบเดียวกันทั้งระบบ: "คำนำหน้า ชื่อ นามสกุล" เว้นวรรคเดียว */
function nameClean(s) { var n = splitName(s); return [n.title, n.first, n.last].filter(String).join(' '); }
/** ตาราง (จาก Excel/CSV/วาง) → รายชื่อผู้สมัคร · มีแถวหัวตารางหรือไม่มีก็ได้ */
function rowsToCands(rows) {
  var norm = function (x) { return String(x === undefined || x === null ? '' : x).replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim(); };
  rows = rows.map(function (r) { return r.map(norm); }).filter(function (r) { return r.some(String); });
  if (!rows.length) return [];
  var hi = -1, map = null;
  for (var i = 0; i < Math.min(rows.length, 8); i++) if (rows[i].some(function (x) { return /^(ชื่อ|ชื่อ\s*-?\s*(นาม)?สกุล|ชื่อและนามสกุล|name|full\s*name)$/i.test(x); })) { hi = i; break; }
  if (hi >= 0) {
    map = {};
    rows[hi].forEach(function (h, j) {
      var x = h.toLowerCase(), k = /^(เลขประจำตัว|เลขที่สอบ|เลขสอบ|ลำดับ|ที่$|no\.?$|#$)/.test(x) ? 'no' : /^คำนำหน้า|^title/.test(x) ? 'title' : /^(ชื่อ\s*-?\s*(นาม)?สกุล|ชื่อและนามสกุล|full\s*name|name)$/.test(x) ? 'name' : /^(ชื่อ|first)/.test(x) ? 'first' : /^(นามสกุล|สกุล|last|surname)/.test(x) ? 'last' :
        /อีเมล|e-?mail/.test(x) ? 'email' : /โทร|เบอร์|มือถือ|phone|mobile/.test(x) ? 'phone' : /ห้อง|room/.test(x) ? 'room' : /หมายเหตุ|note|remark/.test(x) ? 'note' : /สถานะ|status/.test(x) ? 'status' : null;
      if (k && map[k] === undefined) map[k] = j;
    });
  }
  return rows.slice(hi + 1).map(function (r) {
    var o = { no: '', name: '', email: '', phone: '', room: '', note: '', status: 'ACTIVE' }, g = function (k) { return map && map[k] !== undefined ? (r[map[k]] || '') : ''; };
    if (map) {
      o.no = g('no'); o.name = g('name') || [g('title'), g('first'), g('last')].filter(String).join(' '); o.email = g('email'); o.phone = g('phone'); o.room = g('room'); o.note = g('note');
      if (/สละ/.test(g('status'))) o.status = 'WITHDRAWN'; else if (/ขาด/.test(g('status'))) o.status = 'ABSENT'; else if (/ระงับ/.test(g('status'))) o.status = 'BLOCKED';
    } else {
      var cells = r.filter(String), rest = [];
      if (cells.length === 1) { var m = cells[0].match(/^(\d{1,6})[.)]?\s+(.+)$/); if (m) cells = [m[1], m[2]]; }
      cells.forEach(function (c, j) {
        if (j === 0 && /^\d{1,6}[.)]?$/.test(c) && cells.length > 1) o.no = c.replace(/\D/g, '');
        else if (/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(c)) o.email = c;
        else if (/^[0๐-๙\d][\d๐-๙\- ]{8,12}$/.test(c)) o.phone = c;
        else rest.push(c);
      });
      o.name = rest.join(' ');
    }
    if (/สละสิทธิ์/.test(o.name)) { o.status = 'WITHDRAWN'; o.name = o.name.replace(/\(?\s*สละสิทธิ์\s*\)?/g, ' '); }
    if (/ขาดสอบ/.test(o.name)) { o.status = 'ABSENT'; o.name = o.name.replace(/\(?\s*ขาดสอบ\s*\)?/g, ' '); }
    o.no = String(o.no || '').replace(/^0+(?=\d)/, '').replace(/\.0+$/, ''); o.name = nameClean(o.name); o.email = o.email.replace(/\s/g, '');
    o.err = !o.name ? 'ไม่มีชื่อ' : o.name.length < 4 ? 'ชื่อสั้นผิดปกติ' : o.email && !/^[^@\s<>"']+@[^@\s<>"']+\.[A-Za-z]{2,}$/.test(o.email) ? 'อีเมลไม่ถูกต้อง' : '';
    return o;
  }).filter(function (o) { return o.name || o.no || o.email; });
}
function candSort(list, how) {
  if (how === 'none') return list.slice();
  var key = function (o) { var n = splitName(o.name); return { g: how === 'fm' ? (n.female ? 0 : n.title ? 1 : 2) : 0, f: n.first, l: n.last }; };
  return list.map(function (o) { return { o: o, k: key(o) }; }).sort(function (a, b) { return a.k.g - b.k.g || thCmp(a.k.f, b.k.f) || thCmp(a.k.l, b.k.l); }).map(function (x) { return x.o; });
}
function tabCands() {
  var ro = readonly();
  function load() { return api('getCandidates', { examId: BD.id }).then(function (r) { AD.cands = r; if (BD.tab === 'cands' && TG.view === 'board') draw(); }).catch(function (e) { toast(e.message, 'bad'); }); }
  function draw() {
    var r = AD.cands, list = r.candidates, act = list.filter(function (c) { return c.status === 'ACTIVE'; }).length, rooms = uniq(list.map(function (c) { return c.room; })).sort(thCmp), noMail = list.filter(function (c) { return c.status === 'ACTIVE' && !c.email; }).length;
    if (AD.room && rooms.indexOf(AD.room) < 0) AD.room = '';
    var h = '<div class="card"><div class="card-head"><div><h2 class="card-t">รายชื่อผู้เข้าสอบ</h2><p class="card-s">ทั้งหมด ' + list.length + ' คน · มีสิทธิ์สอบ ' + act + ' คน' + (rooms.length ? ' · ' + rooms.length + ' ห้องสอบ' : '') + (noMail ? ' · ยังไม่มีอีเมล ' + noMail + ' คน' : '') + ' · รหัสเข้าสอบ 6 หลักใช้ได้เฉพาะรอบนี้และเฉพาะช่วงที่สถานะเป็น "เปิดสอบ"</p></div></div><div class="acts cdbar">' +
      (ro ? '' : '<button class="btn primary sm" id="cdImp">' + ICON.up + 'นำเข้ารายชื่อ</button><button class="btn ghost-dark sm" id="cdAdd">' + ICON.plus + 'เพิ่มรายคน</button><button class="btn ghost-dark sm" id="cdRoom">แบ่งห้องสอบ</button><button class="btn ghost-dark sm" id="cdDocs">' + ICON.up + 'อัปโหลดเอกสารหลายคน</button>') +
      '<span class="sp"></span><button class="btn ghost-dark sm" id="cdShow">' + (AD.showCodes ? 'ซ่อนรหัส' : 'แสดงรหัส') + '</button><button class="btn ghost-dark sm" id="cdPrint">' + ICON.print + 'ใบรหัสเข้าสอบ</button><button class="btn ghost-dark sm" id="cdCheck">' + ICON.print + 'ใบลงชื่อเข้าสอบ</button><button class="btn ghost-dark sm" id="cdCsv">' + ICON.down + 'ส่งออก</button>' + (ro ? '' : '<button class="btn ghost-dark sm" id="cdRegen">ออกรหัสใหม่ทั้งรอบ</button>') + '</div>';
    if (!list.length) h += '<div class="empty"><h3>ยังไม่มีรายชื่อ</h3><p class="muted">กด "นำเข้ารายชื่อ" แล้วเลือกไฟล์ Excel ตามแม่แบบ หรือวางรายชื่อจาก Excel — ระบบจะเรียงชื่อและออกเลขประจำตัวสอบ 001, 002, … ให้เอง</p></div>';
    else h += '<div class="inrow cdflt"><input id="cdQ" class="srch" placeholder="ค้นหาเลขประจำตัวสอบ ชื่อ หรืออีเมล" autocomplete="off">' + (rooms.length ? '<select id="cdRm"><option value="">ทุกห้องสอบ</option>' + rooms.map(function (x) { return '<option' + (x === AD.room ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>' : '') + '<span class="muted sm" id="cdN"></span></div>' +
      '<div class="tblwrap"><table class="tbl cdtbl"><thead><tr><th>เลขประจำตัวสอบ</th><th>ชื่อ-สกุล</th><th>รหัสเข้าสอบ</th><th>สถานะ</th>' + (rooms.length ? '<th>ห้องสอบ</th>' : '') + '<th>อีเมล / โทรศัพท์</th><th>เอกสาร</th><th>หมายเหตุ</th><th>เข้าระบบล่าสุด</th><th></th></tr></thead><tbody>' + list.map(function (c) {
        return '<tr data-no="' + esc(c.examNo) + '" data-room="' + esc(c.room) + '" data-q="' + esc((no3(c.examNo) + ' ' + c.name + ' ' + c.email).toLowerCase()) + '" class="' + (c.status !== 'ACTIVE' ? 'off' : '') + '"><td><b class="cno">' + esc(no3(c.examNo)) + '</b></td><td>' + esc(c.name) + '</td><td><code class="code">' + (AD.showCodes ? esc(c.code) : '••••••') + '</code></td><td><select class="cd-st"' + (ro ? ' disabled' : '') + '>' + Object.keys(CS_TH).map(function (k) { return '<option value="' + k + '"' + (c.status === k ? ' selected' : '') + '>' + CS_TH[k] + '</option>'; }).join('') + '</select>' + (c.iv ? '<span class="tag info">สัมภาษณ์</span>' : '') + '</td>' +
          (rooms.length ? '<td>' + esc(c.room) + '</td>' : '') + '<td class="sm">' + (c.email ? esc(c.email) : '<span class="muted">ไม่มีอีเมล</span>') + (c.phone ? '<br><span class="muted">' + esc(c.phone) + '</span>' : '') + '</td><td class="nowrap"><button class="btn link cd-doc">' + (c.nDocs ? c.nDocs + ' ไฟล์' : 'เพิ่ม') + '</button></td><td class="sm">' + esc(c.note) + '</td><td class="sm">' + (c.lastLogin ? tDate(c.lastLogin) : '<span class="muted">–</span>') + '</td><td class="nowrap">' +
          (ro ? '' : '<button class="btn link cd-ed">แก้ไข</button><button class="btn link cd-rg">รหัสใหม่</button>' + (c.hasAttempts ? '' : '<button class="btn link danger-t cd-del">ลบ</button>')) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    keepScroll(function () { $('#tab').innerHTML = h + '</div>'; });
    var find = function (no) { return list.filter(function (c) { return c.examNo === no; })[0]; };
    function flt() {
      var q = $('#cdQ') ? $('#cdQ').value.trim().toLowerCase() : '', n = 0; AD.candQ = q;
      $$('tr[data-no]').forEach(function (tr) { var ok = (!q || tr.dataset.q.indexOf(q) >= 0) && (!AD.room || tr.dataset.room === AD.room); tr.hidden = !ok; if (ok) n++; });
      if ($('#cdN')) $('#cdN').textContent = n === list.length ? '' : 'แสดง ' + n + ' จาก ' + list.length + ' คน';
    }
    if ($('#cdQ')) { $('#cdQ').value = AD.candQ || ''; $('#cdQ').oninput = flt; flt(); }
    if ($('#cdRm')) $('#cdRm').onchange = function () { AD.room = this.value; flt(); };
    var scope = function () { return { exam: r.exam, candidates: list.filter(function (c) { return !AD.room || c.room === AD.room; }) }; };
    $('#cdShow').onclick = function () { AD.showCodes = !AD.showCodes; draw(); };
    $('#cdPrint').onclick = function () { printSlips(scope()); };
    $('#cdCheck').onclick = function () { printSignSheet(scope()); };
    $('#cdCsv').onclick = function () {
      var go = function () { saveCsv('TalentGate_Candidates_' + r.exam.examId + '.csv', [['เลขประจำตัวสอบ', 'ชื่อ-สกุล', 'สถานะ', 'ห้องสอบ', 'อีเมล', 'โทรศัพท์', 'หมายเหตุ'].concat(AD.showCodes ? ['รหัสเข้าสอบ'] : [])].concat(list.map(function (c) { return [no3(c.examNo), c.name, CS_TH[c.status], c.room, c.email, c.phone, c.note].concat(AD.showCodes ? [c.code] : []); }))); };
      if (AD.showCodes) confirmBox('ส่งออกรายชื่อพร้อมรหัสเข้าสอบ', '<div class="note warn">ขณะนี้เปิด "แสดงรหัส" อยู่ ไฟล์ที่ส่งออกจะมี<b>รหัสเข้าสอบ</b>ของทุกคน — เก็บไฟล์เป็นความลับ (กด "ซ่อนรหัส" ก่อนถ้าไม่ต้องการ)</div>', 'ส่งออกพร้อมรหัส').then(function (y) { if (y) go(); }); else go();
    };
    if ($('#cdImp')) $('#cdImp').onclick = importBox;
    if ($('#cdRoom')) $('#cdRoom').onclick = roomBox;
    if ($('#cdDocs')) $('#cdDocs').onclick = function () { docsBulkBox(function () { if (BD.tab === 'cands') load(); }); };
    if ($('#cdAdd')) $('#cdAdd').onclick = function () { editBox(null); };
    if ($('#cdRegen')) $('#cdRegen').onclick = function () { askPass('ออกรหัสเข้าสอบใหม่ทั้งรอบ', '<div class="note bad">รหัสเดิมของทุกคนจะใช้ไม่ได้ ต้องพิมพ์ใบรหัสใหม่ทั้งหมด และผู้ที่เข้าระบบอยู่จะถูกออกจากระบบ</div>', 'ออกรหัสใหม่').then(function (x) { if (x) api('regenCodes', { examId: BD.id, password: x.password }).then(function (q) { toast('ออกรหัสใหม่ ' + q.n + ' คน', 'ok'); load(); }).catch(function (e) { toast(e.message, 'bad'); }); }); };
    $$('tr[data-no]').forEach(function (tr) {
      var c = find(tr.dataset.no), st = $('.cd-st', tr);
      st.onchange = function () { api('saveCandidate', { examId: BD.id, examNo: c.examNo, name: c.name, status: st.value, note: c.note }).then(function () { toast('เปลี่ยนสถานะเลขประจำตัวสอบ ' + no3(c.examNo) + ' เป็น "' + CS_TH[st.value] + '" แล้ว', 'ok'); BD.at = 0; c.status = st.value; tr.className = st.value !== 'ACTIVE' ? 'off' : ''; load(); }).catch(function (e) { st.value = c.status; toast(e.message, 'bad'); }); };
      $('.cd-doc', tr).onclick = function () { docsBox(c.examNo, function () { if (BD.tab === 'cands') load(); }); };
      if ($('.cd-ed', tr)) $('.cd-ed', tr).onclick = function () { editBox(c); };
      if ($('.cd-rg', tr)) $('.cd-rg', tr).onclick = function () { askPass('ออกรหัสใหม่ของเลขประจำตัวสอบ ' + no3(c.examNo), '<p>รหัสเดิมจะใช้ไม่ได้ทันที ใช้เมื่อผู้เข้าสอบทำใบรหัสหายหรือสงสัยว่ารหัสรั่วไหล</p>', 'ออกรหัสใหม่').then(function (x) { if (x) api('regenCodes', { examId: BD.id, examNo: c.examNo, password: x.password }).then(function () { AD.showCodes = true; toast('ออกรหัสใหม่แล้ว', 'ok'); load(); }).catch(function (e) { toast(e.message, 'bad'); }); }); };
      if ($('.cd-del', tr)) $('.cd-del', tr).onclick = function () { confirmBox('ลบผู้เข้าสอบ', '<p>ลบเลขประจำตัวสอบ ' + esc(no3(c.examNo)) + ' ' + esc(c.name) + ' ออกจากรอบนี้</p><p class="muted">เลขประจำตัวสอบของคนอื่นไม่เปลี่ยน</p>', 'ลบ', true).then(function (y) { if (y) api('deleteCandidate', { examId: BD.id, examNo: c.examNo }).then(function () { toast('ลบแล้ว', 'ok'); BD.at = 0; TG.home = null; load(); }).catch(function (e) { toast(e.message, 'bad'); }); }); };
    });
  }
  function editBox(c) {
    var next = AD.cands.candidates.reduce(function (m, x) { return Math.max(m, Number(x.examNo) || 0); }, 0) + 1;
    var b = modal('<h2>' + (c ? 'แก้ไขผู้เข้าสอบ' : 'เพิ่มผู้เข้าสอบ') + '</h2><form class="form" id="ceF"><div class="row2"><label>เลขประจำตัวสอบ<input id="ceNo" maxlength="12" required value="' + esc(c ? no3(c.examNo) : no3(next)) + '"' + (c ? ' disabled' : '') + '></label><label>สถานะ<select id="ceS">' + Object.keys(CS_TH).map(function (k) { return '<option value="' + k + '"' + (c && c.status === k ? ' selected' : '') + '>' + CS_TH[k] + '</option>'; }).join('') + '</select></label></div>' +
      '<label>ชื่อ-สกุล (คำนำหน้า ชื่อ นามสกุล)<input id="ceN" maxlength="160" required value="' + esc(c ? c.name : '') + '"' + (c ? '' : ' autofocus') + '></label><div class="row2"><label>อีเมล<input id="ceE" type="email" maxlength="160" value="' + esc(c ? c.email : '') + '"></label><label>โทรศัพท์<input id="ceP" maxlength="40" value="' + esc(c ? c.phone : '') + '"></label></div>' +
      '<div class="row2"><label>ห้องสอบ / รอบ<input id="ceR" maxlength="60" value="' + esc(c ? c.room : '') + '" list="ceRL"><datalist id="ceRL">' + uniq(AD.cands.candidates.map(function (x) { return x.room; })).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist></label><label>หมายเหตุ<input id="ceT" maxlength="300" value="' + esc(c ? c.note : '') + '"></label></div><div class="modal-act"><button type="button" class="btn ghost-dark" id="ceX">ยกเลิก</button><button class="btn primary" id="ceB">บันทึก</button></div></form>');
    $('#ceX', b).onclick = closeModal;
    $('#ceF', b).onsubmit = function (e) { e.preventDefault(); var bt = $('#ceB', b); busy(bt, true, 'กำลังบันทึก…'); api('saveCandidate', { examId: BD.id, examNo: c ? c.examNo : val('ceNo', b), name: nameClean(val('ceN', b)), status: val('ceS', b), note: val('ceT', b), email: val('ceE', b), phone: val('ceP', b), room: val('ceR', b) }).then(function () { closeModal(); toast('บันทึกแล้ว', 'ok'); BD.at = 0; TG.home = null; load(); }).catch(function (er) { busy(bt, false); toast(er.message, 'bad'); }); };
  }
  /** แบ่งห้องสอบ/รอบสอบ: กำหนดชื่อห้องและจำนวนที่นั่ง ระบบจัดผู้มีสิทธิ์สอบลงห้องตามลำดับเลขประจำตัวสอบ */
  function roomBox() {
    var act = AD.cands.candidates.filter(function (c) { return c.status === 'ACTIVE'; });
    if (!act.length) return toast('ยังไม่มีผู้มีสิทธิ์สอบ', 'bad');
    var b = modal('<h2>แบ่งห้องสอบ / รอบสอบ</h2><p class="muted">ผู้มีสิทธิ์สอบ <b>' + act.length + '</b> คน — พิมพ์ชื่อห้อง (หรือรอบ) และจำนวนที่นั่ง บรรทัดละ 1 ห้อง ระบบจะจัดลงตามลำดับเลขประจำตัวสอบ · ใช้กรองหน้าติดตามสอบ พิมพ์ใบลงชื่อและใบรหัสแยกห้อง</p>' +
      '<textarea id="rmT" rows="5" placeholder="ห้องประชุมลีลาวดี 3 = 40&#10;ห้องคอมพิวเตอร์ ชั้น 5 = 35"></textarea><div id="rmP" class="imprev"></div><div class="modal-act"><button class="btn ghost-dark" id="rmX">ยกเลิก</button><button class="btn primary" id="rmS" disabled>จัดห้องสอบ</button></div>', { cls: 'lg' });
    var plan = [];
    $('#rmX', b).onclick = closeModal;
    $('#rmT', b).oninput = function () {
      plan = this.value.split(/\n/).map(function (l) { var m = l.match(/^(.*?)[=:\t,]\s*(\d+)\s*(คน|ที่นั่ง)?\s*$/); return m && m[1].trim() ? { room: m[1].trim().slice(0, 60), n: Number(m[2]) } : null; }).filter(Boolean);
      var cap = plan.reduce(function (a, x) { return a + x.n; }, 0), i = 0;
      $('#rmP', b).innerHTML = plan.length ? '<p class="' + (cap >= act.length ? 'ok-t' : 'bad-t') + '">' + plan.length + ' ห้อง รวม ' + cap + ' ที่นั่ง' + (cap < act.length ? ' — ยังขาดอีก ' + (act.length - cap) + ' ที่นั่ง' : '') + '</p><ul class="rmlist">' + plan.map(function (x) { var a = act.slice(i, i + x.n); i += x.n; return '<li><b>' + esc(x.room) + '</b> — ' + (a.length ? a.length + ' คน: เลขประจำตัวสอบ ' + no3(a[0].examNo) + ' ถึง ' + no3(a[a.length - 1].examNo) : 'ไม่มีผู้เข้าสอบ') + '</li>'; }).join('') + '</ul>' : '<p class="muted sm">รูปแบบ: ชื่อห้อง = จำนวนที่นั่ง</p>';
      $('#rmS', b).disabled = !plan.length || cap < act.length;
    };
    $('#rmS', b).onclick = function () {
      var bt = this, i = 0, rows = [];
      plan.forEach(function (x) { act.slice(i, i + x.n).forEach(function (c) { rows.push({ examNo: c.examNo, name: c.name, status: c.status, note: c.note, room: x.room }); }); i += x.n; });
      busy(bt, true, 'กำลังจัดห้อง…');
      api('importCandidates', { examId: BD.id, rows: rows }).then(function () { closeModal(); toast('จัดห้องสอบแล้ว ' + rows.length + ' คน', 'ok'); BD.at = 0; load(); }).catch(function (e) { busy(bt, false); toast(e.message, 'bad'); });
    };
  }
  /** นำเข้ารายชื่อ: ไฟล์ตามแม่แบบ หรือวางจาก Excel → ระบบเรียงชื่อ (ไม่สนคำนำหน้า) และออกเลขประจำตัวสอบ → ตรวจตัวอย่าง → ยืนยัน */
  function importBox() {
    var cur = AD.cands.candidates, draft = AD.cands.exam.status === 'DRAFT', anyAtt = cur.some(function (c) { return c.hasAttempts; }), canRep = draft && !anyAtt && cur.length > 0;
    var raw = [], out = [], maxNo = cur.reduce(function (m, x) { return Math.max(m, Number(x.examNo) || 0); }, 0), have = {}; cur.forEach(function (c) { have[nameKey(c.name)] = c; });
    var b = modal('<h2>นำเข้ารายชื่อผู้เข้าสอบ</h2><ol class="impsteps"><li><b>เตรียมรายชื่อ</b> ตามแม่แบบ (คอลัมน์: คำนำหน้า · ชื่อ · นามสกุล · อีเมล · โทรศัพท์ — ไม่ต้องใส่เลขประจำตัวสอบ) <a class="btn ghost-dark sm" href="TalentGate_Candidates_Template.xlsx" download>' + ICON.down + 'แม่แบบรายชื่อ (Excel)</a></li>' +
      '<li><b>เลือกไฟล์</b> .xlsx หรือ .csv <label class="btn primary sm">' + ICON.up + 'เลือกไฟล์<input type="file" id="imF" accept=".xlsx,.csv,.tsv,.txt" hidden></label> <span class="muted sm">หรือคัดลอกจาก Excel มาวาง (มีหรือไม่มีแถวหัวตารางก็ได้ · แบบเดิม "เลข [แท็บ] ชื่อ-สกุล" ก็ใช้ได้)</span><textarea id="imT" rows="3" placeholder="วางรายชื่อที่คัดลอกจาก Excel ที่นี่ (Ctrl+V)"></textarea></li>' +
      '<li><b>เลขประจำตัวสอบ</b><div class="optrow"><label class="chk"><input type="radio" name="imNum" value="auto" checked> ให้ระบบเรียงชื่อและออกเลขให้ (001, 002, …)</label><select id="imSort"><option value="th">เรียง ก–ฮ ตามชื่อ (ไม่สนคำนำหน้า)</option><option value="fm">หญิงก่อน แล้วชาย (ก–ฮ ในแต่ละกลุ่ม) ตามแบบประกาศเดิม</option><option value="none">ตามลำดับในไฟล์</option></select></div>' +
      '<div class="optrow"><label class="chk"><input type="radio" name="imNum" value="file"> ใช้เลขประจำตัวสอบที่อยู่ในไฟล์</label></div></li>' +
      (cur.length ? '<li><b>รอบนี้มีรายชื่ออยู่แล้ว ' + cur.length + ' คน</b><div class="optrow"><label class="chk"><input type="radio" name="imMode" value="add" checked> เพิ่มต่อจากรายชื่อเดิม (เลขถัดจาก ' + no3(maxNo) + ' · ชื่อที่มีอยู่แล้วจะถูกข้าม)</label></div>' +
        '<div class="optrow"><label class="chk"><input type="radio" name="imMode" value="rep"' + (canRep ? '' : ' disabled') + '> แทนที่รายชื่อทั้งรอบ และจัดเลขใหม่ตั้งแต่ 001' + (canRep ? ' (ผู้ที่ชื่อตรงกับของเดิมจะคงรหัสเข้าสอบและอีเมลเดิม · ต้องยืนยันรหัสผ่าน)' : ' — ทำได้เฉพาะรอบสอบสถานะ "ร่าง" ที่ยังไม่มีผู้เริ่มสอบ') + '</label></div></li>' : '') +
      '</ol><div id="imP" class="imprev"></div><div class="modal-act"><button class="btn ghost-dark" id="imX">ยกเลิก</button><button class="btn primary" id="imS" disabled>ยืนยันรายชื่อและนำเข้า</button></div>', { cls: 'xl' });
    function opt(n) { var x = $('[name=' + n + ']:checked', b); return x ? x.value : ''; }
    function build() {
      var auto = opt('imNum') === 'auto', rep = opt('imMode') === 'rep', sort = $('#imSort', b).value, seenNo = {}, seenName = {};
      $('#imSort', b).disabled = !auto;
      var list = raw.map(function (o) { var x = {}; Object.keys(o).forEach(function (k) { x[k] = o[k]; }); x.skip = ''; return x; });
      list.forEach(function (o) {
        var k = nameKey(o.name);
        if (!o.err && seenName[k]) o.skip = 'ชื่อซ้ำในไฟล์';
        else if (!o.err && auto && !rep && have[k]) o.skip = 'มีอยู่แล้ว (เลข ' + no3(have[k].examNo) + ')';
        seenName[k] = 1;
      });
      var use = list.filter(function (o) { return !o.err && !o.skip; });
      if (auto) { use = candSort(use, sort); var n = rep ? 0 : maxNo; use.forEach(function (o) { o.no = String(++n); }); }
      else use.forEach(function (o) { if (!o.no) o.err = 'ไม่มีเลขประจำตัวสอบในไฟล์'; else if (!/^[0-9A-Za-z-]{1,12}$/.test(o.no)) o.err = 'เลขประจำตัวสอบไม่ถูกต้อง'; else if (seenNo[o.no]) o.err = 'เลขประจำตัวสอบซ้ำ'; seenNo[o.no] = 1; });
      out = use.filter(function (o) { return !o.err; });
      var bad = list.filter(function (o) { return o.err; }), skip = list.filter(function (o) { return o.skip; }), upd = auto ? 0 : out.filter(function (o) { return cur.some(function (c) { return c.examNo === o.no; }); }).length;
      var show = (auto ? out : out.slice().sort(function (a, c) { return Number(a.no) - Number(c.no); })).concat(bad, skip);
      $('#imP', b).innerHTML = !list.length ? '' : '<p class="' + (bad.length ? 'bad-t' : 'ok-t') + '">อ่านได้ ' + list.length + ' คน · <b>พร้อมนำเข้า ' + out.length + ' คน</b>' + (upd ? ' (แก้ไขข้อมูลของเลขที่มีอยู่แล้ว ' + upd + ' คน)' : '') + (bad.length ? ' · <b>ผิดรูปแบบ ' + bad.length + ' แถว</b> (แก้ในไฟล์แล้วเลือกใหม่)' : '') + (skip.length ? ' · ข้าม ' + skip.length + ' คน' : '') + ' · มีอีเมล ' + out.filter(function (o) { return o.email; }).length + ' คน</p>' +
        '<div class="tblwrap tall"><table class="tbl sm"><thead><tr><th>เลขประจำตัวสอบ</th><th>คำนำหน้า</th><th>ชื่อ</th><th>นามสกุล</th><th>อีเมล</th><th>โทรศัพท์</th><th>ห้องสอบ</th><th>ตรวจ</th></tr></thead><tbody>' + show.map(function (o) {
          var n = splitName(o.name);
          return '<tr class="' + (o.err ? 'badrow' : o.skip ? 'off' : '') + '"><td><b>' + (o.err || o.skip ? '–' : esc(no3(o.no))) + '</b></td><td>' + esc(n.title) + '</td><td>' + esc(n.first) + '</td><td>' + esc(n.last) + '</td><td>' + esc(o.email) + '</td><td>' + esc(o.phone) + '</td><td>' + esc(o.room) + '</td><td>' + (o.err ? '<b class="bad-t">' + esc(o.err) + '</b>' : o.skip ? '<span class="muted">ข้าม: ' + esc(o.skip) + '</span>' : o.status !== 'ACTIVE' ? CS_TH[o.status] : !n.last ? '<span class="tag warn">ไม่มีนามสกุล?</span>' : !n.title ? '<span class="tag warn">ไม่มีคำนำหน้า</span>' : '<span class="ok-t">ถูกต้อง</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      $('#imS', b).disabled = !out.length || bad.length > 0;
      $('#imS', b).textContent = out.length && !bad.length ? (rep ? 'แทนที่รายชื่อทั้งรอบด้วย ' : 'ยืนยันและนำเข้า ') + out.length + ' คน' : 'ยืนยันรายชื่อและนำเข้า';
    }
    function show(rows) { raw = rowsToCands(rows); if (!raw.length) { $('#imP', b).innerHTML = '<p class="bad-t">อ่านรายชื่อไม่ได้ — ตรวจว่ามีคอลัมน์ชื่อ และไม่ได้เลือกชีตว่าง</p>'; $('#imS', b).disabled = true; return; } if (raw.every(function (o) { return o.no; }) && !cur.length && !$('#imT', b)._auto) { /* ไฟล์มีเลขมาให้ครบ: ยังคงให้ระบบเรียงใหม่เป็นค่าเริ่มต้น ผู้ใช้เลือก "ใช้เลขในไฟล์" เองได้ */ } build(); }
    $('#imX', b).onclick = closeModal;
    $('#imT', b).oninput = function () { show(parseDelimited(this.value)); };
    $('#imF', b).onchange = function () {
      var f = this.files[0]; if (!f) return; this.value = '';
      $('#imP', b).innerHTML = '<p class="muted"><i class="spin dark"></i> กำลังอ่านไฟล์ ' + esc(f.name) + '…</p>';
      (/\.xlsx$/i.test(f.name) ? readXlsx(f, 'รายชื่อ') : f.text().then(function (t) { return parseDelimited(t); })).then(show).catch(function (e) { $('#imP', b).innerHTML = '<p class="bad-t">' + esc(e.message) + '</p>'; });
    };
    $$('[name=imNum],[name=imMode]', b).forEach(function (x) { x.onchange = build; }); $('#imSort', b).onchange = build;
    $('#imS', b).onclick = function () {
      var bt = this, rep = opt('imMode') === 'rep', rows = out.map(function (o) { return { examNo: o.no, name: o.name, status: o.status, note: o.note, email: o.email, phone: o.phone, room: o.room }; });
      var done = function (r) { closeModal(); toast(rep ? 'จัดรายชื่อใหม่ ' + r.n + ' คนเรียบร้อย' : 'เพิ่ม ' + r.added + ' คน' + (r.updated ? ' · แก้ไข ' + r.updated + ' คน' : ''), 'ok'); BD.at = 0; TG.home = null; BD.docs = null; load(); loadBoard(true); };
      if (rep) return askPass('แทนที่รายชื่อทั้งรอบ', '<div class="note warn">รายชื่อเดิม ' + cur.length + ' คนจะถูกแทนที่ด้วยรายชื่อใหม่ ' + rows.length + ' คน และ<b>เลขประจำตัวสอบจะถูกจัดใหม่ทั้งหมด</b> — ใบรหัสหรือประกาศที่พิมพ์ไปแล้วต้องพิมพ์ใหม่</div>', 'แทนที่รายชื่อ').then(function (p) { if (!p) return; busy(bt, true, 'กำลังนำเข้า…'); api('replaceCandidates', { examId: BD.id, rows: rows, password: p.password }, { timeout: 120000 }).then(done).catch(function (e) { busy(bt, false); toast(e.message, 'bad', 9000); }); });
      busy(bt, true, 'กำลังนำเข้า…'); api('importCandidates', { examId: BD.id, rows: rows }, { timeout: 120000 }).then(done).catch(function (e) { busy(bt, false); toast(e.message, 'bad', 9000); });
    };
  }
  if (AD.cands && AD.cands.exam.examId === BD.id) draw(); else $('#tab').innerHTML = '<div class="boot"><div class="boot-ring"></div></div>';
  load();
}
function printSlips(r) {
  var url = location.origin + location.pathname, list = r.candidates.filter(function (c) { return c.status === 'ACTIVE'; });
  if (!list.length) return toast('ไม่มีผู้มีสิทธิ์สอบ', 'bad');
  printLogged('ใบรหัสเข้าสอบ ' + list.length + ' คน' + (AD.room ? ' (' + AD.room + ')' : ''), '<div class="slips">' + list.map(function (c) {
    return '<div class="slip"><div class="slip-h"><b>SOMDEJ TalentGate</b><span>ใบรหัสเข้าสอบ</span></div><p class="slip-e">' + esc(r.exam.title) + '</p><p class="slip-d">' + esc(r.exam.examDate) + (c.room ? ' · ' + esc(c.room) : r.exam.place ? ' · ' + esc(r.exam.place) : '') + '</p>' +
      '<div class="slip-r"><div><small>เลขประจำตัวสอบ</small><b>' + esc(no3(c.examNo)) + '</b></div><div><small>รหัสเข้าสอบ</small><b class="mono">' + esc(c.code.replace(/(\d{3})(\d{3})/, '$1 $2')) + '</b></div></div><p class="slip-n">' + esc(c.name) + '</p>' +
      '<p class="slip-u">เข้าสอบที่ <b>' + esc(url.replace(/^https?:\/\//, '')) + '</b> › ผู้เข้าสอบ</p><p class="slip-w">ห้ามเปิดเผยรหัสนี้แก่ผู้อื่น · รหัสใช้ได้เฉพาะในวันสอบ · โปรดคืนใบนี้แก่กรรมการเมื่อสอบเสร็จ</p></div>';
  }).join('') + '</div>', { portrait: true });
}
function printSignSheet(r) {
  var list = r.candidates.filter(function (c) { return c.status === 'ACTIVE'; }), rooms = uniq(list.map(function (c) { return c.room; })).sort(thCmp), groups = rooms.length ? rooms.map(function (x) { return { room: x, list: list.filter(function (c) { return c.room === x; }) }; }) : [];
  var rest = list.filter(function (c) { return !c.room; }); if (rest.length) groups.push({ room: '', list: rest });
  if (!list.length) return toast('ไม่มีผู้มีสิทธิ์สอบ', 'bad');
  printLogged('ใบลงชื่อผู้เข้าสอบ' + (AD.room ? ' (' + AD.room + ')' : ''), groups.map(function (g, gi) {
    return '<section class="pr' + (gi === groups.length - 1 ? '' : ' pr-break') + '">' + prHead('ใบลงชื่อผู้เข้าสอบ', [r.exam.title, (r.exam.examDate || '') + (g.room ? ' · ' + g.room : r.exam.place ? ' · ' + r.exam.place : ''), 'จำนวน ' + g.list.length + ' คน']) +
      '<table class="pr-t pr-sg"><thead><tr><th class="c w-n">ที่</th><th class="c w-no">เลขประจำตัวสอบ</th><th>ชื่อ-สกุล</th><th class="c" style="width:44mm">ลายมือชื่อผู้เข้าสอบ</th><th class="c" style="width:20mm">เวลาที่มาถึง</th><th style="width:30mm">หมายเหตุ</th></tr></thead><tbody>' +
      g.list.map(function (c, i) { return '<tr><td class="c">' + (i + 1) + '</td><td class="c">' + esc(no3(c.examNo)) + '</td><td>' + esc(c.name) + '</td><td></td><td></td><td></td></tr>'; }).join('') + '</tbody></table>' +
      '<div class="pr-signline"><p>มาสอบ ............ คน · ขาดสอบ ............ คน</p><p>ลงชื่อ ............................................................ กรรมการคุมสอบ</p><p>( ............................................................ )</p></div></section>';
  }).join(''), { portrait: true });
}

/* ====================== คลังข้อสอบ ======================
   เข้าได้เฉพาะผู้ดูแลระบบและผู้ออกข้อสอบ · ต้องยืนยันรหัสผ่านทุกครั้งที่เข้า (หมดอายุเองเมื่อไม่ใช้งาน 20 นาที)
   ชุดข้อสอบจัดเป็นโฟลเดอร์ ฝ่าย › ตำแหน่ง · ทุกการเปิดดู แก้ไข พิมพ์ ส่งออก ถูกบันทึกในประวัติ */
function bankLock() { AD.bankToken = null; AD.bank = null; AD.qs = null; }
/** ออกจากหน้าคลังข้อสอบ = ล็อกคลังทันที (ครั้งต่อไปต้องยืนยันรหัสผ่านใหม่) */
function bankLeave(parts) { if (AD.bankToken && !(parts[0] === 'admin' && parts[1] === 'bank')) bankLock(); }
function bapi(action, payload, opt) {
  payload = payload || {}; payload.bankToken = AD.bankToken;
  return api(action, payload, opt).catch(function (e) {
    if (/^BANK_LOCKED/.test(e.message)) { bankLock(); if (TG.view === 'admin' && $('.bankwrap')) viewBank(); throw new Error('คลังข้อสอบถูกล็อกเพราะไม่ได้ใช้งานเกิน 20 นาที กรุณายืนยันรหัสผ่านอีกครั้ง'); }
    throw e;
  });
}
function qTypesOf(group) { return Object.keys(QT).filter(function (t) { return QT[t].g === group; }); }
function viewBank(setId) {
  if (setId) AD.setId = setId;
  var who = isAdmin() ? 'ผู้ดูแลระบบ' : 'ผู้ออกข้อสอบ';
  /* ---------- ด่านยืนยันรหัสผ่าน ---------- */
  if (!AD.bankToken) {
    $('#app').innerHTML = '<div class="wrap bankwrap"><div class="card bankgate"><div class="bg-ic">' + ICON.lock + '</div><h1>คลังข้อสอบ</h1><p class="muted">พื้นที่เก็บข้อสอบและเฉลย — เข้าได้เฉพาะผู้ดูแลระบบและผู้ออกข้อสอบที่ได้รับสิทธิ์ · กรุณายืนยันรหัสผ่านของท่านทุกครั้งที่เข้า</p>' +
      '<form class="form" id="bgF"><label>รหัสผ่านของท่าน (' + esc(TG.me.name) + ')<input id="bgP" type="password" autocomplete="current-password" required autofocus></label><button class="btn primary lg" id="bgB">' + ICON.lock + 'ยืนยันและเข้าคลังข้อสอบ</button></form>' +
      '<p class="muted sm">ระบบบันทึกทุกครั้งที่มีการเข้าคลัง เปิดดูชุดข้อสอบ แก้ไข พิมพ์ หรือส่งออก พร้อมชื่อผู้ทำและเวลา · คลังจะล็อกเองเมื่อออกจากหน้านี้ หรือไม่ได้ใช้งาน 20 นาที</p></div></div>';
    $('#bgF').onsubmit = function (e) {
      e.preventDefault(); var b = $('#bgB'); busy(b, true, 'กำลังตรวจสอบ…');
      api('openBank', { password: $('#bgP').value }).then(function (r) { AD.bankToken = r.bankToken; viewBank(); }).catch(function (er) { busy(b, false); toast(er.message, 'bad'); var p = $('#bgP'); if (p) { p.value = ''; p.focus(); } });
    };
    return;
  }
  function folderTh(f) { return String(f).split('/').join(' › '); }
  function side() {
    var bk = AD.bank, q = (AD.bankQ || '').toLowerCase(), folders = {};
    bk.sets.forEach(function (s) { if (!q || (s.name + ' ' + s.folder + ' ' + (s.note || '') + ' ' + s.setId).toLowerCase().indexOf(q) >= 0) (folders[s.folder] = folders[s.folder] || []).push(s); });
    var keys = Object.keys(folders).sort(thCmp), cur = bk.sets.filter(function (s) { return s.setId === AD.setId; })[0];
    return keys.length ? keys.map(function (f) {
      var l = folders[f].sort(function (a, b) { return thCmp(a.name, b.name); }), open = q || (cur && cur.folder === f) || keys.length <= 3;
      return '<details class="bk-f"' + (open ? ' open' : '') + '><summary><b>' + esc(folderTh(f)) + '</b><small>' + l.length + ' ชุด</small></summary>' + l.map(function (s) {
        return '<a class="bk-s' + (s.setId === AD.setId ? ' on' : '') + (s.active ? '' : ' off') + '" href="#/admin/bank/' + encodeURIComponent(s.setId) + '"><b>' + esc(s.name) + '</b><i>' + (s.group === 'P' ? 'ทัศนคติ/บุคลิกภาพ' : 'คิดคะแนน') + ' · ' + s.n + ' ข้อ' + (s.pts ? ' · ' + s.pts + ' คะแนน' : '') + (s.active ? '' : ' · ปิดใช้งาน') + '</i></a>';
      }).join('') + '</details>';
    }).join('') : '<p class="muted sm">' + (q ? 'ไม่พบชุดข้อสอบที่ตรงกับ "' + esc(AD.bankQ) + '"' : 'ยังไม่มีชุดข้อสอบ') + '</p>';
  }
  function openSet(id) { AD.setId = id; AD.qs = null; AD.bank = null; var h = '#/admin/bank/' + encodeURIComponent(id); if (location.hash === h) viewBank(); else location.hash = h; }
  function shell() {
    var bk = AD.bank;
    if (!AD.setId || !bk.sets.some(function (s) { return s.setId === AD.setId; })) AD.setId = bk.sets.length ? bk.sets.slice().sort(function (a, b) { return thCmp(a.folder, b.folder) || thCmp(a.name, b.name); })[0].setId : null;
    $('#app').innerHTML = '<div class="wrap bankwrap"><div class="phead"><div><span class="eyebrow">' + who + '</span><h1>คลังข้อสอบ</h1><p class="muted">จัดข้อสอบเป็นชุด เก็บในโฟลเดอร์ ฝ่าย › ตำแหน่ง แล้วเลือกชุดไปใช้ในรอบสอบที่หน้า "ตั้งค่ารอบสอบ"' + (bk.isAdmin ? '' : ' · ท่านมีสิทธิ์ในโฟลเดอร์: <b>' + bk.scope.map(function (x) { return esc(folderTh(x)); }).join(', ') + '</b>') + '</p></div><div class="acts"><button class="btn ghost-dark" id="bkLock">' + ICON.lock + 'ล็อกคลัง</button><a class="btn ghost-dark" href="TalentGate_Import_Template.xlsx" download>' + ICON.down + 'แม่แบบนำเข้า (Excel)</a><button class="btn ghost-dark" id="bkImp">' + ICON.up + 'นำเข้าข้อสอบทั้งชุด</button><button class="btn primary" id="bkNew">' + ICON.plus + 'สร้างชุดข้อสอบ</button></div></div>' +
      '<div class="bank"><aside class="card bk-side"><input id="bkQ" class="srch" placeholder="ค้นหาชุดข้อสอบ ตำแหน่ง หรือฝ่าย" value="' + esc(AD.bankQ || '') + '" autocomplete="off"><div id="bkTree">' + side() + '</div></aside><div id="bkMain"></div></div></div>';
    $('#bkQ').oninput = function () { AD.bankQ = this.value.trim(); $('#bkTree').innerHTML = side(); };
    $('#bkLock').onclick = function () { bankLock(); toast('ล็อกคลังข้อสอบแล้ว', 'ok'); viewBank(); };
    $('#bkNew').onclick = function () { setBox(null); };
    $('#bkImp').onclick = function () { importQBox(null, function (r) { openSet(r.setId); }); };
    loadQs();
  }
  function reload() { return bapi('getBank').then(function (r) { AD.bank = r; AD.at = 0; if (TG.view === 'admin' && $('.bankwrap')) shell(); }).catch(function (e) { toast(e.message, 'bad'); }); }
  function refreshSide() { return bapi('getBank').then(function (r) { AD.bank = r; AD.at = 0; if ($('#bkTree')) $('#bkTree').innerHTML = side(); }).catch(function () { }); }
  function folderList() { var bk = AD.bank, a = uniq(bk.sets.map(function (s) { return s.folder; })); bk.positions.forEach(function (p) { var f = [p.dept, p.name].filter(String).join('/'); if (f && a.indexOf(f) < 0) a.push(f); }); if (!bk.isAdmin) a = a.filter(function (f) { return bk.scope.some(function (x) { return x === '*' || f === x || f.indexOf(x + '/') === 0; }); }).concat(bk.scope.filter(function (x) { return x !== '*' && a.indexOf(x) < 0; })); return a.sort(thCmp); }
  function setBox(s) {
    var fl = folderList(), grp = s ? s.group : 'T';
    var b = modal('<h2>' + (s ? 'แก้ไขชุดข้อสอบ' : 'สร้างชุดข้อสอบ') + '</h2><form class="form" id="sbF"><label>ชื่อชุด<input id="sbN" maxlength="160" required value="' + esc(s ? s.name : '') + '" placeholder="เช่น ความรู้เฉพาะตำแหน่ง ชุดที่ 1" autofocus></label>' +
      '<label>โฟลเดอร์ (ฝ่าย/ตำแหน่ง — คั่นระดับด้วย / ไม่เกิน 4 ระดับ)<input id="sbFd" maxlength="200" required list="sbFL" value="' + esc(s ? s.folder : (fl[0] || '')) + '" placeholder="เช่น ฝ่ายเวชศาสตร์ชันสูตร/นักเทคนิคการแพทย์"><datalist id="sbFL">' + fl.map(function (f) { return '<option value="' + esc(f) + '">'; }).join('') + '</datalist></label>' +
      '<div class="row2"><label>กลุ่มข้อสอบ<select id="sbG"' + (s ? ' disabled' : '') + '><option value="T"' + (grp === 'T' ? ' selected' : '') + '>ข้อสอบคิดคะแนน (ภาคทฤษฎี)</option><option value="P"' + (grp === 'P' ? ' selected' : '') + '>ทัศนคติ / บุคลิกภาพ (ไม่คิดคะแนน)</option></select></label>' +
      '<label>ใช้ได้กับ<select id="sbK"><option value="POSITION"' + (!s || s.kind === 'POSITION' ? ' selected' : '') + '>เฉพาะตำแหน่ง</option><option value="CENTRAL"' + (s && s.kind === 'CENTRAL' ? ' selected' : '') + '>ทุกตำแหน่ง (ชุดกลาง)</option></select></label></div><label>หมายเหตุ<input id="sbT" maxlength="300" value="' + esc(s ? s.note : '') + '"></label>' +
      (s ? '<label class="chk"><input type="checkbox" id="sbA"' + (s.active ? ' checked' : '') + '> เปิดใช้งาน (ให้เลือกในรอบสอบใหม่ได้)</label>' : '<p class="muted sm">ชุดเดียวมีข้อสอบได้หลายชนิดปนกัน (ปรนัย ถูก/ผิด จับคู่ เติมคำ ข้อเขียน ฯลฯ) — เลือกชนิดตอนเพิ่มแต่ละข้อ</p>') + '<div class="modal-act"><button type="button" class="btn ghost-dark" id="sbX">ยกเลิก</button><button class="btn primary" id="sbS">บันทึก</button></div></form>');
    $('#sbX', b).onclick = closeModal;
    $('#sbF', b).onsubmit = function (e) {
      e.preventDefault(); var bt = $('#sbS', b); busy(bt, true, 'กำลังบันทึก…');
      bapi('saveSet', { setId: s ? s.setId : '', name: val('sbN', b), kind: val('sbK', b), qtype: s ? s.qtype : (val('sbG', b) === 'P' ? 'SJT' : 'MCQ'), folder: val('sbFd', b), note: val('sbT', b), active: s ? $('#sbA', b).checked : true })
        .then(function (r) { closeModal(); toast('บันทึกชุดข้อสอบแล้ว', 'ok'); openSet(r.setId); }).catch(function (er) { busy(bt, false); toast(er.message, 'bad'); });
    };
  }
  function main() {
    var r = AD.qs, s = r.set, qs = r.questions, pts = qs.filter(function (q) { return q.active; }).reduce(function (a, q) { return a + q.points; }, 0), nOn = qs.filter(function (q) { return q.active; }).length, kinds = {};
    qs.forEach(function (q) { kinds[q.type] = (kinds[q.type] || 0) + 1; });
    var h = '<div class="card"><div class="card-head"><div><p class="bk-path">' + esc(folderTh(s.folder)) + '</p><span class="tag ' + (s.kind === 'CENTRAL' ? 'info' : '') + '">' + (s.kind === 'CENTRAL' ? 'ชุดกลาง' : 'ชุดเฉพาะตำแหน่ง') + '</span> <span class="tag">' + (s.group === 'P' ? 'ทัศนคติ/บุคลิกภาพ (ไม่คิดคะแนน)' : 'ข้อสอบคิดคะแนน') + '</span>' + (s.inUse ? ' <span class="tag warn">ใช้ในรอบที่มีผู้สอบแล้ว</span>' : '') + (s.active ? '' : ' <span class="tag bad">ปิดใช้งาน</span>') +
      '<h2 class="card-t mt6">' + esc(s.name) + '</h2><p class="card-s" id="bkSum">เลือกใช้ <b>' + nOn + '</b> จาก ' + qs.length + ' ข้อ' + (pts ? ' · ' + pts + ' คะแนน' : '') + (s.note ? ' · ' + esc(s.note) : '') + '</p><p class="muted sm">' + Object.keys(kinds).map(function (k) { return qtName(k) + ' ' + kinds[k]; }).join(' · ') + '</p></div><div class="acts">' +
      '<button class="btn ghost-dark sm" id="bkEd">' + ICON.edit + 'แก้ไขชุด</button><button class="btn ghost-dark sm" id="bkIm2">' + ICON.up + 'นำเข้าเพิ่มในชุดนี้</button><button class="btn ghost-dark sm" id="bkEx">' + ICON.down + 'ส่งออก (CSV)</button><button class="btn ghost-dark sm" id="bkPr">' + ICON.print + 'พิมพ์พร้อมเฉลย</button><button class="btn primary sm" id="bkAdd">' + ICON.plus + 'เพิ่มข้อ</button></div></div>' +
      (qs.length ? '<div class="selbar"><span class="muted sm">สวิตช์หน้าข้อ = เลือกใช้ข้อนั้นในรอบสอบที่เลือกชุดนี้ (ข้อที่ปิดจะไม่ออกสอบและไม่นับคะแนน)</span><span class="acts"><button class="btn link" id="bkAll">เลือกทั้งหมด</button><button class="btn link" id="bkNone">ไม่เลือกทั้งหมด</button></span></div>' : '') +
      (s.inUse ? '<div class="note warn">ชุดนี้ถูกใช้ในรอบสอบที่มีผู้เข้าสอบทำแล้ว การแก้เฉลยจะมีผลต่อคะแนนเมื่อกด "ตรวจข้อที่ระบบตรวจใหม่" ในหน้าสรุปผลของรอบนั้น</div>' : '') + '</div>';
    if (!qs.length) h += '<div class="card empty"><h3>ชุดนี้ยังไม่มีข้อสอบ</h3><p class="muted">กด "เพิ่มข้อ" เพื่อพิมพ์ทีละข้อ หรือ "นำเข้าเพิ่มในชุดนี้" เพื่อนำเข้าจากแม่แบบ Excel</p></div>';
    qs.forEach(function (q, i) {
      h += '<article class="card bq' + (q.active ? '' : ' off') + '" data-q="' + esc(q.qId) + '"><header><label class="sw sm" title="เลือกใช้ข้อนี้"><input type="checkbox" class="bq-on"' + (q.active ? ' checked' : '') + '><i></i></label><span class="qn">ข้อ ' + (i + 1) + '</span><span class="tag info">' + esc(qtName(q.type)) + '</span>' + (q.cat ? '<span class="tag">' + esc(q.cat) + '</span>' : '') + (q.points ? '<span class="qp">' + q.points + ' คะแนน</span>' : '') + '<span class="tag bad bq-offtag"' + (q.active ? ' hidden' : '') + '>ไม่ใช้ข้อนี้</span><span class="bq-id">' + esc(q.qId) + '</span>' +
        '<button class="btn link bq-ed">' + ICON.edit + 'แก้ไข</button><button class="btn link danger-t bq-del">ลบ</button></header><div class="qt">' + qTextHtml(q) + '</div>' + qKeyHtml(q) + '<p class="bq-ref"><b>ที่มา:</b> ' + (q.ref ? esc(q.ref) : '<span class="bad-t">ยังไม่ได้ระบุ</span>') + '</p></article>';
    });
    keepScroll(function () { $('#bkMain').innerHTML = h + '<div class="savebar float" id="bkSave" hidden><span id="bkChg"></span><button class="btn ghost-dark sm" id="bkUndo">ยกเลิก</button><button class="btn primary" id="bkDo">บันทึกการเลือกข้อสอบ</button></div>'; });
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
    $('#bkDo').onclick = function () { var b = this; busy(b, true, 'กำลังบันทึก…'); bapi('setQuestionsActive', { setId: s.setId, active: pending() }).then(function (x) { toast('บันทึกการเลือกแล้ว ' + x.n + ' ข้อ', 'ok'); BD.at = 0; loadQs(true); refreshSide(); }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); }); };
    $('#bkIm2').onclick = function () { importQBox(s, function () { loadQs(true); refreshSide(); }); };
    $('#bkEx').onclick = function () { bapi('logBank', { setId: s.setId, what: 'export' }, { quiet: true }).then(function () { saveCsv('TalentGate_Bank_' + s.setId + '.csv', [IMP_HEAD].concat(qs.map(qToRow))); toast('ส่งออกแล้ว (บันทึกในประวัติ) — เปิดด้วย Excel แก้ไข แล้วนำเข้ากลับได้ด้วยแม่แบบเดียวกัน', 'ok', 6000); }).catch(function (e) { toast(e.message, 'bad'); }); };
    $('#bkEd').onclick = function () { setBox(s); };
    $('#bkAdd').onclick = function () { qBox(null, s); };
    $('#bkPr').onclick = function () {
      var b = this; busy(b, true, 'กำลังเตรียม…');
      bapi('logBank', { setId: s.setId, what: 'print' }, { quiet: true }).then(function () {
        busy(b, false); var on = qs.filter(function (q) { return q.active; });
        printDoc('<section class="pr bankpr"><div class="pr-draft">เอกสารลับ · ข้อสอบพร้อมเฉลย</div>' + prHead(s.name, [folderTh(s.folder), on.length + ' ข้อ' + (pts ? ' · ' + pts + ' คะแนน' : '')]) + on.map(function (q, i) {
          return '<div class="pq"><p class="pq-h"><b>ข้อ ' + (i + 1) + '</b> · ' + esc(qtName(q.type)) + (q.cat ? ' · ' + esc(q.cat) : '') + (q.points ? ' · ' + q.points + ' คะแนน' : '') + ' <small>' + esc(q.qId) + '</small></p><div class="qt">' + qTextHtml(q) + '</div>' + qKeyHtml(q) + '<p class="pref">ที่มา: ' + esc(q.ref || '-') + '</p></div>';
        }).join('') + '</section>', { portrait: true, title: 'ข้อสอบพร้อมเฉลย — ' + s.name });
      }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); });
    };
    $$('.bq').forEach(function (card) {
      var q = qs.filter(function (x) { return x.qId === card.dataset.q; })[0];
      $('.bq-ed', card).onclick = function () { qBox(q, s); };
      $('.bq-del', card).onclick = function () { confirmBox('ลบข้อสอบ', '<p>ลบ ' + esc(q.qId) + ' ออกจากคลังถาวร</p>', 'ลบ', true).then(function (y) { if (y) bapi('deleteQuestion', { setId: s.setId, qId: q.qId }).then(function () { toast('ลบแล้ว', 'ok'); loadQs(true); refreshSide(); }).catch(function (e) { toast(e.message, 'bad'); }); }); };
    });
  }
  /** แบบฟอร์มข้อสอบ 1 ข้อ — รองรับทุกชนิดในกลุ่มของชุด (เปลี่ยนชนิดได้จากช่อง "ชนิดข้อสอบ") */
  function qBox(q, s) {
    var types = qTypesOf(s.group), last = sess('tg_qtype'), t = q ? q.type : (types.indexOf(last) >= 0 ? last : types[0]);
    var st = { rows: [], extra: '', lines: '', fill: [], cols: '', trows: '', corner: '', rev: false };
    function init() {
      var ch = q ? q.choices : null, ans = q ? String(q.answer || '') : '', k = ans.split(',');
      st.rows = []; st.extra = ''; st.lines = ''; st.fill = []; st.cols = ''; st.trows = ''; st.corner = ''; st.rev = false;
      if (!q || q.type !== t) { if (t === 'MCQ' || t === 'MULTI' || t === 'SJT') st.rows = [{}, {}, {}, {}]; else if (t === 'TF') st.rows = [{ k: 'T' }, { k: 'T' }, { k: 'T' }]; else if (t === 'MATCH') st.rows = [{}, {}, {}]; else if (t === 'MBTI') st.rows = [{}, {}]; return; }
      if (t === 'MCQ' || t === 'MULTI') st.rows = ch.map(function (c, j) { return { a: c, k: k.indexOf(String(j + 1)) >= 0 }; });
      else if (t === 'TF') st.rows = ch.map(function (c, j) { return { a: c, k: k[j] === 'F' ? 'F' : 'T' }; });
      else if (t === 'SJT') st.rows = ch.map(function (c, j) { return { a: c, k: k[j] || '' }; });
      else if (t === 'MBTI') st.rows = ch.map(function (c) { var p = String(c).split('|'); return { k: p[0], a: p.slice(1).join('|') }; });
      else if (t === 'MATCH') { var used = {}; st.rows = (ch.l || []).map(function (c, j) { used[Number(k[j]) - 1] = 1; return { a: c, b: (ch.r || [])[Number(k[j]) - 1] || '' }; }); st.extra = (ch.r || []).filter(function (x, j) { return !used[j]; }).join('\n'); }
      else if (t === 'ORDER') st.lines = ch.join('\n');
      else if (t === 'FILL') { try { st.fill = JSON.parse(ans || '[]').map(function (a) { return (Array.isArray(a) ? a : [a]).join(' | '); }); } catch (e) { st.fill = []; } }
      else if (t === 'TABLE') { st.cols = (ch.cols || []).join('\n'); st.trows = (ch.rows || []).join('\n'); st.corner = ch.corner || ''; }
      else if (t === 'LIKERT') st.rev = ans === 'R';
    }
    init();
    var b = modal('<h2>' + (q ? 'แก้ไขข้อสอบ ' + esc(q.qId) : 'เพิ่มข้อสอบ') + '</h2><form class="form" id="qbF"><div class="row2"><label>ชนิดข้อสอบ<select id="qbTy">' + types.map(function (x) { return '<option value="' + x + '"' + (x === t ? ' selected' : '') + '>' + esc(qtName(x)) + (QT[x].auto ? ' — ระบบตรวจ' : QT[x].manual ? ' — กรรมการตรวจ' : '') + '</option>'; }).join('') + '</select></label>' +
      '<label><span id="qbCatL">หมวด/หัวข้อ</span><input id="qbCat" maxlength="120" value="' + esc(q ? q.cat : '') + '" list="qbCats"><datalist id="qbCats">' + uniq(AD.qs.questions.map(function (x) { return x.cat; })).map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></label></div>' +
      '<div class="row2"><label id="qbPL">คะแนน<input id="qbP" type="number" min="0.5" max="100" step="0.5" value="' + (q && q.points ? q.points : 1) + '"></label><label>ลำดับในชุด<input id="qbO" type="number" min="1" value="' + (q ? q.order : AD.qs.questions.length + 1) + '"></label></div>' +
      '<label><span id="qbTL">โจทย์</span><textarea id="qbT" rows="4" maxlength="6000" required>' + esc(q ? q.text : '') + '</textarea></label><div id="qbDyn"></div>' +
      '<label><span id="qbRL">คำอธิบายเฉลย</span><textarea id="qbR" rows="3" maxlength="6000">' + esc(q ? q.rubric : '') + '</textarea></label>' +
      '<label>ที่มา / แหล่งอ้างอิง<textarea id="qbRef" rows="2" maxlength="1000" required placeholder="เช่น ระเบียบสำนักนายกฯ ว่าด้วยงานสารบรรณ ข้อ 28 · ถ้าแต่งเองให้ระบุ “ผู้ออกข้อสอบแต่งขึ้นใหม่”">' + esc(q ? q.ref : '') + '</textarea></label>' +
      (q ? '<label class="chk"><input type="checkbox" id="qbA"' + (q.active ? ' checked' : '') + '> ใช้งานข้อนี้</label>' : '') + '<div class="modal-act"><button type="button" class="btn ghost-dark" id="qbX">ยกเลิก</button>' + (q ? '' : '<button type="button" class="btn ghost-dark" id="qbS2">บันทึกและเพิ่มข้อถัดไป</button>') + '<button class="btn primary" id="qbS">บันทึกข้อสอบ</button></div></form>', { cls: 'lg' });
    function pull() {
      $$('.qr', b).forEach(function (row) { var r = st.rows[+row.dataset.j]; if (!r) return; var a = $('.qr-a', row), bb = $('.qr-b', row), k = $('.qr-k', row); if (a) r.a = a.value; if (bb) r.b = bb.value; if (k) r.k = k.type === 'checkbox' || k.type === 'radio' ? k.checked : k.value; });
      var g = function (id) { var x = $('#' + id, b); return x ? x.value : null; };
      if (g('qbExtra') !== null) st.extra = g('qbExtra'); if (g('qbLines') !== null) st.lines = g('qbLines'); if (g('qbCols') !== null) { st.cols = g('qbCols'); st.trows = g('qbRows'); st.corner = g('qbCorner'); }
      if ($('#qbRev', b)) st.rev = $('#qbRev', b).checked;
      $$('.qf', b).forEach(function (x) { st.fill[+x.dataset.j] = x.value; });
    }
    function dyn() {
      var h = '', P = QT[t].g === 'P', max = { MCQ: 6, MULTI: 8, TF: 30, MATCH: 15 }[t], min = { MCQ: 2, MULTI: 2, TF: 1, MATCH: 2 }[t];
      var rm = function (j) { return max && st.rows.length > min ? '<button type="button" class="icon-btn dark qr-x" data-j="' + j + '" title="ลบแถวนี้">×</button>' : ''; };
      $('#qbPL', b).hidden = P; $('#qbCatL', b).textContent = t === 'SJT' || t === 'LIKERT' ? 'มิติที่วัด (จำเป็น)' : 'หมวด/หัวข้อ';
      $('#qbTL', b).textContent = t === 'FILL' ? 'โจทย์ — พิมพ์ขีดล่าง 4 ตัว ____ ตรงตำแหน่งที่ให้เติมคำ (มีได้หลายช่อง)' : t === 'LIKERT' ? 'ข้อความให้ประเมินตนเอง' : t === 'TF' ? 'คำสั่ง (เช่น จงพิจารณาว่าข้อความต่อไปนี้ถูกหรือผิด)' : t === 'MATCH' ? 'คำสั่ง (เช่น จงจับคู่ข้อความทางซ้ายกับคำตอบทางขวา)' : t === 'ORDER' ? 'คำสั่ง (เช่น จงเรียงลำดับขั้นตอนต่อไปนี้)' : 'โจทย์';
      $('#qbRL', b).textContent = QT[t].manual ? 'เกณฑ์ให้คะแนน / แนวคำตอบ (กรรมการเห็นขณะตรวจ' + (t === 'ESSAY' ? ' · จำเป็น' : '') + ')' : 'คำอธิบายเฉลย (ไม่บังคับ)';
      if (t === 'MCQ') h = '<div class="se-l">ตัวเลือก 2–6 ข้อ (เลือกวงกลมหน้าข้อที่เป็นเฉลย)</div>' + st.rows.map(function (r, j) { return '<div class="qc-row qr" data-j="' + j + '"><input type="radio" name="qbA" class="qr-k"' + (r.k ? ' checked' : '') + '><i>' + THX[j] + '</i><textarea class="qr-a" rows="1" maxlength="1000">' + esc(r.a || '') + '</textarea>' + rm(j) + '</div>'; }).join('');
      if (t === 'MULTI') h = '<div class="se-l">ตัวเลือก 2–8 ข้อ (ติ๊กทุกข้อที่เป็นคำตอบถูก — ผู้เข้าสอบต้องเลือกครบและถูกทุกข้อจึงได้คะแนน)</div>' + st.rows.map(function (r, j) { return '<div class="qc-row qr" data-j="' + j + '"><input type="checkbox" class="qr-k"' + (r.k ? ' checked' : '') + '><i>' + THX[j] + '</i><textarea class="qr-a" rows="1" maxlength="1000">' + esc(r.a || '') + '</textarea>' + rm(j) + '</div>'; }).join('');
      if (t === 'TF') h = '<div class="se-l">ข้อย่อย (คะแนนของข้อนี้แบ่งเท่ากันทุกข้อย่อย เช่น 10 ข้อย่อย 10 คะแนน = ข้อละ 1)</div>' + st.rows.map(function (r, j) { return '<div class="qc-row qr" data-j="' + j + '"><i>' + (j + 1) + '</i><textarea class="qr-a" rows="1" maxlength="1500">' + esc(r.a || '') + '</textarea><select class="qr-k"><option value="T"' + (r.k !== 'F' ? ' selected' : '') + '>ถูก</option><option value="F"' + (r.k === 'F' ? ' selected' : '') + '>ผิด</option></select>' + rm(j) + '</div>'; }).join('');
      if (t === 'MATCH') h = '<div class="se-l">คู่ที่ถูกต้อง (ซ้าย = ข้อความ · ขวา = คำตอบของข้อความนั้น) — ระบบเรียงตัวเลือกทางขวาใหม่ให้เอง</div>' + st.rows.map(function (r, j) { return '<div class="qc-row qr two" data-j="' + j + '"><i>' + (j + 1) + '</i><textarea class="qr-a" rows="1" maxlength="600" placeholder="ข้อความทางซ้าย">' + esc(r.a || '') + '</textarea><textarea class="qr-b" rows="1" maxlength="600" placeholder="คำตอบทางขวา">' + esc(r.b || '') + '</textarea>' + rm(j) + '</div>'; }).join('');
      if (max && st.rows.length < max) h += '<button type="button" class="btn link" id="qbAdd">' + ICON.plus + (t === 'TF' ? 'เพิ่มข้อย่อย' : t === 'MATCH' ? 'เพิ่มคู่' : 'เพิ่มตัวเลือก') + '</button>';
      if (t === 'MATCH') h += '<label>ตัวเลือกลวงทางขวา (ไม่บังคับ · บรรทัดละ 1 ตัวเลือก)<textarea id="qbExtra" rows="2" maxlength="2400">' + esc(st.extra) + '</textarea></label>';
      if (t === 'ORDER') h = '<label>รายการ — พิมพ์บรรทัดละ 1 รายการ <b>ตามลำดับที่ถูกต้อง</b> (2–12 รายการ · ผู้เข้าสอบจะเห็นลำดับสลับกัน)<textarea id="qbLines" rows="6" maxlength="7000">' + esc(st.lines) + '</textarea></label>';
      if (t === 'FILL') { var n = fillParts($('#qbT', b).value).length - 1; h = n ? '<div class="se-l">คำตอบที่ยอมรับของแต่ละช่อง (หลายคำตอบคั่นด้วย | เช่น 70% | 70 เปอร์เซ็นต์ · ระบบไม่สนช่องว่าง ตัวพิมพ์ และเครื่องหมายวรรคตอน)</div>' + Array.apply(null, Array(n)).map(function (x, j) { return '<div class="qc-row"><i>' + (j + 1) + '</i><input class="qf" data-j="' + j + '" maxlength="1200" value="' + esc(st.fill[j] || '') + '" placeholder="คำตอบของช่องที่ ' + (j + 1) + '"></div>'; }).join('') : '<div class="note warn">ยังไม่มีช่องว่างในโจทย์ — พิมพ์ขีดล่าง 4 ตัว ____ ตรงที่ต้องการให้เติมคำ</div>'; }
      if (t === 'TABLE') h = '<div class="row2"><label>หัวคอลัมน์ (บรรทัดละ 1 คอลัมน์ · ไม่เกิน 6)<textarea id="qbCols" rows="4" maxlength="800">' + esc(st.cols) + '</textarea></label><label>หัวแถว (บรรทัดละ 1 แถว · ไม่เกิน 12)<textarea id="qbRows" rows="4" maxlength="3800">' + esc(st.trows) + '</textarea></label></div><label>ข้อความมุมซ้ายบนของตาราง (ไม่บังคับ)<input id="qbCorner" maxlength="120" value="' + esc(st.corner) + '"></label><p class="muted sm">ผู้เข้าสอบพิมพ์คำตอบลงในแต่ละช่องของตาราง · กรรมการตรวจและให้คะแนนทั้งข้อ</p>';
      if (t === 'SJT') h = '<div class="se-l">ตัวเลือก 4 ข้อ และระดับความเหมาะสม (4 = เหมาะสมที่สุด · 1 = ควรซักถามเพิ่ม)</div>' + st.rows.map(function (r, j) { return '<div class="qc-row qr" data-j="' + j + '"><i>' + THX[j] + '</i><textarea class="qr-a" rows="2" maxlength="1000">' + esc(r.a || '') + '</textarea><select class="qr-k"><option value="">ระดับ</option>' + [4, 3, 2, 1].map(function (x) { return '<option' + (String(x) === String(r.k) ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>'; }).join('');
      if (t === 'MBTI') h = '<div class="se-l">ตัวเลือก 2 ข้อ (อักษรบุคลิกภาพ + ข้อความ)</div>' + st.rows.map(function (r, j) { return '<div class="qc-row qr" data-j="' + j + '"><input class="qr-k qb-k" maxlength="1" size="2" value="' + esc(r.k || '') + '" placeholder="' + (j ? 'E' : 'I') + '"><textarea class="qr-a" rows="2" maxlength="900">' + esc(r.a || '') + '</textarea></div>'; }).join('');
      if (t === 'LIKERT') h = '<label class="chk"><input type="checkbox" id="qbRev"' + (st.rev ? ' checked' : '') + '> ข้อความเชิงลบ — กลับคะแนน (ตอบ 5 ได้ 1)</label><p class="muted sm">ผู้เข้าสอบเลือกระดับ 1–5 (ไม่ตรงเลย … ตรงมากที่สุด) · ระบบสรุปค่าเฉลี่ยรายมิติเป็นจุดแข็ง/ประเด็นที่ควรซักถาม · ไม่คิดคะแนน</p>';
      if (t === 'SHORT') h = '<p class="muted sm">ผู้เข้าสอบพิมพ์คำตอบสั้น ๆ (ไม่เกิน 1,500 ตัวอักษร) · กรรมการตรวจและให้คะแนน</p>';
      $('#qbDyn', b).innerHTML = h;
      var add = $('#qbAdd', b); if (add) add.onclick = function () { pull(); st.rows.push(t === 'TF' ? { k: 'T' } : {}); dyn(); };
      $$('.qr-x', b).forEach(function (x) { x.onclick = function () { pull(); st.rows.splice(+x.dataset.j, 1); dyn(); }; });
    }
    dyn();
    $('#qbTy', b).onchange = function () { pull(); t = this.value; init(); dyn(); };
    $('#qbT', b).addEventListener('input', function () { if (t === 'FILL') { var n = fillParts(this.value).length - 1; if (n !== $$('.qf', b).length) { pull(); dyn(); } } });
    $('#qbX', b).onclick = closeModal;
    function payload() {
      pull();
      var lines = function (x) { return String(x || '').split(/\n/).map(function (y) { return y.trim(); }).filter(String); }, rows = st.rows.filter(function (r) { return String(r.a || '').trim() || String(r.b || '').trim(); });
      var p = { qId: q ? q.qId : '', setId: s.setId, type: t, cat: val('qbCat', b), text: val('qbT', b), choices: [], answer: '', points: QT[t].g === 'P' ? 0 : Number(val('qbP', b)), order: Number(val('qbO', b)) || 0, rubric: val('qbR', b), ref: val('qbRef', b), active: q ? $('#qbA', b).checked : true };
      if (t === 'MCQ') { p.choices = rows.map(function (r) { return r.a.trim(); }); p.answer = String(rows.map(function (r) { return !!r.k; }).indexOf(true) + 1 || ''); }
      else if (t === 'MULTI') { p.choices = rows.map(function (r) { return r.a.trim(); }); p.answer = rows.map(function (r, j) { return r.k ? j + 1 : 0; }).filter(Number).join(','); }
      else if (t === 'TF') { p.choices = rows.map(function (r) { return r.a.trim(); }); p.answer = rows.map(function (r) { return r.k === 'F' ? 'F' : 'T'; }).join(','); }
      else if (t === 'SJT') { p.choices = st.rows.map(function (r) { return String(r.a || '').trim(); }); p.answer = st.rows.map(function (r) { return r.k || ''; }).join(','); }
      else if (t === 'MBTI') p.choices = st.rows.map(function (r) { return String(r.k || '').trim().toUpperCase() + '|' + String(r.a || '').trim(); });
      else if (t === 'MATCH') {
        if (rows.some(function (r) { return !String(r.a || '').trim() || !String(r.b || '').trim(); })) throw new Error('ข้อจับคู่: แต่ละแถวต้องมีทั้งข้อความทางซ้ายและคำตอบทางขวา');
        var right = uniq(rows.map(function (r) { return r.b.trim(); }).concat(lines(st.extra))).sort(thCmp);
        p.choices = { l: rows.map(function (r) { return r.a.trim(); }), r: right }; p.answer = rows.map(function (r) { return right.indexOf(r.b.trim()) + 1; }).join(',');
      }
      else if (t === 'ORDER') p.choices = lines(st.lines);
      else if (t === 'FILL') p.answer = JSON.stringify(Array.apply(null, Array(fillParts(p.text).length - 1)).map(function (x, j) { return String(st.fill[j] || '').split('|').map(function (y) { return y.trim(); }).filter(String); }));
      else if (t === 'TABLE') p.choices = { cols: lines(st.cols), rows: lines(st.trows), corner: String(st.corner || '').trim() };
      else if (t === 'LIKERT') p.answer = st.rev ? 'R' : '';
      return p;
    }
    function save(again) {
      var p; try { p = payload(); } catch (er) { return toast(er.message, 'bad'); }
      var bt = $(again ? '#qbS2' : '#qbS', b); busy(bt, true, 'กำลังบันทึก…'); sess('tg_qtype', t);
      bapi('saveQuestion', p).then(function () { closeModal(); toast('บันทึกข้อสอบแล้ว', 'ok'); BD.at = 0; refreshSide(); return loadQs(true); }).then(function () { if (again) qBox(null, AD.qs.set); }).catch(function (er) { busy(bt, false); toast(er.message, 'bad', 8000); });
    }
    $('#qbF', b).onsubmit = function (e) { e.preventDefault(); save(false); };
    if ($('#qbS2', b)) $('#qbS2', b).onclick = function () { if ($('#qbF', b).reportValidity()) save(true); };
  }
  function loadQs(quiet) {
    if (!$('#bkMain')) return Promise.resolve();
    if (!AD.setId) { $('#bkMain').innerHTML = '<div class="card empty"><h3>ยังไม่มีชุดข้อสอบ</h3><p class="muted">กด "สร้างชุดข้อสอบ" หรือ "นำเข้าข้อสอบทั้งชุด" เพื่อเริ่มต้น</p></div>'; return Promise.resolve(); }
    if (!quiet) $('#bkMain').innerHTML = '<div class="boot"><div class="boot-ring"></div></div>';
    return bapi('getQuestions', { setId: AD.setId }).then(function (r) { AD.qs = r; if (TG.view === 'admin' && $('#bkMain')) main(); }).catch(function (e) { toast(e.message, 'bad'); });
  }
  if (AD.bank) shell(); else { $('#app').innerHTML = '<div class="wrap bankwrap"><div class="boot"><div class="boot-ring"></div><p>กำลังเปิดคลังข้อสอบ…</p></div></div>'; reload(); }
}
function uniq(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); }

/* ====================== นำเข้า/ส่งออกข้อสอบทั้งชุด (แม่แบบ Excel · CSV · วางจากตาราง) ======================
   1 แถว = 1 ข้อ · คอลัมน์: ประเภท | หมวด | โจทย์ | ตัวเลือก 1–10 | เฉลย | คะแนน | คำอธิบาย/เกณฑ์ | ที่มา | ใช้งาน
   ความหมายของ "ตัวเลือก" และ "เฉลย" ต่างกันตามประเภท (ดูชีต "วิธีกรอกแต่ละประเภท" ในแม่แบบ) */
var IMP_NCH = 10;
var IMP_HEAD = ['ประเภท', 'หมวด', 'โจทย์'].concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return 'ตัวเลือก ' + n; }), ['เฉลย', 'คะแนน', 'คำอธิบายเฉลย / เกณฑ์ให้คะแนน', 'ที่มา', 'ใช้งาน']);
var IMP_TYPE = { MCQ: 'ปรนัย', MULTI: 'หลายคำตอบ', TF: 'ถูกผิด', MATCH: 'จับคู่', ORDER: 'เรียงลำดับ', FILL: 'เติมคำ', SHORT: 'ตอบสั้น', ESSAY: 'ข้อเขียน', TABLE: 'ตาราง', SJT: 'สถานการณ์', MBTI: 'บุคลิกภาพ', LIKERT: 'ประมาณค่า' };
function impType(t) {
  t = String(t || '').toLowerCase().replace(/[\s\/\-_.]/g, '');
  return /หลายคำตอบ|multi/.test(t) ? 'MULTI' : /ปรนัย|mcq|เลือกตอบ|ตัวเลือก/.test(t) ? 'MCQ' : /ถูกผิด|truefalse|^tf$/.test(t) ? 'TF' : /จับคู่|match/.test(t) ? 'MATCH' : /เรียง|order/.test(t) ? 'ORDER' : /เติม|fill|blank/.test(t) ? 'FILL' : /ตอบสั้น|short/.test(t) ? 'SHORT' :
    /ตาราง|table/.test(t) ? 'TABLE' : /เขียน|อัตนัย|essay/.test(t) ? 'ESSAY' : /สถานการณ์|ทัศนคติ|sjt/.test(t) ? 'SJT' : /บุคลิก|mbti/.test(t) ? 'MBTI' : /ประมาณค่า|likert|ลิเคิร์ต|rating/.test(t) ? 'LIKERT' : '';
}
function qToRow(q) {
  var t = q.type, ch = q.choices || [], c = [], ans = q.answer, k = String(q.answer || '').split(',');
  if (t === 'MCQ') { c = ch; ans = THX[Number(q.answer) - 1] || ''; }
  else if (t === 'MULTI') { c = ch; ans = k.map(function (x) { return THX[Number(x) - 1] || ''; }).join(','); }
  else if (t === 'TF') { c = ch; ans = k.map(function (x) { return x === 'T' ? 'ถูก' : 'ผิด'; }).join(','); }
  else if (t === 'MATCH') { var used = {}; c = (ch.l || []).map(function (x, j) { used[Number(k[j]) - 1] = 1; return x + ' = ' + ((ch.r || [])[Number(k[j]) - 1] || ''); }).concat((ch.r || []).filter(function (x, j) { return !used[j]; }).map(function (x) { return '= ' + x; })); ans = ''; }
  else if (t === 'ORDER') { c = ch; ans = ''; }
  else if (t === 'FILL') { var ka = []; try { ka = JSON.parse(q.answer || '[]'); } catch (e) { } ans = ka.map(function (a) { return (Array.isArray(a) ? a : [a]).join(' | '); }).join(' ; '); }
  else if (t === 'TABLE') { c = [(ch.cols || []).join(' | '), (ch.rows || []).join(' | '), ch.corner || '']; ans = ''; }
  else if (t === 'SJT' || t === 'MBTI') c = ch;
  else if (t === 'LIKERT') ans = q.answer === 'R' ? 'กลับคะแนน' : '';
  else ans = '';
  if (c.length > IMP_NCH) c = c.slice(0, IMP_NCH - 1).concat([c.slice(IMP_NCH - 1).join('\n')]);   // เกิน 10 ช่อง: รวมที่เหลือไว้ช่องสุดท้าย (ขึ้นบรรทัดใหม่ = ตัวเลือกใหม่)
  var cells = []; for (var i = 0; i < IMP_NCH; i++) cells.push(c[i] === undefined ? '' : c[i]);
  return [IMP_TYPE[t], q.cat, q.text].concat(cells, [ans, QT[t].g === 'P' ? '' : q.points, q.rubric, q.ref, q.active ? 1 : 0]);
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
/** อ่านไฟล์ .xlsx ในเบราว์เซอร์โดยไม่ใช้ไลบรารีภายนอก (แตก zip ด้วย DecompressionStream) → [[เซลล์]] ของชีตที่ระบุชื่อ (ถ้าไม่มีใช้ชีตแรก) */
function readXlsx(file, sheetName) {
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
      var pick = sheets.filter(function (x) { return x.name === (sheetName || 'ข้อสอบ'); })[0] || sheets[0], tgt = rel[pick.rid] || 'worksheets/sheet1.xml';
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
/** แปลงตาราง → ข้อสอบ + ตรวจเบื้องต้น (หลังบ้านตรวจซ้ำอีกครั้ง) — รองรับแม่แบบรุ่น 1.x (ตัวเลือก ก–ง) และรุ่น 2.0 (ตัวเลือก 1–10) */
function rowsToQuestions(rows) {
  if (!rows.length) return [];
  var norm = function (x) { return String(x === undefined || x === null ? '' : x).replace(/\r\n?/g, '\n').trim(); };
  var hi = -1; for (var i = 0; i < Math.min(rows.length, 8); i++) if (rows[i].some(function (x) { return /^(โจทย์|คำถาม|question|text)$/i.test(norm(x)); })) { hi = i; break; }
  var map = { type: 0, cat: 1, text: 2, answer: 3 + IMP_NCH, points: 4 + IMP_NCH, rubric: 5 + IMP_NCH, ref: 6 + IMP_NCH, active: 7 + IMP_NCH }, cc = []; for (var k = 0; k < IMP_NCH; k++) cc.push(3 + k);
  if (hi >= 0) {
    map = {}; cc = [];
    rows[hi].forEach(function (h, j) {
      h = norm(h).toLowerCase();
      var m = h.match(/^(?:ตัวเลือก|ข้อย่อย|choice|option)?\s*(\d{1,2}|[ก-ญa-j])\.?$/), key;
      if (m && !/^(ที่)$/.test(h)) { var ix = /^\d+$/.test(m[1]) ? Number(m[1]) - 1 : ('กขคงจฉชซฌญ'.indexOf(m[1]) >= 0 ? 'กขคงจฉชซฌญ'.indexOf(m[1]) : 'abcdefghij'.indexOf(m[1])); if (ix >= 0 && ix < 20 && cc[ix] === undefined) { cc[ix] = j; return; } }
      key = /^(ประเภท|ชนิด|type)/.test(h) ? 'type' : /^(หมวด|มิติ|หัวข้อ|cat)/.test(h) ? 'cat' : /^(โจทย์|คำถาม|question|text)/.test(h) ? 'text' : /^(เฉลย|คำตอบ|answer|ระดับ)/.test(h) ? 'answer' : /^(คะแนน|point|score)/.test(h) ? 'points' : /^(คำอธิบาย|เกณฑ์|แนว|rubric|explain)/.test(h) ? 'rubric' : /^(ที่มา|อ้างอิง|แหล่ง|ref|source)/.test(h) ? 'ref' : /^(ใช้งาน|ใช้|active)/.test(h) ? 'active' : null;
      if (key && map[key] === undefined) map[key] = j;
    });
    if (map.text === undefined) return [];
  }
  var g = function (r, key) { return map[key] === undefined ? '' : norm(r[map[key]]); };
  var letter = function (x) { x = String(x).replace(/[.\s)]/g, '').toLowerCase(); var i1 = 'กขคงจฉชซ'.indexOf(x), i2 = 'abcdefgh'.indexOf(x); return x.length !== 1 && !/^\d+$/.test(x) ? 0 : i1 >= 0 ? i1 + 1 : i2 >= 0 ? i2 + 1 : (Number(x) >= 1 && Number(x) <= 8 ? Number(x) : 0); };
  var split = function (s, re) { return String(s || '').split(re).map(function (x) { return x.trim(); }).filter(String); };
  return rows.slice(hi + 1).map(function (r) {
    var cells = cc.map(function (j) { return j === undefined ? '' : norm(r[j]); }), ch = [];
    cells.forEach(function (c) { if (c) ch.push(c); });
    var ans = g(r, 'answer'), pts = g(r, 'points'), act = g(r, 'active').toLowerCase(), err = '', text = g(r, 'text');
    var type = impType(g(r, 'type')) || (/_{3,}/.test(text) ? 'FILL' : ch.length >= 3 ? 'MCQ' : ch.length === 2 && ch.every(function (x) { return /^[A-Za-z]\s*[|:)]/.test(x); }) ? 'MBTI' : ch.length ? 'MCQ' : 'ESSAY');
    var q = { type: type, cat: g(r, 'cat'), text: text, choices: [], answer: '', points: 0, rubric: g(r, 'rubric'), ref: g(r, 'ref'), active: !/^(0|ไม่|no|n|false|ปิด)/.test(act), show: '' };
    var multi = function () { var a = []; ch.forEach(function (c) { split(c, /\n+/).forEach(function (x) { a.push(x); }); }); return a; };   // เซลล์ที่มีหลายบรรทัด = หลายตัวเลือก
    var P = (QT[type] || {}).g === 'P'; if (!P) { q.points = pts === '' ? (type === 'ESSAY' ? 5 : 1) : Number(pts); if (!(q.points > 0)) err = 'คะแนนต้องมากกว่า 0'; }
    if (!q.text) err = 'ไม่มีโจทย์';
    if (type === 'MCQ') {
      q.choices = ch; var ix = letter(ans); q.answer = ix && ix <= ch.length ? String(ix) : '';
      if (ch.length < 2) err = err || 'ต้องมีตัวเลือกอย่างน้อย 2 ข้อ'; if (ch.length > 6) err = err || 'ปรนัยมีตัวเลือกได้ไม่เกิน 6 ข้อ';
      if (!q.answer) err = err || 'เฉลยต้องเป็นลำดับตัวเลือก เช่น ก หรือ 1'; q.show = q.answer ? THX[q.answer - 1] + '. ' + ch[q.answer - 1] : '';
    } else if (type === 'MULTI') {
      q.choices = ch.slice(0, 8); var ks = split(ans, /[,;\s]+/).map(letter).filter(function (x, i2, a) { return x && x <= ch.length && a.indexOf(x) === i2; }).sort(function (a, b2) { return a - b2; });
      q.answer = ks.join(','); if (ch.length < 2) err = err || 'ต้องมีตัวเลือกอย่างน้อย 2 ข้อ'; if (!ks.length) err = err || 'เฉลยต้องระบุตัวเลือกที่ถูก เช่น ก,ค';
      q.show = ks.map(function (x) { return THX[x - 1]; }).join(', ');
    } else if (type === 'TF') {
      q.choices = multi(); var kt = split(ans, /[,;\s\/]+/).map(function (x) { return /^(t|true|ถูก|✓|✔|1|y)$/i.test(x) ? 'T' : /^(f|false|ผิด|×|x|✗|0|n)$/i.test(x) ? 'F' : '?'; });
      q.answer = kt.join(','); if (!q.choices.length) err = err || 'ไม่มีข้อย่อย (ใส่ข้อความข้อย่อยในช่องตัวเลือก)';
      if (kt.length !== q.choices.length || kt.indexOf('?') >= 0) err = err || 'เฉลยต้องมี ถูก/ผิด ครบ ' + q.choices.length + ' ข้อย่อย คั่นด้วยจุลภาค (มี ' + kt.length + ')';
      q.show = kt.map(function (x) { return x === 'T' ? 'ถูก' : x === 'F' ? 'ผิด' : '?'; }).join(',');
    } else if (type === 'MATCH') {
      var L = [], R = [], pair = [], extra = [];
      multi().forEach(function (c) { var m = c.match(/^(.*?)\s*(?:=|→|->|⇒)\s*(.+)$/); if (!m) { err = err || 'ช่องตัวเลือกของข้อจับคู่ต้องเป็น "ข้อความซ้าย = คำตอบขวา" (พบ "' + c.slice(0, 30) + '")'; return; } if (m[1]) { L.push(m[1]); pair.push(m[2].trim()); } else extra.push(m[2].trim()); });
      R = pair.concat(extra).filter(function (x, i2, a) { return a.indexOf(x) === i2; }).sort(thCmp);
      q.choices = { l: L, r: R }; q.answer = pair.map(function (x) { return R.indexOf(x) + 1; }).join(','); if (L.length < 2) err = err || 'ต้องมีอย่างน้อย 2 คู่'; q.show = L.length + ' คู่ · ตัวเลือกขวา ' + R.length;
    } else if (type === 'ORDER') {
      q.choices = multi(); if (q.choices.length < 2) err = err || 'ต้องมีอย่างน้อย 2 รายการ (เรียงตามลำดับที่ถูกต้อง)'; if (q.choices.length > 12) err = err || 'เรียงลำดับได้ไม่เกิน 12 รายการ'; q.show = q.choices.length + ' รายการ';
    } else if (type === 'FILL') {
      var nb = fillParts(q.text).length - 1, ka = split(ans, /\s*;\s*|\n+/).map(function (x) { return split(x, /\|/); });
      q.answer = JSON.stringify(ka); if (!nb) err = err || 'โจทย์ไม่มีช่องว่าง (พิมพ์ ____ ตรงที่ให้เติม)'; else if (ka.length !== nb) err = err || 'โจทย์มี ' + nb + ' ช่องว่าง แต่เฉลยมี ' + ka.length + ' ช่อง (คั่นช่องด้วย ; )';
      q.show = ka.map(function (a) { return a.join(' | '); }).join(' ; ');
    } else if (type === 'TABLE') {
      q.choices = { cols: split(cells[0], /\s*\|\s*|\n+/), rows: split(cells[1], /\s*\|\s*|\n+/), corner: cells[2] || '' };
      if (!q.choices.cols.length || !q.choices.rows.length) err = err || 'ตัวเลือก 1 = หัวคอลัมน์ (คั่นด้วย | ) · ตัวเลือก 2 = หัวแถว (คั่นด้วย | )'; q.show = q.choices.cols.length + ' คอลัมน์ × ' + q.choices.rows.length + ' แถว';
    } else if (type === 'SJT') {
      q.choices = ch.slice(0, 4); q.answer = ans.replace(/[^1-4]/g, '').split('').join(',');
      if (ch.length !== 4) err = err || 'ต้องมีตัวเลือก 4 ข้อ'; if (q.answer.split(',').length !== 4) err = err || 'ช่องเฉลยต้องเป็นระดับ 1–4 ของตัวเลือกทั้ง 4 ข้อ เช่น 4,2,1,3'; if (!q.cat) err = err || 'ต้องระบุมิติที่วัดในช่องหมวด'; q.show = q.answer;
    } else if (type === 'MBTI') {
      q.choices = ch.slice(0, 2).map(function (x) { return x.replace(/^([A-Za-z])\s*[|:)\-]\s*/, function (m, l) { return l.toUpperCase() + '|'; }); });
      if (q.choices.length !== 2 || q.choices.some(function (x) { return !/^[A-Z]\|.+/.test(x); })) err = err || 'ต้องมี 2 ตัวเลือก รูปแบบ "อักษร|ข้อความ" เช่น E|ชอบพบปะผู้คน';
    } else if (type === 'LIKERT') { q.answer = /กลับ|ลบ|^r|reverse/i.test(ans) ? 'R' : ''; if (!q.cat) err = err || 'ต้องระบุมิติที่วัดในช่องหมวด'; q.show = q.answer ? 'กลับคะแนน' : ''; }
    else if (type === 'ESSAY' && !q.rubric) err = err || 'ข้อเขียนต้องมีเกณฑ์ให้คะแนน';
    q.err = err; return q;
  }).filter(function (q) { return q.text || (Array.isArray(q.choices) && q.choices.some(String)); });
}
function importQBox(set, done) {
  var bk = AD.bank, qs = [], fl = uniq(bk.sets.map(function (s) { return s.folder; })).sort(thCmp);
  var b = modal('<h2>นำเข้าข้อสอบ' + (set ? 'เพิ่มในชุด "' + esc(set.name) + '"' : 'ทั้งชุด') + '</h2>' +
    '<ol class="impsteps"><li><b>ดาวน์โหลดแม่แบบ</b> แล้วกรอกข้อสอบ 1 ข้อต่อ 1 แถว — ชีต "วิธีกรอกแต่ละประเภท" มีตัวอย่างครบทั้ง 12 ประเภท <a class="btn ghost-dark sm" href="TalentGate_Import_Template.xlsx" download>' + ICON.down + 'แม่แบบ Excel</a></li>' +
    '<li><b>เลือกไฟล์</b> .xlsx หรือ .csv <label class="btn primary sm">' + ICON.up + 'เลือกไฟล์<input type="file" id="iqF" accept=".xlsx,.csv,.tsv,.txt" hidden></label> <span class="muted sm">หรือคัดลอกตารางจาก Excel (รวมแถวหัวตาราง) มาวางที่ช่องนี้</span><textarea id="iqT" rows="3" placeholder="วางข้อมูลที่คัดลอกจาก Excel ที่นี่ (Ctrl+V)"></textarea></li>' +
    (set ? '' : '<li><b>นำเข้าเป็นชุดใหม่</b><label>ชื่อชุดข้อสอบ<input id="iqN" maxlength="160" placeholder="เช่น ความรู้เฉพาะตำแหน่ง ชุดที่ 1"></label><div class="row2"><label>โฟลเดอร์ (ฝ่าย/ตำแหน่ง)<input id="iqFd" maxlength="200" list="iqFL" placeholder="เช่น ฝ่ายเวชศาสตร์ชันสูตร/นักเทคนิคการแพทย์"><datalist id="iqFL">' + fl.map(function (f) { return '<option value="' + esc(f) + '">'; }).join('') + '</datalist></label><label>ใช้ได้กับ<select id="iqK"><option value="POSITION">เฉพาะตำแหน่ง</option><option value="CENTRAL">ทุกตำแหน่ง (ชุดกลาง)</option></select></label></div></li>') +
    '</ol><div id="iqP" class="imprev"></div><div class="modal-act"><button class="btn ghost-dark" id="iqX">ยกเลิก</button><button class="btn primary" id="iqS" disabled>นำเข้า</button></div>', { cls: 'xl' });
  function show(rows) {
    qs = rowsToQuestions(rows); var bad = qs.filter(function (q) { return q.err; }).length, grp = {}; qs.forEach(function (q) { grp[(QT[q.type] || {}).g] = 1; });
    var mixed = grp.P && grp.T, wrong = set && qs.some(function (q) { return (QT[q.type] || {}).g !== set.group; });
    $('#iqP', b).innerHTML = !qs.length ? '<p class="bad-t">อ่านข้อสอบไม่ได้ — ตรวจว่ามีแถวหัวตารางที่มีคอลัมน์ "โจทย์" ตามแม่แบบ</p>' :
      '<p class="' + (bad || mixed || wrong ? 'bad-t' : 'ok-t') + '">อ่านได้ ' + qs.length + ' ข้อ' + (bad ? ' · <b>มีข้อผิดพลาด ' + bad + ' ข้อ</b> (แก้ในไฟล์แล้วเลือกใหม่)' : mixed ? ' · <b>ไฟล์มีทั้งข้อสอบคิดคะแนนและข้อทัศนคติ/บุคลิกภาพ — ต้องแยกเป็นคนละชุด</b>' : wrong ? ' · <b>ชนิดข้อสอบในไฟล์ไม่ตรงกับกลุ่มของชุดนี้</b>' : ' · พร้อมนำเข้า') + ' — ' + Object.keys(IMP_TYPE).map(function (k) { var n = qs.filter(function (q) { return q.type === k; }).length; return n ? qtName(k) + ' ' + n : ''; }).filter(String).join(' · ') + ' · รวม ' + qs.reduce(function (a, q) { return a + (q.points || 0); }, 0) + ' คะแนน</p>' +
      '<div class="tblwrap tall"><table class="tbl sm"><thead><tr><th>#</th><th>ประเภท</th><th>หมวด</th><th>โจทย์</th><th>เฉลย / โครงสร้าง</th><th class="r">คะแนน</th><th>ที่มา</th><th>ตรวจ</th></tr></thead><tbody>' + qs.map(function (q, i) {
        return '<tr class="' + (q.err ? 'badrow' : '') + '"><td>' + (i + 1) + '</td><td>' + esc(qtName(q.type)) + '</td><td>' + esc(q.cat) + '</td><td>' + esc(q.text.slice(0, 90)) + (q.text.length > 90 ? '…' : '') + '</td><td>' + esc(String(q.show || '').slice(0, 70)) + '</td><td class="r">' + (q.points || '') + '</td><td>' + (q.ref ? '<span class="ok-t">มี</span>' : '<span class="bad-t">ไม่มี</span>') + '</td><td>' + (q.err ? '<b class="bad-t">' + esc(q.err) + '</b>' : '<span class="ok-t">ถูกต้อง</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    var ok = qs.length && !bad && !mixed && !wrong;
    $('#iqS', b).disabled = !ok; $('#iqS', b).textContent = ok ? 'นำเข้า ' + qs.length + ' ข้อ' : 'นำเข้า';
  }
  $('#iqX', b).onclick = closeModal;
  $('#iqT', b).oninput = function () { show(parseDelimited(this.value)); };
  $('#iqF', b).onchange = function () {
    var f = this.files[0]; if (!f) return; this.value = '';
    $('#iqP', b).innerHTML = '<p class="muted"><i class="spin dark"></i> กำลังอ่านไฟล์ ' + esc(f.name) + '…</p>';
    if ($('#iqN', b) && !$('#iqN', b).value) $('#iqN', b).value = f.name.replace(/\.[^.]+$/, '').slice(0, 160);
    (/\.xlsx$/i.test(f.name) ? readXlsx(f, 'ข้อสอบ') : f.text().then(function (t) { return parseDelimited(t); })).then(show).catch(function (e) { $('#iqP', b).innerHTML = '<p class="bad-t">' + esc(e.message) + '</p>'; });
  };
  $('#iqS', b).onclick = function () {
    var bt = this, p = { rows: qs.map(function (q) { return { type: q.type, cat: q.cat, text: q.text, choices: q.choices, answer: q.answer, points: q.points, rubric: q.rubric, ref: q.ref, active: q.active }; }) };
    if (set) p.setId = set.setId; else { if (!val('iqN', b)) return toast('กรุณากรอกชื่อชุดข้อสอบ', 'bad'); p.newSet = { name: val('iqN', b), kind: val('iqK', b), folder: val('iqFd', b), qtype: qs[0].type }; }
    busy(bt, true, 'กำลังนำเข้า…');
    bapi('importQuestions', p, { timeout: 120000 }).then(function (r) { closeModal(); toast('นำเข้าข้อสอบ ' + r.n + ' ข้อเรียบร้อย', 'ok'); AD.at = 0; BD.at = 0; done(r); }).catch(function (e) { busy(bt, false); toast(e.message, 'bad', 12000); });
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

var AUD_TH = { loginStaff: 'เข้าสู่ระบบ', loginCand: 'ผู้เข้าสอบเข้าระบบ', openBank: 'เข้าคลังข้อสอบ', viewSet: 'เปิดดูชุดข้อสอบ', printSet: 'พิมพ์ชุดข้อสอบพร้อมเฉลย', exportSet: 'ส่งออกชุดข้อสอบ', addSet: 'สร้างชุดข้อสอบ', editSet: 'แก้ไขชุดข้อสอบ', addQuestion: 'เพิ่มข้อสอบ', editQuestion: 'แก้ไขข้อสอบ', deleteQuestion: 'ลบข้อสอบ', importQuestions: 'นำเข้าข้อสอบ', setQuestionsActive: 'เลือกข้อที่ใช้',
  addExam: 'สร้างรอบสอบ', editExam: 'แก้ไขรอบสอบ', setExamStatus: 'เปลี่ยนสถานะรอบสอบ', importCandidates: 'นำเข้ารายชื่อ', replaceCandidates: 'แทนที่รายชื่อทั้งรอบ', addCandidate: 'เพิ่มผู้เข้าสอบ', editCandidate: 'แก้ไขผู้เข้าสอบ', deleteCandidate: 'ลบผู้เข้าสอบ', regenCodes: 'ออกรหัสเข้าสอบใหม่', resetSection: 'คืนสิทธิ์ทำตอน', extendTime: 'เพิ่มเวลา',
  saveGrades: 'ให้คะแนน', signoff: 'ยืนยันคะแนน', unlockSignoff: 'ปลดล็อกการยืนยัน', fillAccept: 'รับคำตอบเติมคำ', rescore: 'ตรวจข้อที่ระบบตรวจใหม่', print: 'พิมพ์เอกสาร', queueMails: 'เข้าคิวอีเมล', sendMails: 'ส่งอีเมล', cancelMails: 'ยกเลิกอีเมล', shareOpen: 'เปิดลิงก์ประกาศ', shareClose: 'ปิดลิงก์ประกาศ', saveExamMeta: 'แก้ข้อความประกาศ',
  addStaff: 'เพิ่มเจ้าหน้าที่', editStaff: 'แก้ไขเจ้าหน้าที่', saveSettings: 'บันทึกการตั้งค่า', saveLogo: 'เปลี่ยนโลโก้', storageBackup: 'สำรองไฟล์กลาง', storageBank: 'แยกไฟล์คลังข้อสอบ', storageExam: 'แยกไฟล์รอบสอบ', getDoc: 'เปิดเอกสารผู้สมัคร', uploadDoc: 'อัปโหลดเอกสารผู้สมัคร', deleteDoc: 'ลบเอกสารผู้สมัคร', getCandFile: 'ดาวน์โหลดไฟล์คำตอบ' };
/* ====================== เจ้าหน้าที่ (ผู้ดูแล · กรรมการ · ผู้สังเกตการณ์ · ผู้ออกข้อสอบ) ====================== */
function viewPeople() {
  var d = AD.data, folders = uniq(d.sets.map(function (s) { return s.folder; })).sort(thCmp);
  var roleTags = function (u) { return ['ADMIN', 'COMMITTEE', 'HR', 'AUTHOR'].filter(function (r) { return u.roles.indexOf(r) >= 0; }).map(function (r) { return '<span class="tag ' + (r === 'ADMIN' ? 'info' : r === 'AUTHOR' ? 'warn' : '') + '">' + ROLE_TH[r] + '</span>'; }).join(''); };
  $('#app').innerHTML = '<div class="wrap"><div class="phead"><div><span class="eyebrow">ผู้ดูแลระบบ</span><h1>เจ้าหน้าที่ในระบบ</h1><p class="muted">กำหนดบทบาทของเจ้าหน้าที่ · เข้าระบบด้วยเลขเจ้าหน้าที่ · เมื่อเพิ่มเจ้าหน้าที่ ระบบจะ<b>สุ่มรหัสผ่านชั่วคราว</b>ให้ (แสดงครั้งเดียว) และบังคับให้ตั้งรหัสผ่านของตนเองเมื่อเข้าครั้งแรก</p></div><button class="btn primary" id="plNew">' + ICON.plus + 'เพิ่มเจ้าหน้าที่</button></div>' +
    '<div class="rolegrid"><div><b>ผู้ดูแลระบบ</b><span>ตั้งค่ารอบสอบ คลังข้อสอบ ผู้เข้าสอบ เจ้าหน้าที่ รายงาน อีเมล</span></div><div><b>กรรมการสอบ</b><span>ทำหน้าที่ตามที่ได้รับมอบในแต่ละรอบ: คุมสอบ · ตรวจข้อเขียน · ตรวจภาคปฏิบัติ · สัมภาษณ์</span></div><div><b>ผู้สังเกตการณ์ (HR)</b><span>ดูทุกรอบสอบ คะแนน และพิมพ์รายงานได้ แต่ให้คะแนนและแก้ไขไม่ได้</span></div><div><b>ผู้ออกข้อสอบ</b><span>เข้าคลังข้อสอบได้เฉพาะโฟลเดอร์ที่กำหนด ไม่เห็นผู้เข้าสอบ คำตอบ หรือคะแนน</span></div></div>' +
    '<div class="card"><div class="inrow"><input id="plQ" class="srch" placeholder="ค้นหาชื่อ เลขเจ้าหน้าที่ หรือหน่วยงาน" autocomplete="off"></div><div class="tblwrap"><table class="tbl"><thead><tr><th>เลขเจ้าหน้าที่</th><th>ชื่อ-สกุล</th><th>หน่วยงาน</th><th>บทบาท</th><th>สถานะ</th><th>เข้าระบบล่าสุด</th><th></th></tr></thead><tbody>' +
    d.staff.map(function (u) { return '<tr data-id="' + esc(u.empCode) + '" data-q="' + esc((u.empCode + ' ' + u.name + ' ' + u.unit).toLowerCase()) + '" class="' + (u.active ? '' : 'off') + '"><td><b>' + esc(u.empCode) + '</b></td><td>' + esc(u.name) + '</td><td>' + esc(u.unit) + '</td><td>' + roleTags(u) + (u.roles.indexOf('AUTHOR') >= 0 && u.bank.length ? '<br><small class="muted">คลัง: ' + u.bank.map(function (x) { return esc(x === '*' ? 'ทุกโฟลเดอร์' : x.split('/').join(' › ')); }).join(', ') + '</small>' : '') + '</td><td>' + (u.active ? (u.mustChange ? '<span class="tag warn">รอตั้งรหัสผ่าน</span>' : '<span class="tag ok">ใช้งาน</span>') : '<span class="tag">ปิดใช้งาน</span>') + '</td><td>' + (u.lastLogin ? tDate(u.lastLogin) : '<span class="muted">ยังไม่เคยเข้า</span>') + '</td><td><button class="btn link pl-ed">แก้ไข</button></td></tr>'; }).join('') + '</tbody></table></div></div></div>';
  $('#plQ').oninput = function () { var q = this.value.trim().toLowerCase(); $$('tr[data-id]').forEach(function (tr) { tr.hidden = !!q && tr.dataset.q.indexOf(q) < 0; }); };
  function box(u) {
    var self = u && u.empCode === TG.me.empCode, has = function (r) { return u ? u.roles.indexOf(r) >= 0 : r === 'COMMITTEE'; };
    var b = modal('<h2>' + (u ? 'แก้ไขเจ้าหน้าที่' : 'เพิ่มเจ้าหน้าที่') + '</h2><form class="form" id="ubF" autocomplete="off"><label>เลขเจ้าหน้าที่<div class="inrow"><input id="ubC" inputmode="numeric" maxlength="10" pattern="[0-9]{4,10}" title="ตัวเลข 4–10 หลัก" required value="' + esc(u ? u.empCode : '') + '"' + (u ? ' disabled' : ' autofocus') + '>' + (d.smartApi && !u ? '<button type="button" class="btn ghost-dark sm" id="ubL">ดึงชื่อจากระบบ HR</button>' : '') + '</div></label>' +
      '<label>ชื่อ-สกุล<input id="ubN" maxlength="120" required value="' + esc(u ? u.name : '') + '"></label><label>หน่วยงาน<input id="ubU" maxlength="160" value="' + esc(u ? u.unit : '') + '"></label>' +
      '<div class="se-l">บทบาท (เลือกได้มากกว่า 1)</div><label class="chk"><input type="checkbox" class="ub-r" value="COMMITTEE"' + (has('COMMITTEE') ? ' checked' : '') + '> <b>กรรมการสอบ</b> — ทำหน้าที่ตามที่ได้รับมอบในรอบสอบที่ได้รับแต่งตั้ง</label><label class="chk"><input type="checkbox" class="ub-r" value="HR"' + (has('HR') ? ' checked' : '') + '> <b>ผู้สังเกตการณ์ (HR)</b> — ดูทุกรอบสอบและพิมพ์รายงานได้ ให้คะแนนไม่ได้</label>' +
      '<label class="chk"><input type="checkbox" class="ub-r" value="AUTHOR"' + (has('AUTHOR') ? ' checked' : '') + '> <b>ผู้ออกข้อสอบ</b> — เข้าคลังข้อสอบเฉพาะโฟลเดอร์ที่กำหนด</label><div id="ubBk"' + (has('AUTHOR') ? '' : ' hidden') + '><label>โฟลเดอร์คลังข้อสอบที่มีสิทธิ์ (บรรทัดละ 1 โฟลเดอร์ · รวมโฟลเดอร์ย่อย · เช่น ฝ่ายเวชศาสตร์ชันสูตร)<textarea id="ubB" rows="3" maxlength="2000" placeholder="ฝ่าย/ตำแหน่ง">' + esc(u ? u.bank.join('\n') : '') + '</textarea></label>' +
      (folders.length ? '<div class="mlvars"><small class="muted">โฟลเดอร์ที่มีอยู่:</small>' + folders.map(function (f) { return '<button type="button" class="chip" data-f="' + esc(f) + '">' + esc(f.split('/').join(' › ')) + '</button>'; }).join('') + '</div>' : '') + '</div>' +
      '<label class="chk"><input type="checkbox" class="ub-r" value="ADMIN"' + (has('ADMIN') ? ' checked' : '') + '> <b>ผู้ดูแลระบบ</b> — ตั้งค่าทุกส่วนของระบบ</label>' +
      (u ? (self ? '' : '<div class="se-l">รหัสผ่าน</div><label class="chk"><input type="checkbox" id="ubR"> ออกรหัสผ่านชั่วคราวใหม่ (ใช้เมื่อเจ้าหน้าที่ลืมรหัสผ่าน — รหัสเดิมจะใช้ไม่ได้ทันที)</label>') + '<label class="chk"><input type="checkbox" id="ubA"' + (u.active ? ' checked' : '') + '> เปิดใช้งานบัญชี</label>'
        : '<div class="note info">เมื่อบันทึก ระบบจะสุ่ม<b>รหัสผ่านชั่วคราว</b>และแสดงให้ท่านเห็น 1 ครั้ง เพื่อแจ้งเจ้าหน้าที่</div>') +
      '<div class="modal-act"><button type="button" class="btn ghost-dark" id="ubX">ยกเลิก</button><button class="btn primary" id="ubS">บันทึก</button></div></form>');
    $('#ubX', b).onclick = closeModal;
    $$('.ub-r', b).forEach(function (x) { x.onchange = function () { $('#ubBk', b).hidden = !$$('.ub-r', b).some(function (y) { return y.value === 'AUTHOR' && y.checked; }); }; });
    $$('[data-f]', b).forEach(function (x) { x.onclick = function () { var t = $('#ubB', b), l = t.value.split(/\n/).map(function (y) { return y.trim(); }).filter(String); if (l.indexOf(x.dataset.f) < 0) l.push(x.dataset.f); t.value = l.join('\n'); }; });
    if ($('#ubL', b)) $('#ubL', b).onclick = function () { var bt = this; busy(bt, true, 'กำลังค้นหา…'); api('lookupStaff', { empCode: val('ubC', b) }).then(function (r) { busy(bt, false); $('#ubN', b).value = r.name; $('#ubU', b).value = r.unit; toast('พบข้อมูล: ' + r.name + (r.position ? ' (' + r.position + ')' : ''), 'ok'); }).catch(function (e) { busy(bt, false); toast(e.message, 'bad', 9000); }); };
    $('#ubF', b).onsubmit = function (e) {
      e.preventDefault(); var roles = $$('.ub-r', b).filter(function (x) { return x.checked; }).map(function (x) { return x.value; }), bank = val('ubB', b).split(/\n/).map(function (x) { return x.trim().replace(/\s*›\s*/g, '/'); }).filter(String);
      if (!roles.length) return toast('กรุณาเลือกบทบาทอย่างน้อย 1 อย่าง', 'bad');
      if (roles.indexOf('AUTHOR') >= 0 && !bank.length) return toast('ผู้ออกข้อสอบต้องระบุโฟลเดอร์คลังข้อสอบอย่างน้อย 1 โฟลเดอร์', 'bad');
      busy($('#ubS', b), true);
      api('saveStaff', { empCode: u ? u.empCode : val('ubC', b), name: val('ubN', b), unit: val('ubU', b), roles: roles, bank: bank, isNew: !u, resetPass: !!($('#ubR', b) && $('#ubR', b).checked), active: u ? $('#ubA', b).checked : true })
        .then(function (r) { closeModal(); toast(r.isNew ? 'เพิ่มเจ้าหน้าที่แล้ว' : 'บันทึกแล้ว', 'ok'); return loadAdmin(true).then(function () { keepScroll(viewPeople); if (r.tempPass) showTempPass(r); }); })
        .catch(function (er) { busy($('#ubS', b), false); toast(er.message, 'bad', 9000); });
    };
  }
  $('#plNew').onclick = function () { box(null); };
  $$('tr[data-id]').forEach(function (tr) { $('.pl-ed', tr).onclick = function () { box(d.staff.filter(function (x) { return x.empCode === tr.dataset.id; })[0]); }; });
}

/* ====================== ตั้งค่าระบบ · ที่เก็บข้อมูล · ประวัติ ====================== */
function viewSettings() {
  var d = AD.data, s = d.settings, st = d.storage || {}, lines = function (v) { return esc(String(v || '').split('|').join('\n')); }, list = function (id, n) { return val(id).split(/\n/).map(function (x) { return x.trim(); }).filter(String).slice(0, n || 99).join('|'); };
  $('#app').innerHTML = '<div class="wrap"><div class="phead"><div><span class="eyebrow">ผู้ดูแลระบบ</span><h1>ตั้งค่าระบบ</h1></div></div>' +
    '<div class="grid2"><div class="card"><h2 class="card-t">ข้อความบนหน้าเว็บ</h2><form class="form" id="stF"><label>ชื่อหน่วยงาน (ท้ายหน้าเว็บ)<input id="stO" maxlength="300" value="' + esc(s.orgName) + '"></label><label>ช่องทางติดต่อ (หน้าผู้เข้าสอบ)<input id="stC" maxlength="300" value="' + esc(s.contact) + '"></label>' +
    '<label>ข้อปฏิบัติของผู้เข้าสอบ (บรรทัดละ 1 ข้อ)<textarea id="stR" rows="6" maxlength="1900">' + lines(s.candRules) + '</textarea></label><label>จำนวนครั้งที่ผู้เข้าสอบกรอกรหัสผิดได้ก่อนพัก 5 นาที<input id="stL" type="number" min="3" max="30" value="' + esc(s.candFailLimit || 8) + '"></label>' +
    '<div class="se-l">แบบประเมินความพึงพอใจ</div><label class="chk"><input type="checkbox" id="stSv"' + (s.surveyOn !== '0' ? ' checked' : '') + '> เปิดใช้แบบประเมิน — เด้งให้ผู้เข้าสอบหลังส่งครบทุกตอน และให้กรรมการคุมสอบหลังปิดรับคำตอบ (ข้ามได้ · ไม่ระบุตัวผู้ตอบ)</label>' +
    '<label>หัวข้อประเมินของ<b>ผู้เข้าสอบ</b> บรรทัดละ 1 ข้อ ไม่เกิน 7 ข้อ (ให้คะแนน 1–5)<textarea id="stSi" rows="6" maxlength="1900">' + lines(s.surveyItems) + '</textarea></label><label>หัวข้อประเมินของ<b>กรรมการคุมสอบ</b> บรรทัดละ 1 ข้อ ไม่เกิน 7 ข้อ<textarea id="stPi" rows="6" maxlength="1900">' + lines(s.proctorSurveyItems) + '</textarea></label>' +
    '<button class="btn primary" id="stS">บันทึกการตั้งค่า</button></form></div>' +
    '<div><div class="card"><h2 class="card-t">หัวกระดาษ ประกาศ และอีเมล</h2><div class="logobox"><img id="lgI" src="' + esc(logoSrc()) + '" alt="โลโก้"><div><b>โลโก้บนหัวกระดาษรายงาน ประกาศ และหัวอีเมล</b><p class="muted sm">PNG หรือ JPG ไม่เกิน 600 KB · แนะนำพื้นหลังโปร่งใส สูงอย่างน้อย 300 พิกเซล</p><div class="acts"><label class="btn ghost-dark sm">' + ICON.up + 'อัปโหลดโลโก้<input type="file" id="lgF" accept=".png,.jpg,.jpeg,image/png,image/jpeg" hidden></label>' + (s.logoFileId ? '<button class="btn link" id="lgR">กลับไปใช้โลโก้ตั้งต้น</button>' : '') + '</div></div></div>' +
    '<form class="form" id="hdF"><label>ชื่อโรงพยาบาล (หัวกระดาษ · บรรทัด "ประกาศ…")<input id="hdN" maxlength="200" value="' + esc(s.hospName) + '"></label><label>บรรทัดรอง<input id="hdS" maxlength="200" value="' + esc(s.hospSub) + '"></label>' +
    '<label>ชื่อผู้ส่งที่ผู้สมัครเห็นในอีเมล<input id="hdM" maxlength="200" value="' + esc(s.mailFrom) + '"></label><label>อีเมลสำหรับให้ผู้สมัครตอบกลับ (เว้นว่าง = ตอบกลับบัญชีที่ส่ง)<input id="hdR" type="email" maxlength="160" value="' + esc(s.mailReply) + '"></label>' +
    '<label>ข้อความท้ายอีเมล (ที่อยู่ · โทรศัพท์)<textarea id="hdT" rows="3" maxlength="900">' + esc(s.mailFoot) + '</textarea></label><button class="btn primary" id="hdB">บันทึก</button></form>' +
    '<p class="muted sm">อีเมลส่งจากบัญชี Google ที่ติดตั้งระบบ · โควตาคงเหลือวันนี้ <b>' + (d.mailQuota === null || d.mailQuota === undefined ? 'ไม่ทราบ' : d.mailQuota) + '</b> ฉบับ (บัญชี Gmail ทั่วไปส่งได้ประมาณ 100 ฉบับต่อวัน · บัญชี Google Workspace ประมาณ 1,500)</p></div>' +
    '<div class="card"><h2 class="card-t">ระบบและการเชื่อมต่อ</h2><table class="kv"><tr><th>รุ่นหน้าเว็บ</th><td>' + esc(TG_BUILD) + '</td></tr><tr><th>รุ่นหลังบ้าน</th><td>' + esc(d.app.build) + ' ' + (d.app.build === TG_BUILD ? '<span class="tag ok">ตรงกัน</span>' : '<span class="tag bad">ไม่ตรงกัน</span>') + '</td></tr><tr><th>ช่วงผ่อนผันหลังหมดเวลา</th><td>' + d.app.graceSec + ' วินาที</td></tr>' +
    '<tr><th>ไฟล์กลาง</th><td>' + (d.links.sheet ? '<a href="' + esc(d.links.sheet) + '" target="_blank" rel="noopener">เปิด Google Sheet</a>' : '–') + '</td></tr><tr><th>โฟลเดอร์ของระบบ</th><td>' + (d.links.folder ? '<a href="' + esc(d.links.folder) + '" target="_blank" rel="noopener">เปิดโฟลเดอร์ Google Drive</a>' : '–') + '</td></tr>' +
    '<tr><th>ระบบ HR (SmartAPI)</th><td>' + (d.smartApi ? '<span class="tag ok">ตั้งค่าแล้ว</span> <button class="btn link" id="stT">ทดสอบการเชื่อมต่อ</button>' : '<span class="tag">ยังไม่ได้เชื่อมต่อ</span><br><small class="muted">ไม่บังคับ — ใช้ค้นชื่อเจ้าหน้าที่จากเลขเจ้าหน้าที่ ต้องมีไฟล์ SmartApiClient.gs และตั้ง SMARTAPI_USER / SMARTAPI_PASS ใน Script Properties</small>') + '</td></tr>' +
    '<tr><th>ชุดข้อสอบของรุ่นนี้</th><td><button class="btn link" id="stX">ตรวจและติดตั้งชุดข้อสอบที่ยังไม่มีในคลัง</button><br><small class="muted">ปกติระบบติดตั้งให้เองหลังอัปเดต · ไม่แตะข้อสอบเดิม</small></td></tr></table>' +
    '<p class="muted sm">Google Sheet และโฟลเดอร์ Drive เปิดได้เฉพาะเจ้าของบัญชีที่ติดตั้งระบบ ห้ามแชร์ให้ผู้อื่น เพราะมีเฉลยข้อสอบและรหัสเข้าสอบ</p></div></div></div>' +
    '<div class="card" id="stoCard"><div class="card-head"><div><h2 class="card-t">ที่เก็บข้อมูล</h2><p class="card-s">รุ่น 2.0 แยกข้อมูลเป็น <b>ไฟล์คลังข้อสอบ</b> และ <b>ไฟล์ + โฟลเดอร์ของแต่ละรอบสอบ</b> (รายชื่อ คำตอบ คะแนน เอกสาร ประกาศ) ไฟล์กลางเหลือเฉพาะการตั้งค่า เจ้าหน้าที่ และสารบัญรอบสอบ — ระบบจึงอ่านเฉพาะข้อมูลของรอบที่กำลังใช้ ทำงานเร็วขึ้นและหาไฟล์ง่าย · รอบสอบที่สร้างใหม่แยกให้เองทันที</p></div></div><div id="stoB">' +
    (st.done ? '<div class="note ok">ข้อมูลจัดระเบียบครบแล้ว — คลังข้อสอบและทุกรอบสอบอยู่ในไฟล์ของตัวเอง</div>' : '<div class="note warn">ยังมีข้อมูลของรุ่นเดิมอยู่ในไฟล์กลาง: ' + (st.bank ? '' : 'คลังข้อสอบ · ') + (st.pending || []).length + ' รอบสอบ — กด "จัดระเบียบที่เก็บข้อมูล" เพื่อย้าย (ระบบสำรองไฟล์กลางทั้งไฟล์ก่อนเสมอ · ทำซ้ำได้ · ต้องไม่มีรอบที่กำลังเปิดสอบ)</div><button class="btn primary" id="stoGo">จัดระเบียบที่เก็บข้อมูล</button>') +
    ' <button class="btn ghost-dark sm" id="stoV">ดูตำแหน่งไฟล์ของแต่ละรอบสอบ</button><div id="stoOut"></div></div></div>' +
    '<div class="card"><h2 class="card-t">ทดสอบรับโหลด</h2><p class="card-s">จำลองผู้เข้าสอบหลายคนเข้าระบบ ทำข้อสอบ บันทึก ส่งคำตอบ และส่งไฟล์<b>พร้อมกัน</b>บนระบบจริง เพื่อวัดว่าระบบรับได้หรือไม่ · ใช้รอบสอบจำลองแยกต่างหาก ไม่กระทบข้อมูลจริง และลบทิ้งเองเมื่อจบ · <b>ห้ามรันระหว่างการสอบจริง</b> · เปิดหน้านี้บนคอมพิวเตอร์ที่ต่ออินเทอร์เน็ตเดียวกับห้องสอบจะได้ผลใกล้เคียงจริงที่สุด</p>' +
    '<div class="form ltform"><div class="row2"><label>คัดลอกตอนสอบจากรอบ<select id="ltE">' + d.exams.filter(function (e) { return e.examId !== 'LOADTEST'; }).map(function (e) { return '<option value="' + esc(e.examId) + '">' + esc(e.title) + '</option>'; }).join('') + '</select></label><label>จำนวนผู้เข้าสอบจำลอง (สูงสุด 150)<input id="ltN" type="number" min="1" max="150" value="80"></label></div><button class="btn primary" id="ltGo">เริ่มทดสอบรับโหลด</button></div><div id="ltOut"></div></div>' +
    '<div class="card"><div class="card-head"><div><h2 class="card-t">ประวัติการใช้งาน</h2><p class="card-s">500 รายการล่าสุด · การเข้าระบบ การเข้าคลังข้อสอบ เปิดดู/พิมพ์/ส่งออกชุดข้อสอบ การให้คะแนน การส่งอีเมล และการแก้ไขของผู้ดูแลถูกบันทึกไว้ทั้งหมด</p></div><div class="acts"><select id="auK"><option value="">ทุกประเภท</option><option value="bank">คลังข้อสอบ</option><option value="login">การเข้าระบบ</option><option value="mail">อีเมลและประกาศ</option><option value="grade">คะแนนและการยืนยัน</option><option value="cand">ผู้เข้าสอบ</option><option value="print">การพิมพ์</option></select><input id="auQ" class="srch" placeholder="ค้นหา เช่น 5660101"></div></div><div class="tblwrap tall" id="auB"><p class="muted">กำลังโหลด…</p></div></div></div>';
  var save = function (btn, o) { busy(btn, true); return api('saveSettings', { settings: o }).then(function () { busy(btn, false); toast('บันทึกแล้ว', 'ok'); AD.at = 0; Object.keys(o).forEach(function (k) { s[k] = o[k]; }); if (TG.boot) { if (o.hospName !== undefined) { TG.boot.hospName = o.hospName; TG.boot.hospSub = o.hospSub; } if (o.orgName !== undefined) TG.boot.orgName = o.orgName; } }).catch(function (er) { busy(btn, false); toast(er.message, 'bad'); }); };
  $('#stF').onsubmit = function (e) { e.preventDefault(); save($('#stS'), { orgName: val('stO'), contact: val('stC'), candRules: list('stR'), candFailLimit: val('stL'), surveyOn: $('#stSv').checked ? '1' : '0', surveyItems: list('stSi', 7), proctorSurveyItems: list('stPi', 7) }); };
  $('#hdF').onsubmit = function (e) { e.preventDefault(); save($('#hdB'), { hospName: val('hdN'), hospSub: val('hdS'), mailFrom: val('hdM'), mailReply: val('hdR'), mailFoot: $('#hdT').value.trim() }); };
  function logoDone(r) { TG.logo = r.dataUrl || ''; if (TG.boot) TG.boot.logoVer = r.ver; store('tg_logo', { ver: r.ver, dataUrl: TG.logo }); AD.at = 0; toast(r.dataUrl ? 'เปลี่ยนโลโก้แล้ว' : 'กลับไปใช้โลโก้ตั้งต้นแล้ว', 'ok'); loadAdmin(true).then(function () { if (TG.view === 'admin' && $('#lgI')) keepScroll(viewSettings); }); }
  $('#lgF').onchange = function () {
    var f = this.files[0]; if (!f) return; this.value = '';
    if (!/\.(png|jpe?g)$/i.test(f.name)) return toast('โลโก้ต้องเป็นไฟล์ PNG หรือ JPG', 'bad');
    if (f.size > 600 * 1024) return toast('ไฟล์โลโก้ใหญ่เกิน 600 KB', 'bad');
    fileB64(f).then(function (b64) { return api('saveLogo', { name: f.name, b64: b64 }, { timeout: 120000 }); }).then(logoDone).catch(function (e) { toast(e.message, 'bad'); });
  };
  if ($('#lgR')) $('#lgR').onclick = function () { api('saveLogo', { reset: true }).then(logoDone).catch(function (e) { toast(e.message, 'bad'); }); };
  $('#stX').onclick = function () { var b = this; busy(b, true, 'กำลังตรวจ…'); api('installExtraSets', {}, { timeout: 120000 }).then(function (r) { busy(b, false); AD.at = 0; toast(r.sets ? 'ติดตั้งเพิ่ม ' + r.sets + ' ชุด ' + r.questions + ' ข้อ' : 'คลังข้อสอบมีครบทุกชุดของรุ่นนี้แล้ว', 'ok'); }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); }); };
  $('#ltGo').onclick = function () { loadTest(val('ltE'), Math.max(1, Math.min(150, Number(val('ltN')) || 80)), this); };
  if ($('#stT')) $('#stT').onclick = function () { var b = this; busy(b, true, 'กำลังทดสอบ…'); api('testSmartApi', {}, { timeout: 60000 }).then(function (r) { busy(b, false); toast('เชื่อมต่อ SmartAPI ได้ (' + r.ms + ' ms)', 'ok'); }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); }); };
  /* ----- ที่เก็บข้อมูล ----- */
  $('#stoV').onclick = function () {
    var b = this; busy(b, true, 'กำลังโหลด…');
    api('getStorage', {}).then(function (r) {
      busy(b, false);
      $('#stoOut').innerHTML = '<table class="kv"><tr><th>โฟลเดอร์หลัก</th><td>' + (r.links.root ? '<a href="' + esc(r.links.root) + '" target="_blank" rel="noopener">TalentGate_ไฟล์สอบ</a>' : '–') + '</td></tr><tr><th>คลังข้อสอบ</th><td>' + (r.links.bank ? '<a href="' + esc(r.links.bank) + '" target="_blank" rel="noopener">ไฟล์ TalentGate_คลังข้อสอบ</a> <span class="tag ok">แยกไฟล์แล้ว</span>' : '<span class="tag warn">ยังอยู่ในไฟล์กลาง</span>') + '</td></tr>' +
        (r.backupAt ? '<tr><th>สำเนาสำรองล่าสุด</th><td><a href="' + esc(r.backupUrl) + '" target="_blank" rel="noopener">เปิดสำเนาไฟล์กลาง</a> · ' + tDate(r.backupAt) + '</td></tr>' : '') + '</table>' +
        '<div class="tblwrap"><table class="tbl sm"><thead><tr><th>รอบสอบ</th><th>สถานะ</th><th>ที่เก็บข้อมูล</th></tr></thead><tbody>' + r.rounds.map(function (x) { return '<tr><td>' + esc(x.title) + '<br><small class="muted">' + esc(x.examId) + '</small></td><td>' + stPill(x.status) + '</td><td>' + (x.split ? (x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">เปิดโฟลเดอร์ของรอบ</a>' : '<span class="tag ok">แยกไฟล์แล้ว</span>') : '<span class="tag warn">ยังอยู่ในไฟล์กลาง</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); });
  };
  if ($('#stoGo')) $('#stoGo').onclick = function () {
    var btn = this, pend = st.pending || [], steps = [{ step: 'backup', label: 'สำรองไฟล์กลางทั้งไฟล์' }].concat(st.bank ? [] : [{ step: 'bank', label: 'ย้ายคลังข้อสอบไปไฟล์แยก' }], pend.map(function (e) { return { step: 'exam', examId: e.examId, label: 'ย้ายข้อมูลรอบสอบ: ' + e.title }; }));
    askPass('จัดระเบียบที่เก็บข้อมูล', '<p>ระบบจะทำ ' + steps.length + ' ขั้นตามลำดับ ใช้เวลาประมาณ ' + Math.max(1, Math.ceil(steps.length * 0.5)) + '–' + (steps.length * 2) + ' นาที</p><ol class="rmlist">' + steps.map(function (x) { return '<li>' + esc(x.label) + '</li>'; }).join('') + '</ol><div class="note warn">ทำตอนที่<b>ไม่มีการสอบและไม่มีกรรมการกำลังให้คะแนน</b> · เปิดหน้านี้ค้างไว้จนจบ · ถ้าขั้นใดไม่สำเร็จ ข้อมูลของขั้นนั้นยังอยู่ที่เดิมครบ กดทำต่อได้</div>', 'เริ่มจัดระเบียบ').then(function (p) {
      if (!p) return;
      busy(btn, true, 'กำลังจัดระเบียบ…');
      var out = $('#stoOut'), i = 0, log = steps.map(function (x) { return { label: x.label, st: 'รอ' }; });
      var paint = function () { out.innerHTML = '<ol class="stolog">' + log.map(function (x) { return '<li class="' + (x.st === 'เสร็จ' ? 'ok' : x.st === 'ไม่สำเร็จ' ? 'bad' : x.st === 'กำลังทำ' ? 'run' : '') + '"><b>' + esc(x.label) + '</b> — ' + esc(x.st) + (x.note ? ' · ' + esc(x.note) : '') + '</li>'; }).join('') + '</ol>'; };
      var next = function () {
        if (i >= steps.length) { busy(btn, false); toast('จัดระเบียบที่เก็บข้อมูลเสร็จแล้ว', 'ok'); AD.at = 0; BD.data = null; TG.home = null; return loadAdmin(true).then(function () { if (TG.view === 'admin' && $('#stoCard')) { keepScroll(viewSettings); } }); }
        var x = steps[i]; log[i].st = 'กำลังทำ'; paint();
        return api('organizeStorage', { step: x.step, examId: x.examId, password: p.password }, { timeout: 330000, quiet: true, tries: 1 }).then(function (r) {
          log[i].st = 'เสร็จ'; log[i].note = r.skipped ? 'ทำไว้แล้ว' : r.step === 'bank' ? r.sets + ' ชุด ' + r.questions + ' ข้อ' : r.step === 'exam' ? r.rows + ' แถว' : ''; i++; paint(); return next();
        }, function (e) { log[i].st = 'ไม่สำเร็จ'; log[i].note = e.message; paint(); busy(btn, false); toast('หยุดที่ขั้น "' + x.label + '": ' + e.message, 'bad', 12000); AD.at = 0; });
      };
      paint(); next();
    });
  };
  /* ----- ประวัติ ----- */
  var AU = { bank: /Bank|Set|Question|import/i, login: /login|logout|pass/i, mail: /mail|share|ExamMeta/i, grade: /grade|sign|unlock|rescore|fill/i, cand: /Cand|Codes|reset|extend/i, print: /print/i };
  api('getAudit', { limit: 500 }).then(function (r) {
    function draw() { var q = val('auQ').toLowerCase(), k = AU[val('auK')], rows = r.rows.filter(function (x) { return (!q || (x.who + ' ' + x.action + ' ' + x.detail).toLowerCase().indexOf(q) >= 0) && (!k || k.test(x.action)); }); $('#auB').innerHTML = '<table class="tbl sm"><thead><tr><th>เวลา</th><th>ผู้ทำ</th><th>การกระทำ</th><th>รายละเอียด</th></tr></thead><tbody>' + rows.map(function (x) { return '<tr><td class="nowrap">' + tDate(x.at) + '</td><td>' + esc(x.who) + '</td><td>' + (AUD_TH[x.action] ? esc(AUD_TH[x.action]) + '<br>' : '') + '<code>' + esc(x.action) + '</code></td><td>' + esc(x.detail) + '</td></tr>'; }).join('') + '</tbody></table>' + (rows.length ? '' : '<p class="muted">ไม่พบรายการ</p>'); }
    if ($('#auB')) { draw(); $('#auQ').oninput = draw; $('#auK').onchange = draw; }
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
          var ans = {}, rnd = function (n) { return 1 + Math.floor(Math.random() * Math.max(1, n)); };
          st.questions.forEach(function (q) {
            var ch = q.choices || [], t = q.type;
            ans[q.id] = t === 'ESSAY' ? 'คำตอบจำลองสำหรับทดสอบรับโหลด '.repeat(12) : t === 'SHORT' ? 'คำตอบสั้นจำลอง' : t === 'MULTI' ? [rnd(ch.length)] : t === 'TF' ? ch.map(function () { return Math.random() < .5 ? 'T' : 'F'; }) : t === 'MATCH' ? (ch.l || []).map(function () { return rnd((ch.r || []).length); }) :
              t === 'ORDER' ? ch.map(function (x, i2) { return i2; }) : t === 'FILL' ? Array.apply(null, Array(q.blanks || 1)).map(function () { return 'คำตอบ'; }) : t === 'TABLE' ? (ch.rows || []).map(function () { return (ch.cols || []).map(function () { return 'จำลอง'; }); }) : t === 'LIKERT' ? rnd(5) : rnd(ch.length || 2);
          });
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
