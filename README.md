# Surety

家庭风险管理急救包。极简、本地化、隐私安全。

## 快速开始

```bash
bun install          # 安装依赖
bun dev              # 启动开发服务器 (localhost:7015)
```

## 项目结构

```
surety/
├── docs/                         # 项目文档
│   ├── 01-design-overview.md     # 整体设计研究报告
│   └── 02-database-design.md     # 数据库设计
├── drizzle/                      # 数据库迁移
│   └── 0000_flimsy_cloak.sql     # 初始化 SQL
├── src/
│   ├── __tests__/                # 单元测试
│   │   ├── db/                   # Repository 测试
│   │   └── utils.test.ts         # 工具函数测试
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API 路由
│   │   ├── globals.css           # 全局样式
│   │   ├── layout.tsx            # 根布局
│   │   └── page.tsx              # 首页
│   ├── components/               # UI 组件
│   ├── db/                       # 数据库层
│   │   ├── repositories/         # CRUD 方法 (8 张表)
│   │   ├── index.ts              # 数据库连接
│   │   ├── schema.ts             # Drizzle schema
│   │   └── types.ts              # 枚举类型定义
│   └── lib/                      # 工具函数
├── CLAUDE.md                     # AI 协作指南
├── drizzle.config.ts             # Drizzle ORM 配置
└── package.json
```

## 技术栈

| 组件 | 选型 |
|------|------|
| Runtime | Bun |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (严格模式) |
| Database | SQLite + Drizzle ORM |
| UI | Tailwind CSS + shadcn/ui |

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

## License

MIT
