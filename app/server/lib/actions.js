/* ============================================================
   Lumio 后端 · lib/actions.js —— 动作总表：合并各域动作（供 HTTP 层派发）
   分层：L4 动作
   ============================================================ */
'use strict';

/* 动作总表：合并各域动作模块。HTTP 层只依赖这里，新增动作时只需改对应域文件。 */
const actionsAccount = require('./actions/account');
const actionsTask = require('./actions/task');
const actionsShop = require('./actions/shop');
const actionsMessage = require('./actions/message');
const actionsReview = require('./actions/review');
const actionsAdmin = require('./actions/admin');

const ACTIONS = Object.assign({}, actionsAccount, actionsTask, actionsShop, actionsMessage, actionsReview, actionsAdmin);

module.exports = {
  ACTIONS
};
