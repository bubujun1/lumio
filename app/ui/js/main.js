/* ============================================================
   Lumio · main.js —— 装配与启动：注入页面渲染器 → 初始化启动页 → boot → startPoll
   分层：L5 入口　　依赖：core / icons / theme / render / datepicker / pages-admin / pages-kid / boot / handlers / poll
   ============================================================ */
import { q } from './core.js';
import { heroSvg } from './icons.js';
import { applyTheme, themeNow } from './theme.js';
import { setPageRenderers } from './render.js';
import './datepicker.js';
import { adminHome, adminMessages, adminTasks, adminShop } from './pages-admin.js';
import { kidTasks, kidMessages, kidRedeem, kidMine } from './pages-kid.js';
import { boot } from './boot.js';
import './handlers.js';
import { startPoll } from './poll.js';

/* 装配：把两端页面渲染器注入渲染框架。必须早于 boot()——paint 首次调用即需命中注册表。 */
setPageRenderers('admin', { home: adminHome, messages: adminMessages, tasks: adminTasks, shop: adminShop });
setPageRenderers('kid', { tasks: kidTasks, messages: kidMessages, redeem: kidRedeem, mine: kidMine });

q('#bootHero').innerHTML = heroSvg({ k: 'boot', mood: 'hi' });

applyTheme(themeNow());
boot();
startPoll();
