/* ============================================================
   Lumio · actions.js —— 动作派发 doAct：提交 → 收起弹窗 → 用新 state 重绘 → 提示
   分层：L4 交互　　依赖：core / api / feedback / state / render / ui-kit / boot
   ============================================================ */
import { running, done } from './core.js';
import { apiAct } from './api.js';
import { toast } from './feedback.js';
import { S } from './state.js';
import { paint } from './render.js';
import { maskOf, closeModalOf, closeModal, refreshTopModal, confirmBox } from './ui-kit.js';
import { refresh } from './boot.js';

export function doAct(action, payload, btn, okMsg) {
  if (S.busy) return;
  S.busy = true;
  running(btn);
  var origin = maskOf(btn);
  apiAct(action, payload).then(function (res) {
    S.busy = false;
    done(btn);
    if (!res || !res.ok) { toast((res && res.error) || '操作失败', 'err'); return; }
    if (origin) closeModalOf(origin); else closeModal();
    var prev = S.state;
    if (res.state) { S.state = res.state; paint(prev, true); }
    refreshTopModal();
    if (okMsg) toast(okMsg, 'ok');
    else refresh(true);
  });
}

/* v2.0.61：确认框 + doAct 的样板。o = { title, body, okText, okClass, act, payload, toast } */
export function confirmAct(o) {
  return confirmBox({
    title: o.title, body: o.body, okText: o.okText || '确定', okClass: o.okClass || '',
    onOk: function (m, b) { doAct(o.act, o.payload, b, o.toast); }
  });
}
/* 删除确认：标题「删除X」+ 正文「确定删除这个X吗？」+ 红色「删除」按钮。
   o = { what, act, id, toast } */
export function confirmDelete(o) {
  return confirmAct({
    title: '删除' + o.what, body: '确定删除这个' + o.what + '吗？',
    okText: '删除', okClass: 'danger',
    act: o.act, payload: { id: o.id }, toast: o.toast || '已删除'
  });
}
