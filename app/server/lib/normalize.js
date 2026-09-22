/* ============================================================
   Lumio 后端 · lib/normalize.js —— 数据层：默认结构 + 迁移/归一化
   抽自 db.js（v2.0.64）：把「默认 schema + normalizeDB 白名单」这一
   高风险、需随新增持久字段同步维护白名单的模块独立出来，便于定位与查错。
   仅依赖 util / constants，绝不反向 require db.js（避免循环依赖）。
   ============================================================ */
'use strict';
const { uid, nowISO, log, str, trimText, clampInt, dayEndISO, localDay } = require('./util');
const { TASK_TYPES } = require('./constants');
/* ------------------------------------------------------------------ 数据 */
function defaultDB() {
  const t = (title, icon, coins, limit, cat) => ({
    id: uid('task'), title, icon, coins, type: 'daily',
    cat: ['habit', 'chore', 'read'].indexOf(cat) >= 0 ? cat : 'habit',
    fbMode: cat === 'read' ? 'req' : 'none',
    limitPerDay: limit || 1, expiresAt: '',
    active: true, createdAt: nowISO()
  });
  const s = (name, emoji, cost, stock, type, cat) => ({
    id: uid('shop'), name, emoji, cost, stock, type: type || 'item',
    cat: ['privilege', 'goods'].indexOf(cat) >= 0 ? cat : (type === 'cash' ? 'goods' : 'privilege'),
    listed: true, active: true, createdAt: nowISO()
  });
  return {
    version: 1,
    seeded: true,
    createdAt: nowISO(),
    settings: {
      coinsPerYuan: 10,
      refundRate: 80,
      familyName: '我们家',
      parentTitle: '爸爸妈妈',
      taskNeedsApproval: true,
      redeemNeedsApproval: false, // v2.0.6 起兑换免审，此字段仅保留兼容旧数据，不再参与逻辑
      kidCanAddGoal: true,
      kidCanMessage: true,
      weeklyGoal: 50,
      rulesText: '我们家的积分小约定\n1、完成任务就能赚积分，做越多赚越多\n2、积分可以换特权奖励（比如多看一集动画片）\n3、偶尔忘记做没关系，第二天继续就很棒\n4、扣分只是提醒，改正了就是好孩子',
    },
    kids: [],
    tasks: [
      t('自己整理房间', '🧹', 5, 1, 'chore'),
      t('认真完成作业', '📚', 10, 1, 'read'),
      t('早晚认真刷牙', '🪥', 3, 2, 'habit'),
      t('帮忙摆碗筷', '🍽️', 3, 1, 'chore'),
      t('阅读30分钟', '📖', 8, 1, 'read'),
      t('户外运动30分钟', '🏃', 8, 1, 'habit')
    ],
    shop: [
      s('看动画片30分钟', '📺', 20, -1, 'item', 'privilege'),
      s('玩平板30分钟', '🎮', 30, -1, 'item', 'privilege'),
      s('免做一次家务', '🛋️', 25, -1, 'item', 'privilege'),
      s('选一样小零食', '🍬', 15, -1, 'item', 'goods'),
      s('兑换现金 1 元', '💰', 10, -1, 'cash', 'goods'),
      s('周末去公园野餐', '🧺', 200, 4, 'item', 'goods')
    ],
    submissions: [],
    redemptions: [],
    withdrawals: [],
    ledger: [],
    goals: [],
    messages: [],
    accepts: [],
    seenUsers: [],
    parents: []
  };
}
/** 消息收件人引用：
 *  kind = parent（某位家长 / 某个席位，seat 用 slot='dad'|'mom'）
 *       | kid（某个孩子，含兄弟姐妹）
 *       | parents（所有家长，群聊） */
function refOf(v) {
  const o = v && typeof v === 'object' ? v : {};
  const kind = o.kind === 'kid' ? 'kid' : o.kind === 'parents' ? 'parents' : 'parent';
  const slot = kind === 'parent' && (o.slot === 'dad' || o.slot === 'mom') ? o.slot : '';
  return { kind: kind, id: str(o.id), slot: slot, name: trimText(o.name, 60) };
}
/** 消息统一结构（含 v1.x 旧数据迁移）：
 *  新：{ id, from:{kind,id,slot,name}, to:{kind,id,slot,name}, text, at, readBy:[memberKey], sys }
 *  旧：{ kidId, from:'kid'|'parent', fromName, readByKid, readByParent } */
function normalizeMessage(m) {
  if (!m || typeof m !== 'object') return null;
  const text = trimText(m.text, 200);
  if (!text) return null;
  if (m.from && typeof m.from === 'object' && m.to && typeof m.to === 'object') {
    return {
      id: str(m.id) || uid('msg'),
      from: refOf(m.from), to: refOf(m.to),
      text: text, at: str(m.at) || nowISO(),
      readBy: (Array.isArray(m.readBy) ? m.readBy : []).map((x) => str(x)).filter(Boolean),
      sys: !!m.sys
    };
  }
  const kidId = str(m.kidId);
  const fromKid = m.from === 'kid';
  const readBy = [];
  if (m.readByKid) readBy.push('kid:' + kidId);
  if (m.readByParent) readBy.push('parents:*');
  return {
    id: str(m.id) || uid('msg'),
    from: { kind: fromKid ? 'kid' : 'parent', id: fromKid ? kidId : '', slot: '', name: trimText(m.fromName, 60) },
    to: fromKid ? { kind: 'parents', id: '', slot: '', name: '' } : { kind: 'kid', id: kidId, slot: '', name: '' },
    text: text, at: str(m.at) || nowISO(),
    readBy: readBy, sys: false
  };
}
/** 现金面额（元／份）——v2.0.49 起由家长在「编辑奖励 → 面额」里直接填写，系统不做任何换算：
 *  填 1 就是「50 积分换 1 元」，填 5 就是「50 积分换 5 元」，改「需要多少积分」也不再联动。
 *  仅在老数据缺值时用一次「成本 ÷ 每元积分」兜底，避免历史现金券显示 ¥0。 */
function cashYuanOf(v, cost, coinsPerYuan) {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100;
  const rate = Math.max(1, Number(coinsPerYuan) || 10);
  return Math.max(0.1, Math.round((clampInt(cost, 0, 1000000, 10) / rate) * 10) / 10);
}
function normalizeDB(d) {
  const b = defaultDB();
  const o = d && typeof d === 'object' ? d : {};
  const arr = (v) => (Array.isArray(v) ? v : []);
  const merged = Object.assign({}, b, o);
  merged.settings = Object.assign({}, b.settings, o.settings || {});
  merged.kids = arr(o.kids).map((k) => ({
    id: str(k.id) || uid('kid'),
    name: trimText(k.name, 20) || '小朋友',
    avatar: str(k.avatar) || '⭐',
    color: str(k.color) || '#FF8FA3',
    boundUid: str(k.boundUid),
    boundUsername: trimText(k.boundUsername, 60),
    balance: clampInt(k.balance, 0, 100000000, 0),
    cash: Math.round(Number(k.cash) * 10) / 10 >= 0 ? Math.round(Number(k.cash) * 10) / 10 : 0,
    totalEarned: clampInt(k.totalEarned, 0, 100000000, 0),
    note: trimText(k.note, 120),
    createdAt: str(k.createdAt) || nowISO()
  }));
  merged.tasks = arr(o.tasks).map((t) => ({
    id: str(t.id) || uid('task'),
    title: trimText(t.title, 30) || '任务',
    icon: str(t.icon) || '⭐',
    coins: clampInt(t.coins, 0, 100000, 5),
    type: TASK_TYPES.indexOf(t.type) >= 0 ? t.type : 'daily',
    cat: ['habit', 'chore', 'read'].indexOf(t.cat) >= 0 ? t.cat : 'habit',
    fbMode: ['none', 'opt', 'req'].indexOf(t.fbMode) >= 0 ? t.fbMode : (t.cat === 'read' ? 'req' : 'none'),
    limitPerDay: clampInt(t.limitPerDay, 1, 20, 1),
    expiresAt: str(t.expiresAt) || str(t.dueAt),
    active: t.active !== false,
    createdAt: str(t.createdAt) || nowISO()
  }));
  // 临时任务兼容迁移：旧数据没有 expiresAt → 按「创建当天 23:59:59」补齐（过夜即销毁，语义与新版一致）
  merged.tasks.forEach((t) => {
    if (t.type === 'once' && !t.expiresAt) t.expiresAt = dayEndISO(localDay(t.createdAt));
  });
  merged.shop = arr(o.shop).map((s) => ({
    id: str(s.id) || uid('shop'),
    name: trimText(s.name, 30) || '奖励',
    emoji: str(s.emoji) || '🎁',
    cost: clampInt(s.cost, 0, 1000000, 10),
    stock: Number.isFinite(Number(s.stock)) ? clampInt(s.stock, -1, 1000000, -1) : -1,
    type: s.type === 'cash' ? 'cash' : 'item',
    cat: ['privilege', 'goods'].indexOf(s.cat) >= 0 ? s.cat : (s.type === 'cash' ? 'goods' : 'privilege'),
    listed: s.listed === undefined ? true : !!s.listed,
    active: s.active !== false,
    redeemDeadline: str(s.redeemDeadline) || '',
    useLimitDays: clampInt(s.useLimitDays, 0, 3650, 0),
    // 现金面额必须留在白名单里：缺了会被下一次 saveDB 永久写没。
    // v2.0.49 起面额由家长直填、不做换算，只有老数据缺值时才用成本兜底一次
    cashYuan: s.type === 'cash' ? cashYuanOf(s.cashYuan, s.cost, merged.settings.coinsPerYuan) : 0,
    createdAt: str(s.createdAt) || nowISO()
  }));
  merged.submissions = arr(o.submissions).map((s) => ({
    id: str(s.id) || uid('sub'),
    taskId: str(s.taskId),
    taskTitle: trimText(s.taskTitle, 30),
    taskIcon: str(s.taskIcon) || '⭐',
    kidId: str(s.kidId),
    coins: clampInt(s.coins, 0, 100000, 0),
    day: str(s.day) || localDay(s.createdAt),
    status: ['pending', 'approved', 'rejected'].indexOf(s.status) >= 0 ? s.status : 'pending',
    note: trimText(s.note, 120),
    reply: trimText(s.reply, 120),
    // 家长酌情调整后的实发积分（留痕）：缺了重启后孩子端会回退显示成原定值
    granted: (s.granted === undefined || s.granted === null || s.granted === '') ? null : clampInt(s.granted, 0, 100000, 0),
    createdAt: str(s.createdAt) || nowISO(),
    reviewedAt: str(s.reviewedAt)
  }));
  merged.redemptions = arr(o.redemptions).map((r) => ({
    id: str(r.id) || uid('rdm'),
    itemId: str(r.itemId),
    itemName: trimText(r.itemName, 30),
    itemEmoji: str(r.itemEmoji) || '🎁',
    itemType: r.itemType === 'cash' ? 'cash' : 'item',
    kidId: str(r.kidId),
    cost: clampInt(r.cost, 0, 1000000, 0),
    qty: clampInt(r.qty, 1, 999, 1),
    status: ['pending', 'approved', 'rejected', 'canceled'].indexOf(r.status) >= 0 ? r.status : 'pending',
    useStatus: ['used', 'expired'].indexOf(r.useStatus) >= 0 ? r.useStatus : 'unused',
    usedAt: str(r.usedAt),
    verified: !!r.verified,
    verifiedAt: str(r.verifiedAt),
    useDeadline: str(r.useDeadline) || '',
    // 兑换当刻的现金面额快照（同上：必须留在白名单，否则重启后丢失）
    cashYuan: (r.itemType === 'cash' && Number(r.cashYuan) > 0) ? Math.round(Number(r.cashYuan) * 100) / 100 : 0,
    reply: trimText(r.reply, 120),
    createdAt: str(r.createdAt) || nowISO(),
    reviewedAt: str(r.reviewedAt)
  }));
  merged.withdrawals = arr(o.withdrawals).map((w) => ({
    id: str(w.id) || uid('wd'),
    kidId: str(w.kidId),
    amount: Math.round(Number(w.amount) * 10) / 10,
    note: trimText(w.note, 60),
    at: str(w.at) || nowISO(),
    verified: !!w.verified,
    verifiedAt: str(w.verifiedAt)
  })).filter((w) => w.kidId && w.amount > 0);
  merged.ledger = arr(o.ledger).map((l) => ({
    id: str(l.id) || uid('lg'),
    kidId: str(l.kidId),
    delta: clampInt(l.delta, -100000000, 100000000, 0),
    balanceAfter: clampInt(l.balanceAfter, 0, 100000000, 0),
    reason: (function () { var t = trimText(l.reason, 60); var m = t.match(/^兑换（现金入钱包 \+([0-9.]+) 元）：/); return m ? ('兑换：现金 ' + m[1] + ' 元') : t; })(),
    kind: str(l.kind) || 'manual',
    operatorUid: str(l.operatorUid),
    operatorName: trimText(l.operatorName, 60),
    at: str(l.at) || nowISO()
  }));
  merged.goals = arr(o.goals).map((g) => ({
    id: str(g.id) || uid('goal'),
    kidId: str(g.kidId),
    title: trimText(g.title, 30) || '我的心愿',
    emoji: str(g.emoji) || '🎯',
    targetCoins: clampInt(g.targetCoins, 0, 1000000, 0),
    cheer: trimText(g.cheer, 60),
    createdAt: str(g.createdAt) || nowISO()
  }));
  merged.messages = arr(o.messages).map(normalizeMessage).filter(Boolean);
  merged.accepts = arr(o.accepts).map((a) => ({
    taskId: str(a.taskId), kidId: str(a.kidId), at: str(a.at) || nowISO()
  })).filter((a) => a.taskId && a.kidId);
  merged.seenUsers = arr(o.seenUsers).map((u) => ({
    uid: str(u.uid),
    username: trimText(u.username, 60),
    isAdmin: !!u.isAdmin,
    firstSeen: str(u.firstSeen) || nowISO(),
    lastSeen: str(u.lastSeen) || nowISO(),
    visits: clampInt(u.visits, 0, 1000000, 1)
  }));
  merged.parents = arr(o.parents).map((p) => ({
    uid: str(p.uid),
    username: trimText(p.username, 60),
    title: trimText(p.title, 10) || '家长',
    boundAt: str(p.boundAt) || nowISO()
  }));
  return merged;
}
/* 启动自检（P1-#3）：检测"存储文件里有、但 normalizeDB 白名单会丢弃"的字段。
   新增持久字段若漏加白名单，写入正常、重启后被静默丢弃且不在运行期报错——
   此函数在启动日志里把这种漂移打出来，便于早发现。 */
var SCHEMA_LEGACY = {
  // 已知的有意迁移字段（旧名 → 新名），不算丢失，免误报
  tasks: { dueAt: 1 },
  messages: { kidId: 1, from: 1, fromName: 1, readByKid: 1, readByParent: 1 }
};
function checkSchemaDrift(raw) {
  if (!raw || typeof raw !== 'object') return;
  const merged = normalizeDB(raw);
  const types = ['kids', 'tasks', 'shop', 'submissions', 'redemptions', 'withdrawals', 'ledger', 'goals', 'accepts', 'seenUsers', 'parents'];
  for (const t of types) {
    const ra = Array.isArray(raw[t]) ? raw[t] : [];
    const ma = Array.isArray(merged[t]) ? merged[t] : [];
    if (!ra.length) continue;
    const rawKeys = new Set();
    ra.forEach((it) => { if (it && typeof it === 'object') Object.keys(it).forEach((k) => rawKeys.add(k)); });
    const merKeys = new Set();
    ma.forEach((it) => { if (it && typeof it === 'object') Object.keys(it).forEach((k) => merKeys.add(k)); });
    const legacy = SCHEMA_LEGACY[t] || {};
    rawKeys.forEach((k) => {
      if (!merKeys.has(k) && !legacy[k]) {
        log('[schema-warn] ' + t + '[] 字段未纳入 normalizeDB 白名单，重启后会丢失: ' + k);
      }
    });
  }
}
module.exports = { defaultDB, normalizeDB, cashYuanOf, checkSchemaDrift };
