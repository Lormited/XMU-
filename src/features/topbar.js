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
      const targets = u.el.matches('.application-center') ? [u.el, ...$$('#wg-apps-panel')] : [u.el];
      targets.forEach((el) => {
        if (hide[u.key]) {
          el.setAttribute('data-xmu-topbar', '1');
          el.style.display = 'none';
          topbarTidy(el);
        } else if (el.hasAttribute('data-xmu-topbar')) {
          el.style.display = '';
          el.removeAttribute('data-xmu-topbar');
        }
      });
    });
  },
};
