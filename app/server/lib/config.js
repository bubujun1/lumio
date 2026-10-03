/* ============================================================
   Lumio 后端 · lib/config.js —— 环境变量与路径常量（网关 socket / 端口 / 数据目录 / 请求体上限）
   分层：L0 配置
   ============================================================ */
'use strict';

const path = require('path');
const fs = require('fs');

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

/* ------------------------------------------------------------------ 版本自检
   应用版本的权威来源是 fpk 顶层的 manifest。但该文件由 fnOS 部署流程放置，
   安装后的绝对路径并不由本仓库决定 —— 只有 app/ 内的文件才保证落在 ${APP_DIR}。
   历史缺陷（F3/F4）：只查 ${APP_DIR}/../manifest，在 fnOS 真实布局下读不到，
   版本恒为 0.0.0，且被 catch 静默吞掉、无线索。
   现在改为：从本文件位置逐级上溯 + 校验 appname 确属本应用 + 内置常量兜底，
   并回报来源(source)便于排障。 */
const APP_VERSION_FALLBACK = '1.0.2';   // 发版时与 manifest 的 version 同步（verify-pack 断言把关）

function readManifestVersion(file) {
  let txt;
  try { txt = fs.readFileSync(file, 'utf8'); } catch (e) { return ''; }
  // 校验确属本应用的 manifest，避免误读到其它应用/上级目录的同名文件
  if (!/^[ \t]*appname[ \t]*=[ \t]*["']?lumio["']?[ \t\r]*$/m.test(txt)) return '';
  const m = txt.match(/^[ \t]*version[ \t]*=[ \t]*([0-9]+\.[0-9]+\.[0-9]+)/m);
  return m ? m[1] : '';
}

function resolveAppVersion() {
  const cands = [];
  let d = __dirname;
  for (let i = 0; i < 6; i++) {          // app/server/lib -> ... -> 安装根 -> 上级
    cands.push(path.join(d, 'manifest'));
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  if (APP_DIR) {                          // APP_DIR 未注入/指向异常时的兜底
    cands.push(path.join(APP_DIR, 'manifest'));
    cands.push(path.join(APP_DIR, '..', 'manifest'));
  }
  const seen = [];
  for (const p of cands) {
    if (seen.indexOf(p) >= 0) continue;
    seen.push(p);
    const v = readManifestVersion(p);
    if (v) return { version: v, source: p, fallback: false };
  }
  return { version: APP_VERSION_FALLBACK, source: '(内置常量)', fallback: true };
}

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
  APPNAME,
  APP_DIR,
  APP_VERSION_FALLBACK,
  resolveAppVersion
};
