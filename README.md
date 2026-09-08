<p align="center">
  <img src="assets/brand/icon-rounded.png" width="128" alt="Surety logo" />
</p>
<h1 align="center">Surety</h1>
<p align="center">集中整理家庭保单、保障范围、缴费计划和就诊记录。</p>
<p align="center">
  <a href="https://surety.hexly.ai">站点</a> ·
  <a href="docs/README.en.md">English</a>
</p>

## 这是什么

Surety 是面向家庭的保单管理工具。将家庭成员、房屋车辆、保险公司与保单关联后，可以按人或资产查看保障，查找保单文件，并跟踪缴费、续保和就诊记录。

应用由一个 Cloudflare Worker 提供 React 页面和 Hono API，D1 保存结构化数据，R2 保存保单附件。一个实例中的登录用户共享同一组家庭资料；它没有按邮箱隔离不同家庭的数据。浏览器使用 Cloudflare Access 登录，Bun CLI 通过独立的 Bearer API 访问。

## 功能

- 管理家庭成员、保险公司、房产和车辆，将保单关联到被保险人或资产。
- 维护保障项目、保额、保费和缴费记录，生成后续缴费计划，按成员或资产速查保障。
- 在仪表盘和续保日历中查看保费、保障与待缴事项；记录退保、理赔终止、失效和计划退保。
- 上传、预览和下载 PDF、JPEG、PNG 保单附件，单个文件最多 50 MiB，每份保单最多 20 个附件。
- 记录医院、医生和家庭成员就诊情况。
- 导出 JSON 资料，配置 Backy 后手动推送备份并查看投递历史。

JSON 导出包含附件元数据和设置，不含 R2 文件或 API token。当前 Worker 的恢复接口尚未接入 D1 批量事务，不能作为可用的数据库恢复流程；详见[备份范围](docs/20-development.md#备份范围与恢复限制)。续保日历提供页面提示，没有自动发送邮件的任务。

## 使用

获得 Access 权限后打开[站点](https://surety.hexly.ai)。先添加家庭成员和资产，再录入保单、保障项目与缴费信息；保单详情页提供附件、状态变更和计划退保入口。

使用 CLI 需要 [Bun](https://bun.sh)：

```bash
bun add -g @nocoo/surety
surety login
surety members ls
surety policies ls
```

`login` 打开受 Access 保护的浏览器登录页，通过本机回调保存 token。普通数据命令输出 JSON，默认返回摘要，`--full` 返回完整 API 数据。写入命令接受 `--data`、`--data-file` 或标准输入。

CLI 默认登录域名为 `surety.hexly.ai`，数据 API 为 `surety-api.hexly.ai`。自行托管时需要分别配置登录地址和 API 地址，并适配 Worker 的域名判断。受益人当前只有读取入口；附件可通过网页上传，CLI 支持查询附件元数据和删除附件，删除时也会尝试移除 R2 文件。完整命令与当前限制见 [CLI README](apps/cli/README.md)。

## 开发

需要 Bun 和 Node.js 22.12+。Bun 安装 workspace 依赖，Vite、Vitest 与 Wrangler 使用 Node.js。

```bash
git clone https://github.com/nocoo/surety.git
cd surety
bun install --frozen-lockfile
bun run build
```

默认 `bun run dev` 只启动 Vite，并把 `/api` 代理到线上 API。先按[开发配置](docs/20-development.md#开发配置)设置自己的 `SURETY_API_URL` 与开发 token，再启动：

```bash
bun run dev
```

Vite 使用 7012 端口，仓库约定的开发入口为 `https://surety.dev.hexly.ai`。可单独用 `bun run dev:worker` 启动 7016 端口的本地 Worker，但数据库初始化和认证仍需配置。只验证本地行为时，使用下节会自行初始化数据的测试 runner。

主要代码位于 `apps/web/`、`apps/worker/`、`apps/cli/`、`packages/api/` 和 `packages/db/`。`build` 将 SPA 写入 `apps/worker/static/`；CLI 直接运行 TypeScript 源文件，无独立构建步骤。部署和 schema 管理见开发说明。

## 测试

先安装 workspace 依赖：

```bash
bun run test
bun test apps/worker/__tests__/e2e --path-ignore-patterns __none__
bun run test:l2:http
bunx playwright install chromium
bun run test:e2e:browser
```

Vitest 运行 web、Worker、CLI 和共享包单元测试；第二条命令用 Bun 内存 SQLite 测试 Hono 集成。HTTP runner 在本地 7017 启动 Worker，使用独立的 D1 / R2 状态。浏览器 runner 自动构建页面，在 27012 启动本地 Worker，并由 Playwright Chromium 访问。

保持这两个端口空闲。HTTP / 浏览器测试分别重建 `apps/worker/.wrangler/state-l2-http` 和 `state-l3`，只写入合成测试数据，无需生产凭据。不要将这些目录用于日常数据。

## 技术栈

| 技术 | 用途 |
| --- | --- |
| TypeScript / Bun workspaces | 应用代码、CLI 和本地工具 |
| Vite / React / React Router / SWR | SPA、路由与数据读取 |
| Tailwind CSS / Radix UI / Basalt / Recharts | 样式、界面组件与统计图表 |
| Hono / Cloudflare Workers | API、认证中间件与静态资源 |
| Drizzle ORM / Cloudflare D1 | 家庭、保单和就诊数据 |
| Cloudflare R2 | 保单附件 |
| Cloudflare Access / `@nocoo/base-cli` | 浏览器认证与 CLI 登录 |
| Vitest / Bun SQLite / Playwright | 单元、API 集成和浏览器测试 |

## 文档

- [文档索引](docs/README.md)
- [开发、认证与部署](docs/20-development.md)
- [CLI 命令与输出](apps/cli/README.md)
- [保单状态规则](docs/19-policy-status.md)

## 许可证

[MIT](LICENSE)
