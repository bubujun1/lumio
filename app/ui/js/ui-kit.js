/* ============================================================
   Lumio · ui-kit.js —— 弹层与表单控件：openModal 弹窗栈 / 图标选择器抽屉 / 聊天贴底
   分层：L2 渲染　　依赖：core / icons / state
   ============================================================ */
import { q, h } from './core.js';
import { ICON_KEY, ICON_SETS } from './icons.js';
import { S } from './state.js';

/* ============================================================
   弹窗
   ============================================================ */
var modalState = null;
var modalStack = [];
/* 聊天区贴底：首次打开滚到最新消息；重绘时原来贴底才保持贴底（微信式，不打断回看历史） */
export function chatStick() {
  var old = q('#chatScroll');
  var near = !old || (old.scrollHeight - old.scrollTop - old.clientHeight < 80);
  setTimeout(function () { var sc = q('#chatScroll'); if (sc && near) sc.scrollTop = sc.scrollHeight; }, 0);
}
function modalBodyOf(opts) { return typeof opts.render === 'function' ? opts.render() : (opts.body || ''); }
export function openModal(opts) {
  var mask = document.createElement('div');
  mask.className = 'mask';
  mask.innerHTML = '<div class="modal' + (opts.cls ? ' ' + opts.cls : '') + '" id="modalBox"><h2 id="modalTitle"><span class="mtitle">' + h(opts.title) + '</span>' +
    '<button class="mx" data-act="modal-x" aria-label="关闭">✕</button></h2>' +
    '<div id="modalBody">' + modalBodyOf(opts) + '</div>' +
    '<div class="modal-actions" id="modalActions"></div></div>';
  document.body.appendChild(mask);
  var entry = { mask: mask, opts: opts };
  modalStack.push(entry);
  modalState = entry;
  var acts = q('#modalActions', mask);
  if (opts.actions === false) { acts.style.display = 'none'; return mask; }
  /* v2.0.47：okOnly —— 纯告知类弹窗只保留一枚「确定」，居中（不再摆「取消」） */
  if (opts.okOnly) acts.classList.add('one');
  /* v2.0.46：可选第三枚「删除」（渲染在「取消」左侧 → 删除 / 取消 / 保存 三枚等宽） */
  if (opts.dangerText) {
    var delBtn = document.createElement('button');
    delBtn.className = 'btn ' + (opts.dangerClass || 'danger');
    delBtn.textContent = opts.dangerText;
    delBtn.onclick = function () { if (typeof opts.onDanger === 'function') opts.onDanger(mask, delBtn); };
    acts.appendChild(delBtn);
  }
  if (!opts.okOnly) {
    var cancel = document.createElement('button');
    cancel.className = 'btn ghost';
    cancel.textContent = opts.cancelText || '取消';
    cancel.onclick = function () { closeModal(); if (typeof opts.onCancel === 'function') opts.onCancel(); };
    acts.appendChild(cancel);
  }
  var ok = document.createElement('button');
  ok.className = 'btn ' + (opts.okClass || '');
  ok.textContent = opts.okText || '确定';
  ok.onclick = function () {
    if (opts.onOk) opts.onOk(mask, ok);
  };
  acts.appendChild(ok);
  var f = q('input,textarea,select', q('#modalBody', mask));
  if (f && opts.focus !== false) setTimeout(function () { f.focus(); }, 120);
  mask.addEventListener('click', function (e) { if (e.target === mask) closeModal(); });
  return mask;
}
export function iconField(k, cur) {
  S[ICON_KEY[k]] = cur || ICON_SETS[k][0];
  return '<div class="field"><label>选个图标</label>' +
    '<button type="button" class="iconbox" id="pickBox' + k + '" data-act="ick" data-k="' + k + '" aria-label="选个图标">' +
    h(S[ICON_KEY[k]]) + '</button></div>';
}
export function syncIconBox(k) {
  var b = q('#pickBox' + k);
  if (b) b.textContent = S[ICON_KEY[k]] || '＋';
}
export function openIconPicker(k) {
  var prev = S[ICON_KEY[k]];
  openModal({
    title: '🎨 选个图标',
    body: '<div class="pickgrid">' + ICON_SETS[k].map(function (a) {
      return '<button class="pick ' + (a === prev ? 'on' : '') + '" data-act="p' + k + '" data-v="' + a + '">' + a + '</button>';
    }).join('') + '</div>',
    okText: '确定',
    focus: false,
    onOk: function () { closeModal(); syncIconBox(k); },
    onCancel: function () { S[ICON_KEY[k]] = prev; syncIconBox(k); }
  });
}
/* v2.0.61：确认框样板（此前「删除任务 / 删除奖励 / 解绑」等处逐字重复 openModal 的同一套参数）。
   o = { title, body, okText, okClass, onOk }；正文统一 .tiny 排版，focus:false 避免自动聚焦。 */
export function confirmBox(o) {
  return openModal({
    title: o.title, body: '<div class="tiny">' + (o.body || '') + '</div>',
    okText: o.okText || '确定', okClass: o.okClass || '',
    focus: false, onOk: o.onOk
  });
}

/* 关闭最上层弹窗（支持嵌套：设置中枢 → 子弹窗）*/
export function closeModal() {
  var top = modalStack.pop();
  if (top && top.mask) top.mask.remove();
  modalState = modalStack.length ? modalStack[modalStack.length - 1] : null;
}
/* 只关闭指定弹窗（某动作完成后收起它，露出并刷新下层弹窗）*/
export function closeModalOf(mask) {
  if (!mask) return closeModal();
  for (var i = modalStack.length - 1; i >= 0; i--) {
    if (modalStack[i].mask === mask) { modalStack.splice(i, 1); mask.remove(); break; }
  }
  modalState = modalStack.length ? modalStack[modalStack.length - 1] : null;
}
/* 重绘当前最上层弹窗（下层数据变化后，让设置中枢保持最新）*/
export function refreshTopModal() {
  if (!modalStack.length) return;
  var top = modalStack[modalStack.length - 1];
  if (top.opts && typeof top.opts.render === 'function') {
    var b = q('#modalBody', top.mask);
    if (b) b.innerHTML = top.opts.render();
  }
}
export function maskOf(el) {
  var n = el;
  while (n && n !== document.body) { if (n.classList && n.classList.contains('mask')) return n; n = n.parentNode; }
  return null;
}
