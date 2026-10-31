  const COURSE_STEP = 0.97;   // 课程栏每次翻页的比例，1 = 正好一屏
  const COURSE_DUR = 280;     // 课程栏翻页动画时长(ms)
  const WHEEL_STEP = 1.6;     // 课程栏滚轮灵敏度
  const FIT_SCALE = 0.85;     // 页面自适应：整页缩放到窗口的 85%
  const POLL = 1300;          // 轮询间隔(ms)

  // ─── 基础 ──────────────────────────────────────────────────
  const DEFAULTS = {
    feat_download: true, feat_home: true, feat_chrome: true,
    feat_topbar: false, feat_signin: false, feat_homelogo: false, feat_fit: false, feat_coursebar: false,
    feat_todo: true, feat_links: true,
    chrome_sidebar: true, chrome_footer: true, chrome_ai: true,
  };

  // 配置读写：GM → localStorage → 默认值
  const store = {
    get(k) {
      try { const v = GM_getValue('xmu_' + k, undefined); if (v !== undefined) return v; } catch (e) { }
      try { const v = localStorage.getItem('xmu_' + k); if (v !== null) return JSON.parse(v); } catch (e) { }
      return DEFAULTS[k];
    },
    set(k, v) {
      try { return GM_setValue('xmu_' + k, v); } catch (e) { }
      try { localStorage.setItem('xmu_' + k, JSON.stringify(v)); } catch (e) { }
    },
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const element = (tag, props, parent) => {
    const node = Object.assign(document.createElement(tag), props);
    parent?.appendChild(node);
    return node;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const isHome = () => location.pathname.startsWith('/user/index');
  const courseId = () => (location.pathname.match(/\/course\/(\d+)/) || [])[1] || null;
  const cleanName = (n) => String(n || 'document').replace(/[\\/:*?"<>|\r\n\t]/g, '_').replace(/\s+/g, ' ').slice(0, 180);
  const api = async (path) => (await fetch(path, { credentials: 'include' })).json();

  const REPO = 'https://github.com/Lormited/XMU-TronClass-Helper';
  const VERSION = typeof GM_info === 'undefined' ? '' : GM_info.script.version;   // 取自头部 @version

  element('style', { id: 'xmu-styles', textContent: STYLES }, document.documentElement);

  // 轮询：立即跑一次，随后按 POLL 重复
  const poll = (m, fn) => {
    clearInterval(m.timer);
    const run = fn.bind(m);
    run();
    m.timer = setInterval(run, POLL);
  };

  // 平滑滚动：即时启动，末尾自然收住
  function smoothScroll(c, target, dur = COURSE_DUR) {
    const start = c.scrollLeft, dist = target - start, t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      c.scrollLeft = start + dist * (1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // 模块登记表：id 取这里的键
  const modules = {};
  const featKey = (m) => 'feat_' + m.id;
