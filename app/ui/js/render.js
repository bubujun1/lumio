/* ============================================================
   Lumio · render.js —— 渲染框架：paint 整页重绘 + 渲染后处理 afterPaint + 通用渲染器（cardHead / led / 页头 / 摘要条）
   分层：L2 渲染　　依赖：core / format / icons / theme / feedback / state
   ============================================================ */
import { qa, h, q } from './core.js';
import { fmt, coin } from './format.js';
import { SICON, heroSvg } from './icons.js';
import { themeSw } from './theme.js';
import { showFloat, coinBurst, toast } from './feedback.js';
import { S, TABS_ADMIN, TABS_KID } from './state.js';

/* ============================================================
   渲染
   ============================================================ */
export function isAdmin() { return S.state && S.state.role === 'admin'; }

/* 商品名字号自适应：单行完整显示；放不下按 0.5px 逐步缩小（下限 11px）；
   到下限仍放不下则改为换行完整显示（绝不省略号 / 裁切）。每次重绘后调用。 */
function fitShopNames() {
  var els = qa('.shopcard .nm');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    if (!el.clientWidth && !el.scrollWidth) continue;   // 不可见（被弹窗遮挡等）时跳过
    el.style.fontSize = '';                             // 清掉上一轮内联，读回 CSS 基线的真实字号
    el.style.whiteSpace = 'nowrap';
    var base = parseFloat(getComputedStyle(el).fontSize);
    if (!base || isNaN(base)) base = 13.5;
    var size = base;
    el.style.fontSize = size + 'px';
    var guard = 0;
    while (el.scrollWidth > el.clientWidth && size > 11 && guard < 60) {
      size = Math.round((size - 0.5) * 10) / 10;
      if (size < 11) size = 11;
      el.style.fontSize = size + 'px';
      guard++;
    }
    if (el.scrollWidth > el.clientWidth) {              // 到下限仍放不下 → 换行完整显示
      el.style.fontSize = '11px';
      el.style.whiteSpace = 'normal';
    }
  }
}

export function paint(prev, silent) {
  var st = S.state;
  if (!st) return;

  /* 到账飘字（积分增加）与新留言提醒，居中偏上显示 */
  if (st.role === 'kid' && st.kid) {
    var bal = st.kid.balance || 0;
    if (typeof S.lastBal === 'number' && bal > S.lastBal) showFloat('+' + (bal - S.lastBal) + ' 积分到账啦');
    var un = st.unreadParentMessages || 0;
    if (un > (S.lastUnread || 0)) showFloat('收到新留言', '💌');
    S.lastBal = bal;
    S.lastUnread = un;
  }

  var tabs = isAdmin() ? TABS_ADMIN : TABS_KID;
  if (!tabs.some(function (t) { return t.k === S.tab; })) S.tab = isAdmin() ? 'home' : 'tasks';
  var pending = isAdmin() ? (st.stats ? st.stats.pendingCount : 0) : 0;
  var unread = !isAdmin() ? (st.unreadParentMessages || 0) : 0;
  var kidTodo = !isAdmin() ? (st.tasks || []).filter(function (t) { return t.phase === 'accept'; }).length : 0;

  function navHtml(kind) {
    return tabs.map(function (t) {
      var b = '';
      if (isAdmin()) {
        /* v2.0.49：这个数字是「待处理条数」，挂总览（原挂消息上，家长读完消息也不消失，容易误解） */
        if (t.k === 'home' && pending) b = '<span class="badge">' + pending + '</span>';
      } else {
        if (t.k === 'messages' && unread) b = '<span class="badge">' + unread + '</span>';
        else if (t.k === 'tasks' && kidTodo) b = '<span class="badge">' + kidTodo + '</span>';
      }
      if (kind === 'side') {
        return '<button class="nav ' + (S.tab === t.k ? 'on' : '') + '" data-act="tab" data-k="' + t.k + '">' +
          '<span class="ti">' + SICON(t.i) + '</span><span>' + t.t + '</span>' + b + '</button>';
      }
      return '<button class="tab ' + (S.tab === t.k ? 'on' : '') + '" data-act="tab" data-k="' + t.k + '">' +
        '<span class="ti">' + SICON(t.i) + '</span><span>' + t.t + '</span>' + b + '</button>';
    }).join('');
  }

  var who = isAdmin()
    ? '<span class="chip sun">👑 <span class="wtxt">' + h(st.meTitle || '家长') + '</span></span>' +
      (st.stats && st.stats.unreadMsg ? '<button class="chip pink" data-act="tab" data-k="messages" style="border:none;cursor:pointer">💬 ' + st.stats.unreadMsg + '</button>' : '')
    : '<span class="chip">' + h(st.kid ? st.kid.avatar : '⭐') + ' ' + h(st.kid ? st.kid.name : '') + '</span>';

  var app = q('#app');
  var html =
    '<div class="shell">' +
    '<aside class="side">' +
    '<div class="row" style="padding:4px 12px 12px;gap:9px">' +
    '<div style="width:40px;height:34px">' + heroSvg({ k: 'side', mood: 'hi' }) + '</div>' +
    '<div style="min-width:0"><div style="font-weight:800;font-size:16px" class="ell">Lumio</div></div>' +
    /* v1.0.1 修复：v2.0.69 删侧栏副标题时误删了 .row 的闭合标签，导致 .side-title 与全部导航按钮被并入横向 flex 容器 .row，仅桌面端(.side 可见)排版错乱 */
    '</div>' +
    '<div class="side-title">' + (isAdmin() ? '家长管理' : '我的成长') + '</div>' +
    navHtml('side') +
    '</aside>' +
    '<div class="main">' +
    '<div class="topbar">' +
    '<div class="brandhero" style="display:none">' + heroSvg({ k: 'tb', mood: 'hi' }) + '</div>' +
    '<div class="brandbox">' +
    '<h1 style="min-width:0" class="ell">Lumio</h1>' +
    themeSw() +
    '</div>' +
    who +
    (isAdmin() ? '<button class="btn xs ghost" data-act="settings">⚙️</button>' : '<button class="btn xs ghost" data-act="rules">📜</button>') +
    '</div>' +
    fixedPageHead() + // v2.0.50：固定页头（家长端任务页 / 孩子端任务·消息·商城·背包），与顶栏同区、不随内容滚动
    '<div class="scroll" id="page">' + pageHtml() + '</div>' +
    '</div>' +
    '</div>' +
    '<nav class="tabs">' + navHtml('tab') + '</nav>';

  /* 4 秒轮询会反复调用 paint()。innerHTML 整体重建会把滚动位置清零，
     所以：内容没变就直接不重绘；变了也把滚动位置原样还回去。 */
  var oldPage = q('#page');
  var keepTop = oldPage ? oldPage.scrollTop : 0;
  if (oldPage && app.getAttribute('data-sig') === html) {
    afterPaint(prev, silent);
    return;
  }
  app.setAttribute('data-sig', html);
  app.innerHTML = html;
  var newPage = q('#page');
  if (newPage && keepTop > 0) {
    newPage.scrollTop = Math.min(keepTop, Math.max(0, newPage.scrollHeight - newPage.clientHeight));
  }

  afterPaint(prev, silent);
}

/* 页面渲染器注册表：由 main.js 装配时注入。
   依赖倒置——render 不再 import 各页面模块，从而消除 render ↔ pages-* 的循环依赖。 */
var PAGE_RENDERERS = { admin: {}, kid: {} };
export function setPageRenderers(role, map) { PAGE_RENDERERS[role] = map || {}; }
function pageHtml() {
  var fn = (isAdmin() ? PAGE_RENDERERS.admin : PAGE_RENDERERS.kid)[S.tab];
  return fn ? fn() : '';
}

/* 孩子端常驻摘要条：余额 / 等级 / 本周进度 / 连续打卡 */
function heroStrip() {
  var st = S.state, k = st.kid || {};
  var stt = st.stats || {};
  var li = k.levelInfo || {};
  var weekGoal = Math.max(1, (st.settings && st.settings.weeklyGoal) || 50);
  var weekEarned = stt.weekEarned || 0;
  var weekPct = Math.min(100, Math.round(weekEarned / weekGoal * 100));
  return '<button class="herostrip" data-act="hero">' +
    '<span class="ps-ava">' + h(k.avatar || '⭐') + '</span>' +
    '<span class="ps-mid">' +
    '<span class="ps-bal">' + fmt(k.balance || 0) + ' <i>积分</i></span>' +
    '<span class="ps-bar"><i style="width:' + weekPct + '%"></i></span>' +
    '<span class="ps-sub">' + (li.emoji || '') + ' ' + h(li.name || '') + ' · 本周 ' + fmt(weekEarned) + ' / ' + fmt(weekGoal) + '</span>' +
    '</span>' +
    (stt.streak ? '<span class="ps-fire">🔥' + stt.streak + '天</span>' : '') +
    '<span class="ps-more">详情 ›</span>' +
    '</button>';
}

/* v2.0.50：固定页头——置于顶栏与滚动区之间，与顶栏衔接为同一常驻区，不随内容滚动。
   家长端：任务页=「任务清单」+「新建任务」按钮（v2.0.58）。
   孩子端：任务页=「我的任务」+ 待家长确认条数 / 消息页=留言·审核·积分 / 商城页=「奖励商城」+ 可用积分 / 背包页=积分摘要条。
   v2.0.60：原名 kidPageHead 已名不副实（家长端也在用），改名 fixedPageHead。 */
function fixedPageHead() {
  var st = S.state;
  if (!st) return '';
  /* v2.0.58：家长端「任务」页也改用固定页头——「任务清单 + 新建任务」常驻，不随内容滚动 */
  if (isAdmin()) {
    if (S.tab === 'tasks') {
      return '<div class="pagehead">' +
        '<span class="ph-ico">📋</span><h2 class="ph-t">任务清单</h2>' +
        '<button class="btn xs mint" data-act="task-new">＋ 新建任务</button>' +
        '</div>';
    }
    return '';
  }
  if (S.tab === 'mine') return heroStrip();
  if (S.tab === 'tasks') {
    var pend = (st.submissions || []).filter(function (s) { return s.status === 'pending'; }).length;
    return '<div class="pagehead">' +
      '<span class="ph-ico">📋</span><h2 class="ph-t">我的任务</h2>' +
      (pend ? '<span class="chip orange">⏳ ' + pend + ' 项等家长确认</span>' : '') +
      '</div>';
  }
  if (S.tab === 'messages') return '<div class="pagehead">' + kidSegHtml() + '</div>';
  if (S.tab === 'redeem') {
    var k = st.kid || {};
    return '<div class="pagehead">' +
      '<span class="ph-ico">🎁</span><h2 class="ph-t">奖励商城</h2>' +
      '<span class="chip sun">我有 ' + coin(14) + fmt(k.balance || 0) + '</span>' +
      '</div>';
  }
  return '';
}

/* 消息页分段（留言 / 审核 / 积分）——渲染在固定页头里 */
function kidSegHtml() {
  var st = S.state;
  var sub = S.msgSub || 'chat';
  var un = st.unreadParentMessages || 0;
  var pd = (st.submissions || []).filter(function (s) { return s.status === 'pending'; }).length +
    (st.redemptions || []).filter(function (r) { return r.status === 'pending'; }).length;
  var SEGS = [
    { v: 'chat', t: '💬 留言', n: un },
    { v: 'review', t: '✅ 审核', n: pd },
    { v: 'points', t: '📒 积分', n: 0 }
  ];
  return '<div class="seg">' + SEGS.map(function (x) {
    return '<button class="seg-b' + (sub === x.v ? ' on' : '') + '" data-act="msgsub" data-v="' + x.v + '">' + x.t +
      (x.n ? '<span class="bd">' + x.n + '</span>' : '') + '</button>';
  }).join('') + '</div>';
}

/* ============================================================ 家长：记录 */
/* 通用记录行：图标 + 标题/副标题 + 右侧内容（家长端/孩子端各记录列表共用，避免重复拼装） */
/* 卡片头：统一 card 外壳 + 图标 + 标题 +（可选）右侧操作，卡片结尾仍由调用处的 '</div>' 收口 */
export function cardHead(icon, title, action) {
  return '<div class="card"><div class="card-h"><span class="ico">' + icon + '</span><h2>' + title + '</h2>' + (action || '') + '</div>';
}

export function led(o) {
  var s = o.iconSize || 21, w = o.iconW || 30;
  return '<div class="led">' +
    '<div style="font-size:' + s + 'px;width:' + w + 'px;text-align:center">' + (o.icon || '') + '</div>' +
    '<div class="mid"><div class="r">' + o.title + '</div>' + (o.sub ? '<div class="m">' + o.sub + '</div>' : '') + '</div>' +
    (o.right || '') +
    '</div>';
}

/* 积分流水行的「右侧」片段：涨跌数 + 变动后余额。
   v2.0.60：家长端 ledRow 与孩子端 ledRowKid 曾各写一份完全相同的实现，抽到这里共用。 */
export function ledRight(l) {
  var up = l.delta > 0;
  return '<div class="d ' + (up ? 'up' : 'dn') + '">' + (up ? '+' : '') + fmt(l.delta) + '</div>' +
    '<div class="tiny muted" style="min-width:42px;text-align:right">余' + fmt(l.balanceAfter) + '</div>';
}

/* ============================================================
   渲染后处理（动画 / 轮询刷新保持滚动）
   ============================================================ */
function afterPaint(prev, silent) {
  var st = S.state;
  if (silent && prev) {
    if (!isAdmin()) {
      // 积分变多 → 在摘要条上放个飞积分动效
      var before = prev.kid ? prev.kid.balance : null;
      var after = st.kid ? st.kid.balance : null;
      if (before !== null && after !== null && after > before) {
        var strip = q('.herostrip') || q('.topbar');
        if (strip) {
          var r = strip.getBoundingClientRect();
          coinBurst(r.left + Math.min(r.width, 240) / 2, r.top + r.height / 2, '+' + (after - before));
        }
      }
      var pu = prev.unreadParentMessages || 0;
      var nu = st.unreadParentMessages || 0;
      if (nu > pu) toast('💬 收到新留言啦！', 'ok');
    } else {
      var pp = prev.stats ? prev.stats.pendingCount : 0;
      var np = st.stats ? st.stats.pendingCount : 0;
      if (np > pp) toast('📬 有 ' + (np - pp) + ' 条新的申请待审核', 'ok');
    }
  }
  fitShopNames();   // 每次重绘后重新自适应商品名字号（innerHTML 重建会重置内联样式）
}
