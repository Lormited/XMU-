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
        if (this.panel?.contains(e.target) || this.btn?.contains(e.target) || guide.node?.contains(e.target)) return;
        this.toggle();
      }, true);
    },

    toggle() {
      if (!this.panel) this.build();
      this.open = !this.open;
      this.panel.style.display = this.open ? 'block' : 'none';
      if (this.open) this.refresh();
      this.position();
    },

    position() {
      const scale = parseFloat(getComputedStyle(document.body).zoom) || 1;
      const headerBottom = clamp(($('.header')?.getBoundingClientRect().bottom || 0) * scale, 0, innerHeight);
      const center = (headerBottom + innerHeight) / 2;
      this.btn.style.top = center + 'px';
      if (this.open) {
        this.panel.style.top = center + 'px';
        this.panel.style.maxHeight = Math.max(0, innerHeight - headerBottom - 24) + 'px';
      }
      guide.position();
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
      guide.position();
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
