/* ============================================================
   Lumio 后端 · lib/shop-domain.js —— 商城域：可见性 / 过期 / 截止时间戳 / 现金面额
   分层：L1 域（纯判断 + 面额换算，不依赖 DB 容器，可被 db.js 安全 re-export）
   说明：原 db.js 里夹带的「商城是否可见 / 是否过期 / 兑换截止时间戳」等领域判断抽到此，
        使 db.js 回归纯粹的数据存取层；cashYuanOf 仍定义在 normalize.js，这里统一 re-export。
   ============================================================ */
'use strict';

const { cashYuanOf } = require('./normalize');

/** 兑换截止时间戳：纯日期（YYYY-MM-DD，来自 <input type="date">）按「当天本地 23:59:59」算，
 *  避免 JS 把纯日期按 UTC 解析，导致北京时间提前 8 小时下架；带时间的 ISO 串按原值精确解析。 */
function redeemDeadlineMs(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999).getTime();
  const t = Date.parse(s);
  return isFinite(t) ? t : NaN;
}
/** 奖励兑换时限是否已过期（截止日当天全天有效，次日 0 点后才算过期） */
function shopExpired(s) {
  if (!s) return false;
  const t = redeemDeadlineMs(s.redeemDeadline);
  return isFinite(t) && t <= Date.now();
}
/** 奖励是否对孩子可见：已上架 + 未过期 + 有库存 */
function shopVisible(s) {
  if (!s) return false;
  if (s.active === false) return false;
  const listed = (s.listed === undefined) ? true : !!s.listed; // 兼容 v2.0.5 旧数据/种子：无 listed 视为已上架
  if (!listed) return false;
  if (s.stock === 0) return false;
  if (shopExpired(s)) return false;
  return true;
}

module.exports = {
  cashYuanOf,
  redeemDeadlineMs,
  shopExpired,
  shopVisible
};
