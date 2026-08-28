# 教师工作台 v0.1.0 绿色便携版发布记录

> 归档说明：历史版本资料，仅用于追溯当时的实现与发布过程。

## 交付物

```text
教师工作台-v0.1.0-windows-x64-portable.zip
└─ 教师工作台/
   ├─ 教师工作台.exe
   ├─ resources/
   │  ├─ runtime/node.exe
   │  └─ app/server + 生产依赖
   ├─ data/
   ├─ backup/
   ├─ logs/
   ├─ manifest.json
   └─ README.txt
```

SHA-256：

```text
43ad9261d899f3e2e149d65ce24cb4577dce81d927196968592d6ffce768b901
```

## 架构

- Tauri v2 Release EXE 内嵌 Vue/Vite 前端；
- Rust 从 EXE 所在目录计算便携根目录；
- Rust 自动启动随包携带的 Node 22 运行时；
- Express 只监听随机 `127.0.0.1` 端口；
- 每次启动生成 32 字节随机令牌保护 API；
- SQLite 和上传文件固定写入 EXE 同级 `data/`；
- 正常关闭主窗口时，Rust 自动终止后端进程。

## 构建命令

构建必须在 Developer PowerShell for VS 2022 或执行 `VsDevCmd.bat` 后运行：

```powershell
$env:CARGO_TARGET_DIR='C:\tmp\teacher-work-tauri-target'
npm test
npm run build
npx tauri build --no-bundle
npm run package:portable
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\qa-portable.ps1 -ZipPath release\教师工作台-v0.1.0-windows-x64-portable.zip
```

## 已完成验证

- Node 测试：便携路径、路径穿越、桌面 API、随机端口认证、数据库迁移恢复点；
- Rust 测试：中文空格路径下的便携目录计算；
- Vue/Vite 生产构建；
- Tauri v2 MSVC Release 编译；
- 最终 ZIP 解压到 `E:\Temp\教师 工作台 QA`；
- 关闭开发服务器后启动 Release EXE；
- EXE 同级自动创建 `data/teacher.db`；
- 正常关闭窗口后随包 Node 后端无残留；
- v2 数据库升级到 v3 前自动创建恢复副本；
- UTF-8 README、manifest 和 ZIP SHA-256 生成。

## 仍需目标用户环境人工确认

- 在没有 Node、Rust、Visual Studio 的另一台 Windows 10/11 电脑或干净虚拟机运行；
- 全部业务页面逐项人工操作；
- Excel 导入导出、文档预览和打印的视觉结果；
- Windows SmartScreen、Defender 和第三方杀毒软件提示；
- 目标电脑是否已安装 Evergreen WebView2 Runtime；
- 未签名 EXE 的最终公开分发体验。

## 已知限制

- 当前未配置商业代码签名，可能触发 SmartScreen；
- 首版依赖系统 WebView2，不携带约 127～180MB 的离线/固定 Runtime；
- 为复用成熟 Express/SQLite 后端，ZIP 随附 Node 运行时，因此体积大于纯 Rust 后端；
- 首版为手动绿色升级，不包含在线更新助手；
- 手动升级时只替换 EXE 和 resources，必须保留 data、backup 和 logs。
