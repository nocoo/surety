# Surety

家庭风险管理急救包。极简、本地化、隐私安全。

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
bun test             # 单元测试
bun test --coverage  # 测试覆盖率
bun run lint         # ESLint
bun run db:push      # 推送 schema
bun run db:studio    # 数据库可视化
```

## Retrospective

