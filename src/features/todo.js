  // ─── 待办排序 ──────────────────────────────────────────
  // 首页待办按截止时间升序排
  const DUE_RE = /(\d{4})\.(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{2})/;

  function todoDue(item) {
    const m = ($('.todo-datetime', item)?.textContent || '').match(DUE_RE);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : Infinity;
  }

  modules.todo = {
    name: '待办排序', desc: '首页待办按截止时间升序排列', sub: true,

    init() {
      if (!isHome()) return;
      poll(this, this.sort);
    },

    destroy() { clearInterval(this.timer); },

    sort() {
      const box = $('.todo-list-container');
      if (!box) return;
      const items = $$('.todo-item', box);
      if (items.length < 2) return;

      const sorted = items.map((item) => ({ item, due: todoDue(item) }))
        .sort((a, b) => a.due - b.due).map(({ item }) => item);
      if (items.some((item, index) => item !== sorted[index])) box.append(...sorted);
    },
  };
