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

    <section class="update-panel">
      <div class="update-panel-head">
        <div>
          <span class="change-stamp update-stamp">UPDATE CHANNEL</span>
          <h3>当前版本与更新</h3>
          <p>安装版可以安全检查并安装新版本；便携版继续使用手动替换方式。</p>
        </div>
        <div class="runtime-facts">
          <span>版本 <b>{{ appVersion }}</b></span>
          <span>数据库 <b>v{{ databaseVersion }}</b></span>
          <span>{{ runtimeLabel }}</span>
        </div>
      </div>
      <div class="update-actions">
        <el-button v-if="canUpdate" type="primary" :loading="updateState === 'checking'" @click="checkForUpdate">
          {{ updateState === 'checking' ? '检查中…' : '检查更新' }}
        </el-button>
        <el-tag v-else type="info">便携版：手动升级</el-tag>
        <span v-if="updateState === 'up-to-date'" class="update-hint">当前已是最新版本</span>
        <span v-else-if="updateState === 'checking'" class="update-hint">正在连接更新源…</span>
        <span v-else-if="updateState === 'error'" class="update-error">{{ updateMessage }}</span>
      </div>
      <div v-if="updateState === 'available' && pendingUpdate" class="available-update">
        <div>
          <b>发现 v{{ pendingUpdate.version }}</b>
          <p v-if="pendingUpdate.notes">{{ pendingUpdate.notes }}</p>
        </div>
        <el-button type="success" :loading="updateState === 'installing'" @click="installPendingUpdate">退出并安装更新</el-button>
      </div>
      <div v-if="updateState === 'installing'" class="update-progress">
        <el-progress :percentage="downloadPercentage" :status="downloadFinished ? 'success' : undefined" />
        <span>{{ downloadMessage }}</span>
      </div>
    </section>

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
import { computed, ref, shallowRef } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api.js';
import { desktopApi } from '../platform/desktopApi.js';
import { getRuntimeConfig } from '../platform/runtimeConfig.js';
import { store } from '../store.js';

const runtime = ref(getRuntimeConfig());
const appVersion = computed(() => runtime.value.appVersion || '0.9.0');
const databaseVersion = computed(() => runtime.value.databaseVersion || 8);
const canUpdate = computed(() => runtime.value.runtimeProfile === 'installed');
const runtimeLabel = computed(() => canUpdate.value ? '安装版 · stable' : '便携版 · stable');
const updateState = ref('idle');
const pendingUpdate = shallowRef(null);
const updateMessage = ref('');
const downloadBytes = ref(0);
const contentLength = ref(0);
const downloadFinished = ref(false);
const downloadPercentage = computed(() => contentLength.value
  ? Math.min(100, Math.round(downloadBytes.value / contentLength.value * 100)) : 0);
const downloadMessage = computed(() => downloadFinished.value
  ? '下载完成，正在准备重启…' : `正在下载更新包（${downloadPercentage.value}%）`);

async function checkForUpdate() {
  updateState.value = 'checking';
  updateMessage.value = '';
  pendingUpdate.value = null;
  const result = await desktopApi.updater.checkForUpdate();
  if (result.status === 'available') {
    pendingUpdate.value = result;
    updateState.value = 'available';
  } else if (result.status === 'up-to-date') {
    updateState.value = 'up-to-date';
  } else {
    updateState.value = 'error';
    updateMessage.value = result.message || '暂时无法检查更新，请稍后重试。';
  }
}

async function installPendingUpdate() {
  if (!pendingUpdate.value || store.seatsDirty) {
    if (store.seatsDirty) ElMessage.warning('座位页有未保存修改，请先保存或放弃修改后再更新。');
    return;
  }
  const targetVersion = pendingUpdate.value.version;
  const confirmed = await ElMessageBox.confirm(
    `安装 v${targetVersion} 前会创建包含附件的本地恢复点，应用随后会退出并重启。确定继续吗？`,
    '准备安装更新', { type: 'warning', confirmButtonText: '备份并更新', cancelButtonText: '稍后再说' },
  ).catch(() => false);
  if (!confirmed) return;

  updateState.value = 'installing';
  downloadBytes.value = 0;
  contentLength.value = 0;
  downloadFinished.value = false;
  try {
    const label = `pre-update-v${appVersion.value}-to-v${targetVersion}`;
    await api.backup.snapshot(label);
    const result = await desktopApi.updater.installUpdate(pendingUpdate.value, {
      onProgress(event) {
        if (event.status === 'started') contentLength.value = event.contentLength || 0;
        if (event.status === 'progress') {
          downloadBytes.value = event.downloaded;
          contentLength.value ||= event.contentLength || 0;
        }
        if (event.status === 'finished') downloadFinished.value = true;
      },
      onRestart() { downloadFinished.value = true; },
    });
    if (result.status === 'error') throw new Error(result.message);
  } catch (error) {
    updateState.value = 'error';
    updateMessage.value = error.message || '更新安装失败，请稍后重试。';
    ElMessage.error(updateMessage.value);
  }
}

const releases = [
  {
    version: '0.9.0', date: '2026-08-29', title: 'Windows 安装版与自动更新基础建设',
    summary: '新增面向 Windows 安装版的运行配置与发布基础，同时保留绿色便携版，逐步接入安全、可验证的应用更新链路。',
    entries: ['安装版与便携版共用同一套业务代码、数据库和备份格式；安装版数据与程序目录分离。', '建立 installed、portable 和 dev 运行 profile，避免安装版更新覆盖用户数据。', '新增 NSIS 安装包和绿色便携包的独立构建入口，后续接入 Tauri updater 签名更新。'],
  },
  {
    version: '0.8.0', date: '2026-08-29', title: '字段、科目与值日配置兼容升级',
    summary: '修复用户反馈中的字段自定义、考试科目和默认值日分组问题，并保证备份升级后可继续读取。',
    entries: ['学生字段改为预设目录，可按班级显示/隐藏、改名和排序；隐藏字段不会删除原始数据。', '学生导入模板和导出 Excel 按启用字段生成，并写入隐藏元数据工作表。', '备份升级为 v2，包含字段配置、字段值、班级词条和科目模板；兼容旧 v1 与 tables JSON。', '考试科目扩充预设，已有成绩的科目不能直接删除；科目模板按班级保存。', '值日自动分组默认五组并对应周一至周五，值日表按当天星期显示。'],
  },
  {
    version: '0.7.0', date: '2026-08-25', title: '数据备份交换与迁移能力升级',
    summary: '围绕数据可靠性新增规范化 JSON 导出、带附件的完整 ZIP 备份、旧版数据恢复和更新导入，同时修复成绩页面返回后内容消失的问题。',
    entries: ['新增 JSON 数据导出：包含完整业务数据、稳定记录标识和 SHA-256 完整性校验，不包含附件内容、密码、恢复密钥或访问 Token。', '完整备份统一使用 backup.json 与 files 附件目录，恢复前会校验数据和附件，并保留当前设备的密码保护与访问模式。', '支持旧版 tables JSON/ZIP 数据恢复；新增“更新导入 JSON”，当前以追加新数据集方式导入，不清空已有工作台。', '成绩管理首次进入和路由返回时会自动重新加载考试、学生和已保存成绩；班级设置保留显式班级备份入口。', '所有 ZIP、JSON、Excel、CSV 导出、学生模板和文档附件下载统一支持桌面版系统“另存为”路径选择，浏览器版继续使用浏览器下载。', '使用指南补充 JSON、完整 ZIP、整体恢复、更新导入以及教师工作台/班级公开模式的使用说明。'],
  },
  {
    version: '0.6.0', date: '2026-08-25', title: '隐私模式与工作台上锁',
    summary: '让班级电脑可以安全交给学生或班干部使用，教师隐私模块默认受密码保护。',
    entries: ['新增教师模式与班级模式，应用重启后默认进入班级模式。', '新增教师密码设置、模式切换和受保护模块临时解锁。', '成绩、学生隐私档案、文档、请假、家校沟通和班级设置在班级模式下受保护。', '班级模式下学生基础名单接口仅返回课堂所需字段，敏感接口由后端统一拒绝。'],
  },
  {
    version: '0.5.0', date: '2026-08-21', title: '班主任日常工作台',
    summary: '把学生跟进、今日考勤、请假、值日和近期考试聚合到一个可执行的首页工作台。',
    entries: ['新增结构化跟进事项，支持待处理、跟进中、已完成和已取消状态。', '学生详情新增跟进事项入口，可创建、编辑、完成、取消和重新打开事项。', '概览首页新增今日工作台，聚合今日考勤、请假、值日、近期考试和逾期跟进事项。', '数据库升级到 v5，完整备份和班级备份均包含跟进事项；成长报告与班级月报列入后续批次。'],
  },
  {
    version: '0.4.2', date: '2026-08-17', title: '备份归档与文件访问安全升级',
    summary: '将数据库与上传附件打包为可迁移 ZIP，并把文档预览/下载改为短时一次性授权。',
    entries: ['完整备份和班级删除前备份现在包含数据库、上传文件清单与文件本体，恢复前校验路径、大小和 SHA-256。', '支持 ZIP 备份恢复，同时兼容 v0.4.1 及更早版本的 JSON 备份。', '文档预览和下载不再把长期 API token 放进 URL，改用 30 秒、绑定文档且成功即失效的一次性授权。', '新增归档目录穿越、重复 token、过期 token、附件恢复失败和 Blob 预览下载回归测试。'],
  },
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
.update-panel { margin:20px 0 26px; padding:18px; background:#fffdf5; border:2px solid var(--ink); border-radius:16px; box-shadow:4px 4px 0 var(--ink); }
.update-panel-head { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; }
.update-panel h3 { margin:10px 0 4px; font-size:18px; }
.update-panel p { margin:0; color:var(--muted); font-size:13px; line-height:1.6; }
.update-stamp { display:inline-block; transform:rotate(-2deg); }
.runtime-facts { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; }
.runtime-facts span { padding:6px 10px; color:var(--ink); background:var(--mint); border:2px solid var(--ink); border-radius:999px; font-size:12px; font-weight:700; white-space:nowrap; }
.update-actions { display:flex; align-items:center; gap:12px; margin-top:16px; }
.update-hint { color:var(--muted); font-size:12px; }
.update-error { color:var(--tomato-deep); font-size:12px; }
.available-update { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-top:14px; padding:12px; background:#e9f7ed; border:1px dashed #5d9b6d; border-radius:10px; }
.available-update b { color:#317345; }
.available-update p { margin-top:4px; }
.update-progress { margin-top:14px; }
.update-progress > span { display:block; margin-top:6px; color:var(--muted); font-size:12px; }
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
@media (max-width:620px) { .change-hero { flex-wrap:wrap; } .change-dot { margin-left:0; } .release-head { align-items:flex-start; flex-direction:column; gap:6px; } .update-panel-head, .available-update { flex-direction:column; } .runtime-facts { justify-content:flex-start; } }
</style>
