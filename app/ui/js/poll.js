/* ============================================================
   Lumio · poll.js —— 状态轮询：有活动时加快、空闲时退避
   分层：L4 交互　　依赖：core / state / boot
   ============================================================ */
import { q } from './core.js';
import { S } from './state.js';
import { refresh } from './boot.js';

/* ============================================================
   轮询：家长端和孩子端互看对方的新动作
   ============================================================ */
var pollTimer = null;
var pollInterval = 4000;
var pollIdleSteps = 0;
var POLL_FAST = 4000, POLL_MAX = 16000;
/* v2.0.54：轮询自适应——有未读 / 待处理时 4s（与原行为一致）；全静默时逐步拉长到 16s 省电省流。
   后台（document.hidden）完全停表，回到前台再恢复并立即刷新一次。 */
function pollHasActivity() {
  var st = S.state || {};
  if (st.stats && (st.stats.pendingCount || st.stats.myPending)) return true;
  if (st.unreadParentMessages) return true;
  return false;
}
function schedulePoll() { pollTimer = setTimeout(pollTick, pollInterval); }
function pollTick() {
  if (document.hidden) { if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; } return; }
  if (q('.mask')) { schedulePoll(); return; }
  if (S.busy) { schedulePoll(); return; }
  if (!S.state) { schedulePoll(); return; }
  refresh(true);
  if (pollHasActivity()) { pollIdleSteps = 0; pollInterval = POLL_FAST; }
  else { pollIdleSteps++; pollInterval = Math.min(POLL_MAX, POLL_FAST * Math.pow(2, Math.min(pollIdleSteps, 2))); }
  schedulePoll();
}
export function startPoll() {
  if (pollTimer) clearTimeout(pollTimer);
  pollIdleSteps = 0; pollInterval = POLL_FAST;
  schedulePoll();
}
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) { if (!pollTimer) startPoll(); pollIdleSteps = 0; pollInterval = POLL_FAST; refresh(true); }
});
