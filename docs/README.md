# Surety 文档

[中文项目说明](../README.md) · [English README](README.en.md)

当前入口是[开发、认证与部署](20-development.md)。较早的 Next.js、Worker 数据库代理和远程测试设计保留演进背景；不要用这些历史说明初始化当前环境。

| 文档 | 内容 |
| --- | --- |
| [01 · 产品设计](01-design-overview.md) | 家庭保障管理的页面与模型背景 |
| [02 · 数据库设计](02-database-design.md) | 数据关系；当前字段以 `packages/db/src/schema.ts` 为准 |
| [05 · Basalt 迁移](05-basalt-ui-migration.md) | 界面设计系统迁移 |
| [06 · 测试改进](06-testing-improvement-plan.md) | 历史测试计划 |
| [07 · 界面审查](07-impeccable-audit-report.md) | 历史设计审查 |
| [11 · SQLite 到 D1](11-sqlite-to-d1-migration.md) | 早期数据层迁移背景 |
| [12 · 测试体系调整](12-quality-system-upgrade.md) | 历史测试方案 |
| [14 · 保单附件](14-policy-pdf-attachment.md) | 附件功能设计；当前还支持 JPEG / PNG |
| [15 · 就诊记录](15-medical-visits-module.md) | 医院、医生与就诊模块 |
| [16 · MCP 到 CLI](16-cli-replace-mcp.md) | CLI 迁移背景 |
| [17 · 测试改进计划](17-quality-to-S.md) | 测试演进记录 |
| [18 · 设计审查](18-design-audit-baoyu.md) | 界面审查与调整 |
| [19 · 保单状态](19-policy-status.md) | 终止、到期和计划退保规则 |
| [20 · 开发与部署](20-development.md) | 当前环境、认证、测试、备份边界与发布 |

CLI 命令见 [apps/cli/README.md](../apps/cli/README.md)。
