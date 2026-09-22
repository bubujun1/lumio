/* ============================================================
   Lumio · handlers-shell.js —— 骨架类动作：重载 / 切页 / 主题 / 设置 / 备份 / 通用弹窗
   分层：L4 交互　　依赖：core / theme / api / feedback / state / render / ui-kit / pages-admin / pages-kid / registry / actions / boot
   ============================================================ */
import { q, APP_BASE, running, done } from './core.js';
import { applyTheme } from './theme.js';
import { apiAct } from './api.js';
import { toast } from './feedback.js';
import { S } from './state.js';
import { paint, isAdmin } from './render.js';
import { maskOf, closeModalOf, openModal, closeModal } from './ui-kit.js';
import { loadMonthStats, openSettingsModal } from './pages-admin.js';
import { rulesInnerHtml, heroInnerHtml } from './pages-kid.js';
import { regAct } from './registry.js';
import { doAct } from './actions.js';
import { boot } from './boot.js';

function actReload(e, el, act, id) { S.state = null; S.tab = ''; q('#app').innerHTML = ''; q('#boot').classList.remove('hidden'); boot(); return; }
regAct("reload", actReload);

function actModalX(e, el, act, id) { var mx = maskOf(el); if (mx) closeModalOf(mx); return; }
regAct("modal-x", actModalX);

function actTheme(e, el, act, id) {
    applyTheme(el.getAttribute('data-v'));
    if (S.state) paint(null, true);   // 重绘顶栏，让选中的色点带上高亮
    return;
  }
regAct("theme", actTheme);

function actTab(e, el, act, id) {
    S.tab = el.getAttribute('data-k');
    if (S.tab === 'home' && isAdmin() && !S.monthStats) loadMonthStats('');
    paint(S.state, false); q('.scroll').scrollTop = 0; return;
  }
regAct("tab", actTab);

function actRules(e, el, act, id) {
    openModal({ title: '📜 我们家的约定', body: rulesInnerHtml(), okText: '知道啦', okOnly: true, focus: false, onOk: function () { closeModal(); } });
    return;
  }
regAct("rules", actRules);

function actHero(e, el, act, id) {
    openModal({ title: '我的成长', body: heroInnerHtml(), okText: '知道啦', okOnly: true, focus: false, onOk: function () { closeModal(); } });
    return;
  }
regAct("hero", actHero);

function actCopy(e, el, act, id) {
    var t = el.getAttribute('data-text') || '';
    try {
      navigator.clipboard.writeText(t).then(function () { toast('已复制：' + t, 'ok'); }, function () { toast(t, 'ok'); });
    } catch (err) { toast(t, 'ok'); }
    return;
  }
regAct("copy", actCopy);

function actSettings(e, el, act, id) { openSettingsModal(); return; }
regAct("settings", actSettings);

function actTog(e, el, act, id) {
    el.classList.toggle('on');
    var k = el.getAttribute('data-k');
    S['_tog_' + k] = el.classList.contains('on');
    return;
  }
regAct("tog", actTog);

function actBackup(e, el, act, id) {
    toast('正在准备备份文件…');
    location.href = APP_BASE + '/api/backup';
    return;
  }
regAct("backup", actBackup);

function actDataClear(e, el, act, id) {
    openModal({
      title: '🧹 清空记录', body: '<div class="tiny">将清空：<b>全部任务提交、兑换记录、积分流水、留言、心愿</b>，并把孩子们的余额和累计清零。<br><br><b>保留</b>：孩子账号、任务/商城配置、家长绑定、家庭设置。<br><br>此操作<b style="color:#e8604f">不可恢复</b>，确定继续吗？</div>',
      okText: '确认清空', okClass: 'danger',
      onOk: function (m, b) {
        if (S.busy) return;
        S.busy = true; running(b);
        apiAct('data.clear', { scope: 'records' }).then(function (res) {
          S.busy = false; done(b);
          if (!res || !res.ok) { toast((res && res.error) || '操作失败', 'err'); return; }
          closeModalOf(maskOf(b));
          S.monthStats = null; paint(null, true); loadMonthStats('');
          toast('记录已清空 🧹', 'ok');
        });
      }
    });
    return;
  }
regAct("data-clear", actDataClear);

function actDataReset(e, el, act, id) {
    openModal({
      title: '⚠️ 恢复出厂', body: '<div class="tiny">将删除<b style="color:#e8604f">全部数据</b>：孩子账号、绑定、任务、商城、记录、留言、家长绑定、家庭设置，恢复到刚安装的样子。<br><br>此操作<b style="color:#e8604f">不可恢复</b>！确定要恢复出厂吗？</div>',
      okText: '确认恢复出厂', okClass: 'danger',
      onOk: function (m, b) { doAct('data.clear', { scope: 'all' }, b, '已恢复出厂设置'); }
    });
    return;
  }
regAct("data-reset", actDataReset);
