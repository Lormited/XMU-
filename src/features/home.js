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
