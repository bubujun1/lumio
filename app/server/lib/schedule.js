/* ============================================================
   Lumio 后端 · lib/schedule.js —— 周期与过期：周期键 / 分组 / 过期判定与清理
   分层：L1 日程
   ============================================================ */
'use strict';

const { log, clampInt } = require('./util');
const { DB, shopExpired, redeemDeadlineMs, findKid, addLedger } = require('./db');
const { pushMessage } = require('./messages');

function weekKey(dayStr) {
  // 以「本周周一」的日期作为周期键，单调且稳定
  const d = new Date(dayStr + 'T00:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return 'W' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function periodKeyOf(task, dayStr) {
  if (task.type === 'weekly') return weekKey(dayStr);
  if (task.type === 'monthly') return 'M' + String(dayStr).slice(0, 7);
  if (task.type === 'timed' || task.type === 'once') return '*';
  return dayStr; // daily
}

function periodLabel(task) {
  if (task.type === 'weekly') return '这周';
  if (task.type === 'monthly') return '这个月';
  if (task.type === 'timed' || task.type === 'once') return '';
  return '今天';
}

/** 任务分组：daily 每日 / weekly 每周 / monthly 每月 / timed 限时 / temp 临时（孩子端与家长端统一按此分栏） */
function taskGroup(task) {
  if (task.type === 'timed') return 'timed';
  if (task.type === 'once') return 'temp';
  if (task.type === 'weekly') return 'weekly';
  if (task.type === 'monthly') return 'monthly';
  return 'daily'; // daily 或旧数据一律归到「每日」
}

/** 限时 / 临时任务需要孩子先「接受」再「提交」 */
function acceptRequired(task) {
  return task.type === 'timed' || task.type === 'once';
}

function isExpired(task, atMs) { // timed/once 通用：once 由创建/更新时盖「当天 23:59:59」
  if (!task.expiresAt) return false;
  const t = new Date(task.expiresAt).getTime();
  if (!isFinite(t)) return false;
  return t <= (atMs === undefined ? Date.now() : atMs);
}

/** 过期的限时/临时任务自动销毁（任务本身消失；已提交的记录保留，家长仍可正常审核） */
function purgeExpiredTasks() {
  let total = 0;
  const now = Date.now();
  const dead = DB.tasks.filter((t) => isExpired(t, now)).map((t) => t.id); // timed/once 一起覆盖
  if (dead.length) {
    const deadSet = {};
    dead.forEach((id) => { deadSet[id] = 1; });
    DB.tasks = DB.tasks.filter((t) => !deadSet[t.id]);
    DB.accepts = DB.accepts.filter((a) => !deadSet[a.taskId]);
    log('[task] 限时/临时任务过期自动销毁 ' + dead.length + ' 个：' + dead.join(','));
    total += dead.length;
  }
  total += purgeShopExpiry();
  total += purgeRedemptionExpiry();
  return total;
}

/** 奖励兑换时限到期 → 自动下架（移到「已下架」，便于家长复用） */
function purgeShopExpiry() {
  let n = 0;
  DB.shop.forEach((s) => {
    if (s.listed && shopExpired(s)) {
      s.listed = false;
      n++;
    }
  });
  if (n) log('[shop] 兑换时限到期自动下架 ' + n + ' 个奖励');
  return n;
}

/** 已通过的非现金奖励，超过有效期仍未使用 → 卡券消失，返还 80% 积分 */
function purgeRedemptionExpiry() {
  const dead = DB.redemptions.filter((r) => r.status === 'approved' && r.itemType !== 'cash'
    && r.useStatus !== 'used' && r.useDeadline && redeemDeadlineMs(r.useDeadline) <= Date.now());
  if (!dead.length) return 0;
  DB.redemptions = DB.redemptions.filter((r) => dead.indexOf(r) < 0);
  const rate = clampInt((DB.settings && DB.settings.refundRate) != null ? DB.settings.refundRate : 80, 0, 100);
  dead.forEach((r) => {
    const kid = findKid(r.kidId);
    const cost = Math.max(0, Math.round(Number(r.cost) || 0));
    const refund = Math.round(cost * rate / 100);
    if (kid && refund > 0) {
      kid.balance += refund;
      addLedger(kid, refund, '奖励「' + (r.itemName || '奖励') + '」超过有效期，返还 ' + rate + '% 积分', 'refund', null);
    }
    if (kid) {
      pushMessage({ kind: 'system', id: '', slot: '', name: 'Lumio' },
        { kind: 'kid', id: kid.id, slot: '', name: kid.name },
        '你的奖励「' + (r.itemName || '奖励') + '」超过有效期啦，卡券已消失' +
        (refund > 0 ? '，返还 ' + rate + '% 积分（' + refund + ' 分）' : '，不返还积分'));
    }
  });
  log('[shop] 奖励使用超时自动消失并返还 80% 积分 ' + dead.length + ' 个');
  return dead.length;
}

module.exports = {
  isExpired,
  periodKeyOf,
  acceptRequired,
  taskGroup,
  periodLabel,
  purgeExpiredTasks
};
