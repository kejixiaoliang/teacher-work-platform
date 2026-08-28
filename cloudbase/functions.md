# CloudBase 云函数部署记录

## 环境

- 环境 ID：`teacher-work-d5ge50r1f621766b2`
- 区域：`ap-shanghai`
- 微信小程序 AppID：`wx0d46a71024cdbc7c`

## 已部署函数

| 函数 | 类型 | 运行时 | 入口 | 状态 | 触发器 |
| --- | --- | --- | --- | --- | --- |
| `import-data` | Event | Nodejs18.15 | `index.main` | Active / Available | 无 |
| `query-data` | Event | Nodejs18.15 | `index.main` | Active / Available | 无 |
| `student-data` | Event | Nodejs18.15 | `index.main` | Active / Available | 无 |
| `attendance-data` | Event | Nodejs18.15 | `index.main` | Active / Available | 无 |
| `leave-data` | Event | Nodejs18.15 | `index.main` | Active / Available | 无 |
| `follow-up-data` | Event | Nodejs18.15 | `index.main` | Active / Available | 无 |
| `business-data` | Event | Nodejs18.15 | `index.main` | Active / Available | 无 |
| `admin` | Event | Nodejs18.15 | `index.main` | Active / Available | 无 |
| `redeem-code` | Event | Nodejs18.15 | `index.main` | Active / Available | 无 |
| `backup-data` | Event | Nodejs18.15 | `index.main` | Active / Available | 无 |
| `excel-exchange` | Event | Nodejs18.15 | `index.main` | Active / Available | 无 |
| `class-data` | Event | Nodejs18.15 | `index.main` | Active / Available | 无 |
| `student-profile` | Event | Nodejs18.15 | `index.main` | Active / Available | 无 |
| `identity-status` | Event | Nodejs18.15 | `index.main` | Active / Available | 无 |
| `sync-data` | Event | Nodejs18.15 | `index.main` | Active / Available | 无 |

部署配置：

- 函数根目录：仓库根目录下的 `cloudfunctions/`
- 函数代码目录：按函数名对应 `cloudfunctions/<function-name>/`
- 自动安装依赖：已启用
- HTTP 网关：未配置
- 定时触发器：未配置
- 数据库写入：仅在 `commit` 阶段执行，当前只写入新数据集、导入批次、班级和学生
- 文件上传：当前未实现

## 调用约定

小程序端通过 CloudBase 原生调用：

```js
wx.cloud.callFunction({
  name: 'import-data',
  data: { payload: JSON.stringify(exportedData) },
});
```

函数首先通过 `wx-server-sdk` 获取微信用户身份。没有有效 `OPENID` 时返回
`AUTH_REQUIRED`，不会执行任何数据操作；有身份后按 `action` 进入 `precheck`、
`preview` 或 `commit`。前两者只校验和生成报告，`commit` 才创建新数据集、导入批次并
写入班级和学生，同时按 `ownerId + sourceExportId` 拦截重复导入。

## 部署核验

2026-08-26 已完成首次部署核验：

- 函数详情查询成功，`CodeResult=success`。
- 函数状态为 `Active`，可用状态为 `Available`。
- 最小调用成功执行，按预期返回 `AUTH_REQUIRED`。
- 查询到的触发器列表为空。

真实导入写库仍需在微信开发者工具中用测试微信身份完成一次脱敏样本验证；在此之前不向生产业务数据集执行 `commit`。

2026-08-28 已补齐 `backup-data`、`excel-exchange`、`class-data`、`student-profile`、
`identity-status`、`sync-data`，并逐一确认状态为 `Active / Available`。管理端无微信
身份的冒烟调用均按预期返回 `AUTH_REQUIRED`；未执行任何真实数据集写入。`identity-status`
曾因缺少依赖声明出现运行时错误，补充 `wx-server-sdk` 后已重新部署并复验通过。

## 只读接口设计

`query-data` 仅允许读取 `classes` 和 `students`，并且每次查询都由云函数从微信登录上下文取得 `ownerId`，客户端不能传入或覆盖所有者身份。查询必须同时提供 `datasetId`，分页上限为 100 条。

该函数已完成部署并通过远端核验。最小调用在无微信用户身份的管理端调用环境中返回 `AUTH_REQUIRED`，说明认证拦截生效；真实小程序调用还需在微信开发者工具中使用微信身份验证。
