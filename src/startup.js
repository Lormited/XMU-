  // ─── 启动 ──────────────────────────────────────────────────
  // 模块 id 取登记时的键
  // 先把 id 发完再启用：首页优化依赖子模块的 id 拼配置键
  Object.entries(modules).forEach(([id, m]) => { m.id = id; });
  MODULES.forEach((m) => { if (store.get(featKey(m))) m.init(); });
  settings.init();
  if (!guide.init()) showUpdate();
