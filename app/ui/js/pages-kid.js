/* ============================================================
   Lumio · pages-kid.js —— 孩子端各页与孩子端专属组件
   分层：L3 页面　　依赖：core / format / icons / state / domain / render / records
   ============================================================ */
import { h, val, q } from './core.js';
import { wxTime, dayLabel, coin, fmt, expiryMs, fmtExpDate, when, byAtAsc, dayDiff, localDayStr, faceYuan } from './format.js';
import { heroSvg } from './icons.js';
import { S } from './state.js';
import { groupOf, isReadBy, convRow } from './domain.js';
import { led, ledRight, cardHead } from './render.js';
import { recCardHtml } from './records.js';

/* ============================================================
   孩子端：任务 / 消息 / 商城 三栏
   ============================================================ */

/* ---- 消息通用工具 ---- */
export function meRefKid() { return { kind: 'kid', id: S.state.kid.id }; }
export function isMine(m, me) { return !!(m.from && m.from.kind === me.kind && m.from.id === me.id); }

export function chatHtml(msgs, me, opts) {
  opts = opts || {};
  if (!msgs || !msgs.length) {
    return '<div class="empty" style="padding:18px"><span class="e">💬</span>还没有留言<br><span class="tiny">想说什么就写下来吧</span></div>';
  }
  var st = S.state;
  function avaOf(m) {
    if (m.from.kind === 'kid') {
      var k = (st.kids || []).find(function (x) { return x.id === m.from.id; });
      return k ? k.avatar : '⭐';
    }
    return m.from.slot === 'dad' ? '👨' : (m.from.slot === 'mom' ? '👩' : '👑');
  }
  var GAP = 5 * 60 * 1000;   // 距上一条超过 5 分钟才显示时间（微信式合并）
  var prev = null;
  return msgs.map(function (m) {
    var mine = isMine(m, me);
    var who = mine ? '我' : (m.from.name || (m.from.kind === 'kid' ? '小朋友' : '家长'));
    var t = Date.parse(m.at);
    var showTime = !prev || !isFinite(t) || !isFinite(prev.t) || (t - prev.t) > GAP;
    var showWho = !mine && (!prev || prev.mine !== false || prev.who !== who || showTime);
    var html = '';
    if (showTime) html += '<div class="chattime">' + h(wxTime(m.at)) + '</div>';
    html += '<div class="wxline' + (mine ? ' me' : '') + '">' +
      '<div class="wxava2">' + h(avaOf(m)) + '</div>' +
      '<div class="wxcol">' +
      (showWho ? '<div class="wxwho">' + h(who) + '</div>' : '') +
      '<div class="chatline' + (mine ? ' me' : '') + '">' + h(m.text) + '</div>' +
      '</div></div>';
    prev = { t: t, mine: mine, who: who };
    return html;
  }).join('');
}

/* ============================================================ 孩子：任务 */
export function taskDeadlineHtml(t) {
  if (t.type === 'once') return '<span class="deadline">✨ 今天有效，过零点自动消失</span>';
  if (t.type !== 'timed' || !t.expiresAt) return '';
  var d = new Date(t.expiresAt);
  if (isNaN(d)) return '';
  var diff = d.getTime() - Date.now();
  var soon = diff > 0 && diff < 6 * 3600000;
  var p = function (x) { return String(x).padStart(2, '0'); };
  return '<span class="deadline' + (soon ? ' soon' : '') + '">⏰ 截止 ' +
    (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes()) +
    '（' + h(dayLabel(t.expiresAt)) + '）</span>';
}

/* 限时任务的紧凑截止文案（紧凑行副行用；不带「（今天）」后缀以省宽度） */
function taskDeadlineShort(t) {
  if (t.type !== 'timed' || !t.expiresAt) return '';
  var d = new Date(t.expiresAt);
  if (isNaN(d.getTime())) return '<span class="deadline">⏰ 有截止时间</span>';
  var p = function (n) { return String(n).padStart(2, '0'); };
  var soon = (d.getTime() - Date.now()) < 6 * 3600 * 1000;
  return '<span class="deadline' + (soon ? ' soon' : '') + '">⏰ 截止 ' +
    (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes()) + '</span>';
}

/* v2.0.46 紧凑任务行：状态由右侧按钮表达，副行承载「次数/期限 + 至多积分」
   注：周期文案随任务类型切换（今日/本周/本月）—— 原先一律写「今日」，
   对每周/每月任务语义是错的。 */
function taskCardKid(t) {
  var pl = t.periodLabel || '今天';
  var pln = t.type === 'weekly' ? '本周' : t.type === 'monthly' ? '本月' : '今日';
  var segs = [];
  if (t.phase === 'done') {
    segs.push('✓ ' + (t.type === 'once' ? '已完成' : pl + '已完成'));
  } else {
    if (t.type === 'timed' && t.expiresAt) segs.push(taskDeadlineShort(t));
    else if (t.type === 'once') segs.push('今天有效 · 只做一次');
    else segs.push(pln + ' ' + Math.min(t.limitPerDay, t.todayCount || 0) + '/' + t.limitPerDay + ' 次');
    segs.push('至多 <span class="pricetag">' + coin(13) + fmt(t.coins) + '</span>');
  }

  var btn;
  if (t.phase === 'accept') btn = '<button class="btn mint" data-act="accept" data-id="' + t.id + '">✋ 接受任务</button>';
  else if (t.phase === 'submit') btn = '<button class="btn mint" data-act="submit" data-id="' + t.id + '">我做完了</button>';
  else if (t.phase === 'reviewing') btn = '<button class="btn gray is-disabled">⏳ 等家长确认</button>';
  else btn = '<button class="btn gray is-disabled">✓ ' + (t.type === 'once' ? '已经做完啦' : pl + '做完啦') + '</button>';

  return '<div class="trow">' +
    '<div class="ti">' + h(t.icon) + '</div>' +
    '<div class="tm"><div class="tt">' + h(t.title) + '</div><div class="ts">' + segs.join(' · ') + '</div></div>' +
    '<div class="ta">' + btn + '</div>' +
    '</div>';
}

/* ============================================================ 孩子：我的（资产 / 使用记录 / 现金钱包） */
/* v2.0.61：券分组表收为模块私有（同 records.js 的理由），对外只给 couponGroup(key) 只读访问器。
   它每次渲染 kidMine() 都整体重建，原本 export 出去的是「会被整体重赋值的可变对象」。 */
var _couponGroups = {};
export function couponGroup(key) { return _couponGroups[key] || null; }
export function kidMine() {
  var st = S.state, k = st.kid;
  var rdms = st.redemptions || [];
  var wallet = st.wallet || { cash: 0, withdrawals: [] };

  var unused = rdms.filter(function (r) { return r.status === 'approved' && r.itemType !== 'cash' && r.useStatus !== 'used'; });
  var usedPend = rdms.filter(function (r) { return r.status === 'approved' && r.itemType !== 'cash' && r.useStatus === 'used' && !r.verified; })
    .sort(function (a, b) { return String(b.usedAt || '').localeCompare(String(a.usedAt || '')); });
  var used = rdms.filter(function (r) { return r.status === 'approved' && r.itemType !== 'cash' && r.useStatus === 'used' && !!r.verified; })
    .sort(function (a, b) { return String(b.usedAt || '').localeCompare(String(a.usedAt || '')); });

  // 相同奖励 + 相同使用限制 归为一组，只显示一次并标出卡券数量，节省空间
  _couponGroups = {};
  function couponKey(r) { return r.itemId + '|' + r.itemType + '|' + (r.useDeadline ? r.useDeadline.slice(0, 10) : ''); }
  function groupCoupons(list) {
    var map = {};
    list.forEach(function (r) { var kk = couponKey(r); (map[kk] || (map[kk] = [])).push(r); });
    return Object.keys(map).map(function (kk) {
      var arr = map[kk].slice().sort(function (a, b) { return String(a.reviewedAt || a.createdAt).localeCompare(String(b.reviewedAt || b.createdAt)); });
      return { key: kk, arr: arr, item: arr[0], count: arr.length };
    });
  }
  function regGroup(arr) { var key = 'g' + Object.keys(_couponGroups).length; _couponGroups[key] = arr; return key; }
  function dChip(r) {
    var t = r.useDeadline ? expiryMs(r.useDeadline) : NaN;
    if (isNaN(t)) return '<span class="chip gray">不限期</span>';
    var d = Math.ceil((t - Date.now()) / 86400000);
    if (d <= 1) return '<span class="chip orange">⏰ ' + fmtExpDate(r.useDeadline) + ' 24点到期</span>';
    if (d <= 4) return '<span class="chip orange">⏰ 剩 ' + (d - 1) + ' 天</span>';
    return '<span class="chip mint">剩 ' + (d - 1) + ' 天</span>';
  }

  var unusedGroups = groupCoupons(unused);
  var unusedHtml = unusedGroups.length ? unusedGroups.map(function (g) {
    var r = g.item, gk = regGroup(g.arr);
    return '<div class="coupon">' +
      '<div class="ci">' + h(r.itemEmoji || '🎁') + (g.count > 1 ? '<span class="cnt">×' + g.count + '</span>' : '') + '</div>' +
      '<div class="mid"><div class="t">' + h(r.itemName) + '</div>' +
      '<div class="s">花了 ' + fmt(r.cost) + ' 积分 · 兑换于 ' + when(r.reviewedAt || r.createdAt) + (g.count > 1 ? ' · 共 ' + g.count + ' 张' : '') + '</div></div>' +
      '<div class="cut"></div>' +
      '<div class="end">' + dChip(r) + '<button class="btn sm mint" data-act="reward-use-open" data-g="' + gk + '">✅ 使用</button></div></div>';
  }).join('') : '';

  /* 已使用、等家长核销的券：以票券形式置顶展示（橙色虚线 + 待核销角标） */
  var usedPendGroups = groupCoupons(usedPend);
  var usedPendHtml = usedPendGroups.length ? usedPendGroups.map(function (g) {
    var r = g.item;
    return '<div class="coupon" style="border-style:dashed">' +
      '<div class="ci">' + h(r.itemEmoji || '🎁') + (g.count > 1 ? '<span class="cnt">×' + g.count + '</span>' : '') + '</div>' +
      '<div class="mid"><div class="t">' + h(r.itemName) + (g.count > 1 ? ' ×' + g.count : '') + '</div>' +
      '<div class="s">已于 ' + when(r.usedAt) + ' 使用 · 等爸爸妈妈核销</div></div>' +
      '<div class="cut"></div>' +
      '<div class="end"><span class="chip orange">⏳ 待核销</span></div></div>';
  }).join('') : '';

  var unusedAllHtml = (unusedGroups.length || usedPendGroups.length)
    ? (unusedHtml + usedPendHtml)
    : lumioEmpty('sad', '背包里还没有奖励卡券', '去「商城」页换一个吧');

  /* 使用记录 / 提取记录：接入通用记录卡（最近 3 条 + 查看全部可筛选） */
  var usedGroups = groupCoupons(used);
  var usedRow = function (g) {
    var r = g.item;
    return led({
      icon: h(r.itemEmoji || '🎁'), iconSize: 21, iconW: 30,
      title: h(r.itemName) + (g.count > 1 ? ' ×' + g.count : ''),
      sub: '使用于 ' + when(r.usedAt || r.reviewedAt),
      right: '<span class="chip mint">已核销 ✓</span>'
    });
  };
  var wd = wallet.withdrawals || [];
  var wdRow = function (w) {
    return led({
      icon: '💰', iconSize: 21, iconW: 30,
      title: '提取 ' + w.amount + ' 元',
      sub: when(w.at) + (w.note ? ' · ' + h(w.note) : ''),
      right: '<span class="chip ' + (w.verified ? 'mint">已核销 ✓' : 'orange">待核销') + '</span>' +
        '<div class="d dn" style="margin-left:6px">-' + w.amount + '</div>'
    });
  };

  var wdTotal = wd.reduce(function (s, w) { return Math.round((s + (Number(w.amount) || 0)) * 10) / 10; }, 0);
  var cashCard = (wallet.cash || 0) > 0
    ? cardHead('💰', '现金钱包',
      '<span class="chip sun">¥' + wallet.cash + '</span>' +
      (wdTotal > 0 ? '<span class="chip gray">已提取 ¥' + wdTotal + '</span>' : '')) +
      '<div class="tiny muted" style="margin-bottom:10px">现金奖励存在这里，提取后爸爸妈妈会收到站内信。</div>' +
      '<button class="btn sun" style="display:block;margin:0 auto" data-act="cash-withdraw">💸 提取</button></div>'
    : '';

  var usedCard = recCardHtml({
    key: 'kid-used', icon: '📜', title: '使用记录',
    items: usedGroups, rowFn: usedRow, empty: '还没有核销完成的记录'
  });
  var wdCard = recCardHtml({
    key: 'kid-wd', icon: '💸', title: '提取记录',
    items: wd, rowFn: wdRow, empty: '还没有提取过现金',
    filters: [
      { key: 'wd', label: '状态', options: [{ v: 'pend', label: '待核销' }, { v: 'done', label: '已核销' }],
        match: function (w, v) { return v === 'pend' ? !w.verified : v === 'done' ? !!w.verified : true; } }
    ]
  });

  return cashCard +
    cardHead('🎟️', '我的奖励卡券',
    (unused.length ? '<span class="chip mint">' + unused.length + ' 张未使用</span>' : '') +
    (usedPend.length ? '<span class="chip orange">' + usedPend.length + ' 张待核销</span>' : '') +
    (!unused.length && !usedPend.length ? '<span class="chip gray">暂无待用</span>' : '')) +
    unusedAllHtml + '</div>' +
    usedCard + wdCard;
}

export function kidTasks() {
  var st = S.state;
  var tasks = st.tasks || [];
  var goals = st.goals || [];
  var gStrip = (st.settings.kidCanAddGoal && goals.length) ? '<div class="gostrip">' + goals.slice(0, 3).map(function (g) {
    var hasTarget = Number(g.targetCoins) > 0;
    var bal = (S.state.kid ? S.state.kid.balance : 0);
    var p = hasTarget ? Math.min(100, Math.round(bal / Math.max(1, g.targetCoins) * 100)) : 0;
    return '<div class="gostrip-i"><span class="gostrip-e">' + h(g.emoji || '⭐') + '</span>' +
      '<div class="gostrip-body"><div class="gostrip-t">' + h(g.title) + (hasTarget ? (' · ' + p + '%') : '') + '</div>' +
      (hasTarget ? '<div class="gostrip-bar"><div class="gostrip-fill" style="width:' + p + '%"></div></div>' : '') + '</div></div>';
  }).join('') + '</div>' : '';
  // 限时 / 临时任务有期限，跟每日/每周/每月任务分开，排在前；后者再拆三档，每日在前
  var GROUPS = [
    { k: 'timed', t: '⏳ 限时任务', tip: '先接受，再在截止前完成；过时就自动消失啦' },
    { k: 'temp', t: '✨ 临时任务', tip: '接受后完成一次就好，只在今天有效' },
    { k: 'daily', t: '🔆 每日任务', tip: '每天都要做，做完直接提交' },
    { k: 'weekly', t: '🔁 每周任务', tip: '每周都能做，做完直接提交' },
    { k: 'monthly', t: '📅 每月任务', tip: '每月都能做，做完直接提交' }
  ];
  /* v2.0.50：待家长确认条数已随「我的任务」抬头移到固定页头 */
  var html = GROUPS.map(function (g) {
    var list = tasks.filter(function (t) { return groupOf(t) === g.k; });
    if (!list.length) return '';
    return '<div class="taskcat">' + g.t + '<span class="cs"></span></div>' +
      '<div class="tiny muted" style="margin:-5px 2px 9px">' + g.tip + '</div>' +
      list.map(taskCardKid).join('');
  }).join('');

  /* v2.0.50：抬头（我的任务 + N 项等家长确认）已在固定页头；卡头原有文案与卡内胶囊一并去掉 */
  return '<div class="card">' + gStrip +
    (html || lumioEmpty('sad', '家长还没有安排任务哦', '过一会儿再来看看吧')) +
    '</div>';
}

/* ============================================================ 孩子：消息 */
export function kidMessages() {
  /* v2.0.50：留言/审核/积分分段已移到固定页头（不滚动），此处只渲染正文 */
  var sub = S.msgSub || 'chat';
  if (sub === 'review') return kidReviewCard();
  if (sub === 'points') return kidPointsCard();
  return kidChatCard();
}

/* 孩子端留言会话分组：group=爸爸妈妈群 / dad / mom / kid:<id>=兄弟姐妹 */
export function kidBucketOf(m, me) {
  if (m.to && m.to.kind === 'parents') return 'group';
  if (m.to && m.to.kind === 'parent' && m.to.slot) return m.to.slot;
  if (m.from && m.from.kind === 'parent' && m.from.slot) return m.from.slot;
  if (m.from && m.from.kind === 'kid' && m.from.id !== me.id) return 'kid:' + m.from.id;
  if (m.to && m.to.kind === 'kid' && m.to.id !== me.id) return 'kid:' + m.to.id;
  return 'group';
}

function kidChatCard() {
  var st = S.state;
  var me = meRefKid();
  var msgs = (st.messages || []).slice().sort(byAtAsc);
  var entries = (st.recipients || []).map(function (r) {
    var key = r.kind === 'parents' ? 'group' : (r.kind === 'parent' ? r.slot : 'kid:' + r.id);
    return {
      key: key, r: r,
      name: r.kind === 'parents' ? '爸爸妈妈' : r.name,
      ava: r.kind === 'parents' ? '👑' : (r.kind === 'parent' ? (r.slot === 'dad' ? '👨' : '👩') : (r.avatar || '🧒')),
      conv: [], unread: 0
    };
  });
  if (!entries.some(function (e) { return e.key === 'group'; })) {
    entries.unshift({ key: 'group', r: { kind: 'parents', bound: true }, name: '爸爸妈妈', ava: '👑', conv: [], unread: 0 });
  }
  var byKey = {};
  entries.forEach(function (e) { byKey[e.key] = e; });
  msgs.forEach(function (m) {
    var e = byKey[kidBucketOf(m, me)];
    if (!e) return;
    e.conv.push(m);
    if (!isMine(m, me) && !isReadBy(m, me)) e.unread++;
  });
  entries.sort(function (a, b) {
    var la = a.conv.length ? a.conv[a.conv.length - 1].at : '';
    var lb = b.conv.length ? b.conv[b.conv.length - 1].at : '';
    if (la !== lb) return String(lb).localeCompare(String(la));
    return (a.key === 'group' ? -1 : 0) - (b.key === 'group' ? -1 : 0);
  });
  var rows = entries.map(function (e) {
    var last = e.conv[e.conv.length - 1];
    var bound = e.r.bound !== false;
    var prev = !last ? '还没有留言，点这里去说句话' : (isMine(last, me) ? '我：' : '') + last.text;
    return convRow({
      cls: bound ? '' : 'is-dim',
      tap: bound ? { act: 'kidmsg', key: 'key', val: e.key } : null,
      ava: e.ava, unread: e.unread,
      name: h(e.name), time: h(last ? wxTime(last.at) : ''),
      prev: bound ? h(prev) : '<span style="opacity:.55">还没绑定飞牛账号</span>'
    });
  }).join('');
  return cardHead('💬', '留言',
    (st.settings.kidCanMessage ? '<button class="btn xs" data-act="kid-msg">✍️ 我要说</button>' : '')) +
    '<div class="tiny muted" style="margin-bottom:6px">只有你和收到的人能看到。可以单独跟爸爸或妈妈悄悄说。</div>' +
    rows +
    '</div>';
}

/* v2.0.51：审核记录分两个明确分区——
   ⏳ 待审核：置顶，默认展示全部待审核记录（不再计入 60 条上限）
   ✅ 已审核：默认只列「今天 + 昨天」；更早的历史由「查看更早的 N 条」就地展开（不跳页），
      展开后插入「更早的记录」分区，按钮变为「收起 ▴」，再点回到默认视图
   展开状态记在 S.revHist，切换留言/审核/积分子页时自动回到收起态 */
function kidReviewCard() {
  var st = S.state;
  var items = [];
  (st.submissions || []).forEach(function (s) {
    items.push({ at: s.reviewedAt || s.createdAt, icon: s.taskIcon || '⭐', title: s.taskTitle,
      kind: '任务', amount: s.coins, granted: s.granted, status: s.status, reply: s.reply });
  });
  (st.redemptions || []).forEach(function (r) {
    items.push({ at: r.reviewedAt || r.createdAt, icon: r.itemEmoji || '🎁', title: r.itemName,
      kind: '兑换', amount: r.cost, granted: null, status: r.status, reply: r.reply });
  });
  items.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });

  var rowOf = function (x) {
    var chip = x.status === 'pending' ? '<span class="chip sun">等家长确认</span>'
      : x.status === 'approved' ? '<span class="chip mint">✓ 通过</span>' : '<span class="chip gray">未通过</span>';
    var amt;
    if (x.kind === '任务') {
      if (x.status === 'approved') {
        var gv = (x.granted === null || x.granted === undefined) ? x.amount : x.granted;
        amt = '+' + fmt(gv) + (gv !== x.amount ? '（至多 ' + fmt(x.amount) + '）' : '');
      } else {
        amt = '至多 +' + fmt(x.amount);
      }
    } else {
      amt = '−' + fmt(x.amount);
    }
    return led({
      icon: h(x.icon), iconSize: 21, iconW: 30,
      title: h(x.title) + ' <span class="tiny muted">' + x.kind + '</span>',
      sub: when(x.at) + (x.reply ? ' · 💬 ' + h(x.reply) : ''),
      right: '<div class="end" style="text-align:right"><div class="tiny muted">' + amt + '</div>' + chip + '</div>'
    });
  };
  var rowsOf = function (arr) { return arr.map(rowOf).join(''); };
  var HEAD = 'font-weight:800;font-size:13px;margin:12px 0 8px;color:var(--ink2)';
  var quiet = function (t) { return '<div class="tiny muted" style="padding:8px 2px">' + t + '</div>'; };
  var CAP = 100;                                   /* 展开后的历史条数上限，防超长列表 */

  var pend = items.filter(function (x) { return x.status === 'pending'; });
  var done = items.filter(function (x) { return x.status !== 'pending'; });
  var recent = [], older = [];
  done.forEach(function (x) { (dayDiff(x.at) <= 1 ? recent : older).push(x); });

  var html = cardHead('✅', '审核记录');
  html += '<div style="' + HEAD + ';margin-top:4px">⏳ 待审核（' + pend.length + '）</div>';
  html += pend.length ? rowsOf(pend) : quiet('没有待审核的记录，都处理完啦');
  html += '<div style="' + HEAD + ';margin-top:18px">✅ 已审核（' + done.length + '）</div>';
  if (!done.length) {
    html += quiet('还没有已审核的记录');
  } else {
    html += recent.length ? rowsOf(recent) : quiet('近两天没有已审核的记录');
    if (older.length) {
      if (S.revHist) {
        var shown = older.slice(0, CAP);
        html += '<div style="' + HEAD + ';margin-top:14px">更早的记录（' + older.length + '）</div>' + rowsOf(shown);
        if (older.length > shown.length) html += quiet('仅显示最近 ' + CAP + ' 条');
      }
      html += '<button class="btn ghost block" style="margin-top:12px;padding:9px 13px;font-size:13.5px;box-shadow:none" ' +
        'data-act="revhist" data-v="' + (S.revHist ? 'off' : 'on') + '">' +
        (S.revHist ? '收起 ▴' : '查看更早的 ' + older.length + ' 条 ▾') + '</button>';
    }
  }
  return html + '</div>';
}

/* v2.0.60：右侧「涨跌数 + 余额」改用 render.js 的 ledRight（与家长端 ledRow 共用一份实现） */
function ledRowKid(l) {
  return led({
    icon: l.delta > 0 ? '🌟' : '🛍️', iconSize: 20, iconW: 28,
    title: h(l.reason || '积分变动'),
    sub: when(l.at),
    right: ledRight(l)
  });
}

function kidPointsCard() {
  var st = S.state, k = st.kid;
  var all = st.ledger || [];
  var day = S.recDay || '';
  /* v2.0.54：用本地日 localDayStr 比较——ledger.at 是 UTC 串，直接 slice(0,10) 会与本地日期 input 错位（UTC+8 早 0-8 点） */
  var list = day ? all.filter(function (l) { return localDayStr(l.at) === day; }) : all;
  return cardHead('📒', '积分记录',
    '<span class="chip sun">现有 ' + coin(14) + fmt(k.balance) + '</span>') +
    '<div class="row wrap" style="gap:8px;margin-bottom:10px;align-items:center">' +
    '<span class="timefield" style="flex:1;min-width:170px"><span class="tico">📅</span>' +
    '<input class="inp tinp" type="date" id="recDay" value="' + h(day) + '"></span>' +
    (day ? '<button class="btn xs gray" data-act="rec-all">看全部</button>' : '') +
    '</div>' +
    (list.length ? list.map(ledRowKid).join('') : lumioEmpty('sad', day ? '这一天还没有记录哦' : '还没有积分记录，快去做任务吧！')) +
    '<div class="tiny muted" style="margin-top:10px">最多显示最近 120 条记录</div></div>';
}

/* ============================================================ 孩子：兑换 */
export function kidRedeem() {
  var st = S.state, k = st.kid;
  var shop = st.shop || [];

  function shopCard(s) {
    var afford = k.balance >= s.cost;
    var out = s.stock === 0;
    var label = out ? '换完啦' : (!afford ? '还差 ' + (s.cost - k.balance) + ' 个' : '我要换！');
    var lim = (s.redeemDeadline ? ' · ⏳ 兑至 ' + s.redeemDeadline.slice(5, 10) : '') +
      (s.useLimitDays ? ' · 🎟️ 有效期 ' + s.useLimitDays + ' 天' : '');
    return '<div class="shopcard">' +
      '<div class="em">' + h(s.emoji) + '</div>' +
      '<div class="nm">' + h(s.name) + '</div>' +
      '<div class="pr pricetag" style="justify-content:center">' + coin(16) + fmt(s.cost) +
      (s.type === 'cash' ? ' <span class="tiny muted">/ 份 = ¥' + faceYuan(s.cashYuan) + '</span>' : '') + '</div>' +
      '<div class="st">' + (s.stock < 0 ? '不限量' : '剩 ' + s.stock + ' 份') + (s.type === 'cash' ? ' · 现金' : '') + lim + '</div>' +
      '<button class="btn sm ' + (afford && !out ? 'sun' : 'gray') + ' go' + (afford && !out ? '' : ' is-disabled') + '" data-act="redeem" data-id="' + s.id + '">' + h(label) + '</button>' +
      '</div>';
  }

  function shopSection(icon, label, arr) {
    if (!arr.length) return '';
    // 限期兑换（设了兑换截止日）与常驻分开两区，限期区按截止日从近到远
    var lim = arr.filter(function (s) { return !!s.redeemDeadline; })
      .sort(function (a, b) { return String(a.redeemDeadline).localeCompare(String(b.redeemDeadline)); });
    var rest = arr.filter(function (s) { return !s.redeemDeadline; });
    var htm = '';
    if (lim.length) htm += '<div class="taskcat">' + icon + ' ' + label + ' · ⏳ 限时<span class="cs"></span><span class="tiny muted">过期为止</span></div><div class="grid2">' + lim.map(shopCard).join('') + '</div>';
    if (rest.length) htm += '<div class="taskcat" style="margin-top:14px">' + icon + ' ' + label + ' · ♾️ 常驻<span class="cs"></span></div><div class="grid2">' + rest.map(shopCard).join('') + '</div>';
    return htm;
  }

  var priv = shop.filter(function (s) { return (s.cat || 'privilege') === 'privilege'; });
  var goods = shop.filter(function (s) { return (s.cat || 'privilege') === 'goods'; });
  var shopHtml = shopSection('🎟️', '特权奖励', priv) + shopSection('🧸', '实物奖励', goods);

  var pend = (st.redemptions || []).filter(function (r) { return r.status === 'pending'; });
  var pendHtml = pend.length ? '<div class="card tight"><div class="row" style="gap:8px;margin-bottom:6px">' +
    '<div class="grow" style="font-weight:800;font-size:14px">⏳ 正在等家长确认</div>' +
    '<span class="chip sun">' + pend.length + ' 项</span></div>' +
    pend.map(function (r) {
      return led({
        icon: h(r.itemEmoji || '🎁'), iconSize: 21, iconW: 30,
        title: h(r.itemName),
        sub: when(r.createdAt),
        right: '<div class="d dn">-' + fmt(r.cost) + '</div>'
      });
    }).join('') + '</div>' : '';

  var goals = (st.goals || []).map(function (g) {
    var hasTarget = Number(g.targetCoins) > 0;
    var p = hasTarget ? Math.min(100, Math.round(k.balance / Math.max(1, g.targetCoins) * 100)) : 0;
    return '<div class="goal"><div class="gh"><span class="ge">' + h(g.emoji) + '</span>' +
      '<div class="gt">' + h(g.title) + '</div>' +
      (hasTarget ? '<span class="chip ' + (p >= 100 ? 'mint' : 'grape') + '">' + p + '%</span>'
        : '<span class="chip gray">心愿</span>') + '</div>' +
      (hasTarget ? '<div class="gbar"><div class="gfill" style="width:' + p + '%"></div></div>' : '') +
      (hasTarget
        ? '<div class="tiny muted">' + fmt(k.balance) + ' / ' + fmt(g.targetCoins) + ' 积分' + (p >= 100 ? ' · 🎉 存够啦！可以跟爸爸妈妈换啦' : ' · 还差 ' + (g.targetCoins - k.balance) + ' 个') + '</div>'
        : '<div class="tiny muted">目标积分等爸爸妈妈看到后帮你定 💡</div>') +
      (g.cheer ? '<div class="cheer">💌 ' + h(g.cheer) + '</div>' : '') +
      '<div class="row" style="margin-top:9px"><button class="btn xs gray" data-act="goal-del" data-id="' + g.id + '">不要这个心愿了</button></div>' +
      '</div>';
  }).join('');

  /* v2.0.50：「奖励商城」抬头已移到固定页头（不滚动），并去掉原副标题文案 */
  /* v2.0.69：许愿开关关闭时，整块「我的心愿」（抬头+副文案+心愿卡）随开关隐藏，使孩子端状态与功能开关一致 */
  var wishSec = st.settings.kidCanAddGoal
    ? cardHead('⭐', '我的心愿',
        '<button class="btn xs grape" style="background:var(--grape);color:#fff" data-act="goal-new">＋ 许个愿</button>') +
      '<div class="tiny muted" style="margin-bottom:12px">许下心愿后，攒够积分就能跟爸爸妈妈换啦～ 他们也会看到你的心愿，给你加油！</div>' +
      (goals || lumioEmpty('think', '还没有心愿', '点右上角「许个愿」试试')) + '</div>'
    : '';

  return pendHtml +
    '<div class="card">' + (shopHtml || lumioEmpty('think', '家长还没有放奖励进来哦')) + '</div>' +
    wishSec;
}

/* ============================================================ 孩子：我的成长详情 / 规则 */
export function rulesInnerHtml() {
  var st = S.state;
  var txt = (st.settings && st.settings.rulesText) || '和爸爸妈妈一起约定积分规则吧！';
  var lines = txt.split('\n').filter(function (x) { return x.trim(); });
  return '<div class="rulebox">' + lines.map(function (l, i) {
    var icon = i === 0 ? '🏠' : '💫';
    return '<div class="ruleline"><span class="ri">' + icon + '</span><span>' + h(l.replace(/^\d+[、.．]\s*/, '')) + '</span></div>';
  }).join('') + '</div>' +
    '<div class="card tight" style="margin-top:12px;box-shadow:none;background:var(--mint1,#EAF7F0)">' +
    '<div class="tiny" style="color:#2f7a5d;font-weight:700;line-height:1.7">💪 小提醒：偶尔忘了做任务没关系，第二天继续就很棒！爸爸妈妈不会随便扣你的积分，改正了就是好孩子～</div></div>';
}

/* 空状态：让 Lumi 出场说话，比裸 emoji 更有温度（mood 默认 sad） */
function lumioEmpty(mood, text, sub) {
  return '<div class="lempty"><div class="le-hero">' + heroSvg({ k: 'le', mood: mood || 'sad' }) + '</div>' +
    '<div class="le-t">' + text + '</div>' +
    (sub ? '<div class="tiny">' + sub + '</div>' : '') + '</div>';
}

export function heroInnerHtml() {
  var st = S.state, k = st.kid;
  var stt = st.stats || {};
  var li = k.levelInfo || {};
  var badges = stt.badges || [];
  var gotBadges = badges.filter(function (b) { return b.got; }).length;
  var weekGoal = Math.max(1, st.settings.weeklyGoal || 50);
  var weekEarned = stt.weekEarned || 0;
  var weekPct = Math.min(100, Math.round(weekEarned / weekGoal * 100));
  var recent = (st.ledger || []).slice(0, 6).map(ledRowKid).join('');
  return '<div class="lumio-hero">' + heroSvg({ k: 'mine', level: (li.level || 1), mood: 'cheer' }) + '</div>' +
    '<div class="row" style="gap:12px;margin-bottom:12px">' +
    '<div class="ava" style="width:56px;height:56px;font-size:30px;border-radius:18px;background:' + h(k.color) + '22">' + h(k.avatar) + '</div>' +
    '<div class="grow"><div style="font-weight:800;font-size:17px">' + h(k.name) + '</div>' +
    '<div class="tiny muted">' + (li.emoji || '') + ' ' + h(li.name || '') + ' Lv.' + (li.level || 1) + ' · 累计赚 ' + fmt(k.totalEarned || 0) + '</div></div>' +
    '<div class="pricetag" style="font-size:20px">' + coin(22) + fmt(k.balance || 0) + '</div></div>' +
    '<div class="kv"><div class="k">现金钱包</div><div class="v">¥' + ((S.state.wallet && S.state.wallet.cash) || 0) + '</div></div>' +
    '<div class="kv"><div class="k">连续打卡</div><div class="v">' + (stt.streak ? '🔥 ' + stt.streak + ' 天' : '今天开始吧') + '</div></div>' +
    (li.nextMin !== null && li.nextMin !== undefined
      ? '<div class="kv"><div class="k">距离升级</div><div class="v">再赚 ' + Math.max(0, li.nextMin - (k.totalEarned || 0)) + ' 分 → ' + h(li.nextName || '') + '</div></div>' : '') +
    '<div class="lvlbar" style="margin:12px 0"><div class="bar"><div class="fill" style="width:' + weekPct + '%"></div></div>' +
    '<div class="cap"><span>本周 ' + fmt(weekEarned) + ' / ' + fmt(weekGoal) + '</span><span>' + weekPct + '%</span></div></div>' +
    '<div class="card-h" style="margin:14px 0 9px"><span class="ico">🏅</span><h2 style="font-size:15px">成就徽章</h2>' +
    '<span class="chip grape">' + gotBadges + ' / ' + badges.length + '</span></div>' +
    '<div class="bdgwall">' + badges.map(function (b) {
      return '<div class="bdg' + (b.got ? ' got' : '') + '"><div class="bi">' + b.icon + '</div><div class="bn">' + h(b.name) + '</div></div>';
    }).join('') + '</div>' +
    '<div class="card-h" style="margin:16px 0 6px"><span class="ico">📖</span><h2 style="font-size:15px">最近积分</h2></div>' +
    (recent || '<div class="empty" style="padding:12px">还没有记录</div>') +
    '<div class="card-h" style="margin:16px 0 8px"><span class="ico">📜</span><h2 style="font-size:15px">我们家的约定</h2></div>' +
    rulesInnerHtml();
}
/* 现金兑换份数预览：份数 × 单价 → 总积分 / 约金额 / 兑换后剩余 */
export function rqPrev() {
  var st = S.state || {};
  var id = S._rqId;
  var s = (st.shop || []).find(function (x) { return x.id === id; });
  var k = st.kid;
  if (!s || !k) return;
  var n = Math.floor(Number(val('#fQty')) || 1);
  if (n < 1) n = 1; if (n > 999) n = 999;
  var cost = s.cost * n;
  var e1 = q('#rqCost'); if (e1) e1.textContent = fmt(cost);
  var e2 = q('#rqYuan'); if (e2) e2.textContent = faceYuan((Number(s.cashYuan) || 0) * n); // v2.0.49：面额 × 份数，不折算
  var e3 = q('#rqLeft'); if (e3) e3.textContent = fmt(k.balance - cost);
}
