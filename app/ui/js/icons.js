/* ============================================================
   Lumio · icons.js —— 内联图标与吉祥物插画（SICON / heroSvg）与图标选择器的图标集
   分层：L0 基础　　依赖：format
   ============================================================ */
import { LUMI_LEVELS } from './format.js';

export function heroSvg(opts) {
  opts = opts || {};
  var k = opts.k || 'x';
  var b1 = opts.body || '#FFEB66';
  var b2 = opts.body2 || '#FFC53D';
  var line = opts.dark || '#F0A32F';
  var ink = '#4A3B4F';
  var mood = opts.mood || 'wake';
  var lv = Math.max(1, Math.min(6, opts.level || 1));
  var L = LUMI_LEVELS[lv - 1];
  var halo = '<circle cx="100" cy="92" r="' + L.r + '" fill="' + L.c + '" opacity="' + L.o + '"/>';
  if (L.rays) {
    halo += '<g opacity="' + (L.o + .15).toFixed(2) + '">';
    for (var ri = 0; ri < L.rays; ri++) {
      var aa = (Math.PI * 2 / L.rays) * ri - Math.PI / 2;
      var x1 = (100 + Math.cos(aa) * (L.r - 6)).toFixed(1), y1 = (92 + Math.sin(aa) * (L.r - 6)).toFixed(1);
      var x2 = (100 + Math.cos(aa) * (L.r + 12)).toFixed(1), y2 = (92 + Math.sin(aa) * (L.r + 12)).toFixed(1);
      halo += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + L.c + '" stroke-width="5" stroke-linecap="round"/>';
    }
    halo += '</g>';
  }
  var eyes, mouth, blush = '', extra = '';
  if (mood === 'sleep') {
    eyes = '<path d="M80 88q5 4 10 0" fill="none" stroke="' + ink + '" stroke-width="3" stroke-linecap="round"/>' +
           '<path d="M110 88q5 4 10 0" fill="none" stroke="' + ink + '" stroke-width="3" stroke-linecap="round"/>';
    mouth = '<path d="M96 102q4 3 8 0" fill="none" stroke="#8C4B58" stroke-width="2.6" stroke-linecap="round"/>';
    extra = '<text x="150" y="40" font-size="15" fill="#9AA0B5" font-family="sans-serif" font-weight="700">Z</text>' +
            '<text x="161" y="30" font-size="11" fill="#9AA0B5" font-family="sans-serif" font-weight="700">z</text>';
  } else if (mood === 'sad') {
    eyes = '<path d="M80 90q5 -4 10 0" fill="none" stroke="' + ink + '" stroke-width="3" stroke-linecap="round"/>' +
           '<path d="M110 90q5 -4 10 0" fill="none" stroke="' + ink + '" stroke-width="3" stroke-linecap="round"/>';
    mouth = '<path d="M92 104q8 -9 16 0" fill="none" stroke="#8C4B58" stroke-width="2.8" stroke-linecap="round"/>';
    extra = '<path d="M84 96q-3 8 1 13 q4 -3 3 -10z" fill="#9FD0FF"/>';
  } else if (mood === 'think') {
    eyes = '<ellipse cx="85" cy="85" rx="5.4" ry="6.2" fill="' + ink + '"/>' +
           '<ellipse cx="115" cy="85" rx="5.4" ry="6.2" fill="' + ink + '"/>' +
           '<circle cx="86.6" cy="82.6" r="2" fill="#fff"/>' +
           '<circle cx="116.6" cy="82.6" r="2" fill="#fff"/>';
    mouth = '<path d="M95 102q5 4 10 0" fill="none" stroke="#8C4B58" stroke-width="2.6" stroke-linecap="round"/>';
    extra = '<text x="146" y="44" font-size="20" fill="#9AA0B5" font-family="sans-serif" font-weight="800">?</text>';
  } else if (mood === 'cheer') {
    eyes = '<ellipse cx="85" cy="87" rx="7" ry="8" fill="' + ink + '"/>' +
           '<ellipse cx="115" cy="87" rx="7" ry="8" fill="' + ink + '"/>' +
           '<circle cx="87.4" cy="84" r="2.6" fill="#fff"/>' +
           '<circle cx="117.4" cy="84" r="2.6" fill="#fff"/>';
    blush = '<ellipse cx="68" cy="100" rx="10" ry="5.6" fill="#FF9EB5" opacity=".6"/>' +
            '<ellipse cx="132" cy="100" rx="10" ry="5.6" fill="#FF9EB5" opacity=".6"/>';
    mouth = '<path d="M88 96q12 17 24 0z" fill="#8C4B58"/>' +
            '<ellipse cx="100" cy="103.4" rx="5.6" ry="3.2" fill="#FF8FA8"/>';
    extra = '<path d="M40 30l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#FFD36B"/>' +
            '<path d="M168 44l2.4 6.4 6.4 2.4-6.4 2.4-2.4 6.4-2.4-6.4-6.4-2.4 6.4-2.4z" fill="#FFB3C6"/>';
  } else {
    eyes = '<ellipse cx="85" cy="87" rx="6.6" ry="7.6" fill="' + ink + '"/>' +
           '<ellipse cx="115" cy="87" rx="6.6" ry="7.6" fill="' + ink + '"/>' +
           '<circle cx="87.4" cy="84.2" r="2.5" fill="#fff"/>' +
           '<circle cx="117.4" cy="84.2" r="2.5" fill="#fff"/>' +
           '<circle cx="82.6" cy="89.8" r="1.2" fill="#fff" opacity=".9"/>' +
           '<circle cx="112.6" cy="89.8" r="1.2" fill="#fff" opacity=".9"/>';
    blush = '<ellipse cx="69" cy="100" rx="10" ry="5.6" fill="#FF9EB5" opacity=".6"/>' +
            '<ellipse cx="131" cy="100" rx="10" ry="5.6" fill="#FF9EB5" opacity=".6"/>';
    mouth = '<path d="M91 97q9 12 18 0z" fill="#8C4B58"/>' +
            '<ellipse cx="100" cy="103.4" rx="4.6" ry="2.7" fill="#FF8FA8"/>';
  }
  var armL, armR, handL, handR;
  if (mood === 'cheer') {
    armL = '<path d="M46 92 Q26 70 30 48" fill="none" stroke="' + line + '" stroke-width="10" stroke-linecap="round"/>';
    armR = '<path d="M154 92 Q174 70 170 48" fill="none" stroke="' + line + '" stroke-width="10" stroke-linecap="round"/>';
    handL = '<circle cx="30" cy="46" r="6.5" fill="' + line + '"/>';
    handR = '<circle cx="170" cy="46" r="6.5" fill="' + line + '"/>';
  } else {
    armL = '<path d="M46 86 Q30 80 26 66" fill="none" stroke="' + line + '" stroke-width="10" stroke-linecap="round"/>';
    armR = '<path d="M154 86 Q170 80 174 66" fill="none" stroke="' + line + '" stroke-width="10" stroke-linecap="round"/>';
    handL = '<circle cx="25" cy="62" r="6.5" fill="' + line + '"/>';
    handR = '<circle cx="175" cy="62" r="6.5" fill="' + line + '"/>';
  }
  return '<svg viewBox="0 0 200 172" xmlns="http://www.w3.org/2000/svg">' +
    '<defs><linearGradient id="pg' + k + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="' + b1 + '"/><stop offset="1" stop-color="' + b2 + '"/></linearGradient></defs>' +
    '<ellipse cx="100" cy="160" rx="52" ry="8" fill="rgba(74,59,79,.10)"/>' +
    halo +
    '<path d="M34 38l4 10.5 10.5 4-10.5 4-4 10.5-4-10.5L19.5 52.5 30 48.5z" fill="#FFD9E2"/>' +
    '<path d="M170 24l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#FFCF5C"/>' +
    '<circle cx="28" cy="112" r="4.5" fill="#BDE9D2"/>' +
    '<circle cx="178" cy="104" r="3.6" fill="#BFE0FF"/>' +
    '<circle cx="160" cy="140" r="3" fill="#FFD9E2"/>' +
    armL + armR + handL + handR +
    '<rect x="77" y="134" width="16" height="20" rx="8" fill="' + line + '"/>' +
    '<rect x="107" y="134" width="16" height="20" rx="8" fill="' + line + '"/>' +
    '<path d="M100 24 L118.4 60.4 L157 67.8 L129.8 96.4 L135.8 134.6 L100 116.8 L64.2 134.6 L70.2 96.4 L43 67.8 L81.6 60.4 Z" ' +
    'fill="url(#pg' + k + ')" stroke="' + line + '" stroke-width="10" stroke-linejoin="round"/>' +
    '<path d="M74 50q9-13 24-16" fill="none" stroke="#FFF6C9" stroke-width="9" stroke-linecap="round" opacity=".9"/>' +
    '<path d="M138 78l6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4z" fill="#FFF6C9" opacity=".85"/>' +
    eyes + blush + mouth + extra +
    '</svg>';
}
export function SICON(name) {
  var m = {
    home: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/></svg>',
    messages: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h16v10H9l-4 4v-4H4z"/></svg>',
    tasks: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="16" rx="2.5"/><path d="M8.5 9.5 11 12l4.5-4.5"/></svg>',
    shop: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h14l-1 10.5H6z"/><path d="M9 9a3 3 0 016 0"/></svg>',
    backpack: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="8" width="12" height="13" rx="3"/><path d="M9 8V6.5a3 3 0 016 0V8"/></svg>'
  };
  return m[name] || '';
}
/* ---- v2.0.46：图标字段 = 单个方框 + 独立选择器抽屉 ----
   字段本身只占一个方框（未选＝＋，已选＝当前图标），点开才弹出选择器（沿用底部抽屉弹窗）；
   选择实时回填方框，点「取消」则回滚到打开前的值。 */
export var ICON_SETS = {
  i: ['⭐', '🧹', '📚', '🪥', '🍽️', '📖', '🏃', '🧺', '🎹', '🛏️', '🐕', '🚿', '🧸', '✏️', '🥕', '🧦', '🍚', '🥣', '🍎', '🥛', '🍜', '🥦', '😴', '🛌', '🧼', '🛁', '🧴', '🎓', '🔤', '🧮', '📝', '⚽', '🚴', '🏊', '🤸', '🚌', '🚗', '🚶', '🧽', '🎲'],
  e: ['🎁', '📺', '🎮', '🍬', '💰', '🧺', '🍦', '🎬', '📱', '🏊', '🎪', '🧸', '⚽', '🍕', '🎨', '🚲', '🍔', '🍭', '🧁', '🍫', '🍓', '🥤', '🍿', '🥞', '🧇', '🎟️', '🏖️', '🎠', '🪀', '🧩', '🎸', '💎', '🛹', '🎡', '🏀', '⚾', '🎾', '📚', '✏️', '🛴'],
  g: ['🎯', '🚲', '🧸', '🎁', '📚', '🎮', '🏊', '🍦', '✈️', '🐶']
};
/* v2.0.60：删除 ICON_ACTS —— 它就是 { i:'pi', e:'pe', g:'pg' }，即动作键恒等于 'p'+k，
   直接在使用处拼 'p'+k 即可（handlers-task 注册 pi / handlers-shop 注册 pe、pg，字面量不变）。 */
/* 存值键必须与既有约定一致：handler / 保存处读的是 S._pickI / _pickE / _pickG（大写）。
   早先写成 S['_pick' + k] 会得到 _picki，与 _pickI 不是同一个键 —— 选择无法回填方框。 */
export var ICON_KEY = { i: '_pickI', e: '_pickE', g: '_pickG' };
