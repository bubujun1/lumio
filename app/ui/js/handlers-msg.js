/* ============================================================
   Lumio · handlers-msg.js —— 消息类动作：留言与悄悄话 / 收发消息 / 消息子页切换
   分层：L4 交互　　依赖：core / format / api / feedback / state / domain / render / ui-kit / pages-kid / registry / actions / boot
   ============================================================ */
import { q, running, done, h, val, qa } from './core.js';
import { byAtAsc } from './format.js';
import { apiAct } from './api.js';
import { toast } from './feedback.js';
import { S } from './state.js';
import { isReadBy } from './domain.js';
import { paint } from './render.js';
import { openModal, chatStick, maskOf, refreshTopModal } from './ui-kit.js';
import { chatHtml, isMine, meRefKid, kidBucketOf } from './pages-kid.js';
import { regAct } from './registry.js';
import { doAct } from './actions.js';
import { refresh } from './boot.js';

function actMsgsub(e, el, act, id) {
    S.msgSub = el.getAttribute('data-v') || 'chat';
    S.revHist = false;                        /* v2.0.51：换子页时「更早的记录」回到收起态 */
    paint(null, true); return;
  }
regAct("msgsub", actMsgsub);

function actMsg(e, el, act, id) {
    var kd4 = (S.state.kids || []).find(function (x) { return x.id === id; });
    var meP = { kind: 'parent', id: S.state.me.uid };
    var kidId = id;
    S._chat = { toKind: 'kid', toSlot: '', toId: kidId };
    openModal({
      title: '💬 和 ' + (kd4 ? kd4.name : '') + ' 的留言',
      cls: 'chatfull',
      actions: false,
      focus: false,
      render: function () {
        chatStick();
        var conv = (S.state.messages || []).filter(function (m) {
          return (m.from.kind === 'kid' && m.from.id === kidId) || (m.to.kind === 'kid' && m.to.id === kidId);
        }).sort(byAtAsc).slice(-30);
        var unreadNow = conv.filter(function (m) { return m.from.kind === 'kid' && !isReadBy(m, meP); });
        unreadNow.forEach(function (m) { apiAct('message.read', { id: m.id }); });
        if (unreadNow.length) setTimeout(function () { refresh(true); }, 700);
        return (unreadNow.length ? '' : '') +
          '<div class="chatwrap"><div class="chatscroll" id="chatScroll">' + chatHtml(conv, meP, { inChat: true }) + '</div>' +
          '<div class="chatinput"><textarea class="inp" id="chatIn" rows="1" maxlength="200" placeholder="今天你很棒！"></textarea>' +
          '<button class="btn mint" data-act="chatsend">发送</button></div></div>';
      }
    });
    setTimeout(function () { var sc = q('#chatScroll'); if (sc) sc.scrollTop = sc.scrollHeight; }, 80);
    return;
  }
regAct("msg", actMsg);

function actPmsg(e, el, act, id) {
    var pk = el.getAttribute('data-key') || 'pgroup';
    var meP2 = { kind: 'parent', id: S.state.me.uid };
    var ptitle = pk === 'pgroup' ? '爸爸妈妈群' : (pk === 'dad' ? '和爸爸的悄悄话' : '和妈妈的悄悄话');
    S._chat = pk === 'pgroup' ? { toKind: 'parents', toSlot: '', toId: '' } : { toKind: 'parent', toSlot: pk, toId: '' };
    openModal({
      title: '💬 ' + ptitle,
      cls: 'chatfull',
      actions: false,
      focus: false,
      render: function () {
        chatStick();
        var conv = (S.state.messages || []).filter(function (m) {
          if (pk === 'pgroup') return m.to.kind === 'parents' && m.from.kind === 'parent';
          return (m.from.kind === 'parent' && m.from.slot === pk) ||
                 (m.to.kind === 'parent' && m.to.slot === pk && m.from.id === meP2.id);
        }).sort(byAtAsc).slice(-30);
        var unreadNow = conv.filter(function (m) { return !isMine(m, meP2) && !isReadBy(m, meP2); });
        unreadNow.forEach(function (m) { apiAct('message.read', { id: m.id }); });
        if (unreadNow.length) setTimeout(function () { refresh(true); }, 700);
        return '<div class="chatwrap"><div class="chatscroll" id="chatScroll">' + chatHtml(conv, meP2, { inChat: true }) + '</div>' +
          '<div class="chatinput"><textarea class="inp" id="chatIn" rows="1" maxlength="200" placeholder="说点什么…"></textarea>' +
          '<button class="btn pink" data-act="chatsend">发送</button></div></div>';
      }
    });
    setTimeout(function () { var sc = q('#chatScroll'); if (sc) sc.scrollTop = sc.scrollHeight; }, 80);
    return;
  }
regAct("pmsg", actPmsg);

function actKidmsg(e, el, act, id) {
    var ck = el.getAttribute('data-key') || 'group';
    var meK = meRefKid();
    var stK = S.state;
    var titleK, send;
    if (ck === 'group') { titleK = '和爸爸妈妈的留言'; send = { toKind: 'parents', toSlot: '', toId: '' }; }
    else if (ck === 'dad') { titleK = '和爸爸的悄悄话'; send = { toKind: 'parent', toSlot: 'dad', toId: '' }; }
    else if (ck === 'mom') { titleK = '和妈妈的悄悄话'; send = { toKind: 'parent', toSlot: 'mom', toId: '' }; }
    else {
      var sibId = ck.slice(4);
      var sib = (stK.kids || []).find(function (x) { return x.id === sibId; });
      titleK = '和 ' + (sib ? sib.name : '') + ' 的悄悄话';
      send = { toKind: 'kid', toSlot: '', toId: sibId };
    }
    S._chat = send;
    openModal({
      title: '💬 ' + titleK,
      cls: 'chatfull',
      actions: false,
      focus: false,
      render: function () {
        chatStick();
        var conv = (S.state.messages || []).filter(function (m) { return kidBucketOf(m, meK) === ck; })
          .sort(byAtAsc).slice(-30);
        var unreadNow = conv.filter(function (m) { return !isMine(m, meK) && !isReadBy(m, meK); });
        unreadNow.forEach(function (m) { apiAct('message.read', { id: m.id }); });
        if (unreadNow.length) setTimeout(function () { refresh(true); }, 700);
        return '<div class="chatwrap"><div class="chatscroll" id="chatScroll">' + chatHtml(conv, meK, { inChat: true }) + '</div>' +
          '<div class="chatinput"><textarea class="inp" id="chatIn" rows="1" maxlength="200" placeholder="说点什么…"></textarea>' +
          '<button class="btn mint" data-act="chatsend">发送</button></div></div>';
      }
    });
    setTimeout(function () { var sc = q('#chatScroll'); if (sc) sc.scrollTop = sc.scrollHeight; }, 80);
    return;
  }
regAct("kidmsg", actKidmsg);

function actChatsend(e, el, act, id) {
    var maskC = maskOf(el);
    var inpC = q('#chatIn', maskC);
    var txtC = inpC ? inpC.value.trim() : '';
    if (!txtC) { toast('说点什么吧～', 'warn'); return; }
    var c = S._chat || {};
    if (S.busy) return;
    S.busy = true; running(el);
    apiAct('message.send', { toKind: c.toKind, toSlot: c.toSlot || '', toId: c.toId || '', text: txtC }).then(function (res) {
      S.busy = false; done(el);
      if (!res || !res.ok) { toast((res && res.error) || '发送失败', 'err'); return; }
      var prev = S.state;
      if (res.state) { S.state = res.state; paint(prev, true); }
      refreshTopModal();
      var ni = q('#chatIn'); if (ni) ni.focus();
      var sc = q('#chatScroll'); if (sc) sc.scrollTop = sc.scrollHeight;
      toast('已经发出去啦 💌', 'ok');
    });
    return;
  }
regAct("chatsend", actChatsend);

function actKidMsg(e, el, act, id) {
    var recps = S.state.recipients || [];
    var firstOn = recps.filter(function (r) { return r.bound !== false; })[0] || recps[0] || { kind: 'parents', id: '', slot: '', name: '爸爸妈妈' };
    S._recp = { kind: firstOn.kind, id: firstOn.id || '', slot: firstOn.slot || '', name: firstOn.name };
    var recHtml = recps.map(function (r, i) {
      var dis = r.bound === false;
      return '<button class="pick rec' + (r === firstOn ? ' on' : '') + (dis ? ' is-disabled' : '') + '"' +
        (dis ? ' disabled' : '') + ' data-act="recp"' +
        ' data-kind="' + h(r.kind) + '" data-slot="' + h(r.slot || '') + '" data-id="' + h(r.id || '') + '" data-n="' + h(r.name) + (r.kind === 'parents' ? '（都看）' : '') + '">' +
        (r.kind === 'kid' ? h(r.avatar || '🧒 ') : '') + h(r.name) + (r.kind === 'parents' ? '（都看）' : '') + '</button>';
    }).join('');
    openModal({
      title: '✍️ 写留言',
      body: '<div class="field"><label>发给谁</label><div class="picks">' + recHtml + '</div></div>' +
        '<div class="field"><label>想说的话</label><textarea class="inp" id="fKText" maxlength="200" placeholder="我想要……"></textarea></div>' +
        '<div class="tiny muted">只有你和收到的人能看到这条留言。</div>',
      okText: '发送',
      focus: false,
      onOk: function (mask, btn) {
        var r = S._recp || { kind: 'parents', id: '', slot: '' };
        doAct('message.send', { toKind: r.kind, toSlot: r.slot || '', toId: r.id || '', text: val('#fKText', mask) }, btn, '已经发出去啦 💌');
      }
    });
    return;
  }
regAct("kid-msg", actKidMsg);

function actRecp(e, el, act, id) {
    qa('.pick.rec', el.parentNode).forEach(function (x) { x.classList.remove('on'); });
    el.classList.add('on');
    S._recp = { kind: el.getAttribute('data-kind') || 'parents', id: el.getAttribute('data-id') || '', slot: el.getAttribute('data-slot') || '', name: el.getAttribute('data-n') || '' };
    return;
  }
regAct("recp", actRecp);
