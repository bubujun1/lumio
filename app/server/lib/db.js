/* ============================================================
   Lumio 后端 · lib/db.js —— 数据层：结构归一化 / 稳定容器 DB / 存取 / 查找与积分账本
   分层：L1 数据
   ============================================================ */
'use strict';
const fs = require('fs');
const { DATA_DIR, DB_FILE } = require('./config');
const { uid, nowISO, log, str, trimText, clampInt, dayEndISO, localDay } = require('./util');
const { defaultDB, normalizeDB, checkSchemaDrift } = require('./normalize');
/* 商城域谓词（可见性 / 过期 / 截止时间戳 / 现金面额）下沉到 shop-domain.js（L1），
   db.js 仅做数据层，不再夹带领域判断；这里重新导出以保持对旧调用方的兼容。 */
const { cashYuanOf, shopExpired, shopVisible, redeemDeadlineMs } = require('./shop-domain');
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
/* 账本滚动上限：kid.balance 才是积分的真相源，ledger 仅保留近期流水用于展示与追溯；
   超过上限时从头部丢弃最旧记录，不影响当前余额或任何统计（W1 收敛：静默裁剪改为显式常量 + 语义说明）。 */
const LEDGER_CAP = 5000;
function addLedger(kid, delta, reason, kind, ctx, balanceAfter) {
  const entry = {
    id: uid('lg'), kidId: kid.id, delta, balanceAfter: balanceAfter === undefined ? kid.balance : balanceAfter,
    reason: reason, kind: kind || 'manual',
    operatorUid: ctx && ctx.user ? ctx.user.uid : '',
    operatorName: ctx && ctx.user ? ctx.user.username : '',
    at: nowISO()
  };
  DB.ledger.push(entry);
  if (DB.ledger.length > LEDGER_CAP) DB.ledger.splice(0, DB.ledger.length - LEDGER_CAP);
  return entry;
}
/** 原子调整积分余额并写账本：先改余额，再以最新余额作为 balanceAfter 落账本，
 *  杜绝「改了余额忘了写账本」或「账本余额与真实余额漂移」的回归（v1.0.0 coin.adjust 账实不符同类问题）。
 *  注意：totalEarned 等累计指标由调用方按业务语义自行处理（仅 earn 路径累加），本函数只负责「余额+账本」这对不变量。 */
function adjustBalance(kid, delta, reason, kind, ctx) {
  kid.balance += delta;
  return addLedger(kid, delta, reason, kind, ctx);
}
function findKid(id) { return DB.kids.find((k) => k.id === id) || null; }
function findTask(id) { return DB.tasks.find((t) => t.id === id) || null; }
function findShop(id) { return DB.shop.find((s) => s.id === id) || null; }
/* -------------------------------------------------------- 数据访问助手（DAL）
   把所有对 DB.<col> 的就地增删改集中收口，避免散落在各 action 里的 filter 赋值漂移、
   以及跨表级联删除（删孩子要清 8 张关联表）遗漏某一处导致无主脏数据。 */
/** 删除孩子并级联清理其全部关联记录（与 v1.0.0 修复的孤儿 accepts 同思路：删除必须连带清理） */
function deleteKid(id) {
  DB.kids = DB.kids.filter((x) => x.id !== id);
  DB.submissions = DB.submissions.filter((x) => x.kidId !== id);
  DB.redemptions = DB.redemptions.filter((x) => x.kidId !== id);
  DB.ledger = DB.ledger.filter((x) => x.kidId !== id);
  DB.goals = DB.goals.filter((x) => x.kidId !== id);
  DB.messages = DB.messages.filter((m) => !((m.from && m.from.kind === 'kid' && m.from.id === id)) && !((m.to && m.to.kind === 'kid' && m.to.id === id)));
  DB.accepts = DB.accepts.filter((a) => a.kidId !== id);
  DB.withdrawals = DB.withdrawals.filter((w) => w.kidId !== id);
}
/** 按用户名解绑家长，返回是否真的删除了（未找到返回 false，便于 action 抛 404） */
function deleteParent(username) {
  const before = DB.parents.length;
  DB.parents = DB.parents.filter((x) => x.username !== username);
  return DB.parents.length !== before;
}
function deleteShop(id) { DB.shop = DB.shop.filter((s) => s.id !== str(id)); }
/** 删除任务：连带清 accepts；保留已通过审核的提交记录（家长仍可追溯），未通过的提交一并清除 */
function deleteTask(id) {
  DB.tasks = DB.tasks.filter((t) => t.id !== id);
  DB.submissions = DB.submissions.filter((s) => s.taskId !== id || s.status === 'approved');
  DB.accepts = DB.accepts.filter((a) => a.taskId !== id);
}
function deleteGoal(id) { DB.goals = DB.goals.filter((x) => x.id !== str(id)); }
/** 清空所有动态与积分记录，保留家庭成员 / 孩子 / 任务 / 商城 / 设置，并清零孩子余额 */
function clearRecords() {
  DB.submissions = [];
  DB.redemptions = [];
  DB.ledger = [];
  DB.messages = [];
  DB.goals = [];
  DB.accepts = [];
  DB.withdrawals = [];
  DB.kids.forEach((k) => { k.balance = 0; k.totalEarned = 0; k.cash = 0; });
}
/** 恢复出厂设置（整库替换为默认结构） */
function resetDB() {
  const fresh = defaultDB();
  Object.keys(fresh).forEach((key) => { DB[key] = fresh[key]; });
  return fresh;
}
/** 数据统计：供 /debug 诊断页只读展示（避免 http 层直接戳 DB） */
function dbStats() {
  return { kids: DB.kids.length, ledger: DB.ledger.length, seenUsers: DB.seenUsers.length };
}
/** 导出整库 JSON 字符串：供 /api/backup 下载（避免 http 层直接序列化 DB） */
function dumpDB() {
  return JSON.stringify(DB, null, 1);
}
/** 积分 → 现金（元），按 coinsPerYuan 换算，保留 1 位小数 */
function cashYuan(coins) {
  return Math.round((Math.max(0, coins) / Math.max(1, DB.settings.coinsPerYuan)) * 10) / 10;
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
  adjustBalance,
  saveSoon,
  slotOfTitle,
  findShop,
  findTask,
  cashYuan,
  shopVisible,
  cashYuanOf,
  defaultDB,
  saveDB,
  loadDB,
  normalizeDB,
  scheduleSave,
  flushSave,
  deleteKid,
  deleteParent,
  deleteShop,
  deleteTask,
  deleteGoal,
  clearRecords,
  resetDB,
  dbStats,
  dumpDB
};
