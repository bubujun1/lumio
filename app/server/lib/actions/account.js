/* ============================================================
   Lumio 后端 · lib/actions/account.js —— 孩子与家长：增删改、绑定解绑
   分层：L4 动作
   ============================================================ */
'use strict';

const { uid, trimText, str, nowISO, HttpError } = require('../util');
const { AVATARS, KID_COLORS } = require('../constants');
const { DB, findKid } = require('../db');

const actionsAccount = {
  'kid.create': {
      role: 'admin',
      run(ctx, p) {
        const k = {
          id: uid('kid'),
          name: trimText(p.name, 20) || '小朋友',
          avatar: AVATARS.indexOf(str(p.avatar)) >= 0 ? str(p.avatar) : AVATARS[DB.kids.length % AVATARS.length],
          color: KID_COLORS.indexOf(str(p.color)) >= 0 ? str(p.color) : KID_COLORS[DB.kids.length % KID_COLORS.length],
          boundUid: '', boundUsername: '', balance: 0, totalEarned: 0,
          note: trimText(p.note, 120), createdAt: nowISO()
        };
        DB.kids.push(k);
        if (p.boundUsername) {
          k.boundUsername = trimText(p.boundUsername, 60);
          const seen = DB.seenUsers.find((u) => u.username === k.boundUsername);
          if (seen && !DB.kids.some((x) => x.boundUid === seen.uid)) k.boundUid = seen.uid;
        }
        return { kidId: k.id };
      }
    },
  'kid.update': {
      role: 'admin',
      run(ctx, p) {
        const k = findKid(str(p.id));
        if (!k) throw new HttpError(404, '找不到这个孩子');
        if (p.name !== undefined) k.name = trimText(p.name, 20) || k.name;
        // 白名单校验（与 kid.create 对齐）：此前裸存任意字符串，
        // 配合前端未转义的渲染点会形成「家长自注入」的存储型 XSS
        if (p.avatar !== undefined) { const av = str(p.avatar); if (AVATARS.indexOf(av) >= 0) k.avatar = av; }
        if (p.color !== undefined) { const cl = str(p.color); if (KID_COLORS.indexOf(cl) >= 0) k.color = cl; }
        if (p.note !== undefined) k.note = trimText(p.note, 120);
        return { kidId: k.id };
      }
    },
  'kid.bind': {
      role: 'admin',
      run(ctx, p) {
        const k = findKid(str(p.id));
        if (!k) throw new HttpError(404, '找不到这个孩子');
        const uname = trimText(p.username, 60);
        if (!uname) throw new HttpError(400, '请填写要绑定的飞牛用户名');
        const seen = DB.seenUsers.find((u) => u.username === uname);
        const targetUid = seen ? seen.uid : '';
        if (!targetUid) throw new HttpError(400, '没找到飞牛用户「' + uname + '」。请让他先用飞牛账号打开一次Lumio，再回来绑定。');
        if (DB.kids.some((x) => x.id !== k.id && x.boundUid === targetUid)) {
          throw new HttpError(409, '飞牛用户「' + uname + '」已经绑定给别的小朋友了');
        }
        // 解绑该孩子原来的绑定
        k.boundUid = targetUid;
        k.boundUsername = uname;
        return { kidId: k.id, boundUid: targetUid };
      }
    },
  'kid.unbind': {
      role: 'admin',
      systemAdminOnly: true, // 解绑身份仅飞牛系统管理员可用，家长身份无此权限
      run(ctx, p) {
        const k = findKid(str(p.id));
        if (!k) throw new HttpError(404, '找不到这个孩子');
        k.boundUid = '';
        k.boundUsername = '';
        return { kidId: k.id };
      }
    },
  'parent.bind': {
      role: 'admin',
      run(ctx, p) {
        const uname = trimText(p.username, 60);
        const title = trimText(p.title, 10);
        if (!uname) throw new HttpError(400, '请填写要绑定的飞牛用户名');
        if (!title) throw new HttpError(400, '请选择称呼（爸爸 / 妈妈）');
        const seen = DB.seenUsers.find((u) => u.username === uname);
        if (!seen) throw new HttpError(400, '没找到飞牛用户「' + uname + '」。请让他先用飞牛账号打开一次Lumio，再回来绑定。');
        if (DB.kids.some((k) => (k.boundUid && k.boundUid === seen.uid) || (!k.boundUid && k.boundUsername === uname))) {
          throw new HttpError(409, '「' + uname + '」已经绑定成小朋友了，不能同时绑定家长身份');
        }
        const exist = DB.parents.find((x) => (x.uid && x.uid === seen.uid) || (!x.uid && x.username === uname));
        if (exist) {
          exist.title = title;
          exist.uid = exist.uid || seen.uid;
          return { parentId: exist.username };
        }
        DB.parents.push({ uid: seen.uid, username: uname, title: title, boundAt: nowISO() });
        return { parentId: uname };
      }
    },
  'parent.unbind': {
      role: 'admin',
      systemAdminOnly: true, // 解绑身份仅飞牛系统管理员可用，家长身份无此权限
      run(ctx, p) {
        const uname = trimText(p.username, 60);
        const before = DB.parents.length;
        DB.parents = DB.parents.filter((x) => x.username !== uname);
        if (DB.parents.length === before) throw new HttpError(404, '没有这个家长绑定');
        return {};
      }
    },
  'kid.delete': {
      role: 'admin',
      run(ctx, p) {
        const id = str(p.id);
        const k = findKid(id);
        if (!k) throw new HttpError(404, '找不到这个孩子');
        DB.kids = DB.kids.filter((x) => x.id !== id);
        DB.submissions = DB.submissions.filter((x) => x.kidId !== id);
        DB.redemptions = DB.redemptions.filter((x) => x.kidId !== id);
        DB.ledger = DB.ledger.filter((x) => x.kidId !== id);
        DB.goals = DB.goals.filter((x) => x.kidId !== id);
        DB.messages = DB.messages.filter((m) => !(m.from.kind === 'kid' && m.from.id === id) && !(m.to.kind === 'kid' && m.to.id === id));
        DB.accepts = DB.accepts.filter((a) => a.kidId !== id);
        // 提现记录也要清：否则孩子删了，这笔提现仍挂在家长「待处理」里、还能被核销
        // （前端 kidOf() 找不到人会显示成「小朋友」，成为无从追溯的无主记录）
        DB.withdrawals = DB.withdrawals.filter((w) => w.kidId !== id);
        return {};
      }
    }
};

module.exports = actionsAccount;
