# Node.js 自动安装引导设计

## 目标

让没有安装 Node.js 的 Windows 用户也能通过双击 `启动.bat` 完成运行准备，同时保持分享包轻量，不携带 `node_modules` 或 Node.js 运行时。

## 启动流程

1. `启动.bat` 在安装项目依赖前检查 `node` 与 `npm` 是否可用。
2. 两者均可用时，继续现有的依赖安装、前端构建、端口检查和服务启动流程。
3. 缺少 Node.js 或 npm 时，脚本说明需要 Node.js LTS，并要求用户输入 `Y` 确认安装。
4. 用户未确认时，脚本不修改电脑，显示提示后退出。
5. 用户确认后，脚本检查 `winget`，并执行 `winget install --id OpenJS.NodeJS.LTS --exact`。安装命令应采用非交互的软件源协议参数，避免额外确认阻断普通用户。
6. 安装完成后，脚本刷新当前进程可见的 PATH，并再次检查 `node` 与 `npm`。
7. 检查通过则继续启动；仍不可用时，提示用户关闭窗口并重新双击，随后退出，禁止重复安装循环。

## 失败与降级处理

- `winget` 不存在：显示 Node.js 官方下载地址并打开下载页面，提示手动安装 LTS 后重新运行。
- `winget` 安装返回失败：显示失败信息和官方下载地址，并打开下载页面。
- Node.js 已存在但 npm 缺失：按安装环境不完整处理，经用户确认后尝试安装/修复 Node.js LTS。
- 用户拒绝安装：正常退出，不进入 `npm install`，也不产生项目数据。

## 兼容性约束

- `启动.bat` 必须保持纯 ASCII、无 UTF-8 BOM、使用 CRLF 换行。
- BAT 输出使用英文，避免依赖 Windows 系统代码页。
- Node.js 安装检查必须发生在第一次调用 `npm` 之前。
- 自动安装只使用 Windows 自带或常见的 `winget`；不下载并执行临时安装脚本。

## 验证

扩展 `scripts/test-startup-bat.ps1`，静态验证以下行为：

- 在 `npm install` 前检查 `node` 和 `npm`。
- 自动安装前存在用户确认步骤。
- 使用精确的 `OpenJS.NodeJS.LTS` winget 包标识。
- 包含 winget 缺失、安装失败和安装后仍不可用的安全退出路径。
- 原有无 BOM、ASCII、CRLF、IPv4 健康检查和无 `timeout` 约束继续通过。

完成静态回归后，使用真实 `cmd.exe` 验证已安装 Node.js 的正常启动路径，并运行生产构建。自动安装分支不在开发机上实际卸载/重装 Node.js，而通过脚本结构回归测试覆盖。
