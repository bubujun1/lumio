/* ============================================================
   Lumio · core.js —— DOM 与字符串工具 / 事件委托注册器 on / 通用按钮态 / 孩子头像与配色常量
   分层：L0 基础　　依赖：无
   ============================================================ */
/* ============================================================
   基础
   ============================================================ */
export var APP_BASE = (function () {
  /* 网关前缀：后端在服务 index.html 时把 __APP_BASE__ 替换为真实前缀（见 index.html 的 <html data-base>）。
     拆分后本文件已不在 HTML 内、拿不到那次替换，因此改为读取 <html data-base>；缺失时按当前路径推导。 */
  var dsEl = document.documentElement;
  var injected = (dsEl && dsEl.getAttribute('data-base')) || '';
  if (injected.charAt(0) === '/') return injected;
  var p = String(location.pathname || '/');
  p = p.replace(/\/index\.html?$/i, '').replace(/\/+$/, '');
  return p === '/' ? '' : p;
})();

export function h(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
export function q(sel, root) { return (root || document).querySelector(sel); }
export function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
/* 颜色白名单：仅放行 #RGB ~ #RRGGBBAA；非法值回退默认粉，避免注入到内联 style */
export function safeColor(c) {
  return /^#[0-9a-fA-F]{3,8}$/.test(String(c == null ? '' : c)) ? c : '#FF8FA3';
}
export function on(sel, ev, fn) {
  document.addEventListener(ev, function (e) {
    var t = e.target.closest(sel);
    if (t) fn(e, t);
  });
}
/* v2.0.61：头像 / 配色候选不再在前端另写一份——后端 lib/constants.js 是**唯一来源**,
   经 state.consts 下发（家长端 buildAdminState），前端在「新建 / 编辑孩子」弹窗里读取。
   注：后端 AVATARS 是含 ⭐ 的 13 项校验白名单，下发时已剔除 ⭐（⭐ 是默认 / 家长头像）。 */
export function val(sel, mask) { var e = q(sel, mask); return e ? String(e.value || '').trim() : ''; }

export function running(btn, txt) {
  if (btn) { btn.disabled = true; btn.dataset._t = btn.textContent; btn.textContent = txt || '处理中…'; }
}
export function done(btn) {
  if (btn && btn.dataset._t) { btn.disabled = false; btn.textContent = btn.dataset._t; }
}
