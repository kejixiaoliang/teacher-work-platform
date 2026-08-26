# CloudBase 云函数部署记录

## 环境

- 环境 ID：`teacher-work-d5ge50r1f621766b2`
- 区域：`ap-shanghai`
- 微信小程序 AppID：`wx0d46a71024cdbc7c`

## 已部署函数

| 函数 | 类型 | 运行时 | 入口 | 状态 | 触发器 |
| --- | --- | --- | --- | --- | --- |
| `import-data` | Event | Nodejs18.15 | `index.main` | Active / Available | 无 |
| `query-data` | Event | Nodejs18.15 | `index.main` | 待部署 | 无 |

部署配置：

- 函数根目录：仓库根目录下的 `cloudfunctions/`
- 函数代码目录：`cloudfunctions/import-data/`
- 自动安装依赖：已启用
- HTTP 网关：未配置
- 定时触发器：未配置
- 数据库写入：当前未实现，仅执行身份校验和导入数据预检
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
`AUTH_REQUIRED`，不会执行导入预检；有身份后再校验 v0.8.0 数据交换格式，返回
各数据集数量和被省略的附件数量。

## 部署核验

2026-08-26 已完成首次部署核验：

- 函数详情查询成功，`CodeResult=success`。
- 函数状态为 `Active`，可用状态为 `Available`。
- 最小调用成功执行，按预期返回 `AUTH_REQUIRED`。
- 查询到的触发器列表为空。

后续实现真实导入写库前，必须先补充数据映射、幂等键、批次记录、失败恢复和权限规则，不能直接把预检函数改成无保护的批量写入函数。

## 只读接口设计

`query-data` 仅允许读取 `classes` 和 `students`，并且每次查询都由云函数从微信登录上下文取得 `ownerId`，客户端不能传入或覆盖所有者身份。查询必须同时提供 `datasetId`，分页上限为 100 条。

该函数本地代码已完成并通过静态测试，部署前仍需经过 CloudBase 函数部署核验。
