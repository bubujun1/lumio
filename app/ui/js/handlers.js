/* ============================================================
   Lumio · handlers.js —— 事件委托总入口：data-act 查表路由 + 表单与全局键鼠监听
   分层：L4 交互　　依赖：core / state / render / ui-kit / pages-admin / pages-kid / registry / handlers-shell / handlers-records / handlers-account / handlers-task / handlers-shop / handlers-msg
   ============================================================ */
import { on, q } from './core.js';
import { S } from './state.js';
import { paint } from './render.js';
import { closeModal } from './ui-kit.js';
import { loadMonthStats, LumioFaceHint } from './pages-admin.js';
import { rqPrev } from './pages-kid.js';
import { findAct } from './registry.js';
import './handlers-shell.js';
import './handlers-records.js';
import './handlers-account.js';
import './handlers-task.js';
import './handlers-shop.js';
import './handlers-msg.js';

/* ============================================================
   交互
   ============================================================ */
on('#recDay', 'change', function (e, el) {
  S.recDay = el.value || '';
  paint(null, true);
});
on('#statsMonth', 'change', function (e, el) {
  loadMonthStats((el.value || '').slice(0, 7));
});
on('[data-role="taskTypePick"]', 'change', function (e, el) {
  var wrap = q('#fDeadlineWrap');
  if (wrap) wrap.classList.toggle('hidden', el.value !== 'timed');
});
/* v2.0.54：面额 / 份数输入的内联 oninput 改为事件委托，与 on() 体系一致（也避免内联属性绕过委托、更 CSP 友好） */
on('#fCost', 'input', function () { LumioFaceHint(); });
on('#fCy', 'input', function () { LumioFaceHint(); });
on('#fQty', 'input', function () { rqPrev(); });

/* 点击弹窗遮罩关闭由 openModal 内部处理；ESC 关闭 */
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
/* 留言输入框：单行起步，随内容自适应长高（上限 110px，约 4 行） */
document.addEventListener('input', function (e) {
  var t = e.target;
  if (t && t.id === 'chatIn' && t.tagName === 'TEXTAREA') {
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 110) + 'px';
    var sc = q('#chatScroll'); if (sc) sc.scrollTop = sc.scrollHeight;
  }
});
/* 键盘弹出把对话区顶上去：聚焦输入框后延迟两次滚到最新消息 */
document.addEventListener('focusin', function (e) {
  var t = e.target;
  if (t && t.id === 'chatIn' && t.tagName === 'TEXTAREA') {
    setTimeout(function () { var sc = q('#chatScroll'); if (sc) sc.scrollTop = sc.scrollHeight; }, 250);
    setTimeout(function () { var sc = q('#chatScroll'); if (sc) sc.scrollTop = sc.scrollHeight; }, 700);
  }
});
/* ---- data-act 查表派发 ----
   各域 handler 在自己的模块里 regAct(...) 注册；这里只负责取键、查表、调用。
   与拆分前的 if 链等价：未注册的 act 静默忽略（原先所有分支都以 return 结尾）。 */
on('[data-act]', 'click', function (e, el) {
  var act = el.getAttribute('data-act');
  var id = el.getAttribute('data-id');
  var fn = findAct(act);
  if (fn) fn(e, el, act, id);
});
