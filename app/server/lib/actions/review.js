/* ============================================================
   Lumio 后端 · lib/actions/review.js —— 审核：任务提交 / 兑换申请的裁决
   分层：L4 动作
   ============================================================ */
'use strict';

const { str, HttpError, nowISO, trimText } = require('../util');
const { DB } = require('../db');
const { approveSubmission, approveRedemption } = require('../review');

const actionsReview = {
  'review.submission': {
      role: 'admin',
      run(ctx, p) {
        const sub = DB.submissions.find((s) => s.id === str(p.id));
        if (!sub) throw new HttpError(404, '找不到这条申请');
        const action = str(p.action);
        if (action === 'approve') {
          const r = approveSubmission(sub, ctx, p.reply, p.coins);
          return { kidId: r.kid.id, coins: r.coins };
        } else if (action === 'reject') {
          if (sub.status !== 'pending') throw new HttpError(409, '这条申请已经处理过了');
          sub.status = 'rejected';
          sub.reviewedAt = nowISO();
          sub.reply = trimText(p.reply, 120) || '再努力一下下～';
          return { kidId: sub.kidId };
        }
        throw new HttpError(400, '未知的审核动作');
      }
    },
  'review.redemption': {
      role: 'admin',
      run(ctx, p) {
        const rdm = DB.redemptions.find((r) => r.id === str(p.id));
        if (!rdm) throw new HttpError(404, '找不到这条兑换申请');
        const action = str(p.action);
        if (action === 'approve') {
          const r = approveRedemption(rdm, ctx, p.reply);
          return { kidId: r.kid.id, cost: r.cost };
        } else if (action === 'reject') {
          if (rdm.status !== 'pending') throw new HttpError(409, '这条申请已经处理过了');
          rdm.status = 'rejected';
          rdm.reviewedAt = nowISO();
          rdm.reply = trimText(p.reply, 120) || '这次先不换啦～';
          return { kidId: rdm.kidId };
        }
        throw new HttpError(400, '未知的审核动作');
      }
    }
};

module.exports = actionsReview;
