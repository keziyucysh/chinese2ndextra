/* 搶救國文大作戰 — 介面程式。題庫在 data.js，此檔只負責解析、出題與畫面。 */
(function () {
'use strict';

/* ---------- 工具 ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const uniq = a => [...new Set(a)];
const lines = t => t.split('\n').map(s => s.trim()).filter(Boolean);
const chars = s => Array.from(s);

function splitMeta(line) {
  const parts = line.split(/\s+(?=[@^!?]\S)/);
  const main = parts.shift().trim();
  const meta = { tags: [], notes: [], flag: '', hard: false };
  for (const p of parts) {
    const c = p[0], v = p.slice(1).trim();
    if (c === '@') meta.tags.push(v);
    else if (c === '^') meta.notes.push(v);
    else if (c === '?') meta.flag = v;
    else if (c === '!') { meta.flag = v; meta.hard = true; }
  }
  return [main, meta];
}
// 把詞中指定的字包上標色
function hl(word, cs, cls) {
  const set = new Set(cs);
  return chars(word).map(ch => set.has(ch) ? `<b class="${cls || 'hl'}">${esc(ch)}</b>` : esc(ch)).join('');
}
// 模組 1 詞語：含講義注音（ruby）；mode 'hl' 標色易錯字，'blank' 挖空易錯字（挖空的字不顯示注音）
function rw(s, mode) {
  return s.z.map(([ch, zy]) => {
    const isC = ch === s.c;
    if (mode === 'blank' && isC) return '<span class="blank">□</span>';
    const inner = (mode === 'hl' && isC) ? `<b class="hl">${esc(ch)}</b>` : esc(ch);
    return zy ? `<ruby>${inner}<rt>${esc(zy)}</rt></ruby>` : inner;
  }).join('');
}
const blankWord = (w, c) => chars(w).map(ch => ch === c ? '<span class="blank">□</span>' : esc(ch)).join('');

/* ---------- 解析題庫 ---------- */
const MODS = [
  { id: 1, key: 'm1', name: '字形辨識', desc: '形近字、音近字成對比較', pages: '講義 p.21–24' },
  { id: 2, key: 'm2', name: '字音填字', desc: '看注音，填出正確的字', pages: '講義 p.31–35' },
  { id: 3, key: 'm3', name: '字根讀音', desc: '同聲符的字怎麼念', pages: '講義 p.43–48' },
  { id: 4, key: 'm4', name: '一詞多義', desc: '從例句判斷詞義', pages: '講義 p.109–113' },
  { id: 5, key: 'm5', name: '成語古今義', desc: '原義與後來的意義', pages: '講義 p.125–127' }
];
const ITEMS = [];
const byId = {};
function add(it) { ITEMS.push(it); byId[it.id] = it; }

function parseAll(B) {
  // 模組 1
  let g = '', sub = '', n = 0;
  for (const raw of lines(B.m1)) {
    if (raw.startsWith('==')) { g = raw.slice(2).trim(); continue; }
    if (raw.startsWith('--')) { sub = raw.slice(2).trim(); n = 0; continue; }
    const [main, meta] = splitMeta(raw); n++;
    const [a, b] = main.split(/\s*;\s*/).map(s => {
      const [raw, c, m] = s.split('|').map(x => (x || '').trim());
      const alts = c.split('/');
      // 「字{注音}」：講義原檔在該字旁加注的注音
      const parts = [...raw.matchAll(/(.)(?:\{([^}]+)\})?/gu)].map(x => [x[1], x[2] || '']);
      return { w: parts.map(p => p[0]).join(''), z: parts, c: alts[0], alts, m: m || '' };
    });
    add(Object.assign({ id: `1-${g}-${sub}-${n}`, mod: 1, group: g, sub: sub === '1' ? '因形似而誤寫' : '因音同或音近而誤寫', a, b,
      text: [a.w, a.m, b.w, b.m].join(' ') }, meta));
  }
  // 模組 2
  g = ''; sub = ''; n = 0;
  for (const raw of lines(B.m2)) {
    if (raw.startsWith('==')) { g = raw.slice(2).trim(); continue; }
    if (raw.startsWith('--')) { sub = raw.slice(2).trim(); n = 0; continue; }
    const [q, meta] = splitMeta(raw); n++;
    const m = q.match(/（([^）]+)）/);
    const alts = m ? m[1].split('／') : [''];
    const full = q.replace(/（([^）]+)）/g, (_, x) => x.split('／')[0]);
    add(Object.assign({ id: `2-${g}-${sub}-${n}`, mod: 2, group: g, zy: sub, q, alts, ans: alts[0], full,
      text: [full, q, sub].join(' ') }, meta));
  }
  // 模組 3
  g = ''; let root = '', rootChars = '', ri = 0;
  for (const raw of lines(B.m3)) {
    if (raw.startsWith('==')) { g = raw.slice(2).trim().replace('音', ''); continue; }
    if (raw.startsWith('##')) { [root, rootChars] = raw.slice(2).split('|').map(s => s.trim()); ri = 0; continue; }
    const [main, meta] = splitMeta(raw); ri++;
    const [zy, w, c, m] = main.split('|').map(s => s.trim());
    add(Object.assign({ id: `3-${root}-${ri}`, mod: 3, group: g, root, rootChars, zy, w, c, m,
      text: [w, c, m, zy, root].join(' ') }, meta));
  }
  // 模組 4
  let word = null, wmeta = null, sense = '', ei = 0;
  for (const raw of lines(B.m4)) {
    if (raw.startsWith('##')) { [word, wmeta] = splitMeta(raw.slice(2).trim()); ei = 0; continue; }
    if (raw.startsWith('*')) { sense = raw.slice(1).trim(); continue; }
    if (raw.startsWith('>')) {
      const [main, meta] = splitMeta(raw.slice(1).trim()); ei++;
      const [s, src, tr] = main.split('|').map(x => x.trim());
      add({ id: `4-${word}-${ei}`, mod: 4, group: '', word, sense, s, src, tr,
        tags: wmeta.tags.slice(), notes: meta.notes, flag: meta.flag, hard: meta.hard,
        text: [word, sense, s, src, tr].join(' ') });
    }
  }
  // 模組 5
  for (const raw of lines(B.m5)) {
    const [main, meta] = splitMeta(raw);
    const [num, idiom, ...ms] = main.split('|').map(s => s.trim());
    add(Object.assign({ id: `5-${num}`, mod: 5, group: '', num, idiom, orig: ms[0], later: ms.slice(1).filter(Boolean),
      text: [idiom, ...ms].join(' ') }, meta));
  }
}

const GROUP_ORDER = ['ㄍ', 'ㄎ', 'ㄏ', 'ㄐ', 'ㄑ', 'ㄒ', 'ㄓ', 'ㄔ'];
const modItems = id => ITEMS.filter(i => i.mod === id);
// 每個模組的「組」：模組 1–3 依注音，模組 4 依詞語，模組 5 每 8 則一組（依編號）
function unitOf(it) {
  if (it.mod <= 3) return it.group;
  if (it.mod === 4) return it.word;
  const n = +it.num, a = 33 + Math.floor((n - 33) / 8) * 8;
  return `${a}–${a + 7}`;
}
const unitsOf = id => {
  const u = uniq(modItems(id).map(unitOf)).filter(Boolean);
  return id <= 3 ? u.sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b)) : u;
};
const groupsOf = id => uniq(modItems(id).map(i => i.group)).filter(Boolean).sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b));

/* ---------- 出題 ---------- */
function pick(correct, pools, n, exclude) {
  const seen = new Set([correct].concat(exclude || []));
  const out = [];
  for (const pool of pools) {
    for (const x of shuffle(pool.slice())) {
      if (out.length >= n) return out;
      if (!x || seen.has(x)) continue;
      seen.add(x); out.push(x);
    }
  }
  return out;
}
function makeQ(it) {
  let ask = '', prompt = '', correct = '', ds = [], explain = '', optCls = '';
  if (it.mod === 1) {
    const side = Math.random() < 0.5 ? 'a' : 'b';
    const s = it[side], o = it[side === 'a' ? 'b' : 'a'];
    const grp = ITEMS.filter(x => x.mod === 1 && x.group === it.group).flatMap(x => [x.a.c, x.b.c]);
    const all = ITEMS.filter(x => x.mod === 1).flatMap(x => [x.a.c, x.b.c]);
    correct = s.c; ds = pick(correct, [[o.c], grp, all], 3, s.alts);
    ask = '選出 □ 中正確的字';
    prompt = `<div class="q-word kai">${rw(s, 'blank')}</div>${s.m ? `<div class="q-hint">字義：${esc(s.m)}</div>` : ''}`;
    optCls = 'opt-char kai';
    explain = m1Pair(it, true);
  } else if (it.mod === 2) {
    const len = chars(it.ans).length;
    const fit = x => { const c = chars(x); return c.length === len ? x : (len > 1 && c.length === 1 ? x.repeat(len) : null); };
    const grp = ITEMS.filter(x => x.mod === 2 && x.group === it.group && !x.alts.some(a => it.alts.includes(a))).map(x => fit(x.ans));
    const all = ITEMS.filter(x => x.mod === 2 && !x.alts.some(a => it.alts.includes(a))).map(x => fit(x.ans));
    correct = it.ans; ds = pick(correct, [grp, all], 3, it.alts);
    ask = '依注音選出正確的字';
    prompt = `<div class="q-zy zy">${esc(it.zy)}</div><div class="q-word kai">${m2Blank(it.q)}</div>`;
    optCls = 'opt-char kai';
    explain = `<div class="ex-word kai">${m2Full(it)}</div>` + (it.alts.length > 1 ? `<p>可接受寫法：${it.alts.map(esc).join('、')}</p>` : '');
  } else if (it.mod === 3) {
    const grp = ITEMS.filter(x => x.mod === 3 && x.root === it.root).map(x => x.zy);
    const sec = ITEMS.filter(x => x.mod === 3 && x.group === it.group).map(x => x.zy);
    const all = ITEMS.filter(x => x.mod === 3).map(x => x.zy);
    correct = it.zy; ds = pick(correct, [grp, sec, all], 3);
    ask = `「${esc(it.c)}」在這個詞裡怎麼念？`;
    prompt = `<div class="q-word kai">${hl(it.w, [it.c])}</div><div class="q-hint">聲符「${esc(it.root)}」</div>`;
    optCls = 'opt-zy zy';
    explain = `<p><b class="hl kai">${esc(it.c)}</b> <span class="zy">${esc(it.zy)}</span>：${esc(it.m)}</p><p class="muted">同組：${esc(it.rootChars)}</p>`;
  } else if (it.mod === 4) {
    const same = ITEMS.filter(x => x.mod === 4 && x.word === it.word).map(x => x.sense);
    const all = ITEMS.filter(x => x.mod === 4).map(x => x.sense);
    correct = it.sense; ds = pick(correct, [same, all], 3);
    ask = `「${esc(it.word)}」在句中的意思是？`;
    prompt = `<div class="q-sent kai">${m4Sent(it)}</div><div class="q-src">${esc(it.src)}</div>`;
    optCls = 'opt-text';
    explain = `<p><b>${esc(it.word)}</b>：${esc(it.sense)}</p><p class="muted">${esc(it.tr)}</p>`;
  } else {
    const later = it.later.length && Math.random() < 0.5;
    if (later) {
      correct = it.later[Math.floor(Math.random() * it.later.length)];
      ds = pick(correct, [ITEMS.filter(x => x.mod === 5 && x !== it).flatMap(x => x.later)], 3, it.later.concat(it.orig));
      ask = `「${esc(it.idiom)}」後來的意義是？`;
    } else {
      correct = it.orig;
      ds = pick(correct, [ITEMS.filter(x => x.mod === 5 && x !== it).map(x => x.orig)], 3, it.later);
      ask = `「${esc(it.idiom)}」的原義是？`;
    }
    prompt = `<div class="q-word kai">${esc(it.idiom)}</div>`;
    optCls = 'opt-text';
    explain = m5Meanings(it);
  }
  const options = shuffle([correct].concat(ds));
  return { it, ask, prompt, options, answer: options.indexOf(correct), explain, optCls };
}

/* ---------- 各模組的呈現片段 ---------- */
function tagsHtml(it) {
  return (it.tags || []).map(t => `<span class="tag ${t[0] === '指' ? 'tag-z' : 'tag-x'}">${esc(t)}</span>`).join('')
    + (it.flag ? `<span class="tag tag-flag">待確認</span>` : '');
}
function notesHtml(it) {
  return (it.notes || []).map(n => `<p class="note">${esc(n)}</p>`).join('')
    + (it.flag ? `<p class="flagnote"><b>待確認：</b>${esc(it.flag)}${it.hard ? '（暫不出題）' : ''}</p>` : '');
}
function m1Pair(it, withMeaning) {
  const one = s => `<div class="pair-row"><span class="kai pw">${rw(s, 'hl')}</span>${withMeaning ? `<span class="pm">${s.m ? `（${esc(s.m)}）` : ''}</span>` : ''}</div>`;
  return one(it.a) + one(it.b);
}
const m2Blank = q => esc(q).replace(/（([^）]+)）/g, (_, x) => `（<span class="blank">${'□'.repeat(chars(x.split('／')[0]).length)}</span>）`);
const m2Full = it => esc(it.q).replace(/（([^）]+)）/g, (_, x) => `（<b class="hl">${x}</b>）`);
function m4Sent(it) {
  const parts = it.s.split(it.word);
  return parts.map(esc).join(`<b class="hl">${esc(it.word)}</b>`);
}
function m5Meanings(it) {
  const labels = ['原義', '後來的意義', '另一義'];
  return [it.orig].concat(it.later).map((m, i) => `<div class="mean"><span class="mean-l">${i === 0 ? labels[0] : (i === 1 ? labels[1] : labels[2])}</span><span>${esc(m)}</span></div>`).join('');
}

/* ---------- 學習紀錄（存在裝置上） ---------- */
const KEY = 'zhuyin-review-v1';
let S = { known: {}, done: {}, wrong: {}, gs: {}, font: 1, theme: 'system' };
function load() { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v) S = Object.assign(S, v); } catch (e) {} }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
function record(it, ok) {
  if (ok) {
    S.done[it.id] = 1;
    const w = S.wrong[it.id];
    if (w) { w.s = (w.s || 0) + 1; if (w.s >= 2) delete S.wrong[it.id]; }
  } else {
    const w = S.wrong[it.id] || { s: 0, n: 0 };
    w.s = 0; w.n++; S.wrong[it.id] = w;
  }
  save();
}
const gKey = (mod, u) => `${mod}|${u}`;
const gStat = (mod, u) => S.gs[gKey(mod, u)];          // 1 已熟悉、0 待加強、undefined 未標記
// 2 考前再看一次
const statCls = v => v === 1 ? 'st-ok' : v === 0 ? 'st-weak' : v === 2 ? 'st-rev' : 'st-none';
const statTxt = v => v === 1 ? '已熟悉' : v === 0 ? '待加強' : v === 2 ? '考前再看一次' : '未標記';
function tally(mod) {
  const vals = unitsOf(mod).map(u => gStat(mod, u));
  return { n: vals.length, ok: vals.filter(v => v === 1).length, weak: vals.filter(v => v === 0).length, rev: vals.filter(v => v === 2).length };
}
const doneCount = id => modItems(id).filter(i => S.done[i.id] || S.known[i.id] === 1).length;

/* ---------- 給 Node 測試用 ---------- */
if (typeof module !== 'undefined') module.exports = { parseAll, ITEMS, makeQ, MODS, groupsOf, unitsOf, unitOf };
if (typeof document === 'undefined') return;

/* ================= 畫面 ================= */
const $ = s => document.querySelector(s);
const view = $('#view'), top = $('#topbar');
let stack = [];
const R = {};

function go(name, arg, replace) {
  if (arg === undefined) arg = {};
  if (replace) stack.pop();
  stack.push([name, arg]);
  render();
}
function back() { if (stack.length > 1) { stack.pop(); render(); } }
function render() {
  const [name, arg] = stack[stack.length - 1];
  const out = R[name](arg) || {};
  top.innerHTML = `${stack.length > 1 ? '<button class="iconbtn" id="backBtn" aria-label="返回">‹</button>' : '<span class="brand-dot" aria-hidden="true">國</span>'}<h1 class="kai">${esc(out.title || '搶救國文大作戰')}</h1>`;
  if (stack.length > 1) $('#backBtn').onclick = back;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === (out.tab || '')));
  window.scrollTo(0, 0);
  if (out.after) out.after();
}
function applySettings() {
  document.documentElement.style.setProperty('--scale', [0.9, 1, 1.12, 1.26][S.font] || 1);
  if (S.theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', S.theme);
}

/* ---- 首頁 ---- */
R.home = () => {
  const total = ITEMS.length, wrongN = Object.keys(S.wrong).length;
  const examN = ITEMS.filter(i => i.tags.length).length;
  const flagN = ITEMS.filter(i => i.flag).length;
  view.innerHTML = `
  <section class="hero">
    <h2 class="hero-title kai">搶救國文加考大作戰</h2>
    <p class="hero-date">加考時間：2026年11月23日</p>
    <div class="countdown" id="countdown" aria-live="off">${countdownHtml()}</div>
    <div class="hero-stats">
      <div><span class="num">${total}</span><span>題</span></div>
      <div><span class="num">${examN}</span><span>歷屆考題</span></div>
      <button class="stat-btn" id="toWrong"><span class="num">${wrongN}</span><span>錯題</span></button>
    </div>
    ${overviewHtml()}
    <button class="btn primary wide" id="mixQuiz">開始綜合測驗</button>
  </section>
  <div class="mods">${MODS.map(m => {
    const t = modItems(m.id).length, d = doneCount(m.id), p = t ? Math.round(d / t * 100) : 0;
    return `<article class="mod">
      <div class="mod-head"><span class="mod-no">${m.id}</span><div><h2 class="kai">${m.name}</h2><p>${m.desc}・${m.pages}</p></div></div>
      <div class="bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></div>
      <p class="mod-count"><span>已完成 ${d} / ${t} 題</span><span>${p}%</span></p>
      ${unitBlock(m.id)}
      <div class="mod-actions">
        <button class="btn" data-a="browse" data-m="${m.id}">瀏覽</button>
        <button class="btn" data-a="flash" data-m="${m.id}">單字卡</button>
        <button class="btn primary" data-a="quiz" data-m="${m.id}">測驗</button>
      </div></article>`;
  }).join('')}</div>
  ${flagN ? `<button class="pending-link" id="toPending"><b>${flagN}</b> 題掃描字跡待確認，點此逐一核對</button>` : ''}
  <p class="foot muted">完成＝單字卡標為「已熟悉」或測驗答對過。學習紀錄只存在這台裝置。</p>`;
  view.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    const m = +b.dataset.m, a = b.dataset.a;
    if (a === 'browse') go('browse', { mod: m });
    else go('setup', { mode: a, mods: [m] });
  });
  view.querySelectorAll('[data-um]').forEach(b => b.onclick = () => go('browse', { mod: +b.dataset.um, g: b.dataset.u }));
  $('#mixQuiz').onclick = () => go('setup', { mode: 'quiz', mods: [1, 2, 3, 4, 5] });
  $('#toWrong').onclick = () => go('wrong');
  if ($('#toPending')) $('#toPending').onclick = () => go('pending');
  return { title: '搶救國文大作戰', tab: 'home' };
};
const EXAM = new Date('2026-11-23T00:00:00+08:00');
function countdownHtml() {
  const ms = EXAM - Date.now();
  if (ms <= 0) return '<p class="cd-done kai">加考日到了，加油！</p>';
  const sec = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mi = m % 60;
  const box = (n, u) => `<div class="cd-box"><span class="cd-num">${String(n).padStart(2, '0')}</span><span class="cd-u">${u}</span></div>`;
  return `<span class="cd-label">倒數</span>${box(d, '天')}${box(h, '時')}${box(mi, '分')}${box(sec, '秒')}`;
}
setInterval(() => { const el = document.getElementById('countdown'); if (el) el.innerHTML = countdownHtml(); }, 1000);
function overviewHtml() {
  const t = { n: 0, ok: 0, weak: 0, rev: 0 };
  MODS.forEach(m => { const x = tally(m.id); for (const k in t) t[k] += x[k]; });
  const none = t.n - t.ok - t.weak - t.rev;
  const qd = MODS.reduce((a, m) => a + doneCount(m.id), 0), qt = ITEMS.length, qp = Math.round(qd / qt * 100);
  const gp = Math.round((t.ok + t.rev) / t.n * 100);
  const seg = (v, c) => v ? `<i class="${c}" style="flex:${v}"></i>` : '';
  return `<section class="overview" aria-label="總覽">
    <div class="ov-head"><h2>總覽</h2><p>已讀 <b>${gp}%</b><span class="ov-note">（已熟悉＋考前再看一次，${t.ok + t.rev} / ${t.n} 組）</span></p></div>
    <div class="stack" role="img" aria-label="已熟悉 ${t.ok} 組，考前再看一次 ${t.rev} 組，待加強 ${t.weak} 組，未標記 ${none} 組">${seg(t.ok, 'st-ok')}${seg(t.rev, 'st-rev')}${seg(t.weak, 'st-weak')}${seg(none, 'st-none')}</div>
    <div class="ov-legend">
      <span><i class="dot st-ok"></i>已熟悉 <b>${t.ok}</b></span>
      <span><i class="dot st-rev"></i>考前再看一次 <b>${t.rev}</b></span>
      <span><i class="dot st-weak"></i>待加強 <b>${t.weak}</b></span>
      <span><i class="dot st-none"></i>未標記 <b>${none}</b></span>
    </div>
    <p class="ov-q">題目完成 <b>${qd}</b> / ${qt}（${qp}%）・共 ${t.n} 組</p>
  </section>`;
}
function unitBlock(mod) {
  const us = unitsOf(mod), vals = us.map(u => gStat(mod, u));
  const { ok, weak, rev } = tally(mod);
  const label = mod <= 3 ? '各注音組' : mod === 4 ? '各詞語' : '各編號組';
  return `<div class="units">
    <p class="units-sum"><span>${label}</span><span><b class="c-ok">已熟悉 ${ok}</b>・<b class="c-rev">考前再看 ${rev}</b>・<b class="c-weak">待加強 ${weak}</b>・未標記 ${us.length - ok - weak - rev}</span></p>
    <div class="unit-chips">${us.map((u, k) => `<button class="uchip ${statCls(vals[k])}" data-um="${mod}" data-u="${esc(u)}" aria-label="${esc(u)}：${statTxt(vals[k])}">${esc(u)}</button>`).join('')}</div>
  </div>`;
}

/* ---- 瀏覽 ---- */
function itemCard(it, open) {
  let head = '', body = '';
  if (it.mod === 1) {
    head = `<div class="pair-head kai">${rw(it.a, 'hl')}<span class="sep">／</span>${rw(it.b, 'hl')}</div>`;
    body = m1Pair(it, true);
  } else if (it.mod === 2) {
    head = `<div class="row2"><span class="kai big">${m2Full(it)}</span></div>`;
    body = it.alts.length > 1 ? `<p>可接受寫法：${it.alts.map(esc).join('、')}</p>` : '';
  } else if (it.mod === 3) {
    head = `<div class="row3"><span class="zy zyc">${esc(it.zy)}</span><span class="kai big">${hl(it.w, [it.c])}</span></div>`;
    body = `<p>${esc(it.m)}</p>`;
  } else if (it.mod === 4) {
    head = `<div><span class="sense">${esc(it.sense)}</span><p class="kai sent">${m4Sent(it)}</p></div>`;
    body = `<p class="q-src">${esc(it.src)}</p><p>${esc(it.tr)}</p>`;
  } else {
    head = `<div class="row3"><span class="num-s">${esc(it.num)}</span><span class="kai big">${esc(it.idiom)}</span></div>`;
    body = m5Meanings(it);
  }
  body += notesHtml(it);
  const hasBody = body.trim().length > 0;
  return `<details class="card${it.flag ? ' flagged' : ''}" ${open ? 'open' : ''}><summary>${head}<span class="tags">${tagsHtml(it)}</span>${hasBody ? '<span class="chev" aria-hidden="true">⌄</span>' : ''}</summary>${hasBody ? `<div class="card-body">${body}</div>` : ''}</details>`;
}
R.browse = (st) => {
  const m = MODS[st.mod - 1];
  const groups = unitsOf(st.mod);
  if (!groups.includes(st.g)) st.g = groups[0] || '';
  const exam = !!st.exam;
  let list = modItems(st.mod).filter(i => unitOf(i) === st.g && (!exam || i.tags.length));
  const cur = gStat(st.mod, st.g);
  let html = `<div class="filters"><div class="chips" role="tablist">${groups.map(g => `<button class="chip${g === st.g ? ' on' : ''}" data-g="${esc(g)}"><i class="dot ${statCls(gStat(st.mod, g))}"></i>${esc(g)}</button>`).join('')}</div>
    <label class="switch"><input type="checkbox" id="examOnly" ${exam ? 'checked' : ''}><span>只看歷屆考題</span></label></div>
    <div class="gmark"><p><b class="kai">${esc(st.g)}</b> 這一組讀得如何？</p>
      <div class="gbtns"><button class="btn mark-known${cur === 1 ? ' on' : ''}" id="gKnown">已熟悉</button><button class="btn mark-rev${cur === 2 ? ' on' : ''}" id="gRev">考前再看一次</button><button class="btn mark-weak${cur === 0 ? ' on' : ''}" id="gWeak">待加強</button></div></div>`;
  if (!list.length) html += `<p class="empty">這一組沒有歷屆考題。</p>`;
  if (st.mod === 1) {
    for (const s of ['因形似而誤寫', '因音同或音近而誤寫']) {
      const l = list.filter(i => i.sub === s);
      if (l.length) html += `<h3 class="sub">${s}的錯別字</h3>` + l.map(i => itemCard(i)).join('');
    }
  } else if (st.mod === 2) {
    for (const z of uniq(list.map(i => i.zy))) html += `<h3 class="sub zy">${esc(z)}</h3>` + list.filter(i => i.zy === z).map(i => itemCard(i)).join('');
  } else if (st.mod === 3) {
    for (const r of uniq(list.map(i => i.root))) {
      const l = list.filter(i => i.root === r);
      html += `<h3 class="sub"><span class="kai rootc">${esc(r)}</span><span class="muted">${esc(l[0].rootChars)}</span></h3>` + l.map(i => itemCard(i)).join('');
    }
  } else if (st.mod === 4) {
    for (const w of uniq(list.map(i => i.word))) {
      const l = list.filter(i => i.word === w);
      html += `<h3 class="sub"><span class="kai rootc">${esc(w)}</span>${tagsHtml({ tags: l[0].tags })}</h3>` + l.map(i => itemCard(i)).join('');
    }
  } else html += list.map(i => itemCard(i)).join('');
  view.innerHTML = html;
  view.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { st.g = b.dataset.g; render(); });
  $('#examOnly').onchange = e => { st.exam = e.target.checked; render(); };
  const setG = v => { const k = gKey(st.mod, st.g); if (S.gs[k] === v) delete S.gs[k]; else S.gs[k] = v; save(); const y = window.scrollY; render(); window.scrollTo(0, y); };
  $('#gKnown').onclick = () => setG(1);
  $('#gWeak').onclick = () => setG(0);
  $('#gRev').onclick = () => setG(2);
  return { title: m.name };
};

/* ---- 範圍設定（測驗／單字卡共用） ---- */
R.setup = (st) => {
  st.mods = st.mods || [1];
  st.groups = st.groups || [];
  st.n = st.n || (st.mode === 'quiz' ? 10 : 0);
  const usesGroups = st.mods.some(m => m <= 3);
  const allGroups = uniq(st.mods.filter(m => m <= 3).flatMap(groupsOf)).sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b));
  const pool = poolFor(st);
  const counts = st.mode === 'quiz' ? [10, 20, 30] : [0, 20, 50];
  view.innerHTML = `
  <div class="setup">
    <fieldset><legend>模組</legend><div class="chips wrap">${MODS.map(m => `<button class="chip${st.mods.includes(m.id) ? ' on' : ''}" data-m="${m.id}">${m.name}</button>`).join('')}</div></fieldset>
    ${usesGroups ? `<fieldset><legend>注音組別 <span class="muted">（模組 1–3，不選＝全部）</span></legend><div class="chips wrap">${allGroups.map(g => `<button class="chip${st.groups.includes(g) ? ' on' : ''}" data-g="${g}">${g}</button>`).join('')}</div></fieldset>` : ''}
    <fieldset><legend>${st.mode === 'quiz' ? '題數' : '張數'}</legend><div class="chips">${counts.map(c => `<button class="chip${st.n === c ? ' on' : ''}" data-n="${c}">${c || '全部'}</button>`).join('')}</div></fieldset>
    <label class="switch"><input type="checkbox" id="examOnly" ${st.exam ? 'checked' : ''}><span>只考歷屆考題</span></label>
    <fieldset><legend>依組別標記</legend><div class="chips wrap">${[['', '全部'], ['0', '待加強'], ['2', '考前再看一次']].map(([v, t]) => `<button class="chip${(st.gf || '') === v ? ' on' : ''}" data-gf="${v}">${t}</button>`).join('')}</div></fieldset>
    ${st.mode === 'flash' ? `<label class="switch"><input type="checkbox" id="weakOnly" ${st.weak ? 'checked' : ''}><span>略過已熟悉的</span></label>` : ''}
    <p class="pool">符合條件：<b>${pool.length}</b> 題${pool.length && st.n && pool.length < st.n ? `（不足 ${st.n} 題，將全部出完）` : ''}</p>
    <button class="btn primary wide" id="start" ${pool.length ? '' : 'disabled'}>${st.mode === 'quiz' ? '開始測驗' : '開始翻卡'}</button>
  </div>`;
  view.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    const m = +b.dataset.m;
    st.mods = st.mods.includes(m) ? st.mods.filter(x => x !== m) : st.mods.concat(m).sort();
    if (!st.mods.length) st.mods = [m];
    render();
  });
  view.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
    const g = b.dataset.g; st.groups = st.groups.includes(g) ? st.groups.filter(x => x !== g) : st.groups.concat(g); render();
  });
  view.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { st.n = +b.dataset.n; render(); });
  $('#examOnly').onchange = e => { st.exam = e.target.checked; render(); };
  view.querySelectorAll('[data-gf]').forEach(b => b.onclick = () => { st.gf = b.dataset.gf; render(); });
  if ($('#weakOnly')) $('#weakOnly').onchange = e => { st.weak = e.target.checked; render(); };
  $('#start').onclick = () => {
    const items = shuffle(pool.slice()).slice(0, st.n || pool.length);
    if (st.mode === 'quiz') go('quiz', { items, i: 0, qs: items.map(makeQ), res: [], from: st });
    else go('flash', { items, i: 0, flip: false });
  };
  return { title: st.mode === 'quiz' ? '測驗範圍' : '單字卡範圍', tab: st.mode === 'quiz' && st.mods.length === 5 ? 'quiz' : '' };
};
function poolFor(st) {
  return ITEMS.filter(i => st.mods.includes(i.mod)
    && !(st.mode === 'quiz' && i.hard)
    && (!st.groups.length || i.mod > 3 || st.groups.includes(i.group))
    && (!st.exam || i.tags.length)
    && (!st.weak || S.known[i.id] !== 1)
    && (!st.gf || gStat(i.mod, unitOf(i)) === +st.gf));
}

/* ---- 測驗 ---- */
R.quiz = (st) => {
  const q = st.qs[st.i], total = st.qs.length, answered = st.res.length > st.i;
  const pick = answered ? st.res[st.i].pick : -1;
  view.innerHTML = `
  <div class="qtop"><span class="tabnum">${st.i + 1} / ${total}</span><div class="bar slim"><i style="width:${(st.i + (answered ? 1 : 0)) / total * 100}%"></i></div><span class="modlabel">${MODS[q.it.mod - 1].name}</span></div>
  <section class="qcard">
    <p class="ask">${q.ask}</p>
    ${q.prompt}
    <span class="tags">${tagsHtml(Object.assign({}, q.it, { flag: '' }))}</span>
  </section>
  <div class="opts">${q.options.map((o, k) => {
    let cls = 'opt ' + q.optCls;
    if (answered) cls += k === q.answer ? ' right' : (k === pick ? ' wrong' : ' dim');
    return `<button class="${cls}" data-k="${k}" ${answered ? 'disabled' : ''}><span class="okey">${'ABCD'[k]}</span><span class="otext">${esc(o)}</span></button>`;
  }).join('')}</div>
  ${answered ? `<section class="explain ${pick === q.answer ? 'ok' : 'ng'}" aria-live="polite">
      <p class="verdict">${pick === q.answer ? '答對了' : '答錯了，正確答案是 ' + '<b>' + esc(q.options[q.answer]) + '</b>'}</p>
      ${q.explain}${notesHtml(Object.assign({}, q.it, { flag: '' }))}
    </section>
    <button class="btn primary wide" id="next">${st.i + 1 < total ? '下一題' : '看成績'}</button>` : ''}`;
  if (!answered) view.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    const k = +b.dataset.k, ok = k === q.answer;
    st.res[st.i] = { pick: k, ok }; record(q.it, ok); render();
    const ex = view.querySelector('.explain'); if (ex) ex.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  else $('#next').onclick = () => { if (st.i + 1 < total) { st.i++; render(); } else go('result', st, true); };
  return { title: '測驗', tab: 'quiz' };
};
R.result = (st) => {
  const ok = st.res.filter(r => r.ok).length, total = st.qs.length, score = Math.round(ok / total * 100);
  const wrongs = st.qs.filter((q, k) => !st.res[k].ok);
  view.innerHTML = `
  <section class="score">
    <p class="eyebrow">本次成績</p>
    <p class="score-num kai">${score}<small>分</small></p>
    <p>${total} 題答對 ${ok} 題</p>
  </section>
  ${wrongs.length ? `<h3 class="sub">答錯的題目（已收進錯題本）</h3>${wrongs.map(q => itemCard(q.it)).join('')}` : '<p class="empty">全對！這次沒有新增錯題。</p>'}
  <div class="row-btns"><button class="btn" id="again">同範圍再測一次</button><button class="btn primary" id="home">回首頁</button></div>`;
  $('#again').onclick = () => go('setup', st.from || { mode: 'quiz', mods: [1, 2, 3, 4, 5] }, true);
  $('#home').onclick = () => { stack = [['home']]; render(); };
  return { title: '測驗結果', tab: 'quiz' };
};

/* ---- 單字卡 ---- */
function flashSides(it) {
  if (it.mod === 1) return [
    `<div class="fc-word kai">${rw(it.a, 'blank')}</div><div class="fc-hint">${esc(it.a.m)}</div><div class="fc-word kai">${rw(it.b, 'blank')}</div><div class="fc-hint">${esc(it.b.m)}</div>`,
    `<div class="fc-word kai">${rw(it.a, 'hl')}</div><div class="fc-word kai">${rw(it.b, 'hl')}</div>`];
  if (it.mod === 2) return [`<div class="q-zy zy">${esc(it.zy)}</div><div class="fc-word kai">${m2Blank(it.q)}</div>`,
    `<div class="fc-word kai">${m2Full(it)}</div>${it.alts.length > 1 ? `<div class="fc-hint">可接受：${it.alts.map(esc).join('、')}</div>` : ''}`];
  if (it.mod === 3) return [`<div class="fc-word kai">${hl(it.w, [it.c])}</div><div class="fc-hint">「${esc(it.c)}」怎麼念？</div>`,
    `<div class="q-zy zy big-zy">${esc(it.zy)}</div><div class="fc-hint">${esc(it.m)}</div>`];
  if (it.mod === 4) return [`<div class="fc-sent kai">${m4Sent(it)}</div><div class="fc-hint">${esc(it.src)}・「${esc(it.word)}」的意思？</div>`,
    `<div class="fc-ans">${esc(it.sense)}</div><div class="fc-hint">${esc(it.tr)}</div>`];
  return [`<div class="fc-word kai">${esc(it.idiom)}</div><div class="fc-hint">原義與後來的意義？</div>`, `<div class="fc-means">${m5Meanings(it)}</div>`];
}
R.flash = (st) => {
  const it = st.items[st.i], [front, backS] = flashSides(it), k = S.known[it.id];
  view.innerHTML = `
  <div class="qtop"><span class="tabnum">${st.i + 1} / ${st.items.length}</span><div class="bar slim"><i style="width:${(st.i + 1) / st.items.length * 100}%"></i></div><span class="modlabel">${MODS[it.mod - 1].name}</span></div>
  <button class="flashcard${st.flip ? ' flipped' : ''}" id="card" aria-label="翻面">
    <span class="fc-face">${st.flip ? backS : front}</span>
    <span class="tags">${tagsHtml(it)}</span>
    <span class="fc-tip">${st.flip ? '背面・點一下翻回' : '點一下看答案'}</span>
  </button>
  <div class="row-btns">
    <button class="btn mark-weak${k === 0 ? ' on' : ''}" id="weak">待加強</button>
    <button class="btn mark-known${k === 1 ? ' on' : ''}" id="known">已熟悉</button>
  </div>
  <div class="row-btns nav"><button class="btn ghost" id="prev" ${st.i ? '' : 'disabled'}>上一張</button><button class="btn ghost" id="nextc">${st.i + 1 < st.items.length ? '下一張' : '完成'}</button></div>`;
  $('#card').onclick = () => { st.flip = !st.flip; render(); };
  const nextc = () => { if (st.i + 1 < st.items.length) { st.i++; st.flip = false; render(); } else back(); };
  $('#weak').onclick = () => { S.known[it.id] = 0; save(); nextc(); };
  $('#known').onclick = () => { S.known[it.id] = 1; save(); nextc(); };
  $('#prev').onclick = () => { st.i--; st.flip = false; render(); };
  $('#nextc').onclick = nextc;
  return { title: '單字卡' };
};

/* ---- 錯題本 ---- */
R.wrong = () => {
  const ids = Object.keys(S.wrong).filter(id => byId[id]);
  const list = ids.map(id => byId[id]);
  view.innerHTML = `
  <section class="intro"><p>測驗答錯的題目會自動收進來，<b>連續答對 2 次</b>就會自動移出。</p></section>
  ${list.length ? `<button class="btn primary wide" id="drill">重練錯題（${Math.min(list.length, 30)} 題）</button>
  ${MODS.map(m => { const l = list.filter(i => i.mod === m.id); return l.length ? `<h3 class="sub">${m.name}<span class="muted">${l.length} 題</span></h3>` + l.map(i => `<div class="wrap-card">${itemCard(i)}<div class="streak"><span>已連續答對 ${S.wrong[i.id].s || 0} / 2・累計錯 ${S.wrong[i.id].n} 次</span><button class="linkbtn" data-rm="${i.id}">移出</button></div></div>`).join('') : ''; }).join('')}`
    : '<p class="empty">錯題本是空的。做幾回測驗，答錯的題目會出現在這裡。</p>'}`;
  if ($('#drill')) $('#drill').onclick = () => {
    const items = shuffle(list.filter(i => !i.hard)).slice(0, 30);
    go('quiz', { items, i: 0, qs: items.map(makeQ), res: [], from: null });
  };
  view.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { delete S.wrong[b.dataset.rm]; save(); render(); });
  return { title: '錯題本', tab: 'wrong' };
};

/* ---- 搜尋 ---- */
R.search = (st) => {
  st.q = st.q || '';
  view.innerHTML = `<div class="searchbox"><input id="q" type="search" placeholder="輸入字、詞語或成語" value="${esc(st.q)}" autocomplete="off" aria-label="搜尋"></div><div id="sr"></div>`;
  const run = () => {
    const q = st.q.trim();
    const box = $('#sr');
    if (!q) { box.innerHTML = '<p class="empty">可搜尋五個模組的所有內容，例如「簣」「區區」「沆瀣」。</p>'; return; }
    const hits = ITEMS.filter(i => i.text.includes(q));
    box.innerHTML = `<p class="pool">找到 <b>${hits.length}</b> 筆</p>` + MODS.map(m => {
      const l = hits.filter(i => i.mod === m.id).slice(0, 40);
      return l.length ? `<h3 class="sub">${m.name}<span class="muted">${hits.filter(i => i.mod === m.id).length} 筆</span></h3>` + l.map(i => itemCard(i)).join('') : '';
    }).join('');
  };
  const inp = $('#q');
  inp.oninput = () => { st.q = inp.value; run(); };
  run();
  return { title: '搜尋', tab: 'search', after: () => { if (!st.q) inp.focus(); } };
};

/* ---- 待確認清單 ---- */
R.pending = () => {
  const list = ITEMS.filter(i => i.flag);
  view.innerHTML = `<section class="intro"><p>以下題目的掃描字跡無法完全確認，請對照紙本講義。標「暫不出題」的不會出現在測驗中；確認後可在 data.js 修正並移除標記。</p></section>`
    + MODS.map(m => { const l = list.filter(i => i.mod === m.id); return l.length ? `<h3 class="sub">${m.name}</h3>` + l.map(i => itemCard(i, true)).join('') : ''; }).join('');
  return { title: '待確認清單' };
};

/* ---- 設定 ---- */
R.settings = (st) => {
  view.innerHTML = `
  <div class="setup">
    <fieldset><legend>字級</legend><div class="chips">${['小', '標準', '大', '特大'].map((t, k) => `<button class="chip${S.font === k ? ' on' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
      <p class="preview kai">功虧一<b class="hl">簣</b>　<span class="zy">ㄎㄨㄟˋ</span></p></fieldset>
    <fieldset><legend>外觀</legend><div class="chips">${[['system', '跟隨系統'], ['light', '淺色'], ['dark', '深色']].map(([v, t]) => `<button class="chip${S.theme === v ? ' on' : ''}" data-t="${v}">${t}</button>`).join('')}</div></fieldset>
    <fieldset><legend>題庫</legend>
      ${MODS.map(m => `<p class="kv"><span>${m.name}</span><span>${modItems(m.id).length} 題・${m.pages}</span></p>`).join('')}
      ${ITEMS.some(i => i.flag) ? `<button class="btn wide" id="toPending">查看待確認題目（${ITEMS.filter(i => i.flag).length}）</button>` : ''}</fieldset>
    <fieldset><legend>學習紀錄</legend>
      <p class="muted">紀錄存在這台裝置的瀏覽器中，不需登入；清除瀏覽器資料會一併清除。</p>
      ${st.confirm ? `<p class="warn">確定要清除所有進度、熟悉標記與錯題本嗎？</p><div class="row-btns"><button class="btn" id="cancel">取消</button><button class="btn danger" id="doReset">確定清除</button></div>`
        : `<button class="btn wide" id="reset">清除學習紀錄</button>`}</fieldset>
  </div>`;
  view.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { S.font = +b.dataset.f; save(); applySettings(); render(); });
  view.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { S.theme = b.dataset.t; save(); applySettings(); render(); });
  if ($('#toPending')) $('#toPending').onclick = () => go('pending');
  if ($('#reset')) $('#reset').onclick = () => { st.confirm = true; render(); };
  if ($('#cancel')) $('#cancel').onclick = () => { st.confirm = false; render(); };
  if ($('#doReset')) $('#doReset').onclick = () => { S.known = {}; S.done = {}; S.wrong = {}; S.gs = {}; save(); st.confirm = false; render(); };
  return { title: '設定', tab: 'settings' };
};

/* ---- 啟動 ---- */
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  const name = t.dataset.tab;
  if (name === 'home') stack = [['home']];
  else if (name === 'quiz') stack = [['home'], ['setup', { mode: 'quiz', mods: [1, 2, 3, 4, 5] }]];
  else stack = [['home'], [name, {}]];
  render();
});
parseAll(window.BANK);
load(); applySettings();
stack = [['home']]; render();
})();
