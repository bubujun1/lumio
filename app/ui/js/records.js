/* ============================================================
   Lumio · records.js —— 通用记录卡：列表折叠显示 + 「查看全部」筛选弹窗
   分层：L2 渲染　　依赖：render / ui-kit
   ============================================================ */
import { cardHead } from './render.js';
import { openModal, closeModal } from './ui-kit.js';

/* ============================================================
   通用记录卡：列表只显示最近 N 条 + 「查看全部」弹窗（弹窗内可筛选）
   每条记录由 rowFn(item) 渲染；filters = [{ key, label, options:[{v,label}], match(item,v) }]
   ============================================================ */
/* v2.0.61：这两个可变容器收为模块私有，只经访问器对外。
   导出「可被整体重赋值」的对象在 ESM 实时绑定下是脚枪——任一处赋值，所有引用者立刻看到新值，
   且外部也能写，状态归属说不清。改为私有 + 具名访问器后，谁能改、改什么一目了然。 */
var _recViews = {};   // key -> { title, items, rowFn, filters, empty }
var _recState = null; // 当前「查看全部」弹窗的筛选状态

/* 取「查看全部」弹窗的数据源（无则 null） */
export function recView(key) { return _recViews[key] || null; }
/* 切换弹窗内的筛选：再点同一项 = 取消该筛选。返回 true 表示确有弹窗需要重绘 */
export function recToggleFilter(fk, fv) {
  if (!_recState) return false;
  var cur = _recState.f[fk] || '';
  _recState.f[fk] = (cur === fv) ? '' : fv;
  return true;
}
export function recCardHtml(opts) {
  _recViews[opts.key] = { title: opts.title, items: opts.items, rowFn: opts.rowFn, filters: opts.filters || [], empty: opts.empty || '还没有记录' };
  var max = opts.max || 3;
  var n = opts.items.length;
  var body = n ? opts.items.slice(0, max).map(opts.rowFn).join('')
    : '<div class="empty" style="padding:14px">' + (opts.empty || '还没有记录') + '</div>';
  var more = n > 0 ? '<button class="btn xs ghost" data-act="rec-view" data-rec="' + opts.key + '">查看全部 ' + n + ' 条 ›</button>' : '';
  return cardHead((opts.icon || '📖'), opts.title, (opts.chip || '')) + body + more + '</div>';
}
export function openRecordsModal(opts) {
  _recState = { items: opts.items, rowFn: opts.rowFn, filters: opts.filters || [], f: {}, empty: opts.empty || '没有记录' };
  openModal({
    title: opts.title,
    render: renderRecordsBody,
    actions: false,
    focus: false,
    onOk: function () { closeModal(); }
  });
}
function renderRecordsBody() {
  var R = _recState;
  var rows = R.items.filter(function (it) {
    return R.filters.every(function (f) {
      var v = R.f[f.key] || '';
      return !v ? true : (f.match ? f.match(it, v) : true);
    });
  });
  var fc = '';
  if (R.filters.length) {
    fc = '<div class="row wrap" style="gap:7px;margin-bottom:12px">';
    R.filters.forEach(function (f) {
      var allOn = !R.f[f.key];
      fc += '<button class="chip ' + (allOn ? '' : 'gray') + '" data-act="rec-filter" data-fk="' + f.key + '" data-fv="">' + f.label + '</button>';
      f.options.forEach(function (o) {
        var on = R.f[f.key] === o.v;
        fc += '<button class="chip ' + (on ? '' : 'gray') + '" data-act="rec-filter" data-fk="' + f.key + '" data-fv="' + o.v + '">' + o.label + '</button>';
      });
    });
    fc += '</div>';
  }
  var list = rows.length ? rows.map(R.rowFn).join('')
    : '<div class="empty" style="padding:18px">' + R.empty + '</div>';
  return '<div class="reclist">' + fc + list + '</div>';
}
