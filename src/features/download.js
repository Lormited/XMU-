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
