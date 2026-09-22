/* ============================================================
   Lumio · registry.js —— data-act 动作注册表（各域 handler 自行注册，router 只做查表派发）
   分层：L4 交互　　依赖：无
   ============================================================ */
/* data-act 动作注册表。
   拆分前是单个 800 行的 if (act === 'x') 链；48 个分支全部以 return 结尾、彼此无共享状态，
   因此可以安全地拆成「各域自行注册 + router 查表派发」。 */
const ACTS = {};
export function regAct(key, fn) { ACTS[key] = fn; }
export function findAct(key) { return ACTS[key]; }
