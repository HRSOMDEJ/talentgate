/* =====================================================================
   SOMDEJ TalentGate · cand.js — หน้าผู้เข้าสอบ: หน้าหลัก · ทำข้อสอบ · ภาคปฏิบัติ
   ===================================================================== */
var CAND = { sec: null, qs: [], ans: {}, marks: {}, blur: 0, due: 0, dirty: false, saving: false, savedAt: 0, saveFail: 0, submitting: false, timer: null, saver: null, poll: null, lastBlur: 0, forced: false };
var TH = ['ก', 'ข', 'ค', 'ง'];
var SEC_ICON = { PROFILE: '🧭', THEORY: '📝', PRACTICAL: '💻' };
var FLAG_TH = { AUTO: 'ระบบปิดตอนเมื่อหมดเวลา', GRACE: 'ส่งในช่วงผ่อนผัน', CLOSED: 'ปิดโดยกรรมการ', NOFILE: 'ไม่ได้ส่งไฟล์', SAME: 'ไฟล์เหมือนโจทย์ต้นฉบับ', REOPEN: 'กรรมการเปิดให้ทำต่อ' };

function draftKey(secId) { return 'tg_d:' + TG.state.exam.examId + ':' + TG.state.me.examNo + ':' + secId; }
function candStop() {
  clearInterval(CAND.timer); clearTimeout(CAND.saver); clearInterval(CAND.poll);
  window.onbeforeunload = null; window.removeEventListener('blur', onBlurAway); document.removeEventListener('visibilitychange', onVis);
  CAND.sec = null; CAND.submitting = false; CAND.lockClock = false; document.body.classList.remove('in-exam');
}
/** กันออกจากหน้าทำข้อสอบโดยไม่ตั้งใจ (กดย้อนกลับ) */
function candLeaving(parts) {
  if (TG.kind === 'cand' && CAND.sec && !(parts[0] === 'exam' && parts[1] === CAND.sec.secId)) { history.replaceState(null, '', '#/exam/' + CAND.sec.secId); return true; }
  return false;
}
var _sync0 = syncClock;
syncClock = function (t) { if (!CAND.lockClock) _sync0(t); };   // ระหว่างทำข้อสอบใช้นาฬิกาชุดเดียวตลอดตอน เวลาที่แสดงจึงไม่กระโดด

function candRoute(parts) {
  document.body.className = 'pg-cand' + (CAND.sec ? ' in-exam' : ''); topRight();
  if (!TG.state) return api('getCandState').then(function (s) { TG.state = s; candRoute(parts); }).catch(function (e) { toast(e.message, 'bad'); });
  if (parts[0] === 'exam' && parts[1]) { if (CAND.sec && CAND.sec.secId === parts[1]) return; return viewSection(parts[1]); }
  if (location.hash !== '#/exam') history.replaceState(null, '', '#/exam');
  viewCandHome();
}

/* ---------- หน้าหลักของผู้เข้าสอบ ---------- */
function viewCandHome() {
  candStop(); TG.view = 'candHome';
  var st = TG.state, secs = st.sections, done = secs.every(function (s) { return s.status === 'DONE'; });
  var next = secs.filter(function (s) { return s.status !== 'DONE'; })[0], agKey = st.exam.examId + '|' + st.me.examNo, agreed = sess('tg_agree') === agKey;
  var h = '<div class="wrap mid"><div class="card cand-head"><span class="eyebrow">รอบสอบ</span><h1>' + esc(st.exam.title) + '</h1><p class="muted">' + esc(st.exam.examDate) + (st.exam.place ? ' · ' + esc(st.exam.place) : '') + '</p>' +
    '<div class="idrow"><div class="idbox"><small>เลขประจำตัวสอบ</small><b>' + esc(no3(st.me.examNo)) + '</b></div><div class="idbox grow"><small>ชื่อ-สกุล</small><b>' + esc(st.me.name) + '</b></div></div>' +
    '<p class="muted sm">หากชื่อไม่ตรงกับท่าน โปรดแจ้งกรรมการคุมสอบทันที ก่อนเริ่มทำข้อสอบ</p></div>';
  if (done) {
    var sv = st.survey && !st.survey.done ? st.survey : null;
    h += '<div class="card done-card"><div class="confetti" aria-hidden="true">' + new Array(15).join('<i></i>') + '</div><div class="done-mark"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="23" fill="none"/><path d="M15 27l8 8 15-17" fill="none"/></svg></div><h2>ส่งคำตอบครบทุกตอนแล้ว</h2><p class="muted">ระบบบันทึกคำตอบของท่านเรียบร้อย ขอบคุณที่เข้าร่วมการสอบคัดเลือก<br>โรงพยาบาลจะประกาศผลตามช่องทางที่แจ้งไว้</p>' + (sv ? '' : (st.survey && st.survey.done ? '<p class="ok-t sm mt">ขอบคุณสำหรับแบบประเมินความพึงพอใจ</p>' : '') + '<button class="btn primary lg mt" id="cOut">ออกจากระบบ</button>') + '</div>';
    if (sv) h += '<form class="card survey" id="svF">' + surveyInner(sv, 'ข้ามและออกจากระบบ') + '</form>';
  } else if (st.exam.status !== 'OPEN') {
    h += '<div class="note warn">รอบสอบนี้ปิดรับคำตอบแล้ว หากมีข้อสงสัยโปรดติดต่อกรรมการคุมสอบ</div>';
  } else if (!agreed) {
    h += '<div class="card"><h2 class="card-t">ข้อปฏิบัติในการสอบ</h2><ol class="rule-list">' + st.rules.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ol>' +
      '<label class="agree"><input type="checkbox" id="cAgree"><span>ข้าพเจ้ารับทราบข้อปฏิบัติข้างต้น ยืนยันว่าเป็นผู้เข้าสอบตามชื่อที่แสดง และจะทำข้อสอบด้วยตนเองอย่างสุจริต</span></label></div>';
  }
  h += '<h2 class="sec-h">ตอนสอบ</h2><div class="steps">';
  secs.forEach(function (s, i) {
    var cur = next && next.secId === s.secId, stTxt, cls = s.status === 'DONE' ? 'done' : s.status === 'DOING' ? 'doing' : cur ? 'cur' : 'lock', btn = '';
    if (s.status === 'DONE') stTxt = '<span class="tag ok">ส่งแล้ว ' + tTime(s.submitAt) + ' น.</span>' + flagTags(s.flag);
    else if (s.status === 'DOING') { stTxt = '<span class="tag warn">กำลังทำ · เหลือเวลา ' + fmtClock(s.dueAt - now()) + '</span>'; btn = '<button class="btn primary" data-go="' + esc(s.secId) + '">ทำต่อ</button>'; }
    else if (cur && st.exam.status === 'OPEN') {
      if (!s.open) stTxt = '<span class="tag">รอกรรมการเปิดให้เริ่ม</span>';
      else { stTxt = '<span class="tag info">พร้อมเริ่ม</span>'; btn = '<button class="btn primary" data-start="' + esc(s.secId) + '">เริ่มทำตอนนี้</button>'; }
    } else stTxt = '<span class="tag">ยังไม่ถึงลำดับ</span>';
    h += '<div class="step ' + cls + '" style="--i:' + i + '"><div class="step-n">' + (s.status === 'DONE' ? ICON.check : (i + 1)) + '</div><div class="step-b"><h3>' + esc(s.title) + '</h3><p class="step-m">' + ICON.clock + s.minutes + ' นาที' +
      (s.type === 'PRACTICAL' ? ' · ส่งเป็นไฟล์ Excel' : ' · ' + s.nQuestions + ' ข้อ') + (s.maxScore ? ' · ' + s.maxScore + ' คะแนน' : ' · ไม่คิดคะแนน') + '</p><p class="step-i">' + esc(s.instructions) + '</p><div class="step-s">' + stTxt + '</div></div><div class="step-a">' + btn + '</div></div>';
  });
  h += '</div>' + (st.contact ? '<p class="muted center sm mt">' + esc(st.contact) + '</p>' : '') + '</div>';
  $('#app').innerHTML = h;
  if ($('#cOut')) $('#cOut').onclick = logout;
  if ($('#svF')) bindSurvey($('#svF'), st, function () { viewCandHome(); window.scrollTo(0, 0); });
  // ป๊อปอัปเชิญทำแบบประเมินทันทีที่ส่งครบทุกตอน (ข้ามได้) — เดิมแบบประเมินอยู่ท้ายหน้า บางคนมองไม่เห็น
  if (done && st.survey && !st.survey.done && sess('tg_svAsk') !== agKey) {
    sess('tg_svAsk', agKey);
    var mb = modal('<div class="sv-pop"><div class="done-mark sm"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="23" fill="none"/><path d="M15 27l8 8 15-17" fill="none"/></svg></div><h2>ส่งคำตอบครบทุกตอนแล้ว</h2><p class="muted">ขอความร่วมมือทำแบบประเมินการใช้ระบบสอบออนไลน์ เพื่อนำไปพัฒนาระบบต่อไป</p></div><form class="survey in-modal" id="svM">' + surveyInner(st.survey, 'ข้าม') + '</form>', { cls: 'lg' });
    bindSurvey($('#svM', mb), st, function () { closeModal(); viewCandHome(); window.scrollTo(0, 0); }, function () { closeModal(); });
  }
  var ag = $('#cAgree'); if (ag) { toggleStart(false); ag.onchange = function () { if (ag.checked) sess('tg_agree', agKey); else sess('tg_agree', null); toggleStart(ag.checked); }; }
  $$('[data-go]').forEach(function (b) { b.onclick = function () { location.hash = '#/exam/' + b.dataset.go; }; });
  $$('[data-start]').forEach(function (b) {
    b.onclick = function () {
      var s = secs.filter(function (x) { return x.secId === b.dataset.start; })[0];
      confirmBox('เริ่ม ' + s.title, '<p>เมื่อกดเริ่ม <b>เวลา ' + s.minutes + ' นาทีจะเริ่มนับทันทีและหยุดไม่ได้</b></p><p class="muted">เมื่อหมดเวลา ระบบจะส่งคำตอบให้อัตโนมัติ</p>', 'เริ่มทำ').then(function (y) { if (y) location.hash = '#/exam/' + s.secId; });
    };
  });
  // ตรวจสถานะเป็นระยะ (เช่น รอกรรมการเปิดตอน / กรรมการเพิ่มเวลา)
  if (!done) CAND.poll = setInterval(function () {
    if (TG.view !== 'candHome' || document.hidden) return;
    api('getCandState').then(function (s) { var a = JSON.stringify(TG.state.sections.map(function (x) { return [x.status, x.open, x.dueAt]; })), b = JSON.stringify(s.sections.map(function (x) { return [x.status, x.open, x.dueAt]; })); TG.state = s; if (a !== b || s.exam.status !== st.exam.status) viewCandHome(); }).catch(function () { });
  }, 30000);
}
function surveyInner(sv, skipLabel) {
  return '<span class="eyebrow">ใช้เวลาไม่เกิน 1 นาที</span><h2 class="card-t">แบบประเมินความพึงพอใจการใช้ระบบสอบออนไลน์</h2><p class="card-s">ไม่บังคับ · ไม่ระบุตัวผู้ตอบ · <b>ไม่มีผลต่อคะแนนสอบ</b> — ความเห็นของท่านช่วยให้ฝ่ายทรัพยากรบุคคลปรับปรุงระบบให้ดีขึ้น</p>' +
    '<div class="sv-scale"><span>1 = น้อยที่สุด</span><span>5 = มากที่สุด</span></div>' + sv.items.map(function (t, i) {
      return '<div class="sv-q" role="radiogroup" aria-label="' + esc(t) + '"><p><b>' + (i + 1) + '.</b> ' + esc(t) + '</p><div class="sv-r">' + [1, 2, 3, 4, 5].map(function (n) { return '<label><input type="radio" name="sv' + i + '" value="' + n + '"><span>' + n + '</span></label>'; }).join('') + '</div></div>';
    }).join('') + '<label class="sv-c">ข้อเสนอแนะเพิ่มเติม (ถ้ามี)<textarea class="sv-cm" rows="3" maxlength="1500" placeholder="สิ่งที่ชอบ สิ่งที่ควรปรับปรุง หรือปัญหาที่พบระหว่างสอบ"></textarea></label>' +
    '<div class="modal-act"><button type="button" class="btn ghost-dark sv-skip"' + (skipLabel === 'ข้ามและออกจากระบบ' ? ' id="cOut"' : '') + '>' + skipLabel + '</button><button class="btn primary sv-send">ส่งแบบประเมิน</button></div>';
}
function bindSurvey(form, st, after, skip) {
  if (skip) $('.sv-skip', form).onclick = skip;
  form.onsubmit = function (e) {
    e.preventDefault();
    var scores = st.survey.items.map(function (t, i) { var x = $('[name=sv' + i + ']:checked', form); return x ? Number(x.value) : ''; }), cm = $('.sv-cm', form).value.trim();
    if (!cm && scores.every(function (v) { return v === ''; })) return toast('กรุณาให้คะแนนอย่างน้อย 1 ข้อ หรือเขียนข้อเสนอแนะ', 'warn');
    var b = $('.sv-send', form); busy(b, true, 'กำลังส่ง…');
    api('submitSurvey', { scores: scores, comment: cm }).then(function () { st.survey.done = true; toast('ขอบคุณสำหรับความเห็นของท่าน', 'ok'); after(); }).catch(function (er) { busy(b, false); toast(er.message, 'bad'); });
  };
}
function toggleStart(on) { $$('[data-start],[data-go]').forEach(function (b) { b.disabled = !on; b.title = on ? '' : 'กรุณาติ๊กรับทราบข้อปฏิบัติก่อน'; }); }
function flagTags(f) { return String(f || '').split(',').filter(String).map(function (x) { return '<span class="tag ' + (x === 'NOFILE' || x === 'SAME' ? 'bad' : 'warn') + '">' + esc(FLAG_TH[x] || x) + '</span>'; }).join(''); }

/* ---------- เข้าตอนสอบ ---------- */
function viewSection(secId) {
  candStop(); TG.view = 'section';
  $('#app').innerHTML = '<div class="boot"><div class="boot-ring"></div><p>กำลังเตรียมข้อสอบ…</p></div>';
  api('startSection', { secId: secId }, { quiet: true, tries: 5 }).then(function (r) {
    var s = r.section, d = store(draftKey(secId)) || {};
    CAND.sec = s; CAND.qs = r.questions; CAND.blur = Math.max(r.blur || 0, d.blur || 0); CAND.due = s.dueAt; CAND.lockClock = true;
    CAND.ans = Object.assign({}, r.answers || {}, d.ans || {}); CAND.marks = d.marks || {};
    CAND.dirty = Object.keys(d.ans || {}).length > 0; CAND.savedAt = 0; CAND.saveFail = 0; CAND.forced = false;
    CAND.grace = (r.graceSec || 120) * 1000;
    document.body.classList.add('in-exam');
    window.onbeforeunload = function (e) { e.preventDefault(); e.returnValue = ''; return ''; };
    if (s.type === 'PRACTICAL') renderPractical(); else { renderRunner(); window.addEventListener('blur', onBlurAway); document.addEventListener('visibilitychange', onVis); }
    CAND.timer = setInterval(tick, 500); tick(); scheduleSave(8000);
  }).catch(function (e) {
    toast(e.message, 'bad'); history.replaceState(null, '', '#/exam');
    api('getCandState').then(function (s) { TG.state = s; viewCandHome(); }).catch(function () { viewCandHome(); });
  });
}
function localSave() { if (CAND.sec) store(draftKey(CAND.sec.secId), { ans: CAND.ans, marks: CAND.marks, blur: CAND.blur }); }
function onBlurAway() { away(); }
function onVis() { if (document.hidden) away(); }
function away() {
  if (!CAND.sec || CAND.submitting || !$('#modal').hidden && modal._lock) return;
  var t = Date.now(); if (t - CAND.lastBlur < 1500) return; CAND.lastBlur = t;
  CAND.blur++; CAND.dirty = true; localSave();
  toast('ระบบบันทึกว่าท่านออกจากหน้าสอบ (ครั้งที่ ' + CAND.blur + ') — โปรดอยู่ในหน้านี้จนกว่าจะส่งคำตอบ', 'bad', 7000);
}

/* ---------- ตัวจับเวลา ---------- */
function tick() {
  if (!CAND.sec) return;
  var left = CAND.due - now(), el = $('#rTime'), pr = CAND.sec.type === 'PRACTICAL';
  if (el) { el.textContent = fmtClock(left); el.parentNode.className = 'rtimer' + (left <= 60000 ? ' danger' : left <= 300000 ? ' warn' : ''); }
  if (left <= 300000 && left > 299000 && !CAND._w5) { CAND._w5 = 1; toast('เหลือเวลา 5 นาที', 'warn', 6000); }
  if (left > 300000) CAND._w5 = 0;
  if (!pr && left <= 20000 && left > 0 && CAND.dirty && !CAND.saving && !CAND._pre) { CAND._pre = 1; saveNow(); }
  if (pr) {
    var fin = CAND.due + Math.max(30000, CAND.grace - 45000) - now(), bn = $('#pOver');
    if (left <= 0 && bn) { bn.hidden = false; $('#pOverT').textContent = fmtClock(fin); }
    if (left > 0 && bn) bn.hidden = true;
    if (fin <= 0 && !CAND.submitting) autoSubmit();
  } else if (left <= 0 && !CAND.submitting) autoSubmit();
}
function autoSubmit() {
  CAND.forced = true;
  modal('<div class="center"><div class="boot-ring dark"></div><h2 class="mt">หมดเวลา</h2><p class="muted" id="asMsg">ระบบกำลังส่งคำตอบของท่าน… กรุณาอย่าปิดหน้านี้</p></div>', { cls: 'sm', noClose: true });
  doSubmit();
}

/* ---------- บันทึกขึ้นเซิร์ฟเวอร์เป็นระยะ ---------- */
function scheduleSave(ms) { clearTimeout(CAND.saver); CAND.saver = setTimeout(function () { saveNow(); }, ms || (45000 + Math.random() * 20000)); }
function saveNow() {
  if (!CAND.sec || CAND.submitting) return;
  if (CAND.sec.type === 'PRACTICAL' || !CAND.dirty || CAND.saving) { if (CAND.sec.type === 'PRACTICAL') pollDue(); return scheduleSave(); }
  CAND.saving = true; CAND.dirty = false; saveStatus();
  api('saveProgress', { secId: CAND.sec.secId, answers: CAND.ans, blur: CAND.blur }, { quiet: true, tries: 2, timeout: 45000 }).then(function (r) {
    CAND.saving = false; CAND._pre = 0;
    if (r.done) { finishLocal(); return; }
    if (r.late) { if (!CAND.submitting) autoSubmit(); return; }
    CAND.savedAt = Date.now(); CAND.saveFail = 0; newDue(r.dueAt); saveStatus(); scheduleSave();
  }).catch(function () { CAND.saving = false; CAND.dirty = true; CAND.saveFail++; saveStatus(); scheduleSave(15000); });
}
function pollDue() { api('getCandState', {}, { keepSession: false }).then(function (s) { var x = s.sections.filter(function (q) { return CAND.sec && q.secId === CAND.sec.secId; })[0]; if (x) { if (x.status === 'DONE' && !CAND.submitting) { TG.state = s; finishLocal(); } else newDue(x.dueAt); } }).catch(function () { }); }
function newDue(d) { if (d && d > CAND.due + 30000) { var m = Math.round((d - CAND.due) / 60000); CAND.due = d; CAND.forced = false; toast('กรรมการเพิ่มเวลาให้ ' + m + ' นาที', 'ok', 7000); } }
function saveStatus() {
  var el = $('#rSave'); if (!el) return;
  if (CAND.saving) { el.textContent = 'กำลังบันทึก…'; el.className = 'rsave'; }
  else if (CAND.saveFail) { el.textContent = 'ยังบันทึกขึ้นระบบไม่ได้ (คำตอบเก็บในเครื่องนี้แล้ว ระบบจะลองใหม่)'; el.className = 'rsave bad'; }
  else if (CAND.savedAt) { el.textContent = 'บันทึกล่าสุด ' + new Date(CAND.savedAt).toLocaleTimeString('th-TH', { hour12: false }); el.className = 'rsave ok'; }
  else { el.textContent = 'คำตอบถูกเก็บในเครื่องนี้ทุกครั้งที่ตอบ'; el.className = 'rsave'; }
}

/* ---------- หน้าทำข้อสอบ (ทัศนคติ/ทฤษฎี) ---------- */
function answered(q) { return qDone(q, CAND.ans[q.id]); }
function countDone() { return CAND.qs.filter(answered).length; }
function renderRunner() {
  var s = CAND.sec, h = '', lastType = '';
  CAND.qs.forEach(function (q, i) {
    if (q.type !== lastType) { lastType = q.type; h += '<div class="qgroup"><b>' + (QT_SEC[q.type] || q.type) + '</b><span>' + ((QT[q.type] || {}).hint || '') + '</span></div>'; }
    h += '<article class="q q-' + q.type + '" id="q' + i + '" data-i="' + i + '"><header><span class="qn">ข้อ ' + (i + 1) + '</span>' + (q.points ? '<span class="qp">' + q.points + ' คะแนน</span>' : '') +
      '<button type="button" class="qflag" data-flag="' + i + '" title="ทำเครื่องหมายเพื่อกลับมาทบทวน">' + ICON.flag + '<span>ทบทวนภายหลัง</span></button></header>' + qText(q) + qBody(q, i, CAND.ans[q.id]) + '</article>';
  });
  $('#app').innerHTML = '<div class="runner"><div class="rbar"><div class="rb-l"><b>' + esc(s.title) + '</b><span id="rProg"></span></div><div class="rtimer">' + ICON.clock + '<span id="rTime">–</span></div>' +
    '<button class="btn gold" id="rSubmit">ส่งคำตอบ</button></div><div class="rprog"><i id="rBar"></i></div>' +
    '<div class="rgrid"><div class="qlist">' + (s.instructions ? '<div class="note info">' + esc(s.instructions) + '</div>' : '') + h + '<div class="rend"><button class="btn primary lg" id="rSubmit2">ตรวจทานและส่งคำตอบ</button></div></div>' +
    '<aside class="qnav"><h3>ข้อสอบทั้งหมด</h3><div class="qdots" id="qDots">' + CAND.qs.map(function (q, i) { return '<button type="button" data-jump="' + i + '">' + (i + 1) + '</button>'; }).join('') + '</div>' +
    '<div class="legend"><span><i class="lg-a"></i>ตอบแล้ว</span><span><i class="lg-f"></i>ทบทวน</span><span><i class="lg-n"></i>ยังไม่ตอบ</span></div><p class="rsave" id="rSave"></p></aside></div></div>';
  var list = $('.qlist');
  function setAns(i, v) { var q = CAND.qs[i]; if (v === undefined) return; CAND.ans[q.id] = v; CAND.dirty = true; }
  list.addEventListener('click', function (e) {
    var f = e.target.closest('.qflag'), art = e.target.closest('article.q');
    if (f) { var qq = CAND.qs[+f.dataset.flag]; if (CAND.marks[qq.id]) delete CAND.marks[qq.id]; else CAND.marks[qq.id] = 1; localSave(); paintQ(+f.dataset.flag); paintNav(); return; }
    if (!art || !e.target.closest('button')) return;
    var i = +art.dataset.i, v = qClick(CAND.qs[i], CAND.ans[CAND.qs[i].id], e.target);
    if (v !== undefined) { setAns(i, v); localSave(); paintQ(i); paintNav(); }
  });
  list.addEventListener('input', function (e) {
    var t = e.target, art = t.closest('article.q'); if (!art || t.tagName === 'SELECT') return;
    var i = +art.dataset.i, v = qInputVal(CAND.qs[i], CAND.ans[CAND.qs[i].id], t); if (v === undefined) return;
    setAns(i, v); if (t.classList.contains('essay')) ecount(i);
    clearTimeout(CAND._et); CAND._et = setTimeout(function () { localSave(); paintNav(); art.classList.toggle('answered', answered(CAND.qs[i])); }, 400);
  });
  list.addEventListener('change', function (e) {
    var t = e.target, art = t.closest('article.q'); if (!art || t.tagName !== 'SELECT') return;
    var i = +art.dataset.i; setAns(i, qInputVal(CAND.qs[i], CAND.ans[CAND.qs[i].id], t)); localSave(); paintQ(i); paintNav();
  });
  ['copy', 'cut', 'paste', 'contextmenu', 'dragstart', 'drop'].forEach(function (ev) { list.addEventListener(ev, function (e) { e.preventDefault(); if (ev === 'paste') toast('ไม่อนุญาตให้วางข้อความในตอนนี้ กรุณาพิมพ์คำตอบด้วยตนเอง', 'warn'); }); });
  $('#qDots').onclick = function (e) { var b = e.target.closest('[data-jump]'); if (b) { var el = $('#q' + b.dataset.jump); window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' }); } };
  $('#rSubmit').onclick = $('#rSubmit2').onclick = askSubmit;
  CAND.qs.forEach(function (q, i) { paintQ(i); if (q.type === 'ESSAY' || q.type === 'SHORT') ecount(i); });
  paintNav(); saveStatus();
}
function ecount(i) { var el = $('#ec' + i), q = CAND.qs[i], v = String(CAND.ans[q.id] || ''); if (el) el.textContent = v.length.toLocaleString() + ' / ' + (q.type === 'SHORT' ? '1,500' : '6,000') + ' ตัวอักษร'; }
function paintQ(i) {
  var q = CAND.qs[i], el = $('#q' + i); if (!el) return;
  qPaint(q, i, CAND.ans[q.id], el);
  el.classList.toggle('flagged', !!CAND.marks[q.id]); el.classList.toggle('answered', answered(q));
}
function paintNav() {
  if (!$('#rProg')) return;
  var n = countDone(), N = CAND.qs.length;
  $$('#qDots button').forEach(function (b, i) { var q = CAND.qs[i]; b.className = (answered(q) ? 'a' : '') + (CAND.marks[q.id] ? ' f' : ''); });
  $('#rProg').textContent = 'ตอบแล้ว ' + n + ' / ' + N + ' ข้อ'; $('#rBar').style.width = (N ? n / N * 100 : 0) + '%';
}
function askSubmit() {
  var miss = [], mark = [], part = []; CAND.qs.forEach(function (q, i) { if (!answered(q)) { miss.push(i + 1); if (qPartial(q, CAND.ans[q.id])) part.push(i + 1); } if (CAND.marks[q.id]) mark.push(i + 1); });
  var body = '<p>ตอบแล้ว <b>' + countDone() + ' / ' + CAND.qs.length + '</b> ข้อ · เวลาคงเหลือ <b>' + fmtClock(CAND.due - now()) + '</b></p>' +
    (miss.length ? '<div class="note warn">ยังตอบไม่ครบ ' + miss.length + ' ข้อ: ข้อ ' + miss.join(', ') + (part.length ? '<br><small>ข้อ ' + part.join(', ') + ' ตอบไว้บางส่วน (ยังไม่ครบทุกช่อง/ทุกข้อย่อย)</small>' : '') + '</div>' : '<div class="note ok">ตอบครบทุกข้อแล้ว</div>') +
    (mark.length ? '<div class="note info">ทำเครื่องหมายทบทวนไว้: ข้อ ' + mark.join(', ') + '</div>' : '') + '<p class="muted">เมื่อส่งแล้วจะกลับมาแก้ไขคำตอบของตอนนี้ไม่ได้</p>';
  confirmBox('ยืนยันส่งคำตอบ', body, 'ส่งคำตอบ').then(function (y) {
    if (!y) return;
    modal('<div class="center"><div class="boot-ring dark"></div><h2 class="mt">กำลังส่งคำตอบ</h2><p class="muted" id="asMsg">กรุณารอสักครู่ อย่าปิดหน้านี้</p></div>', { cls: 'sm', noClose: true });
    doSubmit();
  });
}
function doSubmit(n) {
  n = n || 1; CAND.submitting = true; clearTimeout(CAND.saver);
  if (CAND.saving && (CAND._sw = (CAND._sw || 0) + 1) < 40) return setTimeout(function () { doSubmit(n); }, 500);   // รอให้การบันทึกที่ค้างอยู่จบก่อน (ไม่เกิน 20 วินาที) กันเขียนทับกัน
  CAND._sw = 0;
  var s = CAND.sec, p = { secId: s.secId, blur: CAND.blur }; if (s.type !== 'PRACTICAL') p.answers = CAND.ans;
  api('submitSection', p, { quiet: true, tries: 4, timeout: 90000 }).then(function (st) { TG.state = st; finishLocal(true); })
    .catch(function (e) {
      var m = $('#asMsg'); if (m) m.innerHTML = 'ยังส่งไม่สำเร็จ (' + esc(e.message) + ')<br>ระบบกำลังลองใหม่ครั้งที่ ' + (n + 1) + ' — คำตอบของท่านยังอยู่ในเครื่องนี้ <b>อย่าปิดหน้านี้</b> และแจ้งกรรมการคุมสอบ';
      if (CAND.sec) setTimeout(function () { doSubmit(n + 1); }, Math.min(20000, 5000 + n * 3000));
    });
}
function finishLocal(sent) {
  var s = CAND.sec; if (s) store(draftKey(s.secId), null);
  candStop(); closeModal(); history.replaceState(null, '', '#/exam'); enterAnim();
  if (sent) toast('ส่งคำตอบเรียบร้อย', 'ok');
  if (!sent || !TG.state) api('getCandState').then(function (st) { TG.state = st; viewCandHome(); }).catch(function () { viewCandHome(); }); else viewCandHome();
  window.scrollTo(0, 0);
}

/* ---------- ภาคปฏิบัติ (ดาวน์โหลดโจทย์ → ทำใน Excel → อัปโหลด) ---------- */
function renderPractical() {
  var s = CAND.sec;
  $('#app').innerHTML = '<div class="runner"><div class="rbar"><div class="rb-l"><b>' + esc(s.title) + '</b><span>' + s.maxScore + ' คะแนน</span></div><div class="rtimer">' + ICON.clock + '<span id="rTime">–</span></div><button class="btn gold" id="pDone">ยืนยันส่งงาน</button></div>' +
    '<div class="wrap mid"><div class="banner bad" id="pOver" hidden>หมดเวลาทำข้อสอบแล้ว — อัปโหลดไฟล์ทันที ระบบจะปิดรับไฟล์ใน <b id="pOverT"></b></div>' +
    '<div class="note info">' + esc(s.instructions) + '</div>' +
    '<div class="pstep"><div class="pn">1</div><div class="pb"><h3>ดาวน์โหลดไฟล์โจทย์</h3><p class="muted">ไฟล์ Excel มีคำสั่งสอบอยู่ในชีตแรก เปิดด้วยโปรแกรม Microsoft Excel ในเครื่องนี้</p><button class="btn primary" id="pGet">' + ICON.down + 'ดาวน์โหลดไฟล์โจทย์</button></div></div>' +
    '<div class="pstep"><div class="pn">2</div><div class="pb"><h3>ทำงานในโปรแกรม Excel</h3><p class="muted">กด <b>Save (Ctrl+S)</b> เป็นระยะ และก่อนอัปโหลดให้บันทึกไฟล์เป็นนามสกุล <b>.xlsx</b> แล้ว<b>ปิดไฟล์ในโปรแกรม Excel</b> (หน้านี้ต้องเปิดค้างไว้ตลอด ห้ามปิดหรือรีเฟรช)</p></div></div>' +
    '<div class="pstep"><div class="pn">3</div><div class="pb"><h3>อัปโหลดไฟล์คำตอบ</h3><p class="muted">ส่งซ้ำได้จนกว่าจะหมดเวลา ระบบใช้ไฟล์ล่าสุดในการตรวจ</p>' +
    '<label class="drop" id="pDrop"><input type="file" id="pFile" accept=".xlsx" hidden>' + ICON.up + '<b>คลิกเพื่อเลือกไฟล์ .xlsx</b><span>หรือลากไฟล์มาวางที่นี่</span></label><div id="pStat"></div></div></div>' +
    '<div class="rend"><button class="btn primary lg" id="pDone2">ยืนยันส่งงานและจบการสอบ</button></div></div></div>';
  pStat();
  $('#pGet').onclick = function () {
    var b = this; busy(b, true, 'กำลังเตรียมไฟล์…');
    api('getTemplate', { secId: s.secId }, { tries: 4, timeout: 90000 }).then(function (r) { saveBlob(r.name, b64Blob(r.b64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')); busy(b, false); toast('ดาวน์โหลดไฟล์โจทย์แล้ว เปิดไฟล์จากโฟลเดอร์ Downloads', 'ok', 6000); })
      .catch(function (e) { busy(b, false); toast(e.message, 'bad'); });
  };
  var drop = $('#pDrop'), inp = $('#pFile');
  inp.onchange = function () { if (inp.files[0]) upload(inp.files[0]); inp.value = ''; };
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { var f = e.dataTransfer.files[0]; if (f) upload(f); });
  $('#pDone').onclick = $('#pDone2').onclick = function () {
    var has = !!CAND.sec.fileName, body = has ? '<p>ไฟล์ที่ส่งล่าสุด: <b>' + esc(CAND.sec.fileName) + '</b> (เวลา ' + tTime(CAND.sec.fileAt, true) + ' น.)</p><p class="muted">เมื่อยืนยันแล้วจะส่งไฟล์เพิ่มหรือแก้ไขไม่ได้</p>'
      : '<div class="note bad"><b>ท่านยังไม่ได้อัปโหลดไฟล์คำตอบ</b><br>หากยืนยันตอนนี้ ภาคปฏิบัติจะไม่มีงานให้ตรวจ (0 คะแนน)</div>';
    confirmBox('ยืนยันส่งงานภาคปฏิบัติ', body, has ? 'ยืนยันส่งงาน' : 'ยืนยันโดยไม่ส่งไฟล์', !has).then(function (y) {
      if (!y) return;
      modal('<div class="center"><div class="boot-ring dark"></div><h2 class="mt">กำลังส่งงาน</h2><p class="muted" id="asMsg">กรุณารอสักครู่ อย่าปิดหน้านี้</p></div>', { cls: 'sm', noClose: true });
      doSubmit();
    });
  };
}
function pStat(msg, kind) {
  var s = CAND.sec, el = $('#pStat'); if (!el || !s) return;
  if (msg) { el.innerHTML = '<div class="note ' + (kind || 'info') + '">' + msg + '</div>'; return; }
  el.innerHTML = s.fileName ? '<div class="filebox ' + (s.same ? 'bad' : 'ok') + '">' + ICON.file + '<div><b>' + esc(s.fileName) + '</b><small>ระบบได้รับไฟล์แล้วเมื่อ ' + tTime(s.fileAt, true) + ' น.' + (s.same ? ' — <b>ไฟล์นี้เหมือนไฟล์โจทย์ที่ยังไม่ได้ทำ</b> โปรดตรวจว่าเลือกไฟล์ที่บันทึกงานแล้ว' : ' — ส่งไฟล์ใหม่ทับได้หากแก้ไขงานเพิ่ม') + '</small></div></div>'
    : '<div class="filebox">' + ICON.file + '<div><b>ยังไม่ได้ส่งไฟล์</b><small>เมื่อส่งแล้วจะแสดงชื่อไฟล์และเวลาที่ระบบได้รับที่นี่</small></div></div>';
}
function upload(f) {
  if (!CAND.sec || CAND.uploading) return;
  if (!/\.xlsx$/i.test(f.name)) return pStat('ไฟล์ <b>' + esc(f.name) + '</b> ไม่ใช่ .xlsx — ในโปรแกรม Excel ให้กด File › Save As แล้วเลือกชนิด "Excel Workbook (*.xlsx)"', 'bad');
  if (f.size > 10 * 1024 * 1024) return pStat('ไฟล์ใหญ่เกิน 10 MB', 'bad');
  if (f.size < 2000) return pStat('ไฟล์นี้ว่างเปล่า กรุณาตรวจว่าบันทึกงานแล้ว', 'bad');
  CAND.uploading = true; pStat('<i class="spin dark"></i> กำลังส่งไฟล์ <b>' + esc(f.name) + '</b> … อย่าปิดหน้านี้');
  var sid = CAND.sec.secId;
  fileB64(f).then(function (b64) { return api('uploadFile', { secId: sid, name: f.name, b64: b64 }, { quiet: true, tries: 3, timeout: 180000 }); }).then(function (r) {
    CAND.uploading = false; if (!CAND.sec) return;
    CAND.sec.fileName = r.fileName; CAND.sec.fileAt = r.fileAt; CAND.sec.same = r.same; pStat();
    toast(r.same ? 'ไฟล์นี้เหมือนไฟล์โจทย์ต้นฉบับ โปรดตรวจสอบ' : 'ระบบได้รับไฟล์คำตอบแล้ว', r.same ? 'bad' : 'ok', 6000);
  }).catch(function (e) { CAND.uploading = false; pStat('ส่งไฟล์ไม่สำเร็จ: ' + esc(e.message) + ' — กรุณาลองอีกครั้ง', 'bad'); });
}
