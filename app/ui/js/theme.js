/* ============================================================
   Lumio · theme.js —— 配色主题：localStorage 偏好 + <body> class 切换（颜色全走 CSS 变量，切换无需重绘）
   分层：L0 基础　　依赖：core
   ============================================================ */
import { q } from './core.js';

/* ============================================================
   配色主题：粉色渐变 / 蓝色渐变
   纯前端偏好，存 localStorage；切换只动 <body> 的 class，
   所有颜色都走 CSS 变量，因此无需重绘数据。
   ============================================================ */
var THEME_KEY = 'lumio.theme';
var themeAllowed = ['pink', 'blue', 'sun'];
var THEMES = [
  { v: 'pink', t: '粉色渐变' },
  { v: 'blue', t: '蓝色渐变' },
  { v: 'sun', t: '黄色渐变' }
];
export function themeNow() {
  var vs = ['pink', 'blue', 'sun'];
  try {
    var v = localStorage.getItem(THEME_KEY);
    return vs.indexOf(v) >= 0 ? v : 'pink';
  } catch (e) { return 'pink'; }
}
export function applyTheme(v) {
  var t = themeAllowed.indexOf(v) >= 0 ? v : 'pink';
  if (document.body) {
    document.body.classList.toggle('theme-blue', t === 'blue');
    document.body.classList.toggle('theme-sun', t === 'sun');
  }
  try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* 隐私模式等：忽略 */ }
  var m = q('meta[name="theme-color"]');
  if (m) m.setAttribute('content', t === 'blue' ? '#E6EFFF' : t === 'sun' ? '#FFF3CE' : '#FFEDF3');
}
/* 顶栏里的双色圆点切换器（放在 Lumio 旁边） */
export function themeSw() {
  var cur = themeNow();
  return '<div class="themesw" role="group" aria-label="切换配色">' +
    THEMES.map(function (x) {
      return '<button class="tsw ' + x.v + (cur === x.v ? ' on' : '') + '"' +
        ' data-act="theme" data-v="' + x.v + '" title="' + x.t + '" aria-label="' + x.t + '"' +
        ' aria-pressed="' + (cur === x.v ? 'true' : 'false') + '"></button>';
    }).join('') +
    '</div>';
}
