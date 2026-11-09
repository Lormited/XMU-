// ─── 界面精简 ─────────────────────────────────────────────
// [配置键, 标签名, 选择器]
const CHROME_HIDE = [
  ['chrome_sidebar', '侧栏', 'aside.new-user-index-sidebar'],
  ['chrome_course_sidebar', '课程菜单', '.course-menu-container'],
  ['chrome_footer', '底栏', '.footer'],
  ['chrome_ai', 'AI 助手', 'air-chatbot-app'],
];

modules.chrome = {
  name: '界面精简', desc: '隐藏侧栏 / 课程菜单 / 底栏 / AI 助手',

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
