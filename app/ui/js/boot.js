/* ============================================================
   Lumio · boot.js —— 启动与刷新：boot 拉取身份与状态 / refresh 静默刷新 / 未绑定引导页
   分层：L4 交互　　依赖：core / icons / api / feedback / state / render
   ============================================================ */
import { q, h } from './core.js';
import { heroSvg } from './icons.js';
import { apiGet } from './api.js';
import { toast } from './feedback.js';
import { S } from './state.js';
import { paint } from './render.js';

/* ============================================================
   启动
   ============================================================ */
function bootFail(title, msg, extraHtml) {
  q('#boot').classList.add('hidden');
  var app = q('#app'); app.classList.remove('hidden');
  app.innerHTML = '<div class="boot"><div class="lumio-mascot" style="width:150px">' + heroSvg({ k: 'fb', mood: 'sad' }) + '</div>' +
    '<h2>' + h(title) + '</h2><p>' + h(msg) + '</p>' + (extraHtml || '') +
    '<button class="btn ghost" style="margin-top:6px" data-act="reload">重新加载</button></div>';
}

export function boot() {
  apiGet('/api/identity').then(function (res) {
    if (!res || !res.ok) { bootFail('暂时连不上Lumio', (res && res.error) || '请稍后再试', ''); return; }
    if (res.role === 'noauth') {
      bootFail('请从飞牛桌面打开', '本应用需要飞牛账号身份。请在飞牛桌面点击「Lumio」图标打开；如果你是从浏览器直接访问的，请在飞牛桌面里重新进入。', '');
      return;
    }
    if (res.role === 'unbound') { return renderUnbound(res); }
    return refresh(true);
  });
}

function renderUnbound(res) {
  q('#boot').classList.add('hidden');
  var app = q('#app'); app.classList.remove('hidden');
  app.innerHTML =
    '<div class="boot">' +
    '<div class="lumio-mascot anim-float" style="width:180px">' + heroSvg({ k: 'ub', mood: 'think' }) + '</div>' +
    '<h2>你好，' + h(res.me ? res.me.username : '') + '！</h2>' +
    '<p>你的飞牛账号还没有被家长绑定到Lumio，<br>所以暂时看不到内容。</p>' +
    '<div class="ub-box">' +
    '<div class="tiny muted center" style="margin-bottom:8px">把下面这个用户名告诉家长，让家长在「设置与管理」里绑定你 👇</div>' +
    '<div class="copybox" data-act="copy" data-text="' + h(res.me ? res.me.username : '') + '">' + h(res.me ? res.me.username : '') + ' 📋</div>' +
    '<div class="kv" style="margin-top:10px"><div class="k">飞牛用户 UID</div><div class="v">' + h(res.me ? res.me.uid : '') + '</div></div>' +
    '<div class="kv"><div class="k">身份说明</div><div class="v">已通过飞牛账号登录</div></div>' +
    '</div>' +
    '<button class="btn ghost" data-act="reload">我绑好了，刷新看看</button>' +
    '<p class="tiny" style="max-width:400px">家长的操作路径：打开「Lumio」→ 右上角 ⚙️「设置与管理」→ 孩子与身份 → 新建孩子 / 绑定飞牛账号 → 选择你的用户名。</p>' +
    '</div>';
}

export function refresh(silent) {
  return apiGet('/api/state').then(function (res) {
    try {
      if (!res || !res.ok) {
        if (!silent) toast((res && res.error) || '刷新失败', 'err');
        return;
      }
      var prev = S.state;
      S.state = res.state;
      var boot = q('#boot'); if (!boot || !q('#app')) return; // 页面已被关闭/替换，忽略迟到响应
      boot.classList.add('hidden');
      var app = q('#app'); app.classList.remove('hidden');
      if (!S.tab) S.tab = 'home';
      paint(prev, silent);
    } catch (e) { /* 页面关闭等场景下的迟到回调，忽略 */ }
  }).catch(function () { /* 网络失败或页面已关闭 */ });
}
