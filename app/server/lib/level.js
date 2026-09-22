/* ============================================================
   Lumio 后端 · lib/level.js —— 等级表与等级换算
   分层：L0 等级
   ============================================================ */
'use strict';

/* --------------------------------------------------------------- 等级体系 */

const LEVELS = [
  { min: 0, name: '微光', emoji: '✨' },
  { min: 100, name: '烛光', emoji: '🕯️' },
  { min: 300, name: '萤火', emoji: '🪄' },
  { min: 600, name: '星光', emoji: '⭐' },
  { min: 1000, name: '月光', emoji: '🌙' },
  { min: 2000, name: '阳光', emoji: '☀️' }
];

function levelOf(totalEarned) {
  const t = Math.max(0, Math.round(Number(totalEarned) || 0));
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (t >= LEVELS[i].min) idx = i;
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] || null;
  return {
    level: idx + 1,
    name: cur.name,
    emoji: cur.emoji,
    nextMin: next ? next.min : null,
    nextName: next ? next.name : null
  };
}

module.exports = {
  levelOf
};
