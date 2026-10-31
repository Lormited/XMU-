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
