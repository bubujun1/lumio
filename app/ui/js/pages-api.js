/* ============================================================
   Lumio · pages-api.js —— 页面共享函数门面（Facade）
   分层：L4 交互 ↔ L5 页面 之间的唯一桥
   说明：handlers-*（L4 交互）原本硬 import pages-admin / pages-kid（L5 页面），
        形成「交互层 → 页面层」的逆依赖。这里把页面层对外暴露的、被交互层复用的
        少量共享函数（统计加载 / 设置弹窗 / 约定与成长弹窗 / 聊天与券组件等）
        统一 re-export，handlers 只依赖本门面，不再直连页面层。
        页面层之间互不 import（pages-admin / pages-kid 均不引用本文件），无循环依赖。
   ============================================================ */
'use strict';

export { loadMonthStats, openSettingsModal, LumioFaceHint } from './pages-admin.js';
export {
  rulesInnerHtml, heroInnerHtml, chatHtml, isMine, meRefKid,
  kidBucketOf, taskDeadlineHtml, couponGroup, rqPrev
} from './pages-kid.js';
