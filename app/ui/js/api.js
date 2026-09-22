/* ============================================================
   Lumio · api.js —— 与后端通信：apiGet / apiAct
   分层：L1 数据　　依赖：core
   ============================================================ */
import { APP_BASE } from './core.js';

/* ============================================================
   网络
   ============================================================ */
export function apiGet(path) {
  return fetch(APP_BASE + path, { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
    return r.json().catch(function () { return { ok: false, error: '服务返回异常（HTTP ' + r.status + '）' }; });
  }).catch(function () {
    return { ok: false, error: '无法连接本机服务，请刷新页面重试。' };
  });
}
export function apiAct(action, payload) {
  return fetch(APP_BASE + '/api/action', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: action, payload: payload || {} })
  }).then(function (r) {
    return r.json().catch(function () { return { ok: false, error: '服务返回异常（HTTP ' + r.status + '）' }; });
  }).catch(function () {
    return { ok: false, error: '无法连接本机服务，请刷新页面重试。' };
  });
}
