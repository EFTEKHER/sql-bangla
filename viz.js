// =====================================================================
//  Interactive visualizations — প্রতিটা fn(container) রেন্ডার করে
// =====================================================================
const V = {};
const $h = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function tbl(head, rows, cls = '') {
  return `<table class="tbl ${cls}"><thead><tr>${head.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr class="${r._c || ''}">${(r.cells || r).map(x => `<td>${x === null ? '<i class="nul">NULL</i>' : x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function flipCards(el, cards, cls = '') {
  el.innerHTML = `<div class="flipgrid ${cls}">${cards.map(([f, b]) => `<div class="flip" tabindex="0"><div class="flip-in"><div class="flip-f">${f}<span class="flip-hint">ক্লিক করো ↻</span></div><div class="flip-b">${b}</div></div></div>`).join('')}</div>`;
  el.querySelectorAll('.flip').forEach(c => { const t = () => c.classList.toggle('on'); c.onclick = t; c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } }; });
}
function stepper(el, n, render, opts = {}) {
  let i = opts.start ?? 0, timer = null;
  el.innerHTML = `<div class="stepper-ctl"><button class="btn sm" data-a="prev">◀</button><button class="btn sm pri" data-a="play">▶ চালাও</button><button class="btn sm" data-a="next">▶|</button><span class="step-lbl"></span></div><div class="stepper-body"></div>`;
  const body = el.querySelector('.stepper-body'), lbl = el.querySelector('.step-lbl'), play = el.querySelector('[data-a=play]');
  const draw = () => { body.innerHTML = render(i); lbl.textContent = `ধাপ ${i + 1} / ${n}`; opts.after && opts.after(body, i); };
  const stop = () => { clearInterval(timer); timer = null; play.textContent = '▶ চালাও'; };
  el.querySelector('[data-a=prev]').onclick = () => { stop(); i = Math.max(0, i - 1); draw(); };
  el.querySelector('[data-a=next]').onclick = () => { stop(); i = Math.min(n - 1, i + 1); draw(); };
  play.onclick = () => {
    if (timer) return stop();
    if (i >= n - 1) i = -1;
    play.textContent = '⏸ থামাও';
    timer = setInterval(() => { i++; draw(); if (i >= n - 1) stop(); }, opts.speed || 1300);
    i++; draw(); if (i >= n - 1) stop();
  };
  draw();
}
const tabs = (el, names, render, start = 0) => {
  el.innerHTML = `<div class="seg">${names.map((n, k) => `<button class="${k === start ? 'on' : ''}" data-k="${k}">${n}</button>`).join('')}</div><div class="tabbody"></div>`;
  const body = el.querySelector('.tabbody');
  el.querySelectorAll('.seg button').forEach(b => b.onclick = () => { el.querySelectorAll('.seg button').forEach(x => x.classList.remove('on')); b.classList.add('on'); body.innerHTML = render(+b.dataset.k); render.after && render.after(body, +b.dataset.k); });
  body.innerHTML = render(start); render.after && render.after(body, start);
};

// ─── Ch1 ──────────────────────────────────────────────
V.logicalOrder = (el) => {
  const S = [
    ['FROM / JOIN', 'সব table জোড়া লাগে → বড় combined row set', '1,000 rows', 'from'],
    ['WHERE', 'শর্তে না মেলা row বাদ (aggregate এখনো নেই)', '120 rows', 'where'],
    ['GROUP BY', 'Row গুলো group-এ গুটিয়ে যায়', '8 groups', 'group'],
    ['HAVING', 'শর্তে না মেলা group বাদ', '3 groups', 'having'],
    ['SELECT', 'Expression ও alias (TxnCount) এখন জন্মায়', '3 rows', 'select'],
    ['DISTINCT', 'Duplicate মুছে যায়', '3 rows', 'distinct'],
    ['ORDER BY', 'Order বসে — alias এখানে চলে ✅', '3 rows sorted', 'order'],
    ['LIMIT / TOP / OFFSET', 'Row সংখ্যা কাটা হয়', 'final', 'limit'],
  ];
  stepper(el, S.length, i => `<div class="pipeline">${S.map((s, k) => `<div class="pipe ${k < i ? 'done' : ''} ${k === i ? 'cur' : ''}"><b>${k + 1}</b><span>${s[0]}</span></div>`).join('<i class="arr">→</i>')}</div>
    <div class="callout big"><div class="muted">ধাপ ${i + 1}: <b>${S[i][0]}</b></div><div>${S[i][1]}</div><div class="pill">${S[i][2]}</div>
    ${i < 4 ? '<div class="warn-s">⚠️ এই ধাপে SELECT alias এখনো <b>নেই</b></div>' : '<div class="ok-s">✅ Alias এখন ব্যবহারযোগ্য</div>'}</div>`, { speed: 1500 });
};
V.roundTrip = (el) => {
  el.innerHTML = `<div class="row2"><label>Row সংখ্যা: <input type="range" min="10" max="5000" step="10" value="1000" class="rt"> <b class="rtv">1000</b></label><label>Round trip: <select class="rtl"><option value="0.5">0.5 ms</option><option value="1" selected>1 ms</option><option value="2">2 ms</option></select></label></div><div class="bars"></div>`;
  const draw = () => {
    const n = +el.querySelector('.rt').value, l = +el.querySelector('.rtl').value; el.querySelector('.rtv').textContent = n;
    const a = n * l, b = l, mx = a;
    el.querySelector('.bars').innerHTML = `<div class="barrow"><span>${n} আলাদা INSERT</span><div class="bar bad" style="width:100%"></div><b>${a >= 1000 ? (a / 1000).toFixed(2) + ' s' : a + ' ms'}</b></div>
    <div class="barrow"><span>১টা multi-row INSERT</span><div class="bar good" style="width:${Math.max(0.6, b / mx * 100)}%"></div><b>${b} ms</b></div><p class="muted">শুধু network latency — DB কোনো কাজ শুরু করার আগেই!</p>`;
  };
  el.querySelectorAll('input,select').forEach(x => x.oninput = draw); draw();
};
V.acid = (el) => flipCards(el, [
  ['🅰 Atomicity', 'সব নয়তো কিছুই না। Debit হলো কিন্তু credit হলো না — crash-এর পর এমন থাকতে পারবে না।'],
  ['🅲 Consistency', 'এক valid অবস্থা → আরেক valid অবস্থা। Constraint কখনো ভাঙা থাকবে না।'],
  ['🅸 Isolation', 'একে অপরের অর্ধেক কাজ দেখে না। কতটা দেখবে না — tune করা যায় (Ch 13)।'],
  ['🅳 Durability', 'Commit = বিদ্যুৎ গেলেও থাকবে। তাই commit-এর আগে write-ahead log disk-এ লেখা হয়।'],
], 'four');

// ─── Ch2 ──────────────────────────────────────────────
const SCHEMA = {
  Branches: ['BranchId PK', 'BranchCode UQ', 'BranchName', 'City', 'OpenedOn'],
  Employees: ['EmployeeId PK', 'BranchId FK→Branches', 'ManagerId FK→Employees', 'FullName', 'Designation', 'Salary', 'HiredOn'],
  Customers: ['CustomerId PK', 'NationalId UQ', 'FullName', 'Email NULL', 'Phone NULL', 'City', 'KycStatus', 'CreatedAt'],
  Accounts: ['AccountId PK', 'AccountNumber UQ', 'CustomerId FK→Customers', 'BranchId FK→Branches', 'AccountType', 'Balance', 'Currency', 'Status', 'OpenedOn', 'ClosedOn NULL'],
  Transactions: ['TxnId PK', 'AccountId FK→Accounts', 'TxnDate', 'TxnType', 'Channel', 'Amount', 'BalanceAfter', 'Reference'],
  Loans: ['LoanId PK', 'CustomerId FK→Customers', 'BranchId FK→Branches', 'Principal', 'InterestRate', 'TermMonths', 'DisbursedOn', 'Status'],
};
V.schema = (el) => {
  const pos = { Branches: [10, 10], Employees: [10, 52], Customers: [70, 10], Accounts: [40, 30], Transactions: [40, 72], Loans: [70, 52] };
  el.innerHTML = `<div class="schema">${Object.keys(SCHEMA).map(t => `<button class="ent" data-t="${t}" style="left:${pos[t][0]}%;top:${pos[t][1]}%">${t}</button>`).join('')}
  <svg class="schema-svg" viewBox="0 0 100 100" preserveAspectRatio="none"></svg></div><div class="schema-detail muted">একটা table-এ ক্লিক করো 👆</div>`;
  const rel = [['Employees', 'Branches'], ['Employees', 'Employees'], ['Accounts', 'Customers'], ['Accounts', 'Branches'], ['Transactions', 'Accounts'], ['Loans', 'Customers'], ['Loans', 'Branches']];
  const svg = el.querySelector('svg');
  const c = t => [pos[t][0] + 9, pos[t][1] + 4];
  svg.innerHTML = rel.filter(r => r[0] !== r[1]).map(([a, b]) => { const [x1, y1] = c(a), [x2, y2] = c(b); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" data-r="${a} ${b}"/>`; }).join('');
  el.querySelectorAll('.ent').forEach(b => b.onclick = () => {
    const t = b.dataset.t;
    el.querySelectorAll('.ent').forEach(x => x.classList.toggle('on', x === b));
    svg.querySelectorAll('line').forEach(l => l.classList.toggle('on', l.dataset.r.split(' ').includes(t)));
    el.querySelector('.schema-detail').innerHTML = `<b>${t}</b><div class="cols">${SCHEMA[t].map(c => `<span class="col ${/PK/.test(c) ? 'pk' : /FK/.test(c) ? 'fk' : /UQ/.test(c) ? 'uq' : ''}">${c}</span>`).join('')}</div>`;
  });
};
V.rowCounts = (el) => {
  const d = [['Branches', 40], ['Employees', 900], ['Loans', 35000], ['Customers', 250000], ['Accounts', 400000], ['Transactions', 60000000]];
  el.innerHTML = `<div class="seg"><button class="on" data-m="log">Log scale</button><button data-m="lin">Linear scale (আসল পার্থক্য)</button></div><div class="bars"></div>`;
  const draw = m => el.querySelector('.bars').innerHTML = d.map(([n, v]) => { const w = m === 'log' ? Math.log10(v) / Math.log10(6e7) * 100 : v / 6e7 * 100; return `<div class="barrow"><span>${n}</span><div class="bar ${v > 1e6 ? 'bad' : ''}" style="width:${Math.max(w, 0.4)}%"></div><b>${v.toLocaleString('en-IN')}</b></div>`; }).join('');
  el.querySelectorAll('.seg button').forEach(b => b.onclick = () => { el.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b)); draw(b.dataset.m); });
  draw('log');
};

// ─── Ch3 ──────────────────────────────────────────────
V.typeTable = (el) => el.innerHTML = tbl(['দরকার', 'ব্যবহার করো ✅', 'কেন বিকল্প না ❌'], [
  ['টাকা', '<code>DECIMAL(19,4)</code>', 'FLOAT 0.1 সঠিক রাখতে পারে না'],
  ['Surrogate key', '<code>INT / BIGINT</code>', 'UNIQUEIDENTIFIER ১৬ byte, index fragment করে'],
  ['Timestamp', '<code>DATETIME2(3)</code>', 'DATETIME ৩.৩৩ms-এ round করে'],
  ['শুধু তারিখ', '<code>DATE</code>', 'Datetime-এ মধ্যরাত = timezone bug'],
  ['Flag', '<code>BIT</code>', "CHAR(1) 'Y'/'N'-এ constraint নেই"],
  ['নির্দিষ্ট দৈর্ঘ্যের code', '<code>CHAR(3)</code>', 'VARCHAR(3)-এ ২ byte বাড়তি'],
  ['Free text', '<code>NVARCHAR(n)</code>', 'NVARCHAR(MAX) off-row, index key হতে পারে না'],
]) + `<div class="float-demo">🧪 JavaScript-ও FLOAT: <code>0.1 + 0.2 = ${0.1 + 0.2}</code> 😬</div>`;
V.threeValued = (el) => {
  const vals = ['TRUE', 'FALSE', 'UNKNOWN'];
  const AND = (a, b) => (a === 'FALSE' || b === 'FALSE') ? 'FALSE' : (a === 'TRUE' && b === 'TRUE') ? 'TRUE' : 'UNKNOWN';
  const OR = (a, b) => (a === 'TRUE' || b === 'TRUE') ? 'TRUE' : (a === 'FALSE' && b === 'FALSE') ? 'FALSE' : 'UNKNOWN';
  let a = 'TRUE', b = 'UNKNOWN';
  el.innerHTML = `<div class="tvl"><div><div class="muted">A</div><div class="chips a"></div></div><div><div class="muted">B</div><div class="chips b"></div></div></div><div class="tvl-res"></div><div class="row2"><div class="tvt and"></div><div class="tvt or"></div></div>`;
  const chip = v => `<button class="chip v-${v}" data-v="${v}">${v}</button>`;
  const grid = (name, f) => `<table class="tbl mini"><tr><th>${name}</th>${vals.map(v => `<th>${v[0]}</th>`).join('')}</tr>${vals.map(r => `<tr><th>${r[0]}</th>${vals.map(c => `<td class="v-${f(r, c)} ${r === a && c === b ? 'hit' : ''}">${f(r, c)[0]}</td>`).join('')}</tr>`).join('')}</table>`;
  const draw = () => {
    el.querySelector('.a').innerHTML = vals.map(chip).join(''); el.querySelector('.b').innerHTML = vals.map(chip).join('');
    el.querySelectorAll('.a .chip').forEach(c => { c.classList.toggle('on', c.dataset.v === a); c.onclick = () => { a = c.dataset.v; draw(); }; });
    el.querySelectorAll('.b .chip').forEach(c => { c.classList.toggle('on', c.dataset.v === b); c.onclick = () => { b = c.dataset.v; draw(); }; });
    const x = AND(a, b), y = OR(a, b);
    el.querySelector('.tvl-res').innerHTML = `<div>A AND B = <b class="v-${x}">${x}</b> ${x === 'TRUE' ? '→ WHERE row রাখে ✅' : '→ WHERE row ফেলে দেয় ❌'}</div><div>A OR B = <b class="v-${y}">${y}</b> ${y === 'TRUE' ? '→ রাখে ✅' : '→ ফেলে দেয় ❌'}</div>`;
    el.querySelector('.and').innerHTML = grid('AND', AND); el.querySelector('.or').innerHTML = grid('OR', OR);
  };
  draw();
};

// ─── Ch4 ──────────────────────────────────────────────
V.halfOpen = (el) => {
  const tx = [['Jan 01 09:15', 1], ['Jan 15 14:00', 15], ['Jan 31 00:00', 31], ['Jan 31 10:30', 31.44], ['Jan 31 23:59', 31.99], ['Feb 01 00:00', 32]];
  tabs(el, ['❌ BETWEEN ...31', '✅ >= ...01 AND < Feb 01'], k => {
    const inc = x => k === 0 ? x[1] <= 31 : x[1] < 32;
    return `<div class="timeline"><div class="range" style="left:0;width:${k === 0 ? 31 / 33 * 100 : 32 / 33 * 100}%"></div>${tx.map(x => `<div class="tick ${inc(x) ? 'in' : 'out'}" style="left:${x[1] / 33 * 100}%" title="${x[0]}"></div>`).join('')}</div>
    ${tbl(['Transaction', 'ফলাফল'], tx.map(x => [x[0], inc(x) ? '✅ আসে' : (x[1] < 32 ? '<b class="bad-t">❌ বাদ পড়ল! (bug)</b>' : '➖ বাদ (ঠিক আছে)')]))}`;
  });
};
V.offsetVsKeyset = (el) => {
  el.innerHTML = `<label>Page নম্বর: <input type="range" min="1" max="5000" value="1" class="pg"> <b class="pgv">1</b></label><div class="bars"></div>`;
  const draw = () => {
    const p = +el.querySelector('.pg').value; el.querySelector('.pgv').textContent = p;
    const off = p * 20, ks = 20;
    el.querySelector('.bars').innerHTML = `<div class="barrow"><span>OFFSET পড়ে</span><div class="bar bad" style="width:${Math.max(0.5, off / 100000 * 100)}%"></div><b>${off.toLocaleString()} rows</b></div><div class="barrow"><span>Keyset পড়ে</span><div class="bar good" style="width:0.5%"></div><b>${ks} rows</b></div><p class="muted">OFFSET ${(p - 1) * 20} row পড়ে ফেলে দেয়, তারপর ২০টা দেয়। Keyset সরাসরি জায়গায় seek করে।</p>`;
  };
  el.querySelector('.pg').oninput = draw; draw();
};
V.caseTier = (el) => {
  el.innerHTML = `<label>Balance (Tk): <input type="range" min="0" max="1500000" step="5000" value="250000" class="cb"> <b class="cbv"></b></label><div class="tiers"></div>`;
  const T = [['PLATINUM', 1000000], ['GOLD', 500000], ['SILVER', 100000], ['STANDARD', 0]];
  const draw = () => {
    const v = +el.querySelector('.cb').value; el.querySelector('.cbv').textContent = v.toLocaleString('en-IN');
    const hit = T.find(t => v >= t[1]);
    el.querySelector('.tiers').innerHTML = T.map(t => `<div class="tier ${t === hit ? 'on' : ''} ${v >= t[1] && t !== hit ? 'skip' : ''}">WHEN Balance >= ${t[1].toLocaleString('en-IN')} THEN '${t[0]}' ${t === hit ? '← প্রথম TRUE, এখানেই থামে' : ''}</div>`).join('');
  };
  el.querySelector('.cb').oninput = draw; draw();
};

// ─── Ch5 ──────────────────────────────────────────────
const JC = [[1, 'Rahim'], [2, 'Karim'], [3, 'Nusrat']];
const JA = [[101, 1, 'SAVINGS', 'ACTIVE'], [102, 1, 'CURRENT', 'ACTIVE'], [103, 2, 'SAVINGS', 'DORMANT']];
V.joinViz = (el) => {
  const types = ['INNER JOIN', 'LEFT JOIN', 'Anti (NOT EXISTS)', 'CROSS JOIN'];
  tabs(el, types, k => {
    let rows = [];
    if (k === 0) JC.forEach(c => JA.filter(a => a[1] === c[0]).forEach(a => rows.push([c[1], a[0], a[2]])));
    if (k === 1) JC.forEach(c => { const m = JA.filter(a => a[1] === c[0]); m.length ? m.forEach(a => rows.push([c[1], a[0], a[2]])) : rows.push({ cells: [c[1], null, null], _c: 'nullrow' }); });
    if (k === 2) JC.filter(c => !JA.some(a => a[1] === c[0])).forEach(c => rows.push([c[1], '—', '—']));
    if (k === 3) JC.forEach(c => JA.forEach(a => rows.push([c[1], a[0], a[2]])));
    const sql = ['c JOIN a ON a.CustomerId = c.CustomerId', 'c LEFT JOIN a ON a.CustomerId = c.CustomerId', 'c WHERE NOT EXISTS (… a.CustomerId = c.CustomerId)', 'c CROSS JOIN a'][k];
    const note = ['শুধু মিল থাকা row। Nusrat হারিয়ে গেল (account নেই)।', 'বাম (Customers) সবাই থাকে। Nusrat → NULL দিয়ে পূর্ণ।', 'শুধু যাদের কোনো মিল নেই।', 'সব জোড়া: 3 × 3 = 9 row (Cartesian)।'][k];
    return `<div class="join3"><div><div class="cap">Customers (c)</div>${tbl(['Id', 'Name'], JC.map(r => ({ cells: r, _c: (k === 2 && r[0] === 3) || (k === 1 && r[0] === 3) ? 'hlrow' : '' })))}</div>
      <div><div class="cap">Accounts (a)</div>${tbl(['AccId', 'CustId', 'Type'], JA.map(r => r.slice(0, 3)))}</div>
      <div><div class="cap">Result: ${rows.length} rows</div>${tbl(['Name', 'AccId', 'Type'], rows)}</div></div>
      <div class="callout"><code>FROM ${sql}</code><br>${note}</div>`;
  });
};
V.leftJoinTrap = (el) => tabs(el, ['🐛 Filter WHERE-এ', '✅ Filter ON-এ'], k => {
  const joined = []; JC.forEach(c => { const m = JA.filter(a => a[1] === c[0] && (k === 0 || a[3] === 'ACTIVE')); m.length ? m.forEach(a => joined.push([c[1], a[0], a[3]])) : joined.push([c[1], null, null]); });
  const res = k === 0 ? joined.filter(r => r[2] === 'ACTIVE') : joined;
  return `<div class="join3 two"><div><div class="cap">① JOIN-এর পর (${joined.length})</div>${tbl(['Name', 'AccId', 'Status'], joined.map(r => ({ cells: r, _c: k === 0 && r[2] !== 'ACTIVE' ? 'gone' : '' })))}</div>
  <div><div class="cap">② WHERE-এর পর (${res.length})</div>${tbl(['Name', 'AccId', 'Status'], res)}</div></div>
  <div class="callout">${k === 0 ? 'Karim (DORMANT) আর Nusrat (NULL) <b>দুজনেই হারাল</b> → কার্যত INNER JOIN! কারণ NULL = \'ACTIVE\' → UNKNOWN।' : 'সব customer আছে ✅ — Karim ও Nusrat-এর account কলাম NULL, কারণ ACTIVE account নেই।'}</div>`;
});
V.fanout = (el) => {
  el.innerHTML = `<div class="row2"><label>Accounts: <input type="number" min="1" max="6" value="2" class="fa"></label><label>Loans: <input type="number" min="1" max="6" value="3" class="fl"></label></div><div class="fo"></div>`;
  const draw = () => {
    const a = +el.querySelector('.fa').value, l = +el.querySelector('.fl').value;
    const bal = 100000, pr = 50000;
    let rows = ''; for (let i = 1; i <= a; i++) for (let j = 1; j <= l; j++) rows += `<span class="fcell"><b class="ca">A${i}</b>×<b class="cl">L${j}</b></span>`;
    el.querySelector('.fo').innerHTML = `<div class="fgrid">${rows}</div><div class="callout">আশা: ${a} + ${l} = <b>${a + l}</b> row · আসলে: ${a} × ${l} = <b class="bad-t">${a * l}</b> row<br>
    SUM(Balance): সঠিক Tk ${(a * bal).toLocaleString('en-IN')} → দেখায় <b class="bad-t">Tk ${(a * l * bal).toLocaleString('en-IN')}</b> (${l}× বেশি)<br>
    SUM(Principal): সঠিক Tk ${(l * pr).toLocaleString('en-IN')} → দেখায় <b class="bad-t">Tk ${(a * l * pr).toLocaleString('en-IN')}</b> (${a}× বেশি)</div>`;
  };
  el.querySelectorAll('input').forEach(i => i.oninput = draw); draw();
};
V.joinAlgos = (el) => el.innerHTML = tbl(['Algorithm', 'কীভাবে কাজ করে', 'কখন বেছে নেয়'], [
  ['🔁 Nested Loops', 'প্রতি outer row-এর জন্য inner-এ seek', 'Outer ছোট, inner-এ কাজের index আছে'],
  ['🤝 Merge Join', 'দুটো sorted input একসাথে একবার হাঁটে', 'দুটোই join key-তে আগে থেকে sorted'],
  ['#️⃣ Hash Match', 'এক input-এ hash table বানায়, অন্যটা দিয়ে probe', 'বড় unsorted input, কাজের index নেই'],
]);

// ─── Ch6 ──────────────────────────────────────────────
V.groupBy = (el) => {
  const R = [['Gulshan', 'SAVINGS', 85000], ['Gulshan', 'CURRENT', 250000], ['Motijheel', 'SAVINGS', 4300], ['Gulshan', 'SAVINGS', 120000], ['Motijheel', 'SAVINGS', 60000], ['Agrabad', 'FD', 500000]];
  const col = { Gulshan: 'g1', Motijheel: 'g2', Agrabad: 'g3' };
  stepper(el, 3, i => {
    if (i === 0) return `<div class="cap">① FROM + WHERE: আলাদা আলাদা row</div>` + tbl(['Branch', 'Type', 'Balance'], R.map(r => ({ cells: r, _c: '' })));
    if (i === 1) return `<div class="cap">② GROUP BY Branch, Type: একই রঙ = এক group</div>` + tbl(['Branch', 'Type', 'Balance'], [...R].sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1])).map(r => ({ cells: r, _c: col[r[0]] })));
    const g = {}; R.forEach(r => { const k = r[0] + '|' + r[1]; g[k] = g[k] || [r[0], r[1], 0, 0]; g[k][2]++; g[k][3] += r[2]; });
    return `<div class="cap">③ প্রতি group = ১ row। আলাদা row আর নেই!</div>` + tbl(['Branch', 'Type', 'COUNT(*)', 'SUM(Balance)'], Object.values(g).map(r => ({ cells: [r[0], r[1], r[2], r[3].toLocaleString('en-IN')], _c: col[r[0]] })));
  }, { speed: 1800 });
};
V.rollup = (el) => el.innerHTML = tbl(['BranchName', 'AccountType', 'TotalBalance', 'GROUPING(Type)'], [
  ['Gulshan', 'CURRENT', '250,000', 0], ['Gulshan', 'SAVINGS', '205,000', 0], { cells: ['Gulshan', '<i class="nul">NULL</i>', '<b>455,000</b>', '<b>1</b> ← subtotal'], _c: 'sub' },
  ['Motijheel', 'SAVINGS', '64,300', 0], { cells: ['Motijheel', '<i class="nul">NULL</i>', '<b>64,300</b>', '<b>1</b> ← subtotal'], _c: 'sub' },
  { cells: ['<i class="nul">NULL</i>', '<i class="nul">NULL</i>', '<b>519,300</b>', '<b>1</b> ← grand total'], _c: 'grand' },
]);

// ─── Ch7 ──────────────────────────────────────────────
V.setOps = (el) => {
  const A = [1, 1, 2, 3], B = [2, 4];
  const ops = ['UNION ALL', 'UNION', 'INTERSECT', 'EXCEPT'];
  tabs(el, ops, k => {
    const res = k === 0 ? [...A, ...B] : k === 1 ? [...new Set([...A, ...B])] : k === 2 ? [...new Set(A.filter(x => B.includes(x)))] : [...new Set(A.filter(x => !B.includes(x)))];
    const fill = ['a b', 'a b', 'i', 'ao'][k];
    return `<div class="venn ${fill}"><svg viewBox="0 0 200 110"><defs><clipPath id="ca"><circle cx="80" cy="55" r="45"/></clipPath></defs>
      <circle class="va" cx="80" cy="55" r="45"/><circle class="vb" cx="120" cy="55" r="45"/><circle class="vi" cx="120" cy="55" r="45" clip-path="url(#ca)"/>
      <text x="50" y="58">A</text><text x="145" y="58">B</text></svg></div>
      <div class="callout">A (Accounts-এর CustomerId) = [${A}] · B (Loans-এর CustomerId) = [${B}]<br><b>A ${ops[k]} B</b> = [${res}] <span class="muted">— ${['duplicate সহ সব, সস্তা', 'duplicate মুছে (sort/hash, দামি)', 'দুটোতেই আছে', 'A-তে আছে, B-তে নেই'][k]}</span></div>`;
  });
};

// ─── Ch8 ──────────────────────────────────────────────
V.notInTrap = (el) => {
  let withNull = false;
  el.innerHTML = `<button class="btn tog">➕ Subquery-তে NULL যোগ করো</button><div class="nit"></div>`;
  const draw = () => {
    const list = withNull ? [1, 2, 'NULL'] : [1, 2];
    const rows = [1, 2, 3, 4].map(x => {
      const parts = list.map(v => v === 'NULL' ? 'UNKNOWN' : (x !== v ? 'TRUE' : 'FALSE'));
      const r = parts.includes('FALSE') ? 'FALSE' : parts.includes('UNKNOWN') ? 'UNKNOWN' : 'TRUE';
      return { cells: [x, parts.map(p => `<span class="v-${p}">${p}</span>`).join(' AND '), `<b class="v-${r}">${r}</b>`, r === 'TRUE' ? '✅' : '❌'], _c: r === 'TRUE' ? '' : 'gone' };
    });
    el.querySelector('.nit').innerHTML = `<div class="cap">BranchId NOT IN (${list.join(', ')})</div>` + tbl(['BranchId', 'বিস্তার', 'ফল', 'রাখে?'], rows) + (withNull ? '<div class="callout bad">💣 একটা NULL → <b>সব row বাদ</b>! NOT EXISTS ব্যবহার করো।</div>' : '');
    el.querySelector('.tog').textContent = withNull ? '➖ NULL সরাও' : '➕ Subquery-তে NULL যোগ করো';
  };
  el.querySelector('.tog').onclick = () => { withNull = !withNull; draw(); }; draw();
};

// ─── Ch9 ──────────────────────────────────────────────
const ORG = [[1, 'Ayesha (CEO)', null], [2, 'Bashir (CTO)', 1], [3, 'Farhana (CFO)', 1], [4, 'Imran (Dev Lead)', 2], [5, 'Jannat (Dev)', 4], [6, 'Kamal (Accountant)', 3], [7, 'Liza (Dev)', 4]];
V.recursiveTree = (el) => {
  const lv = {}; ORG.forEach(e => lv[e[0]] = e[2] === null ? 0 : lv[e[2]] + 1);
  const maxD = Math.max(...Object.values(lv));
  stepper(el, maxD + 2, i => {
    const shown = ORG.filter(e => lv[e[0]] <= i - 1 + (i === 0 ? 1 : 0) && (i > 0 || lv[e[0]] === 0));
    const visible = i === 0 ? ORG.filter(e => lv[e[0]] === 0) : ORG.filter(e => lv[e[0]] <= Math.min(i, maxD));
    const newLvl = Math.min(i, maxD + 1);
    const label = i === 0 ? '① ANCHOR: WHERE ManagerId IS NULL → CEO' : i <= maxD ? `🔁 Iteration ${i}: আগের level-এর অধীনস্থদের JOIN করে Depth ${i}` : '🛑 পরের iteration ০ row দিল → recursion থামল';
    return `<div class="callout">${label}</div><div class="tree">${visible.map(e => `<div class="node ${lv[e[0]] === newLvl ? 'new' : ''}" style="margin-left:${lv[e[0]] * 26}px">${lv[e[0]] ? '└─ ' : ''}${e[1]} <span class="muted">Depth ${lv[e[0]]}</span></div>`).join('')}</div>`;
  }, { speed: 1600 });
};

// ─── Ch10 ──────────────────────────────────────────────
V.windowViz = (el) => {
  const R = [[1, 'Jan 02', 500], [1, 'Jan 05', 300], [1, 'Jan 09', 200], [2, 'Jan 03', 1000], [2, 'Jan 07', 400]];
  let cur = 1;
  const draw = () => {
    const p = R[cur][0];
    el.innerHTML = `<div class="muted">একটা row-এ ক্লিক করো — তার window (frame) হাইলাইট হবে</div>` + tbl(['AccountId', 'TxnDate', 'Amount', 'RunningTotal'], R.map((r, k) => {
      const inFrame = r[0] === p && k <= cur && R.indexOf(R.find(x => x[0] === p)) <= k;
      const rt = R.filter((x, j) => x[0] === r[0] && j <= k).reduce((s, x) => s + x[2], 0);
      return { cells: [r[0], r[1], r[2], rt], _c: (k === cur ? 'cur ' : '') + (inFrame ? 'frame ' : '') + (r[0] !== p ? 'dim' : '') };
    }), 'clickable') + `<div class="callout">PARTITION = Account ${p} · ORDER BY TxnDate · Frame = শুরু থেকে এই row পর্যন্ত → যোগফল <b>${R.filter((x, j) => x[0] === p && j <= cur).reduce((s, x) => s + x[2], 0)}</b>। লক্ষ্য করো: সব row রয়ে গেছে (GROUP BY হলে গুটিয়ে যেত)।</div>`;
    el.querySelectorAll('tbody tr').forEach((tr, k) => tr.onclick = () => { cur = k; draw(); });
  };
  draw();
};
V.rankViz = (el) => {
  let vals = [900, 800, 800, 700];
  const draw = () => {
    const s = [...vals].sort((a, b) => b - a);
    const rows = s.map((v, i) => [v, i + 1, s.indexOf(v) + 1, [...new Set(s)].indexOf(v) + 1]);
    el.innerHTML = `<div class="row2">${vals.map((v, i) => `<input type="number" step="100" value="${v}" data-i="${i}" class="rk">`).join('')}<button class="btn sm add">+ row</button></div>` +
      tbl(['Balance', 'ROW_NUMBER', 'RANK', 'DENSE_RANK'], rows.map(r => ({ cells: r, _c: s.filter(x => x === r[0]).length > 1 ? 'tie' : '' }))) + `<div class="muted">হলুদ = tie। RANK tie-র পরে লাফ দেয়, DENSE_RANK দেয় না।</div>`;
    el.querySelectorAll('.rk').forEach(i => i.onchange = () => { vals[+i.dataset.i] = +i.value; draw(); });
    el.querySelector('.add').onclick = () => { if (vals.length < 8) vals.push(800); draw(); };
  };
  draw();
};
V.lagLead = (el) => {
  const R = [['Jan 02', 500], ['Jan 05', 300], ['Jan 09', 200], ['Jan 12', 900]];
  let cur = 1;
  const draw = () => {
    el.innerHTML = tbl(['TxnDate', 'Amount', 'LAG(Amount)', 'LEAD(TxnDate)', 'Delta (LAG,1,0)'], R.map((r, k) => ({
      cells: [r[0], r[1], k ? R[k - 1][1] : null, k < R.length - 1 ? R[k + 1][0] : null, r[1] - (k ? R[k - 1][1] : 0)],
      _c: k === cur ? 'cur' : (k === cur - 1 ? 'prev' : k === cur + 1 ? 'next' : '')
    })), 'clickable') + `<div class="muted">Row-এ ক্লিক করো: 🟦 আগের = LAG, 🟩 পরের = LEAD</div>`;
    el.querySelectorAll('tbody tr').forEach((tr, k) => tr.onclick = () => { cur = k; draw(); });
  };
  draw();
};
V.rowsRange = (el) => {
  const R = [['10:00', 100], ['10:05', 200], ['10:05', 300], ['10:09', 50]];
  tabs(el, ['ROWS (সঠিক)', 'RANGE (default!)'], k => {
    let acc = 0;
    const rows = R.map((r, i) => { acc += r[1]; const range = R.filter(x => x[0] <= r[0]).reduce((s, x) => s + x[1], 0); return { cells: [r[0], r[1], k === 0 ? acc : range], _c: k === 1 && R.filter(x => x[0] === r[0]).length > 1 ? 'tie' : '' }; });
    return tbl(['TxnDate', 'Amount', 'RunningTotal'], rows) + `<div class="callout ${k ? 'bad' : ''}">${k ? 'একই timestamp (10:05)-এর দুটো row <b>দুজনেই 600</b> পেল — peer হিসেবে একসাথে গোনা হয়েছে। ভুল running total! আর RANGE disk worktable লাগে → slow।' : 'প্রতিটা physical row আলাদা: 100 → 300 → 600 → 650 ✅'}</div>`;
  });
};
V.gapsIslands = (el) => {
  let on = new Set([1, 2, 3, 6, 7, 10, 11, 12, 13]);
  const draw = () => {
    const days = [...on].sort((a, b) => a - b);
    const cols = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'];
    const keyMap = {}; let ci = 0;
    const rows = days.map((d, i) => { const k = d - (i + 1); if (!(k in keyMap)) keyMap[k] = cols[ci++ % cols.length]; return { cells: [`Jan ${d}`, i + 1, `Jan ${d} − ${i + 1} = <b>${k <= 0 ? 'Dec ' + (31 + k) : 'Jan ' + k}</b>`], _c: keyMap[k] }; });
    el.innerHTML = `<div class="muted">তারিখে ক্লিক করে activity on/off করো:</div><div class="cal">${Array.from({ length: 15 }, (_, i) => i + 1).map(d => `<button class="day ${on.has(d) ? 'on ' + keyMap[days.includes(d) ? d - (days.indexOf(d) + 1) : 'x'] : ''}" data-d="${d}">${d}</button>`).join('')}</div>` +
      tbl(['ActivityDate', 'ROW_NUMBER', 'IslandKey = date − rn'], rows) + `<div class="callout">একই রঙ = একই IslandKey = একটা টানা streak 🏝️ · মোট island: <b>${Object.keys(keyMap).length}</b></div>`;
    el.querySelectorAll('.day').forEach(b => b.onclick = () => { const d = +b.dataset.d; on.has(d) ? on.delete(d) : on.add(d); draw(); });
  };
  draw();
};

// ─── Ch11 / 12 ──────────────────────────────────────────────
V.tempVsVar = (el) => el.innerHTML = tbl(['', '#TempTable', '@TableVariable'], [
  ['Statistics', '✅ হ্যাঁ — আসল estimate', '❌ না (১ row ধরে)'], ['Index', 'যেকোনো, পরে যোগ করা যায়', 'শুধু inline/PK'], ['Recompile', 'Plan recompile ঘটায়', 'না'],
  ['Transaction', 'পুরো log, rollback হয়', 'Rollback-এও টিকে থাকে'], ['Parallelism', 'চলে', 'Write-এ parallel বন্ধ'], ['সেরা কাজে', '> ১০০ row, join, reuse', 'ছোট set, < ১০০ row'],
]);
V.deleteTruncate = (el) => el.innerHTML = tbl(['', 'DELETE', 'TRUNCATE TABLE'], [
  ['Logging', 'Row by row', 'Page deallocate: minimal'], ['WHERE', '✅', '❌'], ['Trigger', 'Fire করে', 'Fire করে না'], ['Identity', 'থাকে', 'Seed-এ reset'], ['Rollback', '✅', '✅ (transactional!)'], ['FK reference থাকলে', 'চলে', 'Block হয়'],
]);
V.batchDelete = (el) => {
  tabs(el, ['😱 এক বিশাল DELETE', '😌 Batch DELETE TOP(5000)'], k => k === 0
    ? `<div class="lockbar one"><span>🔒 পুরো table lock — ২০M row, ৪৫ মিনিট</span></div><div class="callout bad">সবাই block · log ফুলে যায় · ৯০%-এ fail = ১ ঘণ্টা rollback</div>`
    : `<div class="lockbar many">${Array.from({ length: 24 }, (_, i) => `<span style="animation-delay:${i * .12}s"></span>`).join('')}</div><div class="callout">প্রতিটা ছোট batch = আলাদা transaction → lock মুক্ত হয়, log truncate হয়, fail হলে শুধু এক batch যায়।</div>`);
};

// ─── Ch13 ──────────────────────────────────────────────
V.transferRace = (el) => {
  const steps = (lock) => lock ? [
    ['T1: SELECT Balance WITH (UPDLOCK) → 1000', '', 1000], ['', 'T2: SELECT WITH (UPDLOCK) → ⏳ অপেক্ষা…', 1000], ['T1: 1000 ≥ 800 ✓ UPDATE → 200', '⏳', 200], ['T1: COMMIT ✅', '⏳', 200], ['', 'T2: এখন পড়ে → 200', 200], ['', 'T2: 200 < 800 → THROW Insufficient funds ✅', 200]
  ] : [
    ['T1: SELECT Balance → 1000', '', 1000], ['', 'T2: SELECT Balance → 1000', 1000], ['T1: 1000 ≥ 800 ✓ UPDATE → 200', '', 200], ['', 'T2: 1000 ≥ 800 ✓ UPDATE → −600', -600], ['T1: COMMIT', 'T2: COMMIT', -600], ['💥 Balance = Tk −600', '', -600]];
  tabs(el, ['❌ UPDLOCK ছাড়া', '✅ UPDLOCK সহ'], k => `<div class="race" data-k="${k}"></div>`);
  const run = () => { const box = el.querySelector('.race'); const S = steps(+box.dataset.k === 1); stepper(box, S.length, i => `<div class="lanes"><div class="lane"><b>Transaction 1</b>${S.slice(0, i + 1).map(s => `<div class="ev">${s[0] || '&nbsp;'}</div>`).join('')}</div><div class="lane"><b>Transaction 2</b>${S.slice(0, i + 1).map(s => `<div class="ev">${s[1] || '&nbsp;'}</div>`).join('')}</div><div class="balbox ${S[i][2] < 0 ? 'neg' : ''}">Balance<br><b>Tk ${S[i][2]}</b></div></div>`, { speed: 1400 }); };
  el.querySelectorAll('.seg button').forEach(b => { const o = b.onclick; b.onclick = () => { o(); run(); }; }); run();
};
V.isolation = (el) => {
  const L = [['READ UNCOMMITTED', [1, 1, 1], 'Shared lock নেই'], ['READ COMMITTED', [0, 1, 1], 'Shared lock, সাথে সাথে ছাড়ে (default)'], ['REPEATABLE READ', [0, 0, 1], 'Commit পর্যন্ত shared lock'], ['SERIALIZABLE', [0, 0, 0], 'Range lock'], ['SNAPSHOT', [0, 0, 0], 'Row versioning — reader writer-কে block করে না']];
  tabs(el, L.map(l => l[0].replace('READ ', 'R. ')), k => `<div class="iso">${['👻 Dirty read', '🔄 Non-repeatable read', '👤 Phantom read'].map((n, i) => `<div class="isoc ${L[k][1][i] ? 'bad' : 'good'}">${n}<b>${L[k][1][i] ? 'সম্ভব ⚠️' : 'আটকানো ✅'}</b></div>`).join('')}</div><div class="callout">⚙️ ${L[k][2]}</div>`, 1);
};
V.deadlock = (el) => stepper(el, 5, i => {
  const s = [
    ['T1 lock নিল: Account 1 🔒', 'T2 lock নিল: Account 2 🔒', ''], ['T1 চায় Account 2 → ⏳ অপেক্ষা', '', ''], ['', 'T2 চায় Account 1 → ⏳ অপেক্ষা', '🔁 চক্র! কেউ কখনো এগোতে পারবে না'],
    ['', '💀 T2 = victim, ROLLBACK (Error 1205)', 'Engine চক্র ধরল'], ['T1 Account 2 পেল → COMMIT ✅', '🔁 T2 retry করে সফল', 'সমাধান: সবাই ছোট AccountId আগে lock করলে চক্র অসম্ভব']][i];
  return `<div class="dl"><div class="dlbox ${i >= 0 ? 't1' : ''}">T1</div><svg viewBox="0 0 200 80" class="dlsvg"><rect x="20" y="5" width="60" height="26" rx="5"/><text x="50" y="23">Acc 1</text><rect x="120" y="5" width="60" height="26" rx="5"/><text x="150" y="23">Acc 2</text>
  ${i >= 0 ? '<line class="hold" x1="50" y1="31" x2="30" y2="70"/><line class="hold2" x1="150" y1="31" x2="170" y2="70"/>' : ''}${i >= 1 && i < 4 ? '<line class="want" x1="40" y1="70" x2="140" y2="31"/>' : ''}${i >= 2 && i < 3 ? '<line class="want2" x1="160" y1="70" x2="60" y2="31"/>' : ''}</svg><div class="dlbox t2 ${i === 3 ? 'dead' : ''}">T2</div></div>
  <div class="lanes"><div class="lane"><div class="ev">${s[0] || '&nbsp;'}</div></div><div class="lane"><div class="ev">${s[1] || '&nbsp;'}</div></div></div>${s[2] ? `<div class="callout ${i === 2 ? 'bad' : ''}">${s[2]}</div>` : ''}`;
}, { speed: 1700 });

// ─── Ch14–16 ──────────────────────────────────────────────
V.scalarVsInline = (el) => tabs(el, ['☠️ Scalar UDF', '✅ Inline TVF'], k => k === 0
  ? `<div class="cores">${Array.from({ length: 8 }, (_, i) => `<div class="core ${i ? 'idle' : 'busy'}">CPU ${i + 1}<br>${i ? '😴' : '🔥'}</div>`).join('')}</div><div class="callout bad">250,000 বার function call · ১ core · optimizer খরচ ধরে 0 → ১০ মিনিট</div>`
  : `<div class="cores">${Array.from({ length: 8 }, (_, i) => `<div class="core busy">CPU ${i + 1}<br>⚡</div>`).join('')}</div><div class="callout">এক set-based join · ৮ core parallel · optimizer ভিতরটা দেখে → সেকেন্ডে</div>`);
V.triggerTables = (el) => el.innerHTML = `<div class="cap">UPDATE Accounts SET Balance = Balance − 500 WHERE BranchId = 1 <span class="muted">(৩ row)</span></div><div class="join3 two"><div><div class="cap">deleted (পুরনো)</div>${tbl(['AccountId', 'Balance'], [[101, '85,000'], [102, '250,000'], [104, '120,000']])}</div><div><div class="cap">inserted (নতুন)</div>${tbl(['AccountId', 'Balance'], [[101, '84,500'], [102, '249,500'], [104, '119,500']])}</div></div><div class="callout">Trigger <b>একবার</b> fire করে, দুই table-এ ৩টা করে row। <code>SELECT @Id = AccountId FROM inserted</code> → শুধু ১টা পায় 🐛</div>`;
V.cursorRace = (el) => {
  el.innerHTML = `<button class="btn pri go">🏁 রেস শুরু (৪ লাখ account)</button><div class="race2"><div class="barrow"><span>Cursor (৮ লাখ statement)</span><div class="track"><div class="runner cur"></div></div><b class="t1">—</b></div><div class="barrow"><span>Set-based (২ statement)</span><div class="track"><div class="runner set"></div></div><b class="t2">—</b></div></div>`;
  el.querySelector('.go').onclick = () => {
    const a = el.querySelector('.runner.cur'), b = el.querySelector('.runner.set'); a.style.transition = b.style.transition = 'none'; a.style.width = b.style.width = '0';
    el.querySelector('.t1').textContent = '…'; el.querySelector('.t2').textContent = '…';
    requestAnimationFrame(() => requestAnimationFrame(() => { a.style.transition = 'width 9s linear'; b.style.transition = 'width .35s linear'; a.style.width = '100%'; b.style.width = '100%'; }));
    setTimeout(() => el.querySelector('.t2').textContent = '≈ 3 sec ✅', 400); setTimeout(() => el.querySelector('.t1').textContent = '≈ 6 min 🐢', 9000);
  };
};
V.translation = (el) => flipCards(el, [
  ['প্রতি row-এ running total', '<code>SUM() OVER (ORDER BY … ROWS …)</code>'], ['আগের row-এর সাথে তুলনা', '<code>LAG() / LEAD()</code>'], ['Group-এ row নম্বর', '<code>ROW_NUMBER() OVER (PARTITION BY …)</code>'],
  ['প্রতি row-এ আলাদা value', 'SET-এর ভিতরে <code>CASE</code>'], ['প্রতি row insert বা update', '<code>MERGE / ON CONFLICT</code>'], ['প্রতি parent-এর top 3 child', '<code>CROSS APPLY (SELECT TOP 3 …)</code>'],
  ['Hierarchy হাঁটা', 'Recursive CTE'], ['Row জুড়ে string', '<code>STRING_AGG()</code>'], ['এইমাত্র লেখা ID দরকার', '<code>OUTPUT</code> clause'], ['প্রতি row-এ procedure call', 'Procedure-কে TVP নিতে শেখাও'],
]);
V.nPlusOne = (el) => tabs(el, ['❌ N+1 (lazy loading)', '✅ এক projected query'], k => {
  const n = k ? 1 : 1001;
  return `<div class="dots">${Array.from({ length: Math.min(n, 200) }, (_, i) => `<i style="animation-delay:${i * 8}ms"></i>`).join('')}${n > 200 ? '<span class="muted"> …আরও ' + (n - 200) + '</span>' : ''}</div><div class="callout ${k ? '' : 'bad'}">${n} round trip × 2ms = <b>${(n * 2 / 1000).toFixed(3)} s</b> ${k ? '' : '(প্রতিটা query নিজে ০.৪ms — তবু endpoint slow!)'}</div>`;
});

// ─── Ch17 / 18 ──────────────────────────────────────────────
V.injection = (el) => {
  el.innerHTML = `<label>@City input: <input class="inj wide" value="Dhaka"></label><div class="row2 chips"><button class="chip" data-v="Dhaka">Dhaka</button><button class="chip" data-v="'; DROP TABLE Accounts; --">'; DROP TABLE Accounts; --</button><button class="chip" data-v="' OR '1'='1">' OR '1'='1</button></div><div class="injout"></div>`;
  const draw = () => {
    const v = el.querySelector('.inj').value;
    const bad = /'/.test(v);
    el.querySelector('.injout').innerHTML = `<div class="cap">❌ String concatenation → DB যা দেখে:</div><pre class="code ${bad ? 'danger' : ''}">SELECT * FROM Customers WHERE City = '<mark>${esc(v)}</mark>'</pre>${bad ? '<div class="callout bad">💀 Input-এর <code>\'</code> string বন্ধ করে দিল — বাকিটা <b>SQL কোড</b> হিসেবে চলবে!</div>' : ''}
    <div class="cap">✅ sp_executesql parameter → DB যা দেখে:</div><pre class="code">SELECT * FROM Customers WHERE City = @pCity
-- @pCity = ${esc(JSON.stringify(v))}   (শুধু data, কখনো parse হয় না)</pre><div class="callout">Parameter মানে <b>"এই নামে একজন City খোঁজো"</b> — ${bad ? 'কেউ পাওয়া যাবে না, কোনো ক্ষতি নেই ✅' : 'স্বাভাবিক ফল ✅'}</div>`;
  };
  el.querySelector('.inj').oninput = draw; el.querySelectorAll('.chip').forEach(c => c.onclick = () => { el.querySelector('.inj').value = c.dataset.v; draw(); }); draw();
};
V.tryCatchFlow = (el) => tabs(el, ['✅ সব ঠিক', '💥 Error হলো'], k => `<div class="flow">${(k ? ['BEGIN TRY', 'BEGIN TRANSACTION', 'Balance ≠ 0 → THROW 50040 💥', '→ BEGIN CATCH', 'XACT_STATE() <> 0 → ROLLBACK', 'ErrorLog-এ INSERT', 'THROW; (original error caller-এর কাছে)'] : ['BEGIN TRY', 'BEGIN TRANSACTION', 'Validation পাস ✓', 'UPDATE … Status = CLOSED', '@@ROWCOUNT = 1 ✓', 'COMMIT ✅']).map((s, i) => `<div class="fstep ${/💥|ROLLBACK|THROW;/.test(s) ? 'bad' : ''}" style="animation-delay:${i * .25}s">${s}</div>`).join('<i class="arr">↓</i>')}</div>`);
V.trancount = (el) => {
  let n = 0, log = [], committed = [];
  el.innerHTML = `<div class="row2"><button class="btn sm" data-a="b">BEGIN TRAN</button><button class="btn sm" data-a="i">INSERT row</button><button class="btn sm" data-a="c">COMMIT</button><button class="btn sm" data-a="r">ROLLBACK</button><button class="btn sm" data-a="x">↺ Reset</button></div><div class="tcbox"></div>`;
  let pending = [];
  const draw = () => el.querySelector('.tcbox').innerHTML = `<div class="tc">@@TRANCOUNT = <b>${n}</b></div><div class="row2"><div><div class="cap">Pending (uncommitted)</div>${pending.map(p => `<span class="chip">${p}</span>`).join('') || '<span class="muted">—</span>'}</div><div><div class="cap">সত্যিই committed ✅</div>${committed.map(p => `<span class="chip ok">${p}</span>`).join('') || '<span class="muted">—</span>'}</div></div><div class="log">${log.slice(-5).map(l => `<div>${l}</div>`).join('')}</div>`;
  let id = 1;
  el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'b') { n++; log.push(`BEGIN TRAN → count ${n}${n > 1 ? ' (নতুন transaction না! শুধু count বাড়ল)' : ''}`); }
    if (a === 'i') { if (n) { pending.push('row' + id++); log.push('INSERT (pending)'); } else { committed.push('row' + id++); log.push('INSERT (autocommit)'); } }
    if (a === 'c') { if (!n) log.push('⚠️ Error: কোনো transaction নেই'); else { n--; if (n === 0) { committed.push(...pending); pending = []; log.push('COMMIT → count 0 → সত্যিকারের commit ✅'); } else log.push(`COMMIT → count ${n} → <b>কিছুই commit হয়নি!</b>`); } }
    if (a === 'r') { if (!n) log.push('⚠️ Error: কোনো transaction নেই'); else { log.push(`ROLLBACK → <b>সব</b> ${pending.length}টা pending বাতিল, count ${n} → 0 💥`); pending = []; n = 0; } }
    if (a === 'x') { n = 0; pending = []; committed = []; log = []; id = 1; }
    draw();
  });
  draw();
};

// ─── Ch19 ──────────────────────────────────────────────
V.stringAgg = (el) => tabs(el, ['STRING_AGG →', '← STRING_SPLIT'], k => k === 0
  ? `<div class="join3 two"><div>${tbl(['FullName', 'AccountNumber'], [['Rahim', '1001…001'], ['Rahim', '1001…002'], ['Karim', '1001…003']])}</div><div>${tbl(['FullName', 'Accounts'], [['Rahim', '1001…001, 1001…002'], ['Karim', '1001…003']])}</div></div>`
  : `<div class="join3 two"><div><pre class="code">@CsvList = '101, 102,,103'</pre></div><div>${tbl(['value (TRIM)'], [['101'], ['102'], ['103']])}<div class="muted">খালি অংশ WHERE দিয়ে বাদ</div></div></div>`);
V.datediff = (el) => el.innerHTML = `<div class="timeline yr"><div class="yrb" style="left:0;width:50%">2025</div><div class="yrb b2" style="left:50%;width:50%">2026</div><div class="tick in" style="left:49.6%"></div><div class="tick in" style="left:50.4%"></div></div><div class="callout">'2025-12-31' → '2026-01-01' = আসলে <b>১ দিন</b>, কিন্তু DATEDIFF(YEAR) = <b class="bad-t">1</b> (একটা বছর-সীমানা পার হয়েছে)। বয়স হিসাবে এটা ভুল!</div>`;
V.pivot = (el) => tabs(el, ['Rows (আগে)', 'Columns (PIVOT পরে)'], k => k === 0
  ? tbl(['BranchId', 'AccountType', 'Balance'], [[1, 'SAVINGS', '85,000'], [1, 'CURRENT', '250,000'], [2, 'SAVINGS', '4,300'], [2, 'FD', '500,000']])
  : tbl(['BranchId', 'SAVINGS', 'CURRENT', 'FD'], [[1, '85,000', '250,000', null], [2, '4,300', null, '500,000']]));

// ─── Ch20 ──────────────────────────────────────────────
V.btree = (el) => tabs(el, ['🎯 Index Seek', '🐘 Table Scan'], k => `<div class="btree ${k ? 'scan' : 'seek'}">
  <div class="lvl"><span class="pg p0">Root<br>1 … 60M</span></div>
  <div class="lvl">${['1–15M', '15–30M', '30–45M', '45–60M'].map((x, i) => `<span class="pg ${i === 1 ? 'p1' : ''}">${x}</span>`).join('')}</div>
  <div class="lvl">${['15–19M', '19–23M', '23–26M', '26–30M'].map((x, i) => `<span class="pg ${i === 2 ? 'p2' : ''}">${x}</span>`).join('')}</div>
  <div class="lvl leaf">${Array.from({ length: 24 }, (_, i) => `<span class="pg lf ${i === 9 ? 'p3' : ''}" style="animation-delay:${i * .06}s"></span>`).join('')}</div></div>
  <div class="callout">${k ? 'প্রতিটা leaf page পড়ে: <b>~800,000 page reads</b> 🐢' : 'Root → branch → leaf: শুধু <b>~4 page reads</b> ⚡ (O(log n))'}</div>`);
V.clusteredNC = (el) => el.innerHTML = `<div class="join3 two"><div><div class="cap">Clustered index = table নিজেই (AccountId দিয়ে sorted)</div>${tbl(['AccountId 🔑', 'Number', 'Balance', 'Status', '…'], [[101, '…001', '85,000', 'ACTIVE', '…'], [102, '…002', '250,000', 'ACTIVE', '…'], [103, '…003', '4,300', 'DORMANT', '…']])}</div>
<div><div class="cap">Nonclustered index (Status) — আলাদা কাঠামো</div>${tbl(['Status 🔑', '→ AccountId (pointer)'], [['ACTIVE', 101], ['ACTIVE', 102], ['DORMANT', 103]])}</div></div><div class="callout">NC index-এর প্রতিটা leaf-এ clustering key কপি হয় → তাই clustering key <b>সরু</b> হওয়া উচিত (BIGINT ৮ byte vs GUID ১৬ byte)।</div>`;
V.compositeIndex = (el) => {
  const book = [['Ahmed', 'Karim'], ['Ahmed', 'Tanvir'], ['Hossain', 'Karim'], ['Hossain', 'Nusrat'], ['Rahman', 'Ayesha'], ['Rahman', 'Karim'], ['Rahman', 'Rahim'], ['Uddin', 'Karim'], ['Uddin', 'Rahim']];
  const Q = [['WHERE LastName = \'Rahman\'', r => r[0] === 'Rahman', 1], ['WHERE LastName = \'Rahman\' AND FirstName = \'Karim\'', r => r[0] === 'Rahman' && r[1] === 'Karim', 1], ['WHERE FirstName = \'Karim\'', r => r[1] === 'Karim', 0]];
  tabs(el, ['A', 'A + B', 'শুধু B'], k => {
    const [q, f, seek] = Q[k];
    return `<div class="cap">📞 Phone book INDEX (LastName, FirstName) · <code>${q}</code></div><div class="pbook">${book.map(r => `<div class="pentry ${f(r) ? 'hit' : seek ? (r[0] === 'Rahman' ? 'near' : 'skip') : 'read'}">${r[0]}, ${r[1]}</div>`).join('')}</div>
    <div class="callout ${seek ? '' : 'bad'}">${seek ? '⚡ SEEK — সরাসরি "Rahman" অংশে লাফ, বাকি বই ছোঁয়াই হয় না' : '🐢 SCAN — Karim-রা বইয়ের সব জায়গায় ছড়ানো, পুরো বই পড়তে হয়'}</div>`;
  });
};
V.keyLookup = (el) => tabs(el, ['🔁 Key Lookup সহ', '✅ Covering (INCLUDE)'], k => `<div class="klflow"><div class="klb">NC index seek<br><small>(AccountId, TxnDate)</small></div>${k ? '<i class="arr">→</i><div class="klb good">Leaf-এ Amount, TxnType, Channel আছে ✅<br>Done!</div>' : '<i class="arr">→</i><div class="klb bad">প্রতি row-এ Clustered index-এ ফিরে যাও 🔁🔁🔁<br><small>Amount, TxnType, Channel আনতে</small></div>'}</div><div class="callout">${k ? 'INCLUDE কলাম শুধু leaf-এ থাকে — tree চওড়া হয় না, sorted না, 900-byte key limit-এ গোনা হয় না।' : '১ লাখ row = ১ লাখ random read → "tipping point"-এ optimizer হাল ছেড়ে পুরো table scan করে।'}</div>`);
V.indexCost = (el) => {
  el.innerHTML = `<label>Nonclustered index সংখ্যা: <input type="range" min="0" max="15" value="3" class="ic"> <b class="icv"></b></label><div class="icbox"></div>`;
  const draw = () => {
    const n = +el.querySelector('.ic').value; el.querySelector('.icv').textContent = n;
    el.querySelector('.icbox').innerHTML = `<div class="writes"><span class="w tbl">Table</span>${Array.from({ length: n }, (_, i) => `<span class="w">IX${i + 1}</span>`).join('')}</div><div class="callout ${n > 7 ? 'bad' : ''}">১টা INSERT = <b>${n + 1}টা write</b> · আনুমানিক throughput: <b>${Math.round(40000 / (1 + n * 0.4)).toLocaleString()} rows/s</b> ${n > 7 ? '— OLTP-তে ৫–৭টার বেশি সাধারণত ক্ষতিকর ⚠️' : ''}</div>`;
  };
  el.querySelector('.ic').oninput = draw; draw();
};

// ─── Ch21 / 22 ──────────────────────────────────────────────
V.histogram = (el) => {
  const h = [5, 8, 12, 9, 15, 22, 18, 25, 30, 27, 33, 0];
  el.innerHTML = `<div class="hist">${h.map((v, i) => `<div class="hb ${i === 11 ? 'today' : ''}" style="height:${i === 11 ? 3 : v * 3}px" title="${v}"><span>${i === 11 ? 'আজ' : 'M' + (i + 1)}</span></div>`).join('')}</div><div class="callout">Histogram গতকালেই শেষ → আজকের জন্য estimate <b>১ row</b>, আসলে আসবে <b>৪ লাখ</b> (ascending key সমস্যা)। Estimate vs actual ১০×+ হলে → আগে এটা ঠিক করো।</div>`;
};
V.estimateWrong = (el) => flipCards(el, [
  ['📉 বাসি statistics', '<code>UPDATE STATISTICS … WITH FULLSCAN</code>'], ['📦 Table variable', 'সবসময় ১ row ধরে → <b>#temp</b> ব্যবহার করো'], ['🧩 Predicate-এ scalar UDF', 'অস্বচ্ছ → নির্দিষ্ট ৩০% অনুমান। Inline TVF-এ বদলাও'],
  ['🔤 Local variable', '<code>WHERE x = @v</code> (parameter না) sniff হয় না → গড় density'], ['🔗 Multi-column correlation', "City='Dhaka' আর Type='FD' স্বাধীন ধরে গুণ করে → multi-column বা filtered statistic"], ['🧮 Column-এ expression', '<code>YEAR(TxnDate)</code>-এর histogram নেই → অনুমান। Rewrite করো'],
]);
V.planReader = (el) => el.innerHTML = `<div class="plan"><div class="op sel">SELECT</div><i class="arr">←</i><div class="op">Hash Match<br><small>Aggregate</small></div><i class="arr fat">⇐</i><div class="op">Nested Loops</div><i class="arr fat">⇐</i><div class="col2"><div class="op bad">Clustered Index Scan<br><small>est 1 · actual 4,000,000 ⚠️</small></div><div class="op warn">Key Lookup<br><small>×4,000,000</small></div></div></div><div class="callout">⬅️ ডান থেকে বামে পড়ো। মোটা তীর = অনেক row। লাল = est vs actual বিশাল পার্থক্য → সমস্যার মূল এখানে।</div>`;
V.sargGame = (el) => {
  const Q = [['YEAR(TxnDate) = 2026', 0, "TxnDate >= '2026-01-01' AND TxnDate < '2027-01-01'"], ["TxnDate >= '2026-01-01' AND TxnDate < '2027-01-01'", 1], ['Balance * 1.05 > 100000', 0, 'Balance > 100000 / 1.05'], ['Balance > 100000 / 1.05', 1],
    ["FullName LIKE '%Rahman'", 0, "FullName LIKE 'Rahman%' (বা full-text)"], ["FullName LIKE 'Rahman%'", 1], ["AccountNumber = N'1001000000001'", 0, "AccountNumber = '1001000000001'"], ["ISNULL(ClosedOn, '9999-12-31') > GETDATE()", 0, 'ClosedOn > GETDATE() OR ClosedOn IS NULL'], ['ClosedOn > GETDATE() OR ClosedOn IS NULL', 1]];
  let i = 0, score = 0;
  const draw = (fb = '') => {
    if (i >= Q.length) { el.innerHTML = `<div class="callout big">🎉 স্কোর: <b>${score} / ${Q.length}</b></div><button class="btn again">আবার খেলো</button>`; el.querySelector('.again').onclick = () => { i = 0; score = 0; draw(); }; return; }
    el.innerHTML = `<div class="muted">প্রশ্ন ${i + 1}/${Q.length} · স্কোর ${score}</div><pre class="code">WHERE ${esc(Q[i][0])}</pre><div class="row2"><button class="btn pri" data-a="1">⚡ SEEK</button><button class="btn" data-a="0">🐢 SCAN</button></div><div class="fb">${fb}</div>`;
    el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      const ok = +b.dataset.a === Q[i][1]; if (ok) score++;
      const msg = `${ok ? '✅ সঠিক!' : '❌ ভুল।'} এটা <b>${Q[i][1] ? 'SEEK' : 'SCAN'}</b>${Q[i][1] ? ' — column একা আছে' : ` — column মোড়ানো। Rewrite: <code>${esc(Q[i][2])}</code>`}`;
      i++; draw(msg);
    });
  };
  draw();
};
V.sniffing = (el) => tabs(el, ["প্রথমে 'Sylhet' (৩০০ row)", "প্রথমে 'Dhaka' (১,৮০,০০০ row)"], k => {
  const plan = k ? 'Hash Join + Scan' : 'Nested Loops + Key Lookup';
  const t = (rows) => k ? (rows < 1000 ? '45 ms (একটু বেশি, তবে ঠিক)' : '1.2 s ✅') : (rows < 1000 ? '2 ms ✅' : '38 s 💥');
  return `<div class="callout">Cached plan: <b>${plan}</b></div>${tbl(['Call', 'Rows', 'সময়'], [["EXEC … 'Sylhet'", 300, t(300)], ["EXEC … 'Dhaka'", '180,000', t(180000)]])}<div class="muted">প্রথম call যা পায়, সবাই সেই plan পায়। Fix: RECOMPILE · OPTIMIZE FOR · OPTIMIZE FOR UNKNOWN · procedure split · Query Store force plan।</div>`;
});

// ─── Ch23 / 24 / 25 ──────────────────────────────────────────────
V.caseStudies = (el) => flipCards(el, [
  ['📅 Case 1: Date function scan<br><small>Report ৪ মিনিট, ৮,১২,০০০ reads</small>', 'রোগ: <code>YEAR(TxnDate)</code> column মুড়েছে। ওষুধ: half-open range + (TxnDate) INCLUDE index → <b>২ সেকেন্ড</b>'],
  ['🔂 Case 2: SELECT-এ correlated subquery<br><small>৯০ সেকেন্ড</small>', 'রোগ: ৭.৫ লাখ subquery execution। ওষুধ: CTE-তে একবার aggregate + LEFT JOIN + COALESCE → <b>৩ সেকেন্ড</b>'],
  ['🔀 Case 3: Implicit conversion<br><small>Login lookup ৮০০ms</small>', 'রোগ: AddWithValue → NVARCHAR vs VARCHAR column। ওষুধ: <code>SqlDbType.VarChar, 20</code> → <b>১ms</b>'],
  ['🔁 Case 4: N+1 endpoint<br><small>৬ সেকেন্ড, সবচেয়ে slow query ০.৪ms</small>', 'রোগ: ৩০০০ query (lazy loading)। ওষুধ: projection / .Include()। <b>Query গোনো!</b>'],
  ['📄 Case 5: OFFSET death march<br><small>Page ৪০০০ = ১২ সেকেন্ড</small>', 'রোগ: ৭৯,৯৮০ row পড়ে ফেলে দেয়। ওষুধ: keyset pagination — আর export বাটন দাও'],
  ['🗃️ Case 6: Over-indexed table<br><small>Insert ৪০k → ৬k rows/s</small>', 'রোগ: ১৪ index, ৯টা কেউ পড়ে না। ওষুধ: ৯টা drop, ৩টা merge → <b>৩৮k rows/s</b>'],
]);
V.tuningSteps = (el) => stepper(el, 7, i => {
  const S = [['📏 মাপো', 'Query Store / sys.dm_exec_query_stats — অনুমান কোরো না'], ['🗺️ Actual plan', 'STATISTICS IO, TIME ON'], ['⚖️ Est vs Actual', 'আলাদা? আগে estimate ঠিক করো'], ['🔍 বড় তিন', 'Column-এ function · Missing index · RBAR'], ['🔧 একটা বদল', 'আবার মাপো — দুটো একসাথে বদলালে কিছুই শেখো না'], ['✅ যাচাই', 'EXCEPT দুই দিকে = ০ row'], ['📝 লিখে রাখো', 'OPTION (RECOMPILE) ইচ্ছাকৃত — পরের engineer জানুক']];
  return `<div class="pipeline">${S.map((s, k) => `<div class="pipe ${k < i ? 'done' : ''} ${k === i ? 'cur' : ''}"><b>${k + 1}</b><span>${s[0]}</span></div>`).join('')}</div><div class="callout big">${S[i][0]}<br>${S[i][1]}</div>`;
});
V.normalForms = (el) => stepper(el, 4, i => [
  `<div class="cap">❌ Unnormalized</div>` + tbl(['AccountId', 'Customer', 'Phones', 'BranchId', 'BranchCity'], [[101, 'Rahim', '017…, 018…', 1, 'Dhaka'], [102, 'Rahim', '017…, 018…', 1, 'Dhaka']]),
  `<div class="cap">1NF: Phones-এ একাধিক value → আলাদা table</div>` + tbl(['CustomerId', 'Phone'], [[1, '017…'], [1, '018…']]),
  `<div class="cap">3NF: BranchCity নির্ভর করে BranchId-এর উপর, AccountId না → Branches table-এ সরাও</div>` + `<div class="join3 two"><div>${tbl(['AccountId', 'CustomerId', 'BranchId'], [[101, 1, 1], [102, 1, 1]])}</div><div>${tbl(['BranchId', 'City'], [[1, 'Dhaka']])}</div></div>`,
  `<div class="callout big">⚖️ The key, the whole key, and nothing but the key ✅</div>`][i]);
V.antiPatterns = (el) => flipCards(el, [
  ['🧟 Entity-Attribute-Value', 'Type, constraint, FK, index কিছুই নেই; প্রতি attribute-এ self-join। ✅ Column বানাও, বা JSON + computed index'],
  ['📝 Column-এ comma list', "'1001,1002' → 1NF ভাঙে, index/FK অসম্ভব, LIKE '%1002%' '11002'-ও মেলে। ✅ Junction table"],
  ['🦎 Polymorphic (OwnerId + OwnerType)', 'FK enforce অসম্ভব → orphan নিশ্চিত। ✅ দুটো nullable FK + CHECK একটাই populated'],
  ['🐘 God table', '৯০ কলাম, অর্ধেক NULL। "প্রযোজ্য না" NULL = একটা হারানো table। ✅ ভেঙে আলাদা entity'],
  ['💸 FLOAT টাকা, string তারিখ', "'16/07/2026' sort/range হয় না, '07/16'-এর সাথে বিভ্রান্তি। ✅ DECIMAL, DATE"],
  ['🔓 "Performance-এর জন্য" FK নেই', 'লাভ নগণ্য; orphan row আর optimizer তথ্য হারায়। ✅ FK সবসময় — এটা কখনো পুরনো না হওয়া documentation'],
]);
V.interviewCards = (el) => flipCards(el, INTERVIEW_QA, 'wide');
