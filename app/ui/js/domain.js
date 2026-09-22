/* ============================================================
   Lumio · domain.js —— 家长端 / 孩子端共用的领域小工具：任务分组 groupOf / 会话行 convRow / 已读判断 isReadBy
   分层：L2 共用　　依赖：core
   ============================================================ */
import { safeColor, h } from './core.js';

/* ============================================================ 家长：任务 */
/* 任务所属分组（兼容旧数据：服务端已下发 group，这里再兜一次底） */
export function groupOf(t) {
  if (t.group) return t.group;
  if (t.type === 'timed') return 'timed';
  if (t.type === 'once') return 'temp';
  if (t.type === 'weekly') return 'weekly';
  if (t.type === 'monthly') return 'monthly';
  return 'daily'; // daily 或旧数据（无 group 字段）一律归到「每日」
}
export function isReadBy(m, me) { return (m.readBy || []).indexOf(me.kind + ':' + (me.id || '*')) >= 0; }

/* 对话视图：myRef 决定气泡左右 */
/* 会话行（微信式）：家长端 / 孩子端共用；差异项（暗态/头像底色/点击行为/预览内容）由 opts 传入 */
export function convRow(o) {
  return '<div class="wxrow' + (o.cls ? ' ' + o.cls : '') + '"' +
    (o.tap ? ' data-act="' + o.tap.act + '" data-' + o.tap.key + '="' + o.tap.val + '"' : '') + '>' +
    '<div class="wxava"' + (o.avaBg ? ' style="background:' + safeColor(o.avaBg) + '"' : '') + '>' + h(o.ava) +
    (o.unread ? '<span class="wcdot">' + o.unread + '</span>' : '') + '</div>' +
    '<div class="wxbody"><div class="wxhead"><span class="wxname">' + o.name + '</span>' +
    '<span class="wxtime">' + o.time + '</span></div>' +
    '<div class="wxprev">' + o.prev + '</div></div></div>';
}
