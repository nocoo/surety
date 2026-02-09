# Surety

家庭保单管理工具。极简、本地化、隐私安全。

## 目标用户

40岁软件开发者，上有老下有小，关注家庭风险管理。

## 技术栈

| 组件 | 选型 |
|------|------|
| Runtime | Bun |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (严格模式) |
| Database | SQLite + Drizzle ORM |
| UI | Tailwind CSS + shadcn/ui |
| Deployment | Localhost:7015 |

## 三层测试框架

| 层级 | 工具 | 触发时机 | 要求 |
|------|------|----------|------|
| UT | bun test | pre-commit | 覆盖率 90%+ |
| Lint | eslint | pre-push | 零错误零警告 |
| E2E | 待定 | pre-push | BDD 模式 |

### 核心原则

1. **尽早发现** — 不积累技术债
2. **自主解决** — 不依赖人工 review 发现低级错误
3. **质量门禁** — 问题代码无法进入主分支

## 常用命令

```bash
bun dev              # 开发服务器 (7015)
bun run build        # 生产构建
bun test             # 单元测试 (含 MCP)
bun test --coverage  # 测试覆盖率
bun run test:mcp     # MCP 单元测试
bun run test:mcp:e2e # MCP E2E 测试
bun run lint         # ESLint
bun run db:push      # 推送 schema
bun run db:studio    # 数据库可视化
bun run mcp          # 启动 MCP Server (stdio)
```

## Retrospective

- **主动维护文档结构**：docs 目录下文件使用编号命名（如 `01-xxx.md`、`02-xxx.md`），便于阅读顺序；同时在根目录 README.md 中维护项目结构树，保持文档与代码同步更新。
- **SQLite 路径必须用绝对路径**：SQLite 的相对路径基于 `process.cwd()` 而非源码位置。MCP Server 或其他外部进程从不同目录启动时，会在错误位置创建空数据库文件。解决方案：用 `import.meta.url` 推导项目根目录，拼接绝对路径。同时 `createDatabase()` 应自动调用 `initSchema()`（`CREATE TABLE IF NOT EXISTS` 幂等），防止空数据库无表。