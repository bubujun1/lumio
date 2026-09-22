/* ============================================================
   Lumio 后端 · lib/stats.js —— 统计域：周起始 / 连续打卡 / 徽章
   分层：L2 统计
   ============================================================ */
'use strict';

const { localDay } = require('./util');
const { DB } = require('./db');

/* ------------------------------------------------------------ 成长统计 */

/** 本周一（本地时区）的 YYYY-MM-DD */
function weekStartDay() {
  const d = new Date();
  const wd = (d.getDay() + 6) % 7; // 周一=0
  d.setDate(d.getDate() - wd);
  return localDay(d);
}

/** 连续打卡天数：从今天（或昨天）往前数，每天都要有已通过的任务提交 */
function streakDays(kidId) {
  const days = new Set(DB.submissions
    .filter((s) => s.kidId === kidId && s.status === 'approved')
    .map((s) => s.day));
  if (!days.size) return 0;
  const d = new Date();
  if (!days.has(localDay(d))) d.setDate(d.getDate() - 1); // 今天还没打卡不打断连击
  let n = 0;
  while (days.has(localDay(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/** 成就徽章（按数据即时计算，无需存储） */
function badgesOf(kid) {
  const subs = DB.submissions.filter((s) => s.kidId === kid.id && s.status === 'approved');
  const streak = streakDays(kid.id);
  const redeemed = DB.redemptions.some((r) => r.kidId === kid.id && r.status === 'approved');
  return [
    { id: 'first', icon: '🌱', name: '第一份收获', got: subs.length >= 1 },
    { id: 'streak3', icon: '🔥', name: '连续3天', got: streak >= 3 },
    { id: 'streak7', icon: '🚀', name: '连续7天', got: streak >= 7 },
    { id: 'streak21', icon: '🏆', name: '连续21天', got: streak >= 21 },
    { id: 'earn100', icon: '💯', name: '攒到100积分', got: kid.totalEarned >= 100 },
    { id: 'earn500', icon: '🌟', name: '攒到500积分', got: kid.totalEarned >= 500 },
    { id: 'redeem1', icon: '🛍️', name: '第一次兑换', got: redeemed },
    { id: 'diligent', icon: '🧸', name: '完成20次任务', got: subs.length >= 20 }
  ];
}

module.exports = {
  weekStartDay,
  streakDays,
  badgesOf
};
