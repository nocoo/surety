# Surety 设计提升机会审计（baoyu-design）

日期：2026-06-09
范围：`apps/web/src/**`（前端 UI / IA / 设计系统）、`apps/worker/src/routes/**`（影响 UI 反馈层的接口契约）。
方法：按 baoyu-design 的"高保真审美 + 交互原型"标准，逐页扫描视觉系统、信息架构、表单/列表/空态、暗色模式、CJK 排版、移动端适配、品牌叙事；不动 Bash/build，纯静态阅读。

## 总体结论

Surety 的设计基础是**克制、扎实、不做作的**。Vermilion + 3-tier 灰阶的 token 体系、"floating island"内容容器、24 色 chart palette、统一的 Sheet/Dialog 模式、`getCategoryConfig` 险种语义化色彩，都说明这不是一个被 AI 套模板拼出来的 dashboard。

但距离"专业、有温度、令人信任的家庭风险管理工具"还有一段路。问题集中在四条线：

1. **页面级信息层次扁平**——dashboard、保单、就诊记录都呈现"标题 + 一行小灰字 + 等权图表/表格阵列"的同质模板，缺乏"今天最该关注什么"的视觉锚点。
2. **数据密度与决策性不平衡**——表格列数往往超过 10 列（保单 13 列、就诊记录 12 列）触发横向滚动，而 dashboard 8 张图表全部描述性、没有 prescriptive 的"行动建议"。
3. **品牌温度缺位**——产品定位"家庭保单管理"，目标用户是 40 岁、上有老下有小的开发者；当前 UI 完全是 SaaS 通用范式，没有任何能传递"守护家人"情感的视觉语言（空态/illustration、首屏问候、家庭成员维度的总览）。
4. **设计 token 收口存在大量裂缝**——HSL token 系统完整，但多个页面成片绕开 token：症状色 6 色循环（`medical-visits/page.tsx:88`）、设置/CLI 页 icon 用 `bg-orange-500/10` `bg-blue-500/10` `bg-violet-500/10`（`settings/page.tsx:178`、`cli/page.tsx:160,207`、`backy-settings.tsx:207`）、status 提示用 `border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950` 与 `border-green-200 bg-green-50 ...`（`database-settings.tsx:141,148`、`backy-settings.tsx:246,290,291,312,313`）、表单警告用 `bg-yellow-500/10 ... text-yellow-700 dark:text-yellow-400`（`visit-sheet.tsx:564`）。暗色模式下还有 primary 与 chart-1 几乎同色的小冲突。这条债的实际规模 = settings + cli + medical-visits + visit-sheet + attachment-list 至少 5 个文件、20+ 处 Tailwind 直颜色类。

综合评分：**7.5 / 10**。基础设施已就绪，剩下的是品牌叙事、信息层次和密度策略上的"再设计"，而不是返工。

## Anti-Patterns Verdict

### 结论

**不是 AI 套模板 dashboard，但有"shadcn 默认审美"的工程师味道。**

### 像专业产品的地方

- 险种、保单状态、家庭成员关系、就诊类型都用了语义化的 Badge variant（success/warning/info/purple/teal），而不是泛用的彩条。
- "保障速查"这个页面非常对路，是真懂家庭风险管理痛点（紧急情境查保单）的人才会做的功能。
- floating island shell（`rounded-[20px] bg-card`）在桌面端有现代感，比常见的"全屏 sidebar + main"更精致。
- Dark mode 的设计 token 经过单独调校（饱和度降低、亮度受控），不是简单 `oklch invert`。

### 像 shadcn 工程师默认审美的地方

- 13 个页面几乎全部模板化复用同一个布局：`<h1 text-2xl font-semibold tracking-tight>` + `<p text-sm text-muted-foreground>` + Add 按钮 + Table。
- `flex items-center justify-between` 顶部条 + `space-y-6` 主区 + `rounded-card bg-secondary` 表格容器，是 shadcn 文档级标配。
- 空态/加载/错误三态全部"灰色 lucide 图标 + 标题 + 灰色辅助文字"，13 个页面无差别复用。
- 所有 destructive AlertDialog 的 Action **多数页面**仍内联写 `className="bg-destructive text-destructive-foreground hover:bg-destructive/90"`（保单/成员/资产/就诊/医院/医生/保险公司/附件区共 8 处），但 CLI、保障内容、缴费记录、备份设置等地方已经在用 `<AlertDialogAction variant="destructive">` 的正确写法——同一项目两套写法并存，是被复制了 8 次的"快速实现"痕迹。

## 审计摘要

### 问题数量

- Critical：0（不阻塞核心体验，没发现错误状态）
- High：5（信息架构与品牌叙事，影响用户感知）
- Medium：9（设计系统收口、密度策略、空态质量）
- Low：6（细节、CJK 排版、个别交互冗余）

### 最值得优先处理的 5 件事

1. **Dashboard 重新设计**——把"8 张等权图表"换成"风险健康度 + 行动建议 + 当月决策项"的层次化首屏。
2. **保单列表表格密度策略**——13 列的"全列表格"应当让位给"卡片密度可调"的列表（紧凑/舒适/卡片），mobile 卡片设计已在，桌面缺中间形态。
3. **空态/加载/错误三态品牌化**——把"灰图标 + 灰字"换成与"家庭保单"语境契合的插画或半色调底纹，是当前最低成本的差异化抓手。
4. **就诊记录表格症状色板归一**——目前用 6 色 hardcoded `bg-blue-100/dark:bg-blue-900` 循环，与 design token 体系完全脱钩，应统一到 chart palette 或 badge variants。
5. **CJK 字体栈显式声明**——`globals.css` 只声明 Inter，中文走 system-ui fallback，跨设备视觉差异大；专业产品应显式 `"PingFang SC", "Noto Sans SC"`。

### 综合评分

**7.5 / 10**——产品已经"好用"，距离"独特"差一轮品牌化设计；离"专业 SaaS 标杆"差一轮信息架构再分层。

---

## 详细问题

## High

### 1. Dashboard 8 张等权图表，缺乏"主指标 + 行动"的层次

- 位置：`apps/web/src/app/dashboard-content.tsx:96`
- 类别：信息架构 / 品牌叙事
- 描述：当前 dashboard = 4 张相同尺寸的 stat card + 8 张相同尺寸（`lg:grid-cols-2`）的图表。视觉上每个数据点重要性相同，用户进入首屏看不到"今天最该看什么"。
- 影响：作为家庭风险管理工具，dashboard 应回答"我家保障够不够、未来 30 天要做什么、谁的保障有缺口"——当前回答的只是"我家有多少份保单按各种维度的分布"。
- 建议：
  - 顶部新增一块"家庭保障健康度"主区域：保费占年收入比例的环形进度（用上 `annualIncome` 设置）+ 1 句叙事化结论（"低于 / 高于建议区间"）。
  - 第二屏"未来 30 天行动项"：到期保单卡片（点击直达保单）、未投保成员的提示（"父亲尚未配置医疗险"）。
  - 现有 8 张分布图压缩或折叠为"分布详情"二级区域。
  - 4 张 stat card 引入趋势 sparkline 或对比（vs. 去年同期），消除"四个孤立数字"感。

### 2. 保单列表 13 列，列收纳策略不足

- 位置：`apps/web/src/app/policies/page.tsx:629`
- 类别：信息密度 / 桌面端可用性
- 描述：list 视图列头依次为：状态、类型、产品名称、保险公司、投保人、被保人、保额、年保费、生效日期、下次缴费、备注（仅 xl）、附件、操作。13 列在 1280–1600px 视口下出现紧促或水平滚动，备注列又只在 xl 以上展示。
- 影响：扫读困难、信息优先级模糊；分组视图（byCategory/byInsured）的存在恰好说明 list 视图本身已无法独立支撑。
- 建议：
  - 默认视图改为"卡片式行"——一行只展示：被保人头像 + 产品名 + 保险公司 + 年保费 + 下次缴费状态。其余字段悬停展开或在详情页查看。
  - 提供密度切换器（紧凑表格 / 舒适列表 / 卡片）持久化到 localStorage（已有 viewMode，可扩展）。
  - 把"附件、操作"两列从尾部独立列改为 row hover 时浮出的 action bar，省 2 列空间。

### 3. 就诊记录 12 列、症状色硬编码、时间维度冗余

- 位置：`apps/web/src/app/medical-visits/page.tsx:88`、`apps/web/src/app/medical-visits/page.tsx:341`
- 类别：信息密度 / 设计系统收口
- 描述：
  - 表格 12 列：就诊人 / 类型 / 月龄 / 距今 / 时间 / 原因 / 医院 / 医生 / 症状 / 诊断 / 治疗 / 操作。其中"月龄、距今、时间"三个时间相关字段并存。
  - `SYMPTOM_COLORS` 是一个 6 色 hardcoded 数组（`bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300` …），完全绕开 design token。
- 影响：横向阅读疲劳；症状色板与 badge variants、chart palette 三套色彩并存，整体观感凌乱；暗色模式下症状色亮度与就诊记录其他文字不协调。
- 建议：
  - 主表格压缩到 7 列（合并"月龄/距今"为一栏副标，合并"症状/诊断/治疗"为悬停卡片或时间轴 timeline 视图）。
  - 症状色板统一到 `chart-1..N` 或 `badge-*` token，按症状名稱哈希着色（与 avatar 颜色一致的策略）。
  - 这个页面非常适合"时间轴 timeline 视图"作为主视图——按月聚合的就诊记录卡片，比表格更贴合"翻看孩子从去年到现在的就诊"用例。

### 4. 续保日历名为"日历"，但没有日历视图

- 位置：`apps/web/src/app/renewal-calendar/page.tsx`
- 类别：信息架构 / 名实相符
- 描述：当前 = SummaryCards + MonthlyChart（柱状图）+ MonthlyDetails（按月分组的列表）。整个页面没有真正的"日历"视觉。
- 影响：用户期待与实际不符；"未来 12 个月续保计划"的时间感被柱状图弱化，用户无法直观回答"九月有几笔、分别是哪天"。
- 建议：
  - 加一个 12 月小日历 grid（每个月一个 card，cell 上点出有续保的日子）作为主视图，柱状图作为辅视图。
  - 或者改用横向 12 月时间轴（timeline），保单按金额尺寸落在月份格子里。

### 5. 品牌温度缺位——空态、首屏、辅助文字都"性冷淡"

- 位置：`apps/web/src/app/dashboard-content.tsx:97`、`apps/web/src/app/policies/page.tsx:601`、各页面空态
- 类别：品牌叙事 / 视觉差异化
- 描述：
  - Dashboard 标题 = "仪表盘"、"家庭保障概览"——通用 SaaS 文案。
  - 所有空态都是 `<lucide icon class="text-muted-foreground/50"> + 标题 + 灰色 p`，无差别复用。
  - 顶栏的问候、首屏的家庭维度（"今天是 X 月 X 日，您的家庭保障概览如下"）等温度感元素全部缺失。
- 影响：与目标用户画像（40 岁、上有老下有小、关心家庭风险）的情感预期不匹配；产品当前更像"个人理财工具"，不像"家庭守护工具"。
- 建议：
  - 顶栏增加"早上好，{用户名}"问候 + 家庭成员头像组（点击切换到 coverage-lookup）。
  - 空态插画系统化——为"暂无保单/暂无成员/暂无就诊记录"设计 3-5 张半色调插画，传递"家、守护、计划"概念。哪怕是订阅 unDraw 同色系然后改色都比 lucide stroke 强。
  - 复制改写：以家庭维度而非保单维度发声。"已为家中 5 位成员守护 12 份保单" 比 "共 12 份保单" 更有意义。

---

## Medium

### 6. 删除按钮内联 destructive class 没有用上组件能力

- 位置：`apps/web/src/app/policies/page.tsx:955`、`members/page.tsx:340`、`assets/page.tsx:253`、`medical-visits/page.tsx:534`、`hospitals/page.tsx`、`doctors/page.tsx`、`insurers/page.tsx`、`apps/web/src/components/attachments/attachment-section.tsx:154`（共 8 处）
- 类别：设计系统收口
- 描述：以上 8 处删除确认按钮都内联写 `className="bg-destructive text-destructive-foreground hover:bg-destructive/90"`。但 `apps/web/src/components/ui/alert-dialog.tsx:146-160` 已经透传 `variant`/`size` 到 `Button`，组件本身已支持 `<AlertDialogAction variant="destructive">`，且 CLI、coverage-section、payments-section、database-settings 等地方已经用了正确写法——只是没人统一收口。
- 影响：未来调整 destructive 视觉时需要改 8 处；新人写新页面时还会继续复制。
- 建议：把上述 8 处内联 class 迁移为 `<AlertDialogAction variant="destructive">`，无需再封一层。

### 7. Sidebar 分组标题对中文不友好

- 位置：`apps/web/src/components/layout/sidebar.tsx:110`
- 类别：CJK 排版
- 描述：`text-xs font-medium uppercase tracking-wider` 是经典英文 SaaS sidebar 模板。但分组标题是中文（如"家庭"、"医疗"、"开发者"），uppercase 对中文无效，`tracking-wider` 反而拉开 CJK 字间距，破坏可读性。
- 建议：CJK 分组用普通字距，或使用 `font-medium text-[11px] text-muted-foreground/60` 风格；只在英文 label 时才 uppercase。

### 8. CJK 字体栈未显式声明

- 位置：`apps/web/src/globals.css:306`
- 类别：CJK 排版 / 跨设备一致性
- 描述：`body { font-family: var(--font-inter), "Inter", system-ui, -apple-system, sans-serif; }`。Inter 不覆盖 CJK，中文走 system-ui，结果是 macOS 用 PingFang SC，Windows 用微软雅黑，Linux 用 Noto Sans CJK——三种字形差异显著。
- 建议：显式声明 `"Inter", -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif`，并把中文行高从默认 1.5 提到 1.7 左右（baoyu-design 规范条款）。

### 9. 设置 / CLI / 续保 / 保单详情 / 表单页大量绕开 token 的硬编码颜色

- 位置（主要残留点，不一定穷尽）：
  - icon 容器：`apps/web/src/app/settings/page.tsx:178`（橙）、`cli/page.tsx:160`（蓝）、`cli/page.tsx:207`（橙）、`settings/components/database-settings.tsx:92`（蓝）、`settings/components/backy-settings.tsx:207-208`（紫，含 `text-violet-500`）。
  - 状态卡片：`settings/components/database-settings.tsx:141,148`、`settings/components/backy-settings.tsx:246,290-291,312-313`（红/绿成对硬编码）。
  - 表单警告：`apps/web/src/app/medical-visits/visit-sheet.tsx:564`（`bg-yellow-500/10 text-yellow-700 dark:text-yellow-400`）。
  - 续保模块：`apps/web/src/components/renewal/summary-cards.tsx:21-22`（`text-amber-500` / `text-emerald-500`）、`renewal/monthly-details.tsx:101,106`（同色对）。
  - 保单详情：`apps/web/src/components/policy-detail/timeline-column.tsx:189`（`text-emerald-500`）、`policy-detail/payments-section.tsx:488`（`text-emerald-600`）。
  - 附件 icon：`apps/web/src/components/attachments/attachment-list.tsx:25`（蓝/红 icon 颜色）、保单页 picker 的 `text-blue-500` `text-red-500`（`policies/page.tsx:1007,1009`）。
  - 症状色板 6 色循环：`apps/web/src/app/medical-visits/page.tsx:88-95`。
- 类别：设计系统收口
- 描述：HSL token 体系已就绪（已有 `--success`/`--warning`/`--info`/`--purple`/`--teal`/`--badge-red` + 24 chart 色），但上面这些位置都没用，全部走 Tailwind 直颜色类（`bg-orange-500/10` `border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950` `bg-yellow-500/10` `text-amber-500` `text-emerald-500/600` `text-violet-500` ...）。涉及文件至少 settings + cli + medical-visits + visit-sheet + attachment-list + renewal + policy-detail 共 7 个目录、25+ 处。
- 影响：暗色模式表现各异（部分有 dark: 变体，部分没有）；未来换主题/换色板要改 25+ 处；视觉风格不可预测。续保和保单详情里的 amber/emerald 还语义同等于 `--warning`/`--success`，但绕开 token，换主题立刻断裂。
- 建议：
  - icon 容器一律收敛到 `bg-{semantic}/10 text-{semantic}`，新增 `--accent-warning`/`--accent-info` 之类 token 即可。
  - 状态卡片用 `<Alert variant="success|destructive">` 之类的语义组件统一封装，禁止页面层写 `border-red-200 bg-red-50 ...`。
  - amber → `--warning`、emerald → `--success` 直接替换。
  - 表单警告复用 `--warning` token。
  - 症状色板按 hash 取自 chart palette。

### 10. 暗色模式 primary 与 chart-1 同色

- 位置：`apps/web/src/globals.css:227`、`globals.css:267`
- 类别：暗色模式 / 数据可视化
- 描述：dark mode 下 `--primary: 15 65% 48%`，`--chart-1: 15 75% 48%`——两者只差饱和度。当 dashboard 把 primary 色按钮、tooltip 与 chart-1 的环形/柱状图同屏时，会出现"按钮 = 第一种险种"的视觉同色冲撞。
- 建议：让 chart-1 偏 18-22 度色相（向橙偏一格），与 primary 拉开。

### 11. Dashboard StatCard 信息密度过低

- 位置：`apps/web/src/app/dashboard-content.tsx:34`
- 类别：信息架构
- 描述：每张 stat card = label + value + icon。没有趋势、占比、目标对比。"4 张数字卡片" 是最典型的 AI 模板符号。
- 建议：
  - "保费总额"加一行："占家庭年收入 8.3% · 建议 10-15%"。
  - "保单数"加一行 sparkline 显示 6 个月增长。
  - "家庭成员"加 mini avatar group 而非数字。
  - "保障总额"加风险分类拆分（人身/财产）。

### 12. Coverage Lookup 紧急场景 UX 与日常 CRUD 同尺度

- 位置：`apps/web/src/app/coverage-lookup/page.tsx`
- 类别：场景化设计
- 描述：产品文案明确说"紧急情况下快速定位联系方式"，但 UI 完全是普通管理界面尺度——成员选择器、Switch 开关、分类卡片，字号 14px，操作流程平均 3 次点击。
- 影响：紧急场景应当一秒可读、零思考。
- 建议：
  - 顶部固定"紧急联系电话"大号区块（保险公司客服 + 家庭医生）。
  - 字号整体放大（保单产品名 18px+、保单号 monospace 16px+）。
  - 切换器（成员/资产）用更大的 segmented control。
  - 新增"复制全部信息到剪贴板"快捷操作。

### 13. 顶栏过于稀疏，缺少全局 quick action

- 位置：`apps/web/src/components/layout/app-shell.tsx:66`
- 类别：信息架构
- 描述：h-14 顶栏只有 breadcrumbs + DbSelector + GitHub + ThemeToggle。当数据量增长（50+ 份保单），用户会需要：全局搜索、"+新增保单"快捷入口、即将到期提醒徽标。
- 建议：
  - 加 `Cmd+K` 触发的 command palette（搜索保单/成员/医院、快捷新增）。
  - 顶栏右侧加个铃铛 icon，未来 30 天到期数 > 0 时点亮。

### 14. 筛选区"标签:Select"模式占首屏空间过大

- 位置：`apps/web/src/app/policies/page.tsx:487`
- 类别：移动端可用性 / 桌面密度
- 描述：保单页 5 个 Select（投保人/被保人/类型/资产/状态）平铺，每个前面都有 `<span class="text-sm text-muted-foreground">投保人:</span>` label。在 mobile（flex-wrap）情况下要占接近 200px 高，把列表本身挤到下方。
- 建议：
  - 桌面：用 filter chip（应用一个变成 `[投保人: 张三 ×]`），未应用时合并到一个"筛选"按钮。
  - 移动端：完全收纳进 sheet，触发按钮带筛选数量徽标。

### 15. 保单详情页四列等宽，纵向阅读跳跃

- 位置：`apps/web/src/app/policies/[id]/page.tsx:115`
- 类别：信息架构
- 描述：`md:grid-cols-2 xl:grid-cols-4` 把 Meta（基础信息）、Timeline（时间）、Coverage（保障内容）、Payments（缴费记录）四列等宽并列。问题：
  - Meta 列内部有 4 个 section（基础/人物/财务/受益人），高度高；Coverage 和 Payments 内容相对短，造成留白。
  - 用户阅读"产品名 → 保险公司 → 投保人 → 保额 → 保障明细"是有顺序的，四列同时呈现要求眼睛在四个区域来回跳。
- 建议：左 60% 主区 = Meta + Coverage（核心保障内容），右 40% 边栏 = Timeline + Payments（动态记录）。

### 16. 表格 hover 颜色不统一

- 位置：`apps/web/src/app/policies/page.tsx:652`、`medical-visits/page.tsx:370`、`policies/page.tsx:875`
- 类别：设计系统收口
- 描述：表格 row hover 出现至少 4 种实现：`hover:bg-background/50`、`hover:bg-muted/30`、`hover:bg-muted/50`、`hover:bg-accent`。
- 建议：在 globals 加 `--row-hover` token 或在 `<TableRow>` 组件本身决定 hover，子页面不再 override。

### 17. Avatar 色板与 chart 色板各管各的

- 位置：`apps/web/src/lib/utils.ts:getAvatarColor`、`apps/web/src/lib/chart-config.ts`
- 类别：视觉系统统一
- 描述：成员 avatar 用 `getAvatarColor(name)` 哈希到固定色集；dashboard "成员保费分布" 用 chart-1..N。同一个家庭成员"张伟"在头像里是某色、在堆叠图里是另一色。
- 影响：dashboard 上 12 个图表"图例 = 成员名"时，头像色与图块色不一致，违反"同一实体同一颜色"的可视化原则。
- 建议：把 avatar 色板与 chart 色板对齐——`getAvatarColor(name)` 哈希出来的 index 直接复用 `chart-{n}` token。

---

## Low

### 18. 列表"产品名跳详情 + Info button 跳详情"双入口

- 位置：桌面操作列详情入口 `apps/web/src/app/policies/page.tsx:786`；移动卡片"详情"按钮 `policies/page.tsx:122`；产品名本身可跳详情（桌面 `policies/page.tsx:663`、移动 `policies/page.tsx:122` 上方按钮）。
- 类别：交互冗余
- 描述：桌面行 = 产品名按钮跳详情 + 操作列 Info icon button 跳详情；移动卡片 = 产品名按钮跳详情 + 底部"详情"按钮跳详情。两个入口指向同一目的地。
- 注：产品名右侧那个小 Info icon（`policies/page.tsx:673,680`）不是详情入口，是复制保单号——不在本条建议范围。
- 建议：保留产品名 hover 强调即可，删除桌面操作列的 Info button 和移动卡片底部"详情"按钮，把腾出的空间还给"复制保单号"或附件入口。

### 19. 同一行 2 个 Badge + Avatar + 主标题 + 副标题视觉噪声

- 位置：`apps/web/src/app/policies/page.tsx:651-718`
- 类别：信息密度
- 描述：保单 row 同时有"状态 Badge + 类型 Badge + 投保人 avatar + 投保人名 + 被保人 avatar + 被保人名 + 产品名 + 保险公司"。颜色过载。
- 建议：状态用左侧 1px 色条代替 Badge；类型只在分组视图中保留 Badge；list 视图产品名前加 1 个类型小色点即可。

### 20. 双层 Dialog 选择附件流程繁琐

- 位置：`apps/web/src/app/policies/page.tsx:983`
- 类别：交互流程
- 描述：保单有多个附件时，先弹一个"选择附件"Dialog，选完再弹"附件预览"Dialog。
- 建议：附件按钮直接 hover popover 列出缩略图清单，点击切换预览。或在预览 Dialog 内置左侧附件列表。

### 21. CLI 入口对终端用户偏显眼

- 位置：`apps/web/src/lib/navigation.ts:50-56`、`App.tsx:35`
- 类别：信息架构
- 描述：当前 sidebar 把 CLI 和"系统设置"都放在"系统"分组下，且 `defaultOpen: true`。CLI 是给 AI / 脚本用户的入口，对 99% 终端用户是噪声。
- 建议：把"系统"重命名为"开发者"或拆分（"系统"留 settings、新建"开发者"分组放 CLI）并 `defaultOpen: false`；或把 CLI 入口移入设置页内 tab，sidebar 不暴露。

### 22. dashboard 首屏 stat card 串行 fade-up 动画延时累计

- 位置：`apps/web/src/app/dashboard-content.tsx:38`
- 类别：性能感知 / 动效偏好
- 描述：4 张 stat card 以 80ms 递增 delay 串行 fade-up，最后一张要等 240ms 才开始动画。下方 8 张图表实际并未应用 `animate-fade-up`，只有 stat card 区域有这个动画。
- 影响：低优先级。在快速翻页或 dashboard 重渲染场景下，串行 stagger 让首屏感知略钝。
- 建议：如果保留 stagger，把 delay 缩到 40ms；或改为 4 张同时 fade-up（去掉 index 倍数）；尊重 `prefers-reduced-motion`。

### 23. `body.style.overflow` 直接命令式修改

- 位置：`apps/web/src/components/layout/app-shell.tsx:36`
- 类别：实现细节
- 描述：mobile sidebar 打开时通过 `document.body.style.overflow = "hidden"` 锁滚动。
- 影响：与 React 状态流脱节；如果用户打开 sidebar 时浏览器崩溃或路由跳转失败，可能留下 body 不可滚动状态。
- 建议：改用 Tailwind class（在 body 上 toggle `overflow-hidden`）或直接依赖 Radix Sheet 自身的 scroll lock。

### 24. 设置页"保存设置"按钮缺乏 dirty 状态识别

- 位置：`apps/web/src/app/settings/page.tsx:224`
- 类别：交互细节
- 描述：用户没改任何东西时，"保存设置"按钮也是亮的；改了之后没有"unsaved" 视觉提示，用户切走时会丢改动。
- 建议：增加 dirty 检测，未改动时按钮 disable；有 dirty 时顶部加"未保存的修改"banner（页面切换时拦截）。

---

## 路线图建议（按 ROI 排序）

下面是个排期建议，方便挑下一轮 sprint 着手：

**第一周（视觉 token 收口、零品牌成本）** — ✅ 已完成 (2026-06-09)
- ✅ 问题 6（AlertDialogAction 收口，8 处统一为 variant="destructive"）
- ✅ 问题 9（settings/cli/visit-sheet/attachment-list 硬编码色 → 语义 token；新增 Notice 组件覆盖 6 处 red/green 状态卡片；medical-visits 症状色 → hash + chart palette）
- ✅ 问题 10（dark + light mode chart-1 偏移到橙系，避免与 primary 同色冲撞）
- ✅ 问题 16（TableRow hover 收回组件默认值，7 个页面去掉冗余声明；policies 两处 list-row outlier 对齐）
- ✅ 问题 17（avatar 与 chart palette 共用 hash + 16 色，新增 getChartColorForName）
- ✅ 问题 8（CJK 字体栈显式声明 PingFang/Microsoft YaHei/Noto Sans SC）

**第二周（信息密度调整、提升日常使用体验）**
- 问题 2（保单密度切换 + 卡片视图）、3（医疗就诊时间轴视图）、14（filter chip 化）、15（保单详情布局调整）。

**第三-四周（品牌叙事、做出差异化）**
- 问题 1（Dashboard 重新设计为"健康度 + 行动项"）、5（品牌化空态插画 + 顶栏问候）、12（保障速查紧急 UI）、13（command palette）、4（续保日历加真日历）。

**长期债务**
- 问题 7（sidebar CJK 排版）、11（StatCard 升级带趋势）、19（行内 Badge 减负）、21（CLI 折叠）、24（dirty 检测）。

## 附：与上一轮 07 报告的关系

[07-impeccable-audit-report.md](./07-impeccable-audit-report.md) 关注的是"实现质量"（假保存、render 阶段 fetch、移动端可访问性、硬编码颜色等），评分 7/10。本报告关注的是"设计提升机会"（信息架构、品牌叙事、密度策略、CJK 排版），评分 7.5/10。

两份报告在 token 收口这一条上有交集——07 第 5 条已经标记"主题系统已建立但页面层有大量硬编码颜色"且状态写"部分修复"；本报告的问题 9 是这条的设计角度延伸，列出仍未收口的主要残留点（settings + cli + medical-visits + visit-sheet + attachment-list + renewal + policy-detail 共 25+ 处），并提出"语义 token + Alert 组件"的收口路径。其余结论（dashboard 重新设计、密度策略、品牌叙事、CJK 字体栈、Coverage Lookup 紧急 UI 等）07 报告未涉及。

建议在 07 修复完成后，按本报告路线图开下一轮设计迭代——其中第一周的 token 收口可以与 07 第 5 条合并到同一个 PR。
