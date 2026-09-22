/* ============================================================
   Lumio · pages-admin.js —— 家长端各页与家长端专属组件
   分层：L3 页面　　依赖：core / format / api / state / domain / render / ui-kit / records / actions
   ============================================================ */
import { h, val, q } from './core.js';
import { when, fmt, byAtAsc, wxTime, fmtDT, coin, redeemExpired, faceYuan } from './format.js';
import { apiAct } from './api.js';
import { S } from './state.js';
import { isReadBy, convRow, groupOf } from './domain.js';
import { cardHead, led, ledRight, paint } from './render.js';
import { openModal } from './ui-kit.js';
import { recCardHtml } from './records.js';
import { doAct } from './actions.js';

/* ============================================================ 家长：总览 */
export function adminHome() {
  var st = S.state, k = st.stats || {};
  var kids = st.kids || [];
  var today = new Date().toDateString();
  /* ---- 待处理（审核 + 核销合并：任务完成/兑换申请/券核销/提现核销，全部在总览直接处理）---- */
  var pendSubs = (st.submissions || []).filter(function (s) { return s.status === 'pending'; });
  var pendRdms = (st.redemptions || []).filter(function (r) { return r.status === 'pending'; });
  var pendUse = (st.redemptions || []).filter(function (r) { return r.useStatus === 'used' && !r.verified; });
  var pendWd = (st.withdrawals || []).filter(function (w) { return !w.verified; });
  var kidOf = function (id) { return (st.kids || []).find(function (x) { return x.id === id; }) || {}; };
  var pendN = pendSubs.length + pendRdms.length + pendUse.length + pendWd.length;
  /* v2.0.50：右上角计数改用与底栏 tab 完全统一的红色圆形角标（原为浅黄胶囊「N 项」，不够醒目） */
  var pendHtml = cardHead('📬', '待处理',
    (pendN ? '<span class="badge">' + pendN + '</span>' : '<span class="chip mint">全部处理完</span>')) +
    (pendN ? '<div class="row wrap" style="gap:6px;margin:2px 2px 10px">' +
      '<span class="chip gray">任务 ' + pendSubs.length + '</span>' +
      '<span class="chip gray">兑换 ' + pendRdms.length + '</span>' +
      '<span class="chip gray">券 ' + pendUse.length + '</span>' +
      '<span class="chip gray">提现 ' + pendWd.length + '</span>' +
      '</div>' : '') +
    (pendSubs.length ? '<div class="tiny muted" style="margin:2px 2px 8px">任务完成</div>' +
      '<div class="grid4">' + pendSubs.map(function (x) { return reviewCard(x, true); }).join('') + '</div>' : '') +
    (pendRdms.length ? '<div class="tiny muted" style="margin:10px 2px 8px">兑换申请</div>' +
      '<div class="grid4">' + pendRdms.map(function (x) { return reviewCard(x, true); }).join('') + '</div>' : '') +
    (pendUse.length ? '<div class="tiny muted" style="margin:10px 2px 8px">券核销（孩子已使用）</div>' +
      pendUse.map(function (r) {
        var kid = kidOf(r.kidId);
        return led({
          icon: h(r.itemEmoji || '🎁'), iconSize: 21, iconW: 30,
          title: h(r.itemName),
          sub: h(kid.avatar || '⭐') + ' ' + h(kid.name || '小朋友') + ' 使用于 ' + when(r.usedAt),
          right: '<button class="btn sm mint" data-act="reward-verify" data-id="' + r.id + '">✅ 核销</button>'
        });
      }).join('') : '') +
    (pendWd.length ? '<div class="tiny muted" style="margin:10px 2px 8px">提现核销（孩子已提取）</div>' +
      pendWd.map(function (w) {
        var kid = kidOf(w.kidId);
        return led({
          icon: '💰', iconSize: 21, iconW: 30,
          title: '提取 ' + w.amount + ' 元',
          sub: h(kid.avatar || '⭐') + ' ' + h(kid.name || '小朋友') + ' · ' + when(w.at) + (w.note ? ' · ' + h(w.note) : ''),
          right: '<button class="btn sm mint" data-act="cash-verify" data-id="' + w.id + '">✅ 核销</button>'
        });
      }).join('') : '') +
    (!pendN ? '<div class="empty emt"><span class="e">🎉</span>没有待处理的事项，真棒！</div>' : '') +
    '</div>';

  /* ---- 积分流水（最近 3 条 + 查看全部弹窗，弹窗内可按 范围 / 孩子 筛选）---- */
  var allLed = (st.ledger || []).slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
  var todayDelta = (k.todayDelta || 0);
  var ledHtml = recCardHtml({
    key: 'led', icon: '📖', title: '积分流水',
    items: allLed,
    rowFn: ledRow,
    chip: '<span class="chip gray">共 ' + allLed.length + ' 条</span>' +
      (todayDelta ? '<span class="chip ' + (todayDelta >= 0 ? 'mint' : 'grape') + '">今日 ' + (todayDelta > 0 ? '+' : '') + fmt(todayDelta) + '</span>' : ''),
    empty: '还没有积分流水',
    filters: [
      { key: 'scope', label: '范围', options: [{ v: 'today', label: '今天' }, { v: 'all', label: '全部' }],
        match: function (l, v) { return v === 'today' ? new Date(l.at).toDateString() === today : true; } },
      (kids.length ? { key: 'kid', label: '孩子', options: kids.map(function (x) { return { v: x.id, label: h(x.avatar) + ' ' + h(x.name) }; }),
        match: function (l, v) { return l.kidId === v; } } : null)
    ].filter(Boolean)
  });

  /* ---- 月度报表 ---- */
  var ms = S.monthStats;
  var msHtml = '';
  if (ms && ms.kids) {
    var rows = ms.kids.map(function (r) {
      return led({
        icon: h(r.avatar), iconSize: 20, iconW: 28,
        title: h(r.name),
        sub: '完成 ' + r.taskCount + ' 次任务<br>兑换 ' + r.redeemCount + ' 次',
        right: '<div class="d up">+' + fmt(r.earned) + '</div>' +
          '<div class="d dn" style="margin-left:6px">-' + fmt(r.spent) + '</div>'
      });
    }).join('');
    msHtml = cardHead('📊', '月度报表',
      '<span class="chip mint">获得 ' + fmt(ms.totalEarned) + '</span>') +
      '<div class="row wrap" style="gap:7px;margin:10px 2px 8px">' +
      '<span class="chip sun">用掉 ' + fmt(ms.totalSpent) + '</span>' +
      '<span class="chip grape">现有 ' + fmt(ms.totalBalance) + '</span>' +
      '</div>' +
      '<div class="row wrap statsrow" style="gap:7px;margin-bottom:11px">' +
      '<span class="chip gray">有记录天数 ' + ms.activeDays + '</span>' +
      '<span class="timefield"><span class="tico">📅</span>' +
      '<input class="inp tinp" type="date" id="statsMonth" value="' + h(ms.month ? ms.month + '-' + String(new Date().getDate()).padStart(2, '0') : '') + '"></span>' +
      '</div>' +
      (rows || '<div class="tiny muted" style="padding:6px 2px">这个月还没有数据</div>') +
      '</div>';
  }

  /* v2.0.58：按用户要求移除总览顶部的「孩子积分卡」；孩子列表仍在下方「孩子账号」区。 */
  return pendHtml + kidAccountsHtml() + ledHtml + msHtml;
}

/* ============================================================ 家长：审核 */
function reviewCard(x, compact) {
  var isSub = !!x.taskTitle;
  var kid = (S.state.kids || []).find(function (k) { return k.id === x.kidId; });
  var kname = kid ? kid.name : '小朋友';
  var title = isSub ? x.taskTitle : x.itemName;
  var icon = isSub ? (x.taskIcon || '⭐') : (x.itemEmoji || '🎁');
  var amt = isSub ? (x.coins || 0) : (x.cost || 0);
  var kidAva = kid ? h(kid.avatar) : '⭐';
  var kidBg = kid ? h(kid.color) + '22' : 'var(--sun1)';
  /* v2.0.48：金额胶囊提到任务名右边，省掉一整行 */
  var amtChip = '<span class="chip sun">' + (isSub ? '至多 +' : '花费 −') + fmt(amt) + ' 积分</span>';
  return '<div class="review' + (isSub ? '' : ' r') + '">' +
    '<div class="rh">' +
    '<div class="rava" style="background:' + kidBg + '">' + kidAva + '</div>' +
    '<div class="rmid"><div class="rt"><span class="rtt">' + h(title) + '</span>' + amtChip + '</div>' +
    '<div class="tiny muted">' + h(kname) + ' · ' + when(x.createdAt) + '</div></div></div>' +
    /* v2.0.58：孩子填写的内容不在卡片里直接显示，改到「通过 / 不通过」弹窗里（此处仅留存取值） */
    (x.note ? '<span class="rnote" style="display:none">' + h(x.note) + '</span>' : '') +
    '<div class="row" style="gap:8px">' +
    '<button class="btn sm mint grow" data-act="approve" data-id="' + x.id + '" data-kind="' + (isSub ? 'sub' : 'rdm') + '" data-coins="' + amt + '">✓ 通过</button>' +
    '<button class="btn sm ghost grow" data-act="reject" data-id="' + x.id + '" data-kind="' + (isSub ? 'sub' : 'rdm') + '" data-coins="' + amt + '">✕ 不通过</button>' +
    '</div></div>';
}
export function adminMessages() {
  var st = S.state;
  var meP = { kind: 'parent', id: st.me.uid };
  var kids = st.kids || [];
  function kidName(id) { var k = kids.find(function (x) { return x.id === id; }); return k ? k.name : '小朋友'; }
  function kidOf(id) { return kids.find(function (x) { return x.id === id; }); }

  var goals = st.goals || [];
  /* v2.0.10：待审核并入总览「待处理」（审核 + 核销一起处理），消息页只留 留言/心愿/记录 */

  /* ---- 心愿 ---- */
  var goalHtml = cardHead('🌟', '心愿',
    (goals.length ? '<span class="chip grape">' + goals.length + ' 个</span>' : '')) +
    (goals.length ? goals.map(function (g) {
      var kd = kidOf(g.kidId);
      var hasT = Number(g.targetCoins) > 0;
      var pct = hasT && kd ? Math.min(100, Math.round(kd.balance / g.targetCoins * 100)) : 0;
      return '<div class="wish">' +
        '<div class="wh">' +
        '<div class="wava">' + h(g.emoji || '🎯') + '</div>' +
        '<div class="wmid"><div class="wt">' + h(g.title) + '</div>' +
        '<div class="ws">' + h(kd ? kd.name : '小朋友') + ' · ' + (hasT
          ? '目标 ' + fmt(g.targetCoins) + ' 积分' + (kd ? '，已攒 ' + fmt(kd.balance) : '')
          : '还没定目标，帮他定一个吧') + '</div></div>' +
        '<span class="chip ' + (hasT ? 'grape' : 'gray') + '">' + (hasT ? pct + '%' : '待定目标') + '</span>' +
        '</div>' +
        (hasT ? '<div class="wbar"><i class="wfill" style="width:' + pct + '%"></i></div>' : '') +
        (g.cheer ? '<div class="tiny" style="margin-top:8px;color:#6b52c4;font-weight:700">💬 ' + h(g.cheer) + '</div>' : '') +
        '<div class="wacts">' +
        '<button class="btn sm sun" data-act="goal-target" data-id="' + g.id + '">🎯 定目标</button>' +
        '<button class="btn sm ghost" data-act="goal-cheer" data-id="' + g.id + '">💪 鼓励</button>' +
        '</div></div>';
    }).join('') : '<div class="empty"><span class="e">🌟</span>还没有心愿<br><span class="tiny">孩子在商城许愿后会出现在这里</span></div>') +
    '</div>';

  /* ---- 留言（微信会话列表：孩子 + 爸爸/妈妈 + 爸爸妈妈群）---- */
  function titleSlot(t) { t = t || ''; return t.indexOf('爸') >= 0 ? 'dad' : (t.indexOf('妈') >= 0 ? 'mom' : ''); }
  var myRow = (st.parents || []).find(function (p) { return p.uid === st.me.uid; });
  var mySlotP = myRow ? titleSlot(myRow.title) : '';
  function convLast(a, b) { return String(b.last ? b.last.at : '').localeCompare(String(a.last ? a.last.at : '')); }

  var convs = kids.map(function (k) {
    var conv = (st.messages || []).filter(function (m) {
      return (m.from.kind === 'kid' && m.from.id === k.id) || (m.to.kind === 'kid' && m.to.id === k.id);
    }).sort(byAtAsc);
    var unread = conv.filter(function (m) { return m.from.kind === 'kid' && !isReadBy(m, meP); }).length;
    return { key: k.id, act: 'msg', name: k.name, ava: k.avatar || '⭐', bg: (k.color || '#FF8FA3') + '22', conv: conv, unread: unread, last: conv[conv.length - 1] };
  });
  ['dad', 'mom'].forEach(function (s) {
    if (s === mySlotP) return;   // 自己的席位不显示
    var holder = (st.parents || []).find(function (p) { return titleSlot(p.title) === s; });
    var conv = (st.messages || []).filter(function (m) {
      return (m.from.kind === 'parent' && m.from.slot === s && m.from.id !== st.me.uid) ||
             (m.to.kind === 'parent' && m.to.slot === s && m.from.id === st.me.uid);
    }).sort(byAtAsc);
    var unread = conv.filter(function (m) { return m.from.kind === 'parent' && m.from.id !== st.me.uid && !isReadBy(m, meP); }).length;
    convs.push({ key: s, act: 'pmsg', name: s === 'dad' ? '爸爸' : '妈妈', ava: s === 'dad' ? '👨' : '👩',
      bg: s === 'dad' ? '#DFF1FD' : '#FFE3EA', conv: conv, unread: unread, last: conv[conv.length - 1],
      dim: !holder });
  });
  {
    var pgConv = (st.messages || []).filter(function (m) { return m.to.kind === 'parents' && m.from.kind === 'parent'; }).sort(byAtAsc);
    var pgUnread = pgConv.filter(function (m) { return m.from.id !== st.me.uid && !isReadBy(m, meP); }).length;
    convs.push({ key: 'pgroup', act: 'pmsg', name: '爸爸妈妈群', ava: '👑', bg: '#FFF0D2', conv: pgConv, unread: pgUnread, last: pgConv[pgConv.length - 1] });
  }
  convs.sort(convLast);

  var msgHtml = cardHead('💬', '留言',
    (st.stats && st.stats.unreadMsg ? '<span class="chip pink">' + st.stats.unreadMsg + ' 条新</span>' : '')) +
    (convs.length ? convs.map(function (c) {
      var last = c.last;
      var prev = last ? ((last.from.kind === 'kid' || (last.from.kind === 'parent' && last.from.id !== st.me.uid) ? '' : '我：') + last.text) : '还没有留言，点这里去说句话';
      return convRow({
        cls: c.dim ? 'is-dim' : '',
        tap: { act: c.act, key: c.act === 'msg' ? 'id' : 'key', val: c.key },
        avaBg: c.bg, ava: c.ava, unread: c.unread,
        name: h(c.name), time: h(last ? wxTime(last.at) : ''), prev: h(prev)
      });
    }).join('') : '<div class="empty"><span class="e">💬</span>还没有会话</div>') +
    '</div>';

  /* ---- 最近处理记录（任务 / 兑换 的审核结果）---- */
  var done = (st.submissions || []).filter(function (s) { return s.status !== 'pending'; })
    .map(function (s) { return { kind: 'sub', at: s.reviewedAt || s.createdAt, kidId: s.kidId, icon: s.taskIcon || '⭐', title: s.taskTitle, status: s.status, reply: s.reply }; });
  var doneR = (st.redemptions || []).filter(function (r) { return r.status !== 'pending'; })
    .map(function (r) { return { kind: 'rdm', at: r.reviewedAt || r.createdAt, kidId: r.kidId, icon: r.itemEmoji || '🎁', title: r.itemName, status: r.status, reply: r.reply }; });
  var histItems = done.concat(doneR).sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
  function histRow(x) {
    var ok = x.status === 'approved';
    return led({
      icon: h(x.icon), iconSize: 22, iconW: 30,
      title: h(kidName(x.kidId)) + ' · ' + h(x.title),
      sub: when(x.at) + (x.reply ? ' · 💬 ' + h(x.reply) : ''),
      right: '<span class="chip ' + (ok ? 'mint' : 'gray') + '">' + (ok ? '已通过' : '未通过') + '</span>'
    });
  }
  var histCard = recCardHtml({
    key: 'hist', icon: '🕘', title: '最近处理记录',
    items: histItems, rowFn: histRow, empty: '还没有处理记录',
    filters: [
      { key: 'typ', label: '类型', options: [{ v: 'sub', label: '任务' }, { v: 'rdm', label: '兑换' }],
        match: function (x, v) { return x.kind === v; } },
      (kids.length ? { key: 'kid', label: '孩子', options: kids.map(function (kk) { return { v: kk.id, label: h(kk.avatar) + ' ' + h(kk.name) }; }),
        match: function (x, v) { return x.kidId === v; } } : null)
    ].filter(Boolean)
  });

  /* ---- 核销记录（券已核销 / 现金已核销，家长操作留痕）---- */
  var vRdm = (st.redemptions || []).filter(function (r) { return r.status === 'approved' && r.itemType !== 'cash' && r.useStatus === 'used' && r.verified; })
    .map(function (r) { return { kind: 'coupon', at: r.verifiedAt || r.usedAt, kidId: r.kidId, icon: r.itemEmoji || '🎁', title: r.itemName }; });
  var vWd = (st.withdrawals || []).filter(function (w) { return w.verified; })
    .map(function (w) { return { kind: 'cash', at: w.verifiedAt || w.at, kidId: w.kidId, icon: '💰', title: '提取 ' + w.amount + ' 元' }; });
  var verifyItems = vRdm.concat(vWd).sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
  function verifyRow(x) {
    return led({
      icon: h(x.icon), iconSize: 21, iconW: 30,
      title: h(kidName(x.kidId)) + ' · ' + h(x.title),
      sub: when(x.at) + ' 核销',
      right: '<span class="chip mint">已核销 ✓</span>'
    });
  }
  var verifyCard = recCardHtml({
    key: 'verify', icon: '✅', title: '核销记录',
    items: verifyItems, rowFn: verifyRow, empty: '还没有核销记录',
    filters: [
      { key: 'typ', label: '类型', options: [{ v: 'coupon', label: '奖励券' }, { v: 'cash', label: '现金' }],
        match: function (x, v) { return x.kind === v; } },
      (kids.length ? { key: 'kid', label: '孩子', options: kids.map(function (kk) { return { v: kk.id, label: h(kk.avatar) + ' ' + h(kk.name) }; }),
        match: function (x, v) { return x.kidId === v; } } : null)
    ].filter(Boolean)
  });

  return msgHtml + goalHtml + histCard + verifyCard;
}

/* ============================================================ 家长：孩子与身份（并入设置） */
/* 孩子账号卡片（v2.0.6 从设置中枢移到总览页） */
function kidAccountsHtml() {
  var st = S.state;
  var kids = st.kids || [];

  var list = kids.length ? kids.map(function (k) {
    var subs = (st.submissions || []).filter(function (s) { return s.kidId === k.id; });
    var pend = subs.filter(function (s) { return s.status === 'pending'; }).length;
    var goals = (st.goals || []).filter(function (g) { return g.kidId === k.id; }).length;
    return '<div class="card tight">' +
      '<div class="item" style="border:none;padding:0">' +
      '<div class="ava" style="background:' + h(k.color) + '22">' + h(k.avatar) + '</div>' +
      '<div class="mid"><div class="t">' + h(k.name) + ' <span style="font-size:12px;font-weight:700;color:var(--ink3)">· 累计赚 ' + fmt(k.totalEarned) + '</span>' + (k.unreadKidMsg ? ' <span class="badge">' + k.unreadKidMsg + '</span>' : '') + '</div>' +
      '<div class="s">' + (k.boundUid ? '🔗 ' + h(k.boundUsername || k.boundUid) + '（UID ' + h(k.boundUid) + '）' : '<span style="color:#e08a3c">⚠️ 未绑定飞牛账号</span>') + '</div>' +
      '<div class="s">' + k.levelInfo.emoji + ' ' + h(k.levelInfo.name) + ' · 心愿 ' + goals + (pend ? ' · 待审核 ' + pend : '') + '</div>' +
      '</div>' +
      '<div class="end"><div style="font-size:20px;font-weight:800;color:#c98a1b">' + fmt(k.balance) + '</div><div class="tiny muted">积分</div></div>' +
      '</div>' +
      '<div class="row wrap" style="margin-top:11px;gap:8px">' +
      '<div class="btngrp">' +
      '<button class="btn sm mint" data-act="give" data-id="' + k.id + '">🪙 发/扣积分</button>' +
      '<button class="btn sm sky" data-act="kid-bind" data-id="' + k.id + '">🔗 ' + (k.boundUid ? '改绑' : '绑定飞牛账号') + '</button>' +
      (k.boundUid && st.isSystemAdmin ? '<button class="btn sm ghost" data-act="kid-unbind" data-id="' + k.id + '">解绑</button>' : '') +
      '</div>' +
      '<div class="btngrp">' +
      '<button class="btn sm ghost" data-act="msg" data-id="' + k.id + '">💬 留言' + (k.unreadKidMsg ? '（' + k.unreadKidMsg + ' 条新）' : '') + '</button>' +
      '<button class="btn sm ghost" data-act="kid-edit" data-id="' + k.id + '">✏️ 编辑</button>' +
      '<button class="btn sm gray" data-act="kid-del" data-id="' + k.id + '">删除</button>' +
      '</div>' +
      '</div></div>';
  }).join('') : '<div class="empty"><span class="e">👶</span>还没有小朋友，点右上角新建一个</div>';

  return cardHead('👦', '孩子账号',
    '<button class="btn xs mint" data-act="kid-new">＋ 新建孩子</button>') +
    '<div class="chip sky" style="margin-bottom:12px;display:inline-flex">🔐 账号管理仅家长（飞牛管理员）可操作</div>' +
    list + '</div>';
}

function adminManageHtml() {
  var st = S.state;
  var seen = st.seenUsers || [];
  var parents = st.parents || [];
  var isBoundToKid = function (u) { return (st.kids || []).some(function (k) { return (k.boundUid && k.boundUid === u.uid) || (!k.boundUid && k.boundUsername && k.boundUsername === u.username); }); };
  var isBoundParent = function (u) { return parents.some(function (p) { return (p.uid && p.uid === u.uid) || (!p.uid && p.username === u.username); }); };
  var unbound = seen.filter(function (u) { return !isBoundToKid(u) && !isBoundParent(u); });

  var parentsList = parents.length ? parents.map(function (p) {
    return '<div class="item"><div class="ava" style="background:var(--sun1)">👑</div>' +
      '<div class="mid"><div class="t">' + h(p.title) + '</div>' +
      '<div class="s">飞牛账号 ' + h(p.username) + (p.uid ? ' · UID ' + h(p.uid) : '') + ' · 绑定于 ' + when(p.boundAt) + '</div></div>' +
      '<div class="end">' + (st.isSystemAdmin ? '<button class="btn xs gray" data-act="parent-unbind" data-uname="' + h(p.username) + '">解绑</button>' : '<span class="tiny muted">仅管理员可解绑</span>') + '</div>' +
      '</div>';
  }).join('') : '<div class="empty"><span class="e">👑</span>还没有绑定家长身份<br><span class="tiny">飞牛管理员自己也是家长，可先给自己绑定称呼（如「爸爸」），留言时孩子会看到称呼</span></div>';

  return cardHead('👑', '家长身份',
    '<button class="btn xs sun" data-act="parent-new">＋ 绑定爸爸/妈妈</button>') +
    '<div class="tiny muted" style="margin-bottom:10px">绑定为「爸爸/妈妈」的飞牛账号和孩子家长权限完全一样；解绑后立即收回权限（解绑仅飞牛管理员账号可操作）。</div>' +
    parentsList + '</div>' +

    cardHead('📡', '来访过但未绑定的飞牛用户',
    (unbound.length ? '<span class="chip sun">' + unbound.length + '</span>' : '')) +
    (unbound.length ? unbound.map(function (u) {
      return '<div class="item"><div class="ava" style="background:var(--sky1)">🧑</div>' +
        '<div class="mid"><div class="t">' + h(u.username) + '</div>' +
        '<div class="s">UID ' + h(u.uid) + ' · 最近访问 ' + when(u.lastSeen) + ' · 共 ' + (u.visits || 1) + ' 次</div></div>' +
        '<div class="end"><div class="row" style="gap:6px;justify-content:flex-end">' +
        '<button class="btn xs sky" data-act="quickbind" data-uid="' + h(u.uid) + '" data-uname="' + h(u.username) + '">绑定给孩子</button>' +
        '<button class="btn xs sun" data-act="quickparent" data-uid="' + h(u.uid) + '" data-uname="' + h(u.username) + '">绑为家长</button>' +
        '</div></div>' +
        '</div>';
    }).join('') : '<div class="empty"><span class="e">✨</span>没有待绑定的用户<br><span class="tiny">让孩子用他自己的飞牛账号打开一次本应用，这里就会出现他的用户名</span></div>') +
    '</div>' +

    (st.me && st.me.isAdmin ?
      cardHead('🧰', '数据与维护') +
      '<div class="tiny muted" style="margin-bottom:10px">仅系统管理员可见。清空操作不可恢复，建议先备份。</div>' +
      '<div class="row wrap" style="gap:8px">' +
      '<button class="btn sm sky" data-act="backup">📦 备份数据</button>' +
      '<button class="btn sm sun" data-act="data-clear">🧹 清空记录</button>' +
      '<button class="btn sm gray" data-act="data-reset">⚠️ 恢复出厂</button>' +
      '</div></div>' : '');
}

/* ============================================================ 家长：设置与管理中枢（功能开关 + 孩子/身份/维护） */
export function openSettingsModal() {
  S._tog_taskNeedsApproval = undefined;
  S._tog_kidCanAddGoal = undefined;
  S._tog_kidCanMessage = undefined;
  openModal({
    title: '⚙️ 设置与管理',
    render: settingsBody,
    okText: '保存',
    cancelText: '关闭',
    focus: false,
    onOk: function (mask, btn) {
      var st = S.state.settings;
      doAct('settings.update', {
        taskNeedsApproval: S._tog_taskNeedsApproval !== undefined ? S._tog_taskNeedsApproval : st.taskNeedsApproval,
        kidCanAddGoal: S._tog_kidCanAddGoal !== undefined ? S._tog_kidCanAddGoal : st.kidCanAddGoal,
        kidCanMessage: S._tog_kidCanMessage !== undefined ? S._tog_kidCanMessage : st.kidCanMessage,
        refundRate: (function () { var v = val('#fRr', mask); return v === '' ? 80 : Number(v); })()
      }, btn, '设置已保存');
    }
  });
}
function settingsBody() {
  var st = S.state.settings;
  function sw(key, label, sub) {
    var on = S['_tog_' + key] !== undefined ? S['_tog_' + key] : !!st[key];
    return '<div class="sw"><div class="mid"><div class="t">' + h(label) + '</div>' +
      (sub ? '<div class="s">' + h(sub) + '</div>' : '') + '</div>' +
      '<div class="tog ' + (on ? 'on' : '') + '" data-act="tog" data-k="' + key + '"></div></div>';
  }
  return cardHead('🎛️', '功能开关') +
    sw('taskNeedsApproval', '任务需要家长审核', '关闭后孩子点完成就立即到账') +
    sw('kidCanAddGoal', '允许孩子自己许愿', '关闭后孩子不能自己许愿') +
    sw('kidCanMessage', '允许孩子给家长留言', '关闭后孩子不能主动留言') +
    '</div>' +
    cardHead('🎟️', '奖励过期') +
    '<div class="field"><label>过期返还比例（%，0~100）</label><input class="inp" id="fRr" type="number" min="0" max="100" value="' + h(st.refundRate != null ? st.refundRate : 80) + '"></div>' +
    '<div class="tiny muted" style="margin:-4px 2px 0">卡券超过有效期会自动消失，按这个比例把积分还给孩子；填 0 = 过期不返还。</div></div>' +
    adminManageHtml();
  }

export function adminTasks() {
  var st = S.state;
  var tasks = st.tasks || [];

  /* v2.0.46：行上按钮改为「编辑 + 上架/下架」，删除收进编辑弹窗底部（三枚按钮）；
     下架状态不再用小字挂在副行，改由下方的「已下架」分区整体表达。 */
  var row = function (t) {
    var listed = !!t.active;
    var typeTxt = t.type === 'weekly' ? '每周可做 ' + (t.limitPerDay || 1) + ' 次'
      : t.type === 'monthly' ? '每月可做 ' + (t.limitPerDay || 1) + ' 次'
        : t.type === 'timed' ? '限时 · 截止 ' + fmtDT(t.expiresAt)
          : t.type === 'once' ? '临时 · 只做一次（今天有效）'
            : '每天可做 ' + (t.limitPerDay || 1) + ' 次';
    return '<div class="taskcard">' +
      '<div class="tc-top"><div class="ii">' + h(t.icon) + '</div>' +
      '<div class="mid"><div class="t">' + h(t.title) + '</div>' +
      '<div class="s">' + typeTxt + '</div></div>' +
      '<div class="pricetag">' + coin(15) + fmt(t.coins) + '</div></div>' +
      '<div class="tc-btns">' +
      '<button class="btn xs ghost" data-act="task-edit" data-id="' + t.id + '">编辑</button>' +
      '<button class="btn xs ' + (listed ? 'ghost' : 'mint') + '" data-act="' + (listed ? 'task-unlist' : 'task-list') + '" data-id="' + t.id + '">' + (listed ? '下架' : '上架') + '</button>' +
      '</div></div>';
  };

  /* 限时 / 临时属于「有期限、一次性的活儿」，跟每日/每周/每月任务分开排，并排在前面 */
  var GROUPS = [
    { k: 'timed', t: '⏳ 限时任务', tip: '有截止时间，到点自动消失，记得盯一下进度' },
    { k: 'temp', t: '✨ 临时任务', tip: '一次性的活儿，只在当天有效，过零点自动消失' },
    { k: 'daily', t: '🔆 每日任务', tip: '每天都能做，做完直接提交' },
    { k: 'weekly', t: '🔁 每周任务', tip: '每周都能做，做完直接提交' },
    { k: 'monthly', t: '📅 每月任务', tip: '每月都能做，做完直接提交' }
  ];
  /* 一个分区内再按任务类型分组（与商城页「已上架 / 已下架 / 已过期」同一套写法） */
  function sectionHtml(arr) {
    return GROUPS.map(function (g) {
      var list = arr.filter(function (t) { return groupOf(t) === g.k; });
      if (!list.length) return '';
      return '<div class="taskcat">' + g.t +
        '<span class="chip gray" style="font-size:12px;padding:1px 8px">' + list.length + '</span>' +
        '<span class="cs"></span></div>' +
        '<div class="tiny muted" style="margin:-5px 2px 9px">' + g.tip + '</div>' +
        '<div class="grid4 taskgrid">' + list.map(row).join('') + '</div>';
    }).join('');
  }

  var on = tasks.filter(function (t) { return !!t.active; });
  var off = tasks.filter(function (t) { return !t.active; });
  var HEAD = 'font-weight:800;font-size:13px;margin:10px 0 8px;color:var(--ink2)';

  /* v2.0.58：「任务清单 + 新建任务」已移到固定页头（render.js 的 fixedPageHead），此处不再重复渲染 */
  return '<div class="card">' +
    '<div class="tiny muted" style="margin-bottom:10px">孩子完成后提交，你在「消息」里确认，积分才到账（可在设置里改成免审）</div>' +
    '<div style="' + HEAD + '">已上架 · 孩子端可见（' + on.length + '）</div>' +
    (sectionHtml(on) || '<div class="empty"><span class="e">📋</span>还没有上架的任务</div>') +
    (off.length ? '<div style="' + HEAD + ';margin-top:16px">已下架 · 方便复用（' + off.length + '）</div>' + sectionHtml(off) : '') +
    '</div>';
}

/* ============================================================ 家长：商店 */
export function adminShop() {
  var st = S.state;
  var shop = st.shop || [];
  var on = shop.filter(function (s) { return !!s.listed; });
  var off = shop.filter(function (s) { return !s.listed; });
  function card(s) {
    var listed = !!s.listed;
    return '<div class="shopcard">' +
      '<div class="em">' + h(s.emoji) + '</div>' +
      '<div class="nm">' + h(s.name) + '</div>' +
      '<div class="pr pricetag" style="justify-content:center">' + coin(16) + fmt(s.cost) + '</div>' +
      '<div class="st">' + (s.stock < 0 ? '不限量' : '剩 ' + s.stock + ' 个') + (s.type === 'cash' ? ' · 现金' : '') + (s.cat === 'goods' ? ' · 实物' : ' · 特权') +
        (s.redeemDeadline ? (redeemExpired(s) ? ' · ⌛ 已过期' : ' · 兑至' + s.redeemDeadline.slice(5, 10)) : '') + (s.useLimitDays ? ' · 有效期' + s.useLimitDays + '天' : '') + '</div>' +
      '<div class="shopbtns">' +
        '<button class="btn xs ' + (listed ? 'ghost' : 'mint') + '" data-act="' + (listed ? 'shop-unlist' : 'shop-list') + '" data-id="' + s.id + '">' + (listed ? '下架' : '上架') + '</button>' +
        '<button class="btn xs ghost" data-act="shop-edit" data-id="' + s.id + '">编辑</button>' +
      '</div></div>';
  }
  function splitHtml(arr, empty) {
    if (!arr.length) return '<div class="tiny muted" style="padding:6px 2px">' + empty + '</div>';
    // 限时（有截止日且未过期，按截止日从近到远）/ 常驻（不限期）/ 已过期（截止日已过，单列便于改期复用）
    var lim = arr.filter(function (s) { return !!s.redeemDeadline && !redeemExpired(s); })
      .sort(function (a, b) { return String(a.redeemDeadline).localeCompare(String(b.redeemDeadline)); });
    var rest = arr.filter(function (s) { return !s.redeemDeadline; });
    var dead = arr.filter(function (s) { return !!s.redeemDeadline && redeemExpired(s); })
      .sort(function (a, b) { return String(b.redeemDeadline).localeCompare(String(a.redeemDeadline)); });
    var h = '';
    var first = true;
    function head(inner) {
      var open = '<div class="taskcat"' + (first ? '' : ' style="margin-top:14px"') + '>';
      first = false;
      return open + inner;
    }
    if (lim.length) h += head('⏳ 限时<span class="cs"></span><span class="tiny muted">兑至 ' +
      lim[0].redeemDeadline.slice(5, 10) + (lim.length > 1 ? ' 等 ' + lim.length + ' 项' : '') + ' 前自动下架</span></div>') +
      '<div class="grid2">' + lim.map(card).join('') + '</div>';
    if (rest.length) h += head('♾️ 常驻<span class="cs"></span></div>') +
      '<div class="grid2">' + rest.map(card).join('') + '</div>';
    if (dead.length) h += head('⌛ 已过期<span class="cs"></span><span class="tiny muted">点「编辑」改期后可重新上架</span></div>') +
      '<div class="grid2">' + dead.map(card).join('') + '</div>';
    return h;
  }
  return cardHead('🎁', '奖励商城',
    '<button class="btn xs mint" data-act="shop-new">＋ 新建奖励</button>') +
    '<div class="tiny muted" style="margin-bottom:12px">孩子用积分兑换，<b>兑换时不会通知你</b>；只有孩子<b>使用</b>奖励时才会给你发站内信。现金类奖励记得准备零钱～</div>' +
    '<div style="font-weight:800;font-size:13px;margin:10px 0 8px;color:var(--ink2)">已上架 · 孩子端可见（' + on.length + '）</div>' +
    splitHtml(on, '还没有上架的奖励，点卡片上的「上架」让某个奖励出现在孩子端') +
    (off.length ? '<div style="font-weight:800;font-size:13px;margin:16px 0 8px;color:var(--ink2)">已下架 · 方便复用（' + off.length + '）</div>' + splitHtml(off, '') : '') +
    '</div>';
}

/* v2.0.60：右侧「涨跌数 + 余额」改用 render.js 的 ledRight（与孩子端 ledRowKid 共用一份实现） */
function ledRow(l) {
  var kid = (S.state.kids || []).find(function (k) { return k.id === l.kidId; });
  return led({
    icon: h(kid ? kid.avatar : '⭐'), iconSize: 20, iconW: 28,
    title: h(l.reason || '积分变动'),
    sub: h(kid ? kid.name : '') + ' · ' + when(l.at),
    right: ledRight(l)
  });
}
/** 拉取月度报表（admin），成功后局部重绘 */
export function loadMonthStats(month) {
  apiAct('stats.month', { month: month || '' }).then(function (res) {
    if (res && res.ok && res.result) {
      S.monthStats = res.result;
      paint(null, true);
      var mi = q('#statsMonth');
      if (mi) mi.value = res.result.month + '-' + String(new Date().getDate()).padStart(2, '0');
    }
  });
}
/* v2.0.49：面额不做换算——家长填多少就是多少；这里只把「孩子花 N 积分换 ¥M」实时写进提示 */
export function LumioFaceHint() {
  try {
    var e = document.getElementById('faceHint'); if (!e) return;
    var ci = document.getElementById('fCost'), yi = document.getElementById('fCy');
    var c = ci ? (Number(ci.value) || 0) : 0;
    var y = yi ? (Number(yi.value) || 0) : 0;
    e.innerHTML = (c > 0 && y > 0)
      ? '孩子花 <b>' + c + '</b> 积分换 <b>¥' + faceYuan(y) + '</b>（面额由你直接填，不做任何换算）。'
      : '面额由你直接填：想 50 积分换 1 元就填 <b>1</b>，想 50 积分换 5 元就填 <b>5</b>。';
  } catch (err) {}
}
