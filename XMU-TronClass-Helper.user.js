// ==UserScript==
// @name         XMU-TronClass-Helper
// @name:zh-CN   XMU 厦大畅课助手
// @namespace    https://github.com/Lormited/XMU-TronClass-Helper
// @version      0.6.3
// @author       Lormited
// @license      MIT
// @homepageURL  https://github.com/Lormited/XMU-TronClass-Helper
// @updateURL    https://raw.githubusercontent.com/Lormited/XMU-TronClass-Helper/main/XMU-TronClass-Helper.user.js
// @downloadURL  https://raw.githubusercontent.com/Lormited/XMU-TronClass-Helper/main/XMU-TronClass-Helper.user.js
// @description  XMU 厦大畅课助手：资料下载 / 首页优化（校徽首页跳转 · 链接增强 · 页面自适应 · 课程栏滑动 · 待办排序 · 签到列表替换）/ 界面精简 / 顶栏精简
// @match        https://lnt.xmu.edu.cn/*
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_getResourceText
// @grant        unsafeWindow
// @resource     xmuStyles https://raw.githubusercontent.com/Lormited/XMU-TronClass-Helper/main/XMU-TronClass-Helper.css?v=0.6.3
// @connect      c-media.xmu.edu.cn
// @run-at       document-end
// ==/UserScript==

(() => {
  'use strict';

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

  element('style', { id: 'xmu-styles', textContent: GM_getResourceText('xmuStyles') }, document.documentElement);

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

  // ─── 资料下载（课程页） ────────────────────────────────────────
  const DL_TYPES = ['document', 'file'];

  function saveFile(url, name) {
    return new Promise((resolve) => {
      try {
        GM_download({
          url, name, saveAs: false,
          onload: () => resolve(true),
          onerror: () => resolve(blobDownload(url, name)),
        });
      } catch (e) { resolve(blobDownload(url, name)); }
    });
  }

  async function blobDownload(url, name) {
    try {
      const blob = await (await fetch(url)).blob();
      const a = element('a', { href: URL.createObjectURL(blob), download: name }, document.documentElement);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      return true;
    } catch (e) { return false; }
  }

  modules.download = {
    name: '资料下载', desc: '课程页右下角一键下载本课资料',

    init() {
      if (!courseId()) return;
      this.fab = element('button', {
        className: 'xmu-fab', textContent: '资料下载', onclick: async () => {
          if (!this.panel) this.build();
          const open = this.panel.style.display !== 'block';
          this.panel.style.display = open ? 'block' : 'none';
          if (open && !this.files) await this.load();
        }
      }, document.documentElement);
    },

    destroy() {
      this.fab?.remove(); this.panel?.remove();
      this.fab = this.panel = this.files = null;
      this.running = false;
    },

    build() {
      const p = this.panel = element('div', {
        className: 'xmu-panel', innerHTML: `
        <div class="xmu-dl-hd"><span>资料下载</span><button class="xmu-dl-x">×</button></div>
        <div class="xmu-dl-bar"><label><input type="checkbox" class="xmu-dl-all"> 全选</label><span class="xmu-dl-count"></span></div>
        <div class="xmu-dl-list"></div>
        <div class="xmu-dl-ft"><button class="xmu-dl-go"></button></div>` }, document.documentElement);
      $('.xmu-dl-x', p).onclick = () => { p.style.display = 'none'; };
      $('.xmu-dl-all', p).onchange = (e) => { (this.files || []).forEach((f) => { f.checked = e.target.checked; }); this.render(); };
      $('.xmu-dl-go', p).onclick = () => this.run();
    },

    async load() {
      const btn = $('.xmu-dl-go', this.panel);
      btn.textContent = '加载中…'; btn.disabled = true;
      this.files = [];
      const j = await api(`/api/courses/${courseId()}/activities?sub_course_id=0`).catch(() => ({}));
      const uniq = new Map();                       // 同一个附件可能挂在多个活动下
      (j.activities || []).forEach((a) => (a.uploads || []).forEach((u) => {
        if (u.id && !u.deleted && DL_TYPES.includes(u.type)) uniq.set(u.id, u);
      }));
      this.files = [...uniq.values()].map((u) => ({ id: u.id, name: u.name || `document-${u.id}`, size: u.size, checked: false }));

      if (!this.files.length) {
        $('.xmu-dl-list', this.panel).innerHTML = '<div class="xmu-dl-empty">没有可下载的资料</div>';
        $('.xmu-dl-count', this.panel).textContent = '';
        btn.textContent = '无资料';
        return;
      }
      this.render();
    },

    render() {
      if (!this.panel) return;
      const files = this.files || [];
      const checked = files.filter((f) => f.checked).length;
      const btn = $('.xmu-dl-go', this.panel);
      $('.xmu-dl-count', this.panel).textContent = `共 ${files.length} 个`;
      btn.textContent = this.running ? '下载中…'
        : checked === files.length ? `全部下载（${files.length}）` : `下载选中（${checked}）`;
      btn.disabled = this.running || !checked;

      const list = $('.xmu-dl-list', this.panel);
      list.innerHTML = '';
      files.forEach((f) => {
        const row = element('div', { className: 'xmu-dl-row', innerHTML: `<input type="checkbox"${f.checked ? ' checked' : ''}><span class="xmu-dl-nm"></span><span class="xmu-dl-sz"></span>` }, list);
        const nm = $('.xmu-dl-nm', row);
        nm.textContent = f.name;
        nm.title = f.name;
        $('.xmu-dl-sz', row).textContent = f.size ? (f.size / 1048576).toFixed(1) + ' MB' : '';
        $('input', row).onchange = (e) => { f.checked = e.target.checked; this.render(); };
      });
    },

    async run() {
      const targets = (this.files || []).filter((f) => f.checked);
      if (!targets.length || this.running) return;
      this.running = true;
      const btn = $('.xmu-dl-go', this.panel);
      let ok = 0, fail = 0;
      for (const [i, f] of targets.entries()) {
        btn.textContent = `下载中 ${i + 1}/${targets.length}`;
        const url = await api(`/api/uploads/${f.id}/download-url-for-ai`).then((r) => r.url).catch(() => null);
        if (url && await saveFile(url, cleanName(f.name))) ok++; else fail++;
        await sleep(400);                       // 别把请求打太密
      }
      this.running = false;
      this.render();
      btn.textContent = `完成：成功 ${ok}${fail ? '，失败 ' + fail : ''}`;
      setTimeout(() => this.render(), 5000);
    },
  };

  // ─── 首页优化 ──────────────────
  const HOME_FEATS = ['homelogo', 'links', 'fit', 'coursebar', 'todo', 'signin'];

  // 按配置同步一个子功能；状态没变就不动它
  function syncFeat(sub) {
    const on = !!store.get(featKey(sub));
    if (on === !!sub.on) return;
    sub.on = on;
    if (on) sub.init(); else sub.destroy();
  }

  modules.home = {
    name: '首页优化', desc: '首页的校徽 / 缩放 / 课程栏 / 待办 / 签到，逐项开关',

    tags: () => HOME_FEATS.map((id) => [featKey(modules[id]), modules[id].name]),

    init() { this.apply(); },
    apply() { HOME_FEATS.forEach((id) => syncFeat(modules[id])); },
    destroy() {
      HOME_FEATS.forEach((id) => {
        const sub = modules[id];
        if (sub.on) sub.destroy();
        sub.on = false;
      });
    },
  };

  // ─── 签到列表替换（首页「常用入口」） ─────────────────────────────────
  const ROLLCALL_TYPE = {
    number: '数字点名', qr: '二维码点名', manual: '手动点名',
    radar: '雷达点名', selfRegistration: '自主签到', roomis: 'ROOMIS',
  };
  const LIST_URL = 'https://c-mobile.xmu.edu.cn/ongoing-rollcall-list';

  // 已签到看 status；student_status 即使已签也仍是 on_call，不能用
  const isSigned = (r) => /fine|late|present|signed/.test(String(r.status || ''));

  function rollcallType(r) {
    if (r.is_number) return '数字点名';
    if (r.is_radar) return '雷达点名';
    return ROLLCALL_TYPE[String(r.source || r.type || '').replace(/_rollcall$/, '')] || '点名';
  }

  function rollcallUrl(r) {
    if (r.is_number && r.course_id && r.rollcall_id)
      return `https://c-mobile.xmu.edu.cn/course/${r.course_id}/number-rollcall/${r.rollcall_id}/answer`;
    return LIST_URL;
  }

  modules.signin = {
    name: '签到列表替换', desc: '把首页「常用入口」换成「正在签到」', sub: true,

    init() {
      if (!isHome()) return;
      this.load();                     // 打开页面取一次，之后靠卡片右上角的刷新按钮
      let tries = 0;                   // 卡片是 SPA 后渲染的：短轮询等它出现（只查 DOM，不发请求）
      this.retry = setInterval(() => {
        this.mount();
        if (this.card || ++tries > 10) clearInterval(this.retry);
      }, 400);
    },

    destroy() {
      clearInterval(this.retry);
      if (this.card && typeof this.orig === 'string') {   // 留底可能是 undefined，不能直接写回
        this.card.innerHTML = this.orig;
        delete this.card.dataset.xmuSignin;
      }
      this.card = this.orig = this.btn = null;
    },

    // 把首页卡片改造成「正在签到」（只接管一次）
    mount() {
      if (!isHome()) return;
      const card = $$('.frequent-entries').find((c) => $('.frequent-entry-header', c) && $('.frequent-entry-list-wrapper', c));
      if (!card) return;
      if (this.card === card && card.dataset.xmuSignin) return;

      if (!card.dataset.xmuSignin) this.orig = card.innerHTML;   // 只在没被改造过时留底
      this.card = card;
      card.dataset.xmuSignin = '1';
      const head = $('.frequent-entry-header', card);
      $('.title', head).textContent = '正在签到';
      const opts = $('.options', head) || element('div', { className: 'options' }, head);
      opts.innerHTML = '<i class="xmu-sc-refresh" title="刷新"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 4 21 10 15 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L21 10"/></svg></i>';
      this.btn = $('.xmu-sc-refresh', opts);
      this.btn.onclick = () => this.refresh();
      $('.frequent-entry-list-wrapper', card).innerHTML = '<div class="xmu-sc-body"></div>';
      this.render();
    },

    // 手动刷新签到状态与条目
    async refresh() {
      this.mount();
      this.btn?.classList.add('loading');
      await this.load();
      this.btn?.classList.remove('loading');
    },

    async load() {
      const next = await api('/api/radar/rollcalls?api_version=1.1.0').then((j) => j.rollcalls || []).catch(() => null);
      if (!next) return;
      const sig = JSON.stringify(next);
      if (sig === this.sig) return;
      this.sig = sig;
      this.data = next;
      this.render();
    },

    render() {
      const body = this.card && $('.xmu-sc-body', this.card);
      if (!body) return;
      const data = this.data || [];
      if (!data.length) { body.innerHTML = '<div class="xmu-sc-empty">当前没有正在进行的签到</div>'; return; }

      body.innerHTML = '';
      data.forEach((r) => {
        const course = r.course_title || '课程';
        const signed = isSigned(r);

        const item = element(signed ? 'div' : 'a', { className: 'xmu-sc-item', innerHTML: `<div class="xmu-sc-main"><div class="xmu-sc-course"></div><div class="xmu-sc-meta"></div></div><span class="xmu-sc-go"></span>` });
        $('.xmu-sc-course', item).textContent = course;
        $('.xmu-sc-meta', item).textContent = rollcallType(r);

        const go = $('.xmu-sc-go', item);
        go.className = 'xmu-sc-go' + (signed ? ' done' : '');
        go.innerHTML = `<i class="font ${signed ? 'font-rollcall-finish' : 'font-goto'}"></i>`;
        if (signed) item.style.cursor = 'default';
        else { item.href = rollcallUrl(r); item.target = '_blank'; item.rel = 'noopener'; }

        body.appendChild(item);
      });
    },
  };

  // ─── 界面精简 ─────────────────────────────────────────────
  // [配置键, 标签名, 选择器]
  const CHROME_HIDE = [
    ['chrome_sidebar', '侧栏', 'aside.new-user-index-sidebar, .course-menu-container'],
    ['chrome_footer', '底栏', '.footer'],
    ['chrome_ai', 'AI 助手', 'air-chatbot-app'],
  ];

  modules.chrome = {
    name: '界面精简', desc: '隐藏侧栏 / 底栏 / AI 助手',

    tags: () => CHROME_HIDE.map(([k, l]) => [k, l]),

    init() {
      poll(this, this.apply);
    },

    destroy() {
      clearInterval(this.timer);
      $$('[data-xmu-hidden]').forEach((el) => { el.style.display = ''; delete el.dataset.xmuHidden; });
    },

    apply() {
      CHROME_HIDE.forEach(([key, , sel]) => {
        const hide = !!store.get(key);
        $$(sel).forEach((el) => {
          if (hide) {
            // 站点本来就藏着的元素不打标记，否则关功能时会被我们弄出来
            if (el.style.display !== 'none') { el.dataset.xmuHidden = '1'; el.style.display = 'none'; }
          } else if (el.dataset.xmuHidden) {
            el.style.display = ''; delete el.dataset.xmuHidden;
          }
        });
      });
    },
  };

  // ─── 顶栏精简（按「入口」聚合，逐项开关） ───────────────────────────────
  const TOPBAR_ROOT = '.header';
  const TOPBAR_ATOM = /^(IMG|SVG|USE|PATH|CANVAS|VIDEO|IFRAME|INPUT|TEXTAREA|SELECT)$/;   // 本身即整体，不再拆
  const TOPBAR_SKIP = /(^|\s)(autocollapse-more|autocollapse-container|dropdown-list)(\s|$)/;   // 折叠菜单入口
  const TOPBAR_RULE = 'header-vertical-split-line';   // 分隔栏：自身就是一个开关
  const TOPBAR_SPLIT = 'logo-padding';                // 拆成「校徽 / 课程中心」两个开关
  const TOPBAR_BADGE = '.count-wrapper, .count, .badge, .num, .unread';   // 角标数字不算名字
  const TOPBAR_NAMES = {                              // class / 图标名 → 看得懂的名字
    'application-center': '应用中心', 'school-name': '课程中心', logo: '校徽',
    'public-course': 'AI课程', 'text-title': '日历', notifications: '通知',
    manual: '帮助', 'profile-item': '账号信息', 'header-vertical-split-line': '分隔栏',
    'font-header-calendar': '日历', 'font-header-help': '帮助', 'font-notification': '通知',
  };

  // 已隐藏的仍算「在场」
  function topbarVisible(el) {
    if (el.hasAttribute('data-xmu-topbar')) return true;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // 取文字，去掉角标数字
  function topbarText(el) {
    if (!el.querySelector(TOPBAR_BADGE)) return (el.textContent || '').trim().replace(/\s+/g, ' ');
    const c = el.cloneNode(true);
    c.querySelectorAll(TOPBAR_BADGE).forEach((n) => n.remove());
    return (c.textContent || '').trim().replace(/\s+/g, ' ');
  }

  // 名字优先级：title/aria > 自身 class > 图标名 > 文字 > 祖先 class
  function topbarName(el) {
    const classesOf = (n) => String(n.getAttribute('class') || '').split(/\s+/);
    const nameOf = (n) => { const c = n && classesOf(n).find((x) => TOPBAR_NAMES[x]); return c && TOPBAR_NAMES[c]; };
    const name = (el.getAttribute('title') || el.getAttribute('aria-label') || '').trim()
      || nameOf(el) || nameOf($('i[class], img, svg use', el)) || topbarText(el);
    if (name) return name.slice(0, 12);
    for (let node = el.parentElement, depth = 0; node && depth < 4; node = node.parentElement, depth++) {
      const hit = nameOf(node);
      if (hit) return hit;
    }
    const cls = classesOf(el).find((c) => c && !/^(ng-|xmu-)/.test(c));
    return (cls || el.tagName.toLowerCase()).slice(0, 12);
  }

  // 配置键用结构签名，不用数组下标
  function topbarSig(el) {
    const parts = [];
    for (let node = el, depth = 0; node && depth < 4; node = node.parentElement, depth++) {
      const cls = String(node.getAttribute('class') || '').trim().split(/\s+/)
        .filter((c) => c && !/^ng-/.test(c)).sort().slice(0, 3).join('.');
      parts.push(node.tagName + (cls ? '.' + cls : ''));
    }
    return (parts.join('>') + '@' + topbarText(el).replace(/\s+/g, '').slice(0, 10))
      .replace(/[^A-Za-z0-9.@>_-]/g, '');
  }

  // 收掉因隐藏而缩成 0 宽、却还占着 margin 的空壳父级
  function topbarTidy(el) {
    const bar = $(TOPBAR_ROOT);
    for (let node = el.parentElement, depth = 0; node && node !== bar && depth < 5; node = node.parentElement, depth++) {
      if (node.getBoundingClientRect().width > 0) break;
      node.setAttribute('data-xmu-shell', '1');
      node.style.display = 'none';
    }
  }

  modules.topbar = {
    name: '顶栏精简', desc: '选择隐藏顶栏上的元素',

    init() {
      poll(this, this.apply);
    },

    destroy() {
      clearInterval(this.timer);
      $$('[data-xmu-topbar],[data-xmu-shell]').forEach((el) => {
        el.style.display = '';
        el.removeAttribute('data-xmu-topbar');
        el.removeAttribute('data-xmu-shell');
      });
    },

    // 开关整份存成一个 JSON，免得几十个散落的键
    conf() {
      try { return JSON.parse(store.get('topbar_hide') || '{}') || {}; } catch (e) { return {}; }
    },
    tagOn(key) { return !!this.conf()[key]; },
    tagToggle(key) {
      const c = this.conf();
      if (c[key]) delete c[key]; else c[key] = 1;
      store.set('topbar_hide', JSON.stringify(c));
    },

    // 按「入口」聚合：<a> 整体一个开关就不再下钻，纯装饰图标不会单独成项
    units() {
      const bar = $(TOPBAR_ROOT);
      if (!bar) return [];
      const out = [];

      const walk = (el) => {
        const cls = String(el.getAttribute('class') || '');

        if (el.hasAttribute('data-xmu-topbar')) { out.push(el); return; }   // 已关掉的常驻列表
        if (TOPBAR_SKIP.test(cls)) return;
        if (!cls.includes(TOPBAR_RULE) && cls.includes(TOPBAR_SPLIT)) {
          out.push(...[...el.children].filter(topbarVisible));
          return;
        }
        const kids = [...el.children].filter((k) => !/^(SCRIPT|STYLE|TEMPLATE)$/.test(k.tagName));
        const entry = cls.includes(TOPBAR_RULE) || el.tagName === 'A' || el.getAttribute('role') === 'button';
        if (!entry && kids.length) kids.forEach(walk);
        else if (topbarVisible(el) && (entry || topbarText(el) || TOPBAR_ATOM.test(el.tagName))) out.push(el);
      };
      [...bar.children].forEach(walk);

      const keySeq = {};
      const list = out.map((el) => {
        const base = topbarSig(el);
        keySeq[base] = (keySeq[base] || 0) + 1;
        return { el, key: base + (keySeq[base] > 1 ? '#' + keySeq[base] : ''), name: topbarName(el) };
      });

      // 重名的（两条分隔栏）加序号
      const total = {};
      list.forEach((u) => { total[u.name] = (total[u.name] || 0) + 1; });
      const seq = {};
      list.forEach((u) => {
        if (total[u.name] > 1) u.name += ' ' + (seq[u.name] = (seq[u.name] || 0) + 1);
      });
      return list;
    },

    tags() { return this.units().map((u) => [u.key, u.name]); },

    apply() {
      // 先放开上一轮收掉的空壳，再重新判断
      $$('[data-xmu-shell]').forEach((n) => { n.style.display = ''; n.removeAttribute('data-xmu-shell'); });
      const hide = this.conf();
      this.units().forEach((u) => {
        if (hide[u.key]) {
          u.el.setAttribute('data-xmu-topbar', '1');
          u.el.style.display = 'none';
          topbarTidy(u.el);
        } else if (u.el.hasAttribute('data-xmu-topbar')) {
          u.el.style.display = '';
          u.el.removeAttribute('data-xmu-topbar');
        }
      });
    },
  };

  // ─── 链接增强 ──────────────────────────────────────────────
  const HOME_URL = 'https://lnt.xmu.edu.cn/user/index#/';

  modules.links = {
    name: '链接增强', desc: '首页链接支持右键、中键和组合键打开', sub: true,

    init() {
      if (!isHome()) return;
      this.onClick = (event) => {
        if (!isHome()) return;
        const link = event.target.closest?.('a[href]');
        if (!link || !link.matches('.xmu-home-link, .todo-link') || !link.closest('main.isStudent')) return;
        event.stopImmediatePropagation();
      };
      document.addEventListener('click', this.onClick, true);
      document.addEventListener('auxclick', this.onClick, true);
      poll(this, this.bind);
    },

    bind() {
      if (!isHome()) return;
      const pageDocument = typeof unsafeWindow === 'undefined' ? document : unsafeWindow.document;
      let root = pageDocument.querySelector('.courses-container');
      while (root && !root.__vue__) root = root.parentElement;
      const courses = root?.__vue__?.courses || [];
      const targets = [];
      $$('.course-card').forEach((card, index) => {
        const course = courses[index];
        if (!course?.url) return;
        targets.push([card, course.url, '_self']);
      });
      $$('.todo-item').forEach((item) => {
        const source = $('.todo-link[href]', item);
        if (source) targets.push([item, source.href, source.target || '_self']);
      });
      targets.forEach(([item, href, target]) => {
        if (item.closest('a')) return;
        if (typeof href !== 'string' || href.includes('{{') || !URL.canParse(href, location.href)) return;
        const url = new URL(href, location.href);
        if (!/^https?:$/.test(url.protocol)) return;
        let link = $(':scope > .xmu-home-link', item);
        if (!link) {
          link = element('a', { className: 'xmu-home-link', rel: 'noopener' }, item);
        }
        const label = item.textContent.trim() || '打开链接';
        if (link.href !== url.href) link.href = url.href;
        if (link.target !== target) link.target = target;
        if (link.getAttribute('aria-label') !== label) link.setAttribute('aria-label', label);
      });
    },

    destroy() {
      clearInterval(this.timer);
      document.removeEventListener('click', this.onClick, true);
      document.removeEventListener('auxclick', this.onClick, true);
      $$('.xmu-home-link').forEach((link) => link.remove());
    },
  };

  modules.homelogo = {
    name: '校徽首页跳转', desc: '点左上角校徽回首页，不跳数字化教学平台', sub: true,

    init() {
      poll(this, this.bind);
    },

    destroy() {
      clearInterval(this.timer);
      $$('.header .logo-padding[data-xmu-logo]').forEach((a) => {
        a.setAttribute('href', a.dataset.xmuLogo);
        delete a.dataset.xmuLogo;
      });
    },

    bind() {
      $$('.header .logo-padding').forEach((a) => {
        if (a.getAttribute('href') === HOME_URL) return;
        a.dataset.xmuLogo = a.getAttribute('href') || '';   // 留一份原地址，供关闭时还原
        a.setAttribute('href', HOME_URL);
      });
    },
  };

  // ─── 页面自适应（整页缩放，仅首页） ─────────────────────────────────────
  modules.fit = {
    name: '页面自适应', desc: '按屏幕比例整体缩放首页，一屏显示更多', sub: true,

    init() {
      poll(this, this.apply);
    },

    destroy() {
      clearInterval(this.timer);
      document.documentElement.classList.remove('xmu-fit-on');
      this.reset();
    },

    reset() {
      const clear = (el, props) => props.forEach((p) => el?.style.removeProperty(p));
      clear(document.body, ['zoom']);
      clear($('.main-content'), ['width', 'height']);
    },

    apply() {
      const home = isHome();
      document.documentElement.classList.toggle('xmu-fit-on', home);
      if (!home) return this.reset();                 // 非首页还原
      document.body.style.zoom = FIT_SCALE;

      // 画布尺寸显式给足（视口 ÷ 缩放）；用 clientWidth/Height，不含滚动条，否则会出现滚动条反馈循环
      const mc = $('.main-content');
      if (!mc) return;
      const vp = document.documentElement;
      Object.assign(mc.style, {
        width: vp.clientWidth / FIT_SCALE + 'px',
        height: vp.clientHeight / FIT_SCALE - ($('.header')?.offsetHeight || 0) + 'px',
      });
    },
  };

  // ─── 课程栏滑动 ────────────────────────────────────────────
  modules.coursebar = {
    name: '课程栏滑动', desc: '课程栏支持滚轮横向滑动，并优化翻页效果', sub: true,

    init() {
      if (!isHome()) return;
      poll(this, this.bind);
    },

    destroy() {
      clearInterval(this.timer);
      document.removeEventListener('click', this.onArrow, true);
      this.c?.removeEventListener('wheel', this.onWheel);
      this.c?.removeEventListener('scroll', this.onScroll);
      this.c = this.wheelTo = this.onArrow = this.onWheel = this.onScroll = null;   // 清干净，否则重开时守卫不成立
    },

    // 用委托在捕获阶段接管左右箭头
    bind() {
      const c = $('.courses-container');
      if (!c) return;
      this.c = c;

      if (!this.onArrow) {
        this.onArrow = (e) => {
          const arrow = e.target instanceof Element && e.target.closest('.nav-arrow');
          if (!arrow || !this.c) return;
          e.stopImmediatePropagation(); e.preventDefault();
          const dir = arrow.classList.contains('right') ? 1 : -1;
          this.animate(this.c.scrollLeft + dir * this.c.clientWidth * COURSE_STEP);
        };
        document.addEventListener('click', this.onArrow, true);

        this.onWheel = (e) => {
          if (!this.c || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
          e.preventDefault();
          this.wheelTo = clamp((this.wheelTo ?? this.c.scrollLeft) + e.deltaY * WHEEL_STEP, 0, this.max());
          this.animate(this.wheelTo);
        };
        c.addEventListener('wheel', this.onWheel, { passive: false });

        // 滚动时同步箭头状态
        this.onScroll = () => this.syncArrows();
        c.addEventListener('scroll', this.onScroll, { passive: true });
      }
      this.syncArrows();
    },

    max() { return this.c ? this.c.scrollWidth - this.c.clientWidth : 0; },

    animate(target) { smoothScroll(this.c, clamp(target, 0, this.max())); },

    syncArrows() {
      if (!this.c) return;
      $('.nav-arrow.left')?.classList.toggle('disabled', this.c.scrollLeft <= 2);
      $('.nav-arrow.right')?.classList.toggle('disabled', this.c.scrollLeft >= this.max() - 2);
    },
  };

  // ─── 待办排序 ──────────────────────────────────────────
  // 首页待办按截止时间升序排
  const DUE_RE = /(\d{4})\.(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{2})/;

  function todoDue(item) {
    const m = ($('.todo-datetime', item)?.textContent || '').match(DUE_RE);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : Infinity;
  }

  modules.todo = {
    name: '待办排序', desc: '首页待办按截止时间升序排列', sub: true,

    init() {
      if (!isHome()) return;
      poll(this, this.sort);
    },

    destroy() { clearInterval(this.timer); },

    sort() {
      const box = $('.todo-list-container');
      if (!box) return;
      const items = $$('.todo-item', box);
      if (items.length < 2) return;

      const sorted = items.map((item) => ({ item, due: todoDue(item) }))
        .sort((a, b) => a.due - b.due).map(({ item }) => item);
      if (items.some((item, index) => item !== sorted[index])) box.append(...sorted);
    },
  };

  // ─── 设置面板 ────────────────────────────────────────────────
  const MODULES = Object.values(modules).filter((m) => !m.sub);   // 子功能由「首页优化」的标签驱动

  const settings = {
    init() {
      const btn = this.btn = element('button', { className: 'xmu-set-btn', title: 'XMU 厦大畅课助手' }, document.documentElement);
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
      btn.onclick = () => this.toggle();
      poll(this, this.position);
      window.addEventListener('resize', () => this.position());
      window.addEventListener('scroll', () => this.position(), true);

      // 点击面板外部关闭
      document.addEventListener('click', (e) => {
        if (!this.open) return;
        if (this.panel?.contains(e.target) || this.btn?.contains(e.target)) return;
        this.toggle();
      }, true);
    },

    toggle() {
      if (!this.panel) this.build();
      this.open = !this.open;
      this.panel.style.display = this.open ? 'block' : 'none';
      if (this.open) { this.refresh(); this.position(); }
    },

    position() {
      const scale = parseFloat(getComputedStyle(document.body).zoom) || 1;
      const headerBottom = clamp(($('.header')?.getBoundingClientRect().bottom || 0) * scale, 0, innerHeight);
      const center = (headerBottom + innerHeight) / 2;
      this.btn.style.top = center + 'px';
      if (!this.open) return;
      this.panel.style.top = center + 'px';
      this.panel.style.maxHeight = Math.max(0, innerHeight - headerBottom - 24) + 'px';
    },

    build() {
      const p = this.panel = element('div', {
        className: 'xmu-set-panel', innerHTML: `
        <div class="xmu-set-hd"><b>XMU 厦大畅课助手</b><button class="xmu-set-x">×</button></div>
        <div class="xmu-set-body"></div>
        <div class="xmu-set-ft"><a href="${REPO}" target="_blank" rel="noopener">v${VERSION}</a></div>`
      }, document.documentElement);
      $('.xmu-set-x', p).onclick = () => this.toggle();
    },

    refresh() {
      const body = $('.xmu-set-body', this.panel);
      body.innerHTML = '';
      MODULES.forEach((m) => {
        const on = !!store.get(featKey(m));
        const row = element('div', { className: 'xmu-set-item', innerHTML: `<div><div class="xmu-set-nm">${m.name}</div><div class="xmu-set-ds">${m.desc}</div></div><div class="xmu-sw${on ? ' on' : ''}"></div>` }, body);
        $('.xmu-sw', row).onclick = (e) => {
          e.stopPropagation();
          store.set(featKey(m), !on);
          on ? m.destroy?.() : m.init?.();
          this.refresh();
        };
        const tags = on && m.tags?.();
        if (tags?.length) body.appendChild(this.buildTags(m, tags));
      });
    },

    // 子选项读写：模块可自定义，否则用扁平键
    tagOn(m, key) { return m.tagOn ? m.tagOn(key) : !!store.get(key); },
    tagToggle(m, key) { m.tagToggle ? m.tagToggle(key) : store.set(key, !store.get(key)); },

    // 模块下方的小标签，排不下自动换行
    buildTags(m, tags) {
      const wrap = element('div', { className: 'xmu-set-tags' });
      tags.forEach(([key, label]) => {
        const tag = element('span', { className: 'xmu-tag' + (this.tagOn(m, key) ? ' on' : ''), textContent: label }, wrap);
        tag.onclick = () => { this.tagToggle(m, key); m.apply?.(); this.refresh(); };
      });
      return wrap;
    },
  };

  function showUpdate() {
    if (!VERSION || store.get('seen_version') === VERSION) return;
    const notice = element('section', { className: 'xmu-update' });
    notice.setAttribute('role', 'status');
    notice.innerHTML = `<header><strong></strong><button type="button" aria-label="关闭通知">×</button></header><p>样式改为本地缓存加载，精简代码，保留现有功能与样式。</p><a href="${REPO}#更新日志" target="_blank" rel="noopener">查看更新日志</a>`;
    $('strong', notice).textContent = `畅课助手已更新至 v${VERSION}`;
    $('button', notice).onclick = () => notice.remove();
    document.documentElement.appendChild(notice);
    store.set('seen_version', VERSION);
  }

  // ─── 启动 ──────────────────────────────────────────────────
  // 模块 id 取登记时的键
  // 先把 id 发完再启用：首页优化依赖子模块的 id 拼配置键
  Object.entries(modules).forEach(([id, m]) => { m.id = id; });
  MODULES.forEach((m) => { if (store.get(featKey(m))) m.init(); });
  settings.init();
  showUpdate();
})();
