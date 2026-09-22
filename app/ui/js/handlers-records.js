/* ============================================================
   Lumio · handlers-records.js —— 记录查看类动作：查看全部 / 筛选 / 回到当天
   分层：L4 交互　　依赖：state / render / ui-kit / records / registry
   ============================================================ */
import { S } from './state.js';
import { paint } from './render.js';
import { refreshTopModal } from './ui-kit.js';
import { openRecordsModal, recView, recToggleFilter } from './records.js';
import { regAct } from './registry.js';

function actRecView(e, el, act, id) {
    var rv = recView(el.getAttribute('data-rec'));
    if (rv) openRecordsModal(rv);
    return;
  }
regAct("rec-view", actRecView);

function actRecFilter(e, el, act, id) {
    var fk = el.getAttribute('data-fk');
    var fv = el.getAttribute('data-fv') || '';
    if (recToggleFilter(fk, fv)) refreshTopModal(); // 再点同一项 = 取消该筛选
    return;
  }
regAct("rec-filter", actRecFilter);

function actRevhist(e, el, act, id) {                    /* v2.0.51：审核记录「查看更早 / 收起」就地切换 */
    S.revHist = el.getAttribute('data-v') === 'on';
    paint(null, true); return;
  }
regAct("revhist", actRevhist);

function actRecAll(e, el, act, id) { S.recDay = ''; paint(null, true); return; }
regAct("rec-all", actRecAll);
