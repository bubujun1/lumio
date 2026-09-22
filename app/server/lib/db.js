/* ============================================================
   Lumio 后端 · lib/db.js —— 数据层：结构归一化 / 稳定容器 DB / 存取 / 查找与积分账本
   分层：L1 数据
   ============================================================ */
'use strict';
const fs = require('fs');
const { DATA_DIR, DB_FILE } = require('./config');
const { uid, nowISO, log, str, trimText, clampInt, dayEndISO, localDay } = require('./util');
const { defaultDB, normalizeDB, cashYuanOf, checkSchemaDrift } = require('./normalize');
/* 数据容器：identity 必须稳定 —— 其他模块 require 进来的是同一个对象引用，
   因此禁止整体重赋值（CommonJS 没有 ESM 那样的实时绑定），只做原地更新。 */
const DB = {};
function setDB(next) {
  for (const k of Object.keys(DB)) delete DB[k];
  Object.assign(DB, next);
}
function loadDB() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      setDB(normalizeDB(parsed));
      checkSchemaDrift(parsed);   // P1-#3：启动自检，漂移打到 app.log
      log('[db] loaded kids=' + DB.kids.length + ' ledger=' + DB.ledger.length);
      return DB;
    }
  } catch (e) {
    log('[db] 读取失败，尝试备份并使用新库: ' + (e && e.message));
    try { fs.renameSync(DB_FILE, DB_FILE + '.broken-' + Date.now()); } catch (e2) { /* ignore */ }
  }
  /* v2.0.49：种子库也要过一遍 normalizeDB——否则全新安装的第一次运行里，
     种子现金券根本没有 cashYuan 字段（旧版靠前端「除以汇率」兜底才没露馅）。 */
  setDB(normalizeDB(defaultDB()));
  saveDB();
  log('[db] 初始化新数据库');
  return DB;
}
/* 家长「席位」：孩子端的留言对象固定为 爸爸 / 妈妈 / 爸爸妈妈（群），
   多孩家庭再自动加上兄弟姐妹。家长绑定身份时选「爸爸」或「妈妈」即占住对应席位。 */
function slotOfTitle(title) {
  const t = str(title);
  if (t.indexOf('爸爸') >= 0) return 'dad';
  if (t.indexOf('妈妈') >= 0) return 'mom';
  return '';
}
function saveDB() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(DB), 'utf8');
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    log('[db] 写入失败: ' + (e && e.message));
  }
}
// 「访问留痕」需要落盘（家长端要能看到"谁来过、谁还没绑定"），但不必每个请求都写一次
var _lastAutoSave = 0;
function saveSoon() {
  var t = Date.now();
  if (t - _lastAutoSave < 8000) return;
  _lastAutoSave = t;
  saveDB();
}
/* ------------------------------------------------------------------ 业务 */
function addLedger(kid, delta, reason, kind, ctx, balanceAfter) {
  const entry = {
    id: uid('lg'), kidId: kid.id, delta, balanceAfter: balanceAfter === undefined ? kid.balance : balanceAfter,
    reason: reason, kind: kind || 'manual',
    operatorUid: ctx && ctx.user ? ctx.user.uid : '',
    operatorName: ctx && ctx.user ? ctx.user.username : '',
    at: nowISO()
  };
  DB.ledger.push(entry);
  if (DB.ledger.length > 5000) DB.ledger.splice(0, DB.ledger.length - 5000);
  return entry;
}
function findKid(id) { return DB.kids.find((k) => k.id === id) || null; }
function findTask(id) { return DB.tasks.find((t) => t.id === id) || null; }
function findShop(id) { return DB.shop.find((s) => s.id === id) || null; }
/** 积分 → 现金（元），按 coinsPerYuan 换算，保留 1 位小数 */
function cashYuan(coins) {
  return Math.round((Math.max(0, coins) / Math.max(1, DB.settings.coinsPerYuan)) * 10) / 10;
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
/** 兑换截止时间戳：纯日期（YYYY-MM-DD，来自 <input type="date">）按「当天本地 23:59:59」算，
 *  避免 JS 把纯日期按 UTC 解析，导致北京时间提前 8 小时下架；带时间的 ISO 串按原值精确解析。 */
function redeemDeadlineMs(v) {
  const s = str(v);
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
// 动作 / 重要变更：短窗去抖落盘（P1-#2）——替代"每动作同步整库写"，避免阻塞事件循环。
// 内存态始终是真相源，去抖只影响"落盘时延"（崩溃最多丢 ~1s），不影响读取一致性。
// 优雅退出时由 server.js 的 SIGTERM/SIGINT 处理器调用 flushSave() 同步落盘兜底。
var _saveTimer = null, _savePending = false;
function scheduleSave() {
  _savePending = true;
  if (_saveTimer) return;            // 已有待触发定时器：仅标记，不重置（连续写入时仍按首次排期落盘）
  _saveTimer = setTimeout(flushSave, 1000);
}
function flushSave() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  _savePending = false;
  saveDB();                          // 同步整库写（必要时兜底立即落盘）
}
module.exports = {
  DB,
  shopExpired,
  redeemDeadlineMs,
  findKid,
  addLedger,
  saveSoon,
  slotOfTitle,
  findShop,
  cashYuan,
  shopVisible,
  findTask,
  cashYuanOf,
  defaultDB,
  saveDB,
  loadDB,
  normalizeDB,
  scheduleSave,
  flushSave
};
