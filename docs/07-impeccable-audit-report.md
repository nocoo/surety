# Surety Impeccable Audit 报告

日期：2026-03-07  
范围：`src/app`、`src/components`、`src/lib` 中与前端界面、交互、主题、响应式和可访问性相关的实现。  
执行检查：`bun run lint`、`bun run build`（均通过）。

## 总体结论

Surety 当前的界面整体克制、专业，主应用并不属于典型的“AI 套模板 Dashboard”。信息架构、术语和数据组织都明显贴合家庭保单管理场景，设计基础设施（主题 token、图表配置、基础 UI primitive）也已经建立。

但距离“impeccable”还有一段距离。主要短板不在视觉审美，而在以下几个方面：

1. 有少数交互存在“看起来已完成、实际上没有真正落地”的问题。
2. 移动端和键盘/读屏场景的支持不够完整。
3. 页面层绕开主题系统的硬编码颜色较多，长期会削弱一致性。
4. 个别组件存在明显的 React 反模式和快速实现痕迹。

综合判断：**可用、稳定、观感不错，但还不够“无可挑剔”**。

## Anti-Patterns Verdict

### 结论

**不明显像纯 AI 生成页面，但有明显 AI-assisted / 快速拼装的实现痕迹。**

### 原因

不像纯 AI 产物的地方：

- 主应用风格统一，避免了常见的玻璃拟态、渐变字、泛用 hero metric 模板。
- 页面划分和业务表达足够具体，不像为“展示 UI”而展示 UI。
- 已有清晰的 design token、chart config、layout shell 基础设施。

像 AI-assisted / 快速拼装的地方：

- 若干大页面组件体量过大，重复逻辑较多。
- 存在“先让它看起来能工作”的实现，例如 render 阶段请求数据、假保存按钮、颜色系统未完全收口。
- 移动端策略偏保守，更多依赖滚动而非真正的信息重排。

## 审计摘要

### 问题数量

- Critical：1
- High：4
- Medium：6
- Low：3

### 最需要优先处理的问题

1. 设置页“保存设置”并未真正持久化。
2. 移动端侧边栏不是完整的可访问 drawer / sheet。
3. 两个 dialog 在 render 阶段触发 fetch / setState。
4. 复杂表格和双列表单在小屏上可用性不足。

### 综合评分

**7 / 10**  
桌面端已达到“顺手可用”的水平，但若要达到高质量产品标准，还需要一轮系统性收口。

## 详细问题

## Critical

### 1. 设置页存在“假保存”交互，容易误导用户

- 状态：已修复（`f5196b9` `fix: persist financial settings`）

- 位置：`src/app/settings/page.tsx:100`、`src/app/settings/page.tsx:325`、`src/app/settings/page.tsx:769`
- 类别：交互可靠性 / UX
- 描述：`annualIncome`、`reminderDays`、`currency` 的改动仅保存在本地 React state 中；点击“保存设置”只会短暂切换成“已保存”，没有调用 API，也没有写入本地持久层。
- 影响：用户会误以为设置已生效，刷新后发现丢失，损害信任感。
- 建议：
  - 若这些设置应该持久化，改为调用 `/api/settings` 或统一的设置保存接口；
  - 若当前阶段不支持保存，应明确标记“暂未接入持久化”，而不是展示成功状态。

## High

### 2. 移动端侧边栏不是完整的可访问抽屉

- 状态：已修复（`1d821a6` `fix: use accessible mobile sidebar`）

- 位置：`src/components/layout/app-shell.tsx:46`、`src/components/layout/app-shell.tsx:63`
- 类别：Accessibility / Responsive
- 描述：移动端导航由 overlay + fixed sidebar 手写实现，没有 focus trap、没有 `aria-modal`、没有 Escape 关闭逻辑。
- 影响：键盘用户和读屏用户容易丢失焦点上下文，关闭路径也不完整。
- 建议：优先替换为已有的可访问 `sheet` / `dialog` 模式，或补齐键盘和语义支持。

### 3. 两个对话框在 render 阶段直接请求数据

- 状态：已修复（`ce935a0` `fix: move policy dialog effects`）

- 位置：`src/app/policies/policy-detail-dialog.tsx:531`、`src/app/policies/payments-dialog.tsx:61`
- 类别：性能 / 代码健壮性
- 描述：组件函数体中使用 `if (open && ...) fetch...` 和 `if (!open && ...) setState...`。
- 影响：这是 React 反模式，容易导致重复请求、Strict Mode 双触发、打开关闭抖动和后续维护问题。
- 建议：改为 `useEffect` 驱动加载与重置逻辑，并明确依赖项。

### 4. 表格和详情布局对移动端不够友好

- 状态：已修复（`8c9185c` `fix: improve policy mobile layouts`）

- 位置：`src/components/ui/table.tsx:11`、`src/components/ui/table.tsx:73`、`src/app/policies/page.tsx:470`
- 类别：Responsive
- 描述：表格默认 `overflow-x-auto`，并配合大量 `whitespace-nowrap`；多个详情和表单仍以双列布局为主。
- 影响：在手机上只能横向滚动，理解成本和操作成本都偏高。
- 建议：
  - 为高密度列表提供 mobile summary card 视图；
  - 对详情与表单在小屏降为单列；
  - 对关键字段做优先级重排，而不是简单缩放。

### 5. 主题系统已建立，但页面层仍有大量硬编码颜色

- 状态：部分修复（`6fa7157` `refactor: normalize semantic color classes`）；`settings` 页仍有部分状态提示色待继续收口。

- 位置：`src/app/settings/page.tsx:395`、`src/app/settings/page.tsx:544`、`src/app/settings/page.tsx:590`、`src/app/assets/page.tsx:51`、`src/lib/category-config.ts:22`、`src/lib/utils.ts:26`
- 类别：Theming
- 描述：`globals.css` 中已建立较完整的主题 token，但页面和工具函数中仍大量使用 `blue/green/red/violet/...` 等 Tailwind 直接颜色类，甚至个别位置写死深色值。
- 影响：会让主题切换、一致性控制、后续品牌收口越来越困难。
- 建议：将类别色、头像色、状态色逐步迁移到语义 token 或统一配置层。

## Medium

### 6. 展开和滚动控件缺少关键可访问性状态

- 状态：已修复（`a69fd8b` `fix: add coverage lookup aria state`）

- 位置：`src/components/coverage-lookup/policy-card.tsx:18`、`src/components/coverage-lookup/member-selector.tsx:62`、`src/components/coverage-lookup/asset-selector.tsx:64`
- 类别：Accessibility
- 描述：可展开卡片没有 `aria-expanded`；左右滚动按钮没有明确 `aria-label`。
- 影响：读屏用户无法准确理解当前状态与按钮用途。
- 建议：为展开按钮补充 `aria-expanded` / `aria-controls`，为左右滚动按钮增加明确标签。

### 7. 排序表头缺少排序语义

- 状态：已修复（`044f2cd` `fix: add policy sort aria state`）

- 位置：`src/app/policies/page.tsx:476`
- 类别：Accessibility
- 描述：表头用按钮实现排序，但没有暴露 `aria-sort` 等状态。
- 影响：屏幕阅读器用户不知道当前按哪个字段排序、方向是什么。
- 建议：将排序状态映射到表头语义中。

### 8. 图表在数据量增加时可读性和性能都会下降

- 状态：已修复（`7608657` `fix: compact crowded donut labels`）

- 位置：`src/components/charts/donut-chart.tsx:67`
- 类别：Performance / Data visualization
- 描述：donut chart 为每个扇区直接显示标签；类别一多会挤压和碰撞。类似问题在 stacked chart 中也会出现。
- 影响：数据少时美观，数据一多立即变得拥挤，信息密度和辨识性下降。
- 建议：
  - 限制图上直接展示的标签数量；
  - 剩余信息转入 tooltip / legend / 明细列表；
  - 对高维度数据提供更稳健的 fallback 展示。

### 9. 全站偏向 mount 后取数，首屏体验仍有优化空间

- 状态：部分修复（`34898a7` `refactor: render dashboard on server`）；首页仪表盘已改为 server render，但其他核心页面仍可继续评估。

- 位置：`src/app/page.tsx:58`、`src/app/policies/page.tsx:147` 等多个页面
- 类别：Performance
- 描述：多个核心页面使用 client component + `useEffect` 拉取数据。
- 影响：首屏依赖 loading 态，JS 参与较多，页面切换更像本地工具而非“精致完成”的应用。
- 建议：对核心页面评估 server-side data loading 或更轻量的数据预取策略。

### 10. 数据库切换交互较生硬

- 状态：已修复（`e3f26bb` `fix: smooth database switching`）

- 位置：`src/components/layout/db-selector.tsx:82`
- 类别：Interaction
- 描述：切换数据库后直接 `window.location.reload()`。
- 影响：虽然简单有效，但体验比较突兀。
- 建议：后续可改成可感知但更平滑的刷新方式，至少补充清晰的切换反馈。

### 11. 多处失败只记录到 console，缺少用户可见反馈

- 状态：部分修复（`7712713` `fix: show errors for failed actions`）；已为保单/成员/资产关键提交与保单删除、复制失败补充用户可见反馈，其它失败路径仍可继续收口。

- 位置：`src/app/policies/page.tsx:314`、`src/app/policies/policy-detail-dialog.tsx:523` 等
- 类别：Resilience
- 描述：失败时常常只 `console.error` 或静默忽略。
- 影响：用户不知道失败原因，只能看到按钮没反应或内容未更新。
- 建议：为关键操作增加 toast / inline error / retry 提示。

## Low

### 12. 禁用删除按钮没有解释原因

- 状态：已修复（`11d49ab` `fix: explain disabled delete actions`）

- 位置：`src/app/insurers/page.tsx:190`，类似问题也出现在成员和资产页面
- 类别：UX 文案
- 描述：按钮被禁用，但用户不知道是因为已有保单引用还是其他限制。
- 影响：可理解性不足，容易让人以为是 bug。
- 建议：在 tooltip 或说明文案中写明禁用原因。

### 13. 面包屑语义还可以更完整

- 状态：已修复（`520fec2` `fix: complete breadcrumb semantics`）

- 位置：`src/components/layout/breadcrumbs.tsx:15`
- 类别：Accessibility
- 描述：已有 `nav`，但缺少 `aria-label`，当前页也没有更明确的语义表达。
- 影响：问题不大，但离完善还有一步。
- 建议：补充 `aria-label="面包屑导航"`，并明确当前页语义。

### 14. 登录页与主应用的视觉语言稍有脱节

- 位置：`src/app/login/page.tsx:36`
- 类别：Visual consistency
- 描述：登录页使用了较强的证件卡隐喻和装饰性构图，而主应用整体更克制、偏信息面板。
- 影响：不是错误，但品牌一致性略弱。
- 建议：后续可将登录页的视觉叙事再向主应用靠拢一点。

## 系统性问题

### 1. 设计系统存在，但落地不彻底

基础 token、badge variant、chart config 都已经有了，但页面层仍经常直接写颜色和状态映射，说明“基础设施”与“实际使用”之间还有断层。

### 2. 移动端策略偏“能滚就滚”

目前更多是通过横向滚动和压缩空间来兼容小屏，而不是基于场景重排信息层级。

### 3. 交互语义落后于视觉完成度

页面看起来已接近完整产品，但一些关键语义和键盘行为还停留在“可点击即可”的阶段。

### 4. 客户端数据流偏快速实现导向

存在 render 阶段取数、mount 后统一加载、失败静默等问题，说明数据交互层还没完全进入“精致产品”阶段。

## 正向发现

### 1. 主应用整体视觉克制、专业

尤其是 shell、留白、图标尺寸和卡片层级控制，明显优于常见模板化后台界面。

### 2. 主题基础设施扎实

`src/app/globals.css` 已经具备 light / dark token、语义色和图表色基础，是后续统一体验的重要资产。

### 3. 图表基础封装方向正确

像 `chart-card`、统一 chart config 这样的抽象说明项目已经具备系统化意识，而不是纯页面堆砌。

### 4. 工程健康度不错

本次审计中，`bun run lint` 与 `bun run build` 均顺利通过，说明项目整体代码质量和构建稳定性良好。

## 建议的修复顺序

### 第一优先级（立即处理）

1. 修复设置页假保存问题。
2. 将 `policy-detail-dialog` 与 `payments-dialog` 的数据加载迁移到 `useEffect`。
3. 将移动端侧边栏替换为真正可访问的 sheet / drawer。

### 第二优先级（本轮迭代内处理）

1. 改善 `policies`、`members`、`assets`、`insurers` 等高密度页面的移动端布局。
2. 为展开、排序、滚动按钮补齐 aria 语义。
3. 为关键失败路径补充用户可见错误反馈。

### 第三优先级（统一体验）

1. 收敛类别色、头像色、状态色到主题 token 或共享配置层。
2. 收敛重复的金额格式化、状态映射、颜色映射。
3. 让登录页与主应用的视觉语言更统一。

## 对应修复方向

- `harden`：适合处理假保存、错误反馈、脏数据防护、禁用原因说明。
- `adapt`：适合处理小屏布局、表格替代视图、详情信息重排。
- `normalize`：适合统一颜色、状态、设计 token 的实际使用。
- `polish`：适合补齐 aria、键盘行为和细节一致性。

## 附注

本报告聚焦“界面质量与交互完成度”，不涉及后端业务正确性、数据库模型正确性或权限安全策略的深度审计。若后续继续推进，可将本报告拆分为两类任务：

1. **立即修复型问题**：直接影响用户信任和操作体验；
2. **系统收口型问题**：影响长期维护成本和产品一致性。
