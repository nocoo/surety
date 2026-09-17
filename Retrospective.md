# Retrospective

Accident narratives belong here. Keep only recurring project rules in `CLAUDE.md`; cross-project lessons belong in global rules and deterministic checks in hooks/tests.

Historical Next.js and remote-D1 test migrations below describe earlier implementations. Current automated L2/L3 uses local Wrangler and separate fixture state.


- **主动维护文档结构**：docs 目录下文件使用编号命名（如 `01-xxx.md`、`02-xxx.md`），便于阅读顺序；同时在根目录 README.md 中维护项目结构树，保持文档与代码同步更新。
- **Bun 特有 API 不可在 Next.js Server Runtime 使用**：`Bun.password.hash/verify` 是 Bun 独有 API，Next.js 的 server runtime 使用 Node.js 兼容层，`Bun` 全局对象不存在。此问题在开发阶段因 `bun dev` 运行正常而被掩盖，部署后在 API route 中触发 `ReferenceError`。解决方案：使用 `node:crypto` 的 `scrypt` + `timingSafeEqual` 替代。教训：在 Bun + Next.js 技术栈中，API route / middleware 代码必须只使用 Node.js 标准 API，Bun 特有 API 仅限构建脚本和独立进程使用。
- **SQLite .dump 导入 D1 必须带显式列名**：`sqlite3 .dump` 生成的 `INSERT INTO table VALUES(...)` 不含列名，按源库的列顺序排列。但 `drizzle-kit push` 创建的 D1 表列顺序由 schema.ts 定义顺序决定，与历史 SQLite 的列顺序不同。直接导入会导致值错位，触发 NOT NULL constraint 或数据写入错误列。解决方案：用脚本生成 `INSERT INTO table (col1, col2, ...) VALUES(...)` 格式。教训：跨数据库迁移数据时，永远不要依赖隐式列顺序。
- **sqlite-proxy "get" 方法的行映射陷阱**：Drizzle sqlite-proxy 的 callback 返回 `{ rows }` 时，`method === "get"` 期望 `rows` 是单个扁平行 `[1, "张伟", ...]`，而 `method === "all"` 期望行数组 `[[1, ...], [2, ...]]`。原实现用 `rows.slice(0,1)` 处理 "get"，但这返回 `[[1, "张伟", ...]]`（仍是数组包数组），导致 `.returning().get()` 返回 `id` 时得到整行数组而非标量值。修复：`method === "get" ? rows[0] : rows`。教训：sqlite-proxy 的 callback 返回格式文档不充分，必须读 `drizzle-orm/sqlite-proxy/session.cjs` 中的 `mapGetResult` 源码确认期望格式。
- **移除本地 SQLite 运行时的分阶段策略**：8 个原子 commit 从安全 guard → D1 dev 创建 → seed 脚本 → E2E 迁移 → UI 删除 → health check 异步化 → 本地代码删除 → 清理。关键决策：(1) 先加 E2E safety guard（Phase 1）防止迁移过程中 E2E 意外连 production；(2) E2E 全部走远程 D1 dev 而非本地文件，统一数据路径；(3) UT 保持 `bun:sqlite :memory:` 零改动（481+ test）。教训：大规模基础设施迁移必须先部署防护网再拆旧路径，每个 commit 独立可验证。
- **release.ts 的 bun install 会把镜像 URL 写进 bun.lock**：本机 IT 拦截 registry.npmjs.org，`bun run release` 必须带 `BUN_CONFIG_REGISTRY` 才能装依赖。Bun 会把镜像地址写进 lockfile 并随 `release: vX.Y.Z` 一起提交；CI 用 `--frozen-lockfile`，tag 部署也按该 commit 装包。v2.3.2 已用 follow-up commit 还原。教训：release 后立刻 `rg -c '", "https' bun.lock`，非 0 就从上一 commit 还原 lockfile 再推，不要让镜像 URL 留在 tag 上。
