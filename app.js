// =====================================================================
//  App: routing, rendering, ৩-ঘণ্টা প্ল্যান, quiz, flashcards, playground
// =====================================================================
const MIN = { 1: 8, 2: 5, 3: 8, 4: 8, 5: 12, 6: 9, 7: 4, 8: 7, 9: 9, 10: 14, 11: 5, 12: 7, 13: 11, 14: 6, 15: 4, 16: 7, 17: 5, 18: 5, 19: 5, 20: 11, 21: 4, 22: 9, 23: 5, 24: 5, 25: 7 }; // = 180 min
const BN = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const store = {
  get(k, d) { try { const v = localStorage.getItem('sqlbn_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('sqlbn_' + k, JSON.stringify(v)); } catch { } }
};
let done = new Set(store.get('done', []));
let quizScores = store.get('quiz', {});
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ─── SQL syntax highlighter (ছোট, dependency ছাড়া) ───
const KW = 'SELECT|FROM|WHERE|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|CROSS|APPLY|ON|AND|OR|NOT|IN|IS|NULL|AS|GROUP|BY|ORDER|HAVING|DISTINCT|TOP|LIMIT|OFFSET|FETCH|NEXT|ROWS|ROW|ONLY|UNION|ALL|INTERSECT|EXCEPT|INSERT|INTO|VALUES|UPDATE|SET|DELETE|TRUNCATE|MERGE|USING|WHEN|MATCHED|THEN|ELSE|END|CASE|CREATE|ALTER|DROP|TABLE|VIEW|INDEX|UNIQUE|CLUSTERED|NONCLUSTERED|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|CHECK|DEFAULT|IDENTITY|WITH|RECURSIVE|OVER|PARTITION|BETWEEN|PRECEDING|FOLLOWING|UNBOUNDED|CURRENT|RANGE|LIKE|ESCAPE|EXISTS|DESC|ASC|BEGIN|TRANSACTION|TRAN|COMMIT|ROLLBACK|SAVE|TRY|CATCH|THROW|DECLARE|PROCEDURE|FUNCTION|RETURNS|RETURN|EXEC|EXECUTE|IF|WHILE|BREAK|CURSOR|LOCAL|FAST_FORWARD|FOR|OPEN|CLOSE|DEALLOCATE|OUTPUT|INCLUDE|TRIGGER|AFTER|INSTEAD|OF|OPTION|GO|OR|REPLACE|READONLY|TYPE|ISOLATION|LEVEL|SNAPSHOT|SCHEMABINDING|PIVOT|CONFLICT|DO|RETURNING|WAITFOR|DELAY|NOCOUNT|XACT_ABORT|ADD|PERSISTED|WITHIN|PATH|JSON|TARGET|MAXRECURSION|RECOMPILE|AUTO|READ_WRITE|QUERY_STORE|DATABASE|STATISTICS|FULLSCAN|ON';
const FN = 'COUNT|SUM|AVG|MIN|MAX|COALESCE|ISNULL|NULLIF|CAST|CONVERT|ROW_NUMBER|RANK|DENSE_RANK|NTILE|LAG|LEAD|DATEADD|DATEDIFF|GETDATE|SYSUTCDATETIME|DATEFROMPARTS|YEAR|MONTH|EOMONTH|FORMAT|STRING_AGG|STRING_SPLIT|TRIM|JSON_VALUE|OPENJSON|ISJSON|UPPER|REPLICATE|QUOTENAME|IIF|XACT_STATE|ERROR_NUMBER|ERROR_MESSAGE|ERROR_PROCEDURE|ERROR_LINE|GROUPING|ROLLUP|CUBE|COUNT_BIG|ROUND|OBJECT_NAME|OBJECT_ID|DB_ID|SUSER_SNAME|ROWCOUNT_BIG|UPDATE|STUFF|GROUP_CONCAT|julianday|date|datetime|substr|strftime|json_extract';
const kwRe = new RegExp(`\\b(${KW})\\b`, 'gi'), fnRe = new RegExp(`\\b(${FN})(?=\\s*\\()`, 'gi');
function hl(code) {
  const tokens = [];
  let s = code.replace(/(--[^\n]*|\/\/[^\n]*)|('(?:[^']|'')*')|(N'(?:[^']|'')*')/g, (m, c, str, nstr) => { tokens.push(c ? `<span class="t-c">${esc(m)}</span>` : `<span class="t-s">${esc(m)}</span>`); return `\u0000${tokens.length - 1}\u0000`; });
  s = esc(s).replace(fnRe, '<span class="t-f">$1</span>').replace(kwRe, (m) => `<span class="t-k">${m}</span>`).replace(/(@@?\w+|#\w+)/g, '<span class="t-v">$1</span>').replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="t-n">$1</span>');
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => tokens[i]);
}

// ─── Sidebar ───
function sidebar() {
  const nav = $('#nav');
  nav.innerHTML = `<a href="#/" class="nav-home">🏠 হোম</a><a href="#/plan" class="nav-home">⏱ ৩-ঘণ্টার প্ল্যান</a><a href="#/play" class="nav-home">🧪 SQL Playground</a><a href="#/cards" class="nav-home">🃏 Flashcards</a><a href="#/cheat" class="nav-home">📋 Cheat Sheet</a>` +
    PARTS.map(p => `<div class="nav-part">${p.icon} ${p.bn} <small>${p.en}</small></div>` + CHAPTERS.filter(c => c.part === p.id).map(c => `<a href="#/ch/${c.id}" data-ch="${c.id}" class="${done.has(c.id) ? 'done' : ''}"><span class="num">${c.id}</span><span class="nt">${c.bn}</span><span class="mins">${BN(MIN[c.id])}m</span></a>`).join('')).join('');
  updateProgress();
}
function updateProgress() {
  const mins = [...done].reduce((s, id) => s + MIN[id], 0);
  const pct = Math.round(done.size / CHAPTERS.length * 100);
  $('#prog-fill').style.width = pct + '%';
  $('#prog-txt').textContent = `${BN(done.size)}/${BN(25)} অধ্যায় · ${BN(mins)}/${BN(180)} মিনিট`;
  $$('#nav a[data-ch]').forEach(a => a.classList.toggle('done', done.has(+a.dataset.ch)));
}

// ─── Chapter view ───
function renderChapter(id) {
  const c = CHAPTERS.find(x => x.id === id); if (!c) return home();
  const p = PARTS.find(x => x.id === c.part);
  const prev = CHAPTERS.find(x => x.id === id - 1), next = CHAPTERS.find(x => x.id === id + 1);
  const main = $('#main');
  main.innerHTML = `<div class="ch-head"><div class="crumb">${p.icon} Part ${p.id} · ${p.bn} · বই পৃষ্ঠা ${c.pages}</div>
    <h1><span class="ch-ic">${c.icon}</span> ${c.id}. ${c.bn}</h1><div class="en-title">${c.en}</div>
    <div class="ch-meta"><span class="pill">⏱ ${BN(MIN[c.id])} মিনিট</span><span class="pill">${BN(c.sections.length)} টপিক</span><span class="pill">${BN(c.quiz.length)} কুইজ</span></div>
    <div class="toc">${c.sections.map((s, i) => `<a href="#sec-${i}" data-sec="${i}">${s.t}</a>`).join('')}</div></div>
    ${c.sections.map((s, i) => section(s, i)).join('')}
    <section class="card quiz-wrap" id="quiz"><h2>🧩 কুইজ — নিজেকে যাচাই করো</h2><div class="quiz"></div></section>
    <section class="card"><h2>🃏 দ্রুত মনে রাখো</h2><div class="mini-cards"></div></section>
    <div class="ch-foot">${prev ? `<a class="btn" href="#/ch/${prev.id}">← ${prev.bn}</a>` : '<span></span>'}
    <button class="btn ${done.has(id) ? 'ok' : 'pri'}" id="markdone">${done.has(id) ? '✅ শেষ করেছি' : '☑️ অধ্যায় শেষ চিহ্নিত করো'}</button>
    ${next ? `<a class="btn" href="#/ch/${next.id}">${next.bn} →</a>` : '<a class="btn" href="#/cards">🃏 Flashcards →</a>'}</div>`;
  c.sections.forEach((s, i) => { if (s.viz && V[s.viz]) { try { V[s.viz]($(`#viz-${i}`)); } catch (e) { console.error(s.viz, e); } } });
  $$('.copy', main).forEach(b => b.onclick = () => { navigator.clipboard?.writeText(b.closest('.codebox').dataset.raw); b.textContent = '✓ কপি হয়েছে'; setTimeout(() => b.textContent = '📋 কপি', 1200); });
  $$('.runit', main).forEach(b => b.onclick = () => openPlayground(c.sections[+b.dataset.i].run));
  $$('.toc a', main).forEach(a => a.onclick = e => { e.preventDefault(); $('#sec-' + a.dataset.sec).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  quiz($('.quiz', main), c);
  flipCards($('.mini-cards', main), c.cards);
  $('#markdone').onclick = () => { done.has(id) ? done.delete(id) : done.add(id); store.set('done', [...done]); updateProgress(); renderChapter(id); };
  window.scrollTo(0, 0);
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.ch == id));
  timerHint();
}
function section(s, i) {
  return `<section class="card sec" id="sec-${i}"><h2>${s.t}</h2>
    <div class="bn">${s.bn}</div>${s.en ? `<div class="en">🇬🇧 ${s.en}</div>` : ''}
    ${s.mem ? `<div class="mem"><b>🧠 মনে রাখো</b><div>${s.mem}</div></div>` : ''}
    ${s.viz ? `<div class="viz" id="viz-${i}"></div>` : ''}
    ${s.code ? `<div class="codebox" data-raw="${esc(s.code).replace(/"/g, '&quot;')}"><div class="codebar"><span>SQL Server (T-SQL)</span><span><button class="btn xs copy">📋 কপি</button>${s.run ? `<button class="btn xs pri runit" data-i="${i}">▶ চালাও</button>` : ''}</span></div><pre class="code">${hl(s.code)}</pre></div>` : (s.run ? `<button class="btn sm pri runit" data-i="${i}">▶ Playground-এ চালাও</button>` : '')}
    ${s.trap ? `<div class="box trap"><b>⚠️ ফাঁদ (Trap)</b><div>${s.trap.bn}</div><div class="en">${s.trap.en}</div></div>` : ''}
    ${s.tip ? `<div class="box tip"><b>💡 টিপস</b><div>${s.tip.bn}</div><div class="en">${s.tip.en}</div></div>` : ''}
    ${s.iq ? `<details class="box iq"><summary><b>🎤 ইন্টারভিউ প্রশ্ন:</b> ${s.iq.q} <span class="muted">(উত্তর দেখতে ক্লিক)</span></summary><div>${s.iq.a}</div></details>` : ''}
  </section>`;
}
function quiz(el, c) {
  let ans = {};
  const draw = () => {
    el.innerHTML = c.quiz.map((q, i) => `<div class="q"><div class="qq">${BN(i + 1)}. ${q.q}</div><div class="opts">${q.o.map((o, j) => {
      const st = ans[i] === undefined ? '' : j === q.a ? 'right' : ans[i] === j ? 'wrong' : 'fade';
      return `<button class="opt ${st}" data-i="${i}" data-j="${j}" ${ans[i] !== undefined ? 'disabled' : ''}>${o}</button>`;
    }).join('')}</div>${ans[i] !== undefined ? `<div class="qe">${ans[i] === q.a ? '✅ সঠিক!' : '❌ ভুল।'} ${q.e}</div>` : ''}</div>`).join('') +
      (Object.keys(ans).length === c.quiz.length ? `<div class="score">স্কোর: <b>${BN(c.quiz.filter((q, i) => ans[i] === q.a).length)} / ${BN(c.quiz.length)}</b> <button class="btn sm retry">↺ আবার</button></div>` : '');
    $$('.opt', el).forEach(b => b.onclick = () => {
      ans[+b.dataset.i] = +b.dataset.j; draw();
      if (Object.keys(ans).length === c.quiz.length) { quizScores[c.id] = c.quiz.filter((q, i) => ans[i] === q.a).length; store.set('quiz', quizScores); }
    });
    const r = $('.retry', el); if (r) r.onclick = () => { ans = {}; draw(); };
  };
  draw();
}

// ─── Home ───
function home() {
  const nextCh = CHAPTERS.find(c => !done.has(c.id)) || CHAPTERS[0];
  $('#main').innerHTML = `<section class="hero"><div class="hero-tag">📘 SQL for Software Developers & Backend Engineers · ৮৫ পৃষ্ঠা → ২৫ অধ্যায়</div>
    <h1>SQL শেখো <span class="grad">সহজ বাংলায়</span>,<br>ইন্টারঅ্যাক্টিভভাবে — <span class="grad">৩ ঘণ্টায়</span></h1>
    <p>প্রতিটা টপিক: ছোট বাংলা ব্যাখ্যা + English লাইন + 🧠 মনে রাখার কৌশল + 🎮 ভিজুয়ালাইজেশন + ▶ ব্রাউজারেই আসল SQL চালাও + 🧩 কুইজ।</p>
    <div class="hero-btns"><a class="btn pri lg" href="#/plan">⏱ ৩-ঘণ্টার প্ল্যান শুরু করো</a><a class="btn lg" href="#/ch/${nextCh.id}">${done.size ? '▶ চালিয়ে যাও: ' + nextCh.bn : '📖 অধ্যায় ১ থেকে শুরু'}</a></div></section>
    <section class="card"><h2>🧠 সবচেয়ে গুরুত্বপূর্ণ একটা জিনিস</h2><div class="bn">SQL তুমি যে order-এ লেখো, ডাটাবেস সেভাবে চালায় না। এটা মুখস্থ করলে অর্ধেক নিয়ম নিজেই বোঝা যায়:</div>
      <div class="order-strip">${['FROM', 'WHERE', 'GROUP BY', 'HAVING', 'SELECT', 'DISTINCT', 'ORDER BY', 'LIMIT'].map((x, i) => `<span><b>${BN(i + 1)}</b>${x}</span>`).join('')}</div>
      <div class="mem"><b>🧠 Mnemonic</b><div><b>F</b>resh <b>W</b>ater <b>G</b>ives <b>H</b>ealthy <b>S</b>kin, <b>D</b>rink <b>O</b>nly <b>L</b>emon</div></div></section>
    <div class="parts">${PARTS.map(p => { const cs = CHAPTERS.filter(c => c.part === p.id); const m = cs.reduce((s, c) => s + MIN[c.id], 0); const d = cs.filter(c => done.has(c.id)).length;
      return `<section class="card part"><div class="part-h"><span class="part-ic">${p.icon}</span><div><h3>Part ${p.id}: ${p.bn}</h3><small>${p.en} · ${BN(m)} মিনিট · ${BN(d)}/${BN(cs.length)} শেষ</small></div></div>
      ${cs.map(c => `<a class="ch-link ${done.has(c.id) ? 'done' : ''}" href="#/ch/${c.id}"><span>${c.icon} ${c.id}. ${c.bn}</span><small>${c.en}</small></a>`).join('')}</section>`; }).join('')}</div>`;
  $$('#nav a').forEach(a => a.classList.remove('active'));
}

// ─── ৩-ঘণ্টার প্ল্যান ───
const SESSIONS = [
  { t: 'সেশন ১ · ভিত্তি + মূল SQL (১)', ch: [1, 2, 3, 4, 5], brk: 'ব্রেক ৫ মিনিট ☕' },
  { t: 'সেশন ২ · Aggregation → CTE', ch: [6, 7, 8, 9], brk: 'ব্রেক ৫ মিনিট 🚶' },
  { t: 'সেশন ৩ · Window → Data পরিবর্তন', ch: [10, 11, 12], brk: 'ব্রেক ৫ মিনিট 💧' },
  { t: 'সেশন ৪ · Transaction → Dynamic SQL', ch: [13, 14, 15, 16, 17], brk: 'ব্রেক ৫ মিনিট 🍎' },
  { t: 'সেশন ৫ · Error, String → Optimization', ch: [18, 19, 20, 21], brk: 'ব্রেক ৫ মিনিট 🧘' },
  { t: 'সেশন ৬ · Plan, Case study, Design, Interview', ch: [22, 23, 24, 25], brk: '🎉 শেষ!' },
];
function plan() {
  let cum = 0;
  const t = store.get('timer', null);
  $('#main').innerHTML = `<section class="hero sm"><h1>⏱ ৩ ঘণ্টায় পুরো বই</h1><p>২৫ অধ্যায় = <b>১৮০ মিনিট</b> পড়া + ভিজুয়াল + কুইজ। ৬টা সেশন, মাঝে ছোট ব্রেক (ঐচ্ছিক)। Timer চালু করলে উপরের বারে দেখাবে এখন কোন অধ্যায়ে থাকা উচিত।</p>
    <div class="hero-btns"><button class="btn pri lg" id="tstart">${t ? '⏸ Timer বন্ধ করো' : '▶ ৩-ঘণ্টার Timer শুরু করো'}</button><button class="btn lg" id="treset">↺ সব progress মুছো</button></div></section>
    <section class="card"><h2>⚡ কীভাবে ৩ ঘণ্টায় শেষ করবে</h2><div class="bn">① প্রতিটা টপিকের <b>বাংলা অংশ + 🧠 মনে রাখো</b> পড়ো (মূল কথা)।<br>② <b>ভিজুয়াল</b>-এ একবার ক্লিক/▶ করো — চোখে দেখলে মনে থাকে।<br>③ লম্বা code পুরো মুখস্থ কোরো না — <b>comment গুলো</b> পড়ো, ▶ চালিয়ে ফল দেখো।<br>④ শেষে <b>কুইজ</b> দাও, ভুলগুলো আবার পড়ো।<br>⑤ সব শেষে <a href="#/cards">🃏 Flashcards</a> আর <a href="#/cheat">📋 Cheat sheet</a> দিয়ে ১০ মিনিট রিভিশন।</div></section>
    ${SESSIONS.map(s => { const m = s.ch.reduce((a, c) => a + MIN[c], 0); return `<section class="card sess"><h3>${s.t} <span class="pill">${BN(m)} মিনিট</span></h3>
      ${s.ch.map(id => { const c = CHAPTERS.find(x => x.id === id); const from = cum; cum += MIN[id]; return `<a class="plan-row ${done.has(id) ? 'done' : ''}" href="#/ch/${id}"><span class="pt">${fmt(from)}–${fmt(cum)}</span><span>${c.icon} ${id}. ${c.bn}</span><span class="pm">${BN(MIN[id])}m ${done.has(id) ? '✅' : quizScores[id] !== undefined ? '🧩' + BN(quizScores[id]) : ''}</span></a>`; }).join('')}
      <div class="brk">${s.brk}</div></section>`; }).join('')}`;
  $('#tstart').onclick = () => { store.set('timer', t ? null : Date.now()); plan(); timerTick(); };
  $('#treset').onclick = () => { if (confirm('সব progress, quiz score আর timer মুছে ফেলবে?')) { done = new Set(); quizScores = {}; store.set('done', []); store.set('quiz', {}); store.set('timer', null); sidebar(); plan(); timerTick(); } };
}
const fmt = m => `${BN(Math.floor(m / 60))}:${BN(String(m % 60).padStart(2, '0'))}`;
function expectedChapter(elapsedMin) { let c = 0; for (const ch of CHAPTERS) { c += MIN[ch.id]; if (elapsedMin < c) return ch; } return null; }
function timerTick() {
  const t = store.get('timer', null), el = $('#timer');
  if (!t) { el.innerHTML = `<a href="#/plan">⏱ ৩-ঘণ্টার প্ল্যান</a>`; el.classList.remove('on'); return; }
  const el_ = Math.floor((Date.now() - t) / 60000), left = Math.max(0, 180 - el_);
  const exp = expectedChapter(el_);
  const doneMin = [...done].reduce((s, id) => s + MIN[id], 0);
  const ahead = doneMin - el_;
  el.classList.add('on');
  el.innerHTML = `⏱ ${fmt(Math.min(el_, 180))} / ৩:০০ · বাকি ${BN(left)}m · ${exp ? `এখন: <a href="#/ch/${exp.id}">অধ্যায় ${BN(exp.id)}</a>` : '🎉 সময় শেষ'} · <span class="${ahead >= 0 ? 'ok-t' : 'bad-t'}">${ahead >= 0 ? '▲ ' + BN(ahead) + 'm এগিয়ে' : '▼ ' + BN(-ahead) + 'm পিছিয়ে'}</span>`;
}
function timerHint() { timerTick(); }

// ─── Flashcards ───
function cards() {
  const all = CHAPTERS.flatMap(c => c.cards.map(k => [...k, c.id]));
  let order = all.map((_, i) => i), i = 0, flipped = false;
  const draw = () => {
    const [f, b, ch] = all[order[i]];
    $('#main').innerHTML = `<section class="hero sm"><h1>🃏 Flashcards</h1><p>${BN(all.length)}টা কার্ড — শেষ ১০ মিনিটের রিভিশনের জন্য। Space = উল্টাও, ← → = আগে/পরে।</p></section>
      <div class="bigcard ${flipped ? 'on' : ''}"><div class="flip-in"><div class="flip-f"><small>অধ্যায় ${BN(ch)}</small>${f}</div><div class="flip-b">${b}</div></div></div>
      <div class="cardnav"><button class="btn" id="cp">←</button><span>${BN(i + 1)} / ${BN(all.length)}</span><button class="btn" id="cs">🔀 এলোমেলো</button><button class="btn pri" id="cn">→</button></div>`;
    $('.bigcard').onclick = () => { flipped = !flipped; draw(); };
    $('#cp').onclick = () => { i = (i - 1 + all.length) % all.length; flipped = false; draw(); };
    $('#cn').onclick = () => { i = (i + 1) % all.length; flipped = false; draw(); };
    $('#cs').onclick = () => { order.sort(() => Math.random() - .5); i = 0; flipped = false; draw(); };
  };
  document.onkeydown = e => { if (location.hash !== '#/cards' || /INPUT|TEXTAREA/.test(e.target.tagName)) return; if (e.key === ' ') { e.preventDefault(); $('.bigcard')?.click(); } if (e.key === 'ArrowRight') $('#cn')?.click(); if (e.key === 'ArrowLeft') $('#cp')?.click(); };
  draw();
}

// ─── Cheat sheet ───
function cheat() {
  const rows = [
    ['Logical order', 'FROM → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT'], ['NULL', '= NULL কাজ করে না → IS NULL · NOT IN + NULL = ০ row → NOT EXISTS'],
    ['COUNT', 'COUNT(*) = row · COUNT(col) = non-NULL · AVG NULL বাদ দেয়'], ['Date range', ">= '2026-01-01' AND < '2026-02-01' (half-open)"],
    ['Money / time type', 'DECIMAL(19,4) · DATETIME2(3) · কখনো FLOAT না'], ['LEFT JOIN', 'ডান table-এর filter ON-এ, WHERE-এ না'],
    ['Fan-out', '২টা one-to-many child join = গুণ → আগে aggregate'], ['WHERE vs HAVING', 'Row আগে ছাঁটো (WHERE) · group পরে (HAVING)'],
    ['Conditional agg', 'SUM(CASE WHEN … THEN x ELSE 0 END)'], ['Subtotal', 'GROUP BY ROLLUP(...) · GROUPING(col)=1 → subtotal row'],
    ['UNION', 'Default UNION ALL (dedup নেই, সস্তা)'], ['Table diff', '(A EXCEPT B) UNION ALL (B EXCEPT A) → ০ row = একই'],
    ['Recursive CTE', 'Anchor + UNION ALL + নিজেকে JOIN · MAXRECURSION'], ['Ranking', 'ROW_NUMBER 1234 · RANK 1224 · DENSE_RANK 1223'],
    ['Top-N/group', 'CTE + ROW_NUMBER() … WHERE rn <= N · বা CROSS APPLY TOP N'], ['Running total', 'SUM() OVER (PARTITION … ORDER … ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)'],
    ['Gaps & islands', 'date − ROW_NUMBER() = island key'], ['CTE vs #temp', 'CTE = পরিষ্কার · #temp = reuse + statistics · @var = ১ row estimate'],
    ['Big delete', 'WHILE … DELETE TOP (5000) … IF @@ROWCOUNT = 0 BREAK'], ['Upsert', 'SQL Server MERGE + HOLDLOCK · Postgres ON CONFLICT DO UPDATE'],
    ['Transfer', 'XACT_ABORT ON · UPDLOCK · ছোট ID আগে lock · TRY/CATCH · THROW;'], ['Deadlock', 'Error 1205 · lock order · ছোট transaction · index · retry'],
    ['NOLOCK', 'ব্যবহার কোরো না → READ_COMMITTED_SNAPSHOT'], ['Procedure', 'SET NOCOUNT ON; SET XACT_ABORT ON; প্রথম লাইন'],
    ['Function', 'BEGIN কখনো না → inline TVF (RETURNS TABLE AS RETURN SELECT)'], ['Trigger', 'Statement প্রতি একবার · inserted/deleted = table'],
    ['Cursor', 'প্রায় কখনো না · লাগলে LOCAL FAST_FORWARD · batch loop ঠিক আছে'], ['Injection', 'sp_executesql + parameter · identifier: whitelist → QUOTENAME'],
    ['Nested tran', 'BEGIN;BEGIN;COMMIT → @@TRANCOUNT 1, কিছুই commit হয়নি · SAVE TRANSACTION'], ['DATEDIFF(YEAR)', 'Boundary গোনে, elapsed না'],
    ['Index (A,B)', 'A ও A+B-তে seek · শুধু B → scan · Equality → Range → ORDER BY'], ['Key lookup', 'INCLUDE (covering index) দিয়ে দূর করো'],
    ['Clustering key', 'Narrow · Unique · Static · Ever-increasing (random GUID না)'], ['SARGable', 'Column operator-এর এক পাশে একা — function/অঙ্ক/convert না'],
    ['Plan পড়া', 'ডান → বাম · est vs actual আগে · cost % উপেক্ষা'], ['Param sniffing', 'RECOMPILE · OPTIMIZE FOR · Query Store force plan'],
    ['Tuning', 'মাপো → plan → est/actual → বড় ৩ → একটা বদল → EXCEPT যাচাই → লিখে রাখো'], ['3NF', 'The key, the whole key, nothing but the key'],
  ];
  $('#main').innerHTML = `<section class="hero sm"><h1>📋 এক পাতায় পুরো বই</h1><p>পরীক্ষা/ইন্টারভিউয়ের আগে ৫ মিনিটে চোখ বুলাও। <button class="btn sm" onclick="window.print()">🖨 প্রিন্ট</button></p></section><section class="card">${tbl(['টপিক', 'মনে রাখো'], rows.map(r => [`<b>${r[0]}</b>`, esc(r[1])]), 'cheat')}</section>`;
}

// ─── Playground (sql.js / SQLite in browser) ───
const SEED = `
CREATE TABLE Branches (BranchId INTEGER PRIMARY KEY, BranchCode TEXT UNIQUE NOT NULL, BranchName TEXT NOT NULL, City TEXT NOT NULL, OpenedOn TEXT NOT NULL);
CREATE TABLE Employees (EmployeeId INTEGER PRIMARY KEY, BranchId INT NOT NULL REFERENCES Branches, ManagerId INT REFERENCES Employees, FullName TEXT NOT NULL, Designation TEXT NOT NULL, Salary REAL NOT NULL CHECK (Salary > 0), HiredOn TEXT NOT NULL);
CREATE TABLE Customers (CustomerId INTEGER PRIMARY KEY, NationalId TEXT UNIQUE NOT NULL, FullName TEXT NOT NULL, Email TEXT, Phone TEXT, City TEXT, KycStatus TEXT NOT NULL DEFAULT 'PENDING' CHECK (KycStatus IN ('PENDING','VERIFIED','REJECTED')), CreatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE Accounts (AccountId INTEGER PRIMARY KEY, AccountNumber TEXT UNIQUE NOT NULL, CustomerId INT NOT NULL REFERENCES Customers, BranchId INT NOT NULL REFERENCES Branches, AccountType TEXT NOT NULL CHECK (AccountType IN ('SAVINGS','CURRENT','FD')), Balance REAL NOT NULL DEFAULT 0, Currency TEXT NOT NULL DEFAULT 'BDT', Status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (Status IN ('ACTIVE','DORMANT','CLOSED')), OpenedOn TEXT NOT NULL, ClosedOn TEXT);
CREATE TABLE Transactions (TxnId INTEGER PRIMARY KEY, AccountId INT NOT NULL REFERENCES Accounts, TxnDate TEXT NOT NULL, TxnType TEXT NOT NULL CHECK (TxnType IN ('DEBIT','CREDIT')), Channel TEXT NOT NULL, Amount REAL NOT NULL CHECK (Amount > 0), BalanceAfter REAL NOT NULL, Reference TEXT);
CREATE TABLE Loans (LoanId INTEGER PRIMARY KEY, CustomerId INT NOT NULL REFERENCES Customers, BranchId INT NOT NULL REFERENCES Branches, Principal REAL NOT NULL, InterestRate REAL NOT NULL, TermMonths INT NOT NULL, DisbursedOn TEXT NOT NULL, Status TEXT NOT NULL);
INSERT INTO Branches VALUES (1,'DHK01','Gulshan Corporate','Dhaka','2005-03-01'),(2,'DHK02','Motijheel Main','Dhaka','1998-07-15'),(3,'CTG01','Agrabad','Chattogram','2001-01-10'),(4,'SYL01','Zindabazar','Sylhet','2026-02-01');
INSERT INTO Employees VALUES (1,1,NULL,'Ayesha Siddiqua','CEO',450000,'2005-03-01'),(2,1,1,'Bashir Ahmed','CTO',320000,'2010-06-01'),(3,2,1,'Farhana Islam','CFO',310000,'2011-01-15'),(4,1,2,'Imran Hossain','Dev Lead',180000,'2015-04-01'),(5,1,4,'Jannat Ara','Developer',95000,'2020-08-01'),(6,2,3,'Kamal Uddin','Accountant',70000,'2018-02-01'),(7,3,4,'Liza Rahman','Developer',90000,'2021-09-01');
INSERT INTO Customers (CustomerId,NationalId,FullName,Email,Phone,City,KycStatus,CreatedAt) VALUES
 (1,'1990123456','Rahim Uddin','rahim@example.com','01711000001','Dhaka','VERIFIED','2019-01-10'),
 (2,'1985987654','Karim Hossain','karim@example.com',NULL,'Dhaka','VERIFIED','2019-05-02'),
 (3,'1999111222','Nusrat Jahan',NULL,'01811000003','Chattogram','PENDING','2025-11-20'),
 (4,'1992333444','Tanvir Ahmed',NULL,NULL,'Sylhet','VERIFIED','2021-03-03'),
 (5,'1988555666','Sadia Akter','sadia@example.com','01911000005','Dhaka','VERIFIED','2020-07-07'),
 (6,'1995777888','Rahat Khan','rahat@example.com',NULL,'Chattogram','REJECTED','2024-02-14');
INSERT INTO Accounts VALUES
 (1,'1001000000001',1,1,'SAVINGS',85000,'BDT','ACTIVE','2020-02-01',NULL),
 (2,'1001000000002',1,1,'CURRENT',250000,'BDT','ACTIVE','2021-06-11',NULL),
 (3,'1001000000003',2,2,'SAVINGS',4300.5,'BDT','ACTIVE','2019-11-23',NULL),
 (4,'1001000000004',2,2,'FD',500000,'BDT','DORMANT','2018-01-05',NULL),
 (5,'1001000000005',4,4,'SAVINGS',120000,'BDT','ACTIVE','2026-02-02',NULL),
 (6,'1001000000006',5,1,'CURRENT',1250000,'BDT','ACTIVE','2020-07-07',NULL),
 (7,'1001000000007',5,3,'SAVINGS',250000,'BDT','ACTIVE','2022-01-01',NULL),
 (8,'1001000000008',6,3,'SAVINGS',0,'BDT','CLOSED','2024-02-14','2025-06-30');
INSERT INTO Transactions (AccountId,TxnDate,TxnType,Channel,Amount,BalanceAfter,Reference) VALUES
 (1,'2026-01-01 09:15:00','CREDIT','BRANCH',20000,80000,'Salary'),
 (1,'2026-01-02 10:00:00','DEBIT','ATM',5000,75000,NULL),
 (1,'2026-01-03 11:30:00','DEBIT','POS',1500,73500,'Shwapno'),
 (1,'2026-01-04 18:20:00','CREDIT','ONLINE',3000,76500,'bKash in'),
 (1,'2026-01-05 08:05:00','DEBIT','ONLINE',2000,74500,'Daraz'),
 (1,'2026-01-09 12:00:00','DEBIT','ATM',3000,71500,NULL),
 (1,'2026-01-31 10:30:00','CREDIT','BRANCH',20000,91500,'Salary'),
 (1,'2026-02-15 14:00:00','DEBIT','POS',6500,85000,'Aarong'),
 (2,'2026-01-03 09:00:00','CREDIT','ONLINE',100000,300000,'Invoice 50% advance'),
 (2,'2026-01-31 23:59:59','DEBIT','ONLINE',50000,250000,'Vendor'),
 (2,'2026-02-10 15:00:00','DEBIT','BRANCH',25000,225000,NULL),
 (2,'2026-03-05 10:00:00','CREDIT','ONLINE',25000,250000,NULL),
 (3,'2026-01-20 10:00:00','DEBIT','ATM',500,5800.5,NULL),
 (3,'2026-01-20 11:00:00','DEBIT','ATM',500,5300.5,NULL),
 (3,'2026-01-20 12:30:00','DEBIT','POS',300,5000.5,NULL),
 (3,'2026-01-20 14:00:00','DEBIT','ATM',200,4800.5,NULL),
 (3,'2026-01-20 16:45:00','DEBIT','ONLINE',500,4300.5,NULL),
 (5,'2026-02-02 10:00:00','CREDIT','BRANCH',120000,120000,'Opening deposit'),
 (6,'2026-01-10 10:00:00','CREDIT','ONLINE',300000,1300000,NULL),
 (6,'2026-02-11 10:00:00','DEBIT','ONLINE',50000,1250000,NULL),
 (6,'2026-03-12 10:00:00','CREDIT','ONLINE',80000,1330000,NULL),
 (6,'2026-03-20 10:00:00','DEBIT','POS',80000,1250000,NULL),
 (7,'2026-01-15 10:00:00','CREDIT','BRANCH',250000,250000,NULL),
 (7,'2026-03-15 10:00:00','DEBIT','ATM',10000,240000,NULL),
 (7,'2026-03-16 10:00:00','CREDIT','ATM',10000,250000,NULL);
INSERT INTO Loans VALUES (1,1,1,500000,9.5,36,'2024-01-01','ACTIVE'),(2,1,1,200000,10,24,'2025-01-01','ACTIVE'),(3,1,2,100000,11,12,'2023-06-01','CLOSED'),(4,4,4,300000,9,48,'2026-02-15','ACTIVE'),(5,6,3,150000,12,24,'2024-03-01','DEFAULTED');`;
let SQL = null, db = null, sqlLoading = null;
function loadSql() {
  if (sqlLoading) return sqlLoading;
  sqlLoading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js';
    s.onload = () => initSqlJs({ locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}` }).then(S => { SQL = S; resetDb(); res(); }, rej);
    s.onerror = rej; document.head.appendChild(s);
  });
  return sqlLoading;
}
function resetDb() { db = new SQL.Database(); db.run(SEED); }
function runSql(q, out) {
  try {
    const res = db.exec(q);
    if (!res.length) { out.innerHTML = `<div class="ok-s">✅ চলেছে (কোনো row ফেরত আসেনি) · পরিবর্তিত: ${db.getRowsModified()}</div>`; return; }
    out.innerHTML = res.map(r => `<div class="muted">${r.values.length} row</div>` + tbl(r.columns.map(esc), r.values.map(v => v.map(x => x === null ? null : esc(x))))).join('');
  } catch (e) { out.innerHTML = `<div class="callout bad">❌ ${esc(e.message)}</div>`; }
}
function playgroundUI(target, initial) {
  target.innerHTML = `<div class="pg-wrap"><div class="pg-bar"><span>🧪 SQLite (ব্রাউজারে) · BankDB</span><span><button class="btn xs" data-t="Accounts">Accounts</button><button class="btn xs" data-t="Customers">Customers</button><button class="btn xs" data-t="Transactions">Transactions</button><button class="btn xs" data-t="Employees">Employees</button><button class="btn xs" data-t="Loans">Loans</button><button class="btn xs" data-t="Branches">Branches</button><button class="btn xs" id="pgreset">↺ DB reset</button></span></div>
  <textarea class="pg-in" spellcheck="false"></textarea><div class="pg-ctl"><button class="btn pri" id="pgrun">▶ চালাও (Ctrl+Enter)</button><span class="muted">SQLite dialect: LIMIT, ||, date(), WITH RECURSIVE। T-SQL-এর TOP/DATEADD এখানে চলবে না।</span></div><div class="pg-out"><div class="muted">লোড হচ্ছে…</div></div></div>`;
  const ta = $('.pg-in', target), out = $('.pg-out', target);
  ta.value = initial || 'SELECT c.FullName, a.AccountNumber, a.AccountType, a.Balance\nFROM Customers c\nJOIN Accounts a ON a.CustomerId = c.CustomerId\nORDER BY a.Balance DESC;';
  const go = () => runSql(ta.value, out);
  loadSql().then(() => { out.innerHTML = '<div class="muted">প্রস্তুত ✅ — ▶ চাপো</div>'; if (initial) go(); }, () => out.innerHTML = '<div class="callout bad">SQL engine লোড হয়নি (ইন্টারনেট দরকার)। Code কপি করে নিজের DB-তে চালাও।</div>');
  $('#pgrun', target).onclick = () => db && go();
  ta.onkeydown = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); db && go(); } };
  $$('[data-t]', target).forEach(b => b.onclick = () => { ta.value = `SELECT * FROM ${b.dataset.t};`; db && go(); });
  $('#pgreset', target).onclick = () => { if (SQL) { resetDb(); out.innerHTML = '<div class="ok-s">DB আবার আগের মতো ✅</div>'; } };
}
function openPlayground(q) {
  const d = $('#drawer'); d.classList.add('open'); playgroundUI($('.drawer-body', d), q);
}
function playPage() {
  $('#main').innerHTML = `<section class="hero sm"><h1>🧪 SQL Playground</h1><p>আসল SQL engine (SQLite) তোমার ব্রাউজারে চলছে — BankDB-এর ছোট কপি সহ। যা খুশি লেখো, ভাঙো, reset করো!</p></section><section class="card"><div id="pgfull"></div></section>
  <section class="card"><h2>💡 চেষ্টা করো</h2><div class="tries">${[
    ['NOT IN trap', "SELECT BranchName FROM Branches WHERE BranchId NOT IN (SELECT ManagerId FROM Employees);"],
    ['Org chart', "WITH RECURSIVE o AS (SELECT EmployeeId, FullName, 0 d FROM Employees WHERE ManagerId IS NULL UNION ALL SELECT e.EmployeeId, e.FullName, o.d+1 FROM Employees e JOIN o ON e.ManagerId=o.EmployeeId) SELECT * FROM o;"],
    ['Ranking', "SELECT AccountNumber, Balance, RANK() OVER (ORDER BY Balance DESC) rnk, DENSE_RANK() OVER (ORDER BY Balance DESC) drnk FROM Accounts;"],
    ['Fan-out bug', "SELECT c.FullName, COUNT(*) rows_after_join FROM Customers c JOIN Accounts a ON a.CustomerId=c.CustomerId JOIN Loans l ON l.CustomerId=c.CustomerId GROUP BY c.FullName;"],
    ['Running balance', "SELECT AccountId, TxnDate, Amount, SUM(CASE WHEN TxnType='CREDIT' THEN Amount ELSE -Amount END) OVER (PARTITION BY AccountId ORDER BY TxnDate, TxnId ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS Running FROM Transactions;"],
    ['Query plan', "EXPLAIN QUERY PLAN SELECT * FROM Accounts WHERE AccountNumber = '1001000000001';"],
  ].map(([n, q]) => `<button class="btn sm" data-q="${esc(q).replace(/"/g, '&quot;')}">${n}</button>`).join('')}</div></section>`;
  playgroundUI($('#pgfull'));
  $$('.tries [data-q]').forEach(b => b.onclick = () => { $('#pgfull .pg-in').value = b.dataset.q; $('#pgfull #pgrun').click(); });
}

// ─── Search ───
function search(q) {
  const box = $('#search-res'); q = q.trim().toLowerCase();
  if (q.length < 2) { box.hidden = true; return; }
  const hits = [];
  CHAPTERS.forEach(c => c.sections.forEach((s, i) => { const txt = (s.t + ' ' + s.bn + ' ' + (s.en || '') + ' ' + (s.code || '')).toLowerCase(); if (txt.includes(q)) hits.push([c, s, i]); }));
  box.hidden = false;
  box.innerHTML = hits.slice(0, 12).map(([c, s, i]) => `<a href="#/ch/${c.id}/${i}">${c.icon} <b>${c.id}.</b> ${s.t}</a>`).join('') || '<div class="muted">কিছু পাওয়া যায়নি</div>';
}

// ─── Router ───
function route() {
  const h = location.hash.slice(1) || '/';
  $('#drawer').classList.remove('open');
  document.body.classList.remove('nav-open');
  $('#search-res').hidden = true;
  const m = h.match(/^\/ch\/(\d+)(?:\/(\d+))?/);
  if (m) { renderChapter(+m[1]); if (m[2]) setTimeout(() => $('#sec-' + m[2])?.scrollIntoView({ block: 'start' }), 50); }
  else if (h === '/plan') plan(); else if (h === '/cards') cards(); else if (h === '/cheat') cheat(); else if (h === '/play') playPage(); else home();
  if (!m) window.scrollTo(0, 0);
  timerTick();
}

// ─── Init ───
function setLang(l) { document.body.dataset.lang = l; store.set('lang', l); $$('#lang button').forEach(b => b.classList.toggle('on', b.dataset.l === l)); }
function setTheme(t) { document.documentElement.dataset.theme = t; store.set('theme', t); $('#theme').textContent = t === 'dark' ? '☀️' : '🌙'; }
document.addEventListener('DOMContentLoaded', () => {
  CHAPTERS.forEach(c => c.quiz.forEach(q => { q.q = q.q.replace('৬e', '৬k'); }));
  sidebar();
  setLang(store.get('lang', 'both'));
  const sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(store.get('theme', sysDark ? 'dark' : 'light'));
  $$('#lang button').forEach(b => b.onclick = () => setLang(b.dataset.l));
  $('#theme').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  $('#burger').onclick = () => document.body.classList.toggle('nav-open');
  $('#scrim').onclick = () => document.body.classList.remove('nav-open');
  $('#q').oninput = e => search(e.target.value);
  $('#drawer .x').onclick = () => $('#drawer').classList.remove('open');
  window.addEventListener('hashchange', route);
  route();
  setInterval(timerTick, 30000);
});
