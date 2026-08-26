# CloudBase 云函数

本目录是微信开发者工具和 CloudBase CLI 识别的实际云函数根目录。

每个云函数使用独立子目录，函数部署时将 `cloudfunctions/` 作为函数根目录：

- `bind-desktop/`
- `import-data/`（已部署，见 `cloudbase/functions.md`）
- `query-data/`（班级、学生只读接口，已部署）
- `student-data/`（学生新增、编辑和软删除接口，待部署）
- `attendance-data/`（考勤查询和批量保存接口，待部署）
- `leave-data/`（请假查询、新增、编辑和软删除接口，已部署）
- `follow-up-data/`（跟进事项查询、新增、编辑和软删除接口，已部署）
- `redeem-code/`
- `sync-data/`

微信开发者工具中应选择仓库根目录打开，使用根目录的
`project.config.json`；不要把 `cloudfunctions/import-data/` 单独作为小程序项目目录。
