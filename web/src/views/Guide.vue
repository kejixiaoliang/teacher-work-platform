<template>
  <div class="page-card guide-page">
    <div class="guide-hero">
      <div><span class="guide-kicker">TEACHER WORKBENCH</span><h2 class="page-head-title">使用指南</h2><p class="page-head-desc">按“建班 → 建档 → 日常记录 → 定期备份”的顺序使用，第一次打开也能快速上手。</p></div>
      <div class="guide-hero-note">第一次使用<br><b>先建班，再导入学生</b></div>
    </div>
    <section class="guide-section"><h3>第一次使用：5 分钟流程</h3><div class="guide-steps"><div v-for="(step, index) in quickStart" :key="step.title" class="guide-step"><span>{{ String(index + 1).padStart(2, '0') }}</span><b>{{ step.title }}</b><p>{{ step.text }}</p></div></div></section>
    <section class="guide-section"><h3>模块说明</h3><div class="guide-grid"><article v-for="item in modules" :key="item.title" class="guide-card"><div class="guide-card-head"><b>{{ item.title }}</b><el-tag size="small" round>{{ item.tag }}</el-tag></div><p>{{ item.text }}</p><div class="guide-how"><b>怎么用：</b>{{ item.how }}</div><small>{{ item.tip }}</small></article></div></section>
    <section class="guide-section backup-section">
      <h3>备份与恢复：先分清两种备份</h3>
      <div class="backup-grid">
        <article class="backup-card"><el-tag type="warning" round>班级备份</el-tag><h4>只保存一个班级的业务数据</h4><p>包含该班的班级信息、学生、座位、成绩、考勤、请假、文档、值日、沟通、跟进和表现记录，以及该班引用的上传文件。</p><small>入口：班级设置 → 对应班级 → 备份。它适合单班留档；恢复前必须确认是否会覆盖当前工作台。</small></article>
        <article class="backup-card backup-card-full"><el-tag type="success" round>教师工作台完整备份</el-tag><h4>保存整个应用的全部数据</h4><p>包含所有班级、所有业务数据和全部上传文件，适合换电脑、版本升级前和定期整体留档。</p><small>入口：概览首页 → 数据管理 → 完整备份（含附件）。恢复会替换整个工作台。</small></article>
        <article class="backup-card"><el-tag type="info" round>JSON 数据导出</el-tag><h4>只导出业务数据</h4><p>导出规范化 JSON 和附件元数据，不包含附件内容，适合跨版本迁移、数据交换和上传到未来的小程序或云端。</p><small>入口：概览首页 → 数据管理 → 导出 JSON（不含附件）。</small></article>
        <article class="backup-card"><el-tag type="primary" round>更新导入</el-tag><h4>追加到当前工作台</h4><p>当前版本的 JSON 更新导入会作为新的数据集追加，不清空现有数据；恢复旧版数据前仍应先下载完整 ZIP。</p><small>入口：概览首页 → 数据管理 → 更新导入 JSON。</small></article>
      </div>
      <div class="backup-warning"><b>重要：</b>“从备份恢复”会覆盖当前库中的全部业务数据；“更新导入 JSON”会追加一个新数据集。恢复时不会把班级备份自动合并到现有工作台。新版 v1 JSON 和旧版 tables JSON 都可以在全新工作台恢复所有结构化数据，JSON 不包含附件文件。恢复前请先下载当前完整 ZIP，并复制到应用目录之外的安全位置。密码、恢复密钥和访问模式不会被备份覆盖。</div>
      <ol class="backup-list"><li><b>日常备份：</b>每周至少下载一次完整 ZIP，并另存到应用目录之外；需要跨版本迁移时再同时导出 JSON。</li><li><b>换电脑：</b>旧电脑下载完整 ZIP，新电脑在教师模式下选择“从备份恢复”，确认覆盖提示后选择 ZIP 或 JSON。</li><li><b>只迁移数据：</b>使用“导出 JSON”后，在新工作台选择“从备份恢复”，它会恢复班级、学生、成绩、考勤等结构化数据，但不会恢复附件。</li><li><b>追加数据：</b>使用“更新导入 JSON”，它不会清空当前数据，而是追加为新的数据集。</li><li><b>升级前：</b>先备份，再升级程序；不要手动编辑 ZIP 或 JSON。导入完成后应根据提示核对班级、学生和成绩数量。</li></ol>
    </section>
    <section class="guide-section access-section"><h3>教师工作台模式与班级公开模式</h3><div class="access-guide-grid"><article class="backup-card"><el-tag type="success" round>教师工作台模式</el-tag><h4>维护和保护完整数据</h4><p>输入教师密码后使用。可以管理学生隐私、成绩、文档、备份、恢复、更新导入和访问策略。完成工作后建议主动锁定。</p></article><article class="backup-card"><el-tag type="warning" round>班级公开模式</el-tag><h4>投屏和公开查看</h4><p>用于课堂现场或公开展示。只开放允许公开的模块，成绩、隐私档案、文档和数据管理默认锁定。需要处理敏感数据时先切换到教师模式。</p></article></div><p class="backup-warning"><b>安全提醒：</b>自动锁定后会回到班级公开模式；备份文件包含学生和成绩等敏感信息，不能发送到不可信位置。</p></section>
    <section class="guide-section guide-reminder"><h3>自动记录与使用提醒</h3><ul><li><b>学生体征：</b>保存学生时，身高、左右眼视力或近视状态变化会自动进入身高视力历史。</li><li><b>学期存档：</b>概览首页的“学期存档”会保存当前班级在读学生的体征与成绩快照，适合学期末操作。</li><li><b>考勤请假：</b>考勤按当天全员出勤起步，已批准且覆盖当天的请假会自动显示为请假。</li><li><b>成绩管理：</b>先新建考试和科目，再录入或导入 Excel；保存后可查看科目统计、总分排名和个人趋势。</li><li><b>表现量化：</b>行为项目按固定分值记分，批量记分支持全班、值日组和班委组，修改记录会保留修正历史。</li><li><b>本地数据：</b>应用默认把数据保存在本机，不会主动上传；请妥善保管备份 ZIP 和导出的学生资料。</li></ul></section>
  </div>
</template>

<script setup>
const quickStart = [
  { title: '建立班级', text: '进入“班级设置”新建班级，填写学年、学期、班主任和座位行列。' },
  { title: '导入学生', text: '进入“学生管理”下载 Excel 模板，填写姓名、学号等信息后导入，也可以逐个新增。' },
  { title: '检查座位', text: '进入“座位管理”拖拽或点击移动学生，确认教室布局后保存座位布局。' },
  { title: '开始记录', text: '按需要使用考勤、请假、成绩、表现量化、值日和家校沟通模块。' },
  { title: '定期备份', text: '在概览首页下载完整备份；只处理单个班级时，再到班级设置下载班级备份。' },
];
const modules = [
  { title: '概览首页', tag: '总览', text: '查看人数、健康与考勤预警、今日工作台、近期考试和待跟进事项。', how: '每天打开后先看“今日工作台”和预警，点击事项可跳到对应模块。', tip: '适合作为每天的入口。' },
  { title: '班级设置', tag: '基础', text: '新建、编辑、切换和删除班级，设置学年、学期及座位网格。', how: '先建班；需要迁移单个班时，在对应行点击“备份”。删除前系统会先自动下载该班备份。', tip: '切换班级会影响其他模块显示的数据。' },
  { title: '学生管理', tag: '档案', text: '维护学生基本资料、健康体征、成长记录、跟进事项和家校沟通。', how: '优先用模板批量导入，再逐个补充联系方式和健康信息。', tip: '体征变化保存后会自动留下历史。' },
  { title: '座位管理', tag: '座位', text: '按教室布局查看座位，支持移动、交换和保存布局快照。', how: '拖拽学生到目标座位；点击空座位也可以移动，完成后点击保存。', tip: '调整前确认当前班级。' },
  { title: '成绩管理', tag: '成绩', text: '管理考试、科目和学生成绩，支持手动录入、Excel 导入、排名、统计和趋势。', how: '新建考试 → 添加科目 → 录入/导入 → 保存 → 查看排名与统计。', tip: '离开页面再回来会自动重新加载已保存成绩。' },
  { title: '考勤与请假', tag: '日常', text: '登记每日出勤、迟到、缺勤和请假，并查看月度汇总。', how: '先选择日期，确认默认状态，再修改异常学生；请假审批后会联动考勤。', tip: '每日登记后再离开页面。' },
  { title: '表现量化', tag: '评价', text: '维护行为规则，按个人、全班、值日组或班委组记录表现分。', how: '先启用规则，再选择日期和学生范围批量记分，最后在统计中复盘。', tip: '修改记录会保留历史。' },
  { title: '班级事务', tag: '协作', text: '管理值日、班委、课代表、文档、通讯录和家校沟通。', how: '按周维护值日和班委，文档上传后可从学生或班级相关页面查找。', tip: '上传文档也会进入完整备份。' },
  { title: '数据分析', tag: '复盘', text: '用图表查看班级结构、健康、成绩和表现趋势。', how: '先完成基础数据录入，再按当前班级和时间范围查看图表。', tip: '分析结果来自已保存数据。' },
  { title: '使用指南 / 版本更新', tag: '支持', text: '查看本页操作说明和版本更新记录。', how: '遇到新功能先看指南，再查看版本更新了解变化。', tip: '建议打印或收藏备份流程。' },
];
</script>

<style scoped>
.guide-hero { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; padding-bottom:22px; border-bottom:2px solid #ead9b9; }
.guide-kicker { color:var(--tomato); font-size:11px; letter-spacing:1.5px; font-weight:900; }
.guide-hero-note { padding:12px 16px; background:var(--mustard); border:2px solid var(--ink); border-radius:12px; box-shadow:3px 3px 0 var(--ink); font-size:12px; line-height:1.65; }
.guide-section { margin-top:26px; }.guide-section h3 { margin:0 0 12px; font-size:16px; }
.guide-steps { display:grid; grid-template-columns:repeat(5, 1fr); gap:12px; }.guide-step { position:relative; padding:16px; background:#fffaf0; border:1px solid #e5d6bc; border-radius:14px; }
.guide-step span { display:block; color:var(--tomato); font-size:12px; font-weight:900; letter-spacing:1px; }.guide-step b { display:block; margin-top:5px; }
.guide-step p, .guide-card p, .backup-card p { margin:6px 0 0; color:var(--muted); font-size:13px; line-height:1.6; }
.guide-grid, .backup-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; }.guide-card, .backup-card { padding:15px; background:#fff; border:1px solid #e8dcc5; border-radius:14px; box-shadow:0 2px 0 rgba(32,27,23,.06); }
.guide-card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }.guide-how { margin-top:10px; font-size:12px; line-height:1.6; }.guide-card small, .backup-card small { display:block; margin-top:10px; color:#8a6c3e; font-size:12px; line-height:1.55; }
.backup-grid { grid-template-columns:repeat(2, 1fr); }.backup-card h4 { margin:12px 0 0; }.backup-warning { margin-top:14px; padding:13px 15px; background:#fff1e8; border:1px solid #e3a07e; border-left:5px solid var(--tomato); border-radius:0 12px 12px 0; font-size:13px; line-height:1.7; }.backup-list { margin:14px 0 0; padding-left:22px; }.backup-list li { margin:8px 0; line-height:1.65; font-size:13px; }
.guide-reminder { padding:18px 20px; background:#fff7dd; border-left:5px solid var(--tomato); border-radius:0 14px 14px 0; }.guide-reminder ul { margin:0; padding-left:20px; }.guide-reminder li { margin:8px 0; line-height:1.65; font-size:13px; }
@media (max-width:1100px) { .guide-steps { grid-template-columns:repeat(3, 1fr); } .guide-grid { grid-template-columns:repeat(2, 1fr); } } @media (max-width:620px) { .guide-hero { flex-direction:column; } .guide-steps, .guide-grid, .backup-grid { grid-template-columns:1fr; } }
</style>
