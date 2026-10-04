/* =====================================================================
   SOMDEJ TalentGate · iv.js — รุ่น 1.2: สอบสัมภาษณ์ · เอกสารผู้สมัคร · ยืนยันคะแนน · รายงานสำหรับพิมพ์
   ===================================================================== */
var PART_TH = { EXAM: 'ข้อเขียน/ภาคปฏิบัติ', IV: 'สัมภาษณ์' };
var DOC_KIND_DEF = ['ใบสมัคร', 'ประวัติย่อ (Resume)', 'วุฒิการศึกษา', 'ใบรับรองการทำงาน', 'ผลงาน/ใบประกาศ', 'อื่น ๆ'];
function byNo(a, b) { return Number(a.examNo) - Number(b.examNo) || (a.examNo < b.examNo ? -1 : 1); }
function ivCands() { return BD.data.candidates.filter(function (c) { return c.iv && c.status === 'ACTIVE'; }).sort(byNo); }
function ivName(c) { return c.name || c.nameIv || ''; }
function gName(g) { return (BD.data.graders || {})[g] || g; }
function signOf(g, part) { return BD.data.signoffs.filter(function (s) { return s.grader === g && s.part === part; })[0] || null; }
function r2(x) { return Math.round(x * 100) / 100; }
function kb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
/** คะแนนที่กรรมการ g ให้ในรายการ item (ผู้ดูแลเห็นทุกท่าน · กรรมการเห็นเฉพาะของตน) */
function byScore(c, src, item, g) {
  var d = BD.data, o = (c[src] || {})[item];
  if (g === d.me) { var m = c.my[item]; return m && m.score !== null && m.score !== undefined && !isNaN(m.score) ? m.score : null; }   // ของตนเอง: ใช้ค่าล่าสุดบนหน้าจอ
  if (d.isAdmin) { var x = ((o && o.by) || []).filter(function (b) { return b.g === g; })[0]; return x ? x.s : null; }
  return null;
}
function byTotal(c, src, items, g) {
  var s = 0, n = 0; items.forEach(function (it) { var v = byScore(c, src, it.item, g); if (v !== null) { s += v; n++; } });
  return { sum: n ? r2(s) : null, n: n, full: n > 0 && n === items.length };
}
/** กรรมการที่เกี่ยวข้องกับส่วนนั้น: คณะกรรมการของรอบสอบ + ผู้ที่ยืนยัน/ให้คะแนนแล้ว */
function gradersOf(part) {
  var d = BD.data, seen = {}, out = [];
  function add(g) { if (!seen[g]) { seen[g] = 1; out.push(g); } }
  d.exam.committee.forEach(function (m) { add(m.empCode); });
  d.signoffs.forEach(function (s) { if (s.part === part) add(s.grader); });
  if (d.isAdmin) d.candidates.forEach(function (c) {
    var src = part === 'IV' ? c.ivAvg : c.avg, items = part === 'IV' ? d.ivItems : d.items;
    items.forEach(function (it) { (((src || {})[it.item] || {}).by || []).forEach(function (b) { add(b.g); }); });
  });
  return out;
}
/** ความคืบหน้าการให้คะแนนของกรรมการ g ในส่วนนั้น → {n, need} (null = ไม่มีสิทธิ์เห็น) */
function gradeProgress(g, part) {
  var d = BD.data; if (!d.isAdmin && g !== d.me) return null;
  var items = part === 'IV' ? d.ivItems : d.items, src = part === 'IV' ? 'ivAvg' : 'avg';
  var list = part === 'IV' ? ivCands() : activeCands().filter(function (c) { return c.result.started; }), n = 0;
  list.forEach(function (c) { n += byTotal(c, src, items, g).n; });
  return { n: n, need: list.length * items.length };
}

/* ====================== เอกสารผู้สมัคร ====================== */
function loadDocs() {
  return api('getDocs', { examId: BD.id }).then(function (r) { r.examId = BD.id; BD.docs = r; return r; });
}
function docsOf(no) { return BD.docs && BD.docs.examId === BD.id ? (BD.docs.docs[no] || []) : []; }
function docChips(no) {
  var l = docsOf(no);
  return l.length ? l.map(function (x) { return '<button class="docchip" data-doc="' + esc(x.docId) + '" title="' + esc(x.name) + ' · ' + kb(x.size) + '">' + ICON.file + '<span><b>' + esc(x.kind) + '</b><small>' + esc(x.name) + '</small></span></button>'; }).join('') : '';
}
function findDoc(id) { var out = null; if (BD.docs) Object.keys(BD.docs.docs).forEach(function (k) { BD.docs.docs[k].forEach(function (x) { if (x.docId === id) out = x; }); }); return out; }
/** เปิดดูเอกสารในหน้าจอ (PDF/รูปภาพ) — ไฟล์ส่งผ่านระบบ ไม่ต้องแชร์ Google Drive */
function viewDoc(docId, onClose) {
  var x = findDoc(docId) || { name: 'เอกสาร', kind: '' }, url = null;
  var b = modal('<h2>' + esc(x.kind || 'เอกสาร') + '</h2><p class="muted sm">' + esc(x.name) + (x.size ? ' · ' + kb(x.size) : '') + '</p><div class="docview" id="dvB"><div class="boot"><div class="boot-ring"></div><p>กำลังเปิดเอกสาร…</p></div></div>' +
    '<div class="modal-act"><button class="btn ghost-dark" id="dvNew" disabled>เปิดในแท็บใหม่</button><button class="btn ghost-dark" id="dvDl" disabled>' + ICON.down + 'ดาวน์โหลด</button><button class="btn primary" id="dvX">ปิด</button></div>',
    { cls: 'xl', onClose: function () { if (url) setTimeout(function () { URL.revokeObjectURL(url); }, 60000); if (onClose) onClose(); } });
  $('#dvX', b).onclick = closeModal;
  api('getDoc', { docId: docId }, { timeout: 120000 }).then(function (r) {
    if (!$('#dvB')) return;
    var blob = b64Blob(r.b64, r.mime); url = URL.createObjectURL(blob);
    $('#dvB').innerHTML = /^image\//.test(r.mime) ? '<img class="docimg" src="' + url + '" alt="' + esc(r.name) + '">' : '<iframe class="docframe" src="' + url + '" title="' + esc(r.name) + '"></iframe>';
    $('#dvNew').disabled = false; $('#dvDl').disabled = false;
    $('#dvNew').onclick = function () { window.open(url, '_blank'); };
    $('#dvDl').onclick = function () { saveBlob(r.name, blob); };
  }).catch(function (e) { if ($('#dvB')) $('#dvB').innerHTML = '<div class="empty"><h3>เปิดเอกสารไม่ได้</h3><p class="muted">' + esc(e.message) + '</p></div>'; });
}
function bindDocChips(root, onClose) { $$('[data-doc]', root).forEach(function (x) { x.onclick = function () { viewDoc(x.dataset.doc, onClose); }; }); }
function guessKind(name) {
  var n = String(name).toLowerCase();
  return /resume|cv|ประวัติ/.test(n) ? 'ประวัติย่อ (Resume)' : /สมัคร|applic/.test(n) ? 'ใบสมัคร' : /transcript|วุฒิ|ปริญญา|degree|ใบรับรองผล/.test(n) ? 'วุฒิการศึกษา' : /รับรองการทำงาน|ผ่านงาน|experience/.test(n) ? 'ใบรับรองการทำงาน' : /cert|ประกาศ|ผลงาน|portfolio/.test(n) ? 'ผลงาน/ใบประกาศ' : 'อื่น ๆ';
}
function docFileOk(f, maxMb) {
  if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) return 'รับเฉพาะไฟล์ PDF, JPG หรือ PNG';
  if (f.size > maxMb * 1048576) return 'ไฟล์ใหญ่เกิน ' + maxMb + ' MB';
  if (!f.size) return 'ไฟล์ว่าง';
  return '';
}
/** อัปโหลดทีละไฟล์ตามลำดับ (ไฟล์ที่ผิดพลาดไม่ทำให้ไฟล์อื่นหยุด) → Promise<{ok, bad:[ข้อความ]}> */
function uploadDocs(list, onStep) {
  var ok = 0, bad = [], i = 0;
  function next() {
    if (i >= list.length) return Promise.resolve({ ok: ok, bad: bad });
    var it = list[i++]; if (onStep) onStep(i, list.length, it);
    return fileB64(it.file).then(function (b64) { return api('uploadDoc', { examId: BD.id, examNo: it.examNo, kind: it.kind, name: it.file.name, b64: b64 }, { timeout: 180000, quiet: true }); })
      .then(function () { ok++; }, function (e) { bad.push(it.file.name + ': ' + e.message); }).then(next);
  }
  // เสร็จแล้วอ่านรายการเอกสารล่าสุดจากระบบ (ไม่เดาเองบนหน้าจอ)
  return next().then(function (r) { return loadDocs().then(function () { return r; }, function () { return r; }); });
}
function docsChanged() { BD.at = 0; if (typeof AD !== 'undefined') AD.cands = null; if (BD.data && BD.docs) BD.data.candidates.forEach(function (c) { c.nDocs = docsOf(c.examNo).length; }); }
/** จัดการเอกสารของผู้สมัคร 1 คน (ผู้ดูแล) */
function docsBox(no, after) {
  var c = BD.data.candidates.filter(function (x) { return x.examNo === no; })[0], kinds = (BD.docs && BD.docs.kinds) || DOC_KIND_DEF, maxMb = (BD.docs && BD.docs.maxMb) || 10, ro = readonly();
  function draw() {
    var l = docsOf(no);
    var b = modal('<h2>เอกสารของเลขประจำตัวสอบ ' + esc(no3(no)) + '</h2><p class="muted">' + esc(ivName(c) || '') + ' · ไฟล์เก็บใน Google Drive ของระบบ แยกโฟลเดอร์ตามรอบสอบและผู้สมัคร · กรรมการเปิดดูได้เฉพาะผู้ที่ถูกเลือกเข้าสัมภาษณ์</p>' +
      (l.length ? '<div class="tblwrap"><table class="tbl sm"><thead><tr><th>ชนิด</th><th>ไฟล์</th><th class="r">ขนาด</th><th>อัปโหลดเมื่อ</th><th></th></tr></thead><tbody>' + l.map(function (x) {
        return '<tr><td><span class="tag info">' + esc(x.kind) + '</span></td><td><button class="btn link" data-doc="' + esc(x.docId) + '">' + esc(x.name) + '</button></td><td class="r nowrap">' + kb(x.size) + '</td><td class="nowrap">' + tDate(x.at) + '</td><td>' + (ro ? '' : '<button class="btn link danger-t" data-del="' + esc(x.docId) + '">ลบ</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty sm"><p class="muted">ยังไม่มีเอกสาร</p></div>') +
      (!ro ? '<form class="form docup" id="duF"><div class="se-l">เพิ่มเอกสาร (PDF, JPG, PNG · ไฟล์ละไม่เกิน ' + maxMb + ' MB · เลือกได้หลายไฟล์)</div><div class="row2"><label>ชนิดเอกสาร<select id="duK">' + kinds.map(function (k) { return '<option>' + esc(k) + '</option>'; }).join('') + '<option value="">เดาจากชื่อไฟล์</option></select></label><label>ไฟล์<input type="file" id="duI" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple required></label></div>' +
        '<p class="gsave" id="duS"></p><div class="modal-act"><button type="button" class="btn ghost-dark" id="duX">ปิด</button><button class="btn primary" id="duB">' + ICON.up + 'อัปโหลด</button></div></form>' : '<div class="modal-act"><button class="btn primary" id="duX">ปิด</button></div>'),
      { cls: 'lg', onClose: function () { if (after) after(); } });
    $('#duX', b).onclick = closeModal;
    bindDocChips(b, function () { draw(); });
    $$('[data-del]', b).forEach(function (x) {
      x.onclick = function () {
        var doc = findDoc(x.dataset.del); busy(x, true, 'กำลังลบ…');
        api('deleteDoc', { docId: x.dataset.del }).then(function () { return loadDocs(); }).then(function () { docsChanged(); toast('ลบ "' + doc.name + '" แล้ว', 'ok'); draw(); })
          .catch(function (e) { busy(x, false); toast(e.message, 'bad'); });
      };
    });
    if ($('#duF', b)) $('#duF', b).onsubmit = function (ev) {
      ev.preventDefault();
      var files = Array.prototype.slice.call($('#duI', b).files), k = $('#duK', b).value, err = '';
      files.forEach(function (f) { var m = docFileOk(f, maxMb); if (m && !err) err = f.name + ': ' + m; });
      if (err) return toast(err, 'bad');
      var bt = $('#duB', b); busy(bt, true, 'กำลังอัปโหลด…');
      uploadDocs(files.map(function (f) { return { file: f, examNo: no, kind: k || guessKind(f.name) }; }), function (i, n, it) { if ($('#duS')) { $('#duS').className = 'gsave'; $('#duS').textContent = 'กำลังอัปโหลด ' + i + ' / ' + n + ' — ' + it.file.name; } })
        .then(function (r) { docsChanged(); toast('อัปโหลดแล้ว ' + r.ok + ' ไฟล์' + (r.bad.length ? ' · ไม่สำเร็จ ' + r.bad.length + ' ไฟล์: ' + r.bad[0] : ''), r.bad.length ? 'bad' : 'ok', r.bad.length ? 9000 : 0); draw(); });
    };
  }
  if (BD.docs && BD.docs.examId === BD.id) draw(); else loadDocs().then(draw).catch(function (e) { toast(e.message, 'bad'); });
}
/** อัปโหลดเอกสารหลายคนพร้อมกัน: ชื่อไฟล์ขึ้นต้นด้วยเลขประจำตัวสอบ เช่น 007_resume.pdf (ผู้ดูแล) */
function docsBulkBox(after) {
  var cands = {}, maxMb = (BD.docs && BD.docs.maxMb) || 10, kinds = (BD.docs && BD.docs.kinds) || DOC_KIND_DEF, rows = [];
  BD.data.candidates.forEach(function (c) { cands[c.examNo] = c; });
  var b = modal('<h2>อัปโหลดเอกสารผู้สมัครหลายคน</h2><p class="muted">ตั้งชื่อไฟล์ให้<b>ขึ้นต้นด้วยเลขประจำตัวสอบ</b> เช่น <code>007_resume.pdf</code>, <code>7 ใบสมัคร.pdf</code>, <code>012-transcript.jpg</code> แล้วเลือกทุกไฟล์พร้อมกัน ระบบจะจับคู่กับผู้สมัครและจัดเก็บแยกโฟลเดอร์ให้ · PDF, JPG, PNG ไฟล์ละไม่เกิน ' + maxMb + ' MB</p>' +
    '<label class="btn ghost-dark">' + ICON.up + 'เลือกไฟล์<input type="file" id="dbI" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple hidden></label><div id="dbP" class="imprev"></div><p class="gsave" id="dbS"></p>' +
    '<div class="modal-act"><button class="btn ghost-dark" id="dbX">ปิด</button><button class="btn primary" id="dbB" disabled>อัปโหลด</button></div>', { cls: 'lg', onClose: function () { if (after) after(); } });
  $('#dbX', b).onclick = closeModal;
  function draw() {
    var okN = rows.filter(function (r) { return !r.err; }).length;
    $('#dbP', b).innerHTML = rows.length ? '<p class="' + (okN === rows.length ? 'ok-t' : 'bad-t') + '">เลือก ' + rows.length + ' ไฟล์ · พร้อมอัปโหลด ' + okN + ' ไฟล์' + (okN < rows.length ? ' · ข้าม ' + (rows.length - okN) + ' ไฟล์ที่มีปัญหา' : '') + '</p><div class="tblwrap sm"><table class="tbl sm"><thead><tr><th>ไฟล์</th><th>ผู้สมัคร</th><th>ชนิดเอกสาร</th></tr></thead><tbody>' +
      rows.map(function (r, i) { return '<tr class="' + (r.err ? 'badrow' : '') + '"><td>' + esc(r.file.name) + ' <small class="muted">' + kb(r.file.size) + '</small></td><td>' + (r.err ? '<span class="bad-t">' + esc(r.err) + '</span>' : '<b>' + esc(no3(r.examNo)) + '</b> ' + esc(ivName(cands[r.examNo]) || '')) + '</td><td>' + (r.err ? '' : '<select data-k="' + i + '">' + kinds.map(function (k) { return '<option' + (k === r.kind ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select>') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '';
    $$('[data-k]', b).forEach(function (s) { s.onchange = function () { rows[+s.dataset.k].kind = s.value; }; });
    $('#dbB', b).disabled = !okN;
  }
  $('#dbI', b).onchange = function () {
    rows = Array.prototype.slice.call(this.files).map(function (f) {
      var m = f.name.match(/^\s*0*(\d{1,6})(?=\D)/), no = m ? String(Number(m[1])) : '', err = docFileOk(f, maxMb);
      if (!err && !no) err = 'ชื่อไฟล์ไม่ได้ขึ้นต้นด้วยเลขประจำตัวสอบ';
      if (!err && !cands[no]) err = 'ไม่พบเลขประจำตัวสอบ ' + no + ' ในรอบนี้';
      return { file: f, examNo: no, kind: guessKind(f.name.replace(/^\s*\d+/, '')), err: err };
    }).sort(function (a, c) { return Number(a.examNo) - Number(c.examNo); });
    draw();
  };
  $('#dbB', b).onclick = function () {
    var bt = this, list = rows.filter(function (r) { return !r.err; }); busy(bt, true, 'กำลังอัปโหลด…');
    uploadDocs(list, function (i, n, it) { if ($('#dbS')) $('#dbS').textContent = 'กำลังอัปโหลด ' + i + ' / ' + n + ' — ' + it.file.name; }).then(function (r) {
      docsChanged(); busy(bt, false);
      if (r.bad.length) { if ($('#dbS')) { $('#dbS').className = 'gsave bad'; $('#dbS').textContent = 'อัปโหลดแล้ว ' + r.ok + ' ไฟล์ · ไม่สำเร็จ: ' + r.bad.join(' | '); } toast('อัปโหลดไม่สำเร็จ ' + r.bad.length + ' ไฟล์', 'bad'); }
      else { toast('อัปโหลดเอกสารแล้ว ' + r.ok + ' ไฟล์', 'ok'); closeModal(); }
    });
  };
}

/* ====================== ยืนยันคะแนน (แทนการลงลายมือชื่อ) ====================== */
function doSignoff(part, done) {
  var pr = gradeProgress(BD.data.me, part);
  askPass('ยืนยันคะแนน' + PART_TH[part], '<div class="note info">เมื่อยืนยันแล้ว คะแนน' + PART_TH[part] + 'ที่ท่านให้ไว้ ' + (pr ? '<b>' + pr.n + ' รายการ</b> ' : '') + 'จะถูกล็อก และระบบจะพิมพ์ชื่อท่าน วันที่ และเวลาที่ยืนยันลงในรายงาน<b>แทนการลงลายมือชื่อ</b></div><p class="muted">หากต้องแก้ไขคะแนนภายหลัง ต้องแจ้งผู้ดูแลระบบให้ปลดล็อกก่อน (ระบบบันทึกเหตุผลไว้ในประวัติ)</p>', 'ยืนยันคะแนน').then(function (r) {
    if (!r) return;
    savesIdle().then(function () { return api('signoff', { examId: BD.id, part: part, password: r.password }); }).then(function (x) { toast('ยืนยันคะแนน' + PART_TH[part] + 'แล้ว ' + x.n + ' รายการ', 'ok'); return loadBoard(); }).then(function () { if (done) done(); }).catch(function (e) { toast(e.message, 'bad', 9000); });
  });
}
function doUnlock(g, part, done) {
  askPass('ปลดล็อกการยืนยันคะแนน', '<p><b>' + esc(gName(g)) + '</b> · คะแนน' + PART_TH[part] + '</p><div class="note warn">กรรมการจะแก้คะแนนได้อีกครั้ง และต้องกดยืนยันใหม่ · เอกสารที่พิมพ์ไปก่อนหน้านี้จะถูกแจ้งว่า "คะแนนถูกแก้ไขหลังพิมพ์" เมื่อตรวจสอบรหัสเอกสาร</div>', 'ปลดล็อก', true).then(function (r) {
    if (!r) return;
    api('unlockSignoff', { examId: BD.id, grader: g, part: part, password: r.password, reason: r.reason }).then(function () { toast('ปลดล็อกแล้ว', 'ok'); return loadBoard(); }).then(function () { if (done) done(); }).catch(function (e) { toast(e.message, 'bad'); });
  });
}
function signCell(g, part) {
  var d = BD.data, s = signOf(g, part), me = g === d.me, pr = gradeProgress(g, part), ro = readonly();
  if (s) return '<span class="tag ok">' + ICON.check + ' ยืนยันแล้ว</span><small class="sg-at">' + tLong(s.at) + ' · ' + s.n + ' รายการ</small>' + (s.same ? '' : '<span class="tag bad">คะแนนเปลี่ยนหลังยืนยัน</span>') + (d.isAdmin && !ro ? '<button class="btn link" data-unlock="' + esc(g) + '|' + part + '">ปลดล็อก</button>' : '');
  return '<span class="tag warn">ยังไม่ยืนยัน</span>' + (pr ? '<small class="sg-at">ให้คะแนนแล้ว ' + pr.n + ' / ' + pr.need + ' รายการ</small>' : '') + (me && !ro ? '<button class="btn primary sm" data-sign="' + part + '"' + (pr && pr.need && pr.n >= pr.need ? '' : ' disabled title="ให้คะแนนให้ครบก่อน"') + '>ยืนยันคะแนนของข้าพเจ้า</button>' : '');
}
function signTable() {
  var d = BD.data, parts = (d.items.length ? ['EXAM'] : []).concat(d.exam.ivOn ? ['IV'] : []), gl = [];
  parts.forEach(function (p) { gradersOf(p).forEach(function (g) { if (gl.indexOf(g) < 0) gl.push(g); }); });
  if (gl.indexOf(d.me) < 0 && parts.some(function (p) { var x = gradeProgress(d.me, p); return x && x.n; })) gl.push(d.me);
  if (!parts.length || !gl.length) return '<p class="muted">รอบสอบนี้ยังไม่มีรายการที่กรรมการต้องให้คะแนน หรือยังไม่ได้แต่งตั้งกรรมการ</p>';
  return '<div class="tblwrap"><table class="tbl signtbl"><thead><tr><th>กรรมการ</th>' + parts.map(function (p) { return '<th>คะแนน' + PART_TH[p] + '</th>'; }).join('') + '</tr></thead><tbody>' +
    gl.map(function (g) { return '<tr' + (g === d.me ? ' class="me"' : '') + '><td><b>' + esc(gName(g)) + '</b><br><small class="muted">' + esc(g) + (g === d.me ? ' · ท่าน' : '') + '</small></td>' + parts.map(function (p) { return '<td>' + signCell(g, p) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
}
function bindSign(root, redraw) {
  $$('[data-sign]', root).forEach(function (b) { b.onclick = function () { doSignoff(b.dataset.sign, redraw); }; });
  $$('[data-unlock]', root).forEach(function (b) { b.onclick = function () { var x = b.dataset.unlock.split('|'); doUnlock(x[0], x[1], redraw); }; });
}

/* ====================== แท็บ "สัมภาษณ์" ====================== */
function tabInterview() {
  var d = BD.data, e = d.exam;
  if (!e.ivOn) { $('#tab').innerHTML = '<div class="card empty"><h3>รอบสอบนี้ยังไม่ได้เปิดใช้การสัมภาษณ์</h3><p class="muted">' + (d.isAdmin ? 'เปิดได้ที่แท็บ <a href="#/staff/' + encodeURIComponent(e.examId) + '/setup">ตั้งค่ารอบสอบ</a> › การสอบสัมภาษณ์' : 'ผู้ดูแลระบบเป็นผู้เปิดใช้การสัมภาษณ์ของรอบสอบ') + '</p></div>'; return; }
  var items = d.ivItems, list = ivCands(), ro = readonly(), signed = signOf(d.me, 'IV'), lock = ro || !!signed, table = sess('tg_ivview') === 1;
  var anySigned = d.signoffs.some(function (s) { return s.part === 'IV'; }), act = activeCands();
  function mineDone() { return list.filter(function (c) { return byTotal(c, 'ivAvg', items, d.me).full; }).length; }
  function examChip(c) {
    var r = c.result; if (!r.started) return '<span class="tag">ไม่ได้เข้าสอบข้อเขียน</span>';
    return '<span class="tag ' + (r.complete ? (r.pass ? 'ok' : 'bad') : 'warn') + '" title="คะแนนสอบข้อเขียนและภาคปฏิบัติ">สอบ ' + num(r.total) + ' / ' + d.totals.totalMax + (r.complete ? '' : ' (รอตรวจ)') + '</span>';
  }
  var h = '';
  if (d.isAdmin) {
    h += '<details class="card ivpick"' + (list.length ? '' : ' open') + '><summary><b>เลือกผู้เข้าสัมภาษณ์</b><span class="muted sm">เลือกแล้ว ' + list.length + ' จากผู้มีสิทธิ์สอบ ' + act.length + ' คน · คลิกเพื่อเปิด/ปิด</span></summary>' +
      (anySigned ? '<div class="note warn">มีกรรมการยืนยันคะแนนสัมภาษณ์แล้ว จึงเปลี่ยนรายชื่อไม่ได้ (ปลดล็อกการยืนยันที่แท็บ "รายงาน" ก่อน)</div>' : '') +
      '<div class="acts ivpick-a"><button class="btn ghost-dark sm" data-pick="all">เลือกทุกคนที่เข้าสอบ</button><button class="btn ghost-dark sm" data-pick="pass">เลือกเฉพาะผู้ผ่านเกณฑ์สอบ</button><button class="btn ghost-dark sm" data-pick="none">ล้างการเลือก</button></div>' +
      '<div class="tblwrap"><table class="tbl sm"><thead><tr><th class="c">สัมภาษณ์</th><th>ผู้เข้าสอบ</th><th class="r">คะแนนสอบ<small>/' + d.totals.totalMax + '</small></th><th>ผลสอบ</th><th class="c">เอกสาร</th></tr></thead><tbody>' +
      act.map(function (c) { var r = c.result; return '<tr data-no="' + esc(c.examNo) + '"><td class="c"><input type="checkbox" class="ivp"' + (c.iv ? ' checked' : '') + (anySigned || ro ? ' disabled' : '') + ' data-started="' + (r.started ? 1 : 0) + '" data-pass="' + (r.pass ? 1 : 0) + '"></td><td>' + cLabel(c) + '</td><td class="r">' + (r.started ? num(r.total) : '–') + '</td><td>' + (r.started ? (r.complete ? (r.pass ? '<span class="tag ok">ผ่านเกณฑ์สอบ</span>' : '<span class="tag bad">ไม่ผ่านเกณฑ์สอบ</span>') : '<span class="tag warn">รอตรวจ</span>') : '<span class="tag">ไม่ได้เข้าสอบ</span>') + '</td><td class="c"><button class="btn link ivp-doc">' + (c.nDocs ? c.nDocs + ' ไฟล์' : 'เพิ่มเอกสาร') + '</button></td></tr>'; }).join('') +
      '</tbody></table></div>' + (anySigned || ro ? '' : '<div class="acts ivpick-a"><button class="btn primary" id="ivpSave">บันทึกรายชื่อผู้เข้าสัมภาษณ์</button><span class="muted sm" id="ivpN"></span></div>') + '</details>';
  }
  h += '<div class="blindbar ivbar"><span><b>คะแนนรวม</b> = คะแนนสอบ ' + (100 - e.ivWeight) + '% + สัมภาษณ์ ' + e.ivWeight + '% <small class="muted">· เกณฑ์ผ่านร้อยละ ' + e.passPct + ' ของคะแนนรวม · สัมภาษณ์เต็ม ' + d.ivMax + ' คะแนน (' + items.length + ' หัวข้อ)</small></span></div>';
  if (signed) h += '<div class="note ok">' + ICON.shield + ' ท่านยืนยันคะแนนสัมภาษณ์แล้วเมื่อ ' + tLong(signed.at) + ' (' + signed.n + ' รายการ) — คะแนนถูกล็อก หากต้องแก้ไขโปรดแจ้งผู้ดูแลระบบให้ปลดล็อก</div>';
  if (!list.length) h += '<div class="card empty"><h3>ยังไม่มีรายชื่อผู้เข้าสัมภาษณ์</h3><p class="muted">' + (d.isAdmin ? 'ติ๊กเลือกผู้เข้าสัมภาษณ์ในกล่องด้านบน แล้วกด "บันทึกรายชื่อผู้เข้าสัมภาษณ์"' : 'ผู้ดูแลระบบจะเลือกผู้มีสิทธิ์สัมภาษณ์หลังทราบผลสอบ รายชื่อจะแสดงที่นี่') + '</p></div>';
  else {
    h += '<div class="gbar"><span>ผู้เข้าสัมภาษณ์ <b>' + list.length + '</b> คน · ท่านให้คะแนนครบแล้ว <b id="ivMine">' + mineDone() + '</b> คน</span><div class="acts"><div class="seg sm" id="ivView"><button data-v="0" class="' + (table ? '' : 'on') + '">รายคน</button><button data-v="1" class="' + (table ? 'on' : '') + '">ตาราง</button></div>' +
      '<button class="btn ghost-dark sm" id="ivPrint">' + ICON.print + 'พิมพ์ใบคะแนนของข้าพเจ้า</button>' + (lock ? '' : '<button class="btn primary sm" id="ivSign">' + ICON.shield + 'ยืนยันคะแนนสัมภาษณ์</button>') + '</div></div>';
    var inp = function (c, it) { var m = c.my[it.item] || {}; return '<input type="number" inputmode="decimal" class="iv-s" data-item="' + esc(it.item) + '" data-max="' + it.max + '" min="0" max="' + it.max + '" step="0.5" value="' + (m.score === null || m.score === undefined ? '' : m.score) + '"' + (lock ? ' disabled' : '') + ' aria-label="' + esc(it.label) + '">'; };
    if (table) {
      h += '<div class="card"><div class="tblwrap"><table class="tbl ivtbl"><thead><tr><th class="c">ที่</th><th>ชื่อ-สกุล</th>' + items.map(function (it) { return '<th class="c">' + esc(it.label) + '<small>(' + it.max + ')</small></th>'; }).join('') + '<th class="c">รวม<small>(' + d.ivMax + ')</small></th><th></th></tr></thead><tbody>' +
        list.map(function (c, i) { return '<tr class="ivrow" data-no="' + esc(c.examNo) + '"><td class="c">' + (i + 1) + '</td><td><b class="cno">' + esc(no3(c.examNo)) + '</b><span class="cname">' + esc(ivName(c)) + '</span></td>' + items.map(function (it) { return '<td class="c">' + inp(c, it) + '</td>'; }).join('') + '<td class="c"><b class="iv-sum">–</b></td><td><span class="gsave"></span></td></tr>'; }).join('') +
        '</tbody></table></div><p class="muted sm">คะแนนบันทึกอัตโนมัติเมื่อกรอกแต่ละช่อง · บันทึกข้อสังเกตและเปิดเอกสารผู้สมัครได้ในมุมมอง "รายคน"</p></div>';
    } else list.forEach(function (c, i) {
      var p = c.profile, t = p && p.mbti ? MB_T[p.mbti] : null;
      h += '<article class="card ivcard ivrow" data-no="' + esc(c.examNo) + '" style="--i:' + Math.min(i, 10) + '"><header><b class="cno">' + esc(no3(c.examNo)) + '</b><span class="cname big">' + esc(ivName(c)) + '</span>' + examChip(c) +
        (p && p.nAtt ? '<span class="tag ' + attLevel(p.att)[1] + '" title="คะแนนทัศนคติ (ไม่คิดคะแนน)">ทัศนคติ ' + num(p.att, 2) + ' / 4</span>' : '') + (p && p.mbti ? '<span class="mbti sm" title="' + esc(t ? t[0] + ' — ' + t[1] : '') + '">' + esc(p.mbti) + '</span>' : '') +
        (d.isAdmin ? '<button class="btn link iv-docs">จัดการเอกสาร</button>' : '') + '</header>' +
        (t ? '<p class="iv-ask"><b>ชวนคุย:</b> ' + esc(t[3]) + '</p>' : '') + '<div class="ivdocs" data-no="' + esc(c.examNo) + '">' + (c.nDocs ? '<span class="muted sm">กำลังโหลดรายการเอกสาร ' + c.nDocs + ' ไฟล์…</span>' : '<span class="muted sm">ไม่มีเอกสารแนบ</span>') + '</div>' +
        '<div class="pitems">' + items.map(function (it) { var av = (c.ivAvg || {})[it.item] || {}; return '<label><span>' + esc(it.label) + '</span><div>' + inp(c, it) + '<i>/ ' + it.max + '</i></div><small>' + (d.isAdmin && av.n ? 'เฉลี่ย ' + num(av.avg) + ' (' + av.n + ' ท่าน)' : '&nbsp;') + '</small></label>'; }).join('') + '</div>' +
        '<footer><span class="ptotal">รวม <b class="iv-sum">–</b> / ' + d.ivMax + '</span><input class="iv-c" maxlength="500" placeholder="บันทึกข้อสังเกตจากการสัมภาษณ์ (ไม่บังคับ)" value="' + esc((c.my['IV:NOTE'] || {}).comment || '') + '"' + (lock ? ' disabled' : '') + '><span class="gsave"></span></footer></article>';
    });
  }
  $('#tab').innerHTML = h;

  /* --- เลือกผู้เข้าสัมภาษณ์ (ผู้ดูแล) --- */
  function pickN() { var el = $('#ivpN'); if (el) el.textContent = 'เลือกไว้ ' + $$('.ivp').filter(function (x) { return x.checked; }).length + ' คน'; }
  $$('[data-pick]').forEach(function (b) { b.onclick = function () { $$('.ivp').forEach(function (x) { if (x.disabled) return; x.checked = b.dataset.pick === 'all' ? x.dataset.started === '1' : b.dataset.pick === 'pass' ? x.dataset.pass === '1' : false; }); pickN(); }; });
  $$('.ivp').forEach(function (x) { x.onchange = pickN; }); pickN();
  $$('.ivp-doc').forEach(function (b) { b.onclick = function () { docsBox(b.closest('tr').dataset.no, tabInterview); }; });
  if ($('#ivpSave')) $('#ivpSave').onclick = function () {
    var bt = this, nos = $$('.ivp').filter(function (x) { return x.checked; }).map(function (x) { return x.closest('tr').dataset.no; });
    busy(bt, true, 'กำลังบันทึก…');
    api('setInterviewees', { examId: BD.id, examNos: nos }).then(function (r) { toast('บันทึกรายชื่อผู้เข้าสัมภาษณ์ ' + r.n + ' คนแล้ว', 'ok'); BD.docs = null; return loadBoard(); }).then(function () { if (BD.tab === 'interview' && $('#ivpSave')) tabInterview(); }).catch(function (er) { busy(bt, false); toast(er.message, 'bad'); });
  };

  /* --- ให้คะแนน --- */
  $$('.ivrow').forEach(function (row) {
    var no = row.dataset.no, st = $('.gsave', row), sumEl = $('.iv-sum', row), cm = $('.iv-c', row), t = null;
    function total() { var s = 0, any = false; $$('.iv-s', row).forEach(function (x) { if (x.value !== '') { s += Number(x.value) || 0; any = true; } }); sumEl.textContent = any ? num(r2(s)) : '–'; }
    function save() {
      var its = [], bad = false; $$('.iv-s', row).forEach(function (x) { var v = scoreVal(x, +x.dataset.max); if (v === null) bad = true; else its.push({ item: x.dataset.item, score: v }); });
      if (bad) { st.className = 'gsave bad'; st.textContent = 'คะแนนต้องอยู่ระหว่าง 0 ถึงคะแนนเต็มของหัวข้อ'; return; }
      if (cm) its.push({ item: 'IV:NOTE', comment: cm.value });
      saveGrade(no, its, st).then(function () { var m = $('#ivMine'); if (m) m.textContent = mineDone(); }).catch(function () { });
    }
    function later() { total(); st.className = 'gsave'; st.textContent = 'กำลังรอบันทึก…'; clearTimeout(t); t = setTimeout(save, 700); }
    $$('.iv-s', row).forEach(function (x) { x.oninput = later; x.onchange = function () { clearTimeout(t); total(); save(); }; });
    if (cm) cm.onchange = function () { clearTimeout(t); save(); };
    var db = $('.iv-docs', row); if (db) db.onclick = function () { docsBox(no, tabInterview); };
    total();
  });
  $$('#ivView button').forEach(function (b) { b.onclick = function () { sess('tg_ivview', b.dataset.v === '1' ? 1 : null); tabInterview(); }; });
  if ($('#ivSign')) $('#ivSign').onclick = function () { doSignoff('IV', function () { if (BD.tab === 'interview') tabInterview(); }); };
  if ($('#ivPrint')) $('#ivPrint').onclick = function () { printReport('IV', d.me, this); };

  /* --- เอกสารผู้สมัคร --- */
  function paintDocs() { $$('.ivdocs').forEach(function (el) { var x = docChips(el.dataset.no); el.innerHTML = x || '<span class="muted sm">ไม่มีเอกสารแนบ</span>'; bindDocChips(el); }); }
  if (list.length && !table) {
    if (BD.docs && BD.docs.examId === BD.id) paintDocs();
    var seq = tabInterview._seq = (tabInterview._seq || 0) + 1;
    loadDocs().then(function () { if (BD.tab === 'interview' && TG.view === 'board' && seq === tabInterview._seq) paintDocs(); }).catch(function (er) { $$('.ivdocs').forEach(function (el) { el.innerHTML = '<span class="bad-t sm">โหลดรายการเอกสารไม่ได้: ' + esc(er.message) + '</span>'; }); });
  }
}

/* ====================== แท็บ "รายงาน" ====================== */
function tabReports() {
  var d = BD.data, e = d.exam, gIv = e.ivOn ? gradersOf('IV') : [];
  var h = '<div class="card"><div class="card-head"><div><h2 class="card-t">การยืนยันคะแนนของกรรมการ</h2><p class="card-s">กรรมการแต่ละท่านกด "ยืนยันคะแนน" ด้วยรหัสผ่านของตนเองเมื่อให้คะแนนครบ ระบบจะล็อกคะแนนและพิมพ์ชื่อ วันที่ เวลา ลงในรายงาน<b>แทนการลงลายมือชื่อ</b></p></div></div>' + signTable() + '</div>';
  h += '<div class="card"><h2 class="card-t">พิมพ์รายงาน</h2><p class="card-s">ทุกฉบับระบุผู้พิมพ์ วันที่ เวลา และรหัสเอกสารที่ท้ายกระดาษทุกหน้า · พิมพ์ก่อนกรรมการยืนยันครบ เอกสารจะขึ้นคำว่า "ฉบับร่าง"</p><div class="rpgrid">';
  if (e.ivOn) h += '<div class="rp"><b>ตารางคะแนนสอบสัมภาษณ์</b><small>A4 แนวนอน ตามแบบฟอร์มของฝ่ายทรัพยากรบุคคล</small>' +
    (d.isAdmin ? '<select id="rpG"><option value="ALL">รวมกรรมการทุกท่าน (ค่าเฉลี่ย)</option><option value="EACH">แยกรายกรรมการ ทุกท่าน (ท่านละ 1 ฉบับ)</option>' + gIv.map(function (g) { return '<option value="' + esc(g) + '">เฉพาะ: ' + esc(gName(g)) + '</option>'; }).join('') + '</select>' : '<span class="muted sm">ใบคะแนนของท่านเอง</span>') +
    '<button class="btn primary sm" data-rp="IV">' + ICON.print + 'พิมพ์</button></div>';
  if (d.isAdmin) h += '<div class="rp"><b>สรุปผลการสอบคัดเลือก</b><small>ทุกส่วนของทุกคน เรียงตามลำดับคะแนนรวม · ลงชื่อผู้จัดทำรายงาน</small><button class="btn primary sm" data-rp="SUM">' + ICON.print + 'พิมพ์</button></div>' +
    '<div class="rp"><b>คะแนนแยกรายกรรมการ</b><small>คะแนนที่กรรมการแต่ละท่านให้ เทียบกันรายผู้สมัคร พร้อมค่าเฉลี่ย</small><button class="btn primary sm" data-rp="BYG">' + ICON.print + 'พิมพ์</button></div>' +
    '<div class="rp"><b>ใบสรุปผลรายบุคคล</b><small>ผู้สมัคร 1 คนต่อ 1 หน้า: คะแนนทุกส่วน คะแนนรายกรรมการ บันทึกของกรรมการ</small><select id="rpC"><option value="ALL">' + (e.ivOn ? 'ทุกคนที่เข้าสัมภาษณ์' : 'ทุกคนที่เข้าสอบ') + '</option>' + (e.ivOn ? '<option value="STARTED">ทุกคนที่เข้าสอบ</option>' : '') +
    activeCands().filter(function (c) { return c.result.started || c.iv; }).map(function (c) { return '<option value="' + esc(c.examNo) + '">' + esc(no3(c.examNo)) + ' ' + esc(ivName(c)) + '</option>'; }).join('') + '</select><button class="btn primary sm" data-rp="IND">' + ICON.print + 'พิมพ์</button></div>';
  h += '</div>' + (!e.ivOn && !d.isAdmin ? '<p class="muted">รายงานสรุปผลพิมพ์ได้โดยผู้ดูแลระบบ</p>' : '') + '</div>';
  if (d.isAdmin) h += '<div class="card"><div class="card-head"><div><h2 class="card-t">คะแนนรวมและคะแนนรายกรรมการ</h2><p class="card-s">คะแนนที่กรรมการแต่ละท่านให้ (ผลรวมทุกหัวข้อของส่วนนั้น) และค่าเฉลี่ยที่ระบบใช้คิดผล · * = ให้คะแนนยังไม่ครบทุกหัวข้อ</p></div></div>' + matrixHtml(false) + '</div>';
  h += '<div class="card"><div class="card-head"><div><h2 class="card-t">ตรวจสอบรหัสเอกสาร</h2><p class="card-s">กรอกรหัสที่ท้ายกระดาษ ระบบจะแจ้งว่าเอกสารออกจากระบบจริงหรือไม่ ใครพิมพ์ เมื่อใด และคะแนนในระบบยังตรงกับตอนพิมพ์หรือไม่</p></div><form class="inrow" id="vfF"><input id="vfC" placeholder="เช่น TG691005-AB12CD" maxlength="20" autocomplete="off" required><button class="btn ghost-dark sm" id="vfB">ตรวจสอบ</button></form></div><div id="vfR"></div><div id="rpHist"><p class="muted sm">กำลังโหลดประวัติการพิมพ์…</p></div></div>';
  $('#tab').innerHTML = h;
  bindSign($('#tab'), function () { if (BD.tab === 'reports') tabReports(); });
  $$('[data-rp]').forEach(function (b) {
    b.onclick = function () {
      var t = b.dataset.rp;
      if (t === 'IV') { var g = d.isAdmin ? $('#rpG').value : d.me; if (g === 'ALL') printReport('IVALL', '', b); else if (g === 'EACH') printReport('IVEACH', '', b); else printReport('IV', g, b); }
      else printReport(t, t === 'IND' ? $('#rpC').value : '', b);
    };
  });
  function verdict(r) {
    if (!r.found) return '<div class="note bad"><b>ไม่พบรหัสเอกสาร ' + esc(r.code) + ' ในระบบ</b> — เอกสารนี้ไม่ได้ออกจากระบบ SOMDEJ TalentGate หรือพิมพ์รหัสไม่ถูกต้อง</div>';
    return '<div class="note ' + (r.same === false ? 'warn' : 'ok') + '"><b>' + esc(r.code) + '</b> · ' + esc(r.typeTh) + (r.scopeName ? ' — ' + esc(r.scopeName) : '') + '<br>' + esc(r.title) + '<br>พิมพ์โดย <b>' + esc(r.byName) + '</b> (' + esc(r.by) + ') เมื่อ ' + tLong(r.at) + '<br>' +
      (r.same === true ? '✔ คะแนนในระบบ<b>ตรงกับ</b>ตอนที่พิมพ์เอกสารฉบับนี้' : r.same === false ? '⚠ คะแนนในระบบ<b>ถูกแก้ไขหลังจาก</b>พิมพ์เอกสารฉบับนี้ — เอกสารฉบับนี้ไม่เป็นปัจจุบัน ควรพิมพ์ใหม่' : 'เอกสารประเภทนี้ไม่มีข้อมูลคะแนนให้เปรียบเทียบ') + '</div>';
  }
  $('#vfF').onsubmit = function (ev) {
    ev.preventDefault(); var bt = $('#vfB'); busy(bt, true, 'กำลังตรวจ…');
    api('getPrintInfo', { code: $('#vfC').value }).then(function (r) { busy(bt, false); $('#vfR').innerHTML = verdict(r); }).catch(function (er) { busy(bt, false); $('#vfR').innerHTML = '<div class="note bad">' + esc(er.message) + '</div>'; });
  };
  tabReports.hist = function () { api('getPrints', { examId: BD.id }).then(function (r) {
    var el = $('#rpHist'); if (!el || BD.tab !== 'reports') return;
    el.innerHTML = r.rows.length ? '<details class="rphist"><summary>ประวัติการพิมพ์ ' + r.rows.length + ' รายการ' + (d.isAdmin ? '' : ' (เฉพาะที่ท่านพิมพ์)') + '</summary><div class="tblwrap tall"><table class="tbl sm"><thead><tr><th>รหัสเอกสาร</th><th>เอกสาร</th><th>ผู้พิมพ์</th><th>เมื่อ</th><th>สถานะ</th></tr></thead><tbody>' +
      r.rows.map(function (x) { return '<tr><td><code>' + esc(x.code) + '</code></td><td>' + esc(x.typeTh) + (x.scopeName ? '<br><small class="muted">' + esc(x.scopeName) + '</small>' : '') + '</td><td>' + esc(x.byName) + '</td><td class="nowrap">' + tDate(x.at) + '</td><td>' + (x.same === true ? '<span class="tag ok">ตรงกับปัจจุบัน</span>' : x.same === false ? '<span class="tag warn">คะแนนเปลี่ยนหลังพิมพ์</span>' : '–') + '</td></tr>'; }).join('') + '</tbody></table></div></details>' : '<p class="muted sm">ยังไม่มีประวัติการพิมพ์ของรอบสอบนี้</p>';
  }).catch(function () { var el = $('#rpHist'); if (el) el.innerHTML = ''; }); };
  tabReports.hist();
}
/** ตารางคะแนนรวม + รายกรรมการ (ใช้ทั้งบนจอและในรายงาน) */
function matrixHtml(print) {
  var d = BD.data, e = d.exam, hasEx = d.items.length > 0, gEx = hasEx ? gradersOf('EXAM') : [], gIv = e.ivOn ? gradersOf('IV') : [];
  var list = activeCands().filter(function (c) { return c.result.started || c.iv; }).sort(byNo), mcqMax = d.sections.reduce(function (a, s) { return a + s.mcqMax; }, 0), exMax = d.totals.totalMax - mcqMax;
  if (!list.length) return '<p class="muted">ยังไม่มีผู้เข้าสอบ</p>';
  var short = function (g) { return esc(gName(g).replace(/^(นางสาว|นาง|นาย|ดร\.|พญ\.|นพ\.)\s*/, '').split(/\s+/)[0]); };
  var cell = function (t) { return t.sum === null ? '–' : num(t.sum) + (t.full ? '' : '*'); };
  var h = '<div class="tblwrap"><table class="' + (print ? 'pr-t' : 'tbl mx') + '"><thead><tr><th rowspan="2">เลขประจำตัวสอบ</th><th rowspan="2">ชื่อ-สกุล</th><th rowspan="2" class="r">ปรนัย<small>/' + mcqMax + '</small></th>' +
    (hasEx ? '<th colspan="' + (gEx.length + 1) + '" class="c">ข้อเขียน + ภาคปฏิบัติ <small>/' + exMax + '</small></th>' : '') + (e.ivOn ? '<th colspan="' + (gIv.length + 1) + '" class="c">สัมภาษณ์ <small>/' + d.ivMax + '</small></th><th rowspan="2" class="r">คะแนนรวม<small>/100</small></th>' : '<th rowspan="2" class="r">รวม<small>/' + d.totals.totalMax + '</small></th>') + '</tr><tr>' +
    (hasEx ? gEx.map(function (g) { return '<th class="r g" title="' + esc(gName(g)) + '">' + short(g) + '</th>'; }).join('') + '<th class="r avg">เฉลี่ย</th>' : '') + (e.ivOn ? gIv.map(function (g) { return '<th class="r g" title="' + esc(gName(g)) + '">' + short(g) + '</th>'; }).join('') + '<th class="r avg">เฉลี่ย</th>' : '') + '</tr></thead><tbody>';
  list.forEach(function (c) {
    var r = c.result, f = c.final, exAvg = r.essay === null && r.practical === null ? null : r2((r.essay || 0) + (r.practical || 0));
    h += '<tr><td class="c">' + esc(no3(c.examNo)) + '</td><td>' + esc(ivName(c)) + '</td><td class="r">' + num(r.mcq) + '</td>' +
      (hasEx ? gEx.map(function (g) { return '<td class="r g">' + cell(byTotal(c, 'avg', d.items, g)) + '</td>'; }).join('') + '<td class="r avg"><b>' + num(exAvg) + '</b></td>' : '') +
      (e.ivOn ? gIv.map(function (g) { return '<td class="r g">' + (c.iv ? cell(byTotal(c, 'ivAvg', d.ivItems, g)) : '') + '</td>'; }).join('') + '<td class="r avg"><b>' + (c.iv ? num(f.iv !== null ? f.iv : f.ivPart) + (f.iv === null && f.ivPart !== null ? '*' : '') : '<small>ไม่ได้สัมภาษณ์</small>') + '</b></td><td class="r"><b>' + (f && f.score !== null ? num(f.score) : '–') + '</b></td>' : '<td class="r"><b>' + num(r.total) + '</b></td>') + '</tr>';
  });
  return h + '</tbody></table></div>';
}

/* ====================== เอกสารสำหรับพิมพ์ ====================== */
function prOrg() { return esc((TG.boot && TG.boot.orgName) || 'ฝ่ายทรัพยากรบุคคล โรงพยาบาลสมเด็จพระบรมราชเทวี ณ ศรีราชา สภากาชาดไทย'); }
function prHead(title, lines) { return '<div class="pr-head"><p class="pr-org">' + prOrg() + '</p><h1>' + esc(title) + '</h1>' + lines.filter(String).map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div>'; }
function examWhen(e) { return (e.examDate ? 'สอบคัดเลือก' + e.examDate : '') + (e.place ? ' ณ ' + e.place : ''); }
/** กล่องรับรองเอกสาร: รายชื่อกรรมการ + วันเวลาที่ยืนยันคะแนนในระบบ (แทนลายมือชื่อ) + ผู้พิมพ์ + รหัสเอกสาร */
function certBlock(meta, parts, graders) {
  var d = BD.data, draft = false;
  var rows = graders.map(function (g, i) {
    return '<tr><td class="c">' + (i + 1) + '</td><td>' + esc(gName(g)) + ' <small>(' + esc(g) + ')</small></td>' + parts.map(function (p) {
      var s = signOf(g, p); if (!s) draft = true;
      return '<td>' + (s ? 'ยืนยันเมื่อวันที่ ' + tLong(s.at) : '<i>ยังไม่ยืนยันคะแนน</i>') + '</td>';
    }).join('') + '</tr>';
  }).join('');
  if (!graders.length) draft = true;
  return { draft: draft, html: '<div class="pr-cert"><b>การรับรองเอกสาร</b><p>เอกสารฉบับนี้ออกจากระบบสอบคัดเลือกบุคลากรออนไลน์ SOMDEJ TalentGate โดยไม่ต้องลงลายมือชื่อ คะแนนที่ปรากฏเป็นคะแนนที่กรรมการแต่ละท่านบันทึกด้วยบัญชีผู้ใช้ของตนเอง และยืนยันด้วยรหัสผ่านส่วนบุคคลในระบบ ดังนี้</p>' +
    (graders.length ? '<table class="pr-sign"><thead><tr><th class="c">ที่</th><th>กรรมการ</th>' + parts.map(function (p) { return '<th>การยืนยันคะแนน' + PART_TH[p] + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table>' : '<p><i>ยังไม่มีกรรมการให้คะแนน</i></p>') +
    '<p>' + (d.isAdmin ? 'ผู้จัดทำและพิมพ์รายงาน' : 'ผู้พิมพ์') + ': <b>' + esc(TG.me.name) + '</b> (' + esc(TG.me.empCode) + ') ' + (d.isAdmin ? 'ผู้ดูแลระบบ ฝ่ายทรัพยากรบุคคล' : 'กรรมการสอบ') + ' · พิมพ์จากระบบเมื่อวันที่ ' + tLong(meta.at) + ' · รหัสเอกสาร <b class="pr-code">' + esc(meta.code) + '</b></p>' +
    '<p class="pr-small">ตรวจสอบความถูกต้องของเอกสารได้ที่ระบบ SOMDEJ TalentGate › รอบสอบ › แท็บ "รายงาน" › ตรวจสอบรหัสเอกสาร ระบบจะแสดงผู้พิมพ์ วันเวลา และแจ้งเตือนหากคะแนนในระบบถูกแก้ไขหลังจากพิมพ์เอกสารฉบับนี้</p></div>' };
}
function prPage(body, cert, last) { return '<section class="pr' + (last ? '' : ' pr-break') + '">' + (cert.draft ? '<div class="pr-draft">ฉบับร่าง · กรรมการยังยืนยันคะแนนไม่ครบ</div>' : '') + body + cert.html + '</section>'; }

/** 1) ตารางคะแนนสอบสัมภาษณ์ (ตามแบบฟอร์ม) — g = เลขเจ้าหน้าที่ของกรรมการ หรือ '' = รวมทุกท่าน */
function docIvSheet(g, meta, last) {
  var d = BD.data, e = d.exam, items = d.ivItems, list = ivCands(), gl = g ? [g] : gradersOf('IV');
  var title = /^สอบคัดเลือก/.test(e.title) ? e.title.replace(/^สอบคัดเลือก/, 'ตารางคะแนนสอบสัมภาษณ์') : 'ตารางคะแนนสอบสัมภาษณ์ ' + e.title;
  var note = function (c) { if (!g) return ''; if (d.isAdmin) { var x = (c.ivNotes || []).filter(function (n) { return n.g === g; })[0]; return x ? x.t : ''; } return g === d.me ? ((c.my['IV:NOTE'] || {}).comment || '') : ''; };
  var hasNote = list.some(function (c) { return note(c); });
  var h = prHead(title, [examWhen(e), g ? 'กรรมการผู้ให้คะแนน: ' + gName(g) : 'คะแนนเฉลี่ยของกรรมการ ' + gl.length + ' ท่าน']) +
    '<table class="pr-t pr-iv"><thead><tr><th class="c w-n">ที่</th><th class="c w-no">เลขประจำตัวสอบ</th><th>ชื่อ-สกุล</th>' + items.map(function (it) { return '<th class="c">' + esc(it.label) + '<br>(' + it.max + ')</th>'; }).join('') + '<th class="c">รวม<br>(' + d.ivMax + ')</th>' +
    (g ? (hasNote ? '<th>บันทึก</th>' : '') : gl.map(function (x) { return '<th class="c g">' + esc(gName(x).replace(/^(นางสาว|นาง|นาย)\s*/, '').split(/\s+/)[0]) + '</th>'; }).join('')) + '</tr></thead><tbody>';
  if (!list.length) h += '<tr><td colspan="' + (items.length + 4) + '" class="c">ยังไม่มีรายชื่อผู้เข้าสัมภาษณ์</td></tr>';
  list.forEach(function (c, i) {
    var sum = 0, n = 0, cells = items.map(function (it) {
      var v = g ? byScore(c, 'ivAvg', it.item, g) : ((c.ivAvg || {})[it.item] || {}).avg;
      if (v !== null && v !== undefined) { sum += v; n++; }
      return '<td class="c">' + (v === null || v === undefined ? '' : num(v)) + '</td>';
    }).join('');
    h += '<tr><td class="c">' + (i + 1) + '</td><td class="c">' + esc(no3(c.examNo)) + '</td><td>' + esc(ivName(c)) + '</td>' + cells + '<td class="c"><b>' + (n === items.length ? num(r2(sum)) : n ? num(r2(sum)) + '*' : '') + '</b></td>' +
      (g ? (hasNote ? '<td class="pr-note">' + esc(note(c)) + '</td>' : '') : gl.map(function (x) { var t = byTotal(c, 'ivAvg', items, x); return '<td class="c g">' + (t.sum === null ? '' : num(t.sum) + (t.full ? '' : '*')) + '</td>'; }).join('')) + '</tr>';
  });
  h += '</tbody></table>' + (g ? '' : '<p class="pr-small">คะแนนแต่ละหัวข้อเป็นค่าเฉลี่ยของกรรมการที่ให้คะแนน · คอลัมน์ท้ายตารางคือคะแนนรวมที่กรรมการแต่ละท่านให้ · * = ให้คะแนนยังไม่ครบทุกหัวข้อ</p>');
  return prPage(h, certBlock(meta, ['IV'], gl), last);
}
/** 2) สรุปผลการสอบคัดเลือก (ทุกส่วน เรียงลำดับ) */
function docSummary(meta) {
  var d = BD.data, e = d.exam, t = d.totals, mcqMax = d.sections.reduce(function (a, s) { return a + s.mcqMax; }, 0), hasEssay = d.items.some(function (i) { return i.kind === 'ESSAY'; }), hasPr = t.practMax > 0;
  var list = activeCands().filter(function (c) { return c.result.started || c.iv; }).sort(function (a, b) {
    if (e.ivOn) { var ra = a.final && a.final.rank || 9999, rb = b.final && b.final.rank || 9999; if (ra !== rb) return ra - rb; if (a.iv !== b.iv) return a.iv ? -1 : 1; }
    return ((a.result.rank || 9999) - (b.result.rank || 9999)) || byNo(a, b);
  });
  var h = prHead('สรุปผลการสอบคัดเลือก', [e.title, examWhen(e), e.ivOn ? 'คะแนนรวม = คะแนนสอบ ร้อยละ ' + (100 - e.ivWeight) + ' + คะแนนสัมภาษณ์ ร้อยละ ' + e.ivWeight + ' · เกณฑ์ผ่านร้อยละ ' + e.passPct + ' ของคะแนนรวม' : 'เกณฑ์ผ่านร้อยละ ' + e.passPct + ' (' + t.passMin + ' คะแนนขึ้นไป จากคะแนนเต็ม ' + t.totalMax + ')']) +
    '<table class="pr-t"><thead><tr><th class="c w-n">ลำดับ</th><th class="c w-no">เลขประจำตัวสอบ</th><th>ชื่อ-สกุล</th><th class="c">ปรนัย<br>(' + mcqMax + ')</th>' + (hasEssay ? '<th class="c">ข้อเขียน<br>(' + (t.theoryMax - mcqMax) + ')</th>' : '') + (hasPr ? '<th class="c">ภาคปฏิบัติ<br>(' + t.practMax + ')</th>' : '') + '<th class="c">รวมคะแนนสอบ<br>(' + t.totalMax + ')</th>' +
    (e.ivOn ? '<th class="c">สัมภาษณ์<br>(' + d.ivMax + ')</th><th class="c">คะแนนรวม<br>(100)</th>' : '') + '<th class="c">ผล</th></tr></thead><tbody>';
  if (!list.length) h += '<tr><td colspan="10" class="c">ยังไม่มีผู้เข้าสอบ</td></tr>';
  list.forEach(function (c) {
    var r = c.result, f = c.final, res, rank;
    if (e.ivOn) { rank = f && f.rank ? f.rank : '–'; res = !c.iv ? 'ไม่ได้เข้าสัมภาษณ์' : f.complete ? (f.pass ? 'ผ่าน' : 'ไม่ผ่าน') : 'รอคะแนน'; }
    else { rank = r.rank || '–'; res = r.complete ? (r.pass ? 'ผ่าน' : 'ไม่ผ่าน') : 'รอตรวจ'; }
    h += '<tr><td class="c">' + rank + '</td><td class="c">' + esc(no3(c.examNo)) + '</td><td>' + esc(ivName(c)) + '</td><td class="c">' + num(r.mcq) + '</td>' + (hasEssay ? '<td class="c">' + num(r.essay) + '</td>' : '') + (hasPr ? '<td class="c">' + num(r.practical) + '</td>' : '') + '<td class="c">' + num(r.total) + '</td>' +
      (e.ivOn ? '<td class="c">' + (c.iv ? num(f.iv) : '–') + '</td><td class="c"><b>' + (f && f.score !== null ? num(f.score) : '–') + '</b></td>' : '') + '<td class="c">' + res + '</td></tr>';
  });
  var parts = (d.items.length ? ['EXAM'] : []).concat(e.ivOn ? ['IV'] : []), gl = [];
  parts.forEach(function (p) { gradersOf(p).forEach(function (g) { if (gl.indexOf(g) < 0) gl.push(g); }); });
  h += '</tbody></table><p class="pr-small">คะแนนปรนัยตรวจโดยระบบ · คะแนนข้อเขียน ภาคปฏิบัติ และสัมภาษณ์ เป็นค่าเฉลี่ยของกรรมการทุกท่านที่ให้คะแนน · ผู้เข้าสอบในรายงาน ' + list.length + ' คน</p>';
  return prPage(h, certBlock(meta, parts, gl), true);
}
/** 3) คะแนนแยกรายกรรมการ */
function docByGrader(meta) {
  var d = BD.data, e = d.exam, parts = (d.items.length ? ['EXAM'] : []).concat(e.ivOn ? ['IV'] : []), gl = [];
  parts.forEach(function (p) { gradersOf(p).forEach(function (g) { if (gl.indexOf(g) < 0) gl.push(g); }); });
  var h = prHead('คะแนนแยกรายกรรมการ', [e.title, examWhen(e)]) + matrixHtml(true) +
    '<p class="pr-small">ตัวเลขใต้ชื่อกรรมการคือผลรวมคะแนนทุกหัวข้อที่กรรมการท่านนั้นให้ในส่วนนั้น · "เฉลี่ย" คือค่าที่ระบบใช้คิดผล (เฉลี่ยรายหัวข้อของกรรมการทุกท่านที่ให้คะแนน) · * = ให้คะแนนยังไม่ครบทุกหัวข้อ</p>';
  return prPage(h, certBlock(meta, parts, gl), true);
}
/** 4) ใบสรุปผลรายบุคคล (1 คนต่อ 1 หน้า) */
function docIndividual(c, meta, last) {
  var d = BD.data, e = d.exam, r = c.result, f = c.final, t = d.totals, mcqMax = d.sections.reduce(function (a, s) { return a + s.mcqMax; }, 0);
  var es = d.items.filter(function (i) { return i.kind === 'ESSAY'; }), pr = d.items.filter(function (i) { return i.kind === 'PRACTICAL'; }), gEx = d.items.length ? gradersOf('EXAM') : [], gIv = e.ivOn && c.iv ? gradersOf('IV') : [];
  var h = prHead('ใบสรุปผลการสอบคัดเลือกรายบุคคล', [e.title, examWhen(e)]) +
    '<table class="pr-kv"><tr><th>เลขประจำตัวสอบ</th><td><b>' + esc(no3(c.examNo)) + '</b></td><th>ชื่อ-สกุล</th><td><b>' + esc(ivName(c)) + '</b></td></tr><tr><th>ตำแหน่งที่สมัคร</th><td colspan="3">' + esc(e.posName) + '</td></tr></table>' +
    '<h2>ผลคะแนน</h2><table class="pr-t"><thead><tr><th>ส่วน</th><th class="c">คะแนนที่ได้</th><th class="c">คะแนนเต็ม</th><th>ที่มาของคะแนน</th></tr></thead><tbody>' +
    (r.started ? '<tr><td>ปรนัย</td><td class="c">' + num(r.mcq) + '</td><td class="c">' + mcqMax + '</td><td>ตรวจโดยระบบ</td></tr>' + (es.length ? '<tr><td>ข้อเขียน</td><td class="c">' + num(r.essay) + '</td><td class="c">' + (t.theoryMax - mcqMax) + '</td><td>ค่าเฉลี่ยของกรรมการ</td></tr>' : '') + (pr.length ? '<tr><td>ภาคปฏิบัติ</td><td class="c">' + num(r.practical) + '</td><td class="c">' + t.practMax + '</td><td>ค่าเฉลี่ยของกรรมการ</td></tr>' : '') +
      '<tr class="pr-b"><td>รวมคะแนนสอบ</td><td class="c">' + num(r.total) + '</td><td class="c">' + t.totalMax + '</td><td>' + (e.ivOn ? 'คิดเป็นร้อยละ ' + num(f && f.examPct) + ' · น้ำหนักร้อยละ ' + (100 - e.ivWeight) : (r.complete ? (r.pass ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์') : 'รอตรวจ') + ' (เกณฑ์ ' + t.passMin + ' คะแนน) · ลำดับที่ ' + (r.rank || '–')) + '</td></tr>' : '<tr><td colspan="4" class="c">ไม่ได้เข้าสอบข้อเขียน</td></tr>') +
    (e.ivOn ? '<tr class="pr-b"><td>สัมภาษณ์</td><td class="c">' + (c.iv ? num(f.iv) : '–') + '</td><td class="c">' + d.ivMax + '</td><td>' + (c.iv ? 'ค่าเฉลี่ยของกรรมการ · น้ำหนักร้อยละ ' + e.ivWeight : 'ไม่ได้เข้าสัมภาษณ์') + '</td></tr>' +
      '<tr class="pr-b pr-tot"><td>คะแนนรวม</td><td class="c">' + (f && f.score !== null ? num(f.score) : '–') + '</td><td class="c">100</td><td>' + (c.iv ? (f.complete ? (f.pass ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์') : 'รอคะแนน') + ' (เกณฑ์ร้อยละ ' + e.passPct + ')' + (f.rank ? ' · ลำดับที่ ' + f.rank : '') : '–') + '</td></tr>' : '') + '</tbody></table>';
  function grp(title, items, src, gl) {
    if (!items.length || !gl.length) return '';
    var tot = gl.map(function () { return 0; }), cnt = gl.map(function () { return 0; }), avS = 0, avN = 0, mx = 0;
    var body = items.map(function (it) {
      var av = ((c[src] || {})[it.item] || {}).avg; mx += it.max; if (av !== null && av !== undefined) { avS += av; avN++; }
      return '<tr><td>' + esc(it.label) + '</td><td class="c">' + it.max + '</td>' + gl.map(function (g, i) { var v = byScore(c, src, it.item, g); if (v !== null) { tot[i] += v; cnt[i]++; } return '<td class="c">' + (v === null ? '' : num(v)) + '</td>'; }).join('') + '<td class="c"><b>' + (av === null || av === undefined ? '' : num(av)) + '</b></td></tr>';
    }).join('');
    return '<h2>' + title + '</h2><table class="pr-t"><thead><tr><th>หัวข้อ</th><th class="c">เต็ม</th>' + gl.map(function (g) { return '<th class="c">' + esc(gName(g)) + '</th>'; }).join('') + '<th class="c">เฉลี่ย</th></tr></thead><tbody>' + body +
      '<tr class="pr-b"><td>รวม</td><td class="c">' + mx + '</td>' + gl.map(function (g, i) { return '<td class="c">' + (cnt[i] ? num(r2(tot[i])) + (cnt[i] < items.length ? '*' : '') : '') + '</td>'; }).join('') + '<td class="c">' + (avN ? num(r2(avS)) : '') + '</td></tr></tbody></table>';
  }
  if (r.started) h += grp('คะแนนข้อเขียนรายกรรมการ', es, 'avg', gEx) + grp('คะแนนภาคปฏิบัติรายกรรมการ', pr, 'avg', gEx);
  if (e.ivOn && c.iv) h += grp('คะแนนสัมภาษณ์รายกรรมการ', d.ivItems, 'ivAvg', gIv);
  var notes = (c.notes || []).map(function (n) { return { g: n.g, t: n.t, k: 'ภาคปฏิบัติ' }; }).concat((c.ivNotes || []).map(function (n) { return { g: n.g, t: n.t, k: 'สัมภาษณ์' }; }));
  if (notes.length) h += '<h2>บันทึกของกรรมการ</h2><ul class="pr-notes">' + notes.map(function (n) { return '<li><b>' + esc(gName(n.g)) + '</b> (' + n.k + '): ' + esc(n.t) + '</li>'; }).join('') + '</ul>';
  if (c.profile) { var p = c.profile, mb = p.mbti ? MB_T[p.mbti] : null; h += '<h2>ทัศนคติและบุคลิกภาพ <small>(ไม่นำไปคิดคะแนน ใช้ประกอบการสัมภาษณ์)</small></h2><p>' + (p.nAtt ? 'คะแนนทัศนคติ ' + num(p.att, 2) + ' จาก 4 (' + attLevel(p.att)[0] + ')' : '') + (p.mbti ? ' · บุคลิกภาพ ' + esc(p.mbti) + (mb ? ' "' + esc(mb[0]) + '" ' + esc(mb[1]) : '') : '') + '</p>'; }
  var parts = (d.items.length && r.started ? ['EXAM'] : []).concat(e.ivOn && c.iv ? ['IV'] : []), gl = [];
  gEx.concat(gIv).forEach(function (g) { if (gl.indexOf(g) < 0) gl.push(g); });
  return prPage(h, certBlock(meta, parts, parts.length ? gl : []), last);
}
/** พิมพ์รายงาน: โหลดคะแนนล่าสุด → ออกรหัสเอกสาร (บันทึกผู้พิมพ์ วันเวลา) → จัดหน้า → พิมพ์ */
function printReport(type, scope, btn) {
  if (btn) busy(btn, true, 'กำลังเตรียมเอกสาร…');
  var fail = function (e) { if (btn) busy(btn, false); toast(e.message, 'bad'); };
  var log = function (t, s) { return api('logPrint', { examId: BD.id, type: t, scope: s || '' }, { quiet: true }); };
  api('getBoard', { examId: BD.id }).then(function (data) {
    BD.data = data; BD.at = Date.now(); var d = data;
    if (type === 'IVEACH') {
      var gl = gradersOf('IV'); if (!gl.length) throw new Error('ยังไม่มีกรรมการของรอบสอบนี้');
      var html = '', i = 0, first = null;
      var next = function () {
        if (i >= gl.length) return printDoc(html, { landscape: true, code: gl.length === 1 ? first.code : first.code + ' และอีก ' + (gl.length - 1) + ' ฉบับ', at: first.at });
        var g = gl[i++]; return log('IV', g).then(function (m) { first = first || m; html += docIvSheet(g, m, i >= gl.length); return next(); });
      };
      return next();
    }
    if (type === 'IND') {
      var cs = activeCands().filter(function (c) { return scope === 'ALL' ? (d.exam.ivOn ? c.iv : c.result.started) : scope === 'STARTED' ? c.result.started : c.examNo === scope; }).sort(byNo);
      if (!cs.length) throw new Error('ไม่มีผู้เข้าสอบตามที่เลือก');
      return log('IND', scope).then(function (m) { printDoc(cs.map(function (c, k) { return docIndividual(c, m, k === cs.length - 1); }).join(''), { portrait: true, code: m.code, at: m.at }); });
    }
    return log(type, scope).then(function (m) {
      if (type === 'IV') printDoc(docIvSheet(scope || d.me, m, true), { landscape: true, code: m.code, at: m.at });
      else if (type === 'IVALL') printDoc(docIvSheet('', m, true), { landscape: true, code: m.code, at: m.at });
      else if (type === 'SUM') printDoc(docSummary(m), { landscape: true, code: m.code, at: m.at });
      else if (type === 'BYG') printDoc(docByGrader(m), { landscape: true, code: m.code, at: m.at });
    });
  }).then(function () { if (btn) busy(btn, false); if (BD.tab === 'reports' && TG.view === 'board' && tabReports.hist) tabReports.hist(); }, fail);
}
/** เอกสารทั่วไป (ใบรหัสเข้าสอบ ใบลงชื่อ ฯลฯ): ออกรหัสเอกสารถ้าทำได้ ถ้าออกไม่ได้ยังพิมพ์ได้โดยระบุผู้พิมพ์และเวลา */
function printLogged(label, html, meta) {
  meta = meta || {};
  var go = function (m) { printDoc(html, { landscape: meta.landscape, portrait: meta.portrait, code: m && m.code, at: m && m.at }); };
  if (!BD.id) return go(null);
  api('logPrint', { examId: BD.id, type: 'OTHER', scope: label }, { quiet: true, tries: 2, timeout: 20000 }).then(go, function () { go(null); });
}
