/* ============================================================
   Lumio 后端 · lib/config.js —— 环境变量与路径常量（网关 socket / 端口 / 数据目录 / 请求体上限）
   分层：L0 配置
   ============================================================ */
'use strict';

const path = require('path');

const SOCKET_PATH = (process.env.MONITOR_SOCKET_PATH || '').trim();
const BASE_PATH = (process.env.BASE_PATH || '/app/lumio').replace(/\/+$/, '');
const PORT = parseInt(process.env.PORT || '8787', 10);
const APP_DIR = process.env.APP_DIR || path.join(__dirname, '..', '..');   // 本文件在 app/server/lib/，回退两级才是 app/
const UI_DIR = path.join(APP_DIR, 'ui');
const DATA_DIR = process.env.DATA_DIR || path.join(APP_DIR, '..', 'data');
const VAR_DIR = process.env.VAR_DIR || DATA_DIR;
const APPNAME = process.env.APPNAME || 'lumio';
// 本地开发兜底：无网关注入身份时，允许用 X-Dev-* 头模拟。生产不开启。
const DEV_IDENTITY = process.env.LUMIO_DEV === '1';
const DB_FILE = path.join(DATA_DIR, 'db.json');
const MAX_BODY = 512 * 1024;

module.exports = {
  VAR_DIR,
  DATA_DIR,
  DB_FILE,
  DEV_IDENTITY,
  BASE_PATH,
  MAX_BODY,
  UI_DIR,
  SOCKET_PATH,
  PORT,
  APPNAME
};
