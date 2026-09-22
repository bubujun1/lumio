/* ============================================================
   Lumio 后端 · lib/messages.js —— 留言域：可见性 / 未读数 / 收件人解析 / 投递
   分层：L2 留言
   ============================================================ */
'use strict';

const { str, HttpError, trimText, uid, nowISO } = require('./util');
const { SLOT_LABEL } = require('./constants');
const { DB, slotOfTitle, findKid } = require('./db');

/* ------------------------------------------- 家庭成员引用 · 消息可见性规则 */

/** 家长成员（系统管理员 + 已绑定家长身份），按 uid 去重 */
function parentMembers() {
  const out = [];
  const add = (uid, username, title) => {
    if (!uid) return;
    const hit = out.find((x) => x.uid === uid);
    if (hit) { if (!hit.title && title) hit.title = title; if (!hit.username && username) hit.username = username; return; }
    out.push({ uid: uid, username: username || '', title: title || '' });
  };
  DB.seenUsers.filter((u) => u.isAdmin).forEach((u) => add(u.uid, u.username, ''));
  DB.parents.forEach((p) => add(p.uid, p.username, p.title));
  const list = out.map((x) => ({ kind: 'parent', id: x.uid, name: x.title || DB.settings.parentTitle || '家长', username: x.username }));
  // 同名去重：多位家长回退到同一个通用称呼时，用飞牛用户名区分，确保「爸爸/妈妈」可分开选
  const seen = {};
  list.forEach((p) => { seen[p.name] = (seen[p.name] || 0) + 1; });
  list.forEach((p) => { if (seen[p.name] > 1 && p.username) p.name = p.name + '（' + p.username + '）'; });
  return list;
}

/** 当前访问者在消息里的身份引用（家长带 slot，用于「爸爸 / 妈妈」席位匹配） */
function meRef(ctx) {
  if (!ctx || !ctx.user) return null;
  if (ctx.role === 'kid' && ctx.kid) return { kind: 'kid', id: ctx.kid.id, slot: '', name: ctx.kid.name };
  if (ctx.role === 'admin' || ctx.role === 'parent') {
    const name = ctxParentName(ctx);
    // 席位只认真实绑定过的称呼；未绑定的家长（含管理员）不带席位，
    // 否则 parentTitle 兜底「爸爸妈妈」会被 slotOfTitle 误判成 dad，留言错进「爸爸」会话
    const bound = DB.parents.find((x) => x.uid === ctx.user.uid);
    return { kind: 'parent', id: ctx.user.uid, slot: bound ? slotOfTitle(bound.title) : '', name: name };
  }
  return null;
}

function memberKey(ref) { return ref ? ref.kind + ':' + (ref.id || '*') : ''; }

/** 只有发送人和收件人能看到：
 *  - to.kind==='parents'  → 所有家长都能看到（群聊）
 *  - to.kind==='parent' 且带 slot → 占住该席位（爸爸 / 妈妈）的家长能看到
 *  - 孩子之间互发 → 只有这两位孩子能看到
 */
function msgVisible(m, me) {
  if (!me || !m || !m.from || !m.to) return false;
  if (m.from.kind === me.kind && m.from.id && m.from.id === me.id) return true;
  if (m.to.kind === me.kind && m.to.id && m.to.id === me.id) return true;
  if (me.kind !== 'parent') return false;
  if (m.to.kind === 'parents') return true;
  if (m.to.kind === 'parent' && m.to.slot && me.slot && m.to.slot === me.slot) return true;
  if (m.from.kind === 'parent' && !m.from.id) return true; // v1.x 旧数据兼容
  return false;
}

function messagesFor(ctx) {
  const me = meRef(ctx);
  if (!me) return [];
  return DB.messages.filter((m) => msgVisible(m, me));
}

/** 未读：别人发给我的、我还没读的 */
function unreadCountFor(ctx) {
  const me = meRef(ctx);
  if (!me) return 0;
  const key = memberKey(me);
  return DB.messages.filter((m) => msgVisible(m, me)
    && !(m.from.kind === me.kind && m.from.id === me.id)
    && m.readBy.indexOf(key) < 0).length;
}

/** 某个席位（爸爸 / 妈妈）现在由哪位家长占着；没人绑定返回 null */
function slotHolder(slot) {
  return DB.parents.find((p) => slotOfTitle(p.title) === slot) || null;
}

/** 孩子端的留言对象（固定列表）：
 *  爸爸 / 妈妈 / 爸爸妈妈（群，所有家长都能看到）/ 兄弟姐妹（多孩家庭自动出现）
 *  bound=false 表示这个席位还没有家长绑定，孩子端点不动。 */
function kidRecipients(ctx) {
  const out = ['dad', 'mom'].map((s) => {
    const h = slotHolder(s);
    return { kind: 'parent', id: '', slot: s, name: SLOT_LABEL[s], bound: !!h };
  });
  out.push({ kind: 'parents', id: '', slot: '', name: '爸爸妈妈', bound: true });
  DB.kids.filter((k) => k.id !== ctx.kid.id).forEach((k) => {
    out.push({ kind: 'kid', id: k.id, slot: '', name: k.name, avatar: k.avatar, bound: true });
  });
  return out;
}

/** 解析收件人：家长只能发给孩子；孩子可发「爸爸」「妈妈」席位、「爸爸妈妈」群，或兄弟姐妹 */
function resolveRecipient(ctx, to) {
  const kind = to && to.kind;
  const id = str(to && to.id);
  const slot = to && (to.slot === 'dad' || to.slot === 'mom') ? to.slot : '';
  if (ctx.role === 'kid') {
    if (kind === 'parents') return { kind: 'parents', id: '', slot: '', name: '爸爸妈妈' };
    if (kind === 'parent' && slot) {
      if (!slotHolder(slot)) {
        throw new HttpError(409, '「' + SLOT_LABEL[slot] + '」还没有绑定飞牛账号，先发给「爸爸妈妈」吧');
      }
      return { kind: 'parent', id: '', slot: slot, name: SLOT_LABEL[slot] };
    }
    if (kind === 'kid' && id && id !== ctx.kid.id) {
      const k = findKid(id);
      if (!k) throw new HttpError(404, '找不到这个小朋友');
      return { kind: 'kid', id: k.id, slot: '', name: k.name };
    }
    throw new HttpError(400, '请选择要发给谁');
  }
  if (ctx.role === 'admin' || ctx.role === 'parent') {
    if (kind === 'kid' && id) {
      const k = findKid(id);
      if (!k) throw new HttpError(404, '找不到这个孩子');
      return { kind: 'kid', id: k.id, slot: '', name: k.name };
    }
    // 家长之间：发给「爸爸」「妈妈」席位（家长私聊）
    if (kind === 'parent' && slot) {
      if (!slotHolder(slot)) throw new HttpError(409, '「' + SLOT_LABEL[slot] + '」还没有绑定飞牛账号');
      return { kind: 'parent', id: '', slot: slot, name: SLOT_LABEL[slot] };
    }
    // 家长群聊：全体家长可见（孩子端不可见）
    if (kind === 'parents') return { kind: 'parents', id: '', slot: '', name: '爸爸妈妈' };
    throw new HttpError(400, '请选择要发给谁');
  }
  throw new HttpError(403, '当前身份不能发消息');
}

/** 写一条定向消息（发送人自动标记已读） */
function pushMessage(from, to, text) {
  const body = trimText(text, 200);
  if (!body || !from || !to) return null;
  const m = {
    id: uid('msg'),
    from: { kind: from.kind, id: str(from.id), slot: str(from.slot), name: trimText(from.name, 60) },
    to: { kind: to.kind, id: str(to.id), slot: str(to.slot), name: trimText(to.name, 60) },
    text: body, at: nowISO(), readBy: [memberKey(from)], sys: false
  };
  DB.messages.push(m);
  if (DB.messages.length > 2000) DB.messages.splice(0, DB.messages.length - 2000);
  return m;
}

/** 家长对外称呼：绑定了家长身份的用称呼（妈妈/爸爸），否则用全局称呼 */
function ctxParentName(ctx) {
  if (ctx.role === 'parent' && ctx.parent) return ctx.parent.title;
  if (ctx.user && ctx.user.uid) {
    const p = DB.parents.find((x) => x.uid === ctx.user.uid);
    if (p) return p.title;
  }
  return DB.settings.parentTitle || '家长';
}

module.exports = {
  pushMessage,
  meRef,
  memberKey,
  msgVisible,
  messagesFor,
  unreadCountFor,
  kidRecipients,
  resolveRecipient
};
