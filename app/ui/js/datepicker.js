/* ============================================================
   Lumio · datepicker.js —— 自定义日期滚轮（替代原生 date input）
   分层：L2 渲染　　依赖：core
   ============================================================ */
import { q } from './core.js';

/* 配色偏好要在首帧之前贴上，避免先粉后蓝的闪一下 */
/* ============================================================
   自定义日期滚轮选择器（替换原生 type=date 日历，同育婴记方案）
   ============================================================ */
var DP_ITEM = 44;
var dpTarget = null, dpY0 = 2016, dpM0 = 1, dpD0 = 1, dpY = 0, dpM = 0, dpD = 0;
var dpScrollTimer = null, dpMin = null, dpMax = null, dpInitLocating = false, dpWheelAcc = 0, dpDrag = null;
function dpIso(y, m, d) { return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
function dpDaysIn(y, m) { return new Date(y, m, 0).getDate(); }
function dpColIdx(col) {
  var lis = col.querySelectorAll('li'); if (!lis.length) return 0;
  return Math.min(lis.length - 1, Math.max(0, Math.round(col.scrollTop / DP_ITEM)));
}
function dpColBuild(col, items, sel, kind) {
  var now = new Date();
  var tval = kind === 'y' ? now.getFullYear() : kind === 'm' ? now.getMonth() + 1 : now.getDate();
  col.innerHTML = '<ul>' + items.map(function (t) { return '<li' + (t === tval ? ' class="today"' : '') + '>' + t + '</li>'; }).join('') + '</ul>';
  var idx = Math.max(0, items.indexOf(sel));
  col.scrollTop = idx * DP_ITEM;
  dpMarkCur(col, idx);
}
function dpMarkCur(col, idx) {
  var lis = col.querySelectorAll('li');
  lis.forEach(function (li, i) { li.classList.toggle('cur', i === idx); });
}
function dpRefillDays() {
  var days = dpDaysIn(dpY, dpM);
  var ym = dpIso(dpY, dpM, 1).slice(0, 7);
  var d1 = 1, d2 = days;
  if (dpMin && dpMin.slice(0, 7) === ym) d1 = Math.max(1, Number(dpMin.slice(8, 10)));
  if (dpMax && dpMax.slice(0, 7) === ym) d2 = Math.min(days, Number(dpMax.slice(8, 10)));
  if (d1 > d2) d1 = d2;
  dpD0 = d1;
  if (dpD > d2) dpD = d2;
  if (dpD < d1) dpD = d1;
  dpColBuild(q('#dpColD'), Array.from({ length: d2 - d1 + 1 }, function (_, i) { return d1 + i; }), dpD, 'd');
  q('#dpPreview').textContent = dpY + '年' + dpM + '月' + dpD + '日';
}
function dpOnScroll(col, kind) {
  dpInitLocating = false;
  clearTimeout(dpScrollTimer);
  dpScrollTimer = setTimeout(function () {
    var i = dpColIdx(col); col._wIdx = i; dpMarkCur(col, i);
    if (kind === 'y') dpY = dpY0 + i; else if (kind === 'm') dpM = dpM0 + i; else dpD = dpD0 + i;
    if (kind !== 'd') dpRefillDays();
    q('#dpPreview').textContent = dpY + '年' + dpM + '月' + dpD + '日';
    dpSyncManual();
  }, 130);
}
function dpApplyIdx(col, kind, i) {
  dpMarkCur(col, i);
  if (kind === 'y') dpY = dpY0 + i; else if (kind === 'm') dpM = dpM0 + i; else dpD = dpD0 + i;
  if (kind !== 'd') dpRefillDays();
  q('#dpPreview').textContent = dpY + '年' + dpM + '月' + dpD + '日';
  dpSyncManual();
}
function dpBindPC(col, kind) {
  if (col.dataset.pcbound === '1') return;
  col.dataset.pcbound = '1';
  col.addEventListener('wheel', function (e) {
    e.preventDefault();
    var dl = e.deltaY, steps = 0;
    if (Math.abs(dl) >= 50) {
      steps = Math.round(dl / 100); if (!steps) steps = Math.sign(dl);
      dpWheelAcc = 0;
    } else {
      dpWheelAcc += dl;
      while (Math.abs(dpWheelAcc) >= 51) { steps += Math.sign(dpWheelAcc); dpWheelAcc -= Math.sign(dpWheelAcc) * 51; }
    }
    if (!steps) return;
    var max = col.querySelectorAll('li').length - 1;
    var idx = typeof col._wIdx === 'number' ? col._wIdx : dpColIdx(col);
    for (var k = 0; k < Math.abs(steps); k++) idx = Math.min(max, Math.max(0, idx + Math.sign(steps)));
    col._wIdx = idx;
    col.scrollTop = idx * DP_ITEM;
    dpApplyIdx(col, kind, idx);
  }, { passive: false });
  col.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    dpDrag = { col: col, kind: kind, y: e.clientY, st: col.scrollTop, moved: false };
    col.classList.add('nosnap');
    e.preventDefault();
  });
}
function dpSyncManual() {
  var iy = q('#dpInY'); if (!iy) return;
  iy.value = dpY; q('#dpInM').value = dpM; q('#dpInD').value = dpD;
}
function dpManualApply() {
  var iy = q('#dpInY'); if (!iy || !dpTarget) return false;
  var changed = false;
  function grab(el, cur) { var v = Number(el.value); return (el.value !== '' && Number.isFinite(v) && v !== cur) ? v : null; }
  var ry = grab(iy, dpY), rm = grab(q('#dpInM'), dpM), rd = grab(q('#dpInD'), dpD);
  if (ry === null && rm === null && rd === null) return false;
  var yMax = dpY0 + q('#dpColY').querySelectorAll('li').length - 1;
  var mMax = dpM0 + q('#dpColM').querySelectorAll('li').length - 1;
  var y = ry !== null ? Math.min(yMax, Math.max(dpY0, ry)) : dpY;
  var m = rm !== null ? Math.min(mMax, Math.max(dpM0, rm)) : dpM;
  var dd = rd !== null ? Math.max(dpD0, rd) : dpD;
  dd = Math.min(dpDaysIn(y, m), dd);
  dpY = y; dpM = m; dpD = dd;
  q('#dpColY').scrollTop = (y - dpY0) * DP_ITEM; dpMarkCur(q('#dpColY'), y - dpY0); q('#dpColY')._wIdx = y - dpY0;
  q('#dpColM').scrollTop = (m - dpM0) * DP_ITEM; dpMarkCur(q('#dpColM'), m - dpM0); q('#dpColM')._wIdx = m - dpM0;
  dpRefillDays();
  q('#dpColD').scrollTop = (dpD - dpD0) * DP_ITEM; dpMarkCur(q('#dpColD'), dpD - dpD0); q('#dpColD')._wIdx = dpD - dpD0;
  q('#dpPreview').textContent = dpY + '年' + dpM + '月' + dpD + '日';
  dpSyncManual();
  return true;
}
function dpClose() { q('#dpMask').classList.remove('show'); dpTarget = null; }
function dpSet() {
  if (!dpTarget) return dpClose();
  dpManualApply();
  dpY = dpY0 + dpColIdx(q('#dpColY'));
  dpM = dpM0 + dpColIdx(q('#dpColM'));
  dpD = dpD0 + dpColIdx(q('#dpColD'));
  dpD = Math.min(dpD, dpDaysIn(dpY, dpM));
  dpTarget.value = dpIso(dpY, dpM, dpD);
  dpTarget.dispatchEvent(new Event('change', { bubbles: true }));
  if (dpTarget.dpSync) dpTarget.dpSync();
  dpClose();
}
function dpClear() {
  if (!dpTarget) return dpClose();
  dpTarget.value = '';
  dpTarget.dispatchEvent(new Event('change', { bubbles: true }));
  if (dpTarget.dpSync) dpTarget.dpSync();
  dpClose();
}
function openDatePicker(inp) {
  if (!inp || inp.dataset.dp !== '1') return;
  dpTarget = inp;
  dpMin = inp.min || null; dpMax = inp.max || null;
  var v = inp.value ? inp.value.split('-').map(Number) : null;
  var now = new Date();
  dpY = v ? v[0] : now.getFullYear();
  dpM = v ? v[1] : now.getMonth() + 1;
  dpD = v ? v[2] : now.getDate();
  var y0 = now.getFullYear() - 3, y1 = now.getFullYear() + 15;
  var mLo = 1, mHi = 12, pMin = null, pMax = null;
  if (dpMin) { pMin = dpMin.split('-').map(Number); y0 = Math.max(y0, pMin[0]); }
  if (dpMax) { pMax = dpMax.split('-').map(Number); y1 = Math.min(y1, pMax[0]); }
  if (y0 > y1) y0 = y1;
  if (pMin && pMin[0] === y0) mLo = pMin[1];
  if (pMax && pMax[0] === y1) mHi = pMax[1];
  dpY0 = y0; dpM0 = mLo;
  dpY = Math.min(y1, Math.max(y0, dpY));
  dpM = Math.min(mHi, Math.max(mLo, dpM));
  dpColBuild(q('#dpColY'), Array.from({ length: y1 - y0 + 1 }, function (_, i) { return y0 + i; }), dpY, 'y');
  dpColBuild(q('#dpColM'), Array.from({ length: mHi - mLo + 1 }, function (_, i) { return mLo + i; }), dpM, 'm');
  dpRefillDays();
  q('#dpPreview').textContent = dpY + '年' + dpM + '月' + dpD + '日';
  q('#dpColY').onscroll = function () { dpOnScroll(q('#dpColY'), 'y'); };
  q('#dpColM').onscroll = function () { dpOnScroll(q('#dpColM'), 'm'); };
  q('#dpColD').onscroll = function () { dpOnScroll(q('#dpColD'), 'd'); };
  dpBindPC(q('#dpColY'), 'y'); dpBindPC(q('#dpColM'), 'm'); dpBindPC(q('#dpColD'), 'd');
  ['dpColY', 'dpColM', 'dpColD'].forEach(function (id) { q('#' + id)._wIdx = null; });
  dpWheelAcc = 0;
  dpSyncManual();
  ['#dpInY', '#dpInM', '#dpInD'].forEach(function (sel) {
    var el = q(sel);
    if (el) {
      el.onkeydown = function (e) { if (e.key === 'Enter') dpManualApply(); };
      el.onchange = function () { dpManualApply(); };
    }
  });
  q('#dpMask').classList.add('show');
  dpInitLocating = true;
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      if (!dpInitLocating) return;
      dpInitLocating = false;
      try {
        q('#dpColY').scrollTop = (dpY - dpY0) * DP_ITEM; q('#dpColY')._wIdx = dpY - dpY0;
        q('#dpColM').scrollTop = (dpM - dpM0) * DP_ITEM; q('#dpColM')._wIdx = dpM - dpM0;
        q('#dpColD').scrollTop = (dpD - dpD0) * DP_ITEM; q('#dpColD')._wIdx = dpD - dpD0;
      } catch (e) {}
    });
  });
}
/* 把 input[type=date] 替换为主题化显示按钮（input 隐藏保留原位，value 劫持保证程序赋值也刷新显示） */
function convertDateInputs() {
  document.querySelectorAll('input[type="date"]').forEach(function (inp) {
    if (inp.dataset.dp === '1') return;
    inp.dataset.dp = '1';
    var box = document.createElement('div'); box.className = 'datebox';
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'datebox-btn';
    var cal = inp.closest && inp.closest('.timefield') ? '' : '<span class="cal">📅</span>'; // 胶囊已有图标时不重复
    btn.addEventListener('click', function () { openDatePicker(inp); });
    var sync = function () {
      var v = inp.value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        var p = v.split('-').map(Number);
        btn.innerHTML = cal + p[0] + '年' + p[1] + '月' + p[2] + '日';
        btn.classList.remove('placeholder');
      } else {
        btn.innerHTML = cal + '请选择日期';
        btn.classList.add('placeholder');
      }
    };
    inp.dpSync = sync;
    inp.addEventListener('change', sync);
    try {
      var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      Object.defineProperty(inp, 'value', {
        get: function () { return desc.get.call(this); },
        set: function (v2) { desc.set.call(this, v2); sync(); }
      });
    } catch (e) {}
    inp.parentNode.insertBefore(box, inp);
    box.appendChild(btn); box.appendChild(inp);
    inp.style.display = 'none';
    sync();
  });
}
convertDateInputs();
try {
  var dpMO = new MutationObserver(function () { convertDateInputs(); });
  dpMO.observe(document.body, { childList: true, subtree: true });
} catch (e) {}
q('#dpBtnOk').addEventListener('click', dpSet);
q('#dpBtnCancel').addEventListener('click', dpClose);
q('#dpBtnClear').addEventListener('click', dpClear);
q('#dpMask').addEventListener('click', function (e) { if (e.target === q('#dpMask')) dpClose(); });
document.addEventListener('mousemove', function (e) {
  if (!dpDrag) return;
  var dy = e.clientY - dpDrag.y;
  if (Math.abs(dy) > 2) dpDrag.moved = true;
  dpDrag.col.scrollTop = Math.max(0, dpDrag.st - dy);
});
document.addEventListener('mouseup', function () {
  if (!dpDrag) return;
  var col = dpDrag.col, kind = dpDrag.kind;
  dpDrag = null;
  col.classList.remove('nosnap');
  var i = dpColIdx(col);
  col.scrollTop = i * DP_ITEM;
  dpApplyIdx(col, kind, i);
});
