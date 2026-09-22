/* ============================================================
   Lumio · handlers-shop.js —— 商城类动作：商品增删改上下架 / 图标选择 / 兑换 / 核销 / 提现
   分层：L4 交互　　依赖：core / format / feedback / state / ui-kit / pages-kid / registry / actions
   ============================================================ */
import { h, val, qa } from './core.js';
import { faceYuan, coin, fmt, expiryMs, fmtExpDate } from './format.js';
import { toast } from './feedback.js';
import { S } from './state.js';
import { openIconPicker, openModal, iconField, closeModal, syncIconBox } from './ui-kit.js';
import { couponGroup } from './pages-kid.js';
import { regAct } from './registry.js';
import { doAct, confirmDelete } from './actions.js';

function actIck(e, el, act, id) {
    openIconPicker(el.getAttribute('data-k'));
    return;
  }
regAct("ick", actIck);

function actShopNew_ShopEdit(e, el, act, id) {
    var edit3 = act === 'shop-edit';
    var s = edit3 ? (S.state.shop || []).find(function (x) { return x.id === id; }) : null;
    var curE = s ? s.emoji : '🎁';
    var st = S.state.settings || {}; // 弹窗文案用（refundRate）；v2.0.28 起缺失导致「编辑无效」
    /* v2.0.49：面额改由家长直接填写——弹窗原样回填已存值，不再用「单价 ÷ 每元积分」推算 */
    var cyEff = '';
    if (s && Number(s.cashYuan) > 0) cyEff = Math.round(Number(s.cashYuan) * 100) / 100;
    S._tog_shopListed = undefined; // 复位须在渲染前，避免读到上一单残留
    openModal({
      title: edit3 ? '✏️ 编辑奖励' : '🎁 新建奖励',
      body:
        '<div class="field"><label>奖励名称</label><input class="inp" id="fName2" maxlength="30" placeholder="比如：看动画片30分钟" value="' + h(s ? s.name : '') + '"></div>' +
        iconField('e', curE) +
        '<div class="field"><label>需要多少积分</label><input class="inp" id="fCost" type="number" min="0" max="1000000" value="' + (s ? s.cost : 20) + '"></div>' +
        '<div class="field"><label>库存（留空 = 不限量）</label><input class="inp" id="fStock" type="number" min="-1" max="1000000" value="' + (s && s.stock >= 0 ? s.stock : '') + '" placeholder="不限量"></div>' +
        '<div class="field"><label>类型</label><select class="inp" id="fType2">' +
        '<option value="item"' + (s && s.type === 'cash' ? '' : ' selected') + '>普通奖励（物品/特权）</option>' +
        '<option value="cash"' + (s && s.type === 'cash' ? ' selected' : '') + '>现金（要准备零钱）</option>' +
        '</select></div>' +
        '<div class="field"><label>面额（元／份，现金奖励专用）</label><input class="inp" id="fCy" type="number" min="0" step="0.01" inputmode="decimal" value="' + (cyEff === '' ? '' : cyEff) + '" placeholder="比如 1"></div>' +
        '<div class="tiny muted" style="margin-top:-6px" id="faceHint">' + ((s && s.cost > 0 && cyEff !== '') ? ('孩子花 <b>' + s.cost + '</b> 积分换 <b>¥' + faceYuan(cyEff) + '</b>（面额由你直接填，不做任何换算）。') : '面额由你直接填：想 50 积分换 1 元就填 <b>1</b>，想 50 积分换 5 元就填 <b>5</b>。') + '</div>' +
        '<div class="field"><label>奖励分类</label><select class="inp" id="fCat2">' +
        '<option value="privilege"' + (!s || s.cat === 'privilege' ? ' selected' : '') + '>🎟️ 特权奖励（多看动画、免家务…）</option>' +
        '<option value="goods"' + (s && s.cat === 'goods' ? ' selected' : '') + '>🧸 实物奖励（零食、玩具、现金…）</option>' +
        '</select></div>' +
        '<div class="field"><label>限期兑换（到这天结束自动下架；留空 = 不限期）</label><div class="timefield"><span class="tico">📅</span><input class="inp tinp" id="fRdl" type="date" value="' + (s && s.redeemDeadline ? s.redeemDeadline.slice(0, 10) : '') + '"></div></div>' +
        '<div class="field"><label>限期使用（填 3 = 兑换后第 3 天 24:00 到期；过期卡券消失、返还 ' + (st.refundRate != null ? st.refundRate : 80) + '% 积分；留空 = 不限期）</label><div class="timefield"><span class="tico">⏳</span><input class="inp tinp" id="fUld" type="number" min="0" max="3650" value="' + ((s && s.useLimitDays) ? s.useLimitDays : '') + '" placeholder="不限"></div></div>' +
        '<div class="sw"><div class="mid"><div class="t">上架（孩子端可见）</div></div>' +
        '<div class="tog ' + (s ? (s.listed ? 'on' : '') : 'on') + '" data-act="tog" data-k="shopListed"></div></div>',
      okText: edit3 ? '保存' : '创建',
      dangerText: edit3 ? '🗑 删除' : '',
      onDanger: function () {
        closeModal(); // 先收起编辑弹窗，让删除确认独立成一层
        confirmDelete({ what: '奖励', act: 'shop.delete', id: id });
      },
      focus: false,
      onOk: function (mask, btn) {
        var typeV = val('#fType2', mask);
        var faceV = val('#fCy', mask) === '' ? 0 : Number(val('#fCy', mask));
        /* v2.0.49：现金奖励必须填面额——不再用汇率兜底猜，家长填多少就是多少 */
        if (typeV === 'cash' && !(faceV > 0)) { toast('现金奖励要填「面额」哦：孩子花多少积分换多少钱', 'warn'); return; }
        var payload = {
          name: val('#fName2', mask), emoji: S._pickE, cost: Number(val('#fCost', mask)) || 0,
          stock: val('#fStock', mask) === '' ? -1 : Number(val('#fStock', mask)),
          type: val('#fType2', mask), cat: val('#fCat2', mask),
          cashYuan: faceV, // v2.0.49：面额由家长直接填写，原样上报
          listed: S._tog_shopListed !== undefined ? S._tog_shopListed : (s ? !!s.listed : true),
          redeemDeadline: val('#fRdl', mask) || '',
          useLimitDays: val('#fUld', mask) === '' ? 0 : Number(val('#fUld', mask))
        };
        if (edit3) payload.id = id;
        doAct(edit3 ? 'shop.update' : 'shop.create', payload, btn, '已保存');
      }
    });
    return;
  }
regAct("shop-new", actShopNew_ShopEdit);
regAct("shop-edit", actShopNew_ShopEdit);

function actPe(e, el, act, id) {
    qa('.pick', el.parentNode).forEach(function (x) { x.classList.remove('on'); });
    el.classList.add('on'); S._pickE = el.getAttribute('data-v'); syncIconBox('e'); return;
  }
regAct("pe", actPe);

function actShopList_ShopUnlist(e, el, act, id) {
    doAct('shop.update', { id: id, listed: act === 'shop-list' }, el, act === 'shop-list' ? '已上架，孩子端可见' : '已下架');
    return;
  }
regAct("shop-list", actShopList_ShopUnlist);
regAct("shop-unlist", actShopList_ShopUnlist);

function actRedeem(e, el, act, id) {
    var s2 = (S.state.shop || []).find(function (x) { return x.id === id; });
    var k2 = S.state.kid;
    S._rqId = id;
    var rr2 = (S.state.settings && S.state.settings.refundRate != null) ? S.state.settings.refundRate : 80;
    var isCash2 = !!(s2 && s2.type === 'cash');
    var unitYuan2 = s2 ? faceYuan(s2.cashYuan) : '0'; // v2.0.49：用家长填的面额，不折算
    var limitTip = s2 ? ((s2.redeemDeadline ? '<div class="kv"><div class="k">⏳ 限期兑换</div><div class="v">' + h(s2.redeemDeadline.slice(0, 10)) + ' 前要换掉，过期就下架啦</div></div>' : '') +
      (s2.useLimitDays ? '<div class="kv"><div class="k">🎟️ 限期使用</div><div class="v">兑换后第 ' + s2.useLimitDays + ' 天 24:00 到期；过期卡券消失，返还 ' + rr2 + '% 积分</div></div>' : '')) : '';
    openModal({
      title: '我要换这个！',
      body: '<div class="center" style="margin-bottom:12px"><div style="font-size:48px">' + h(s2 ? s2.emoji : '🎁') + '</div>' +
        '<div style="font-weight:800;font-size:17px;margin-top:4px">' + h(s2 ? s2.name : '') + '</div>' +
        '<div class="pricetag" style="justify-content:center;font-size:17px;margin-top:6px">' + coin(20) + fmt(s2 ? s2.cost : 0) +
        (isCash2 ? ' <span class="tiny muted">/ 份 = ¥' + unitYuan2 + '</span>' : '') + '</div></div>' +
        (isCash2
          ? '<div class="field"><label>换几份？</label><input class="inp" id="fQty" type="number" min="1" max="999" value="1" inputmode="numeric"></div>' +
            '<div class="kv"><div class="k">这次共要</div><div class="v"><span id="rqCost">' + fmt(s2 ? s2.cost : 0) + '</span> 积分 = ¥<span id="rqYuan">' + unitYuan2 + '</span></div></div>'
          : '') +
        '<div class="kv"><div class="k">我的积分</div><div class="v">' + fmt(k2.balance) + '</div></div>' +
        '<div class="kv"><div class="k">兑换后剩下</div><div class="v" id="rqLeft">' + fmt(k2.balance - (s2 ? s2.cost : 0)) + '</div></div>' +
        limitTip +
        '<div class="tiny muted" style="margin-top:10px">确认后马上就换好啦～' + (isCash2 ? '现金会按份数存进「我的」的钱包里。' : '') + '</div>',
      okText: '确认兑换',
      okClass: 'sun',
      focus: false,
      onOk: function (mask, btn) {
        var qty = 1;
        if (isCash2) {
          qty = Math.floor(Number(val('#fQty', mask)) || 1);
          if (qty < 1 || qty > 999) { toast('数量要填 1～999 之间的整数哦', 'warn'); return; }
          if (k2.balance < (s2 ? s2.cost : 0) * qty) { toast('积分不够换 ' + qty + ' 份哦', 'warn'); return; }
        }
        doAct('shop.redeem', { itemId: id, qty: qty }, btn, '兑换成功！');
      }
    });
    return;
  }
regAct("redeem", actRedeem);

function actRewardVerify(e, el, act, id) {
    doAct('reward.verify', { id: id }, el, '已核销 ✓');
    return;
  }
regAct("reward-verify", actRewardVerify);

function actCashVerify(e, el, act, id) {
    doAct('cash.verify', { id: id }, el, '已核销 ✓');
    return;
  }
regAct("cash-verify", actCashVerify);

function actRewardUseOpen(e, el, act, id) {
    var arr5 = couponGroup(el.getAttribute('data-g'));
    if (!arr5 || !arr5.length) { toast('奖励信息丢了，刷新看看', 'err'); return; }
    var r5 = arr5[0];
    var rr = (S.state.settings && S.state.settings.refundRate != null) ? S.state.settings.refundRate : 80;
    var rows5 = arr5.map(function (r) {
      var d = r.useDeadline ? Math.ceil((expiryMs(r.useDeadline) - Date.now()) / 86400000) : null;
      var dtxt = d === null ? '🗓 不限期，随时可用'
        : (d <= 1 ? '⏳ 有效期至 ' + fmtExpDate(r.useDeadline) + '（今天 24:00 到期）'
          : '⏳ 有效期至 ' + fmtExpDate(r.useDeadline) + ' · 剩 ' + (d - 1) + ' 天');
      return '<div class="urow"><span class="ud">' + dtxt + '</span>' +
        '<button class="btn sm mint" data-act="reward-use-one" data-id="' + h(r.id) + '">使用</button></div>';
    }).join('');
    var body5 = '<div class="center" style="margin-bottom:8px"><div style="font-size:44px">' + h(r5.itemEmoji || '🎁') + '</div>' +
      '<div style="font-weight:800;font-size:17px;margin-top:4px">' + h(r5.itemName) + '</div>' +
      '<div class="tiny muted" style="margin-top:2px">共 ' + arr5.length + ' 张 · 每张单独使用，先到期的先用</div></div>' +
      rows5 +
      '<div class="tiny muted" style="margin-top:8px">用后等爸爸妈妈核销；每张奖励只能核销一次。<br>超过有效期的卡券会自动消失，积分按 ' + rr + '% 返还。</div>';
    openModal({ title: '使用奖励', body: body5, actions: false, focus: false });
    return;
  }
regAct("reward-use-open", actRewardUseOpen);

function actRewardUseOne(e, el, act, id) {
    var rid5 = el.getAttribute('data-id');
    doAct('reward.use', { ids: [rid5] }, el, '已使用！记得让爸爸妈妈核销哦～');
    return;
  }
regAct("reward-use-one", actRewardUseOne);

function actCashWithdraw(e, el, act, id) {
    var cash = (S.state.wallet && S.state.wallet.cash) || 0;
    openModal({
      title: '💸 提取现金',
      body: '<div class="kv"><div class="k">钱包余额</div><div class="v">¥' + cash + '</div></div>' +
        '<div class="field"><label>提取金额（元）</label><input class="inp" id="fWdAmt" type="number" inputmode="decimal" min="0.1" step="0.1" placeholder="最多 ' + cash + '"></div>' +
        '<div class="field"><label>用来说一句（可不填）</label><input class="inp" id="fWdNote" maxlength="60" placeholder="比如：想买一本漫画书"></div>' +
        '<div class="tiny muted" style="margin-top:10px">提交后会发站内信告诉爸爸妈妈，记得跟他们说一声哦。</div>',
      okText: '提取',
      okClass: 'sun',
      focus: false,
      onOk: function (mask, btn) {
        var amt = Number(val('#fWdAmt', mask));
        if (!Number.isFinite(amt) || amt <= 0) { toast('要填一个大于 0 的金额哦', 'warn'); return; }
        if (amt > cash) { toast('钱包里只有 ' + cash + ' 元', 'warn'); return; }
        doAct('cash.withdraw', { amount: amt, note: val('#fWdNote', mask) }, btn, '提取成功，爸爸妈妈已收到通知～');
      }
    });
    return;
  }
regAct("cash-withdraw", actCashWithdraw);

function actPg(e, el, act, id) {
    qa('.pick', el.parentNode).forEach(function (x) { x.classList.remove('on'); });
    el.classList.add('on'); S._pickG = el.getAttribute('data-v'); syncIconBox('g'); return;
  }
regAct("pg", actPg);
