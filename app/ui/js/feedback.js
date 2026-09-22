/* ============================================================
   Lumio · feedback.js —— 用户反馈动效：toast 提示 / coinBurst 飞积分 / showFloat 飘字
   分层：L2 渲染　　依赖：core
   ============================================================ */
import { q } from './core.js';

export function toast(msg, kind) {
  var wrap = q('#toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
  var el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  var ic = document.createElement('span'); ic.className = 'ti';
  ic.textContent = kind === 'ok' ? '✓' : (kind === 'err' ? '✕' : (kind === 'warn' ? '⚠' : 'ℹ'));
  var tx = document.createElement('span'); tx.textContent = msg;
  el.appendChild(ic); el.appendChild(tx);
  wrap.appendChild(el);
  setTimeout(function () {
    el.style.opacity = '0'; el.style.transform = 'translateY(-6px)';
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
  }, 2400);
}

/* 积分飞起动效 */
export function coinBurst(x, y, text) {
  var el = document.createElement('div');
  el.className = 'coinfx';
  el.style.left = (x - 22) + 'px';
  el.style.top = (y - 30) + 'px';
  el.innerHTML = '<div style="font-size:26px;font-weight:800;color:#c98a1b;text-shadow:0 2px 0 #fff">' +
    (text || '') + '</div>';
  document.body.appendChild(el);
  setTimeout(function () { el.remove(); }, 1200);
}

/* 居中偏上的到账/提醒飘字 */
export function showFloat(text, emoji) {
  var d = document.createElement('div');
  d.className = 'coinfloat';
  d.innerHTML = '<div class="cf-e"></div><div class="cf-t"></div>';
  d.querySelector('.cf-e').textContent = emoji || '🪙';
  d.querySelector('.cf-t').textContent = text;
  document.body.appendChild(d);
  setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 2000);
}
