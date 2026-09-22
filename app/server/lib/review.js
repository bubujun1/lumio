/* ============================================================
   Lumio 后端 · lib/review.js —— 审核域：任务提交与兑换申请的通过/驳回结算
   分层：L2 审核
   ============================================================ */
'use strict';

const { HttpError, clampInt, nowISO, trimText, localDay } = require('./util');
const { findKid, addLedger, findShop, cashYuan } = require('./db');

/** 审核：通过孩子提交的任务完成申请（granted 可选：家长酌情调整实发积分，只能 0~原定值） */
function approveSubmission(sub, ctx, reply, granted) {
  if (sub.status !== 'pending') throw new HttpError(409, '这条申请已经处理过了');
  const kid = findKid(sub.kidId);
  if (!kid) throw new HttpError(404, '找不到对应的孩子');
  const planned = Math.max(0, Math.round(Number(sub.coins) || 0));
  let coins = planned;
  if (granted !== undefined && granted !== null && granted !== '') {
    coins = clampInt(granted, 0, planned, planned);
  }
  kid.balance += coins;
  kid.totalEarned += coins;
  sub.status = 'approved';
  sub.reviewedAt = nowISO();
  sub.granted = coins; // 留痕：任务原定 sub.coins，实发 sub.granted
  if (reply) sub.reply = trimText(reply, 120);
  let reason = '完成任务：' + (sub.taskTitle || '任务');
  if (coins < planned) reason += '（原定 ' + planned + ' 分，家长调整为 ' + coins + ' 分）';
  addLedger(kid, coins, reason, 'task', ctx);
  return { kid, coins, planned };
}

/** 审核：通过兑换申请 */
function approveRedemption(rdm, ctx, reply) {
  if (rdm.status !== 'pending') throw new HttpError(409, '这条申请已经处理过了');
  const kid = findKid(rdm.kidId);
  if (!kid) throw new HttpError(404, '找不到对应的孩子');
  const item = findShop(rdm.itemId);
  if (item && item.stock >= 0 && item.stock <= 0) {
    throw new HttpError(409, '「' + item.name + '」已经没有库存了');
  }
  const cost = Math.max(0, Math.round(Number(rdm.cost) || 0));
  if (kid.balance < cost) throw new HttpError(409, kid.name + ' 的积分不够啦（差 ' + (cost - kid.balance) + ' 个）');
  kid.balance -= cost;
  rdm.status = 'approved';
  rdm.reviewedAt = nowISO();
  if (reply) rdm.reply = trimText(reply, 120);
  if (item && item.stock >= 0) {
    item.stock -= (rdm.qty || 1);
    if (item.stock <= 0) item.listed = false; // 兑换完自动下架，进入「已下架」方便复用
  }
  const isCash = (item && item.type === 'cash') || rdm.itemType === 'cash';
  if (!isCash && item && item.useLimitDays > 0) {
    // 限期使用：兑换当天算第 1 天，到第 N 天的 24:00（本地日末，存纯日期）
    const ed = new Date();
    ed.setDate(ed.getDate() + item.useLimitDays - 1);
    rdm.useDeadline = localDay(ed);
  }
  if (isCash) {
    // 现金奖励：积分换成现金存入孩子的钱包（元），之后可在「我的」里提取
    const faceYuan = Number(rdm.cashYuan) || 0;
    const gainYuan = faceYuan > 0 ? Math.round(faceYuan * (rdm.qty || 1) * 10) / 10 : cashYuan(cost);
    kid.cash = Math.round(((kid.cash || 0) + gainYuan) * 10) / 10;
    rdm.useStatus = '';
    rdm.usedAt = '';
    addLedger(kid, -cost, '兑换：现金 ' + gainYuan + ' 元', 'redeem', ctx);
  } else {
    // 实物/权益奖励：成为孩子的资产，待孩子使用
    rdm.useStatus = 'unused';
    rdm.usedAt = '';
    addLedger(kid, -cost, '兑换：' + (rdm.itemName || '奖励'), 'redeem', ctx);
  }
  return { kid, cost, isCash };
}

module.exports = {
  approveSubmission,
  approveRedemption
};
