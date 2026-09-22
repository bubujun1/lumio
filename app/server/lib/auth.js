/* ============================================================
   Lumio 后端 · lib/auth.js —— 身份解析：网关注入头 → 家长/孩子/未绑定上下文
   分层：L1 身份
   ============================================================ */
'use strict';

const { DEV_IDENTITY } = require('./config');
const { str, nowISO } = require('./util');
const { DB, saveSoon } = require('./db');

/* ------------------------------------------------------------ 身份与权限 */

function gatewayUser(req) {
  const h = req.headers;
  let u = str(h['x-trim-userid']).trim();
  let name = str(h['x-trim-username']).trim();
  const adminRaw = str(h['x-trim-isadmin']).trim().toLowerCase();
  let isAdmin = adminRaw === 'true' || adminRaw === '1' || adminRaw === 'yes';

  if (!u && !name) {
    if (!DEV_IDENTITY) return null;
    u = str(h['x-dev-userid']).trim() || '1';
    name = str(h['x-dev-username']).trim() || 'admin';
    const d = str(h['x-dev-isadmin']).trim().toLowerCase();
    isAdmin = d === '' ? true : d === 'true' || d === '1';
  }
  if (!u) u = 'name:' + name;
  if (!name) name = '用户' + u;
  return { uid: u, username: name, isAdmin };
}

function touchSeenUser(user) {
  const list = DB.seenUsers;
  const hit = list.find((x) => x.uid === user.uid);
  if (hit) {
    hit.username = user.username;
    hit.isAdmin = user.isAdmin;
    hit.lastSeen = nowISO();
    hit.visits = (hit.visits || 0) + 1;
    if (list.length > 60) list.splice(0, list.length - 60);
    return false; // 已知访客：仅更新内存，不触发写盘
  }
  list.push({
    uid: user.uid, username: user.username, isAdmin: user.isAdmin,
    firstSeen: nowISO(), lastSeen: nowISO(), visits: 1
  });
  if (list.length > 60) list.splice(0, list.length - 60);
  return true; // 新访客：需落盘
}

function resolveCtx(req) {
  const user = gatewayUser(req);
  if (!user) return { user: null, role: 'noauth' };
  if (touchSeenUser(user)) saveSoon(); // 仅新访客落盘；静态资源/轮询不再每次写库
  if (user.isAdmin) return { user, role: 'admin' };
  // 绑定了「家长身份」的飞牛用户（如配偶）：权限与管理员一致
  const parent = DB.parents.find((p) => (p.uid && p.uid === user.uid) || (!p.uid && p.username === user.username));
  if (parent) {
    if (!parent.uid) parent.uid = user.uid; // 兜底补 uid
    return { user, role: 'parent', parent };
  }
  let kid = DB.kids.find((k) => k.boundUid && k.boundUid === user.uid) || null;
  if (!kid) {
    // 兜底：绑定时只填了用户名的情况
    kid = DB.kids.find((k) => !k.boundUid && k.boundUsername && k.boundUsername === user.username) || null;
    if (kid) { kid.boundUid = user.uid; }
  }
  if (kid) return { user, role: 'kid', kid };
  return { user, role: 'unbound' };
}

module.exports = {
  resolveCtx
};
