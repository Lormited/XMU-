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
        if (event.type === 'click' && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && link.target === '_blank') {
          event.preventDefault();
          location.assign(link.href);
        }
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
