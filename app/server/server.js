#!/usr/bin/env node
/* ============================================================
   Lumio 后端 · server.js —— 进程入口：异常兜底、加载数据、监听 Unix Socket 或 TCP
   分层：L6 入口
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const { SOCKET_PATH, BASE_PATH, PORT, DEV_IDENTITY } = require('./lib/config');
const { log } = require('./lib/util');
const { levelOf } = require('./lib/level');
const { loadDB, defaultDB, normalizeDB, flushSave } = require('./lib/db');
const { ACTIONS } = require('./lib/actions');
const { server } = require('./lib/http');

/* ------------------------------------------------------------------ 启动 */

process.on('uncaughtException', (e) => log('[uncaughtException] ' + (e && e.stack ? e.stack : e)));
process.on('unhandledRejection', (e) => log('[unhandledRejection] ' + (e && e.stack ? e.stack : e)));

// 监听失败必须显式退出：否则进程"假活"、socket 永不出现，表现为应用启用失败且日志无线索
server.on('error', (e) => {
  log('[fatal] listen failed: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});

// 优雅退出：同步落盘兜底（P1-#2 引入去抖落盘后，必须在此 flush，避免去抖窗口内的写入丢失）
function gracefulShutdown() {
  try { flushSave(); } catch (e) { /* ignore */ }
  process.exit(0);
}
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

loadDB();

if (SOCKET_PATH) {
  try { fs.unlinkSync(SOCKET_PATH); } catch (e) { /* ignore */ }
  server.listen(SOCKET_PATH, () => {
    try { fs.chmodSync(SOCKET_PATH, 0o777); } catch (e) { /* ignore */ }
    log('listening on socket ' + SOCKET_PATH + ' base=' + BASE_PATH);
  });
} else {
  server.listen(PORT, '0.0.0.0', () => {
    log('listening on http://0.0.0.0:' + PORT + ' base=' + (BASE_PATH || '(root)') + ' dev=' + DEV_IDENTITY);
  });
}

module.exports = { server, ACTIONS, defaultDB, normalizeDB, levelOf };
