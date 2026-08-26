# CloudBase 数据集合清单

> 环境：`teacher-work-d5ge50r1f621766b2`  
> 创建日期：2026-08-26  
> 状态：第一阶段空集合已创建，尚未导入业务数据

## 已创建集合

| 集合 | 第一阶段职责 | 数据状态 |
| --- | --- | ---: |
| `teacher_profiles` | 微信身份对应的教师资料和授权状态 | 0 条 |
| `datasets` | 一次本地导入或云端数据集的归属和状态 | 0 条 |
| `import_batches` | JSON 导入批次、预检和结果审计 | 0 条 |
| `classes` | 教师所属班级基础数据 | 0 条 |
| `students` | 班级下的学生基础数据 | 0 条 |
| `attendance` | 学生每日考勤记录 | 0 条 |
| `leaves` | 学生请假记录 | 0 条 |
| `follow_up_tasks` | 学生跟进事项 | 0 条 |

## 统一字段约定

业务文档至少预留以下字段：

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

其中 `ownerId` 由云函数根据当前微信身份取得，不能信任客户端传入值；`uuid` 是跨端稳定身份，CloudBase `_id` 只作为云端文档 ID。

## 当前状态

- 尚未写入真实教师、班级或学生数据；
- 8 个集合当前均配置为 `PRIVATE`；
- 已创建并核验 `ownerId`、`datasetId` 相关业务索引；
- 已部署 `import-data` 和 `query-data` 云函数；
- 尚未启用附件云端存储，第一阶段只处理结构化数据。

## 后续扩展原则

考勤、成绩、表现量化、请假、跟进、家校沟通、值日、座位、班委、课代表、文档和分析等业务集合，必须先完成字段、稳定 ID、权限和同步映射设计，再逐项创建。不得因为小程序页面需要入口，就直接在云端临时创建没有契约的集合。
