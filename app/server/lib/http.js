/* ============================================================
   Lumio 后端 · lib/http.js —— HTTP 层：MIME / 响应助手 / 静态服务 / 诊断页 / 请求路由
   分层：L5 传输
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { BASE_PATH, MAX_BODY, UI_DIR, VAR_DIR, SOCKET_PATH, PORT, DATA_DIR, APPNAME } = require('./config');
const { HttpError, str, nowISO, localDay, log } = require('./util');
const { DB, saveDB, scheduleSave } = require('./db');
const { purgeExpiredTasks } = require('./schedule');
const { resolveCtx } = require('./auth');
const { buildState } = require('./state');
const { ACTIONS } = require('./actions');

/* ------------------------------------------------------------- HTTP 层 */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

function sendJson(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendHtml(res, buf) {
  // 后端是唯一确知网关前缀的一方：把占位符替换成真实 BASE_PATH
  const html = buf.toString('utf8').split('__APP_BASE__').join(BASE_PATH);
  const out = Buffer.from(html, 'utf8');
  res.writeHead(200, {
    'Content-Type': MIME['.html'],
    'Content-Length': out.length,
    'Cache-Control': 'no-store'
  });
  res.end(out);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      if (size < 0) return; // 已超限：继续消费剩余数据，但不再累积
      size += c.length;
      if (size > MAX_BODY) {
        // 不能在这里 req.destroy()：destroy 会抢在响应写出之前，
        // 客户端只拿到 ECONNRESET，永远看不到 413。改为标记超限并 reject，
        // 让上层把 413 正常写出去（剩余数据被安静吃掉）。
        size = -1;
        chunks.length = 0;
        reject(new HttpError(413, '请求内容太大了'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => { if (size >= 0) resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}

function serveStatic(res, relPath) {
  let clean = relPath.replace(/\\/g, '/');
  if (clean === '/' || clean === '') clean = '/index.html';
  const filePath = path.resolve(path.join(UI_DIR, clean));
  if (!filePath.startsWith(path.resolve(UI_DIR))) { sendJson(res, 403, { ok: false, error: '禁止访问' }); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { sendJson(res, 404, { ok: false, error: '找不到页面' }); return; }
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html' || ext === '.htm') { sendHtml(res, data); return; }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': ext === '.png' || ext === '.jpg' || ext === '.svg' ? 'public, max-age=86400' : 'no-store'
    });
    res.end(data);
  });
}

function debugPage(ctx) {
  const esc = (s) => str(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let logTail = '';
  try {
    const f = path.join(VAR_DIR, 'app.log');
    if (fs.existsSync(f)) logTail = fs.readFileSync(f, 'utf8').split('\n').slice(-60).join('\n');
  } catch (e) { logTail = '(读取日志失败)'; }
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lumio · 运行诊断</title>
<style>body{font-family:system-ui,'Microsoft YaHei',sans-serif;background:#FFF9F0;color:#4A3B4F;padding:20px;line-height:1.7}
pre{background:#fff;padding:14px;border-radius:14px;overflow:auto;font-size:12px;border:2px solid #FFE0E8}
h1{font-size:20px}table{border-collapse:collapse;background:#fff;border-radius:14px;overflow:hidden;width:100%}
td{border-bottom:1px solid #FFE0E8;padding:8px 12px;font-size:14px}td:first-child{color:#A08AA6;width:40%}</style></head>
<body><h1>💡 Lumio · 运行诊断</h1>
<table>
<tr><td>当前身份 UID</td><td>${esc(ctx.user ? ctx.user.uid : '(未认证)')}</td></tr>
<tr><td>当前用户名</td><td>${esc(ctx.user ? ctx.user.username : '-')}</td></tr>
<tr><td>是否管理员</td><td>${esc(ctx.user ? String(ctx.user.isAdmin) : '-')}</td></tr>
<tr><td>识别到的角色</td><td>${esc(ctx.role)}</td></tr>
<tr><td>BASE_PATH</td><td>${esc(BASE_PATH)}</td></tr>
<tr><td>监听方式</td><td>${esc(SOCKET_PATH ? 'Unix Socket ' + SOCKET_PATH : 'TCP :' + PORT)}</td></tr>
<tr><td>数据目录</td><td>${esc(DATA_DIR)}</td></tr>
<tr><td>运行目录</td><td>${esc(VAR_DIR)}</td></tr>
<tr><td>数据统计</td><td>孩子 ${DB.kids.length} 人 / 流水 ${DB.ledger.length} 条 / 见过 ${DB.seenUsers.length} 位飞牛用户</td></tr>
</table>
<h1>最近日志</h1><pre>${esc(logTail || '(暂无)')}</pre>
<p><a href="${BASE_PATH || '/'}">← 返回Lumio</a></p></body></html>`;
}

const server = http.createServer(async (req, res) => {
  let urlPath = (req.url || '/').split('?')[0];
  const query = new URLSearchParams(((req.url || '').split('?')[1]) || '');

  // 剥离网关前缀
  if (BASE_PATH && urlPath.startsWith(BASE_PATH)) {
    urlPath = urlPath.slice(BASE_PATH.length) || '/';
  }

  // resolveCtx 必须放在 try 内：否则它一旦抛错，异步处理器会静默 reject，
  // 请求永远等不到响应（表现为页面一直转圈），且日志里只有 unhandledRejection。
  let ctx;
  try {
    ctx = resolveCtx(req);
    // 限时任务到点自动销毁（每次 API 请求都检查一次，销毁后立即落盘）
    if (urlPath.indexOf('/api/') === 0 && purgeExpiredTasks()) saveDB();
    if (urlPath === '/api/health') {
      sendJson(res, 200, { ok: true, app: APPNAME, socket: !!SOCKET_PATH, base: BASE_PATH, time: nowISO() });
      return;
    }

    if (urlPath === '/api/identity') {
      sendJson(res, 200, {
        ok: true, role: ctx.role,
        me: ctx.user,
        kidName: ctx.kid ? ctx.kid.name : null,
        gatewayHeaders: !!req.headers['x-trim-userid'] || !!req.headers['x-trim-username']
      });
      return;
    }

    if (urlPath === '/debug') {
      if (!ctx.user || !ctx.user.isAdmin) { res.writeHead(401); res.end('401 Unauthorized'); return; }
      const html = Buffer.from(debugPage(ctx), 'utf8');
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Content-Length': html.length, 'Cache-Control': 'no-store' });
      res.end(html);
      return;
    }

    if (urlPath.startsWith('/api/')) {
      if (!ctx.user) {
        sendJson(res, 401, { ok: false, code: 'NO_IDENTITY', error: '请从飞牛桌面打开「Lumio」，或刷新页面重试。' });
        return;
      }

      if (urlPath === '/api/state' && req.method === 'GET') {
        sendJson(res, 200, { ok: true, state: buildState(ctx) });
        return;
      }

      if (urlPath === '/api/backup' && req.method === 'GET') {
        if (!ctx.user.isAdmin) { sendJson(res, 403, { ok: false, error: '只有系统管理员可以备份数据' }); return; }
        const stamp = localDay().replace(/-/g, '') + '-' + new Date().toTimeString().slice(0, 8).replace(/:/g, '');
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="lumio-backup-' + stamp + '.json"',
          'Cache-Control': 'no-store'
        });
        res.end(JSON.stringify(DB, null, 1));
        return;
      }

      if (urlPath === '/api/action' && req.method === 'POST') {
        let raw;
        try { raw = await readBody(req); } catch (e) {
          // 读体失败要透传真实状态码（如 413 请求过大），别一律归并成 400
          const code = e instanceof HttpError ? e.code : 400;
          sendJson(res, code, { ok: false, error: (e && e.message) || '请求格式不正确' });
          return;
        }
        let payload;
        try { payload = JSON.parse(raw || '{}'); } catch (e) {
          sendJson(res, 400, { ok: false, error: '请求格式不正确' });
          return;
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          // JSON 字面量 null / 数字 / 数组：统一 400。
          // 此前 null 会在读 payload.action 时抛 TypeError → 500 且把内部错误原文回传客户端
          sendJson(res, 400, { ok: false, error: '请求格式不正确' });
          return;
        }
        const name = str(payload.action);
        const spec = ACTIONS[name];
        if (!spec) { sendJson(res, 404, { ok: false, error: '没有这个操作：' + name }); return; }
        const isParentRole = ctx.role === 'admin' || ctx.role === 'parent';
        const allowed = spec.role === 'any' ? isParentRole || ctx.role === 'kid' : (spec.role === 'admin' ? isParentRole : ctx.role === spec.role);
        if (!allowed) {
          log('[deny] uid=' + ctx.user.uid + ' role=' + ctx.role + ' action=' + name);
          sendJson(res, 403, {
            ok: false,
            error: ctx.role === 'unbound'
              ? '你的飞牛账号还没有被家长绑定，暂时不能操作。'
              : '你没有权限执行这个操作。'
          });
          return;
        }
        if (spec.systemAdminOnly && !ctx.user.isAdmin) {
          // 标记 systemAdminOnly 的操作（解绑身份、清空数据）仅飞牛系统管理员可用
          log('[deny] uid=' + ctx.user.uid + ' role=' + ctx.role + ' action=' + name + ' (systemAdminOnly)');
          sendJson(res, 403, { ok: false, error: '只有管理员账号可以执行这个操作。' });
          return;
        }
        const params = payload.payload && typeof payload.payload === 'object' ? payload.payload : {};
        /* 动作允许返回 Promise（如推送测试需要等网络结果），统一在此收口 */
        Promise.resolve()
          .then(() => spec.run(ctx, params))
          .then((result) => {
            scheduleSave();          // P1-#2：去抖落盘，替代每动作同步整库写
            sendJson(res, 200, { ok: true, result: result || {}, state: buildState(ctx) });
          })
          .catch((e) => {
            const code = e instanceof HttpError ? e.code : 500;
            if (code >= 500) log('[error] ' + name + ': ' + (e && e.stack ? e.stack : e));
            sendJson(res, code, { ok: false, error: (e && e.message) || '执行失败' });
          });
        return;
      }

      sendJson(res, 404, { ok: false, error: '接口不存在' });
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      serveStatic(res, urlPath);
      return;
    }
    sendJson(res, 405, { ok: false, error: '不支持的方法' });
  } catch (e) {
    const code = e && e.code && Number.isInteger(e.code) ? e.code : 500;
    if (code >= 500) log('[error] ' + (e && e.stack ? e.stack : e));
    sendJson(res, code >= 400 && code < 600 ? code : 500, { ok: false, error: (e && e.message) || '服务器开小差了' });
  }
});

module.exports = {
  server
};
