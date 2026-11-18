# 专体 PERSON SPORTS · 统一设计系统（Design Tokens 盘点）

> E-6 产物：本文档**盘点现状并声明权威口径**，不改变现有视觉。App 与 PC 主色一致（同源），已知漂移项列于文末。

## 1. 颜色体系

### 品牌与交互（App `src/styles/tokens.css` = PC `pc/src/theme.ts` 同源）

| Token | 值 | 用途 |
|---|---|---|
| `--brand` / PC `colorPrimary` | `#12345B` | 品牌深蓝（导航/主按钮/侧栏底色） |
| `--blue` / PC `colorInfo`·`colorLink` | `#2872B8` | 链接/信息色/选中态 |
| `--blue-strong`（v2） | `#0765FE` | 高保真页面的强交互蓝 |
| `--brand-2` | `#0E2A49` | 品牌深色变体（渐变/按压态） |

### 背景与文字

| Token | 值 | 用途 |
|---|---|---|
| `--bg` | `#F3F6FA`（PC `colorBgLayout` 同值） | 页面底色 |
| `--card` | `#FFFFFF` | 卡片 |
| `--ink` / `--ink-2` / `--ink-3` | `#1B2A3D` / `#5A6B80` / `#8B98A9` | 主文/次文/弱文 |
| `--line` | `#E6EBF2` | 分隔线/边框 |

### 状态与强调色（双端通用语义）

| 语义 | App token | PC（AntD/STATUS_COLORS） |
|---|---|---|
| 成功/已核验 | `--teal #19B9AC`、`--green #22C55E` | `success #52C41A` |
| 警示/待处理 | `--amber #D97706`、`--orange #FF9850` | `warning #FAAD14` |
| 错误/驳回 | `--red #EF4444`、`--coral #FF6B5E` | `error #FF4D4F` |
| 处理中 | `--sky #2B7FFF` | `processing #2872B8` |
| 强调/营销 | `--lime #C9F43F`、`--purple #8B5CF6`、`--gold #F5C542` | — |

## 2. 字体规范

- 字族（App `app.css:14`）：`'PingFang SC','HarmonyOS Sans SC','Microsoft YaHei','Noto Sans SC',system-ui`；PC 继承 AntD 默认栈（同族）
- 基准字号：PC `fontSize: 14`（theme.ts）；App 正文 14-15px、标题 16-22px、辅助文字 11-12px（组件内联）
- **字号变量体系尚未建立**（当前为组件级写死）——列入技术债，不阻塞

## 3. 间距与圆角

- 间距：页面边距 16px（`.page` padding）、卡片间距 12px（`.mt12`）、行内 8px（`.mt8`/`.gap8`）、紧凑 4px
- 圆角：App `--radius:16px`（卡片）/`--radius-s:10px`；PC `borderRadius:8`、卡片 `borderRadiusLG:10`
- 阴影：App `--shadow/--shadow-lg`；PC 依赖 AntD 默认

## 4. 图标规范

- App：`src/components/Icon.tsx` 统一线性图标（stroke 1.8、24 viewBox、currentColor）；功能宫格用 `ui.tsx FuncGlyph` 渐变填充图标（48 viewBox）
- PC：`@ant-design/icons` 线性图标（与 App 风格语义一致）

## 5. 按钮规范

- App：`.btn`（主/`.btn-primary` 品牌蓝、`.btn-ghost` 描边、`.btn-ghost-gray` 灰、`.btn-sm`）+ `.pub-submit`（发布主按钮）
- PC：AntD Button（primary/ghost/danger + size）
- 语义一致：主操作=品牌蓝；危险=红；次要=描边

## 6. 表单规范

- App：`.pub-field`（底边线字段容器）+ `.pub-input`（15px 加粗无框）/`.pub-textarea`
- PC：AntD Form（vertical layout、label 上置）
- 校验反馈：App 行内红字 + toast；PC Form rules + Modal

## 7. 弹窗规范

- App：无全屏 Modal（Sheet 底部抽屉用于筛选：`.filter-options`）；系统确认用浏览器 confirm（仅登出）
- PC：AntD Modal（审核动作）/Popconfirm（轻确认）/Drawer（通知中心 420px）

## 8. 页面布局规范

- App：`--maxw:430px` 居中手机视口；主导航 `.nav`（`--nav-h:62px`，凸起发布键）；二级页 DetailHeader + `.page`
- PC：左侧 Sider 220px（可折叠）+ 顶栏 56px + Content 16px 边距；PageWrap 统一加载/错误包裹

## 9. 加载 / 空状态 / 错误状态

| 状态 | App | PC |
|---|---|---|
| 加载 | `.state-box`（BrandLoading：品牌 logo + 文案） | PageWrap Skeleton |
| 空态 | `EmptyState`（图标+标题+描述+动作） | AntD Empty（自定义描述） |
| 错误 | AppGate 错误页（重试按钮）/ ErrorBoundary 兜底 / 行内红字 | PageWrap error（含 ApiError code 提示）/ message.error |
| 全局 | Toast（右上/底部浮层，store.pushToast） | AntD message |

## 10. 已知漂移（登记不阻塞）

1. **v2.css 覆盖 tokens.css**：`--bg`（#f3f6fa→#eff6fe）、`--blue-strong`（#2b5bff→#0765fe）——v2 高保真页面按新视觉稿覆盖；统一时机 = 原型定稿后合并（不在此轮强行统一，避免视觉回归）
2. 零散写死色：BottomNav（#005AFA/#142A52）等未进变量体系——技术债
3. 字号/间距未全部变量化（见第 2 节）
