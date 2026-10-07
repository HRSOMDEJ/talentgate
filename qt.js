/* =====================================================================
   SOMDEJ TalentGate · qt.js — ชนิดข้อสอบ (รุ่น 2.0): หน้าทำข้อสอบ · การแสดงเฉลยในคลัง · การแสดงคำตอบให้กรรมการ
   ===================================================================== */
var QT = {
  MCQ:    { th: 'ปรนัยตอบเดียว', g: 'T', auto: 1, hint: 'เลือกคำตอบที่ถูกต้องที่สุดเพียงข้อเดียว' },
  MULTI:  { th: 'ปรนัยหลายคำตอบ', g: 'T', auto: 1, hint: 'เลือกได้มากกว่า 1 ข้อ — ต้องเลือกให้ครบและถูกทุกข้อจึงได้คะแนน' },
  TF:     { th: 'ถูก / ผิด', g: 'T', auto: 1, hint: 'เลือก "ถูก" หรือ "ผิด" ให้ครบทุกข้อย่อย' },
  MATCH:  { th: 'จับคู่', g: 'T', auto: 1, hint: 'เลือกตัวเลือกทางขวาที่สัมพันธ์กับแต่ละข้อ' },
  ORDER:  { th: 'เรียงลำดับ', g: 'T', auto: 1, hint: 'ใช้ปุ่มลูกศรเลื่อนรายการให้เรียงตามลำดับที่ถูกต้อง' },
  FILL:   { th: 'เติมคำในช่องว่าง', g: 'T', auto: 1, hint: 'พิมพ์คำตอบในช่องว่างให้ครบทุกช่อง' },
  SHORT:  { th: 'ตอบสั้น', g: 'T', manual: 1, hint: 'พิมพ์คำตอบสั้น ๆ ให้ครบประเด็น' },
  ESSAY:  { th: 'ข้อเขียน', g: 'T', manual: 1, hint: 'พิมพ์คำตอบในช่องที่กำหนด' },
  TABLE:  { th: 'ตอบเป็นตาราง', g: 'T', manual: 1, hint: 'พิมพ์คำตอบลงในแต่ละช่องของตาราง' },
  SJT:    { th: 'สถานการณ์ (ทัศนคติ)', g: 'P', hint: 'เลือกสิ่งที่ท่านจะทำจริงมากที่สุด' },
  MBTI:   { th: 'บุคลิกภาพ 2 ตัวเลือก', g: 'P', hint: 'เลือกข้อความที่ตรงกับท่านมากกว่า' },
  LIKERT: { th: 'มาตรประมาณค่า 1–5', g: 'P', hint: 'เลือกระดับที่ตรงกับตัวท่านมากที่สุด — ไม่มีคำตอบถูกหรือผิด' }
};
var QT_SEC = { MCQ: 'ปรนัย', MULTI: 'ปรนัยหลายคำตอบ', TF: 'ถูก / ผิด', MATCH: 'จับคู่', ORDER: 'เรียงลำดับ', FILL: 'เติมคำ', SHORT: 'ตอบสั้น', ESSAY: 'ข้อเขียน', TABLE: 'ตอบเป็นตาราง', SJT: 'ส่วนสถานการณ์', MBTI: 'ส่วนบุคลิกภาพ', LIKERT: 'ส่วนลักษณะการทำงาน' };
var THX = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ', 'ช', 'ซ', 'ฌ', 'ญ', 'ฎ', 'ฏ', 'ฐ', 'ฑ', 'ฒ', 'ณ', 'ด', 'ต', 'ถ', 'ท'];
function qtName(t) { return (QT[t] || {}).th || t; }
function fillParts(text) { return String(text || '').split(/_{3,}/); }

/* ---------- หน้าทำข้อสอบ: ช่องตอบของแต่ละชนิด ---------- */
function qBody(q, i, v) {
  var t = q.type, ch = q.choices || [], h = '';
  if (t === 'ESSAY' || t === 'SHORT') return '<textarea class="essay' + (t === 'SHORT' ? ' short' : '') + '" data-q="' + i + '" rows="' + (t === 'SHORT' ? 4 : 9) + '" maxlength="' + (t === 'SHORT' ? 1500 : 6000) + '" placeholder="พิมพ์คำตอบที่นี่" spellcheck="false">' + esc(v || '') + '</textarea><div class="ecount" id="ec' + i + '"></div>';
  if (t === 'MCQ' || t === 'SJT' || t === 'MBTI' || t === 'MULTI') return '<div class="opts' + (t === 'MULTI' ? ' multi' : '') + '">' + ch.map(function (c, j) { return '<button type="button" class="opt" data-q="' + i + '" data-v="' + (j + 1) + '"><i>' + (t === 'MBTI' ? (j + 1) : THX[j]) + '</i><span>' + esc(c) + '</span></button>'; }).join('') + '</div>';
  if (t === 'LIKERT') return '<div class="lk" role="radiogroup">' + ch.map(function (c, j) { return '<button type="button" class="opt lkb" data-q="' + i + '" data-v="' + (j + 1) + '"><i>' + (j + 1) + '</i><span>' + esc(c) + '</span></button>'; }).join('') + '</div>';
  if (t === 'TF') return '<div class="tf">' + ch.map(function (c, j) { return '<div class="tf-r" data-j="' + j + '"><span class="tf-n">' + (j + 1) + '</span><p>' + esc(c) + '</p><div class="tf-b"><button type="button" class="tfb t" data-q="' + i + '" data-i="' + j + '" data-v="T">ถูก</button><button type="button" class="tfb f" data-q="' + i + '" data-i="' + j + '" data-v="F">ผิด</button></div></div>'; }).join('') + '</div>';
  if (t === 'MATCH') {
    var l = ch.l || [], r = ch.r || [];
    return '<div class="mt"><div class="mt-key"><b>ตัวเลือก</b>' + r.map(function (c, j) { return '<span><i>' + THX[j] + '</i>' + esc(c) + '</span>'; }).join('') + '</div>' +
      l.map(function (c, j) { return '<div class="mt-r"><span class="tf-n">' + (j + 1) + '</span><p>' + esc(c) + '</p><select class="mts" data-q="' + i + '" data-i="' + j + '" aria-label="คำตอบของข้อ ' + (j + 1) + '"><option value="0">— เลือก —</option>' + r.map(function (x, k) { return '<option value="' + (k + 1) + '">' + THX[k] + '. ' + esc(x.length > 46 ? x.slice(0, 44) + '…' : x) + '</option>'; }).join('') + '</select></div>'; }).join('') + '</div>';
  }
  if (t === 'ORDER') return '<div class="ord" data-ord="' + i + '"></div>';
  if (t === 'FILL') {
    var p = fillParts(q.text), a = Array.isArray(v) ? v : [];
    for (var k = 0; k < p.length; k++) { h += nl2br(p[k]); if (k < p.length - 1) h += '<input class="fl" data-q="' + i + '" data-i="' + k + '" maxlength="200" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="ช่องว่างที่ ' + (k + 1) + '" value="' + esc(a[k] || '') + '" placeholder="' + (k + 1) + '">'; }
    return '<div class="fill">' + h + '</div>';
  }
  if (t === 'TABLE') {
    var cols = ch.cols || [], rows = ch.rows || [], tv = Array.isArray(v) ? v : [];
    return '<div class="tblwrap"><table class="tans"><thead><tr><th>' + esc(ch.corner || '') + '</th>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (rw, r2) { return '<tr><th>' + esc(rw) + '</th>' + cols.map(function (c, c2) { return '<td data-l="' + esc(c) + '"><textarea class="tc" data-q="' + i + '" data-r="' + r2 + '" data-c="' + c2 + '" rows="4" maxlength="1200" spellcheck="false" placeholder="' + esc(c) + '" aria-label="' + esc(rw + ' · ' + c) + '">' + esc((tv[r2] || [])[c2] || '') + '</textarea></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  return '';
}
/** โจทย์ที่แสดง (ข้อเติมคำ: โจทย์อยู่ในช่องตอบแล้ว จึงไม่แสดงซ้ำ) */
function qText(q) { return q.type === 'FILL' ? '' : '<div class="qt">' + nl2br(q.text) + '</div>'; }
function qDone(q, v) {
  var t = q.type, ch = q.choices || [];
  if (v === undefined || v === null || v === '') return false;
  if (t === 'ESSAY' || t === 'SHORT') return !!String(v).trim();
  if (t === 'MULTI') return Array.isArray(v) && v.length > 0;
  if (t === 'TF') return Array.isArray(v) && ch.every(function (x, i) { return v[i] === 'T' || v[i] === 'F'; });
  if (t === 'MATCH') return Array.isArray(v) && (ch.l || []).every(function (x, i) { return Number(v[i]) > 0; });
  if (t === 'ORDER') return Array.isArray(v) && v.length === ch.length;
  if (t === 'FILL') return Array.isArray(v) && fillParts(q.text).slice(1).every(function (x, i) { return String(v[i] || '').trim(); });
  if (t === 'TABLE') return Array.isArray(v) && v.some(function (r) { return (r || []).some(function (c) { return String(c || '').trim(); }); });
  return !!v;
}
/** ตอบไปแล้วบางส่วนแต่ยังไม่ครบ (ใช้เตือนก่อนส่ง) */
function qPartial(q, v) {
  if (qDone(q, v) || v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.some(function (x) { return Array.isArray(x) ? x.some(String) : x && x !== '0' && x !== 0; });
  return false;
}
/** วาดรายการเรียงลำดับตามคำตอบปัจจุบัน (ยังไม่ตอบ = ลำดับที่ระบบแสดง) */
function ordPaint(q, i, v, root) {
  var el = $('[data-ord="' + i + '"]', root); if (!el) return;
  var ch = q.choices || [], cur = Array.isArray(v) && v.length === ch.length ? v : ch.map(function (x, k) { return k; }), set = Array.isArray(v) && v.length === ch.length;
  el.innerHTML = cur.map(function (k, pos) { return '<div class="ord-r"><span class="tf-n">' + (pos + 1) + '</span><p>' + esc(ch[k]) + '</p><span class="ord-b"><button type="button" class="ordb" data-q="' + i + '" data-p="' + pos + '" data-d="-1" aria-label="เลื่อนขึ้น"' + (pos === 0 ? ' disabled' : '') + '>▲</button><button type="button" class="ordb" data-q="' + i + '" data-p="' + pos + '" data-d="1" aria-label="เลื่อนลง"' + (pos === cur.length - 1 ? ' disabled' : '') + '>▼</button></span></div>'; }).join('') +
    '<div class="ord-f">' + (set ? '<span class="ok-t sm">' + ICON.check + ' บันทึกลำดับนี้แล้ว</span>' : '<button type="button" class="btn ghost-dark sm ordok" data-q="' + i + '">ยืนยันว่าลำดับนี้ถูกต้องแล้ว</button><span class="muted sm">ยังไม่ได้ตอบข้อนี้</span>') + '</div>';
}
/** รับเหตุการณ์จากช่องตอบ → ค่าคำตอบใหม่ (undefined = ไม่เกี่ยว) */
function qClick(q, cur, t) {
  var o = t.closest('.opt'), b, a;
  if (o) { var v = +o.dataset.v; if (q.type !== 'MULTI') return v; a = Array.isArray(cur) ? cur.slice() : []; var k = a.indexOf(v); if (k >= 0) a.splice(k, 1); else a.push(v); return a.sort(function (x, y) { return x - y; }); }
  if ((b = t.closest('.tfb'))) { a = (q.choices || []).map(function (x, i) { return (Array.isArray(cur) ? cur[i] : '') || ''; }); a[+b.dataset.i] = a[+b.dataset.i] === b.dataset.v ? '' : b.dataset.v; return a; }
  if ((b = t.closest('.ordb'))) { var n = (q.choices || []).length; a = Array.isArray(cur) && cur.length === n ? cur.slice() : (q.choices || []).map(function (x, i) { return i; }); var p = +b.dataset.p, j = p + Number(b.dataset.d); if (j < 0 || j >= n) return undefined; var x = a[p]; a[p] = a[j]; a[j] = x; return a; }
  if ((b = t.closest('.ordok'))) return (q.choices || []).map(function (x, i) { return i; });
  return undefined;
}
function qInputVal(q, cur, t) {
  if (t.classList.contains('essay')) return t.value;
  var a;
  if (t.classList.contains('fl')) { a = fillParts(q.text).slice(1).map(function (x, i) { return (Array.isArray(cur) ? cur[i] : '') || ''; }); a[+t.dataset.i] = t.value; return a; }
  if (t.classList.contains('mts')) { a = ((q.choices || {}).l || []).map(function (x, i) { return Number(Array.isArray(cur) ? cur[i] : 0) || 0; }); a[+t.dataset.i] = Number(t.value) || 0; return a; }
  if (t.classList.contains('tc')) { var ch = q.choices || {}; a = (ch.rows || []).map(function (x, r) { return (ch.cols || []).map(function (y, c) { return ((Array.isArray(cur) ? cur[r] : null) || [])[c] || ''; }); }); a[+t.dataset.r][+t.dataset.c] = t.value; return a; }
  return undefined;
}
/** ปรับสถานะที่เลือกบนหน้าจอให้ตรงกับคำตอบ */
function qPaint(q, i, v, el) {
  var t = q.type;
  if (t === 'MULTI') $$('.opt', el).forEach(function (o) { o.classList.toggle('on', Array.isArray(v) && v.indexOf(+o.dataset.v) >= 0); });
  else if (t === 'TF') $$('.tfb', el).forEach(function (b) { b.classList.toggle('on', Array.isArray(v) && v[+b.dataset.i] === b.dataset.v); });
  else if (t === 'MATCH') $$('.mts', el).forEach(function (s) { var x = String((Array.isArray(v) ? v[+s.dataset.i] : 0) || 0); if (s.value !== x) s.value = x; s.classList.toggle('on', x !== '0'); });
  else if (t === 'ORDER') ordPaint(q, i, v, el);
  else $$('.opt', el).forEach(function (o) { o.classList.toggle('on', v === +o.dataset.v); });
}

/* ---------- คลังข้อสอบ: แสดงตัวเลือกและเฉลย ---------- */
function qKeyHtml(q) {
  var t = q.type, ch = q.choices || [], lv, h = '';
  if (t === 'MCQ' || t === 'MULTI') { var ks = String(q.answer).split(',').map(String); h = '<ol class="bq-c">' + ch.map(function (c, j) { return '<li class="' + (ks.indexOf(String(j + 1)) >= 0 ? 'key' : '') + '"><i>' + THX[j] + '</i>' + esc(c) + '</li>'; }).join('') + '</ol>'; }
  else if (t === 'SJT') { lv = String(q.answer).split(','); h = '<ol class="bq-c">' + ch.map(function (c, j) { return '<li><i>' + THX[j] + '</i>' + esc(c) + '<span class="lvb lv' + lv[j] + '">ระดับ ' + lv[j] + '</span></li>'; }).join('') + '</ol>'; }
  else if (t === 'MBTI') h = '<ol class="bq-c">' + ch.map(function (c) { var p = c.split('|'); return '<li><i>' + esc(p[0]) + '</i>' + esc(p.slice(1).join('|')) + '</li>'; }).join('') + '</ol>';
  else if (t === 'LIKERT') h = '<p class="bq-x">มาตร 1–5: ' + (ch.length === 5 ? ch.map(esc).join(' · ') : 'ไม่ตรงเลย · ไม่ค่อยตรง · ปานกลาง · ค่อนข้างตรง · ตรงมากที่สุด') + (q.answer === 'R' ? ' <span class="tag warn">ข้อความเชิงลบ: กลับคะแนน</span>' : '') + '</p>';
  else if (t === 'TF') { lv = String(q.answer).split(','); h = '<ol class="bq-c">' + ch.map(function (c, j) { return '<li><i>' + (j + 1) + '</i>' + esc(c) + '<span class="tag ' + (lv[j] === 'T' ? 'ok' : 'bad') + ' ml">' + (lv[j] === 'T' ? 'ถูก' : 'ผิด') + '</span></li>'; }).join('') + '</ol>'; }
  else if (t === 'MATCH') { lv = String(q.answer).split(',').map(Number); h = '<ol class="bq-c">' + (ch.l || []).map(function (c, j) { return '<li><i>' + (j + 1) + '</i>' + esc(c) + '<span class="tag ok ml">' + THX[lv[j] - 1] + '. ' + esc((ch.r || [])[lv[j] - 1] || '') + '</span></li>'; }).join('') + '</ol><p class="bq-x"><b>ตัวเลือกทั้งหมด:</b> ' + (ch.r || []).map(function (c, j) { return THX[j] + '. ' + esc(c); }).join(' · ') + '</p>'; }
  else if (t === 'ORDER') h = '<ol class="bq-c">' + ch.map(function (c, j) { return '<li class="key"><i>' + (j + 1) + '</i>' + esc(c) + '</li>'; }).join('') + '</ol><p class="bq-x">ลำดับที่ถูกต้องตามที่แสดง · ผู้เข้าสอบแต่ละคนเห็นลำดับสลับไม่เหมือนกัน</p>';
  else if (t === 'FILL') { var ka = []; try { ka = JSON.parse(q.answer || '[]'); } catch (e) { } h = '<ol class="bq-c">' + ka.map(function (a, j) { return '<li class="key"><i>' + (j + 1) + '</i>' + (Array.isArray(a) ? a : [a]).map(esc).join(' <span class="muted">หรือ</span> ') + '</li>'; }).join('') + '</ol><p class="bq-x">ระบบไม่สนใจช่องว่าง ตัวพิมพ์เล็ก-ใหญ่ และเครื่องหมายวรรคตอน · กรรมการรับคำตอบเพิ่มได้ในหน้าตรวจของรอบสอบ</p>'; }
  else if (t === 'TABLE') h = '<div class="tblwrap"><table class="tbl sm tprev"><thead><tr><th>' + esc(ch.corner || '') + '</th>' + (ch.cols || []).map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + (ch.rows || []).map(function (r) { return '<tr><th>' + esc(r) + '</th>' + (ch.cols || []).map(function () { return '<td class="muted">(ผู้เข้าสอบพิมพ์ตอบ)</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  if (q.rubric) h += t === 'MCQ' || t === 'MULTI' || QT[t].g === 'P' || QT[t].auto ? '<p class="bq-x"><b>คำอธิบาย:</b> ' + nl2br(q.rubric) + '</p>' : '<div class="bq-r"><b>เกณฑ์ให้คะแนน / แนวคำตอบ</b><br>' + nl2br(q.rubric) + '</div>';
  return h;
}
function qTextHtml(q) {
  if (q.type !== 'FILL') return nl2br(q.text);
  var p = fillParts(q.text), h = '';
  for (var k = 0; k < p.length; k++) { h += nl2br(p[k]); if (k < p.length - 1) h += '<span class="fl-b">' + (k + 1) + '</span>'; }
  return h;
}

/* ---------- หน้าตรวจ: คำตอบของผู้เข้าสอบ (ข้อเขียน · ตอบสั้น · ตาราง) ---------- */
function ansLen(item, v) { return item.qtype === 'TABLE' ? (Array.isArray(v) ? v.reduce(function (a, r) { return a + (r || []).reduce(function (b, c) { return b + String(c || '').length; }, 0); }, 0) : 0) : String(v || '').length; }
function ansHtml(item, v) {
  if (item.qtype === 'TABLE') {
    var ch = item.table || {}, tv = Array.isArray(v) ? v : [];
    if (!ansLen(item, v)) return '<div class="ans none">— ไม่ได้ตอบ —</div>';
    return '<div class="tblwrap"><table class="tbl sm tprev"><thead><tr><th>' + esc(ch.corner || '') + '</th>' + (ch.cols || []).map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + (ch.rows || []).map(function (r, i) { return '<tr><th>' + esc(r) + '</th>' + (ch.cols || []).map(function (c, j) { var x = (tv[i] || [])[j] || ''; return '<td>' + (String(x).trim() ? nl2br(x) : '<span class="muted">—</span>') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  return String(v || '').trim() ? '<div class="ans">' + nl2br(v) + '</div>' : '<div class="ans none">— ไม่ได้ตอบ —</div>';
}
