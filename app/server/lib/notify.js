/* ============================================================
   Lumio 后端 · lib/notify.js —— 通知域：消息投递 + 身份键
   分层：L1（仅依赖 util 与 db 的容器，不依赖 messages，避免 L1→L2 逆层）
   职责：把"消息写入 DB.messages"与"身份键"集中收口，供 schedule / actions 共用。
   ============================================================ */
'use strict';

const { uid, nowISO, trimText, str } = require('./util');
const { DB } = require('./db');

/* 身份键：发送人/收件人引用 → 用于"已读"判定（被 messages.js 与 notify 共用） */
function memberKey(ref) { return ref ? ref.kind + ':' + (ref.id || '*') : ''; }

/* 消息滚动上限：messages 仅保留近期定向留言/通知用于展示；超过上限从头部丢弃最旧记录。
   重要操作留痕另有 ledger，不依赖 messages 长期留存（W1 收敛：静默裁剪改为显式常量）。 */
const MESSAGES_CAP = 2000;
/** 写一条定向消息（发送人自动标记已读），直接落库并滚动裁剪 */
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
  if (DB.messages.length > MESSAGES_CAP) DB.messages.splice(0, DB.messages.length - MESSAGES_CAP);
  return m;
}

module.exports = {
  pushMessage,
  memberKey
};
