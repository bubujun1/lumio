/* ============================================================
   Lumio 后端 · lib/actions/task.js —— 任务与目标：增删改、领取、提交、鼓励
   分层：L4 动作
   ============================================================ */
'use strict';

const { trimText, HttpError, uid, str, clampInt, dayEndISO, localDay, nowISO, fmtDeadlineText } = require('../util');
const { TASK_TYPES } = require('../constants');
const { DB, findTask, findKid } = require('../db');
const { isExpired, acceptRequired, periodKeyOf, periodLabel } = require('../schedule');
const { pushMessage, meRef } = require('../messages');
const { approveSubmission } = require('../review');

const actionsTask = {
  'task.create': {
      role: 'admin',
      run(ctx, p) {
        const type = TASK_TYPES.indexOf(p.type) >= 0 ? p.type : 'daily';
        const expiresAt = trimText(p.expiresAt, 40);
        if (type === 'timed' && !expiresAt) throw new HttpError(400, '限时任务要选一个截止时间，到点会自动消失');
        const t = {
          id: uid('task'),
          title: trimText(p.title, 30) || '新任务',
          icon: str(p.icon) || '⭐',
          coins: clampInt(p.coins, 0, 100000, 5),
          type: type,
          cat: ['habit', 'chore', 'read'].indexOf(p.cat) >= 0 ? p.cat : 'habit',
          fbMode: ['none', 'opt', 'req'].indexOf(p.fbMode) >= 0 ? p.fbMode : (p.cat === 'read' ? 'req' : 'none'),
          limitPerDay: clampInt(p.limitPerDay, 1, 20, 1),
          expiresAt: type === 'timed' ? expiresAt : (type === 'once' ? dayEndISO(localDay()) : ''), // 临时任务：当天有效，过零点自动销毁
          active: true,
          createdAt: nowISO()
        };
        DB.tasks.push(t);
        // 限时任务：给每个孩子推一条留言通知（孩子端「消息 → 留言」可见，未读会打角标）
        if (type === 'timed') {
          const dl = fmtDeadlineText(t.expiresAt);
          DB.kids.forEach((k) => {
            pushMessage(meRef(ctx), { kind: 'kid', id: k.id, name: k.name },
              '📌 新限时任务：' + t.icon + ' ' + t.title + '，记得先点「接受」，' + dl + ' 前完成哦～');
          });
        }
        return { taskId: t.id };
      }
    },
  'task.update': {
      role: 'admin',
      run(ctx, p) {
        const t = findTask(str(p.id));
        if (!t) throw new HttpError(404, '找不到这个任务');
        if (p.title !== undefined) t.title = trimText(p.title, 30) || t.title;
        if (p.icon !== undefined) t.icon = str(p.icon) || t.icon;
        if (p.coins !== undefined) t.coins = clampInt(p.coins, 0, 100000, t.coins);
        const prevType = t.type;
        if (p.type !== undefined) t.type = TASK_TYPES.indexOf(p.type) >= 0 ? p.type : t.type;
        if (p.cat !== undefined) t.cat = ['habit', 'chore', 'read'].indexOf(p.cat) >= 0 ? p.cat : t.cat;
        if (p.fbMode !== undefined) t.fbMode = ['none', 'opt', 'req'].indexOf(p.fbMode) >= 0 ? p.fbMode : t.fbMode;
        if (p.limitPerDay !== undefined) t.limitPerDay = clampInt(p.limitPerDay, 1, 20, t.limitPerDay);
        if (p.expiresAt !== undefined) {
          const exp = trimText(p.expiresAt, 40);
          // 前端编辑非限时任务时固定发空串；对「临时任务」这不该清掉已有期限（见下方 prevType 判断）
          if (exp || t.type === 'timed') t.expiresAt = exp;
        }
        if (p.active !== undefined) t.active = !!p.active;
        if (t.type === 'timed' && !t.expiresAt) throw new HttpError(400, '限时任务要选一个截止时间，到点会自动消失');
        if (t.type === 'once') {
          // 临时任务：仅首次转为临时（或缺失期限）时盖「当天 23:59:59」；平时编辑不续期，避免天天改一直不过期
          if (prevType !== 'once' || !t.expiresAt) t.expiresAt = dayEndISO(localDay());
        } else if (t.type !== 'timed') {
          t.expiresAt = '';
        }
        return { taskId: t.id };
      }
    },
  'task.accept': {
      role: 'kid',
      run(ctx, p) {
        const t = findTask(str(p.taskId));
        if (!t || !t.active) throw new HttpError(404, '这个任务已经不在啦');
        if (isExpired(t)) throw new HttpError(409, t.type === 'once' ? '临时任务只在当天有效，已经过零点啦' : '这个限时任务已经过期啦');
        if (!acceptRequired(t)) throw new HttpError(400, '这个任务不用接受，直接提交就好');
        if (DB.accepts.some((a) => a.taskId === t.id && a.kidId === ctx.kid.id)) return { taskId: t.id, already: true };
        DB.accepts.push({ taskId: t.id, kidId: ctx.kid.id, at: nowISO() });
        return { taskId: t.id };
      }
    },
  'task.delete': {
      role: 'admin',
      run(ctx, p) {
        const id = str(p.id);
        DB.tasks = DB.tasks.filter((t) => t.id !== id);
        DB.submissions = DB.submissions.filter((s) => s.taskId !== id || s.status === 'approved');
        DB.accepts = DB.accepts.filter((a) => a.taskId !== id);
        return {};
      }
    },
  'task.submit': {
      role: 'kid',
      run(ctx, p) {
        const t = findTask(str(p.taskId));
        if (!t || !t.active) throw new HttpError(404, '这个任务已经不在啦');
        if (isExpired(t)) throw new HttpError(409, t.type === 'once' ? '临时任务只在当天有效，已经过零点啦' : '这个限时任务已经过期啦');
        if (acceptRequired(t) && !DB.accepts.some((a) => a.taskId === t.id && a.kidId === ctx.kid.id)) {
          throw new HttpError(409, '要先点「接受」才能提交哦');
        }
        const today = localDay();
        const curKey = periodKeyOf(t, today);
        const periodCount = DB.submissions.filter(
          (s) => s.taskId === t.id && s.kidId === ctx.kid.id && s.status !== 'rejected' && periodKeyOf(t, s.day) === curKey
        ).length;
        if (periodCount >= t.limitPerDay) {
          throw new HttpError(409, t.type === 'once' ? '这个任务已经做过啦～' : periodLabel(t) + '已经做满 ' + t.limitPerDay + ' 次啦，下个周期再来吧～');
        }
        const note = trimText(p.note, 120);
        // 完成反馈三档（v2.0.29）：任务可设 不需要/可填/必填；必填时没写反馈不能提交（阅读类默认必填）
        const fbMode = t.fbMode || (t.cat === 'read' ? 'req' : 'none');
        if (fbMode === 'req' && !note) throw new HttpError(400, '这个任务要写一句反馈哦，写完再提交吧');
        const sub = {
          id: uid('sub'), taskId: t.id, taskTitle: t.title, taskIcon: t.icon,
          kidId: ctx.kid.id, coins: t.coins, day: today,
          status: 'pending',
          note: note, reply: '', createdAt: nowISO(), reviewedAt: ''
        };
        DB.submissions.push(sub);
        let auto = false;
        if (!DB.settings.taskNeedsApproval) {
          approveSubmission(sub, ctx, '');
          // 不需要审核时，操作人记为孩子自己
          const last = DB.ledger[DB.ledger.length - 1];
          if (last) { last.operatorUid = ctx.user.uid; last.operatorName = ctx.user.username; }
          auto = true;
        }
        // 站内信：任务完成情况告知父母
        pushMessage(meRef(ctx), { kind: 'parents', id: '', name: '' },
          ctx.kid.name + (auto
            ? ' 完成了「' + t.title + '」，已自动通过，积分到账～'
            : ' 完成了「' + t.title + '」（至多 ' + t.coins + ' 积分），等你审核哦'));
        return { submissionId: sub.id, autoApproved: auto, coins: t.coins };
      }
    },
  'goal.create': {
      role: 'kid',
      run(ctx, p) {
        if (!DB.settings.kidCanAddGoal) throw new HttpError(403, '家长关掉了自己添加心愿的功能');
        if (DB.goals.filter((g) => g.kidId === ctx.kid.id).length >= 5) {
          throw new HttpError(409, '最多只能同时有 5 个心愿哦');
        }
        const g = {
          id: uid('goal'), kidId: ctx.kid.id,
          title: trimText(p.title, 30) || '我的心愿',
          emoji: str(p.emoji) || '🎯',
          targetCoins: clampInt(p.targetCoins, 0, 1000000, 0),
          cheer: '', createdAt: nowISO()
        };
        DB.goals.push(g);
        pushMessage(meRef(ctx), { kind: 'parents', id: '', name: '' },
          '我许了一个心愿：' + g.emoji + ' ' + g.title + (g.targetCoins > 0 ? '（希望攒到 ' + g.targetCoins + ' 个积分）' : ''));
        return { goalId: g.id };
      }
    },
  'goal.delete': {
      role: 'kid',
      run(ctx, p) {
        const g = DB.goals.find((x) => x.id === str(p.id) && x.kidId === ctx.kid.id);
        if (!g) throw new HttpError(404, '找不到这个心愿');
        DB.goals = DB.goals.filter((x) => x.id !== g.id);
        return {};
      }
    },
  'goal.encourage': {
      role: 'admin',
      run(ctx, p) {
        const g = DB.goals.find((x) => x.id === str(p.id));
        if (!g) throw new HttpError(404, '找不到这个心愿');
        g.cheer = trimText(p.cheer, 60) || '加油，你一定可以的！';
        const gk = findKid(g.kidId);
        pushMessage(meRef(ctx), { kind: 'kid', id: g.kidId, name: gk ? gk.name : '' }, g.emoji + ' 「' + g.title + '」' + g.cheer);
        return { goalId: g.id };
      }
    },
  'goal.update': {
      role: 'admin',
      run(ctx, p) {
        const g = DB.goals.find((x) => x.id === str(p.id));
        if (!g) throw new HttpError(404, '找不到这个心愿');
        if (p.targetCoins !== undefined) g.targetCoins = clampInt(p.targetCoins, 0, 1000000, g.targetCoins || 0);
        return { goalId: g.id };
      }
    }
};

module.exports = actionsTask;
