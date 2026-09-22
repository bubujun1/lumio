/* ============================================================
   Lumio 后端 · lib/actions/shop.js —— 商城与奖励：商品增删改、兑换、核销、提现
   分层：L4 动作
   ============================================================ */
'use strict';

const { str, HttpError, clampInt, trimText, uid, nowISO } = require('../util');
const { findKid, addLedger, cashYuanOf, DB, findShop, shopExpired, shopVisible } = require('../db');
const { pushMessage, meRef } = require('../messages');
const { approveRedemption } = require('../review');

const actionsShop = {
  'coin.adjust': {
      role: 'admin',
      run(ctx, p) {
        const k = findKid(str(p.kidId));
        if (!k) throw new HttpError(404, '找不到这个孩子');
        const delta = clampInt(p.delta, -100000, 100000, 0);
        if (!delta) throw new HttpError(400, '请填写要增加或扣除的积分数');
        /* v2.0.69→1.0.0 修复：理由非空校验必须先于余额改动，否则空理由抛错时已改内存余额却无账本记录，下次落盘即账实不符 */
        const reason = trimText(p.reason, 60);
        if (!reason) throw new HttpError(400, delta < 0 ? '扣积分必须写明理由，让孩子知道为什么' : '请填写原因');
        if (k.balance + delta < 0) throw new HttpError(409, k.name + ' 现在只有 ' + k.balance + ' 分，扣不了那么多');
        k.balance += delta;
        if (delta > 0) k.totalEarned += delta;
        addLedger(k, delta, reason, 'manual', ctx);
        if (trimText(p.message, 200)) pushMessage(meRef(ctx), { kind: 'kid', id: k.id, name: k.name }, p.message);
        return { kidId: k.id };
      }
    },
  'shop.create': {
      role: 'admin',
      run(ctx, p) {
        const isCashC = p.type === 'cash';
        const s = {
          id: uid('shop'),
          name: trimText(p.name, 30) || '新奖励',
          emoji: str(p.emoji) || '🎁',
          cost: clampInt(p.cost, 0, 1000000, 10),
          stock: p.stock === undefined || p.stock === '' ? -1 : clampInt(p.stock, -1, 1000000, -1),
          type: p.type === 'cash' ? 'cash' : 'item',
          cashYuan: isCashC ? cashYuanOf(p.cashYuan, p.cost, DB.settings.coinsPerYuan) : 0, // v2.0.49：面额取家长填的值
          cat: ['privilege', 'goods'].indexOf(p.cat) >= 0 ? p.cat : (p.type === 'cash' ? 'goods' : 'privilege'),
          listed: p.listed === true,
          active: true,
          redeemDeadline: str(p.redeemDeadline) || '',
          useLimitDays: clampInt(p.useLimitDays, 0, 3650, 0),
          createdAt: nowISO()
        };
        DB.shop.push(s);
        return { itemId: s.id };
      }
    },
  'shop.update': {
      role: 'admin',
      run(ctx, p) {
        const s = findShop(str(p.id));
        if (!s) throw new HttpError(404, '找不到这个奖励');
        if (p.name !== undefined) s.name = trimText(p.name, 30) || s.name;
        if (p.emoji !== undefined) s.emoji = str(p.emoji) || s.emoji;
        if (p.cost !== undefined) s.cost = clampInt(p.cost, 0, 1000000, s.cost); // v2.0.49：改积分不联动面额（面额独立填写）
        if (p.stock !== undefined) s.stock = p.stock === '' ? -1 : clampInt(p.stock, -1, 1000000, s.stock);
        if (p.type !== undefined) s.type = p.type === 'cash' ? 'cash' : 'item';
        // v2.0.49: 面额由家长直接填写，原样落库（不再按 成本÷汇率 派生）
        if (p.cashYuan !== undefined && s.type === 'cash') s.cashYuan = cashYuanOf(p.cashYuan, s.cost, DB.settings.coinsPerYuan);
        if (p.cat !== undefined) s.cat = ['privilege', 'goods'].indexOf(p.cat) >= 0 ? p.cat : s.cat;
        if (p.active !== undefined) s.active = !!p.active;
        if (p.listed !== undefined) {
          s.listed = !!p.listed;
          if (s.listed && shopExpired(s)) s.redeemDeadline = ''; // 重新上架时清除已过期的兑换时限，便于再次使用
        }
        if (p.redeemDeadline !== undefined) s.redeemDeadline = str(p.redeemDeadline) || '';
        if (p.useLimitDays !== undefined) s.useLimitDays = clampInt(p.useLimitDays, 0, 3650, s.useLimitDays);
        return { itemId: s.id };
      }
    },
  'shop.delete': {
      role: 'admin',
      run(ctx, p) {
        DB.shop = DB.shop.filter((s) => s.id !== str(p.id));
        return {};
      }
    },
  'shop.redeem': {
      role: 'kid',
      run(ctx, p) {
        const s = findShop(str(p.itemId));
        if (!s || !shopVisible(s)) throw new HttpError(404, '这个奖励已经下架啦');
        const kid = ctx.kid;
        const qty = clampInt(p.qty, 1, 999, 1); // 现金等奖励可一次换多份
        const totalCost = s.cost * qty;
        if (s.stock >= 0 && s.stock < qty) throw new HttpError(409, '库存只剩 ' + s.stock + ' 份，不够换 ' + qty + ' 份哦');
        if (kid.balance < totalCost) {
          throw new HttpError(409, '积分还差 ' + (totalCost - kid.balance) + ' 个，继续加油存钱吧！');
        }
        if (s.stock === 0) throw new HttpError(409, '这个奖励已经被换完啦');
        const rdm = {
          id: uid('rdm'), itemId: s.id, itemName: s.name, itemEmoji: s.emoji, itemType: s.type,
          kidId: kid.id, cost: totalCost, qty,
          cashYuan: s.type === 'cash' ? cashYuanOf(s.cashYuan, s.cost, DB.settings.coinsPerYuan) : 0, // v2.0.49：快照家长填写的面额（不再按汇率派生）
          status: 'pending',
          reply: '', createdAt: nowISO(), reviewedAt: ''
        };
        DB.redemptions.push(rdm);
        // 兑换免审：孩子确认后立即生效（积分即扣、奖励即得），不再等家长审核。
        // 本 handler 同步执行（run 内无 await，Node 单线程原子），扣库存与扣积分在同一临界区完成，不会并发超卖。
        approveRedemption(rdm, ctx, '');
        const last = DB.ledger[DB.ledger.length - 1];
        if (last) { last.operatorUid = ctx.user.uid; last.operatorName = ctx.user.username; }
        return { redemptionId: rdm.id, autoApproved: true };
      }
    },
  'reward.use': {
      role: 'kid',
      run(ctx, p) {
        // 支持批量使用：相同奖励、相同使用限制的多张卡券，可一次用掉若干张
        const ids = Array.isArray(p.ids) ? p.ids.map(str)
          : (p.id ? [str(p.id)] : []);
        if (!ids.length) throw new HttpError(400, '请选择要使用的奖励');
        const rs = ids.map((id) => DB.redemptions.find((x) => x.id === id && x.kidId === ctx.kid.id)).filter(Boolean);
        if (rs.length !== ids.length) throw new HttpError(404, '部分奖励找不到了，刷新看看');
        for (const r of rs) {
          if (r.status !== 'approved') throw new HttpError(409, '有奖励还没通过审核呢');
          if (r.itemType === 'cash') throw new HttpError(409, '现金奖励在「我的」钱包里提取哦');
          if (r.useStatus === 'used') throw new HttpError(409, '有奖励已经用过啦');
        }
        for (const r of rs) {
          r.useStatus = 'used';
          r.usedAt = nowISO();
          r.verified = false;
          r.verifiedAt = '';
        }
        // 站内信：孩子使用奖励告知父母（家长在总览-待核销里核销）
        const name = rs[0].itemName || '奖励';
        pushMessage(meRef(ctx), { kind: 'parents', id: '', name: '' },
          ctx.kid.name + ' 使用了 ' + rs.length + ' 张「' + name + '」' + (rs.length > 1 ? '（共 ' + rs.length + ' 张）' : '') + '，请核销');
        return { ids: ids };
      }
    },
  'reward.verify': {
      role: 'admin',
      run(ctx, p) {
        const r = DB.redemptions.find((x) => x.id === str(p.id));
        if (!r) throw new HttpError(404, '找不到这个奖励');
        if (r.useStatus !== 'used') throw new HttpError(409, '这张券还没被使用');
        if (r.verified) throw new HttpError(409, '这张券已经核销过啦');
        r.verified = true;
        r.verifiedAt = nowISO();
        return { id: r.id };
      }
    },
  'cash.withdraw': {
      role: 'kid',
      run(ctx, p) {
        const kid = ctx.kid;
        const amount = Math.round(Number(p.amount) * 10) / 10;
        if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, '要填一个大于 0 的提取金额哦');
        if ((kid.cash || 0) < amount) throw new HttpError(409, '钱包里只有 ' + (kid.cash || 0) + ' 元，不够提取 ' + amount + ' 元哦');
        kid.cash = Math.round((kid.cash - amount) * 10) / 10;
        const w = { id: uid('wd'), kidId: kid.id, amount, note: trimText(p.note, 60), at: nowISO(), verified: false, verifiedAt: '' };
        DB.withdrawals.push(w);
        // 站内信：孩子提现告知父母（家长在总览-待处理里核销）
        pushMessage(meRef(ctx), { kind: 'parents', id: '', name: '' },
          kid.name + ' 从现金钱包提取了 ' + amount + ' 元' + (w.note ? '（' + w.note + '）' : '') + '，钱包剩余 ' + kid.cash + ' 元，请核销');
        return { id: w.id, cash: kid.cash };
      }
    },
  'cash.verify': {
      role: 'admin',
      run(ctx, p) {
        const w = DB.withdrawals.find((x) => x.id === str(p.id));
        if (!w) throw new HttpError(404, '找不到这笔提取');
        if (w.verified) throw new HttpError(409, '这笔提取已经核销过啦');
        w.verified = true;
        w.verifiedAt = nowISO();
        return { id: w.id };
      }
    }
};

module.exports = actionsShop;
