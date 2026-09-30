/* ============================================================
   Lumio 后端 · lib/schedule-core.js —— 任务/周期纯函数（无副作用）
   分层：L0 基础（不依赖 db / messages，供 L1 schedule 与 L3 state 共用）
   说明：原 schedule.js 里的纯计算函数抽出此处，使 state.js 不再 require schedule（L3→L1），
        避免在状态组装层引入对数据层的直接依赖。
   ============================================================ */
'use strict';

/** 以「本周周一」的日期作为周期键，单调且稳定 */
function weekKey(dayStr) {
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

/** 任务分组：daily 每日 / weekly 每周 / monthly 每月 / timed 限时 / temp 临时 */
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

module.exports = {
  weekKey,
  periodKeyOf,
  periodLabel,
  taskGroup,
  acceptRequired,
  isExpired
};
