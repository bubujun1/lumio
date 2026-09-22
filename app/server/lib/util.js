/* ============================================================
   Lumio 后端 · lib/util.js —— 通用工具：时间/字符串/数值/日志 + HttpError
   分层：L0 工具
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { VAR_DIR } = require('./config');

/* ------------------------------------------------------------------ 工具 */

const nowISO = () => new Date().toISOString();
const dayEndISO = (dayStr) => dayStr + 'T23:59:59'; // 本地当天 23:59:59（无时区 date-time 按本地解析）
const uid = (p) => p + '_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
const str = (v) => (v === undefined || v === null ? '' : String(v));
const clampInt = (v, min, max, dflt) => {
  const n = Math.round(Number(v));
  if (!isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
};
const trimText = (v, max) => str(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const localDay = (d) => {
  const x = d ? new Date(d) : new Date();
  const p = (n) => String(n).padStart(2, '0');
  return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate());
};
const fmtDeadlineText = (iso) => {
  if (!iso) return '';
  const x = new Date(iso);
  if (isNaN(x.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return (x.getMonth() + 1) + '月' + x.getDate() + '日 ' + p(x.getHours()) + ':' + p(x.getMinutes());
};

function log(...a) {
  const line = new Date().toISOString() + ' ' + a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
  console.log(line);
  try {
    if (!fs.existsSync(VAR_DIR)) fs.mkdirSync(VAR_DIR, { recursive: true });
    fs.appendFileSync(path.join(VAR_DIR, 'app.log'), line + '\n');
  } catch (e) { /* ignore */ }
}

class HttpError extends Error {
  constructor(code, msg) { super(msg); this.code = code; }
}

module.exports = {
  uid,
  nowISO,
  log,
  str,
  trimText,
  clampInt,
  dayEndISO,
  localDay,
  HttpError,
  fmtDeadlineText
};
