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
