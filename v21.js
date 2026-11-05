/* =====================================================================
   SOMDEJ TalentGate · v21.js — รุ่น 2.1 (6 พ.ย. 2569)
   ① เลือกข้อสอบรายข้อจากหลายชุด (หน้าตั้งค่ารอบสอบ)   ② ค่าตั้งการคัดเลือก: รับกี่อัตรา · สำรอง · ผู้เข้าสอบเห็นคะแนน · กำหนดสัมภาษณ์
   ③ แท็บ "ผลรายบุคคล": คำตอบรายข้อ เฉลย ถูก/ผิด คะแนน + พิมพ์รายคน/ทุกคน   ④ ข้อสอบฉบับพิมพ์กระดาษ (ไม่มีเฉลย/มีเฉลย)
   ⑤ ผลการคัดเลือก (ตัวจริง/สำรอง) ในสรุปผลและประกาศผล
   ===================================================================== */
var PICK = {};
function qtTh(t) { return (typeof QT !== 'undefined' && QT[t] && QT[t].th) || t; }

/* ---------- ① เลือกข้อสอบรายข้อ ---------- */
function secPickBox(s, i, dis) {
  if (s.type === 'PRACTICAL') return '';
  var n = (s.qids || []).length, pts = s._pts !== undefined ? s._pts : s.maxScore;
  if (!n) return dis ? '' : '<div class="secpick">' + TI.exams + '<span>ใช้<b>ทุกข้อ</b>ที่เปิดใช้งานในชุดที่เลือก · ต้องการคัดเฉพาะบางข้อจากหลายชุด?</span><button type="button" class="btn primary sm" data-pick="pick">' + ICON.plus + 'เลือกข้อสอบรายข้อ</button></div>';
  return '<div class="secpick">' + TI.exams + '<span>เลือกรายข้อ <b>' + n + ' ข้อ</b>' + (s.type === 'THEORY' && pts !== undefined ? ' · <b>' + num(pts) + ' คะแนน</b>' : '') + ' จาก ' + s.sets.length + ' ชุด</span>' +
    (dis ? '<span class="muted sm">(ล็อกแล้ว — มีผู้เริ่มทำข้อสอบ)</span>' : '<button type="button" class="btn ghost-dark sm" data-pick="pick">' + ICON.edit + 'แก้ไขข้อที่เลือก</button><button type="button" class="btn link" data-pick="all">ใช้ทุกข้อของชุดแทน</button>') + '</div>';
}
function pickLoad(grp, include) {
  var c = PICK[grp];
  if (c && Date.now() - c.at < 120000 && include.every(function (id) { return c.sets.some(function (x) { return x.setId === id; }); })) return Promise.resolve(c);
  return api('getPickList', { group: grp, include: include }).then(function (r) {
    var qmap = {}; r.sets.forEach(function (st, k) { st.k = k; st.questions.forEach(function (q, j) { q.setId = st.setId; q.j = j; qmap[q.qId] = q; }); });
    PICK[grp] = { at: Date.now(), sets: r.sets, qmap: qmap }; return PICK[grp];
  });
}
function pickPts(s) { var m = (PICK[s.type === 'PROFILE' ? 'P' : 'T'] || {}).qmap; if (!m) return; s._pts = r2((s.qids || []).reduce(function (a, id) { return a + (m[id] ? m[id].points : 0); }, 0)); }
/** เปลี่ยนชุดข้อสอบแล้ว: ตัดข้อที่ไม่อยู่ในชุดที่เลือกออก */
function pickTrim(s) {
  if (!s.qids || !s.qids.length) return;
  var m = (PICK[s.type === 'PROFILE' ? 'P' : 'T'] || {}).qmap;
  if (!m) { s.qids = []; delete s._pts; toast('ล้างการเลือกรายข้อของตอนนี้แล้ว เพราะมีการเปลี่ยนชุดข้อสอบ — กด "เลือกข้อสอบรายข้อ" อีกครั้งถ้าต้องการ', 'warn', 7000); return; }
  s.qids = s.qids.filter(function (id) { return m[id] && s.sets.indexOf(m[id].setId) >= 0; });
  if (!s.qids.length) delete s._pts; else pickPts(s);
}
function pickModal(s, done) {
  var grp = s.type === 'PROFILE' ? 'P' : 'T';
  var b = modal('<h2>เลือกข้อสอบรายข้อ — ' + esc(s.title || '') + '</h2><div id="pkWrap"><div class="boot"><div class="boot-ring dark"></div><p>กำลังโหลดข้อสอบจากคลัง…</p></div></div>', { cls: 'xl' });
  pickLoad(grp, s.sets || []).then(function (P) {
    var sel = {}, open = {}, st = { q: '', type: '', only: false };
    if (s.qids && s.qids.length) s.qids.forEach(function (id) { sel[id] = 1; });
    else P.sets.forEach(function (x) { if ((s.sets || []).indexOf(x.setId) >= 0) x.questions.forEach(function (q) { if (q.active) sel[q.qId] = 1; }); });
    P.sets.forEach(function (x) { if (x.questions.some(function (q) { return sel[q.qId]; })) open[x.setId] = 1; });
    var types = {}; P.sets.forEach(function (x) { x.questions.forEach(function (q) { types[q.type] = 1; }); });
    function sum() {
      var n = 0, pts = 0, sets = {}; Object.keys(sel).forEach(function (id) { var q = P.qmap[id]; if (!q) return; n++; pts += q.points; sets[q.setId] = 1; });
      return { n: n, pts: r2(pts), sets: Object.keys(sets).length };
    }
    function match(q) { return (!st.type || q.type === st.type) && (!st.only || sel[q.qId]) && (!st.q || (q.text + ' ' + q.cat).toLowerCase().indexOf(st.q) >= 0); }
    function drawList() {
      var h = '';
      P.sets.forEach(function (x) {
        var qs = x.questions.filter(match); if (!qs.length) return;
        var nOn = x.questions.filter(function (q) { return sel[q.qId]; }).length, all = qs.every(function (q) { return sel[q.qId]; }), some = qs.some(function (q) { return sel[q.qId]; });
        h += '<section class="pk-set' + (open[x.setId] || st.q || st.only ? ' open' : '') + '" data-s="' + esc(x.setId) + '"><header><input type="checkbox" data-sa="' + esc(x.setId) + '"' + (all ? ' checked' : '') + (some && !all ? ' data-mixed="1"' : '') + ' title="เลือก/ยกเลิกทุกข้อในชุดนี้"><b>' + esc(x.name) + (x.active ? '' : ' <span class="tag">ปิดใช้งาน</span>') + '</b><small>' + esc(x.folder.split('/').join(' › ')) + '</small><span class="pk-n">' + nOn + '/' + x.questions.length + '</span></header><div class="pk-qs">' +
          qs.map(function (q) {
            return '<label class="pk-q' + (sel[q.qId] ? ' on' : '') + (q.active ? '' : ' off') + '"><input type="checkbox" data-q="' + esc(q.qId) + '"' + (sel[q.qId] ? ' checked' : '') + '><span class="t">' + esc(q.text) + (q.cat ? ' <small class="muted">· ' + esc(q.cat) + '</small>' : '') + '</span><span class="m">' + esc(qtTh(q.type)) + (grp === 'T' ? '<br><b>' + num(q.points) + '</b> คะแนน' : '') + (q.active ? '' : '<br>ปิดใช้ในคลัง') + '</span></label>';
          }).join('') + '</div></section>';
      });
      $('#pkL', b).innerHTML = h || '<p class="muted center">ไม่พบข้อสอบตามที่ค้นหา</p>';
      $$('[data-mixed]', b).forEach(function (x) { x.indeterminate = true; });
      var m = sum(); $('#pkN', b).textContent = m.n; $('#pkP', b).textContent = num(m.pts); $('#pkS', b).textContent = m.sets;
      $$('[data-q]', b).forEach(function (x) { x.onchange = function () { if (x.checked) sel[x.dataset.q] = 1; else delete sel[x.dataset.q]; x.closest('.pk-q').classList.toggle('on', x.checked); var m2 = sum(); $('#pkN', b).textContent = m2.n; $('#pkP', b).textContent = num(m2.pts); $('#pkS', b).textContent = m2.sets; var sec = x.closest('.pk-set'), n2 = $$('[data-q]', sec).filter(function (y) { return y.checked; }).length; sec.querySelector('.pk-n').textContent = P.sets.filter(function (z) { return z.setId === sec.dataset.s; })[0].questions.filter(function (q) { return sel[q.qId]; }).length + '/' + P.sets.filter(function (z) { return z.setId === sec.dataset.s; })[0].questions.length; var sa = sec.querySelector('[data-sa]'); sa.checked = n2 === $$('[data-q]', sec).length; sa.indeterminate = n2 > 0 && !sa.checked; }; });
      $$('[data-sa]', b).forEach(function (x) { x.onclick = function (ev) { ev.stopPropagation(); }; x.onchange = function () { var sid = x.dataset.sa; P.sets.filter(function (z) { return z.setId === sid; })[0].questions.filter(match).forEach(function (q) { if (x.checked) sel[q.qId] = 1; else delete sel[q.qId]; }); open[sid] = 1; drawList(); }; });
      $$('.pk-set>header', b).forEach(function (hd) { hd.onclick = function (ev) { if (ev.target.tagName === 'INPUT') return; var sec = hd.parentNode, sid = sec.dataset.s; if (open[sid]) delete open[sid]; else open[sid] = 1; sec.classList.toggle('open'); }; });
    }
    if (!$('#pkWrap', b)) return;
    $('#pkWrap', b).innerHTML = '<p class="muted sm">ติ๊กเลือกข้อที่ต้องการจากทุกชุดในคลัง (' + (grp === 'T' ? 'ชุดคิดคะแนน' : 'ชุดทัศนคติ/บุคลิกภาพ') + ') · ข้อที่เลือกจะเรียงตามชุด และตามลำดับในชุด · ข้อที่ปิดใช้ในคลังก็เลือกได้ · ไม่ต้องเข้าไปเปิด/ปิดข้อในคลังอีก</p>' +
      '<div class="pk-sum"><span>เลือกแล้ว <b id="pkN">0</b> ข้อ</span>' + (grp === 'T' ? '<span>รวม <b id="pkP">0</b> คะแนน</span>' : '<span hidden id="pkP"></span>') + '<span>จาก <b id="pkS">0</b> ชุด</span><span class="sp"></span><button type="button" class="btn sm ghost-dark" id="pkNone">ล้างทั้งหมด</button></div>' +
      '<div class="pk-head"><input class="srch" id="pkQ" placeholder="ค้นหาจากโจทย์หรือหมวด" autocomplete="off"><select id="pkT"><option value="">ทุกชนิดข้อสอบ</option>' + Object.keys(types).map(function (t) { return '<option value="' + t + '">' + esc(qtTh(t)) + '</option>'; }).join('') + '</select><label class="chk"><input type="checkbox" id="pkO"> แสดงเฉพาะข้อที่เลือก</label></div>' +
      '<div class="pk-list" id="pkL"></div><div class="modal-act"><button type="button" class="btn ghost-dark" id="pkX">ยกเลิก</button><button type="button" class="btn primary" id="pkOk">' + ICON.check + 'ใช้ข้อที่เลือก</button></div>';
    drawList();
    $('#pkQ', b).oninput = function () { st.q = this.value.trim().toLowerCase(); drawList(); };
    $('#pkT', b).onchange = function () { st.type = this.value; drawList(); };
    $('#pkO', b).onchange = function () { st.only = this.checked; drawList(); };
    $('#pkNone', b).onclick = function () { sel = {}; drawList(); };
    $('#pkX', b).onclick = closeModal;
    $('#pkOk', b).onclick = function () {
      var ids = Object.keys(sel).filter(function (id) { return P.qmap[id]; });
      if (!ids.length) return toast('กรุณาเลือกอย่างน้อย 1 ข้อ', 'warn');
      ids.sort(function (a, c) { var x = P.qmap[a], y = P.qmap[c], kx = s.sets.indexOf(x.setId), ky = s.sets.indexOf(y.setId); kx = kx < 0 ? 999 + P.sets.filter(function (z) { return z.setId === x.setId; })[0].k : kx; ky = ky < 0 ? 999 + P.sets.filter(function (z) { return z.setId === y.setId; })[0].k : ky; return kx - ky || x.j - y.j; });
      var sets = []; ids.forEach(function (id) { var sid = P.qmap[id].setId; if (sets.indexOf(sid) < 0) sets.push(sid); });
      s.sets = sets; s.qids = ids; pickPts(s); closeModal(); toast('เลือก ' + ids.length + ' ข้อ จาก ' + sets.length + ' ชุด แล้ว — อย่าลืมกด "บันทึกการตั้งค่า"', 'ok', 6000); done();
    };
  }).catch(function (e) { closeModal(); toast(e.message, 'bad'); });
}

/* ---------- ② ค่าตั้งการคัดเลือกและการแจ้งผล ---------- */
function cfgCard(ex, ro) {
  var c = ex.cfg || {}, v = c.ivs || {}, dis = ro ? ' disabled' : '';
  return '<div class="card"><div class="card-head"><div><h2 class="card-t">การคัดเลือกและการแจ้งผล</h2><p class="card-s">ผู้ผ่านการคัดเลือก = ผู้ที่ผ่านเกณฑ์และคะแนนสูงสุดตามจำนวนอัตราที่รับ · ลำดับถัดไปเป็นตัวสำรอง · คะแนนเท่ากัน: สัมภาษณ์สูงกว่า → ภาคปฏิบัติสูงกว่า → ยังเท่ากันระบบแจ้งให้คณะกรรมการตัดสิน</p></div></div>' +
    '<div class="form"><div class="cfg-g"><label>จำนวนที่รับ (อัตรา)<input id="cfSeats" type="number" min="0" max="500" value="' + (c.seats || '') + '" placeholder="เช่น 1"' + dis + '></label><label>จำนวนตัวสำรอง (ลำดับ)<input id="cfRes" type="number" min="0" max="500" value="' + (c.reserves || '') + '" placeholder="เช่น 2"' + dis + '></label>' +
    '<label class="chk" style="align-self:end"><input type="checkbox" id="cfShow"' + (c.showScore ? ' checked' : '') + dis + '> ให้ผู้เข้าสอบเห็นคะแนนส่วนที่ระบบตรวจ หลังส่งแต่ละตอน</label></div>' +
    '<div class="se-l">กำหนดการสอบสัมภาษณ์ — ใช้ในอีเมล "ผ่านข้อเขียน · มีสิทธิ์สอบสัมภาษณ์"</div><div class="cfg-g"><label>วันสัมภาษณ์<input id="cfIvD" maxlength="100" value="' + esc(v.date || '') + '" placeholder="เช่น วันศุกร์ที่ 13 พฤศจิกายน 2569"' + dis + '></label><label>สถานที่สัมภาษณ์<input id="cfIvP" maxlength="200" value="' + esc(v.place || '') + '" placeholder="เช่น ห้องประชุมลีลาวดี 3 ชั้น 4"' + dis + '></label>' +
    '<div class="row2"><label>เวลาเริ่ม<input id="cfIvS" type="time" value="' + esc(v.start || '') + '"' + dis + '></label><label>นาทีต่อคน<input id="cfIvM" type="number" min="0" max="240" value="' + (v.slot || '') + '" placeholder="20"' + dis + '></label></div></div>' +
    '<p class="muted sm">เวลาสัมภาษณ์ของแต่ละคน = เวลาเริ่ม + (ลำดับตามเลขประจำตัวสอบของผู้ที่ถูกเลือกเข้าสัมภาษณ์ − 1) × นาทีต่อคน · ไม่ใส่นาทีต่อคน = นัดเวลาเดียวกันทุกคน</p></div></div>';
}
function cfgPull(ex) {
  if (!$('#cfSeats')) return;
  ex.cfg = { seats: Number(val('cfSeats')) || 0, reserves: Number(val('cfRes')) || 0, showScore: $('#cfShow').checked,
    ivs: { date: val('cfIvD'), place: val('cfIvP'), start: val('cfIvS'), slot: Number(val('cfIvM')) || 0, note: ((ex.cfg || {}).ivs || {}).note || '' } };
}

/* ---------- ⑤ ผลการคัดเลือก ---------- */
var SEL_TAG = { MAIN: ['ผู้ผ่านการคัดเลือก', 'sel-main'], RESERVE: ['สำรอง', 'sel-res'], PASS: ['ผ่านเกณฑ์', 'ok'], FAIL: ['ไม่ผ่านเกณฑ์', 'bad'], WAIT: ['รอคะแนน', 'warn'], NOIV: ['ไม่ได้เข้าสัมภาษณ์', ''], ABSENT: ['ไม่ได้เข้าสอบ', ''] };
function selOn() { var d = BD.data; return !!(d && d.cfg && d.cfg.seats > 0 && d.sel); }
function selTag(c) {
  var s = c.sel; if (!s) return '–';
  var t = SEL_TAG[s.st] || [s.st, ''], txt = s.st === 'MAIN' ? (BD.data.cfg.seats > 1 ? 'ตัวจริง ลำดับ ' + s.n : 'ผู้ผ่านการคัดเลือก') : s.st === 'RESERVE' ? 'สำรองลำดับที่ ' + s.n : t[0];
  return '<span class="tag ' + t[1] + '">' + (s.st === 'MAIN' ? ICON.check : '') + txt + '</span>' + (s.tie ? ' <span class="tag tie" title="คะแนน สัมภาษณ์ และภาคปฏิบัติเท่ากันที่รอยต่อ — ให้คณะกรรมการตัดสิน">คะแนนเท่ากัน</span>' : '');
}
function selSummary() {
  var d = BD.data, s = d.sel, c = d.cfg || {};
  if (!s) return '';
  if (!c.seats) return '<div class="note info">ยังไม่ได้กำหนด<b>จำนวนอัตราที่รับและตัวสำรอง</b> — ตั้งได้ที่แท็บ <a href="#/staff/' + encodeURIComponent(d.exam.examId) + '/setup">ตั้งค่ารอบสอบ</a> หัวข้อ "การคัดเลือกและการแจ้งผล" แล้วระบบจะจัดตัวจริง/สำรองตามลำดับคะแนนให้เอง</div>';
  var main = d.candidates.filter(function (x) { return x.sel && x.sel.st === 'MAIN'; }).sort(function (a, b) { return a.sel.n - b.sel.n; }), res = d.candidates.filter(function (x) { return x.sel && x.sel.st === 'RESERVE'; }).sort(function (a, b) { return a.sel.n - b.sel.n; });
  var nm = function (x) { return '<b class="cno">' + esc(no3(x.examNo)) + '</b> ' + esc(x.name || x.nameIv || ''); };
  return '<div class="card"><div class="card-head"><div><h2 class="card-t">ผลการคัดเลือก</h2><p class="card-s">รับ ' + c.seats + ' อัตรา · สำรอง ' + c.reserves + ' ลำดับ · จากผู้ผ่านเกณฑ์ร้อยละ ' + d.exam.passPct + (d.exam.ivOn ? ' ของคะแนนรวม (สอบ ' + (100 - d.exam.ivWeight) + ' : สัมภาษณ์ ' + d.exam.ivWeight + ')' : '') + ' เรียงตามลำดับคะแนน</p></div></div>' +
    (s.pending ? '<div class="note warn">ยังมีผู้เข้าสอบที่คะแนนไม่ครบ ' + s.pending + ' คน — ผลด้านล่างเป็น<b>ผลเบื้องต้น</b> อาจเปลี่ยนเมื่อตรวจครบ</div>' : '') +
    (s.tie ? '<div class="note bad"><b>มีคะแนนเท่ากันที่รอยต่อ</b> (คะแนนรวม สัมภาษณ์ และภาคปฏิบัติเท่ากัน) — คณะกรรมการต้องพิจารณาตัดสินลำดับ และบันทึกเหตุผลในรายงานการประชุม</div>' : '') +
    '<div class="selbox"><div class="s-main"><b>' + s.nMain + '/' + c.seats + '</b><span>ผู้ผ่านการคัดเลือก (ตัวจริง)</span></div><div class="s-res"><b>' + s.nRes + '/' + c.reserves + '</b><span>ตัวสำรอง</span></div><div><b>' + s.nElig + '</b><span>ผู้ผ่านเกณฑ์ทั้งหมด</span></div><div><b>' + s.pending + '</b><span>รอคะแนน</span></div></div>' +
    (main.length ? '<p><b>ตัวจริง:</b> ' + main.map(nm).join(' · ') + '</p>' : '') + (res.length ? '<p class="mt6"><b>สำรอง:</b> ' + res.map(function (x) { return 'ลำดับที่ ' + x.sel.n + ' ' + nm(x); }).join(' · ') + '</p>' : '') + '</div>';
}

function ivConfTag(c) {
  var x = c.ivConfirm; if (!x) return c.iv ? '<span class="muted sm">ยังไม่ตอบ</span>' : '';
  return '<span class="ivconf ' + (x.answer === 'YES' ? 'y' : 'n') + '">' + (x.answer === 'YES' ? '✓ ยืนยันมาสัมภาษณ์' : '✕ แจ้งไม่สะดวก') + '<br><small class="muted">' + tDate(x.at) + ' ' + tTime(x.at) + '</small></span>';
}
/** หมายเหตุในหน้าเขียนอีเมล "ผ่านข้อเขียน มีสิทธิ์สอบสัมภาษณ์" */
function ivMailNote() {
  var d = BD.data, v = (d.cfg || {}).ivs || {}, nIv = d.candidates.filter(function (c) { return c.iv; }).length, link = '<a href="#/staff/' + encodeURIComponent(d.exam.examId) + '/setup">ตั้งค่ารอบสอบ</a>';
  if (!v.date) return '<div class="note warn">ยังไม่ได้กำหนด<b>วัน เวลา และสถานที่สัมภาษณ์</b> — ตั้งได้ที่แท็บ ' + link + ' หัวข้อ "การคัดเลือกและการแจ้งผล" ระบบจะใส่ให้ในอีเมลของแต่ละคน</div>';
  return '<div class="note info"><b>กำหนดการสัมภาษณ์:</b> ' + esc(v.date) + (v.start ? ' เริ่ม ' + esc(v.start.replace(':', '.')) + ' น.' + (v.slot ? ' คนละ ' + v.slot + ' นาที (เรียงตามเลขประจำตัวสอบของผู้เข้าสัมภาษณ์)' : '') : '') + (v.place ? ' · ' + esc(v.place) : '') + ' · แก้ได้ที่แท็บ ' + link +
    (d.exam.ivOn ? (nIv ? '<br>ผู้ที่ถูกเลือกเข้าสัมภาษณ์ ' + nIv + ' คน — ผู้สมัครกดปุ่ม "ยืนยันเข้ารับการสอบสัมภาษณ์" ในอีเมลได้ และดูผลการตอบรับที่แท็บสัมภาษณ์' : '<br><b>ยังไม่ได้เลือกผู้เข้าสัมภาษณ์</b> — เลือกที่แท็บสัมภาษณ์ก่อน เพื่อให้ระบบจัดเวลารายคนและเปิดลิงก์ยืนยันได้') : '<br>รอบนี้ยังไม่ได้เปิดใช้การสัมภาษณ์ในระบบ (ลิงก์ยืนยันใช้ได้เมื่อเปิดใช้และเลือกผู้เข้าสัมภาษณ์แล้ว)') + '</div>';
}

/* ---------- ③ แท็บผลรายบุคคล ---------- */
function okMark(it) {
  if (it.profile) return '<span class="okc e">–</span>';
  if (it.manual || it.kind === 'PRACTICAL') return '<span class="okc m">' + (it.score === null ? 'รอตรวจ' : 'กรรมการ') + '</span>';
  if (it.blank) return '<span class="okc e" title="ไม่ได้ตอบ">–</span>';
  return it.ok === true ? '<span class="okc y" title="ถูก">✓</span>' : it.ok === 'part' ? '<span class="okc p" title="ถูกบางส่วน">½</span>' : '<span class="okc n" title="ผิด">✗</span>';
}
function lines(a) { return (a || []).length ? a.map(function (x) { return '<div>' + esc(x) + '</div>'; }).join('') : '<span class="muted">– ไม่ได้ตอบ –</span>'; }
function tabPerson() {
  var d = BD.data, st = tabPerson.st = tabPerson.st && tabPerson.st.id === BD.id ? tabPerson.st : { id: BD.id, no: '', f: 'all', cache: {} };
  var list = d.candidates.filter(function (c) { return c.result && c.result.started; }).sort(byNo);
  if (!list.length) { $('#tab').innerHTML = '<div class="card"><p class="muted">ยังไม่มีผู้เข้าสอบเริ่มทำข้อสอบ</p></div>'; return; }
  if (!st.no || !list.some(function (c) { return c.examNo === st.no; })) st.no = list[0].examNo;
  var idx = list.map(function (c) { return c.examNo; }).indexOf(st.no);
  var head = '<div class="card"><div class="pv-bar"><button class="icon-btn dark" id="pvPrev" title="คนก่อนหน้า"' + (idx <= 0 ? ' disabled' : '') + '>' + ICON.back + '</button><select id="pvSel">' + list.map(function (c) {
    var r = c.result; return '<option value="' + esc(c.examNo) + '"' + (c.examNo === st.no ? ' selected' : '') + '>' + esc(no3(c.examNo)) + ' ' + esc(c.name || '') + ' — ' + (r.total !== null ? num(r.total) + '/' + d.totals.totalMax + ' คะแนน' : 'ไม่มีคะแนน') + (r.rank ? ' · ลำดับ ' + r.rank : '') + '</option>';
  }).join('') + '</select><button class="icon-btn dark" id="pvNext" title="คนถัดไป"' + (idx >= list.length - 1 ? ' disabled' : '') + '><span style="display:inline-flex;transform:scaleX(-1)">' + ICON.back + '</span></button><span class="sp" style="flex:1"></span>' +
    '<button class="btn ghost-dark sm" id="pvP1">' + ICON.print + 'พิมพ์รายงานคนนี้</button><button class="btn ghost-dark sm" id="pvPA">' + ICON.print + 'พิมพ์ทุกคน (' + list.length + ' คน)</button></div>' +
    '<div class="pvfilter">' + [['all', 'ทุกข้อ'], ['wrong', 'เฉพาะข้อที่ผิด/ไม่ตอบ'], ['manual', 'เฉพาะข้อที่กรรมการตรวจ']].map(function (x) { return '<button class="chip' + (st.f === x[0] ? ' on' : '') + '" data-f="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></div><div id="pvBody"></div>';
  $('#tab').innerHTML = head;
  var go = function (no) { st.no = no; tabPerson(); };
  $('#pvSel').onchange = function () { go(this.value); };
  $('#pvPrev').onclick = function () { if (idx > 0) go(list[idx - 1].examNo); };
  $('#pvNext').onclick = function () { if (idx < list.length - 1) go(list[idx + 1].examNo); };
  $$('.pvfilter [data-f]').forEach(function (x) { x.onclick = function () { st.f = x.dataset.f; tabPerson(); }; });
  $('#pvP1').onclick = function () { printCandReport(st.no, this); };
  $('#pvPA').onclick = function () { printCandReport('', this); };
  var c = list[idx], body = $('#pvBody'), hit = st.cache[st.no];
  var draw = function (rp) { if (BD.tab !== 'person' || st.no !== c.examNo || !$('#pvBody')) return; $('#pvBody').innerHTML = personHtml(c, rp.cands[0], rp.graders, st.f); };
  if (hit && Date.now() - hit.at < 60000 && hit.bdAt === BD.at) return draw(hit.r);
  body.innerHTML = '<div class="boot"><div class="boot-ring"></div><p>กำลังโหลดคำตอบรายข้อ…</p></div>';
  api('getCandReport', { examId: BD.id, examNo: st.no }).then(function (r) { st.cache[c.examNo] = { at: Date.now(), bdAt: BD.at, r: r }; draw(r); }).catch(function (e) { body.innerHTML = '<div class="note bad">' + esc(e.message) + '</div>'; });
}
function personHtml(c, rp, graders, f) {
  var d = BD.data, r = c.result, fin = c.final, tot = { right: 0, part: 0, wrong: 0, blank: 0 };
  rp.secs.forEach(function (s) { ['right', 'part', 'wrong', 'blank'].forEach(function (k) { if (s.type === 'THEORY') tot[k] += s.sum[k]; }); });
  var gname = function (g) { return (graders || {})[g] || gName(g); };
  var h = '<div class="card"><div class="pv-head"><div class="pv-no">' + esc(no3(c.examNo)) + '</div><div><h2>' + esc(rp.name) + '</h2><p class="muted">' + esc(d.exam.title) + '</p><p class="mt6">' + (r.complete ? (r.pass ? '<span class="tag ok">ผ่านเกณฑ์สอบ</span>' : '<span class="tag bad">ไม่ผ่านเกณฑ์สอบ</span>') : '<span class="tag warn">รอตรวจ</span>') + ' ' + (selOn() && c.sel ? selTag(c) : '') + '</p></div>' +
    '<div class="pv-sum"><div class="pv-chip"><b>' + num(r.total) + '</b><span>คะแนนสอบ /' + d.totals.totalMax + '</span></div>' + (fin && fin.score !== null ? '<div class="pv-chip"><b>' + num(fin.score) + '</b><span>คะแนนรวม /100</span></div>' : '') + '<div class="pv-chip"><b>' + (d.exam.ivOn && fin ? (fin.rank || '–') : (r.rank || '–')) + '</b><span>ลำดับ</span></div>' +
    '<div class="pv-chip ok"><b>' + tot.right + '</b><span>ข้อถูก</span></div>' + (tot.part ? '<div class="pv-chip warn"><b>' + tot.part + '</b><span>ถูกบางส่วน</span></div>' : '') + '<div class="pv-chip bad"><b>' + tot.wrong + '</b><span>ข้อผิด</span></div><div class="pv-chip"><b>' + tot.blank + '</b><span>ไม่ตอบ</span></div></div></div></div>';
  rp.secs.forEach(function (s) {
    var sm = s.sum, n = sm.n || 1, isP = s.type === 'PROFILE';
    var items = s.items.filter(function (it) { return f === 'all' || (f === 'wrong' ? (!it.manual && it.kind !== 'PRACTICAL' && !it.profile && it.ok !== true) : (it.manual || it.kind === 'PRACTICAL')); });
    if (f !== 'all' && !items.length) return;
    h += '<div class="card pv-sec"><header><h3>' + esc(s.title) + '</h3><small>' + (s.status === 'NEW' ? 'ยังไม่ได้เริ่ม' : s.status === 'DONE' ? 'ส่งแล้ว ' + (s.submitAt ? tTime(s.submitAt) + ' น.' : '') : 'กำลังทำ') + (s.blur ? ' · ออกจากหน้าจอ ' + s.blur + ' ครั้ง' : '') + '</small><span style="flex:1"></span>' +
      (s.type === 'THEORY' ? '<span class="tag info">ระบบตรวจ ' + num(sm.auto) + '/' + num(sm.autoMax) + '</span>' + (sm.manualMax ? ' <span class="tag">กรรมการ ' + (sm.manualPending ? 'รอตรวจ ' + sm.manualPending + ' ข้อ' : num(sm.manual) + '/' + num(sm.manualMax)) + '</span>' : '') : s.type === 'PRACTICAL' ? '<span class="tag">' + (sm.manualPending ? 'รอตรวจ' : num(sm.manual) + '/' + num(sm.manualMax)) + '</span>' : '<span class="tag">ไม่คิดคะแนน</span>') + '</header>';
    if (s.type === 'THEORY' && sm.n) h += '<div class="pvbar" title="ถูก ' + sm.right + ' · บางส่วน ' + sm.part + ' · ผิด ' + sm.wrong + ' · ไม่ตอบ ' + sm.blank + '"><i class="r" style="width:' + (sm.right / n * 100) + '%"></i><i class="p" style="width:' + (sm.part / n * 100) + '%"></i><i class="w" style="width:' + (sm.wrong / n * 100) + '%"></i><i class="b" style="width:' + (sm.blank / n * 100) + '%"></i></div>';
    if (s.type === 'PRACTICAL') h += '<p class="sm">ไฟล์ที่ส่ง: ' + (s.fileName ? '<b>' + esc(s.fileName) + '</b> · ' + tTime(s.fileAt) + ' น.' : '<span class="bad-t">ไม่ได้ส่งไฟล์</span>') + '</p>';
    h += (isP ? '<details><summary class="btn link">แสดงคำตอบ ' + items.length + ' ข้อ (ไม่คิดคะแนน)</summary>' : '') + '<div class="tblwrap"><table class="tbl pvt"><thead><tr><th class="c">ข้อ</th><th>โจทย์</th>' + (s.type === 'PRACTICAL' ? '<th>คะแนนรายกรรมการ</th>' : '<th>คำตอบของผู้เข้าสอบ</th>' + (isP ? '' : '<th>เฉลย / เกณฑ์</th>')) + '<th class="c">ผล</th>' + (isP ? '' : '<th class="r">คะแนน</th>') + '</tr></thead><tbody>' +
      items.map(function (it) {
        var cls = it.ok === true ? 'right' : (it.ok === false && !it.manual && !it.profile && it.kind !== 'PRACTICAL') ? 'wrong' : '';
        var gl = (it.grades || []).map(function (g) { return '<div>' + esc(gShort ? gShort(g.g) : gname(g.g)) + ': <b>' + num(g.s) + '</b>' + (g.c ? ' <small class="muted">' + esc(g.c) + '</small>' : '') + '</div>'; }).join('');
        if (s.type === 'PRACTICAL') return '<tr><td class="c">' + it.n + '</td><td class="q">' + esc(it.text) + '</td><td>' + (gl || '<span class="muted">ยังไม่มีคะแนน</span>') + '</td><td class="c">' + okMark(it) + '</td><td class="r"><b>' + (it.score === null ? '–' : num(it.score)) + '</b>/' + num(it.max) + '</td></tr>';
        var key = it.manual ? (it.rubric ? '<details><summary class="sm">ดูเกณฑ์ให้คะแนน</summary><div class="sm" style="white-space:pre-wrap">' + esc(it.rubric) + '</div></details>' : '') + (gl ? '<div class="sm mt6">' + gl + '</div>' : '') : lines(it.key);
        return '<tr class="' + cls + '"><td class="c">' + it.n + '</td><td class="q">' + esc(String(it.text).length > 220 ? String(it.text).slice(0, 220) + '…' : it.text) + '<small>' + esc(qtTh(it.type)) + (it.cat ? ' · ' + esc(it.cat) : '') + '</small></td><td class="ans' + (it.manual && (it.ans[0] || '').length > 160 ? ' long' : '') + '">' + lines(it.ans) + '</td>' + (isP ? '' : '<td class="key">' + key + '</td>') + '<td class="c">' + okMark(it) + '</td>' + (isP ? '' : '<td class="r nowrap"><b>' + (it.score === null ? '–' : num(it.score)) + '</b>/' + num(it.max) + '</td>') + '</tr>';
      }).join('') + '</tbody></table></div>' + (isP ? '</details>' : '') + '</div>';
  });
  return h;
}
/** พิมพ์รายงานรายข้อ: no = '' → ทุกคนที่เข้าสอบ */
function printCandReport(no, btn) {
  if (btn) busy(btn, true, 'กำลังเตรียมเอกสาร…');
  Promise.all([api('getCandReport', { examId: BD.id, examNo: no }, { timeout: 180000 }), api('logPrint', { examId: BD.id, type: 'CAND', scope: no || 'ALL' }, { quiet: true })]).then(function (x) {
    if (btn) busy(btn, false);
    var rp = x[0], m = x[1], d = BD.data, byNo2 = {}; d.candidates.forEach(function (c) { byNo2[c.examNo] = c; });
    var html = rp.cands.map(function (rc, k) { return docCandReport(byNo2[rc.examNo] || { examNo: rc.examNo, result: {} }, rc, rp.graders, m, k === rp.cands.length - 1); }).join('');
    printDoc(html, { portrait: true, code: m.code, at: m.at, title: 'รายงานผลสอบรายข้อ ' + (no ? 'เลขประจำตัวสอบ ' + no3(no) : 'ทุกคน ' + rp.cands.length + ' คน') });
  }).catch(function (e) { if (btn) busy(btn, false); toast(e.message, 'bad'); });
}
function docCandReport(c, rc, graders, meta, last) {
  var d = BD.data, e = d.exam, r = c.result || {}, fin = c.final, gname = function (g) { return (graders || {})[g] || g; };
  var tot = { right: 0, part: 0, wrong: 0, blank: 0 }; rc.secs.forEach(function (s) { if (s.type === 'THEORY') ['right', 'part', 'wrong', 'blank'].forEach(function (k) { tot[k] += s.sum[k]; }); });
  var mk = function (it) { return it.profile ? '–' : it.manual || it.kind === 'PRACTICAL' ? (it.score === null ? 'รอ' : 'กก.') : it.blank ? '–' : it.ok === true ? '✓' : it.ok === 'part' ? '½' : '✗'; };
  var h = prHead('รายงานผลการสอบรายข้อ (รายบุคคล)', [e.title, examWhen(e)]) +
    '<div class="cr-h"><div><b>' + esc(no3(rc.examNo)) + ' · ' + esc(rc.name) + '</b><br>คะแนนสอบ ' + num(r.total) + ' / ' + d.totals.totalMax + (fin && fin.score !== null ? ' · คะแนนรวม ' + num(fin.score) + ' / 100' : '') + ' · ลำดับที่ ' + ((e.ivOn && fin ? fin.rank : r.rank) || '–') + '</div><div style="text-align:right">ถูก ' + tot.right + (tot.part ? ' · บางส่วน ' + tot.part : '') + ' · ผิด ' + tot.wrong + ' · ไม่ตอบ ' + tot.blank + '<br>' + (r.complete ? (r.pass ? 'ผ่านเกณฑ์สอบ' : 'ไม่ผ่านเกณฑ์สอบ') : 'รอตรวจ') + (c.sel && SEL_TAG[c.sel.st] ? ' · ' + (c.sel.st === 'RESERVE' ? 'สำรองลำดับที่ ' + c.sel.n : SEL_TAG[c.sel.st][0]) : '') + '</div></div>';
  rc.secs.forEach(function (s) {
    var sm = s.sum, isP = s.type === 'PROFILE';
    h += '<div class="cr-s">' + esc(s.title) + ' — ' + (s.type === 'THEORY' ? 'ระบบตรวจ ' + num(sm.auto) + '/' + num(sm.autoMax) + (sm.manualMax ? ' · กรรมการ ' + (sm.manualPending ? 'รอตรวจ' : num(sm.manual) + '/' + num(sm.manualMax)) : '') : s.type === 'PRACTICAL' ? 'ภาคปฏิบัติ ' + (sm.manualPending ? 'รอตรวจ' : num(sm.manual) + '/' + num(sm.manualMax)) + (s.fileName ? ' · ไฟล์ ' + esc(s.fileName) : ' · ไม่ได้ส่งไฟล์') : 'ไม่คิดคะแนน') + '</div>';
    if (s.type === 'PRACTICAL') { h += '<table class="cr-t"><thead><tr><th class="c">ที่</th><th>หัวข้อ</th><th>คะแนนรายกรรมการ</th><th class="c">เฉลี่ย</th></tr></thead><tbody>' + s.items.map(function (it) { return '<tr><td class="c">' + it.n + '</td><td>' + esc(it.text) + '</td><td>' + (it.grades || []).map(function (g) { return esc(gname(g.g)) + ' ' + num(g.s); }).join('<br>') + '</td><td class="c">' + (it.score === null ? '–' : num(it.score)) + '/' + num(it.max) + '</td></tr>'; }).join('') + '</tbody></table>'; return; }
    h += '<table class="cr-t"><thead><tr><th class="c">ข้อ</th><th class="q">โจทย์</th><th>คำตอบ</th>' + (isP ? '' : '<th>เฉลย</th><th class="c">ผล</th><th class="c">คะแนน</th>') + '</tr></thead><tbody>' +
      s.items.map(function (it) {
        var ans = it.manual ? String((it.ans || [])[0] || '– ไม่ได้ตอบ –') : (it.ans || []).join('\n') || '–';
        return '<tr><td class="c">' + it.n + '</td><td class="q">' + esc(String(it.text).length > 260 ? String(it.text).slice(0, 260) + '…' : it.text) + '</td><td style="white-space:pre-wrap">' + esc(ans.length > 900 ? ans.slice(0, 900) + '…' : ans) + '</td>' + (isP ? '' :
          '<td style="white-space:pre-wrap">' + (it.manual ? (it.grades || []).map(function (g) { return esc(gname(g.g)) + ' ' + num(g.s); }).join('\n') || 'รอตรวจ' : esc((it.key || []).join('\n'))) + '</td><td class="c mk">' + mk(it) + '</td><td class="c">' + (it.score === null ? '–' : num(it.score)) + '/' + num(it.max) + '</td>') + '</tr>';
      }).join('') + '</tbody></table>';
  });
  h += '<p class="pr-small">✓ = ถูก · ½ = ถูกบางส่วน · ✗ = ผิด · – = ไม่ได้ตอบ · กก. = คะแนนจากกรรมการ (ค่าเฉลี่ยของกรรมการทุกท่าน)</p>';
  return '<section class="pr' + (last ? '' : ' pr-break') + '">' + h + '</section>';
}

/* ---------- ④ ข้อสอบฉบับพิมพ์กระดาษ ---------- */
function printPaper(withKey, btn) {
  var run = function (pass) {
    if (btn) busy(btn, true, 'กำลังเตรียมข้อสอบ…');
    Promise.all([api('getExamPaper', { examId: BD.id, withKey: withKey, password: pass || '' }, { timeout: 120000 }), api('logPrint', { examId: BD.id, type: withKey ? 'PAPERK' : 'PAPER', scope: '' }, { quiet: true })]).then(function (x) {
      if (btn) busy(btn, false); var m = x[1];
      printDoc(docPaper(x[0]), { portrait: true, code: m.code, at: m.at, title: 'ข้อสอบฉบับพิมพ์' + (withKey ? 'พร้อมเฉลย (เอกสารลับ)' : ' (ไม่มีเฉลย)') });
    }).catch(function (e) { if (btn) busy(btn, false); toast(e.message, 'bad'); });
  };
  if (!withKey) return run('');
  askPass('พิมพ์ข้อสอบพร้อมเฉลย', '<div class="note warn">เอกสารนี้มีเฉลยและเกณฑ์ให้คะแนน — เก็บเป็นความลับ ระบบบันทึกผู้พิมพ์และเวลาไว้</div>', 'พิมพ์ข้อสอบพร้อมเฉลย').then(function (p) { if (p) run(p.password); });
}
function docPaper(pp) {
  var e = pp.exam, o = hosp(), key = pp.withKey, n = 0;
  var secMax = pp.sections.reduce(function (a, s) { return a + s.maxScore; }, 0), mins = pp.sections.reduce(function (a, s) { return a + s.minutes; }, 0);
  var h = '<div class="pp-h"><img class="an-logo" src="' + esc(logoSrc()) + '" alt="" style="height:20mm"><h1>' + esc(e.title) + '</h1><p>' + esc(o.name + ' ' + o.sub) + '</p><p>' + esc(examWhen(e)) + ' · คะแนนเต็ม ' + num(secMax) + ' คะแนน · เวลา ' + mins + ' นาที</p>' + (key ? '<p style="font-weight:700;color:#b00">ฉบับมีเฉลย — เอกสารลับเฉพาะกรรมการ</p>' : '') + '</div>';
  if (!key) h += '<div class="pp-id"><span>เลขประจำตัวสอบ ..................</span><span>ชื่อ-สกุล ......................................................................</span></div>';
  pp.sections.forEach(function (s) {
    h += '<div class="pp-sec">' + esc(s.title) + ' · ' + s.minutes + ' นาที' + (s.maxScore ? ' · ' + num(s.maxScore) + ' คะแนน' : ' · ไม่คิดคะแนน') + '</div>' + (s.instructions ? '<div class="pp-ins">' + esc(s.instructions) + '</div>' : '');
    if (s.type === 'PRACTICAL') { h += '<p class="pp-ins">ภาคปฏิบัติ: ทำในไฟล์ ' + esc(s.tplName || 'ที่กรรมการแจกให้') + '</p><table class="cr-t"><thead><tr><th>หัวข้อ</th><th class="c">คะแนน</th>' + (key ? '<th>แนวทางให้คะแนน</th>' : '') + '</tr></thead><tbody>' + (s.rubric || []).map(function (r) { return '<tr><td>' + esc(r.label) + '</td><td class="c">' + num(r.max) + '</td>' + (key ? '<td style="white-space:pre-wrap">' + esc(r.guide || '') + '</td>' : '') + '</tr>'; }).join('') + '</tbody></table>'; return; }
    s.questions.forEach(function (q) {
      n++; var t = q.type, ch = q.choices || [], body = '';
      if (t === 'MCQ' || t === 'MULTI' || t === 'SJT' || t === 'MBTI') body = '<ol' + (ch.every(function (x) { return String(x).length < 38; }) && ch.length >= 4 ? ' class="c2"' : '') + '>' + ch.map(function (x, i) { return '<li>' + (t === 'MULTI' ? '☐ ' : '○ ') + 'ก ข ค ง จ ฉ ช ซ'.split(' ')[i] + '. ' + esc(x) + '</li>'; }).join('') + '</ol>';
      else if (t === 'TF') body = '<table class="pp-tf">' + ch.map(function (x, i) { return '<tr><td>' + (i + 1) + ') ' + esc(x) + '</td><td>☐ ถูก</td><td>☐ ผิด</td></tr>'; }).join('') + '</table>';
      else if (t === 'MATCH') body = '<table class="pp-tf"><tr><td><b>รายการ</b></td><td><b>ตอบ</b></td><td><b>ตัวเลือก</b></td></tr>' + q.left.map(function (x, i) { return '<tr><td>' + (i + 1) + ') ' + esc(x) + '</td><td>......</td><td>' + (q.right[i] !== undefined ? 'ก ข ค ง จ ฉ ช ซ ฌ ญ'.split(' ')[i] + '. ' + esc(q.right[i]) : '') + '</td></tr>'; }).join('') + q.right.slice(q.left.length).map(function (x, j) { return '<tr><td></td><td></td><td>' + 'ก ข ค ง จ ฉ ช ซ ฌ ญ'.split(' ')[q.left.length + j] + '. ' + esc(x) + '</td></tr>'; }).join('') + '</table>';
      else if (t === 'ORDER') body = '<ol>' + ch.map(function (x, i) { return '<li>( .... ) ' + 'ก ข ค ง จ ฉ ช ซ'.split(' ')[i] + '. ' + esc(x) + '</li>'; }).join('') + '</ol>';
      else if (t === 'LIKERT') body = '<p>' + ch.map(function (x, i) { return '○ ' + (i + 1) + ' ' + esc(x); }).join('&nbsp;&nbsp; ') + '</p>';
      else if (t === 'TABLE') body = '<table class="pp-tf"><tr><td></td>' + q.cols.map(function (x) { return '<td><b>' + esc(x) + '</b></td>'; }).join('') + '</tr>' + q.rows.map(function (x) { return '<tr><td><b>' + esc(x) + '</b></td>' + q.cols.map(function () { return '<td style="height:14mm;width:' + Math.floor(120 / q.cols.length) + 'mm"></td>'; }).join('') + '</tr>'; }).join('') + '</table>';
      else if (!key && (t === 'ESSAY' || t === 'SHORT')) body = '<div class="pp-lines">' + '<div></div>'.repeat(t === 'ESSAY' ? 14 : 4) + '</div>';
      var k = key ? ((q.key && q.key.length ? '<div class="pp-key">เฉลย: ' + esc(q.key.join('\n')) + '</div>' : '') + (q.rubric ? '<div class="pp-key">เกณฑ์ให้คะแนน:\n' + esc(q.rubric) + '</div>' : '')) : '';
      h += '<div class="pp-q"><div class="qt"><b>' + n + '.</b> ' + esc(q.text) + (q.points ? ' <small>(' + num(q.points) + ' คะแนน)</small>' : '') + '</div>' + body + k + '</div>';
    });
  });
  return '<section class="pr">' + h + '</section>';
}
