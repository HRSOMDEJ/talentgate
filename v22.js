/* =====================================================================
   SOMDEJ TalentGate · v22.js — รุ่น 2.2 (8 พ.ย. 2569)
   ① เครื่องคิดเลขในหน้าทำข้อสอบ (ผู้ดูแลเปิดรายตอน) — ไม่ต้องสลับไปโปรแกรมอื่น จึงไม่ถูกนับว่าออกนอกหน้าจอ
   ② ธงประวัติผู้สมัคร: สมัครกี่ครั้ง มาสอบ ขาด/สละสิทธิ์ ไม่ผ่าน แนวโน้มคะแนน · หน้าทะเบียนผู้สมัคร
   ③ พิมพ์กระดาษทด รายคน/ทุกคนที่มีสิทธิ์สอบ/รายห้อง · คำชี้แจงกลาง + แก้เฉพาะรอบ · กระดาษเปล่า/เส้นบรรทัด/ตาราง
   ④ ยืนยันการเข้าสอบจากอีเมล: สถานะในแท็บผู้เข้าสอบ · เลือกส่งเตือนเฉพาะคนที่ยังไม่ตอบ
   ===================================================================== */
var V22 = { calc: null };
var ICON22 = {
  calc: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2.5"/><rect x="7" y="5" width="10" height="4" rx="1"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01"/></svg>',
  flag: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M5 21V4h11l-1.5 4L16 12H7v9z"/></svg>',
  reg: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  scratch: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>'
};
if (typeof TI !== 'undefined') TI.registry = ICON22.reg;

/* ====================== ① เครื่องคิดเลข ====================== */
/** คำนวณนิพจน์ (ไม่ใช้ eval): + − × ÷ ( ) % √ · ลำดับความสำคัญตามคณิตศาสตร์ · วงเล็บที่ยังไม่ปิดจะปิดให้เอง */
function calcEval(src) {
  var s = String(src).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '').replace(/\s+/g, ''), i = 0;
  var peek = function () { return s.charAt(i); };
  function num() {
    var m = s.slice(i).match(/^(\d+\.?\d*|\.\d+)/); if (!m) throw new Error('รูปแบบไม่ถูกต้อง');
    i += m[0].length; return parseFloat(m[0]);
  }
  function primary() {
    if (peek() === '(') { i++; var v = expr(); if (peek() === ')') i++; else if (i < s.length) throw new Error('รูปแบบไม่ถูกต้อง'); return v; }
    return num();
  }
  function factor() {
    var c = peek();
    if (c === '-') { i++; return -factor(); }
    if (c === '+') { i++; return factor(); }
    if (c === '√') { i++; var r = factor(); if (r < 0) throw new Error('ถอดรากของจำนวนลบไม่ได้'); return Math.sqrt(r); }
    var v = primary();
    while (peek() === '%') { i++; v = v / 100; }
    if (peek() === '(' || peek() === '√' || /[\d.]/.test(peek())) v = v * factor();   // 2(3) = 6
    return v;
  }
  function term() {
    var v = factor();
    while (peek() === '*' || peek() === '/') { var op = s.charAt(i++), r = factor(); if (op === '/' && r === 0) throw new Error('หารด้วยศูนย์ไม่ได้'); v = op === '*' ? v * r : v / r; }
    return v;
  }
  function expr() {
    var v = term();
    while (peek() === '+' || peek() === '-') { var op = s.charAt(i++), r = term(); v = op === '+' ? v + r : v - r; }
    return v;
  }
  if (!s) return null;
  var out = expr();
  if (i < s.length) throw new Error('รูปแบบไม่ถูกต้อง');
  if (!isFinite(out)) throw new Error('ผลลัพธ์ใหญ่เกินไป');
  return Number(out.toPrecision(12));
}
function calcFmt(n) {
  if (n === null || n === undefined) return '0';
  var a = Math.abs(n);
  if (a !== 0 && (a >= 1e15 || a < 1e-9)) return n.toExponential(6).replace(/\.?0+e/, 'e');
  return n.toLocaleString('en-US', { maximumFractionDigits: 10 });
}
var CALC_KEYS = [['C', 'clr'], ['(', 'op'], [')', 'op'], ['⌫', 'del'], ['7'], ['8'], ['9'], ['÷', 'op'], ['4'], ['5'], ['6'], ['×', 'op'], ['1'], ['2'], ['3'], ['−', 'op'], ['0'], ['.'], ['%', 'op'], ['+', 'op'], ['√', 'op'], ['=', 'eq']];
function calcMount() {
  calcUnmount();
  if (!CAND.sec || !CAND.sec.calc) return;
  var bar = $('.rbar'); if (!bar) return;
  var tg = document.createElement('button'); tg.type = 'button'; tg.className = 'btn calc-tg'; tg.id = 'rCalc'; tg.title = 'เปิด/ปิดเครื่องคิดเลข (ใช้ได้ในหน้านี้ ไม่ต้องสลับโปรแกรม)';
  tg.innerHTML = ICON22.calc + '<span>เครื่องคิดเลข</span>';
  var sub = $('#rSubmit', bar) || $('#pDone', bar); bar.insertBefore(tg, sub);
  var box = document.createElement('div'); box.className = 'calc'; box.id = 'calcBox'; box.hidden = true; box.tabIndex = -1; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'เครื่องคิดเลข');
  box.innerHTML = '<div class="calc-h"><span>' + ICON22.calc + 'เครื่องคิดเลข</span><button type="button" class="calc-x" aria-label="ปิดเครื่องคิดเลข">×</button></div>' +
    '<div class="calc-d"><div class="calc-e" id="calcE">&nbsp;</div><div class="calc-v" id="calcV">0</div></div>' +
    '<div class="calc-k">' + CALC_KEYS.map(function (k) { return '<button type="button" data-k="' + esc(k[0]) + '" class="ck' + (k[1] ? ' ck-' + k[1] : '') + '">' + k[0] + '</button>'; }).join('') + '</div>' +
    '<p class="calc-n">พิมพ์จากแป้นตัวเลขได้ · Enter = เท่ากับ · Esc = ปิด</p>';
  document.body.appendChild(box);
  var st = V22.calc = { box: box, tg: tg, expr: '', last: null, done: false, x: null, y: null };
  function paint(err) {
    $('#calcE').textContent = st.done ? st.expr + ' =' : (st.expr || ' ');
    var v = $('#calcV');
    if (err) { v.textContent = err; v.classList.add('err'); return; }
    v.classList.remove('err');
    if (st.done) { v.textContent = calcFmt(st.last); return; }
    try { var r = calcEval(st.expr.replace(/[+\-−×÷*/(√]+$/, '')); v.textContent = r === null ? '0' : calcFmt(r); } catch (e) { v.textContent = st.expr ? '…' : '0'; }
  }
  function press(k) {
    if (k === 'C') { st.expr = ''; st.done = false; return paint(); }
    if (k === '⌫') { if (st.done) { st.expr = ''; st.done = false; } else st.expr = st.expr.slice(0, -1); return paint(); }
    if (k === '=') {
      if (!st.expr) return;
      try { var r = calcEval(st.expr); if (r === null) return; st.last = r; st.done = true; paint(); }
      catch (e) { paint(e.message); }
      return;
    }
    var isOp = /^[+−×÷%)]$/.test(k);
    if (st.done) { st.expr = isOp ? String(st.last) : ''; st.done = false; }
    if (k === '.') { var tail = st.expr.match(/[\d.]*$/)[0]; if (tail.indexOf('.') >= 0) return; if (!tail) k = '0.'; }
    if (/^[+×÷]$/.test(k) && /[+−×÷]$/.test(st.expr)) st.expr = st.expr.slice(0, -1);   // เปลี่ยนเครื่องหมายที่เพิ่งกด
    if (st.expr.length >= 120) return;
    st.expr += k; paint();
  }
  $$('.ck', box).forEach(function (b) { b.onclick = function () { press(b.dataset.k); box.focus(); }; });
  box.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key, map = { '*': '×', 'x': '×', 'X': '×', '/': '÷', '-': '−', 'Enter': '=', '=': '=', 'Backspace': '⌫', 'Delete': 'C', ',': '.', 'r': '√', 'R': '√', '√': '√', 'c': 'C', 'C': 'C' };
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); return toggle(false); }
    var v = map[k] || (/^[\d.+%()]$/.test(k) ? k : '');
    if (!v) return;
    e.preventDefault(); e.stopPropagation(); press(v);
    var b = $('.ck[data-k="' + v + '"]', box); if (b) { b.classList.add('hit'); setTimeout(function () { b.classList.remove('hit'); }, 120); }
  });
  function toggle(on) {
    box.hidden = !on; tg.classList.toggle('on', on); tg.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) { place(); paint(); box.focus(); }
  }
  function place() {
    if (window.innerWidth <= 620) { box.style.left = ''; box.style.top = ''; return; }
    var w = box.offsetWidth || 300, h = box.offsetHeight || 460;
    if (st.x === null) { st.x = window.innerWidth - w - 24; st.y = Math.max(70, window.innerHeight - h - 24); }
    st.x = Math.max(8, Math.min(window.innerWidth - w - 8, st.x)); st.y = Math.max(8, Math.min(window.innerHeight - 60, st.y));
    box.style.left = st.x + 'px'; box.style.top = st.y + 'px';
  }
  tg.onclick = function () { toggle(box.hidden); };
  $('.calc-x', box).onclick = function () { toggle(false); };
  var hd = $('.calc-h', box), drag = null;
  hd.addEventListener('pointerdown', function (e) { if (e.target.closest('.calc-x') || window.innerWidth <= 620) return; drag = { dx: e.clientX - st.x, dy: e.clientY - st.y }; hd.setPointerCapture(e.pointerId); });
  hd.addEventListener('pointermove', function (e) { if (!drag) return; st.x = e.clientX - drag.dx; st.y = e.clientY - drag.dy; place(); });
  hd.addEventListener('pointerup', function () { drag = null; box.focus(); });
  st.onResize = function () { if (!box.hidden) place(); }; window.addEventListener('resize', st.onResize);
}
function calcUnmount() {
  var st = V22.calc; if (!st) return;
  if (st.box && st.box.parentNode) st.box.parentNode.removeChild(st.box);
  if (st.onResize) window.removeEventListener('resize', st.onResize);
  V22.calc = null;
}
(function () {   // ต่อท้ายฟังก์ชันเดิมของหน้าทำข้อสอบ (cand.js)
  if (typeof renderRunner === 'function') { var r0 = renderRunner; renderRunner = function () { var x = r0.apply(this, arguments); calcMount(); return x; }; }
  if (typeof renderPractical === 'function') { var p0 = renderPractical; renderPractical = function () { var x = p0.apply(this, arguments); calcMount(); return x; }; }
  if (typeof candStop === 'function') { var s0 = candStop; candStop = function () { calcUnmount(); return s0.apply(this, arguments); }; }
})();

/* ====================== ② ประวัติผู้สมัคร ====================== */
var HL_TH = { red: 'เคยขาดสอบ/สละสิทธิ์', orange: 'สมัครบ่อย', yellow: 'เคยสมัครแล้ว' };
var OUT_CLS = { WD: 'bad', BL: 'bad', AB: 'bad', WDR: 'bad', WAIT: '', SEL: 'ok', RES: 'info', FW: 'warn', FI: 'warn', NOIV: 'warn', NS: 'warn', GRADING: '', PASS: 'ok' };
/** ป้ายธงข้างชื่อ (กดดูรายละเอียด) */
function histChip(c) {
  var h = c && c.hist; if (!h) return '';
  var maybe = (h.maybe || []).length && h.apps < 2;
  if (maybe) return ' <button type="button" class="hchip maybe" data-hist="' + esc(c.examNo) + '" title="พบผู้สมัครรอบอื่นที่ข้อมูลคล้ายกัน — กดเพื่อตรวจและยืนยัน">' + ICON22.flag + 'อาจเคยสมัคร</button>';
  return ' <button type="button" class="hchip ' + (h.level || 'yellow') + '" data-hist="' + esc(c.examNo) + '" title="' + esc(HL_TH[h.level] || 'มีประวัติการสมัคร') + ' — กดดูประวัติ">' + ICON22.flag + 'สมัครครั้งที่ ' + h.apps + (h.absent + h.withdrawn ? ' · ขาด/สละ ' + (h.absent + h.withdrawn) : '') + ((h.maybe || []).length ? ' · ?' : '') + '</button>';
}
function histLookup(no) {
  var src = BD.tab === 'cands' && typeof AD !== 'undefined' && AD.cands ? AD.cands.candidates : BD.data ? BD.data.candidates : [];
  return src.filter(function (c) { return c.examNo === no; })[0] || (BD.data ? BD.data.candidates.filter(function (c) { return c.examNo === no; })[0] : null);
}
/** กราฟแนวโน้มคะแนน (ร้อยละ) */
function trendSvg(rounds) {
  var pts = rounds.filter(function (r) { return r.pct !== null && r.pct !== undefined; });
  if (pts.length < 2) return '';
  var W = 260, H = 70, n = pts.length, x = function (i) { return 16 + i * (W - 32) / (n - 1); }, y = function (v) { return H - 12 - (Math.max(0, Math.min(100, v)) / 100) * (H - 24); };
  return '<svg class="trend" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="แนวโน้มคะแนนสอบ (ร้อยละ)"><line x1="10" x2="' + (W - 10) + '" y1="' + y(60) + '" y2="' + y(60) + '" class="tr-60"/><polyline points="' + pts.map(function (r, i) { return x(i) + ',' + y(r.pct); }).join(' ') + '" class="tr-l"/>' +
    pts.map(function (r, i) { return '<circle cx="' + x(i) + '" cy="' + y(r.pct) + '" r="3.5" class="tr-p"/><text x="' + x(i) + '" y="' + (y(r.pct) - 7) + '" text-anchor="middle">' + num(r.pct, 1) + '</text>'; }).join('') + '</svg>';
}
function histBody(h, opt) {
  opt = opt || {};
  var k = function (v, t, cls) { return '<div class="hk' + (v && cls ? ' ' + cls : '') + '"><b>' + v + '</b><span>' + t + '</span></div>'; };
  var x = '<div class="hkpis">' + k(h.apps, 'สมัคร (ครั้ง)') + k(h.positions, 'ตำแหน่ง') + k(h.took, 'มาสอบ') + k(h.absent, 'ขาดสอบ', 'bad') + k(h.withdrawn, 'สละสิทธิ์', 'bad') + k(h.failWritten + h.failIv, 'ไม่ผ่าน', 'warn') + k(h.notSel + h.reserve, 'ไม่ได้รับเลือก/สำรอง', 'warn') + k(h.selected, 'ผ่านการคัดเลือก', 'ok') + '</div>';
  if (h.flags && h.flags.length) x += '<p class="hflags">' + h.flags.map(function (f) { return '<span class="hchip ' + ({ REPEAT: 'yellow', MANY: 'orange', ABSENT: 'red' }[f]) + ' static">' + ICON22.flag + ({ REPEAT: 'สมัครซ้ำ', MANY: 'สมัครบ่อยในช่วงเวลาที่กำหนด', ABSENT: 'เคยขาดสอบหรือสละสิทธิ์' }[f]) + '</span>'; }).join(' ') + '</p>';
  x += trendSvg(h.rounds);
  x += '<div class="tblwrap"><table class="tbl sm htbl"><thead><tr><th>รอบสอบ</th><th>ตำแหน่ง</th><th>วันสอบ</th><th class="c">เลขสอบ</th><th>ผล</th><th class="r">คะแนนสอบ (%)</th><th class="r">คะแนนรวม</th></tr></thead><tbody>' +
    h.rounds.slice().reverse().map(function (r) {
      var me = opt.examId && r.examId === opt.examId;
      return '<tr class="' + (me ? 'me' : '') + '"><td>' + esc(r.title) + (me ? ' <span class="tag info">รอบนี้</span>' : '') + '</td><td>' + esc(r.pos) + '</td><td class="sm">' + esc(r.date || '–') + '</td><td class="c">' + esc(no3(r.no)) + '</td><td><span class="tag ' + (OUT_CLS[r.out] || '') + '">' + esc(r.outTh) + '</span>' + (r.exc === 'NO' && r.out !== 'WD' && r.out !== 'WDR' ? ' <small class="bad-t">แจ้งขอสละสิทธิ์</small>' : '') + '</td><td class="r">' + (r.pct === null ? '–' : num(r.pct, 1)) + '</td><td class="r">' + (r.fin === null ? '–' : num(r.fin, 2)) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  return x;
}
function histModal(c) {
  var h = c.hist, admin = BD.data && BD.data.isAdmin;
  var mb = (h.maybe || []);
  var html = '<h2>ประวัติการสมัครสอบ</h2><p class="muted">' + esc(no3(c.examNo)) + ' ' + esc(c.name || c.nameIv || '') + ' · ข้อมูลจากทุกรอบสอบในระบบ (จับคู่จากชื่อ-สกุลคู่กับเบอร์โทรหรืออีเมล)</p>' + histBody(h, { examId: BD.id });
  if (mb.length) html += '<div class="note warn"><b>อาจเป็นคนเดียวกัน ' + mb.length + ' รายการ</b> — ข้อมูลบางส่วนตรงกัน ระบบจึงยังไม่รวมประวัติให้' + (admin ? ' กรุณาตรวจแล้วกดยืนยัน' : ' (ผู้ดูแลระบบเป็นผู้ยืนยัน)') + '<div class="mblist">' +
    mb.map(function (m) { return '<div class="mbrow"><div><b>' + esc(m.name) + '</b> · ' + esc(m.title) + ' (' + esc(m.pos || '') + ') เลขสอบ ' + esc(no3(m.no)) + '<br><small class="muted">' + esc(m.why) + '</small></div>' + (admin ? '<div class="acts"><button class="btn primary sm" data-lk="SAME" data-b="' + esc(m.key) + '">เป็นคนเดียวกัน</button><button class="btn ghost-dark sm" data-lk="DIFF" data-b="' + esc(m.key) + '">คนละคน</button></div>' : '') + '</div>'; }).join('') + '</div></div>';
  html += '<p class="muted sm">ขาดสอบ = มีสิทธิ์สอบแต่ไม่ได้เข้าสอบ · คะแนนสอบ (%) = คะแนนข้อเขียน/ปฏิบัติเทียบคะแนนเต็มของรอบนั้น · ประวัตินี้ใช้ประกอบการพิจารณาเท่านั้น</p>';
  var box = modal(html, { cls: 'wide' });
  $$('[data-lk]', box).forEach(function (b) {
    b.onclick = function () {
      busy(b, true, 'กำลังบันทึก…');
      api('linkPersons', { a: h.self, b: b.dataset.b, decision: b.dataset.lk }).then(function () {
        toast(b.dataset.lk === 'SAME' ? 'รวมประวัติแล้ว' : 'บันทึกว่าเป็นคนละคนแล้ว', 'ok'); closeModal();
        if (BD.tab === 'cands' && typeof tabCands === 'function') { AD.cands = null; tabCands(); } else loadBoard();
      }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); });
    };
  });
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-hist]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  var c = histLookup(b.dataset.hist); if (c && c.hist) histModal(c);
}, true);
/** ป้ายการยืนยันเข้าสอบ */
function excTag(c, cfgOn) {
  var x = c.exConfirm;
  if (!x) return cfgOn && c.status === 'ACTIVE' ? '<span class="exc wait">ยังไม่ตอบยืนยัน</span>' : '';
  return '<span class="exc ' + (x.answer === 'YES' ? 'y' : 'n') + '" title="ตอบเมื่อ ' + esc(tDate(x.at)) + '">' + (x.answer === 'YES' ? '✓ ยืนยันเข้าสอบ' : '✕ แจ้งขอสละสิทธิ์') + '</span>';
}
/* ชื่อในหน้าที่ไม่ใช่หน้าตรวจ (สรุปผล สัมภาษณ์ อีเมล ฯลฯ) แสดงธงประวัติต่อท้าย · หน้าตรวจ (grading) ไม่แสดง */
(function () {
  if (typeof cLabel !== 'function') return;
  var c0 = cLabel;
  cLabel = function (c, grading) { return c0(c, grading) + (grading ? '' : histChip(c)); };
  if (typeof ivName === 'function') { /* ชื่อในตารางรายงานใช้ ivName — ไม่แตะเพื่อไม่ให้ธงไปอยู่ในเอกสารที่พิมพ์ */ }
})();

/* ---------- หน้าทะเบียนผู้สมัคร ---------- */
var RG = { data: null, q: '', f: 'all' };
function viewRegistry() {
  if (typeof boardStop === 'function') boardStop();
  TG.view = 'registry'; markNav();
  if (!RG.data) $('#app').innerHTML = '<div class="boot"><div class="boot-ring"></div><p>กำลังรวบรวมประวัติผู้สมัคร…</p></div>'; else draw();
  load();
  function load() { return api('getRegistry', {}, { timeout: 120000 }).then(function (r) { RG.data = r; if (TG.view === 'registry') draw(); }).catch(function (e) { toast(e.message, 'bad'); }); }
  function draw() {
    var r = RG.data, ppl = r.people, rep = ppl.filter(function (p) { return p.apps >= r.cfg.repeat; }).length, red = ppl.filter(function (p) { return p.level === 'red'; }).length, mb = ppl.filter(function (p) { return p.maybe.length; }).length;
    var h = '<div class="wrap"><div class="phead"><div><span class="eyebrow">' + roleLabel() + '</span><h1>ทะเบียนผู้สมัคร</h1><p class="muted">ประวัติการสมัครสอบของแต่ละคนจากทุกรอบสอบในระบบ — ความถี่ การมาสอบ ผล และแนวโน้มคะแนน</p></div>' +
      '<div class="phead-r">' + (isAdmin() ? '<button class="btn ghost-dark sm" id="rgCfg">ตั้งเกณฑ์ธง / คำนวณใหม่</button>' : '') + '<button class="btn ghost-dark sm" id="rgCsv">' + ICON.down + 'ส่งออก CSV</button></div></div>';
    if (r.missing.length) h += '<div class="note warn">ยังไม่มีข้อมูลของ ' + r.missing.length + ' รอบสอบ (' + r.missing.slice(0, 4).map(function (x) { return esc(x.title); }).join(', ') + (r.missing.length > 4 ? ' …' : '') + ') — ' + (isAdmin() ? 'กด "ตั้งเกณฑ์ธง / คำนวณใหม่" เพื่อรวบรวมทุกรอบ' : 'ผู้ดูแลระบบกด "คำนวณใหม่" เพื่อรวบรวม') + ' หรือเปิดกระดานของรอบนั้น 1 ครั้ง</div>';
    h += '<div class="rgkpi"><div><b>' + ppl.length + '</b><span>ผู้สมัคร (คน)</span></div><div><b>' + r.exams.length + '</b><span>รอบสอบ</span></div><div class="y"><b>' + rep + '</b><span>สมัครตั้งแต่ ' + r.cfg.repeat + ' ครั้ง</span></div><div class="r"><b>' + red + '</b><span>เคยขาดสอบ/สละสิทธิ์</span></div><div class="g"><b>' + mb + '</b><span>อาจซ้ำ รอยืนยัน</span></div></div>';
    h += '<div class="card"><div class="inrow cdflt"><input id="rgQ" class="srch" placeholder="ค้นหาชื่อ เบอร์โทร หรืออีเมล" value="' + esc(RG.q) + '" autocomplete="off"><div class="seg" id="rgF">' +
      [['all', 'ทั้งหมด'], ['rep', 'สมัครซ้ำ'], ['red', 'ธงแดง'], ['maybe', 'อาจซ้ำ']].map(function (f) { return '<button data-f="' + f[0] + '" class="' + (RG.f === f[0] ? 'on' : '') + '">' + f[1] + '</button>'; }).join('') + '</div><span class="muted sm" id="rgN"></span></div>' +
      '<div class="tblwrap tall"><table class="tbl rgtbl"><thead><tr><th>ชื่อ-สกุล</th><th>ธง</th><th class="r">สมัคร</th><th class="r">ตำแหน่ง</th><th class="r">มาสอบ</th><th class="r">ขาด/สละ</th><th class="r">ไม่ผ่าน</th><th class="r">ได้รับเลือก</th><th>สมัครล่าสุด</th><th class="r">คะแนนล่าสุด</th></tr></thead><tbody>' +
      ppl.map(function (p, i) {
        var last = p.rounds[p.rounds.length - 1] || {}, lp = p.rounds.filter(function (x) { return x.pct !== null; }).pop();
        return '<tr data-i="' + i + '" data-f="' + [p.apps >= r.cfg.repeat ? 'rep' : '', p.level === 'red' ? 'red' : '', p.maybe.length ? 'maybe' : ''].join(' ') + '" data-q="' + esc((p.name + ' ' + p.phone + ' ' + p.email).toLowerCase()) + '" class="rgrow"><td><b>' + esc(p.name) + '</b>' + (p.phone ? '<br><small class="muted">' + esc(p.phone.replace(/^(\d{2})(\d{3})/, '0$1-$2-')) + '</small>' : '') + '</td><td>' +
          (p.level ? '<span class="hchip ' + p.level + ' static">' + ICON22.flag + esc(HL_TH[p.level]) + '</span>' : '') + (p.maybe.length ? ' <span class="hchip maybe static">อาจซ้ำ ' + p.maybe.length + '</span>' : '') + '</td><td class="r"><b>' + p.apps + '</b></td><td class="r">' + p.positions + '</td><td class="r">' + p.took + '</td><td class="r' + (p.absent + p.withdrawn ? ' bad-t' : '') + '">' + (p.absent + p.withdrawn) + '</td><td class="r">' + (p.failWritten + p.failIv) + '</td><td class="r' + (p.selected ? ' ok-t' : '') + '">' + p.selected + '</td><td class="sm">' + esc(last.pos || '') + '<br><small class="muted">' + esc(last.title || '') + '</small></td><td class="r">' + (lp ? num(lp.pct, 1) + '%' : '–') + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="muted sm">กดแถวเพื่อดูประวัติรายรอบ · ระบบรวมเป็นคนเดียวกันเมื่อชื่อ-สกุลตรงกัน (ไม่นับคำนำหน้า) และเบอร์โทรหรืออีเมลตรงกัน · ถ้าตรงเพียงบางส่วนจะแสดง "อาจซ้ำ" ให้ผู้ดูแลยืนยัน · เกณฑ์ธง: เหลือง = สมัครตั้งแต่ ' + r.cfg.repeat + ' ครั้ง · ส้ม = สมัครตั้งแต่ ' + r.cfg.many + ' ครั้งใน ' + r.cfg.months + ' เดือน · แดง = เคยขาดสอบหรือสละสิทธิ์</p></div></div>';
    keepScroll(function () { $('#app').innerHTML = h; });
    var filt = function () {
      var q = RG.q.trim().toLowerCase(), n = 0;
      $$('.rgrow').forEach(function (tr) { var on = (!q || tr.dataset.q.indexOf(q) >= 0) && (RG.f === 'all' || tr.dataset.f.split(' ').indexOf(RG.f) >= 0); tr.hidden = !on; if (on) n++; });
      $('#rgN').textContent = 'แสดง ' + n + ' คน';
    };
    $('#rgQ').oninput = function () { RG.q = this.value; filt(); };
    $$('#rgF button').forEach(function (b) { b.onclick = function () { RG.f = b.dataset.f; $$('#rgF button').forEach(function (x) { x.classList.toggle('on', x === b); }); filt(); }; });
    filt();
    $$('.rgrow').forEach(function (tr) {
      tr.onclick = function () {
        var p = ppl[+tr.dataset.i], admin = isAdmin();
        var html = '<h2>' + esc(p.name) + '</h2><p class="muted">' + [p.phone ? 'โทร ' + p.phone.replace(/^(\d{2})(\d{3})/, '0$1-$2-') : '', p.email].filter(String).map(esc).join(' · ') + '</p>' + histBody(p);
        if (p.maybe.length) html += '<div class="note warn"><b>อาจเป็นคนเดียวกัน ' + p.maybe.length + ' รายการ</b><div class="mblist">' + p.maybe.map(function (m) { return '<div class="mbrow"><div><b>' + esc(m.name) + '</b> · ' + esc(m.title) + ' เลขสอบ ' + esc(no3(m.no)) + '</div>' + (admin ? '<div class="acts"><button class="btn primary sm" data-lk="SAME" data-a="' + esc(m.a) + '" data-b="' + esc(m.b) + '">เป็นคนเดียวกัน</button><button class="btn ghost-dark sm" data-lk="DIFF" data-a="' + esc(m.a) + '" data-b="' + esc(m.b) + '">คนละคน</button></div>' : '') + '</div>'; }).join('') + '</div></div>';
        var box = modal(html, { cls: 'wide' });
        $$('[data-lk]', box).forEach(function (b) { b.onclick = function () { busy(b, true, 'กำลังบันทึก…'); api('linkPersons', { a: b.dataset.a, b: b.dataset.b, decision: b.dataset.lk }).then(function () { toast('บันทึกแล้ว', 'ok'); closeModal(); load(); }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); }); }; });
      };
    });
    $('#rgCsv').onclick = function () {
      var rows = [['ชื่อ-สกุล', 'โทรศัพท์', 'อีเมล', 'ธง', 'สมัคร (ครั้ง)', 'ตำแหน่ง', 'มาสอบ', 'ขาดสอบ', 'สละสิทธิ์', 'ไม่ผ่านข้อเขียน', 'ไม่ผ่านสัมภาษณ์', 'ไม่ได้รับเลือก/สำรอง', 'ผ่านการคัดเลือก', 'ประวัติรายรอบ']].concat(ppl.map(function (p) {
        return [p.name, p.phone ? '0' + p.phone : '', p.email, HL_TH[p.level] || '', p.apps, p.positions, p.took, p.absent, p.withdrawn, p.failWritten, p.failIv, p.notSel + p.reserve, p.selected, p.rounds.map(function (x) { return x.title + ' (' + x.pos + '): ' + x.outTh + (x.pct !== null ? ' ' + x.pct + '%' : ''); }).join(' | ')];
      }));
      var csv = '﻿' + rows.map(function (r) { return r.map(function (v) { v = String(v === null || v === undefined ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'TalentGate_Registry_' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    };
    if ($('#rgCfg')) $('#rgCfg').onclick = function () {
      var c = r.cfg, box = modal('<h2>เกณฑ์ธงประวัติผู้สมัคร</h2><div class="form"><label>ธงเหลือง: สมัครตั้งแต่ (ครั้ง)<input id="rgC1" type="number" min="2" max="20" value="' + c.repeat + '"></label><div class="row2"><label>ธงส้ม: สมัครตั้งแต่ (ครั้ง)<input id="rgC2" type="number" min="2" max="50" value="' + c.many + '"></label><label>ภายใน (เดือนล่าสุด)<input id="rgC3" type="number" min="1" max="60" value="' + c.months + '"></label></div><p class="muted sm">ธงแดง = เคยขาดสอบหรือสละสิทธิ์อย่างน้อย 1 ครั้ง · กด "บันทึกและคำนวณใหม่" ระบบจะรวบรวมผลของทุกรอบสอบใหม่ทั้งหมด (อาจใช้เวลา 1–2 นาที)</p></div><div class="modal-act"><button class="btn ghost-dark" id="rgCx">ยกเลิก</button><button class="btn primary" id="rgCs">บันทึกและคำนวณใหม่</button></div>', { cls: 'sm' });
      $('#rgCx', box).onclick = closeModal;
      $('#rgCs', box).onclick = function () {
        var b = this; busy(b, true, 'กำลังคำนวณ…');
        api('rebuildHistory', { cfg: { repeat: Number(val('rgC1')), many: Number(val('rgC2')), months: Number(val('rgC3')) } }, { timeout: 300000 }).then(function (x) { closeModal(); toast('รวบรวมแล้ว ' + x.done + ' รอบ' + (x.fail.length ? ' · ไม่สำเร็จ ' + x.fail.length : ''), x.fail.length ? 'warn' : 'ok', 7000); return load(); }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); });
      };
    };
  }
}

/* ====================== ③ กระดาษทด ====================== */
var SCR_STYLE = { BLANK: 'กระดาษเปล่า', LINES: 'มีเส้นบรรทัด', GRID: 'ตารางสี่เหลี่ยม' };
function scratchCfg() { var d = BD.data, s = (d.cfg || {}).scratch || {}; return { note: s.note || '', style: s.style || 'LINES', pages: s.pages || 2, central: d.scratchDefault || '' }; }
function scratchModal(preNo) {
  var d = BD.data, e = d.exam, sc = scratchCfg(), act = d.candidates.filter(function (c) { return c.status === 'ACTIVE'; }), rooms = (d.rooms || []).filter(String);
  var html = '<h2>' + ICON22.scratch + ' พิมพ์กระดาษทด</h2><p class="muted">ชื่อ เลขประจำตัวสอบ ตำแหน่ง วันสอบ เวลา และสถานที่ ดึงจากรอบสอบนี้ให้อัตโนมัติ</p><div class="form">' +
    '<div class="row2"><label>พิมพ์ให้<select id="scWho"><option value="ALL">ผู้มีสิทธิ์สอบทุกคน (' + act.length + ' คน)</option>' + rooms.map(function (r) { return '<option value="R:' + esc(r) + '">เฉพาะห้อง ' + esc(r) + ' (' + act.filter(function (c) { return c.room === r; }).length + ' คน)</option>'; }).join('') +
    '<option value="ONE"' + (preNo ? ' selected' : '') + '>รายคน (เลือกด้านขวา)</option><option value="BLANK">แบบว่าง ไม่ระบุชื่อ (สำรอง)</option></select></label><label>ผู้เข้าสอบ<select id="scNo"' + (preNo ? '' : ' disabled') + '>' + act.map(function (c) { return '<option value="' + esc(c.examNo) + '"' + (c.examNo === preNo ? ' selected' : '') + '>' + esc(no3(c.examNo)) + ' ' + esc(c.name) + '</option>'; }).join('') + '</select></label></div>' +
    '<div class="row2"><label>ลักษณะกระดาษ<select id="scSt">' + Object.keys(SCR_STYLE).map(function (k) { return '<option value="' + k + '"' + (sc.style === k ? ' selected' : '') + '>' + SCR_STYLE[k] + '</option>'; }).join('') + '</select></label><label>จำนวนหน้าต่อคน<input id="scPg" type="number" min="1" max="10" value="' + sc.pages + '"></label></div>' +
    '<label>คำชี้แจงบนกระดาษทด <small class="muted">(1 บรรทัด = 1 ข้อ)</small><textarea id="scNote" rows="5" maxlength="2000">' + esc(sc.note || sc.central) + '</textarea></label>' +
    '<p class="muted sm" id="scSrc">' + (sc.note ? 'ใช้คำชี้แจง<b>เฉพาะรอบนี้</b>' : 'ใช้<b>คำชี้แจงกลาง</b> (ทุกรอบสอบ)') + '</p>' +
    (d.isAdmin ? '<div class="acts"><button class="btn ghost-dark sm" id="scSvR">บันทึกเป็นค่าของรอบนี้</button><button class="btn ghost-dark sm" id="scSvC">บันทึกคำชี้แจงเป็นข้อความกลาง</button>' + (sc.note ? '<button class="btn link sm" id="scUseC">ใช้ข้อความกลาง</button>' : '') + '</div>' : '') +
    '</div><div class="modal-act"><button class="btn ghost-dark" id="scX">ปิด</button><button class="btn primary" id="scGo">' + ICON.print + 'ดูตัวอย่าง / พิมพ์</button></div>';
  var box = modal(html, { cls: 'wide' });
  $('#scWho', box).onchange = function () { $('#scNo', box).disabled = this.value !== 'ONE'; };
  $('#scX', box).onclick = closeModal;
  var cur = function () { return { note: $('#scNote', box).value.trim(), style: $('#scSt', box).value, pages: Math.max(1, Math.min(10, Number($('#scPg', box).value) || 2)) }; };
  var save = function (scope, b) {
    var x = cur(); busy(b, true, 'กำลังบันทึก…');
    api('saveScratch', { examId: BD.id, scope: scope, note: scope === 'ROUND' && x.note === sc.central ? '' : x.note, style: x.style, pages: x.pages }).then(function (r) {
      busy(b, false);
      if (scope === 'CENTRAL') { d.scratchDefault = r.note; toast('บันทึกคำชี้แจงกลางแล้ว — ใช้กับทุกรอบที่ไม่ได้ตั้งเฉพาะรอบ', 'ok', 6000); }
      else { d.cfg.scratch = r.scratch; toast('บันทึกค่ากระดาษทดของรอบนี้แล้ว', 'ok'); $('#scSrc', box).innerHTML = r.scratch.note ? 'ใช้คำชี้แจง<b>เฉพาะรอบนี้</b>' : 'ใช้<b>คำชี้แจงกลาง</b> (ทุกรอบสอบ)'; }
    }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); });
  };
  if ($('#scSvR', box)) $('#scSvR', box).onclick = function () { save('ROUND', this); };
  if ($('#scSvC', box)) $('#scSvC', box).onclick = function () { save('CENTRAL', this); };
  if ($('#scUseC', box)) $('#scUseC', box).onclick = function () { $('#scNote', box).value = d.scratchDefault || ''; };
  $('#scGo', box).onclick = function () {
    var who = $('#scWho', box).value, x = cur(), list;
    if (who === 'ALL') list = act; else if (who === 'ONE') list = act.filter(function (c) { return c.examNo === $('#scNo', box).value; }); else if (who === 'BLANK') list = [null]; else list = act.filter(function (c) { return c.room === who.slice(2); });
    if (!list.length) return toast('ไม่มีผู้เข้าสอบในกลุ่มที่เลือก', 'warn');
    var b = this; busy(b, true, 'กำลังเตรียมเอกสาร…');
    api('logPrint', { examId: BD.id, type: 'SCRATCH', scope: who === 'ONE' ? $('#scNo', box).value : who === 'ALL' ? 'ALL' : who === 'BLANK' ? 'BLANK' : who }, { quiet: true }).then(function (m) {
      busy(b, false);
      printDoc(docScratch(list, x, m), { portrait: true, plain: true, margin: '10mm 12mm 10mm', code: m.code, at: m.at, title: 'กระดาษทด · ' + (who === 'ONE' ? 'เลขประจำตัวสอบ ' + no3(list[0].examNo) : who === 'BLANK' ? 'แบบว่าง' : list.length + ' คน × ' + x.pages + ' หน้า = ' + list.length * x.pages + ' แผ่น') });
    }).catch(function (e) { busy(b, false); toast(e.message, 'bad'); });
  };
}
/** เส้นในพื้นที่ทด (SVG พิมพ์ได้ทุกเบราว์เซอร์โดยไม่ต้องเปิดพิมพ์พื้นหลัง) */
function scratchArea(style, hMm) {
  var W = 186, H = hMm, g = '';
  if (style === 'LINES') for (var y = 9; y < H - 1; y += 9) g += '<line x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="#9aa3b2" stroke-width=".18"/>';
  if (style === 'GRID') { for (var y2 = 5; y2 < H; y2 += 5) g += '<line x1="0" x2="' + W + '" y1="' + y2 + '" y2="' + y2 + '" stroke="#c3c9d4" stroke-width=".12"/>'; for (var x = 5; x < W; x += 5) g += '<line y1="0" y2="' + H + '" x1="' + x + '" x2="' + x + '" stroke="#c3c9d4" stroke-width=".12"/>'; }
  return '<svg class="sc-area" viewBox="0 0 ' + W + ' ' + H + '" style="height:' + H + 'mm" preserveAspectRatio="none" aria-hidden="true"><rect x=".2" y=".2" width="' + (W - .4) + '" height="' + (H - .4) + '" fill="none" stroke="#5b6577" stroke-width=".3" rx="1.2"/>' + g + '<text x="' + W / 2 + '" y="' + H / 2 + '" text-anchor="middle" class="sc-wm" transform="rotate(-28 ' + W / 2 + ' ' + H / 2 + ')">กระดาษทด · ห้ามนำออกจากห้องสอบ</text></svg>';
}
function docScratch(list, x, meta) {
  var d = BD.data, e = d.exam, o = hosp(), notes = x.note.split('\n').map(function (t) { return t.replace(/^\s*[-•·\d.)]+\s*/, '').trim(); }).filter(String), out = [], total = list.length * x.pages, k = 0;
  list.forEach(function (c) {
    for (var p = 1; p <= x.pages; p++) {
      k++;
      var id = '<div class="sc-id"><div class="sc-no"><span>เลขประจำตัวสอบ</span><b>' + (c ? esc(no3(c.examNo)) : '&nbsp;') + '</b></div><div class="sc-nm"><span>ชื่อ-สกุล</span><b>' + (c ? esc(c.name) : '') + '</b></div>' + (c && c.room ? '<div class="sc-rm"><span>ห้องสอบ</span><b>' + esc(c.room) + '</b></div>' : '') + '<div class="sc-pg"><span>แผ่นที่</span><b>' + p + '/' + x.pages + '</b></div></div>';
      var h = '';
      if (p === 1) {
        h += '<div class="pr-lh"><img class="pr-logo" src="' + esc(logoSrc()) + '" alt=""><div><b>' + esc(o.name + ' ' + o.sub) + '</b><span>' + esc(o.org) + '</span></div><div class="sc-tt">กระดาษทด</div></div>' +
          '<table class="sc-info"><tr><td>ตำแหน่ง</td><td><b>' + esc(e.posName) + '</b></td><td>รอบสอบ</td><td>' + esc(e.title) + '</td></tr><tr><td>วันและเวลาสอบ</td><td>' + esc(e.examDate || '–') + '</td><td>สถานที่สอบ</td><td>' + esc(e.place || '–') + '</td></tr></table>' + id +
          (notes.length ? '<div class="sc-note"><b>คำชี้แจง</b><ol>' + notes.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol></div>' : '');
        h += scratchArea(x.style, notes.length ? Math.max(110, 172 - notes.length * 5.2) : 182);
      } else {
        h += '<div class="sc-mini"><b>กระดาษทด</b> · ' + esc(e.posName) + ' · ' + esc(e.examDate || '') + '</div>' + id + scratchArea(x.style, 214);
      }
      h += '<div class="sc-ft"><span>ลงชื่อผู้เข้าสอบ ................................................</span><span>ลงชื่อกรรมการคุมสอบ ................................................</span></div>' +
        '<div class="sc-code">รหัสเอกสาร ' + esc(meta.code) + ' · ' + (c ? 'เลขประจำตัวสอบ ' + esc(no3(c.examNo)) + ' แผ่นที่ ' + p + '/' + x.pages : 'แบบว่าง') + ' · SOMDEJ TalentGate · ' + esc(tLong(meta.at)) + '</div>';
      out.push('<section class="pr scr' + (k < total ? ' pr-break' : '') + '">' + h + '</section>');
    }
  });
  return out.join('');
}
/* ปุ่มกระดาษทดในแท็บรายงาน (กลุ่ม "ก่อนสอบ") */
(function () {
  if (typeof tabReports !== 'function') return;
  var t0 = tabReports;
  tabReports = function () {
    var x = t0.apply(this, arguments);
    try {
      if (isBoss() && !$('#rpScr')) {
        var first = $('#tab .rpgrid');
        var card = '<div class="rp"><b>' + ICON22.scratch + ' กระดาษทด</b><small>A4 แนวตั้ง · ชื่อ เลขประจำตัวสอบ วันสอบ สถานที่ จากระบบ · คำชี้แจงแก้ได้ · รายคน / ทุกคน / รายห้อง · เปล่า เส้นบรรทัด หรือตาราง</small><button class="btn primary sm" id="rpScr">' + ICON.print + 'เลือกและพิมพ์</button></div>';
        if (first) first.insertAdjacentHTML('beforeend', card); else $('#tab').insertAdjacentHTML('afterbegin', '<div class="card"><div class="rpgrid">' + card + '</div></div>');
        $('#rpScr').onclick = function () { scratchModal(); };
      }
    } catch (e) { }
    return x;
  };
})();

/* ====================== ④ อีเมลยืนยันการเข้าสอบ ====================== */
function excMailNote() {
  var d = BD.data, x = (tabMail.r && tabMail.r.exc) || (d.cfg || {}).exc || {}, link = '<a href="#/staff/' + encodeURIComponent(d.exam.examId) + '/setup">ตั้งค่ารอบสอบ</a>';
  var c = d.candidates.filter(function (c) { return c.status === 'ACTIVE'; }), y = c.filter(function (c) { return c.exConfirm && c.exConfirm.answer === 'YES'; }).length, n = c.filter(function (c) { return c.exConfirm && c.exConfirm.answer === 'NO'; }).length;
  if (!x.due) return '<div class="note warn">ยังไม่ได้กำหนด<b>วันที่ต้องตอบกลับ</b> — อีเมลจะเขียนว่า "ภายในก่อนวันสอบ" และผู้สมัครตอบได้จนกว่าจะปิดรับคำตอบ · กำหนดวันได้ที่แท็บ ' + link + ' หัวข้อ "การยืนยันเข้าสอบ" (ถ้าไม่ต้องการให้ยืนยัน ให้ลบบรรทัด {{ลิงก์ยืนยันเข้าสอบ}} ออก)</div>';
  return '<div class="note info"><b>ยืนยันการเข้าสอบ:</b> ตอบกลับภายใน ' + esc(thDateStr(x.due)) + (x.bring ? ' · สิ่งที่ต้องนำมา: ' + esc(x.bring.split('\n').map(function (t) { return t.replace(/^[-•·]\s*/, ''); }).filter(String).join(', ')) : '') + ' · แก้ได้ที่แท็บ ' + link +
    '<br>ตอบแล้ว: ยืนยันเข้าสอบ <b>' + y + '</b> · แจ้งขอสละสิทธิ์ <b>' + n + '</b> · ยังไม่ตอบ <b>' + (c.length - y - n) + '</b> คน — กดปุ่ม "ยังไม่ตอบยืนยัน" ทางขวาเพื่อเลือกส่งอีเมลเตือน · ผู้ที่ขอสละสิทธิ์ HR เปลี่ยนสถานะเองที่แท็บผู้เข้าสอบ</div>';
}
var TH_MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
function thDateStr(ymd) { var m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? Number(m[3]) + ' ' + TH_MONTH[Number(m[2]) - 1] + ' ' + (Number(m[1]) + 543) : ''; }
/** ส่วนค่าตั้ง "การยืนยันเข้าสอบ" ในการ์ดการคัดเลือก (หน้าตั้งค่ารอบสอบ) */
function excCfgHtml(ex, ro) {
  var x = (ex.cfg || {}).exc || {}, dis = ro ? ' disabled' : '';
  return '<div class="se-l">การยืนยันเข้าสอบ — ใช้ในอีเมล "แจ้งรายชื่อผู้มีสิทธิ์สอบ" (ผู้สมัครกดยืนยันมาสอบ หรือแจ้งสละสิทธิ์ ผ่านลิงก์ในอีเมล)</div>' +
    '<div class="cfg-g"><label>ตอบกลับได้ถึงวันที่<input id="cfExD" type="date" value="' + esc(x.due || '') + '"' + dis + '></label><label style="grid-column:span 2">สิ่งที่ต้องนำมาในวันสอบ <small class="muted">(1 บรรทัด = 1 รายการ)</small><textarea id="cfExB" rows="3" maxlength="1000" placeholder="บัตรประจำตัวประชาชน&#10;ปากกาสีน้ำเงิน"' + dis + '>' + esc(x.bring || '') + '</textarea></label></div>';
}
(function () {   // ต่อการ์ด "การคัดเลือกและการแจ้งผล" (v21.js) ให้มีค่าการยืนยันเข้าสอบ และเก็บค่ารุ่น 2.2 ไว้เมื่อบันทึก
  if (typeof cfgCard === 'function') { var c0 = cfgCard; cfgCard = function (ex, ro) { var h = c0(ex, ro); return h.replace(/<\/div><\/div>$/, excCfgHtml(ex, ro) + '</div></div>'); }; }
  if (typeof cfgPull === 'function') {
    var p0 = cfgPull;
    cfgPull = function (ex) {
      var old = ex.cfg || {};
      p0(ex);
      if (!$('#cfSeats')) return;
      ex.cfg.calc = old.calc || []; ex.cfg.scratch = old.scratch || {};
      ex.cfg.exc = $('#cfExD') ? { due: val('cfExD'), bring: $('#cfExB').value.trim() } : (old.exc || {});
    };
  }
})();
/** สรุปการตอบยืนยันเข้าสอบ (หัวแท็บผู้เข้าสอบ) */
function excSummary(r) {
  if (!r.exc || !r.exc.due) return '';
  var act = r.candidates.filter(function (c) { return c.status === 'ACTIVE'; }), y = act.filter(function (c) { return c.exConfirm && c.exConfirm.answer === 'YES'; }).length, n = r.candidates.filter(function (c) { return c.exConfirm && c.exConfirm.answer === 'NO'; });
  var nAct = n.filter(function (c) { return c.status === 'ACTIVE'; }).length;
  return '<p class="excsum"><b>ยืนยันการเข้าสอบ</b> (ตอบได้ถึง ' + esc(thDateStr(r.exc.due)) + '): <span class="exc y">✓ ยืนยัน ' + y + '</span> <span class="exc n">✕ ขอสละสิทธิ์ ' + n.length + '</span> <span class="exc wait">ยังไม่ตอบ ' + (act.length - y - nAct) + '</span>' +
    (nAct ? ' <small class="bad-t">· มี ' + nAct + ' คนแจ้งขอสละสิทธิ์แต่สถานะยังเป็น "มีสิทธิ์สอบ" — เปลี่ยนสถานะเป็น "สละสิทธิ์" ในตารางด้านล่าง</small>' : '') + '</p>';
}
