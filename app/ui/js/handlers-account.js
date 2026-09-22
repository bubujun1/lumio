/* ============================================================
   Lumio · handlers-account.js —— 账号类动作：孩子新增·编辑·绑定·解绑，家长绑定·解绑
   分层：L4 交互　　依赖：core / feedback / state / ui-kit / registry / actions
   ============================================================ */
import { h, val, qa, q } from './core.js';
import { toast } from './feedback.js';
import { S } from './state.js';
import { openModal } from './ui-kit.js';
import { regAct } from './registry.js';
import { doAct, confirmAct, confirmDelete } from './actions.js';

function actKidNew_KidEdit(e, el, act, id) {
    var edit = act === 'kid-edit';
    var kd = edit ? (S.state.kids || []).find(function (x) { return x.id === id; }) : null;
    /* v2.0.61：头像 / 配色候选改为读后端下发的 state.consts（唯一来源），前端不再自留副本 */
    var consts = (S.state && S.state.consts) || {};
    var avs = consts.avatars || [];
    var cols = consts.colors || [];
    var curA = kd ? kd.avatar : (avs[0] || '');
    var curC = kd ? kd.color : (cols[0] || '');
    S._pick = { avatar: curA, color: curC };
    openModal({
      title: edit ? '✏️ 编辑孩子' : '👶 新建孩子',
      body:
        '<div class="field"><label>名字</label><input class="inp" id="fName" maxlength="20" placeholder="比如：小明" value="' + h(kd ? kd.name : '') + '"></div>' +
        '<div class="field"><label>选个头像</label><div class="picks" id="pickA">' +
        avs.map(function (a) { return '<button class="pick ' + (a === curA ? 'on' : '') + '" data-act="pa" data-v="' + a + '">' + a + '</button>'; }).join('') +
        '</div></div>' +
        '<div class="field"><label>选个颜色</label><div class="picks" id="pickC">' +
        cols.map(function (c) { return '<button class="pick c ' + (c === curC ? 'on' : '') + '" data-act="pc" data-v="' + c + '"><i style="background:' + c + '"></i></button>'; }).join('') +
        '</div></div>' +
        '<div class="field"><label>备注（可不填）</label><input class="inp" id="fNote" maxlength="60" value="' + h(kd ? kd.note : '') + '" placeholder="比如：姐姐 / 5岁"></div>' +
        '<div class="tiny muted">💡 创建后到「设置与管理 → 孩子与身份」里点「绑定飞牛账号」，孩子就能用自己的飞牛账号进入了。账号管理只有你能操作。</div>',
      okText: edit ? '保存' : '创建',
      focus: false,
      onOk: function (mask, btn) {
        var payload = {
          name: val('#fName', mask), avatar: S._pick.avatar, color: S._pick.color, note: val('#fNote', mask)
        };
        if (edit) payload.id = id;
        doAct(edit ? 'kid.update' : 'kid.create', payload, btn, edit ? '已保存' : '创建好啦');
      }
    });
    return;
  }
regAct("kid-new", actKidNew_KidEdit);
regAct("kid-edit", actKidNew_KidEdit);

function actPa_Pc(e, el, act, id) {
    var box = el.parentNode;
    qa('.pick', box).forEach(function (x) { x.classList.remove('on'); });
    el.classList.add('on');
    S._pick[act === 'pa' ? 'avatar' : 'color'] = el.getAttribute('data-v');
    return;
  }
regAct("pa", actPa_Pc);
regAct("pc", actPa_Pc);

function actKidBind_Quickbind(e, el, act, id) {
    var kids = S.state.kids || [];
    var seen = S.state.seenUsers || [];
    var preUid = el.getAttribute('data-uid') || '';
    var preName = el.getAttribute('data-uname') || '';
    var bindKidId = id || (kids.length === 1 ? kids[0].id : '');
    var kd2 = kids.find(function (x) { return x.id === bindKidId; });
    if (act === 'quickbind' && !kids.length) { toast('请先新建一个孩子', 'err'); return; }
    var opts2 = seen.filter(function (u) { return !kids.some(function (k) { return k.id !== bindKidId && k.boundUid === u.uid; }); });
    openModal({
      title: '🔗 绑定飞牛账号',
      body:
        (kids.length > 1 ? '<div class="field"><label>绑定给哪个孩子</label><select class="inp" id="fKid2">' +
          kids.map(function (k) { return '<option value="' + k.id + '"' + (k.id === bindKidId ? ' selected' : '') + '>' + h(k.avatar + ' ' + k.name) + '</option>'; }).join('') +
          '</select></div>' : (kd2 ? '<div class="chip sky" style="margin-bottom:12px;display:inline-flex">绑定给 ' + h(kd2.avatar + ' ' + kd2.name) + '</div>' : '')) +
        '<div class="field"><label>要绑定的飞牛用户</label>' +
        '<select class="inp" id="fUser">' +
        '<option value="">— 选择来访过的飞牛用户 —</option>' +
        opts2.map(function (u) {
          return '<option value="' + h(u.username) + '"' + (u.username === preName ? ' selected' : '') + '>' + h(u.username) + '（UID ' + h(u.uid) + '）</option>';
        }).join('') +
        '</select></div>' +
        '<div class="field"><label>或者手动输入飞牛用户名</label><input class="inp" id="fUserManual" placeholder="飞牛登录用户名" value="' + h(preName) + '"></div>' +
        '<div class="tiny muted">💡 下拉列表里只显示「访问过本应用」的飞牛用户。如果没看到想绑的人，请让他先用飞牛账号打开一次「Lumio」，再回到这里。<br>绑好后，他用飞牛账号打开本应用，就会直接进入应用，不需要密码。</div>',
      okText: '绑定',
      focus: false,
      onOk: function (mask, btn) {
        var sel = q('#fKid2', mask);
        var kidId = sel ? sel.value : bindKidId;
        var manual = val('#fUserManual', mask);
        var picked = val('#fUser', mask);
        var uname = manual || picked;
        if (!uname) { toast('请选择或填写飞牛用户名', 'err'); return; }
        if (!kidId) { toast('请先选择孩子', 'err'); return; }
        doAct('kid.bind', { id: kidId, username: uname }, btn, '绑定成功 🔗');
      }
    });
    return;
  }
regAct("kid-bind", actKidBind_Quickbind);
regAct("quickbind", actKidBind_Quickbind);

function actKidUnbind(e, el, act, id) {
    confirmAct({
      title: '解绑飞牛账号', body: '解绑后，这个孩子对应的飞牛账号将无法再打开应用，但孩子的积分和记录都会保留。',
      okText: '确认解绑', okClass: 'danger',
      act: 'kid.unbind', payload: { id: id }, toast: '已解绑'
    });
    return;
  }
regAct("kid-unbind", actKidUnbind);

function actParentNew_Quickparent(e, el, act, id) {
    var seenP = S.state.seenUsers || [];
    var parentsP = S.state.parents || [];
    var preP = el.getAttribute('data-uname') || '';
    S._pickPT = S._pickPT || '妈妈';
    var cands = seenP.filter(function (u) {
      var asKid = (S.state.kids || []).some(function (k) { return (k.boundUid && k.boundUid === u.uid) || (!k.boundUid && k.boundUsername && k.boundUsername === u.username); });
      var asParent = parentsP.some(function (p) { return (p.uid && p.uid === u.uid) || (!p.uid && p.username === u.username); });
      return !asKid && !asParent;
    });
    openModal({
      title: '👑 绑定家长身份',
      body:
        '<div class="field"><label>称呼（孩子的爸妈）</label><div class="picks" style="gap:8px">' +
        ['爸爸', '妈妈'].map(function (t) {
          return '<button class="pick ' + (S._pickPT === t ? 'on' : '') + '" style="width:auto;padding:0 16px;font-weight:700" data-act="pt" data-v="' + t + '">' + t + '</button>';
        }).join('') + '</div></div>' +
        '<div class="field"><label>要绑定的飞牛用户</label>' +
        '<select class="inp" id="fPUser"><option value="">— 选择来访过的飞牛用户 —</option>' +
        cands.map(function (u) {
          return '<option value="' + h(u.username) + '"' + (u.username === preP ? ' selected' : '') + '>' + h(u.username) + '（UID ' + h(u.uid) + '）</option>';
        }).join('') +
        '</select></div>' +
        '<div class="field"><label>或手动输入飞牛用户名（含管理员自己）</label><input class="inp" id="fPUserManual" placeholder="飞牛登录用户名" value="' + h(preP) + '"></div>' +
        '<div class="tiny muted">💡 绑定后权限和家长（管理员）完全一样：审核、发币、配置都可以。飞牛管理员想显示称呼的话，也可以在这里填自己的用户名绑一个称呼。</div>',
      okText: '绑定',
      focus: false,
      onOk: function (mask, btn) {
        var uname = val('#fPUserManual', mask) || val('#fPUser', mask);
        if (!uname) { toast('请选择或填写飞牛用户名', 'err'); return; }
        doAct('parent.bind', { username: uname, title: S._pickPT || '妈妈' }, btn, '已绑定为「' + (S._pickPT || '妈妈') + '」👑');
      }
    });
    return;
  }
regAct("parent-new", actParentNew_Quickparent);
regAct("quickparent", actParentNew_Quickparent);

function actPt(e, el, act, id) {
    S._pickPT = el.getAttribute('data-v');
    qa('.pick', el.parentNode).forEach(function (x) { x.classList.remove('on'); });
    el.classList.add('on');
    return;
  }
regAct("pt", actPt);

function actParentUnbind(e, el, act, id) {
    var pu = el.getAttribute('data-uname') || '';
    confirmAct({
      title: '解绑家长身份', body: '解绑后，「' + h(pu) + '」将立即失去家长管理权限（积分、记录都保留在系统里）。',
      okText: '确认解绑', okClass: 'danger',
      act: 'parent.unbind', payload: { username: pu }, toast: '已解绑'
    });
    return;
  }
regAct("parent-unbind", actParentUnbind);

function actKidDel(e, el, act, id) {
    var kdx = (S.state.kids || []).find(function (x) { return x.id === id; });
    confirmAct({
      title: '删除孩子',
      body: '确定要删除 <b>' + h(kdx ? kdx.name : '') + '</b> 吗？<br><br>他/她的积分流水、任务记录、心愿和留言都会一起删除，<b>不可恢复</b>。',
      okText: '确认删除', okClass: 'danger',
      act: 'kid.delete', payload: { id: id }, toast: '已删除'
    });
    return;
  }
regAct("kid-del", actKidDel);
