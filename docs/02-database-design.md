# 数据库设计

## 概述

基于 SQLite + Drizzle ORM 的本地化数据存储方案。

## 实体关系

```
members (家庭成员/受益人)
    ↓
policies (保单) ← assets (财产，仅财产险)
    ↓
├── beneficiaries (受益人关联)
├── payments (缴费记录)
├── cash_values (现金价值)
└── policy_extensions (险种特有字段)

settings (全局设置，KV存储)
```

---

## 表结构定义

### 1. members（家庭成员）

家庭成员既是被保人，也可作为受益人。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| name | TEXT NOT NULL | 姓名 |
| relation | TEXT NOT NULL | Self/Spouse/Child/Parent |
| gender | TEXT | M/F |
| birthDate | DATE NOT NULL | 出生日期 |
| idCard | TEXT | 身份证号（可选） |
| phone | TEXT | 手机号（可选） |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

### 2. assets（财产）

仅用于财产险标的（房产、车辆），不是家庭全部资产。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| type | TEXT NOT NULL | RealEstate / Vehicle |
| name | TEXT NOT NULL | 别名（如"家里的车"） |
| identifier | TEXT NOT NULL | 房产地址 / 车牌号 |
| ownerId | INTEGER FK | 所有人 → members |
| details | TEXT | 补充信息（VIN、面积等） |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

### 3. policies（保单）

保单主表，存储所有类型保单的通用信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| **角色关联** | | |
| applicantId | INTEGER FK NOT NULL | 投保人 → members |
| insuredType | TEXT NOT NULL | Member / Asset |
| insuredMemberId | INTEGER FK | 被保人（人身险）→ members |
| insuredAssetId | INTEGER FK | 被保资产（财产险）→ assets |
| **产品信息** | | |
| category | TEXT NOT NULL | Life/CriticalIllness/Medical/Accident/Annuity/Property |
| insurerName | TEXT NOT NULL | 保险公司 |
| productName | TEXT NOT NULL | 产品名称 |
| policyNumber | TEXT UNIQUE NOT NULL | 保单号 |
| **保障信息** | | |
| sumAssured | REAL NOT NULL | 保额 |
| **缴费信息** | | |
| premium | REAL NOT NULL | 每期保费 |
| paymentFrequency | TEXT NOT NULL | Single/Monthly/Yearly |
| paymentYears | INTEGER NOT NULL | 缴费年限 |
| totalPayments | INTEGER NOT NULL | 总期数 |
| **时间维度** | | |
| effectiveDate | DATE NOT NULL | 生效日期 |
| expiryDate | DATE | 终保日期（终身险为空） |
| hesitationEndDate | DATE | 犹豫期结束日 |
| waitingDays | INTEGER | 等待期天数 |
| **状态** | | |
| status | TEXT NOT NULL DEFAULT 'Active' | Active/Lapsed/Surrendered/Claimed |
| **附加** | | |
| policyFilePath | TEXT | 电子保单路径 |
| notes | TEXT | 备注 |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

**险种分类说明**：

| category | 中文 | 说明 |
|----------|------|------|
| Life | 寿险 | 定期寿险、终身寿险、两全保险 |
| CriticalIllness | 重疾险 | 重大疾病保险 |
| Medical | 医疗险 | 百万医疗、门诊险 |
| Accident | 意外险 | 意外伤害保险 |
| Annuity | 年金险 | 养老年金、教育年金 |
| Property | 财产险 | 家财险、车险 |

### 4. beneficiaries（受益人）

保单受益人关联表，支持多受益人、比例分配和顺位。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| policyId | INTEGER FK NOT NULL | → policies |
| memberId | INTEGER FK | 家庭成员 → members |
| externalName | TEXT | 非家庭成员姓名 |
| externalIdCard | TEXT | 非家庭成员身份证 |
| sharePercent | REAL NOT NULL | 受益比例（如 50.0 表示 50%） |
| rankOrder | INTEGER NOT NULL | 顺位（1=第一顺位，2=第二顺位） |

> 注：memberId 和 externalName 二选一，家庭成员优先使用 memberId 关联。

### 5. payments（缴费记录）

缴费计划与实际缴费记录，与保单联动。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| policyId | INTEGER FK NOT NULL | → policies |
| periodNumber | INTEGER NOT NULL | 第几期（从1开始） |
| dueDate | DATE NOT NULL | 应缴日期 |
| amount | REAL NOT NULL | 应缴金额 |
| status | TEXT NOT NULL DEFAULT 'Pending' | Pending/Paid/Overdue |
| paidDate | DATE | 实际缴费日期 |
| paidAmount | REAL | 实际缴费金额 |

**缴费计划生成逻辑**：

1. 创建保单时，根据 `effectiveDate` + `paymentFrequency` + `totalPayments` 自动生成全部期数
2. 用户标记已缴时，更新 `paidDate`、`paidAmount`、`status=Paid`
3. 宽限期计算：`dueDate + 60天` 内未缴则 `status` 变为 `Overdue`

### 6. cash_values（现金价值）

储蓄型保单的年度现金价值记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| policyId | INTEGER FK NOT NULL | → policies |
| policyYear | INTEGER NOT NULL | 第N个保单年度 |
| value | REAL NOT NULL | 现金价值 |

> 适用于：终身寿险、年金险等具有现金价值的储蓄型保单。

### 7. policy_extensions（险种特有字段）

存储各险种的特有字段，采用 JSON 格式，便于后续扩展。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| policyId | INTEGER FK UNIQUE NOT NULL | → policies（1:1 关系） |
| data | TEXT (JSON) NOT NULL | 险种特有字段 |

**各险种扩展字段示例**：

```json
// 医疗险
{
  "deductible": 10000,
  "guaranteedRenewalYears": 6,
  "hospitalScope": "public_secondary_above",
  "includesOutpatient": false
}

// 重疾险
{
  "payoutTimes": 3,
  "mildSeverityRatio": 0.3,
  "waitingDays": 90,
  "premiumWaiver": true
}

// 意外险
{
  "accidentalMedicalSum": 50000,
  "hospitalAllowancePerDay": 200,
  "includesSuddenDeath": true
}

// 车险
{
  "compulsoryInsuranceExpiry": "2025-03-15",
  "thirdPartyLiabilitySum": 2000000,
  "vehicleDamageSum": 150000
}
```

### 8. settings（全局设置）

通用 KV 存储，用于站点设置、用户偏好等。

| 字段 | 类型 | 说明 |
|------|------|------|
| key | TEXT PK | 设置键 |
| value | TEXT (JSON) NOT NULL | 设置值 |
| updatedAt | TIMESTAMP | 更新时间 |

**预设 key 示例**：

| key | 说明 | value 示例 |
|-----|------|------------|
| `annualIncome` | 家庭年收入（用于缺口分析） | `{"amount": 500000}` |
| `site` | 站点设置 | `{"theme": "light", "currency": "CNY"}` |
| `notifications` | 提醒设置 | `{"renewalDays": 30, "enabled": true}` |

---

## 索引策略

```sql
-- 保单查询优化
CREATE INDEX idx_policies_status ON policies(status);
CREATE INDEX idx_policies_category ON policies(category);
CREATE INDEX idx_policies_expiry ON policies(expiryDate);

-- 缴费记录查询优化
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_due ON payments(dueDate);
CREATE INDEX idx_payments_policy ON payments(policyId);
```

---

## 表总览

| 表 | 用途 | 关系 |
|----|------|------|
| members | 家庭成员 | 被保人、投保人、受益人 |
| assets | 财产险标的 | 房产、车辆 |
| policies | 保单主表 | 核心表 |
| beneficiaries | 受益人关联 | policies 1:N |
| payments | 缴费记录 | policies 1:N |
| cash_values | 现金价值 | policies 1:N |
| policy_extensions | 险种特有字段 | policies 1:1 |
| settings | 全局设置 | 独立 KV 存储 |

共 **8 张表**。
