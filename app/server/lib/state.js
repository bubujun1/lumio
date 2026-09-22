/* ============================================================
   Lumio 后端 · lib/state.js —— 状态组装：家长端 / 孩子端整页 state
   分层：L3 状态
   ============================================================ */
'use strict';

const { localDay } = require('./util');
const { levelOf } = require('./level');
const { DB, shopVisible } = require('./db');
const { isExpired, periodKeyOf, acceptRequired, taskGroup, periodLabel } = require('./schedule');
const { meRef, memberKey, msgVisible, messagesFor, unreadCountFor, kidRecipients } = require('./messages');
const { weekStartDay, streakDays, badgesOf } = require('./stats');
const { AVATARS, KID_COLORS } = require('./constants');

/* ------------------------------------------------------------ 状态构建 */

function decorateKid(k) {
  return Object.assign({}, k, { levelInfo: levelOf(k.totalEarned), yuan: (k.balance / Math.max(1, DB.settings.coinsPerYuan)) });
}

function buildAdminState(ctx) {
  const today = localDay();
  const me = meRef(ctx);
  const myKey = memberKey(me);
  const kids = DB.kids.map(function (k) {
    return Object.assign(decorateKid(k), {
      unreadKidMsg: DB.messages.filter((m) => m.from.kind === 'kid' && m.from.id === k.id
        && msgVisible(m, me) && m.readBy.indexOf(myKey) < 0).length
    });
  });
  const balanceTotal = kids.reduce((s, k) => s + k.balance, 0);
  const todayDelta = DB.ledger.filter((l) => localDay(l.at) === today).reduce((s, l) => s + l.delta, 0);
  const pendingSubs = DB.submissions.filter((s) => s.status === 'pending');
  const pendingRdms = DB.redemptions.filter((r) => r.status === 'pending');
  // 与前端总览「待处理」保持同一口径（任务 + 兑换 + 券核销 + 提现核销）：
  // 否则孩子用了券 / 提了现，导航徽标不亮，家长容易漏核销
  const pendingUses = DB.redemptions.filter((r) => r.useStatus === 'used' && !r.verified);
  const pendingWds = DB.withdrawals.filter((w) => !w.verified);
  return {
    role: 'admin',
    me: ctx.user,
    meTitle: ctx.role === 'parent' ? ctx.parent.title : '管理员',
    isSystemAdmin: !!ctx.user.isAdmin,
    /* v2.0.61：头像 / 配色候选下发给前端——constants.js 是唯一来源，前端不再自留副本。
       AVATARS 是含 ⭐ 的 13 项校验白名单，⭐ 只作默认 / 家长头像，不给孩子选，这里剔除。 */
    consts: { avatars: AVATARS.filter(function (a) { return a !== '\u2B50'; }), colors: KID_COLORS.slice() },
    settings: DB.settings,
    parents: DB.parents.slice().sort((a, b) => String(a.boundAt).localeCompare(String(b.boundAt))),
    kids,
    tasks: DB.tasks.slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    shop: DB.shop.slice().sort((a, b) => a.cost - b.cost),
    submissions: DB.submissions.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 300),
    redemptions: DB.redemptions.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 300),
    withdrawals: DB.withdrawals.slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 200),
    ledger: DB.ledger.slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 300),
    goals: DB.goals.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    messages: messagesFor(ctx).slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 200),
    seenUsers: DB.seenUsers.filter((u) => !u.isAdmin).slice().sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen))),
    stats: {
      kidCount: kids.length,
      balanceTotal,
      todayDelta,
      pendingCount: pendingSubs.length + pendingRdms.length + pendingUses.length + pendingWds.length,
      unboundCount: DB.seenUsers.filter((u) => !u.isAdmin
        && !DB.kids.some((k) => k.boundUid === u.uid || (!k.boundUid && k.boundUsername === u.username))
        && !DB.parents.some((p) => (p.uid && p.uid === u.uid) || (!p.uid && p.username === u.username))).length,
      unreadMsg: unreadCountFor(ctx),
      coinCount: DB.ledger.length
    }
  };
}

function buildKidState(ctx) {
  const kid = ctx.kid;
  const today = localDay();
  const tasks = DB.tasks
    .filter((t) => t.active && !isExpired(t))
    .map((t) => {
      const mine = DB.submissions.filter((s) => s.taskId === t.id && s.kidId === kid.id);
      const curKey = periodKeyOf(t, today);
      const periodCount = mine.filter((s) => s.status !== 'rejected' && periodKeyOf(t, s.day) === curKey).length;
      const lastToday = mine.filter((s) => s.day === today).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
      const lastPeriod = mine.filter((s) => periodKeyOf(t, s.day) === curKey).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
      const req = acceptRequired(t);
      const accepted = req ? DB.accepts.some((a) => a.taskId === t.id && a.kidId === kid.id) : true;
      const periodStatus = lastPeriod ? lastPeriod.status : '';
      const canSubmit = periodCount < t.limitPerDay;
      let phase = 'submit';
      if (!accepted) phase = 'accept';
      else if (periodStatus === 'pending') phase = 'reviewing';
      else if (!canSubmit) phase = 'done';
      return Object.assign({}, t, {
        group: taskGroup(t),
        acceptRequired: req,
        accepted: accepted,
        phase: phase,
        todayCount: periodCount,
        canSubmit: canSubmit,
        todayStatus: lastToday ? lastToday.status : '',
        periodStatus: periodStatus,
        periodLabel: periodLabel(t)
      });
    });
  return {
    role: 'kid',
    me: ctx.user,
    settings: {
      coinsPerYuan: DB.settings.coinsPerYuan,
      familyName: DB.settings.familyName,
      parentTitle: DB.settings.parentTitle,
      kidCanAddGoal: DB.settings.kidCanAddGoal,
      kidCanMessage: DB.settings.kidCanMessage,
      redeemNeedsApproval: DB.settings.redeemNeedsApproval,
      taskNeedsApproval: DB.settings.taskNeedsApproval,
      weeklyGoal: DB.settings.weeklyGoal,
      rulesText: DB.settings.rulesText
    },
    kid: decorateKid(kid),
    tasks,
    recipients: kidRecipients(ctx),
    shop: DB.shop.filter((s) => shopVisible(s)).slice().sort((a, b) => a.cost - b.cost),
    submissions: DB.submissions.filter((s) => s.kidId === kid.id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 80),
    redemptions: DB.redemptions.filter((r) => r.kidId === kid.id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 80),
    wallet: {
      cash: kid.cash || 0,
      withdrawals: DB.withdrawals.filter((w) => w.kidId === kid.id)
        .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 40)
    },
    ledger: DB.ledger.filter((l) => l.kidId === kid.id)
      .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 120),
    goals: DB.goals.filter((g) => g.kidId === kid.id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    messages: messagesFor(ctx)
      .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 60),
    unreadParentMessages: unreadCountFor(ctx),
    stats: (function () {
      const ws = weekStartDay();
      const weekEarned = DB.ledger.filter((l) => l.kidId === kid.id && l.delta > 0 && localDay(l.at) >= ws)
        .reduce((s, l) => s + l.delta, 0);
      return {
        myPending: DB.submissions.filter((s) => s.kidId === kid.id && s.status === 'pending').length
          + DB.redemptions.filter((r) => r.kidId === kid.id && r.status === 'pending').length,
        weekEarned: weekEarned,
        streak: streakDays(kid.id),
        badges: badgesOf(kid),
        acceptedTasks: DB.accepts.filter((a) => a.kidId === kid.id).length
      };
    })()
  };
}

function buildState(ctx) {
  if (ctx.role === 'admin' || ctx.role === 'parent') return buildAdminState(ctx);
  if (ctx.role === 'kid') return buildKidState(ctx);
  return { role: ctx.role, me: ctx.user || null, settings: { familyName: DB.settings.familyName } };
}

module.exports = {
  buildState
};
