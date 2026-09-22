/* ============================================================
   Lumio 后端 · lib/actions/admin.js —— 管理与维护：月度报表、设置、数据清空
   分层：L4 动作
   ============================================================ */
'use strict';

const { HttpError, log, str, localDay, clampInt, trimText } = require('../util');
const { DB, defaultDB } = require('../db');

const actionsAdmin = {
  'data.clear': {
      role: 'admin',
      systemAdminOnly: true,
      run(ctx, p) {
        if (!ctx.user.isAdmin) throw new HttpError(403, '只有系统管理员可以清空数据');
        const scope = p.scope === 'all' ? 'all' : 'records';
        if (scope === 'records') {
          // 清空积分记录与动态，保留家庭成员/孩子/任务/商城/设置
          DB.submissions = [];
          DB.redemptions = [];
          DB.ledger = [];
          DB.messages = [];
          DB.goals = [];
          DB.accepts = [];
          DB.withdrawals = []; // 现金提取（待核销）记录一并清空
          DB.kids.forEach((k) => { k.balance = 0; k.totalEarned = 0; k.cash = 0; });
          return { scope: 'records' };
        }
        const fresh = defaultDB();
        Object.keys(fresh).forEach((key) => { DB[key] = fresh[key]; });
        log('[db] 已恢复出厂设置（by ' + ctx.user.username + '）');
        return { scope: 'all' };
      }
    },
  'stats.month': {
      role: 'admin',
      run(ctx, p) {
        const month = /^\d{4}-\d{2}$/.test(str(p.month)) ? str(p.month) : localDay().slice(0, 7);
        const inMonth = (iso) => localDay(iso).slice(0, 7) === month;
        const led = DB.ledger.filter((l) => inMonth(l.at));
        const subs = DB.submissions.filter((s) => s.status === 'approved' && inMonth(s.createdAt));
        const rdms = DB.redemptions.filter((r) => r.status === 'approved' && inMonth(r.createdAt));
        const kids = DB.kids.map((k) => {
          const kl = led.filter((l) => l.kidId === k.id);
          const earned = kl.filter((l) => l.delta > 0).reduce((s, l) => s + l.delta, 0);
          const spent = kl.filter((l) => l.delta < 0).reduce((s, l) => s - l.delta, 0);
        return {
          kidId: k.id, name: k.name, avatar: k.avatar,
          earned, spent, balance: k.balance || 0,
          taskCount: subs.filter((s) => s.kidId === k.id).length,
          redeemCount: rdms.filter((r) => r.kidId === k.id).length
        };
      });
      const activeDays = new Set(led.map((l) => localDay(l.at))).size;
      return {
        month,
        kids,
        totalEarned: kids.reduce((s, k) => s + k.earned, 0),
        totalSpent: kids.reduce((s, k) => s + k.spent, 0),
        totalBalance: DB.kids.reduce((s, k) => s + (k.balance || 0), 0),
        activeDays,
        today: localDay()
      };
      }
    },
  'settings.update': {
      role: 'admin',
      run(ctx, p) {
        const s = DB.settings;
        if (p.coinsPerYuan !== undefined) {
          s.coinsPerYuan = clampInt(p.coinsPerYuan, 1, 10000, s.coinsPerYuan);
          // v2.0.49：现金面额不再跟随汇率重算——面额由家长逐条直接填写，改汇率不得动它
        }
        if (p.refundRate !== undefined) s.refundRate = clampInt(p.refundRate, 0, 100, s.refundRate);
        if (p.familyName !== undefined) s.familyName = trimText(p.familyName, 20) || s.familyName;
        if (p.parentTitle !== undefined) s.parentTitle = trimText(p.parentTitle, 20) || s.parentTitle;
        if (p.taskNeedsApproval !== undefined) s.taskNeedsApproval = !!p.taskNeedsApproval;
        // redeemNeedsApproval：v2.0.6 起兑换免审，字段仅保留兼容旧数据，无 UI 入口也不再参与逻辑
        if (p.kidCanAddGoal !== undefined) s.kidCanAddGoal = !!p.kidCanAddGoal;
        if (p.kidCanMessage !== undefined) s.kidCanMessage = !!p.kidCanMessage;
        if (p.weeklyGoal !== undefined) s.weeklyGoal = clampInt(p.weeklyGoal, 1, 100000, s.weeklyGoal);
        if (p.rulesText !== undefined) s.rulesText = trimText(p.rulesText, 600) || s.rulesText;
        return {};
      }
    }
};

module.exports = actionsAdmin;
