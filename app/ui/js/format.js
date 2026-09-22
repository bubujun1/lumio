/* ============================================================
   Lumio · format.js —— 数字与金额格式化 / 日期与截止时间 / 等级表 / 有效期换算
   分层：L0 基础　　依赖：无
   ============================================================ */
export function fmt(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
/* v2.0.49：现金面额展示——家长填多少就是多少，这里只裁掉多余小数位，不做任何换算 */
export function faceYuan(v) { var n = Math.round((Number(v) || 0) * 100) / 100; return String(n); }
export function when(iso) {
  if (!iso) return '';
  var d = new Date(iso); if (isNaN(d)) return '';
  var p = function (x) { return String(x).padStart(2, '0'); };
  var now = new Date();
  var same = d.toDateString() === now.toDateString();
  if (same) return '今天 ' + p(d.getHours()) + ':' + p(d.getMinutes());
  var y = new Date(now.getTime() - 86400000);
  if (d.toDateString() === y.toDateString()) return '昨天 ' + p(d.getHours()) + ':' + p(d.getMinutes());
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
/* v2.0.51：距今天数（按本地日界算）：0=今天 1=昨天 2=前天…；无效/缺失返回 9999。
   注意必须用 new Date(y,m,d) 构造本地日界——Date.parse('YYYY-MM-DD') 会按 UTC 解析，早 8 小时。 */
export function dayDiff(iso) {
  if (!iso) return 9999;
  var d = new Date(iso); if (isNaN(d)) return 9999;
  var now = new Date();
  return Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
    new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
}
/* 会话列表右侧时间（微信风格）：今天 HH:MM · 昨天 · 周X · 更早 M/D */
export function wxTime(iso) {
  if (!iso) return '';
  var d = new Date(iso); if (isNaN(d)) return '';
  var p = function (x) { return String(x).padStart(2, '0'); };
  var now = new Date();
  var day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var diff = Math.floor((day0 - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (diff <= 0) return p(d.getHours()) + ':' + p(d.getMinutes());
  if (diff === 1) return '昨天';
  if (diff < 7) return '周' + '日一二三四五六'[d.getDay()];
  if (d.getFullYear() === now.getFullYear()) return (d.getMonth() + 1) + '/' + d.getDate();
  return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
}
export function dayLabel(iso) {
  var d = new Date(iso), now = new Date();
  var days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
    new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (days <= 0) return '今天';
  if (days === 1) return '明天';
  if (days < 0) return '已过期';
  return days + ' 天后';
}
/* 限时任务默认截止：明天 20:00（本地时间，datetime-local 格式） */
function dlStr(d) {
  var p = function (x) { return String(x).padStart(2, '0'); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
}
/* 截止时间快捷选项：今晚 21:00 / 明天 20:00 / 本周日 20:00（已过则顺延一周） */
export function deadlinePreset(kind) {
  var d = new Date();
  if (kind === 'tonight') { d.setHours(21, 0, 0, 0); }
  else if (kind === 'weekend') { d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); d.setHours(20, 0, 0, 0); }
  else { d.setDate(d.getDate() + 1); d.setHours(20, 0, 0, 0); }
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 7);
  return dlStr(d);
}
export function deadlineTimeOpts(sel) {
  var opts = '';
  for (var h = 0; h < 24; h++) {
    [0, 30].forEach(function (mm) {
      if (h === 23 && mm === 30) return;
      var v = String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
      opts += '<option value="' + v + '"' + (v === sel ? ' selected' : '') + '>' + v + '</option>';
    });
  }
  return opts;
}
export function defaultDeadline() {
  var d = new Date(Date.now() + 24 * 3600000);
  d.setHours(20, 0, 0, 0);
  var p = function (x) { return String(x).padStart(2, '0'); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
}
export function fmtDT(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d)) return '';
  var p = function (x) { return String(x).padStart(2, '0'); };
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
/* 本地日期串 YYYY-MM-DD（用本地年月日拼接，不用 toISOString，避免 UTC 偏移差一天） */
export function localDayStr(d) {
  var x = d ? new Date(d) : new Date();
  var p = function (n) { return String(n).padStart(2, '0'); };
  return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate());
}
/* 兑换截止日是否已过（与服务端一致：截止日当天全天有效，次日 0 点后才算过期） */
export function redeemExpired(s) {
  if (!s || !s.redeemDeadline) return false;
  return String(s.redeemDeadline).slice(0, 10) < localDayStr();
}

/* 积分 SVG */
/* 积分：圆角星币（暖金圆牌 + 内嵌小星），与吉祥物 Lumi 的星身区分，解除「朋友=钱」隐喻碰撞 */
export function coin(size) {
  var s = size || 17;
  return '<svg class="coin" width="' + s + '" height="' + s + '" viewBox="0 0 40 40">' +
    '<circle cx="20" cy="20" r="19" fill="#F4B23A"/>' +
    '<circle cx="20" cy="20" r="15.5" fill="#FFD36B"/>' +
    '<circle cx="20" cy="20" r="12" fill="#FFE9A8"/>' +
    '<path d="M20 11 L22.1 17.6 L28.9 17.9 L23.4 22.2 L25.3 28.6 L20 24.7 L14.7 28.6 L16.6 22.2 L11.1 17.9 L17.9 17.6 Z" fill="#E2951E"/>' +
    '</svg>';
}

/* Lumio吉祥物：简笔画卡通「Lumi 星」（暖金渐变 + 圆角粗描边 + 星尘）
   opts.mood: wake(默认) / hi / think / sad / cheer / sleep —— 让角色会表达情绪
   opts.level: 1~6（微光→阳光）—— 光晕随等级增强，孩子看到「我的星在长大」 */
export var LUMI_LEVELS = [
  { c: '#E8ECF2', r: 70, o: .35, rays: 0 },  // 1 微光
  { c: '#FFE0A3', r: 74, o: .45, rays: 0 },  // 2 烛光
  { c: '#BFE9C8', r: 78, o: .5,  rays: 6 },  // 3 萤火
  { c: '#BFE0FF', r: 82, o: .55, rays: 6 },  // 4 星光
  { c: '#D9C8FF', r: 86, o: .6,  rays: 8 },  // 5 月光
  { c: '#FFD27A', r: 92, o: .7,  rays: 10 }  // 6 阳光
];
export function byAtAsc(a, b) { return String(a.at).localeCompare(String(b.at)); }

/* 奖励有效期：兼容纯日期（本地 24:00 过期）与旧 ISO 串 */
export function expiryMs(v) {
  var s = String(v || '');
  var m = /^\d{4}-\d{2}-\d{2}$/.exec(s);
  if (m) return new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)), 23, 59, 59, 999).getTime();
  var t = Date.parse(s);
  return isFinite(t) ? t : NaN;
}
export function fmtExpDate(v) {
  var s = String(v || '');
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return m[1] + '.' + m[2] + '.' + m[3];
  var d = new Date(s);
  if (isNaN(d)) return s;
  var p = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
}
