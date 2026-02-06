.
├── docs/                    # 项目文档
├── public/                  # 静态资源
├── src/
│   ├── __tests__/          # 单元测试
│   ├── app/                # Next.js App Router
│   │   ├── api/            # API 路由
│   │   ├── globals.css     # 全局样式
│   │   ├── layout.tsx      # 根布局
│   │   └── page.tsx        # 首页
│   ├── components/         # UI 组件
│   ├── db/                 # 数据库层
│   │   ├── index.ts        # 数据库连接
│   │   └── schema.ts       # Drizzle schema
│   └── lib/                # 工具函数
│       └── utils.ts        # cn() 等通用工具
├── CLAUDE.md               # AI 协作指南
├── drizzle.config.ts       # Drizzle ORM 配置
├── package.json
└── tsconfig.json           # TypeScript 严格模式
