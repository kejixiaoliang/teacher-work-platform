<template>
  <div class="page-card changelog-page">
    <header class="change-hero">
      <span class="change-stamp">RELEASE NOTES</span>
      <div>
        <h2 class="page-head-title">版本更新</h2>
        <p class="page-head-desc">每一次重要改进，都记录在这里。</p>
      </div>
      <span class="change-dot">持续迭代中</span>
    </header>

    <div class="release-timeline">
      <article v-for="release in releases" :key="release.version" class="release-item">
        <div class="release-marker"><span></span></div>
        <div class="release-card">
          <div class="release-head">
            <div><span class="release-version">{{ release.version }}</span><b>{{ release.title }}</b></div>
            <time>{{ release.date }}</time>
          </div>
          <p>{{ release.summary }}</p>
          <ul>
            <li v-for="entry in release.entries" :key="entry">{{ entry }}</li>
          </ul>
        </div>
      </article>
    </div>

    <section class="maker-card">
      <div class="maker-mark">TW</div>
      <div>
        <span>制作人</span>
        <h3>科技小亮</h3>
        <p>一名持续探索 AI、内容创作与实用工作流的创作者。本项目希望把班主任日常管理中分散、繁琐的工作，整理成一套轻量、清晰、可持续使用的本地工具。</p>
      </div>
    </section>
  </div>
</template>

<script setup>
const releases = [
  {
    version: '0.4.1', date: '2026-08-17', title: '全面审核与稳定性加固',
    summary: '围绕 API 契约、备份文件安全、前端竞态、批量反馈和 Windows 便携发布链路完成系统性加固。',
    entries: ['统一核心接口的参数错误、资源不存在和业务冲突响应，补齐输入校验与文件签名校验。', '备份增加文件资产清单与恢复前校验，降低主键冲突、文件缺失和伪造文件风险。', '修复表现量化并行刷新竞态，批量删除改为逐项汇总反馈；完成 Tauri Release 构建和便携包 QA。', '将 nanoid 升级至 3.3.18，npm audit --omit=dev 已归零。'],
  },
  {
    version: '0.4.0', date: '2026-08-15', title: '学生表现量化体验升级',
    summary: '围绕日常行为记录、值日组协同和统计复盘，完善表现量化模块的可用性、可视化与版本记录。',
    entries: ['值日组记分改为按具体组精准带入成员，不再默认选中全部值日生；优化批量记分预览。', '新增月度与学期统计图表，支持净分排名和分类贡献的直观查看。', '重做记录与规则管理操作列，编辑、历史、撤销、恢复、停用和启用均有清晰入口。', '规则继续保留历史快照，停用项目或分类后可随时重新启用。'],
  },
  {
    version: '0.3.0', date: '2026-08-11', title: '安全与工作流综合升级',
    summary: '在 0.2.0 基础上完成全面安全加固、数据一致性修复、成绩与批量工作流完善，以及便携构建优化。',
    entries: ['统一输入校验、资源错误码、批量跳过明细和请假考勤联动，降低误操作与静默失败风险。', '加固备份恢复、文件内容校验、上传配额和依赖安全，npm audit 已归零。', '新增成绩科目模板，ExcelJS 改为按需加载，并完成 Windows 便携包首次启动与正常退出 QA。', '新增学生表现量化：支持自定义行为规则、批量记分、月度/学期统计、修正历史和多格式导出。'],
  },
  {
    version: '0.2.0', date: '2026-08-05', title: 'Web 与桌面版功能统一',
    summary: '同一套业务代码同时服务浏览器与 Windows 绿色便携版。',
    entries: ['统一产品版本、构建信息和绿色包命名。', '座位移动改用跨浏览器与 WebView2 的 Pointer Events。', '建立 Web/EXE 功能对照和双环境发布验收。'],
  },
  {
    version: '2026.08', date: '2026-08-02', title: '档案与上手体验升级',
    summary: '让学生档案更清晰，也让第一次使用更容易。',
    entries: ['体征修改自动写入身高视力历史，并标注来源。', '优化成长档案、家校沟通的卡片式信息布局。', '新增使用指南，说明各模块用途和自动记录规则。'],
  },
  {
    version: '2026.07', date: '2026-07-31', title: '日常管理能力补强',
    summary: '围绕班主任高频工作补齐联动与可追溯性。',
    entries: ['新增学生档案时间线与跟进状态。', '考勤默认全员出勤，并与已批准请假联动。', '支持座位点击移动、空座交换及成绩自定义学科。'],
  },
  {
    version: '2026.07', date: '2026-07-19', title: '教师工作台初版',
    summary: '完成班级日常管理的核心闭环。',
    entries: ['学生、座位、成绩、考勤、请假与班级事务一体化。', '支持 Excel 导入导出与本地数据保存。'],
  },
];
</script>

<style scoped>
.change-hero { display:flex; align-items:center; gap:14px; padding:4px 2px 22px; border-bottom:2px solid #ead9b9; }
.change-stamp { padding:7px 9px; background:var(--tomato); color:#fff; border:2px solid var(--ink); border-radius:8px; font:900 10px/1 monospace; letter-spacing:1px; transform:rotate(-4deg); }
.change-hero .page-head-title { margin:0; }
.change-hero .page-head-desc { margin:4px 0 0; }
.change-dot { margin-left:auto; padding:7px 11px; color:#497f60; background:#e7f7ea; border-radius:999px; font-size:12px; font-weight:800; }
.release-timeline { position:relative; margin:26px 0 30px; }
.release-timeline::before { content:''; position:absolute; left:16px; top:12px; bottom:12px; width:2px; background:#d8c8aa; }
.release-item { position:relative; display:grid; grid-template-columns:34px minmax(0, 1fr); gap:12px; padding-bottom:18px; }
.release-marker { position:relative; z-index:1; padding-top:14px; }
.release-marker span { display:block; width:12px; height:12px; margin-left:10px; background:var(--mustard); border:2px solid var(--ink); border-radius:50%; box-shadow:2px 2px 0 var(--ink); }
.release-card { padding:16px 18px; background:#fff; border:1px solid #e7d9c3; border-radius:14px; box-shadow:0 3px 0 rgba(32,27,23,.06); }
.release-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.release-head > div { display:flex; align-items:center; gap:10px; }
.release-version { padding:4px 7px; color:var(--tomato-deep); background:#fff0e8; border-radius:6px; font:900 11px/1 monospace; }
.release-head b { font-size:15px; }
.release-head time { color:var(--muted); font-size:12px; white-space:nowrap; }
.release-card p { margin:10px 0 8px; color:var(--muted); font-size:13px; }
.release-card ul { margin:0; padding-left:18px; }
.release-card li { margin:5px 0; font-size:13px; line-height:1.55; }
.maker-card { display:flex; align-items:flex-start; gap:16px; padding:18px; background:#fff5d8; border:2px solid var(--ink); border-radius:16px; box-shadow:4px 4px 0 var(--ink); }
.maker-mark { flex:0 0 42px; width:42px; height:42px; display:grid; place-items:center; background:var(--mustard); border:2px solid var(--ink); border-radius:11px; font-weight:900; }
.maker-card span { color:var(--tomato); font-size:12px; font-weight:800; }
.maker-card h3 { margin:3px 0 6px; font-size:17px; }
.maker-card p { margin:0; color:#5e5245; line-height:1.65; font-size:13px; }
@media (max-width:620px) { .change-hero { flex-wrap:wrap; } .change-dot { margin-left:0; } .release-head { align-items:flex-start; flex-direction:column; gap:6px; } }
</style>
