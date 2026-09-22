/* ============================================================
   Lumio 后端 · lib/constants.js —— 业务常量：头像与配色白名单 / 家长槽位 / 任务类型
   分层：L0 常量
   ============================================================ */
'use strict';

// 头像白名单（共 13 项）。注意与前端「可选列表」并不逐项一致：
//   前端 js/core.js 的 KID_AVATARS 是 12 项（不含 ⭐），⭐ 作为默认/家长头像只出现在后端白名单里。
//   这里只做「提交值是否在白名单内」的校验，不在白名单内的会被静默换成默认头像。
const AVATARS = ['⭐', '🐰', '🐻', '🐼', '🦊', '🐯', '🐨', '🐮', '🐸', '🐵', '🦄', '🐧'];
const KID_COLORS = ['#FF8FA3', '#7EC8F0', '#7BD3A9', '#FFC85C', '#B29BF0', '#FF9E6D'];
const SLOT_LABEL = { dad: '爸爸', mom: '妈妈' };

/* 任务对全部孩子生效。
 *  常驻：daily / weekly / monthly —— 按周期反复可做，直接提交
 *  限时：timed —— 带截止时间（expiresAt），过期自动销毁，需先「接受」
 *  临时：once  —— 只做一次、当天有效（创建当天 23:59:59 过后自动销毁），需先「接受」；
 *        已提交的审核请求保留，家长跨零点仍可正常审核，通过即入账（记录在案） */
const TASK_TYPES = ['daily', 'weekly', 'monthly', 'timed', 'once'];

module.exports = {
  TASK_TYPES,
  SLOT_LABEL,
  AVATARS,
  KID_COLORS
};
