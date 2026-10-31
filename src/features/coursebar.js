  // ─── 课程栏滑动 ────────────────────────────────────────────
  modules.coursebar = {
    name: '课程栏滑动', desc: '课程栏支持滚轮横向滑动，并优化翻页效果', sub: true,

    init() {
      if (!isHome()) return;
      poll(this, this.bind);
    },

    destroy() {
      clearInterval(this.timer);
      document.removeEventListener('click', this.onArrow, true);
      this.c?.removeEventListener('wheel', this.onWheel);
      this.c?.removeEventListener('scroll', this.onScroll);
      this.c = this.wheelTo = this.onArrow = this.onWheel = this.onScroll = null;   // 清干净，否则重开时守卫不成立
    },

    // 用委托在捕获阶段接管左右箭头
    bind() {
      const c = $('.courses-container');
      if (!c) return;
      this.c = c;

      if (!this.onArrow) {
        this.onArrow = (e) => {
          const arrow = e.target instanceof Element && e.target.closest('.nav-arrow');
          if (!arrow || !this.c) return;
          e.stopImmediatePropagation(); e.preventDefault();
          const dir = arrow.classList.contains('right') ? 1 : -1;
          this.animate(this.c.scrollLeft + dir * this.c.clientWidth * COURSE_STEP);
        };
        document.addEventListener('click', this.onArrow, true);

        this.onWheel = (e) => {
          if (!this.c || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
          e.preventDefault();
          this.wheelTo = clamp((this.wheelTo ?? this.c.scrollLeft) + e.deltaY * WHEEL_STEP, 0, this.max());
          this.animate(this.wheelTo);
        };
        c.addEventListener('wheel', this.onWheel, { passive: false });

        // 滚动时同步箭头状态
        this.onScroll = () => this.syncArrows();
        c.addEventListener('scroll', this.onScroll, { passive: true });
      }
      this.syncArrows();
    },

    max() { return this.c ? this.c.scrollWidth - this.c.clientWidth : 0; },

    animate(target) { smoothScroll(this.c, clamp(target, 0, this.max())); },

    syncArrows() {
      if (!this.c) return;
      $('.nav-arrow.left')?.classList.toggle('disabled', this.c.scrollLeft <= 2);
      $('.nav-arrow.right')?.classList.toggle('disabled', this.c.scrollLeft >= this.max() - 2);
    },
  };
