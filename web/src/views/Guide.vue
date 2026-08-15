<template>
  <div class="page-card guide-page">
    <div class="guide-hero">
      <div>
        <span class="guide-kicker">TEACHER WORKBENCH</span>
        <h2 class="page-head-title">使用指南</h2>
        <p class="page-head-desc">从建班、建档到日常管理，按下面的顺序即可快速上手。</p>
      </div>
      <div class="guide-hero-note">建议先完成<br><b>班级设置 → 学生管理</b></div>
    </div>

    <section class="guide-section">
      <h3>第一次使用</h3>
      <div class="guide-steps">
        <div v-for="(step, index) in quickStart" :key="step.title" class="guide-step">
          <span>{{ String(index + 1).padStart(2, '0') }}</span>
          <b>{{ step.title }}</b>
          <p>{{ step.text }}</p>
        </div>
      </div>
    </section>

    <section class="guide-section">
      <h3>模块说明</h3>
      <div class="guide-grid">
        <article v-for="item in modules" :key="item.title" class="guide-card">
          <div class="guide-card-head"><b>{{ item.title }}</b><el-tag size="small" round>{{ item.tag }}</el-tag></div>
          <p>{{ item.text }}</p>
          <small>{{ item.tip }}</small>
        </article>
      </div>
    </section>

    <section class="guide-section guide-reminder">
      <h3>自动记录规则</h3>
      <ul>
        <li><b>学生体征：</b>保存学生编辑时，身高、左/右眼视力或近视状态发生变化，会自动写入“身高视力历史”。</li>
        <li><b>学期存档：</b>学生管理页的“学期存档”会为当前班级所有在读学生保存当期体征快照。</li>
        <li><b>请假考勤：</b>有效请假覆盖当天时，考勤页会自动标为“请假”；其余学生默认“出勤”。</li>
        <li><b>表现量化：</b>行为项目使用固定分值，支持全班、值日组和班委组批量记分；记录修改会保留修正历史。</li>
      </ul>
    </section>
  </div>
</template>

<script setup>
const quickStart = [
  { title: '建立班级', text: '在班级设置中填写学年、学期与座位网格。' },
  { title: '导入学生', text: '在学生管理下载模板，填写后导入；也可逐个新增。' },
  { title: '开始日常管理', text: '登记考勤、请假、成绩与沟通，数据会汇入对应档案。' },
];

const modules = [
  { title: '概览首页', tag: '总览', text: '查看班级人数、预警和待处理事项。', tip: '适合每天打开后先检查。' },
  { title: '学生管理', tag: '档案', text: '维护学生信息、健康数据、成长记录与家校沟通。', tip: '体征变化保存后会自动进入历史。' },
  { title: '座位管理', tag: '座位', text: '拖拽或点选学生后调整座位，也可保存布局快照。', tip: '点击空座位可移动学生。' },
  { title: '成绩管理', tag: '成绩', text: '创建考试、增加学科字段、录入或从 Excel 导入成绩。', tip: '学科可按不同年级自行增加。' },
  { title: '考勤与请假', tag: '日常', text: '每日默认全员出勤，并与已批准请假信息联动。', tip: '请假覆盖当天会自动提示。' },
  { title: '表现量化', tag: '评价', text: '按自定义行为项目给学生记分，查看月度排名和学期累计。', tip: '修改记录时填写原因，可在历史中追溯。' },
  { title: '班级事务', tag: '协作', text: '管理值日、班委、课代表、文档与家校沟通。', tip: '适合在每周班务整理时集中维护。' },
];
</script>

<style scoped>
.guide-hero { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; padding-bottom:22px; border-bottom:2px solid #ead9b9; }
.guide-kicker { color:var(--tomato); font-size:11px; letter-spacing:1.5px; font-weight:900; }
.guide-hero-note { padding:12px 16px; background:var(--mustard); border:2px solid var(--ink); border-radius:12px; box-shadow:3px 3px 0 var(--ink); font-size:12px; line-height:1.65; }
.guide-section { margin-top:26px; }
.guide-section h3 { margin:0 0 12px; font-size:16px; }
.guide-steps { display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; }
.guide-step { position:relative; padding:16px; background:#fffaf0; border:1px solid #e5d6bc; border-radius:14px; }
.guide-step span { display:block; color:var(--tomato); font-size:12px; font-weight:900; letter-spacing:1px; }
.guide-step b { display:block; margin-top:5px; }
.guide-step p, .guide-card p { margin:6px 0 0; color:var(--muted); font-size:13px; line-height:1.6; }
.guide-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; }
.guide-card { padding:15px; background:#fff; border:1px solid #e8dcc5; border-radius:14px; box-shadow:0 2px 0 rgba(32,27,23,.06); }
.guide-card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.guide-card small { display:block; margin-top:10px; color:#8a6c3e; font-size:12px; }
.guide-reminder { padding:18px 20px; background:#fff7dd; border-left:5px solid var(--tomato); border-radius:0 14px 14px 0; }
.guide-reminder ul { margin:0; padding-left:20px; }
.guide-reminder li { margin:8px 0; line-height:1.65; font-size:13px; }
@media (max-width:900px) { .guide-grid { grid-template-columns:repeat(2, 1fr); } }
@media (max-width:620px) { .guide-hero { flex-direction:column; } .guide-steps, .guide-grid { grid-template-columns:1fr; } }
</style>
