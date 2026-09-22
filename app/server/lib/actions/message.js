/* ============================================================
   Lumio 后端 · lib/actions/message.js —— 留言：发送与已读
   分层：L4 动作
   ============================================================ */
'use strict';

const { trimText, HttpError, str } = require('../util');
const { DB } = require('../db');
const { resolveRecipient, pushMessage, meRef, msgVisible, memberKey } = require('../messages');

const actionsMessage = {
  'message.send': {
      role: 'any',
      run(ctx, p) {
        const text = trimText(p.text, 200);
        if (!text) throw new HttpError(400, '说点什么吧～');
        if (ctx.role === 'kid' && !DB.settings.kidCanMessage) throw new HttpError(403, '家长关掉了留言功能');
        const to = resolveRecipient(ctx, { kind: str(p.toKind), id: str(p.toId), slot: str(p.toSlot) });
        const m = pushMessage(meRef(ctx), to, text);
        return { messageId: m ? m.id : '' };
      }
    },
  'message.read': {
      role: 'any',
      run(ctx, p) {
        const m = DB.messages.find((x) => x.id === str(p.id));
        if (!m) throw new HttpError(404, '找不到这条留言');
        const me = meRef(ctx);
        if (!msgVisible(m, me)) throw new HttpError(403, '这条留言不是发给你的');
        const key = memberKey(me);
        if (m.readBy.indexOf(key) < 0) m.readBy.push(key);
        return {};
      }
    }
};

module.exports = actionsMessage;
