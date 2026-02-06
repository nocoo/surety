# 中国家庭保险保单管理系统架构与数据模型深度研究报告

## 摘要

随着中国家庭金融资产配置的多元化，保险作为风险对冲与财富管理的核心工具，其在家庭资产负债表中的占比日益提升。然而，由于保险产品本身的高度复杂性、条款的晦涩难懂以及跨保险公司管理的割裂性，普通家庭在保单管理上面临着巨大的挑战。

本文档旨在为开发一款基于Web的家庭保险保单管理产品提供详尽的架构设计与数据模型研究。报告深入调研了中国大陆市场的各类保险产品——涵盖人寿、健康、意外、财产及储蓄型保险，基于SQLite数据库设计了一套兼具灵活性与扩展性的数据架构。

本文不仅详细拆解了各类保险的核心字段与业务逻辑，还重点阐述了保单全生命周期管理（CRUD）、到期续期预警以及家庭保障缺口分析等高级评测功能的实现路径，为开发团队提供了一份从业务理解到技术落地的全方位指南。

---

## 第一章：引言与背景分析

### 1.1 行业背景与用户痛点

在中国金融市场日益成熟的背景下，家庭保险配置已从单一的"裸奔"状态转向多险种、多维度的立体防护体系。一个典型的中产家庭可能同时持有社会基本医疗保险（社保）、商业百万医疗险、重疾险、子女教育年金以及房车财产险。

这些保单往往分散在不同的保险公司（如中国人寿、中国平安、太平洋保险等）、不同的销售渠道（代理人、银行、互联网平台）以及不同的载体（纸质保单、电子PDF、APP内记录）中。

这种分散化导致了显而易见的**信息孤岛效应**：

- **信息不透明**：家庭成员往往不清楚彼此的具体保障内容，甚至在发生风险时遗忘保单存在。
- **续期风险**：由于缴费时间分散，极易因疏忽导致保单失效（Lapse），造成不可挽回的经济损失。
- **保障盲区**：缺乏统一的视图来评估家庭整体的风险敞口，导致某些风险（如意外）配置过剩，而核心风险（如定寿）配置不足。

### 1.2 系统设计目标

本研究报告的目标是指导开发一款能够解决上述痛点的Web端产品。该系统需具备以下核心能力：

| 能力 | 描述 |
|------|------|
| **全品类覆盖** | 支持中国大陆市场主流及非主流保险产品的结构化录入 |
| **数据标准化** | 将非结构化的保险条款转化为结构化的SQLite数据库字段 |
| **智能评测** | 基于录入数据，自动计算保障覆盖率、续保率及家庭财务稳健度 |
| **隐私安全** | 采用本地化SQLite数据库架构，确保数据归属权完全属于用户 |

---

## 第二章：中国保险产品分类体系与业务本体建模

在设计数据库之前，必须先构建一个符合中国监管环境与市场惯例的保险产品分类本体（Ontology）。

### 2.1 监管视角下的分类架构

依据《人身保险产品信息披露管理办法》及相关法律法规，保险产品首先在顶层被划分为两大类：**人身保险**与**财产保险**。

#### 2.1.1 人身保险（Life and Health Insurance）

人身保险是以人的寿命和身体为保险标的的保险。

**人寿保险（Life Insurance）**：以死亡为给付条件
- 定期寿险（Term Life）
- 终身寿险（Whole Life）
- 两全保险（Endowment）

**年金保险（Annuity）**：以生存为给付条件，侧重储蓄与养老功能

**健康保险（Health Insurance）**：
- 疾病保险：以确诊特定疾病为给付条件（重大疾病保险）
- 医疗保险：以发生医疗费用为补偿条件（百万医疗险、门诊险）

**意外伤害保险（Accident Insurance）**：以意外导致的身故或残疾为给付条件

**按设计类型细分**：

| 类型 | 特点 | 关键字段 |
|------|------|----------|
| 普通型 | 保额固定，无额外投资收益 | - |
| 分红型 | 可分享保险公司经营成果 | 红利 |
| 万能型 | 具备投资账户，保额保费灵活 | 结算利率、账户价值 |
| 投资连结型 | 风险完全由客户承担 | 投资单位数、单位净值 |

#### 2.1.2 财产保险（Property and Casualty Insurance）

财产保险以财产及其相关利益为保险标的。

- **家庭财产保险**：覆盖房屋主体、装修及室内财产
- **机动车辆保险**：包括交强险与商业车险（车损、三者）
- **责任保险**：如监护人责任险、宠物责任险

### 2.2 核心业务概念的数字化映射

以下业务概念将直接映射为数据库中的实体或核心字段：

#### 犹豫期（Hesitation Period）

中国保险市场特有的消费者保护机制，通常为投保人收到保单并书面签收之日起10日或15日（银保渠道）内。在此期间退保，保险公司仅扣除极少的工本费（通常10元），退还全部保费。

> **系统启示**：需记录"保单签收日期"，并自动计算"犹豫期截止日"，在Dashboard上高亮显示处于犹豫期内的保单。

#### 等待期/观察期（Waiting Period）

健康险通常设有30天至180天不等的等待期。在此期间出险，保险公司不予赔付。

> **系统启示**：需设计 `waiting_period_days` 字段，并在前端区分"已生效（观察期内）"与"完全生效"。

#### 现金价值（Cash Value）

对于长期人身保险，现金价值是保单在某一时点的解约金，也是保单贷款的额度基础。

> **系统启示**：这是一个随时间变化的数组。数据库需能够存储一张"现金价值表"（JSON格式），以便计算某一年度的家庭总资产储备。

#### 宽限期（Grace Period）

通常为应缴费日后的60天。在此期间保单依然有效，但若超过60天未缴费，保单将效力中止。

> **系统启示**：续费提醒逻辑必须涵盖宽限期的计算，避免用户因一时疏忽导致保单失效。

---

## 第三章：各细分险种详细字段调研与设计

### 3.1 人寿保险（定期/终身寿险）

人寿保险的核心功能是防范家庭经济支柱早逝带来的收入中断风险。

| 字段 | 说明 |
|------|------|
| 基本保额（Sum Assured） | 身故赔付金额 |
| 保障期限（Policy Term） | 如"20年"、"至60岁"或"终身" |
| 免责条款（Exclusions） | 主要为自杀条款（通常2年）、法律除外 |
| 受益人结构 | 姓名、证件号、受益比例、顺位 |
| 减额交清选项 | 是否支持停止缴费并降低保额维持保单有效 |

> **数据洞察**：若未指定受益人，理赔金将作为遗产处理，面临复杂的继承程序。系统应提示用户检查是否已指定明确受益人。

### 3.2 重大疾病保险（Critical Illness Insurance）

重疾险是目前中国家庭配置率极高的险种，其产品结构极其复杂。

| 字段 | 说明 |
|------|------|
| 疾病分组 | `grouping_type` (不分组/分组), `group_details` (JSON) |
| 赔付次数与间隔期 | 重疾赔付次数（如1次或5次），间隔期（如180天或1年） |
| 中/轻症责任 | 赔付比例：通常为基本保额的20%-60% |
| 豁免条款 | 被保人确诊轻/中症后，是否豁免后续所有保费（Boolean） |
| 身故责任 | 赔付保额、退还保费或仅退还现金价值 |
| 特定疾病额外赔 | `extra_payout_ratio` 和 `age_limit`（如"60岁前额外赔付50%"） |

### 3.3 医疗保险（Medical Insurance）

以"百万医疗险"为代表，特点是低保费、高保额、高免赔额。

| 字段 | 说明 |
|------|------|
| 年度限额 | 通常为200万-600万 |
| 免赔额 | 通常为1万元，系统需计算累计自付金额是否已超过 |
| 赔付比例 | 有社保100%，无社保60% |
| 保证续保 | 枚举值（不保证、保证6年、保证20年） |
| 医院范围 | 二级及以上公立医院普通部，或包含特需/国际部 |
| 增值服务 | 质子重离子治疗、院外特药（CAR-T等）直付功能 |

### 3.4 意外伤害保险（Accident Insurance）

意外险通常为一年期产品，杠杆极高。

| 字段 | 说明 |
|------|------|
| 意外身故/伤残保额 | 需内置"伤残等级赔付表"（1级100%，10级10%） |
| 意外医疗保额 | 用于门诊和住院治疗的报销额度 |
| 住院津贴 | 元/天 |
| 猝死保障 | 传统意外险不含猝死，现代产品多包含 |
| 职业类别限制 | 1-3类或1-6类，职业变更可能导致拒赔 |

### 3.5 储蓄与年金保险（Annuity & Savings）

此类产品关注资金流（Cash Flow）而非风险保障。

| 字段 | 说明 |
|------|------|
| 起领年龄 | 如55、60岁 |
| 领取频率与方式 | 月领/年领 |
| 保证领取期 | 如"保证领取20年" |
| 万能账户保底利率 | 写入合同的刚性兑付利率（如1.75%-3.0%） |
| 结算利率 | 每月浮动，需支持手动更新 |
| 初始费用与退保费用 | 进入账户和退出账户时的扣费比例 |
| 预定利率 | 传统年金的定价利率（如3.0%） |

### 3.6 财产保险（家庭财产与车险）

**家庭财产险**：

| 字段 | 说明 |
|------|------|
| 标的地址 | 必须精确到门牌号，这是理赔的根本依据 |
| 房屋主体保额 | 仅保房屋结构，不含地基 |
| 室内装修保额 | 地板、瓷砖、涂料等 |
| 室内财产保额 | 家具、家电 |
| 三者责任 | 如高空坠物砸伤路人 |

**机动车保险**：

| 字段 | 说明 |
|------|------|
| 车牌号与车架号（VIN） | 唯一标识 |
| 交强险到期日 | 与商业险可能不同步 |
| 商业三者险保额 | 如200万、300万 |
| 车损险保额 | 随车龄贬值，需每年更新 |

---

## 第四章：SQLite数据库架构设计

### 4.1 实体关系图（ERD）核心逻辑

系统核心由三大类实体组成：

- **主体（Subjects）**：家庭成员（人）和资产（房/车）
- **契约（Contracts）**：保单及其关联的详细条款
- **事件（Events）**：缴费记录、理赔记录、变更记录

为了应对保险产品字段的极度差异化（多态性），我们将在 `Policies` 表中采用 **JSON字段** 来存储特定险种的特有属性。

### 4.2 详细表结构定义 (DDL)

#### 1. 家庭成员表 (Family_Members)

```sql
CREATE TABLE Family_Members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                          -- 姓名
    relation TEXT NOT NULL,                      -- 关系：本人/配偶/子女/父母
    gender TEXT CHECK(gender IN ('M', 'F')),     -- 性别，影响费率
    birth_date DATE NOT NULL,                    -- 出生日期，核心字段
    id_card_type TEXT DEFAULT 'Identity Card',   -- 证件类型
    id_card_number TEXT,                         -- 证件号（建议加密存储）
    occupation_code TEXT,                        -- 职业代码
    annual_income REAL,                          -- 年收入，用于缺口分析
    has_social_insurance BOOLEAN DEFAULT 1       -- 是否有社保
);
```

#### 2. 家庭资产表 (Family_Assets)

```sql
CREATE TABLE Family_Assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('RealEstate', 'Vehicle', 'Other')),
    identifier TEXT NOT NULL,      -- 房产地址或车牌号
    purchase_date DATE,
    market_value REAL,             -- 当前估值
    owner_member_id INTEGER,       -- 关联主要所有人
    details JSON,                  -- 存储车辆VIN、房屋面积等细节
    FOREIGN KEY(owner_member_id) REFERENCES Family_Members(id)
);
```

#### 3. 保单主表 (Policies)

```sql
CREATE TABLE Policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_number TEXT UNIQUE NOT NULL,    -- 保单号
    insurer_name TEXT NOT NULL,            -- 保险公司名称
    product_name TEXT NOT NULL,            -- 产品名称
    
    -- 分类体系
    main_category TEXT NOT NULL,           -- 人身/财产
    sub_category TEXT NOT NULL,            -- 重疾/医疗/寿险/年金/车险
    
    -- 角色关联
    applicant_id INTEGER NOT NULL,         -- 投保人ID
    insured_subject_type TEXT CHECK(insured_subject_type IN ('Member', 'Asset')),
    insured_subject_id INTEGER NOT NULL,   -- 被保人或被保资产ID
    
    -- 时间维度
    purchase_date DATE,                    -- 投保日期
    effective_date DATE NOT NULL,          -- 生效日期
    expiry_date DATE,                      -- 终保日期
    hesitation_end_date DATE,              -- 犹豫期结束日
    
    -- 财务维度
    premium_amount REAL NOT NULL,          -- 每期保费
    payment_frequency TEXT CHECK(payment_frequency IN ('Single', 'Monthly', 'Yearly')),
    payment_period_years INTEGER,          -- 缴费年限
    total_payment_times INTEGER,           -- 总缴费次数
    
    -- 状态管理
    status TEXT DEFAULT 'Active',          -- Active/Lapsed/Surrendered/Claimed
    
    -- 多态字段存储
    extended_attributes JSON,              -- 各险种特有字段
    
    policy_file_path TEXT,                 -- 电子保单存储路径
    remarks TEXT,
    
    FOREIGN KEY(applicant_id) REFERENCES Family_Members(id)
);
```

#### 4. 受益人关联表 (Policy_Beneficiaries)

```sql
CREATE TABLE Policy_Beneficiaries (
    id INTEGER PRIMARY KEY,
    policy_id INTEGER,
    beneficiary_type TEXT,       -- 法定/指定
    member_id INTEGER,           -- 若是家庭成员
    external_name TEXT,          -- 若是非家庭成员
    share_percentage REAL,       -- 受益比例，如50%
    rank_order INTEGER,          -- 受益顺位：1或2
    FOREIGN KEY(policy_id) REFERENCES Policies(id)
);
```

#### 5. 缴费计划与记录表 (Premium_Schedule)

```sql
CREATE TABLE Premium_Schedule (
    id INTEGER PRIMARY KEY,
    policy_id INTEGER,
    due_date DATE NOT NULL,            -- 应缴日期
    amount REAL NOT NULL,
    status TEXT DEFAULT 'Pending',     -- Pending/Paid/Overdue
    actual_pay_date DATE,
    grace_period_end_date DATE,        -- 宽限期截止日
    FOREIGN KEY(policy_id) REFERENCES Policies(id)
);
```

#### 6. 现金价值表 (Cash_Values)

```sql
CREATE TABLE Cash_Values (
    id INTEGER PRIMARY KEY,
    policy_id INTEGER,
    policy_year INTEGER,           -- 第几个保单年度
    guaranteed_value REAL,         -- 保证现金价值
    projected_mid_value REAL,      -- 中档演示红利
    projected_high_value REAL,     -- 高档演示红利
    FOREIGN KEY(policy_id) REFERENCES Policies(id)
);
```

### 4.3 索引与优化策略

- 在 `Policies` 表的 `expiry_date` 和 `next_payment_date` 上建立索引
- 在 `Family_Members` 的 `id` 上建立索引
- 利用SQLite的JSON1扩展，支持对 `extended_attributes` 字段的深度查询

```sql
-- 查询所有"保证续保"的医疗险
SELECT * FROM Policies 
WHERE json_extract(extended_attributes, '$.guaranteed_renewal') = 1;
```

---

## 第五章：系统核心功能与业务逻辑实现

### 5.1 保单CRUD的智能化逻辑

#### 5.1.1 创建（Create）与动态表单

由于险种字段差异巨大，前端表单必须是动态渲染的。

1. 用户选择"险种类型"（如医疗险）
2. 后端根据类型返回所需的JSON Schema
3. 前端动态渲染对应字段

**逻辑校验**：
- 生效日不能早于出生日期
- 未成年人身故保额需根据银保监会规定限制（10岁以下限额20万）

#### 5.1.2 读取（Read）与家庭视图

系统需提供三种维度的视图：

| 维度 | 描述 |
|------|------|
| 保单维度 | 列表展示，支持按险种筛选 |
| 成员维度 | 以"人"为中心，聚合计算身故总保额、重疾总保额 |
| 时间维度 | 以"日历"形式展示未来的缴费节点和满期节点 |

#### 5.1.3 更新（Update）与全生命周期事件

- **复效逻辑**：若保单进入失效状态，在两年内可申请复效
- **红利更新**：对于分红险，每年需允许用户录入实际分红金额

### 5.2 到期与续期覆盖率评测功能

#### 5.2.1 续期预警机制

系统应每日扫描 `Premium_Schedule` 表：

- **预警规则**：`Current_Date >= due_date - 30 days`
- **宽限期逻辑**：若状态仍为Pending且超过应缴日期，显示"距离失效仅剩XX天"

#### 5.2.2 续期覆盖率（Renewal Coverage Rate）

$$\text{续期覆盖率} = \frac{\text{过去12个月实际缴纳保费总额}}{\text{过去12个月应缴纳保费总额}} \times 100\%$$

> 若覆盖率低于100%，说明有保单断缴，家庭面临保障缺失风险。

#### 5.2.3 保障期限覆盖率（Term Coverage Analysis）

用于评估长期风险是否被短期产品覆盖（错配风险）。

算法逻辑：
1. 提取某成员所有身故类保单
2. 计算加权平均保障终期
3. 若加权终期 < 退休年龄（如60岁），则提示"保障期限不足"

### 5.3 家庭保障缺口分析（Gap Analysis）

#### 5.3.1 寿险缺口（Mortality Protection Gap）

$$\text{建议保额} = (\text{年收入} \times 10) + \text{房屋剩余贷款} + \text{子女教育预估费用} - \text{流动资产}$$

评测输出：绘制柱状图对比"已备保额"与"建议保额"。

#### 5.3.2 重疾缺口（Health Recovery Gap）

$$\text{建议保额} = \text{年收入} \times 5 + \text{预估康复费用(通常30-50万)}$$

> 若现有保额 < 30万，系统应给出红色高危预警。

#### 5.3.3 医疗险覆盖完整性

检查点：
- 是否持有"百万医疗险"？
- 免赔额是否过高？
- 是否保证续保？

评测结果：生成"医疗保障金字塔"，高亮缺失的层级。

---

## 第六章：技术实现细节与数据安全

### 6.1 前后端技术选型建议

| 组件 | 选型 |
|------|------|
| 后端 | Python (Flask/Django) 或 Node.js |
| 数据库 | SQLite（版本3.38+，启用JSON1扩展） |
| ORM框架 | SQLAlchemy (Python) 或 Prisma (Node.js) |

### 6.2 电子保单解析（OCR）集成方案

1. 用户上传PDF保单
2. 后端调用OCR引擎（如Tesseract或百度AI接口）
3. 关键词提取：利用正则表达式匹配"保险单号"、"保险期间"、"保险金额"
4. 自动填充：将提取结果填入CRUD表单，由用户人工校对后保存

> **注意**：由于各保险公司PDF格式差异极大，OCR仅能辅助提取通用元数据，复杂条款仍需人工确认。

### 6.3 数据隐私与安全设计

保险数据包含姓名、身份证号、家庭住址、资产状况，属于极高敏感个人隐私信息（PII）。

| 措施 | 说明 |
|------|------|
| 本地加密 | 使用SQLCipher对SQLite数据库文件进行全盘加密 |
| 脱敏展示 | 默认对身份证号和手机号进行掩码处理 |
| 备份机制 | 提供导出加密备份文件（.enc）的功能 |

---

## 第七章：结论与展望

本报告详细阐述了一款面向中国家庭的保险管理Web产品的设计蓝图。

### 核心产出总结

| 产出 | 描述 |
|------|------|
| 分类本体 | 建立了涵盖人身与财产、消费与储蓄的完整分类树 |
| 数据模型 | 设计了以Policies表为核心，extended_attributes JSON字段为扩展翼的SQLite架构 |
| 评测算法 | 将抽象的保险理念转化为具体的"续保率"、"保障缺口"计算公式 |

### 未来展望

随着保险行业API的逐步开放，该系统有望从"手动录入"向"一键同步"进化，甚至结合穿戴设备健康数据，为家庭提供动态的风险定价与管理建议，真正实现科技赋能家庭金融安全。
