# CloudBase NoSQL 索引规范

当前环境：`teacher-work-d5ge50r1f621766b2`

## 基础集合索引

除 CloudBase 自动创建的 `_id_`、`_openid_1` 外，业务查询使用以下索引：

| 集合 | 索引名称 | 字段顺序 | 唯一 | 用途 |
| --- | --- | --- | --- | --- |
| `teacher_profiles` | `ownerId_1` | `ownerId: 1` | 否 | 教师资料查询 |
| `datasets` | `ownerId_1_createdAt_-1` | `ownerId: 1, createdAt: -1` | 否 | 当前教师的数据集列表 |
| `import_batches` | `ownerId_1_sourceExportId_1` | `ownerId: 1, sourceExportId: 1` | 否 | 查询重复导入和导入历史 |
| `import_batches` | `ownerId_1_datasetId_1_batchType_1_classUuid_1_createdAt_-1` | `ownerId: 1, datasetId: 1, batchType: 1, classUuid: 1, createdAt: -1` | 否 | 按教师、数据集和班级查询学生名单导入历史（待部署） |
| `classes` | `ownerId_1_datasetId_1` | `ownerId: 1, datasetId: 1` | 否 | 班级只读列表 |
| `students` | `ownerId_1_datasetId_1` | `ownerId: 1, datasetId: 1` | 否 | 学生只读列表 |
| `attendance` | `ownerId_1_datasetId_1_classUuid_1_date_1` | `ownerId: 1, datasetId: 1, classUuid: 1, date: 1` | 否 | 按班级和日期查询考勤 |
| `leaves` | `ownerId_1_datasetId_1_classUuid_1_startDate_-1` | `ownerId: 1, datasetId: 1, classUuid: 1, startDate: -1` | 否 | 按班级和开始日期查询请假 |
| `follow_up_tasks` | `ownerId_1_datasetId_1_classUuid_1_status_1_dueDate_1` | `ownerId: 1, datasetId: 1, classUuid: 1, status: 1, dueDate: 1` | 否 | 按班级、状态和截止日期查询跟进事项 |
| `license_codes` | `codeHash_1` | `codeHash: 1` | 否 | 兑换码哈希查询 |
| `license_grants` | `ownerId_1_createdAt_-1` | `ownerId: 1, createdAt: -1` | 否 | 当前教师授权查询 |
| `admin_audit_logs` | `createdAt_-1` | `createdAt: -1` | 否 | 管理员审计记录 |

索引不是权限控制。每条业务查询仍必须由云函数从微信上下文获取 `ownerId`，并同时限制 `datasetId`；客户端不能自行指定查询用户。

## 权限边界

- 基础集合继续保持 `PRIVATE`，不开放匿名读取。
- 服务端函数使用当前微信 `OPENID` 映射出的 `ownerId` 查询。
- 服务端写入时必须同时写入 `_openid`，保证未来小程序 SDK 规则仍可工作。
- 不创建全局公开查询索引，不把 `ownerId` 从客户端请求直接透传为授权依据。

## 核验记录

2026-08-26 首次查询确认基础集合均只有默认索引；随后已成功创建并复核当时定义的业务索引。当前基础集合、`attendance` 和 `leaves` 均包含自动索引和对应业务索引。2026-08-28 新增的学生名单导入历史索引仅完成代码契约，尚未部署到线上环境。
