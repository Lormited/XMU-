const guide = {
  init() {
    if (store.get('onboarding_seen')) return false;
    this.previousFocus = document.activeElement;
    this.bodyInert = document.body.inert;
    document.body.inert = true;
    document.documentElement.classList.add('xmu-guide-active');
    this.node = element('div', {
      className: 'xmu-guide', innerHTML: `
        <div class="xmu-guide-spot"></div>
        <section class="xmu-guide-copy" role="dialog" aria-modal="true" aria-labelledby="xmu-guide-title" aria-describedby="xmu-guide-description">
          <div class="xmu-guide-meta"><span class="xmu-guide-step"></span></div>
          <h2 id="xmu-guide-title">畅课助手</h2><p id="xmu-guide-description"></p>
          <div class="xmu-guide-actions"><button type="button" class="xmu-guide-next"></button><button type="button" class="xmu-guide-skip">跳过引导</button></div>
        </section>` }, document.documentElement);
    $('.xmu-guide-next', this.node).onclick = () => settings.open ? this.finish() : settings.toggle();
    $('.xmu-guide-skip', this.node).onclick = () => this.finish();
    this.onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); this.finish(); }
      if (event.key !== 'Tab') return;
      const controls = [settings.btn, ...(settings.open ? $$('button, a[href], [tabindex="0"]', settings.panel) : []), ...$$('button', this.node)].filter((node) => !node.disabled && node.getClientRects().length);
      const index = controls.indexOf(document.activeElement);
      event.preventDefault();
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
    };
    document.addEventListener('keydown', this.onKey, true);
    this.node.addEventListener('wheel', (event) => event.preventDefault(), { passive: false });
    store.set('seen_version', VERSION);
    this.position();
    $('.xmu-guide-next', this.node).focus();
    return true;
  },

  position() {
    if (!this.node) return;
    const open = !!settings.open;
    if (this.open !== open) {
      this.open = open;
      $('.xmu-guide-step', this.node).textContent = open ? '02 / 02' : '01 / 02';
      $('#xmu-guide-description', this.node).textContent = open ? '功能可以随时开启或关闭，调整后立即生效。' : '资料下载、首页增强、界面精简，都在这里。';
      $('.xmu-guide-next', this.node).textContent = open ? '开始使用' : '打开设置';
    }
    const rect = (open ? settings.panel : settings.btn).getBoundingClientRect();
    Object.assign($('.xmu-guide-spot', this.node).style, { left: rect.left - 7 + 'px', top: rect.top - 7 + 'px', width: rect.width + 14 + 'px', height: rect.height + 14 + 'px' });
    const copy = $('.xmu-guide-copy', this.node);
    const narrow = innerWidth <= 720;
    const left = narrow ? 20 : rect.left - copy.offsetWidth - 40;
    const top = narrow ? (open ? rect.bottom + 24 : rect.top - copy.offsetHeight - 28) : rect.top + (rect.height - copy.offsetHeight) / 2;
    Object.assign(copy.style, { left: Math.max(20, left) + 'px', top: clamp(top, 20, Math.max(20, innerHeight - copy.offsetHeight - 20)) + 'px' });
  },

  finish() {
    store.set('onboarding_seen', true);
    document.removeEventListener('keydown', this.onKey, true);
    this.node.remove();
    this.node = null;
    this.open = undefined;
    document.body.inert = this.bodyInert;
    document.documentElement.classList.remove('xmu-guide-active');
    settings.position();
    const focus = this.previousFocus?.isConnected && this.previousFocus !== document.body ? this.previousFocus : settings.btn;
    focus.focus();
  },
};

function showUpdate() {
  if (!VERSION || store.get('seen_version') === VERSION) return;
  const notice = element('section', { className: 'xmu-update' });
  notice.setAttribute('role', 'status');
  notice.innerHTML = `<header><strong></strong><button type="button" aria-label="关闭通知">×</button></header><p>修复顶栏应用中心隐藏，新增独立课程菜单开关。</p><a href="${REPO}#更新日志" target="_blank" rel="noopener">查看更新日志</a>`;
  $('strong', notice).textContent = `畅课助手已更新至 v${VERSION}`;
  $('button', notice).onclick = () => notice.remove();
  document.documentElement.appendChild(notice);
  store.set('seen_version', VERSION);
}
