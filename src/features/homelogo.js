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
