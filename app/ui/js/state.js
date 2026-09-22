/* ============================================================
   Lumio · state.js —— 运行时状态 S（唯一可变状态容器）与两端标签表 TABS_ADMIN / TABS_KID
   分层：L1 数据　　依赖：无
   ============================================================ */
/* ============================================================
   全局状态
   ============================================================ */
export var S = { state: null, tab: '', busy: false };
export var TABS_ADMIN = [
  { k: 'home', i: 'home', t: '总览' },
  { k: 'messages', i: 'messages', t: '消息' },
  { k: 'tasks', i: 'tasks', t: '任务' },
  { k: 'shop', i: 'shop', t: '商城' }
];
export var TABS_KID = [
  { k: 'tasks', i: 'tasks', t: '任务' },
  { k: 'messages', i: 'messages', t: '消息' },
  { k: 'redeem', i: 'shop', t: '商城' },
  { k: 'mine', i: 'backpack', t: '背包' }
];
