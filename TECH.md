# XMU 厦大畅课助手 · 技术文档

对应版本：`0.7.2`。目标站点：<https://lnt.xmu.edu.cn>。功能与安装方法见 [README.md](README.md)。

## 文件与运行环境

- `src/metadata.js`：油猴元数据与发布版本，构建时置于产物顶部。
- `src/core.js`：配置、公共工具与模块登记表；`src/features/` 按功能存放模块及其辅助函数。
- `src/settings.js`、`src/guide.js`、`src/startup.js`：设置面板、首次引导、更新通知与启动入口。
- `XMU-TronClass-Helper.css`：全部静态样式，构建时编码为 JS 字符串，启动时一次注入页面根节点。功能关闭后由元素移除或启用标记控制样式失效。
- `build.mjs`：使用 Node.js 标准库，按清单顺序拼接源码并嵌入 CSS；无第三方依赖。所有片段共享同一个 IIFE，不是独立执行的 ES 模块。
- `XMU-TronClass-Helper.user.js`：生成的单文件发布产物，不直接编辑，安装与自动更新地址保持不变。
- 用户脚本管理器提供 `GM_download`、`GM_getValue`、`GM_setValue`、`unsafeWindow`；跨域下载授权为 `c-media.xmu.edu.cn`。
- 脚本在 `document-end` 启动，按「基础工具 → 模块 → 设置 → 启动」组织。
- `@name` 与 `@namespace` 是脚本身份，修改可能导致管理器安装第二份脚本并丢失原配置关联。
- 显示版本从 `GM_info.script.version` 读取。发布时修改 `src/metadata.js` 中的 `@version`，运行 `node build.mjs`，将源码与产物一并提交。
- JS 和 CSS 随同一个脚本版本发布，不使用 `@require`、`@resource` 或 `GM_getResourceText`，无需用户调整外部更新间隔。管理器的脚本自动更新检查仍可能访问 GitHub。

## 模块与配置

`modules` 的登记键就是模块 id。启动时先给全部模块赋 id，再启用已开启的主模块，最后创建设置；首次引导与更新通知互斥。

| 模块 | id | 默认开启 | 行为 |
| --- | --- | --- | --- |
| 资料下载 | `download` | 是 | 课程页列出附件，勾选后依次下载 |
| 首页优化 | `home` | 是 | 调度下面六项子功能 |
| 界面精简 | `chrome` | 是 | 分别隐藏首页侧栏、课程菜单、底栏、AI 助手 |
| 顶栏精简 | `topbar` | 否 | 按入口选择隐藏顶栏元素 |
| 校徽首页跳转 | `homelogo` | 否 | 更换校徽链接，关闭后还原 |
| 链接增强 | `links` | 是 | 首页课程卡片、待办行支持原生链接操作 |
| 页面自适应 | `fit` | 否 | 首页固定缩放至 0.85，并扩展布局画布 |
| 课程栏滑动 | `coursebar` | 否 | 接管箭头翻页与滚轮横向滑动 |
| 待办排序 | `todo` | 是 | 按截止时间升序排列，无日期项排最后 |
| 签到列表替换 | `signin` | 否 | 常用入口卡片替换为正在签到列表 |

主开关使用 `feat_<id>`。首页子功能标记 `sub: true`，由 `HOME_FEATS` 维护展示顺序，名称读取模块自身的 `name`；设置不重复展示子模块。

模块提供 `init()`、`destroy()`；带子选项的模块还提供 `tags()`、`apply()`。顶栏通过 `tagOn()`、`tagToggle()` 自定义配置读写，其余标签使用扁平配置键。

`syncFeat()` 仅在子功能状态变化时调用生命周期方法。关闭首页分组会销毁已开启的子模块并复位 `on`，保留各子项的用户配置。

配置统一加 `xmu_` 前缀。读取顺序为 `GM_getValue → localStorage → DEFAULTS`；GM 写入失败时退回 localStorage。已有配置优先于新默认值，不改键名或自动清空旧值。

| 其他配置 | 说明 |
| --- | --- |
| `chrome_sidebar`、`chrome_footer`、`chrome_ai` | 界面精简子项，默认均为 true |
| `chrome_course_sidebar` | 独立隐藏课程菜单，默认 false；不再跟随首页侧栏开关 |
| `topbar_hide` | JSON 字符串，记录各顶栏入口的结构签名 |
| `seen_version` | 已展示更新通知或首次引导的版本，同版本不重复展示通知 |
| `onboarding_seen` | 完成、跳过或 Esc 退出引导后设为 true，后续版本不再显示引导 |

## 请求与数据

`api(path)` 使用 `fetch(path, { credentials: 'include' })` 并解析 JSON。当前仅使用以下接口：

| 请求 | 用途 |
| --- | --- |
| `GET /api/courses/{course_id}/activities?sub_course_id=0` | 读取课程活动的 `uploads` |
| `GET /api/uploads/{upload_id}/download-url-for-ai` | 获取附件下载直链 |
| `GET /api/radar/rollcalls?api_version=1.1.0` | 读取正在进行的签到列表 |

资料下载保留 `type` 为 `document` 或 `file`、未删除且有 id 的附件，按 id 去重。每次下载先换取直链，等待 `GM_download` 的 `onload` 或 `onerror` 后计数；失败或抛错时尝试 `fetch → blob → a[download]`。文件名清理非法字符，批量请求间隔 400ms。

签到列表在功能启用和手动刷新时请求，不轮询接口。挂载卡片的 400ms 短轮询只查 DOM，最多尝试 11 次。响应签名未变时不重建条目，避免悬停闪烁。

- 课程名称读取 `course_title`。
- 已签状态读取 `status`，不能用已签后仍可能为 `on_call` 的 `student_status`。
- 点名方式按 `is_number → is_radar → source/type` 判断；数字点名的 `type` 可能是 `another`。
- 未签数字点名跳转至 `https://c-mobile.xmu.edu.cn/course/{course_id}/number-rollcall/{rollcall_id}/answer`。
- 其他类型回落到 `https://c-mobile.xmu.edu.cn/ongoing-rollcall-list`；其专用答题路径尚未验证。

## DOM 与交互约束

### 轮询和还原

`poll(m, fn)` 立即执行一次回调，随后每 1300ms 执行；每个模块只保留一个定时器，存放在 `m.timer`。重新调用先停旧定时器，关闭时调用 `clearInterval(m.timer)`。

销毁模块应清理自己的元素、标记、监听器与定时器，并复位影响再次启用的状态。修改站点原值时留底，关闭后还原。隐藏功能只标记自身隐藏的元素，不能在关闭时显示站点原本隐藏的内容。

### 首页链接与排序

首页课程区使用 Vue 2。从 `.courses-container` 向上寻找 `.__vue__`，按卡片索引读取组件 `courses` 中的 `url`；用户脚本通过 `unsafeWindow.document` 访问页面组件。

链接增强在课程卡片、待办行内追加绝对定位的空 `a.xmu-home-link`，不移动 Vue 管理的子节点。待办地址与 target 取自原有 `.todo-link`，仅接受 HTTP(S) 地址，跳过已有链接祖先及未解析模板。课程更多菜单和待办原操作保持在覆盖层上方。

捕获阶段阻止增强链接的点击继续传播。无修饰键的左键点击遇到 `target="_blank"` 时，调用 `preventDefault()` 并以 `location.assign()` 在当前页导航；其余点击保留原生行为，中键、组合键和右键菜单不变。轮询只在链接属性变化时写入 DOM。

待办时间从 `.todo-datetime` 的 `yyyy.mm.dd hh:mm` 文本解析。每项每轮只解析一次；稳定排序保持相同日期项的顺序，节点顺序未变时不移动 DOM。

### 顶栏精简

顶栏以 `.header` 为根，按入口聚合：已隐藏项常驻列表；跳过折叠菜单；分隔栏单独列项；`logo-padding` 拆为校徽和课程中心；链接或 `role=button` 整体列项；其余节点继续递归。

应用中心将文字节点与外部 `#wg-apps-panel` 一起交给顶栏原有隐藏逻辑处理，沿用文字节点的配置键。取消隐藏或关闭模块时，两者一起恢复。

不能按父容器可见性剪枝，否则隐藏后缩至零宽的父级会使开关消失。名称按 title/aria、自身 class、图标、去角标后的文字、祖先 class 依次推断；重名项加序号。

配置键使用元素标签、祖先 class 和文字生成结构签名，不使用数组下标。保留现有签名算法以兼容已保存配置。隐藏后缩至零宽但仍占 margin 的父级使用 `data-xmu-shell` 收起，每轮重新判断，关闭模块时还原。

### 缩放、设置与动画

自适应仅在首页使用 `body.zoom = 0.85`。CSS zoom 不扩展布局视口，因此 `.main-content` 的宽高需用根元素 `clientWidth/clientHeight ÷ zoom` 显式计算，高度再扣除顶栏。使用 client 尺寸避免滚动条反馈循环。

首页采用两行纵向 flex，设计间距为 24px，剩余高度分给待办行；右列首卡吸收高度。参与压缩的行与卡片保留 `min-height:auto`，小窗口装不下时允许页面滚动，不加全页 `overflow:hidden`，不按内容高度反复校正缩放。

脚本固定控件挂在 `<html>` 下，不受 body 缩放影响。设置齿轮与面板在「顶栏底部到视口底部」区域垂直居中。当前目标浏览器实测需将顶栏 rect 底部乘 body zoom，再用于固定控件定位；浏览器变化时应重新核对。定位通过 resize、捕获阶段 scroll 和轮询更新。

保留齿轮的贴边尺寸、透明度与阴影；定位不使用 `transition:all`，避免位置插值干扰居中。课程翻页保留自定义 rAF 三次缓出，参数为翻页比例 0.97、时长 280ms、滚轮倍率 1.6，滚动事件同步箭头状态。

### 首次引导

没有 `onboarding_seen` 标记时，首次进入显示两步引导，分别高亮设置齿轮和面板；既有用户也会看到一次。遮罩、说明和设置均挂在 `<html>`，不受 body 缩放影响。引导期间临时设置 `body.inert`，限制 Tab 焦点并拦截遮罩滚轮，完成后还原背景状态与焦点。设置区域保持可操作，点击引导区域不会触发面板外部关闭。

高亮位置随设置定位与内容刷新更新；窄屏把说明放在面板下方，限制面板高度并保留内部滚动。尊重 `prefers-reduced-motion`。引导开始时记录 `seen_version`，完成、跳过或 Esc 退出时记录 `onboarding_seen`。

用户脚本没有可靠的安装完成回调，因此不实现安装后自动打开畅课站点。

### 样式

脚本类名使用 `xmu-` 前缀，避免与站点 `.bar`、`.item` 等通用类冲突。按钮显式覆盖 focus/hover 的背景和文字色；需要边框时使用完整 `border` 简写。站点选择器权重可能高于单类规则。

签到沿用站点 `tronclass` 字体的 `font-goto`、`font-rollcall-finish`，字形保留向下 3px 修正；条目间距保留 16px。主题色沿用 `--primary-brand-color` 与 `--primary-brand-color-lightened-2`。

## 验证与限制

基础检查：

```sh
node build.mjs
node build.mjs --check
node --check XMU-TronClass-Helper.user.js
git -c core.whitespace=cr-at-eol diff --check
```

构建会检查合并后的 JS 语法；`--check` 只校验当前产物是否与源码和 CSS 一致，不写文件。新增功能文件时需在 `build.mjs` 的源码清单中按依赖顺序登记。

浏览器验证使用登录态首页和内存 GM 配置桩，避免清除真实设置；接口与下载使用模拟响应及回调，避免意外发起实际下载。不要把课程、姓名、学号或带 token 的链接写入测试资料。

检查首页分组反复开关、全框链接与更多菜单命中、相同内容的重复 DOM 写入、待办稳定排序、缩放后的设置居中、下载过滤和状态计数、签到请求次数、同版本通知不重复。视觉测量需考虑 CSS 过渡；隐藏页的 rAF 和过渡可能不推进，必要时先截图触发渲染。

已知限制：blob 兜底会整份缓冲文件，大文件占用内存；批量下载可能触发浏览器授权提示。站点调整 Vue 数据、DOM 类名、顶栏结构或日期格式后需重新核对。中键事件未被阻止不等于已经验证浏览器实际创建了新标签页，需在用户浏览器中确认。