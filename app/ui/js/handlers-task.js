/* ============================================================
   Lumio · handlers-task.js —— 任务类动作：目标 / 任务增删改上下架 / 审核 / 发放积分 / 提交与确认
   分层：L4 交互　　依赖：core / format / feedback / state / ui-kit / pages-kid / registry / actions
   ============================================================ */
import { val, qa, q, h } from './core.js';
import { fmt, defaultDeadline, deadlineTimeOpts, deadlinePreset, coin } from './format.js';
import { toast } from './feedback.js';
import { S } from './state.js';
import { openModal, iconField, closeModal, syncIconBox } from './ui-kit.js';
import { taskDeadlineHtml } from './pages-kid.js';
import { regAct } from './registry.js';
import { doAct, confirmDelete } from './actions.js';

function actGive(e, el, act, id) {
    var kd3 = (S.state.kids || []).find(function (x) { return x.id === id; });
    S._give = 5;
    var quick = [1, 5, 10, 20, 50, 100];
    openModal({
      title: '🪙 给 ' + (kd3 ? kd3.name : '') + ' 积分',
      body:
        '<div class="tiny muted" style="margin-bottom:10px">当前 ' + fmt(kd3 ? kd3.balance : 0) + ' 个积分</div>' +
        '<div class="picks" id="quickGive" style="margin-bottom:14px">' +
        quick.map(function (n) { return '<button class="pick" style="width:auto;padding:0 14px;font-size:14px;font-weight:800;' + (n === 5 ? 'border-color:var(--mint);' : '') + '" data-act="qg" data-v="' + n + '">+' + n + '</button>'; }).join('') +
        '</div>' +
        '<div class="field"><label>积分数量（负数表示扣除，比如 -3）</label><input class="inp" id="fDelta" type="number" value="5"></div>' +
        '<div class="field"><label>原因（必填，会记入积分流水）</label><input class="inp" id="fReason" maxlength="30" placeholder="比如：这周表现特别好 / 打了妹妹要改正"></div>' +
        '<div class="field"><label>顺便留句话（可不填）</label><textarea class="inp" id="fMsg" maxlength="200" placeholder="继续加油哦！"></textarea></div>' +
        '<div class="tiny muted">扣分请写清楚理由，孩子和家长都能在积分记录里看到，全程有迹可循。</div>',
      okText: '确定发放',
      okClass: 'mint',
      focus: false,
      onOk: function (mask, btn) {
        var d = Number(val('#fDelta', mask));
        if (!d) { toast('请填写积分数量', 'err'); return; }
        var reason = (val('#fReason', mask) || '').trim();
        if (!reason) { toast('请填写原因' + (d < 0 ? '，扣积分要让孩子知道为什么' : ''), 'err'); return; }
        doAct('coin.adjust', { kidId: id, delta: d, reason: reason, message: val('#fMsg', mask) }, btn, d > 0 ? '已发放 ' + d + ' 个积分' : '已扣除 ' + Math.abs(d) + ' 个积分');
      }
    });
    return;
  }
regAct("give", actGive);

function actQg(e, el, act, id) {
    S._give = Number(el.getAttribute('data-v'));
    qa('.pick', el.parentNode).forEach(function (x) { x.style.borderColor = ''; });
    el.style.borderColor = 'var(--mint)';
    var inp = q('#fDelta');
    if (inp) inp.value = String(S._give);
    return;
  }
regAct("qg", actQg);

function actGoalTarget(e, el, act, id) {
    var g0 = (S.state.goals || []).find(function (x) { return x.id === id; });
    var gk0 = g0 ? (S.state.kids || []).find(function (k) { return k.id === g0.kidId; }) : null;
    openModal({
      title: '🎯 给心愿定个小目标',
      body: (g0 ? '<div class="chip grape" style="margin-bottom:10px;display:inline-flex">' + h((g0.emoji || '🎯') + ' ' + g0.title) + (gk0 ? ' · ' + h(gk0.name) : '') + '</div>' : '') +
        '<div class="field"><label>目标积分（攒够就能兑换；填 0 表示暂不设目标）</label>' +
        '<input class="inp" id="fGT" type="number" min="0" max="1000000" value="' + h(g0 && g0.targetCoins > 0 ? g0.targetCoins : '') + '" placeholder="比如：200"></div>' +
        '<div class="tiny muted">设好目标后，孩子端会显示攒分进度，也能看到你的鼓励 💪</div>',
      okText: '保存目标',
      okClass: 'sun',
      onOk: function (mask, btn) {
        doAct('goal.update', { id: id, targetCoins: Number(val('#fGT', mask)) || 0 }, btn, '目标已保存 🎯');
      }
    });
    return;
  }
regAct("goal-target", actGoalTarget);

function actGoalCheer(e, el, act, id) {
    var g1 = (S.state.goals || []).find(function (x) { return x.id === id; });
    openModal({
      title: '💪 给心愿加把劲',
      body: (g1 ? '<div class="chip grape" style="margin-bottom:10px;display:inline-flex">' + h((g1.emoji || '🎯') + ' ' + g1.title) + '</div>' : '') +
        '<div class="field"><label>对孩子说一句鼓励</label>' +
        '<textarea class="inp" id="fCheer" maxlength="60" placeholder="加油，爸爸妈妈相信你可以的！">' + h(g1 ? g1.cheer || '' : '') + '</textarea></div>' +
        '<div class="tiny muted">发送后孩子端会收到一条带这个心愿的留言。</div>',
      okText: '发送鼓励',
      focus: false,
      onOk: function (mask, btn) {
        doAct('goal.encourage', { id: id, cheer: val('#fCheer', mask) }, btn, '鼓励已送达 💪');
      }
    });
    return;
  }
regAct("goal-cheer", actGoalCheer);

function actTaskNew_TaskEdit(e, el, act, id) {
    var edit2 = act === 'task-edit';
    var t = edit2 ? (S.state.tasks || []).find(function (x) { return x.id === id; }) : null;
    var curI = t ? t.icon : '⭐';
    var fbCur = t ? (t.fbMode || (t.cat === 'read' ? 'req' : 'none')) : 'none';
    openModal({
      title: edit2 ? '✏️ 编辑任务' : '📋 新建任务',
      body:
        '<div class="field"><label>任务名称</label><input class="inp" id="fTitle" maxlength="8" placeholder="最多8个字" value="' + h(t ? t.title : '') + '"></div>' +
        iconField('i', curI) +
        '<div class="field"><label>奖励积分</label><input class="inp" id="fCoins" type="number" min="0" max="100000" value="' + (t ? t.coins : 5) + '"></div>' +
        '<div class="field"><label>完成反馈（孩子提交时写一句话，方便判断完成度）</label><select class="inp" id="fFb">' +
        '<option value="none"' + (fbCur === 'none' ? ' selected' : '') + '>不需要</option>' +
        '<option value="opt"' + (fbCur === 'opt' ? ' selected' : '') + '>可填（想写就写）</option>' +
        '<option value="req"' + (fbCur === 'req' ? ' selected' : '') + '>必填（写完才能提交）</option>' +
        '</select><div class="tiny muted" style="margin-top:-6px">比如读了什么书、做到什么程度；阅读学习类任务默认必填。</div></div>' +
        '<div class="field"><label>任务类型</label><select class="inp" id="fType" data-role="taskTypePick">' +
        '<option value="daily"' + (!t || t.type === 'daily' ? ' selected' : '') + '>🔁 常驻 · 每天都能做</option>' +
        '<option value="weekly"' + (t && t.type === 'weekly' ? ' selected' : '') + '>🔁 常驻 · 每周能做</option>' +
        '<option value="monthly"' + (t && t.type === 'monthly' ? ' selected' : '') + '>🔁 常驻 · 每月能做</option>' +
        '<option value="timed"' + (t && t.type === 'timed' ? ' selected' : '') + '>⏳ 限时 · 到点自动消失</option>' +
        '<option value="once"' + (t && t.type === 'once' ? ' selected' : '') + '>✨ 临时 · 只做一次（当天有效）</option>' +
        '</select></div>' +
        '<div class="field' + (t && t.type === 'timed' ? '' : ' hidden') + '" id="fDeadlineWrap"><label>截止时间（到点自动消失）</label>' +
        '<div class="row" style="gap:8px;align-items:stretch">' +
        '<div class="timefield" style="flex:1;min-width:0"><span class="tico">⏰</span>' +
        '<input class="inp tinp" id="fDeadline" type="date" value="' + h(t && t.expiresAt ? t.expiresAt.slice(0, 10) : defaultDeadline().slice(0, 10)) + '"></div>' +
        '<select class="inp" id="fDeadlineTime" style="width:104px;flex:none">' + deadlineTimeOpts(t && t.expiresAt ? t.expiresAt.slice(11, 16) : '20:00') + '</select>' +
        '</div>' +
        '<div class="quickrow">' +
        '<button type="button" class="qbtn" data-act="dlq" data-v="tonight">今晚 21:00</button>' +
        '<button type="button" class="qbtn" data-act="dlq" data-v="tomorrow">明天 20:00</button>' +
        '<button type="button" class="qbtn" data-act="dlq" data-v="weekend">本周日 20:00</button>' +
        '</div>' +
        '<div class="tiny muted">到点还没完成，任务会自动消失。</div></div>' +
        '<div class="field"><label>每个周期最多做几次</label><input class="inp" id="fLimit" type="number" min="1" max="20" value="' + (t ? t.limitPerDay : 1) + '"></div>' +
        '<div class="tiny muted" style="margin:-6px 0 12px">限时 / 临时任务：孩子要先点「接受」再提交；临时任务只在当天有效，过零点自动消失，已提交的会保留给家长审核。</div>',
      okText: edit2 ? '保存' : '创建',
      dangerText: edit2 ? '🗑 删除' : '',
      onDanger: function () {
        closeModal(); // 先收起编辑弹窗，让删除确认独立成一层，删完不会残留旧数据
        confirmDelete({ what: '任务', act: 'task.delete', id: id });
      },
      focus: false,
      onOk: function (mask, btn) {
        var type = val('#fType', mask);
        var payload = {
          title: val('#fTitle', mask), icon: S._pickI, coins: Number(val('#fCoins', mask)) || 0,
          type: type, fbMode: val('#fFb', mask), limitPerDay: Number(val('#fLimit', mask)) || 1,
          expiresAt: type === 'timed' ? (val('#fDeadline', mask) + 'T' + val('#fDeadlineTime', mask)) : '',
          active: !t || t.active
        };
        if (type === 'timed' && !val('#fDeadline', mask)) { toast('限时任务要选一个截止时间', 'warn'); return; }
        if (edit2) payload.id = id;
        doAct(edit2 ? 'task.update' : 'task.create', payload, btn, '已保存');
      }
    });
    return;
  }
regAct("task-new", actTaskNew_TaskEdit);
regAct("task-edit", actTaskNew_TaskEdit);

function actDlq(e, el, act, id) {
    var pres = deadlinePreset(el.getAttribute('data-v'));
    var dl = q('#fDeadline'), tm = q('#fDeadlineTime');
    if (dl) dl.value = pres.slice(0, 10);
    if (tm) tm.value = pres.slice(11, 16);
    qa('.quickrow .qbtn', el.parentNode).forEach(function (x) { x.classList.remove('on'); });
    el.classList.add('on');
    return;
  }
regAct("dlq", actDlq);

function actPi(e, el, act, id) {
    qa('.pick', el.parentNode).forEach(function (x) { x.classList.remove('on'); });
    el.classList.add('on'); S._pickI = el.getAttribute('data-v'); syncIconBox('i'); return;
  }
regAct("pi", actPi);

function actTaskList_TaskUnlist(e, el, act, id) {
    doAct('task.update', { id: id, active: act === 'task-list' }, el, act === 'task-list' ? '已上架，孩子端可见' : '已下架');
    return;
  }
regAct("task-list", actTaskList_TaskUnlist);
regAct("task-unlist", actTaskList_TaskUnlist);

function actApprove_Reject(e, el, act, id) {
    var kind = el.getAttribute('data-kind');
    var isApprove = act === 'approve';
    var isSubKind = kind === 'sub';
    var amtCoins = Math.max(0, Math.round(Number(el.getAttribute('data-coins')) || 0));
    /* v2.0.58：孩子填写的内容不在待处理卡片里显示，改到「通过 / 不通过」弹窗里 */
    var noteTxt = '';
    var rvCard = el.closest ? el.closest('.review') : null;
    var noteEl = rvCard ? rvCard.querySelector('.rnote') : null;
    if (isSubKind && noteEl) noteTxt = noteEl.textContent.trim();
    openModal({
      title: isApprove ? '✓ 通过申请' : '✕ 不通过',
      body: (isSubKind && noteTxt ?
        '<div class="field"><label>孩子填写的内容</label>' +
        '<div class="chip gray" style="display:block;white-space:pre-wrap;line-height:1.5;word-break:break-word;text-align:left">' + h(noteTxt) + '</div></div>' : '') +
        (isApprove && isSubKind ?
        '<div class="field"><label>本次给多少积分（默认全给；完成质量不好可酌情少给，最低 0）</label>' +
        '<input class="inp" id="fGrant" type="number" min="0" max="' + amtCoins + '" value="' + amtCoins + '"></div>' : '') +
        '<div class="field"><label>' + (isApprove ? '给孩子留句话（可不填）' : '告诉孩子原因（可不填）') + '</label>' +
        '<textarea class="inp" id="fReply" maxlength="120" placeholder="' + (isApprove ? '做得好！' : '再努力一下下～') + '"></textarea></div>' +
        '<div class="tiny muted">' + (isApprove
          ? (isSubKind ? '通过后按上面填的积分立即入账；调整过的实发积分会如实记入积分流水，全程有迹可循。' : '通过后积分会立即从孩子的积分里扣除。')
          : '这条申请会退回，孩子可以重新提交。') + '</div>',
      okText: isApprove ? '通过' : '不通过',
      okClass: isApprove ? 'mint' : 'gray',
      onOk: function (mask, btn) {
        var payload = { id: id, action: isApprove ? 'approve' : 'reject', reply: val('#fReply', mask) };
        if (isApprove && isSubKind) {
          var grant = Math.round(Number(val('#fGrant', mask)));
          if (isNaN(grant) || grant < 0) { toast('积分数量要填 0 到 ' + amtCoins + ' 之间', 'warn'); return; }
          if (grant > amtCoins) { toast('最多给 ' + amtCoins + ' 分（任务原定），想多奖请用「发积分」', 'warn'); return; }
          payload.coins = grant;
        }
        doAct(isSubKind ? 'review.submission' : 'review.redemption',
          payload, btn, isApprove ? '已通过 ✓' : '已退回');
      }
    });
    return;
  }
regAct("approve", actApprove_Reject);
regAct("reject", actApprove_Reject);

function actAccept(e, el, act, id) {
    var ta = (S.state.tasks || []).find(function (x) { return x.id === id; });
    openModal({
      title: '✋ 接受任务',
      body: '<div class="center" style="margin-bottom:12px"><div style="font-size:44px">' + h(ta ? ta.icon : '⭐') + '</div>' +
        '<div style="font-weight:800;font-size:17px;margin-top:4px">' + h(ta ? ta.title : '') + '</div>' +
        '<div class="pricetag" style="justify-content:center;margin-top:6px">至多 ' + coin(18) + fmt(ta ? ta.coins : 0) + '</div></div>' +
        (ta && (ta.type === 'timed' || ta.type === 'once') && ta.expiresAt ? '<div class="center" style="margin-bottom:8px">' + taskDeadlineHtml(ta) + '</div>' : '') +
        '<div class="tiny muted">接受后这个任务就是你的啦，完成时点「我做完了」提交给家长确认。</div>',
      okText: '我接受',
      okClass: 'mint',
      focus: false,
      onOk: function (mask, btn) { doAct('task.accept', { taskId: id }, btn, '已接受，加油！'); }
    });
    return;
  }
regAct("accept", actAccept);

function actSubmit(e, el, act, id) {
    var t2 = (S.state.tasks || []).find(function (x) { return x.id === id; });
    var fbM = t2 ? (t2.fbMode || (t2.cat === 'read' ? 'req' : 'none')) : 'none';
    openModal({
      title: '✅ 我做完了！',
      body: (t2 ? '<div class="chip sky" style="margin-bottom:12px;display:inline-flex">' + h(t2.icon + ' ' + t2.title) + '</div>' : '') +
        (fbM === 'none' ? '' :
          '<div class="field"><label>' + (fbM === 'req' ? '写点反馈（必填）' : '跟爸爸妈妈说一句（可不填）') + '</label>' +
          '<textarea class="inp" id="fNote2" maxlength="120" placeholder="' + (t2 && t2.cat === 'read' ? '今天读的故事里，我最喜欢…' : '我把房间收拾干净啦！') + '"></textarea></div>') +
        '<div class="tiny muted">提交后等家长确认，最多 ' + fmt(t2 ? t2.coins : 0) + ' 个积分会进你的积分（具体多少由爸爸妈妈定）～</div>',
      okText: '提交',
      okClass: 'mint',
      onOk: function (mask, btn) {
        var noteV = val('#fNote2', mask);
        if (fbM === 'req' && !noteV) { toast('这个任务要写一句反馈哦', 'warn'); return; }
        doAct('task.submit', { taskId: id, note: noteV }, btn, '已提交，等家长确认～');
      }
    });
    return;
  }
regAct("submit", actSubmit);

function actGoalNew(e, el, act, id) {
    openModal({
      title: '⭐ 许个愿',
      body: '<div class="field"><label>我想要…</label><input class="inp" id="fGTitle" maxlength="30" placeholder="比如：一辆新自行车"></div>' +
        iconField('g', '🎯') +
        '<div class="tiny muted">许个愿就好，不用填积分～ 爸爸妈妈看到后会帮你一起加油、定个小目标！</div>',
      okText: '许愿',
      okClass: 'sun',
      onOk: function (mask, btn) {
        doAct('goal.create', { title: val('#fGTitle', mask), emoji: S._pickG }, btn, '心愿已许下 🌟');
      }
    });
    return;
  }
regAct("goal-new", actGoalNew);

function actGoalDel(e, el, act, id) {
    openModal({ title: '不要这个心愿了', body: '<div class="tiny">确定删除这个心愿吗？</div>', okText: '删除', okClass: 'gray',
      onOk: function (m, b) { doAct('goal.delete', { id: id }, b, '已删除'); } });
    return;
  }
regAct("goal-del", actGoalDel);
