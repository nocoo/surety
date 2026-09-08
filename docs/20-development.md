# 开发、认证与部署

[中文 README](../README.md) · [English README](README.en.md)

当前应用由一个 Hono Worker 同时提供 `/api/*` 与 Vite SPA。Worker 通过 Drizzle 的 D1 binding driver 访问数据库，R2 `ATTACHMENTS` 保存保单文件；早期 Next.js / 数据库 HTTP 代理不在当前网页请求链路中。

## 家庭与认证边界

成员、资产、保单和就诊记录没有按登录邮箱分区；一个实例服务一组共享的家庭资料。Cloudflare Access 控制哪些人能进入该实例，API token 允许脚本访问同一组数据。

浏览器使用 `surety.hexly.ai`，Worker 验证 Access JWT。`surety login` 在浏览器里打开 `/api/auth/cli`，通过 loopback 回调保存 token。数据命令使用 `surety-api.hexly.ai`，由 Bearer token 验证。铸造、列出或撤销 token 需要交互登录身份；设置页尚无 token 管理界面。

| 配置 | 作用 |
| --- | --- |
| Worker 的 `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` | Access JWT 的 issuer / audience 配置 |
| CLI 的 `SURETY_LOGIN_URL` 或 `login --login-url` | Access 保护的登录入口 |
| CLI 的 `SURETY_API_URL` 或 `login --api-url` | 接受 Bearer token 的数据 API |
| CLI 的 `SURETY_API_TOKEN` | 覆盖保存的 token |

Worker 的 `access-auth.ts` 当前将 `surety-api.hexly.ai` 写在机器访问域名判断中；自定义域名需要一起适配这个判断和 Cloudflare Access 边缘策略，仅修改 CLI 地址不够。浏览器的状态变更请求还要通过同源检查。

CLI 配置位于 `~/.config/surety/config.json`；当前源码依赖的 `@nocoo/base-cli` 在 `SURETY_CLI_DEV=1` 或 `true` 时选择同目录 `config.dev.json`，不会自动切换 API 地址。`logout` 当前通过合并写入保存配置，删除内存字段后可能仍保留旧 token；需要撤销凭据时，通过已登录浏览器调用 token 撤销 API，并从本地配置移除相应字段。不要把该命令的成功输出当作服务端撤销确认。

## 开发配置

需要 Bun 和 Node.js 22.12+。根目录执行 `bun install --frozen-lockfile` 安装所有 workspace 包。

`bun run dev` 启动 Vite 7012；其 `/api` 代理默认指向 `https://surety-api.hexly.ai`。如果提供了 `SURETY_DEV_API_TOKEN`，代理会在缺少 Authorization 的请求上注入 Bearer token，页面操作会直接读写对应服务的数据。

在根 `.env` 或适用的 Vite 环境文件中填写自己的开发实例：

```dotenv
SURETY_API_URL=https://api.surety.example
SURETY_LOGIN_URL=https://surety.example
SURETY_DEV_API_TOKEN=your-development-token
```

这里的 `.example` 域名是占位符。`SURETY_LOGIN_URL` 供 CLI / 登录流程使用，Vite 代理实际读取 API 地址和开发 token。根 `.env.example` 仍包含旧 NextAuth、Google OAuth 和 Worker 数据库代理字段；这些不是当前 SPA / Hono 运行所需配置，不必照搬。

仓库日常开发入口为 `https://surety.dev.hexly.ai`，需要自行准备 HTTPS 反向代理到 Vite 7012。Vite `allowedHosts` 也包含这一域名；自定义开发域名要对应调整配置。

`bun run dev:worker` 在 7016 启动 Wrangler。本仓库的 D1 / R2 binding 没有设置 `remote = true`，默认本地资源仍需要初始化。认证快捷路径会同时检查 Host 和 `request.cf`，不能笼统地认为任意 localhost 请求都能免认证。需要完整本地验证时使用隔离测试 runner，它们自行准备 schema、资源和测试认证。

## 测试与构建

根 README 给出了单元、内存数据库集成、HTTP 与浏览器测试命令。`test:l2:http` 调用 `scripts/run-l2-http.ts`，以显式 `--local --persist-to` 初始化 D1 并启动 7017，R2 也使用本地模拟存储。`test:e2e:browser` 由 Playwright 启动 `scripts/run-l3-server.ts`，构建 SPA 后在 27012 提供页面与 API。

两个 runner 分别重建包内 `.wrangler/state-l2-http` 和 `.wrangler/state-l3`。它们注入非生产环境的测试认证，使用合成记录；不要把生产凭据或家庭数据放入这些目录。浏览器测试需要先安装 Playwright Chromium，runner 会自行构建静态资源。

`bun run build` 只构建 Vite SPA，产物写入 `apps/worker/static/`。CLI 的 bin 直接指向 `apps/cli/src/index.ts`，需要 Bun，无独立 build。`packages/api` 保存视图计算与共享校验，实体读写路由在 Worker，数据 schema / repositories 位于 `packages/db`。

## 保单与附件

当前保单包含 Active、Lapsed、Surrendered、Claimed 状态，到期展示状态由有效期派生。终止与计划退保使用专门的 API，普通创建 / 更新不能绕过这些状态转换。网页提供相应操作，CLI 尚无专门状态转换子命令。

附件支持 PDF、JPEG 和 PNG，校验 MIME、大小和文件头；每个文件最多 50 MiB，每份保单最多 20 个。文件写入 R2，元数据写入 D1。网页与 Worker API 已支持上传和文件读取，CLI 的 ls / get 返回元数据，rm 删除附件记录并尝试删除 R2 文件；R2 删除失败不会使该接口报错。受益人 API 当前只有读取。

续保日历按有效保单的下次缴费日和频率生成未来月份数据，属于页面查询；当前 Worker 没有发送提醒邮件的定时任务。

## 备份范围与恢复限制

`GET /api/backup` 导出成员、保单、保障项目、缴费、现金价值、资产、保险公司、医院、医生、就诊、附件元数据和设置。它不包含 R2 附件文件，也不包含 `api_tokens`。设置会原样导出，可能包含 Backy 接入密钥等值。

Backy 的手动推送使用同一份 JSON，通过 multipart 上传到配置的 webhook；设置页可检查连接与查看历史。它不额外保存 R2 文件，没有独立的自动备份定时任务。

恢复函数设计为删除已有业务数据后完整替换，不是合并导入。当前 Worker 的 `POST /api/backup` 调用 `restoreBackup` 时未传入 D1 batch executor，因此执行到 `BEGIN TRANSACTION` 会失败并返回 500。此实现尚不能用于 D1 恢复；即使后续接好事务，也仍需另行恢复 R2 文件。不要将仅有 JSON 导出视为完整实例备份。

## 数据库与部署

新实例需要自己的 Cloudflare Worker、D1、R2、域名和 Access 配置。`apps/worker/wrangler.toml` 内的 `DB` / `ATTACHMENTS` 指向数据库和存储桶，需替换为自己的资源。浏览器认证变量还需在 Worker 环境中配置。

当前 schema 位于 `packages/db/src/schema.ts`。`bun run db:push` 使用 Drizzle 管理面；设置 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_DATABASE_ID`、`CLOUDFLARE_D1_TOKEN` 后直接写入所选远程数据库。它不是普通本地启动前置命令，也不由 `SURETY_TARGET_DB` 选择目标。

`bun run db:seed` 保留的是早期 Worker 数据库代理脚本，会清空目标业务表再写入演示数据；它不适配当前单 Worker 的直接 D1 请求路径。新环境验证用本地 runner，不沿用旧 README 的远程 seed 快速开始。

当前 [.github/workflows/release.yml](../.github/workflows/release.yml) 在 main CI 成功后构建和部署单个 Worker，也支持带版本 tag 的发布。main 路径检查 `/api/live` 返回 200；tag 路径还比对版本。Release 不执行 schema push 或数据库迁移，D1 schema 必须事先就绪。手动部署也需要先构建静态资源，再运行 Worker 包的 deploy 脚本。
