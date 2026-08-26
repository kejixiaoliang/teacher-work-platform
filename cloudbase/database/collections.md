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

## 尚未执行的事项

- 未写入真实教师、班级或学生数据；
- 未配置最终集合权限；
- 未创建业务索引；
- 未部署云函数；
- 未启用附件云端存储。
