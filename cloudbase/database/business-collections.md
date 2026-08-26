# 教师工作台 v0.8.0 业务集合映射与跨端数据登记

> 建立日期：2026-08-26  
> 适用端：Windows 客户端、微信小程序、CloudBase  
> 状态：数据映射基线

## 一、映射原则

本文件只登记已有客户端功能对应的数据边界，不新增业务含义。CloudBase 集合的建立顺序必须服从以下顺序：

```text
现有客户端功能
  ↓
统一交换格式集合
  ↓
稳定 ID 和父子关系
  ↓
CloudBase 字段、权限和索引
  ↓
小程序页面和同步接口
```

所有业务记录至少包含统一元数据：

```text
uuid
ownerId
datasetId
createdAt
updatedAt
deletedAt
revision
source
```

其中 `ownerId` 由服务端认证身份取得，`datasetId` 标记数据集归属，`uuid` 是跨端稳定记录身份。

## 二、现有交换集合映射

| 交换格式集合 | 对应客户端功能 | 主要关系字段 | CloudBase 建议集合 | 当前阶段 |
| --- | --- | --- | --- | --- |
| `classes` | 班级设置 | `uuid` | `classes` | 已创建 |
| `students` | 学生管理 | `classUuid` | `students` | 已创建 |
| `attendance` | 考勤管理 | `classUuid`、`studentUuid`、`date` | `attendance` | 已创建 |
| `studentHistory` | 学生健康/资料历史 | `studentUuid` | `student_history` | 待字段核对 |
| `seats` | 座位管理当前布局 | `classUuid`、`studentUuid` | `seats` | 待字段核对 |
| `seatLayouts` | 座位布局历史 | `classUuid` | `seat_layouts` | 待字段核对 |
| `documents` | 文档管理 | `classUuid`、`studentUuid` | `documents` | 待附件策略 |
| `duties` | 值日管理 | `classUuid`、`studentUuid` | `duties` | 待字段核对 |
| `exams` | 成绩管理考试 | `classUuid` | `exams` | 待字段核对 |
| `scores` | 成绩管理成绩 | `examUuid`、`studentUuid` | `scores` | 待字段核对 |
| `attendance` | 考勤管理 | `classUuid`、`studentUuid` | `attendance` | 待字段核对 |
| `studentRecords` | 学生记录 | `studentUuid` | `student_records` | 待字段核对 |
| `leaves` | 请假管理 | `classUuid`、`studentUuid` | `leaves` | 待字段核对 |
| `contacts` | 家校沟通 | `classUuid`、`studentUuid` | `contacts` | 待字段核对 |
| `assessment.categories` | 表现量化分类 | `classUuid` | `assessment_categories` | 待字段核对 |
| `assessment.items` | 表现量化规则 | `categoryUuid` | `assessment_items` | 待字段核对 |
| `assessment.records` | 表现量化记录 | `studentUuid`、`itemUuid` | `assessment_records` | 待字段核对 |
| `assessment.revisions` | 表现量化修订历史 | `recordUuid` | `assessment_revisions` | 待字段核对 |
| `followUpTasks` | 跟进事项 | `classUuid`、`studentUuid` | `follow_up_tasks` | 待字段核对 |
| `settings` | 本地设置 | `ownerId` | `teacher_profiles` 或专用设置集合 | 待边界确认 |

集合名称可以在 CloudBase 中使用小写下划线形式，但必须固定登记，不能由不同端自行命名。交换格式名称与云端集合名称的转换只能由映射层处理。

## 三、跨端读写登记要求

每个业务集合正式创建前，必须补齐以下登记项：

- 客户端 SQLite 表和字段来源；
- JSON 交换格式中的字段来源；
- CloudBase 字段类型和空值规则；
- 父记录和子记录的稳定 ID 关系；
- 小程序可读、可新增、可编辑、可删除操作；
- 云函数名称和请求/响应结构；
- `ownerId`、`datasetId` 的服务端注入位置；
- 查询索引和权限规则；
- 软删除、`revision` 和冲突处理方式；
- 历史数据迁移和回滚策略。

没有完成以上登记的集合，只能继续使用本地客户端，不得让小程序直接读写临时结构。

## 四、UI 与集合的关系

小程序页面只负责呈现和提交用户操作，不直接把页面对象当作数据库文档。页面字段必须映射到统一契约，例如：

```text
学生详情页
  ├─ 读取 students
  ├─ 读取 student_history
  ├─ 读取 scores / attendance / assessment_records
  ├─ 读取 follow_up_tasks / contacts
  └─ 写入对应集合的统一记录
```

页面布局可以拆分，数据关系不能拆分成另一套 ID。

## 五、阶段验收

- 交换格式中的每个集合都有明确去向；
- 已创建集合的状态文档与远端实际一致；
- 未创建的业务集合没有被页面代码私自使用；
- 小程序页面开发前能明确读取和写入集合；
- 所有集合都预留统一元数据和数据隔离字段；
- 旧版 JSON/ZIP 仍由既有迁移器处理，不因云端映射而改变原格式。
