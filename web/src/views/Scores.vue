<template>
  <div class="page-card">
    <div class="page-head">
      <div>
        <h2 class="page-head-title">成绩管理</h2>
        <p class="page-head-desc">创建考试、录入成绩、查看排名统计与学生进步趋势</p>
      </div>
      <div class="page-head-actions">
        <el-button @click="loadDemoScores" :loading="demoLoading">载入示例成绩</el-button>
        <el-button type="primary" :icon="Plus" @click="openExamDialog()">新建考试</el-button>
      </div>
    </div>

    <div class="scores-workspace" v-loading="loading">
      <!-- 左侧考试列表 -->
      <aside class="exam-list">
        <div class="exam-item" :class="{ active: currentExam?.id === e.id }" v-for="e in exams" :key="e.id"
             @click="selectExam(e)">
          <div class="exam-head">
            <span class="exam-name">{{ e.name }}</span>
            <span>
              <el-button class="mini-btn mini-btn-edit" size="small" @click.stop="openExamDialog(e)">改</el-button>
              <el-button class="mini-btn mini-btn-del" size="small" @click.stop="removeExam(e)">删</el-button>
            </span>
          </div>
          <div class="exam-meta">{{ e.date || '未定日期' }} · {{ e.subjects.length }} 科 · 已录 {{ e.scored_count }} 人</div>
        </div>
        <el-empty v-if="!exams.length" description="还没有考试" :image-size="60">
          <el-button type="primary" size="small" @click="openExamDialog()">新建考试</el-button>
        </el-empty>
      </aside>

      <!-- 右侧内容 -->
      <div class="exam-content">
        <template v-if="currentExam">
          <el-tabs v-model="tab" style="margin-top:6px">
            <!-- 录入 -->
            <el-tab-pane label="成绩录入" name="entry">
              <div class="toolbar">
                <span class="text-muted">直接点击数字编辑，改完点「保存成绩」（{{ currentExam.name }}）</span>
                <div class="spacer"></div>
                <el-button :icon="Upload" @click="openScoreImport">导入 Excel</el-button>
                <el-button :icon="Download" @click="exportScores">导出成绩表</el-button>
                <el-button type="success" :disabled="!scoreDirty" @click="saveScores">保存成绩</el-button>
              </div>
              <el-table :data="scoreRows" size="small" border max-height="520">
                <el-table-column prop="name" label="姓名" width="100" fixed>
                  <template #default="{ row }"><b>{{ row.name }}</b></template>
                </el-table-column>
                <el-table-column v-for="sub in currentExam.subjects" :key="sub" :label="sub" min-width="90">
                  <template #default="{ row }">
                    <el-input-number v-model="scoreMatrix[row.id][sub]" :min="0" :max="150" :controls="false"
                                     size="small" style="width:100%" placeholder="—" @change="scoreDirty = true" />
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- 排名统计 -->
            <el-tab-pane label="排名与统计" name="analysis">
              <div class="toolbar">
                <span class="text-muted">各科指标与总分排名</span>
                <div class="spacer"></div>
                <el-button :icon="Download" @click="exportRanking">导出排名表</el-button>
              </div>
              <div v-if="subjectStats.length" class="stat-cards">
                <div v-for="s in subjectStats" :key="s.subject" class="stat-card">
                  <div class="sc-subject">{{ s.subject }}</div>
                  <div class="sc-row">平均 <b>{{ s.avg }}</b> ｜ 最高 <b>{{ s.max }}</b></div>
                  <div class="sc-row">优秀率 <b>{{ s.excellent }}%</b> ｜ 及格率 <b>{{ s.pass }}%</b></div>
                </div>
              </div>
              <el-table :data="ranking" size="small" border stripe>
                <el-table-column prop="rank" label="排名" width="70">
                  <template #default="{ row }">
                    <el-tag :type="row.rank <= 3 ? 'warning' : 'info'" round>{{ row.rank }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="name" label="姓名" width="110" />
                <el-table-column v-for="sub in currentExam.subjects" :key="sub" :label="sub" min-width="80">
                  <template #default="{ row }">{{ row.scores[sub] ?? '—' }}</template>
                </el-table-column>
                <el-table-column prop="total" label="总分" width="90" sortable>
                  <template #default="{ row }"><b>{{ row.total }}</b></template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <!-- 趋势 -->
            <el-tab-pane label="进步趋势" name="trend">
              <div class="toolbar">
                <span>选择学生：</span>
                <el-select v-model="trendStudentId" filterable placeholder="选择学生" style="width:220px" @change="loadTrend">
                  <el-option v-for="s in allStudents" :key="s.id" :value="s.id" :label="`${s.name}（${s.school_no}）`" />
                </el-select>
              </div>
              <EChart v-if="trendPoints.length" :option="trendOption" height="320px" />
              <el-empty v-else description="该学生还没有多次考试成绩，或请先选择学生" :image-size="70" />
            </el-tab-pane>
          </el-tabs>
        </template>
        <el-empty v-else description="请选择左侧考试，或新建考试开始" :image-size="80" />
      </div>
    </div>

    <!-- 新建/编辑考试 -->
    <el-dialog v-model="examDialogVisible" :title="examForm.id ? '编辑考试' : '新建考试'" width="440px">
      <el-form label-width="70px">
        <el-form-item label="名称" required><el-input v-model="examForm.name" placeholder="如：期中考试" /></el-form-item>
        <el-form-item label="日期"><el-date-picker v-model="examForm.date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="科目">
          <el-select v-model="examForm.subjects" multiple filterable allow-create default-first-option
                     placeholder="输入科目后回车" style="width:100%">
            <el-option v-for="s in COMMON_SUBJECTS" :key="s" :value="s" :label="s" />
          </el-select>
          <div class="subject-template-row">
            <el-select v-model="selectedSubjectTemplate" clearable placeholder="套用科目模板" size="small"
                       style="flex:1" @change="applySubjectTemplate">
              <el-option v-for="template in subjectTemplates" :key="template.name" :value="template.name"
                         :label="`${template.name}（${template.subjects.length} 科）`" />
            </el-select>
            <el-button size="small" @click="saveSubjectTemplate">保存为模板</el-button>
          </div>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="examForm.remark" placeholder="选填（C 组：补上死字段）" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="examDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveExam">保存</el-button>
      </template>
    </el-dialog>

    <!-- 成绩导入预览 -->
    <el-dialog v-model="scoreImportVisible" title="导入成绩预览" width="640px">
      <el-alert type="info" :closable="false" style="margin-bottom:10px"
                :title="`解析到 ${scoreImportRows.length} 行成绩`" />
      <p class="text-muted" style="margin-top:0">Excel 第一行应为表头（学号/姓名 + 科目名），按学号或姓名匹配学生。</p>
      <el-table :data="scoreImportRows" size="small" max-height="320" border>
        <el-table-column prop="student_name" label="学生" width="100" />
        <el-table-column prop="subject" label="科目" width="90" />
        <el-table-column prop="score" label="成绩" width="80" />
        <el-table-column prop="note" label="提示" min-width="140" />
      </el-table>
      <template #footer>
        <el-button @click="scoreImportVisible = false">取消</el-button>
        <el-button type="primary" :loading="scoreImporting" @click="doScoreImport">确认导入</el-button>
      </template>
    </el-dialog>
    <input ref="scoreFileInput" type="file" accept=".xlsx,.xls" style="display:none" @change="onScoreFileChange" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Upload, Download } from '@element-plus/icons-vue';
import { api } from '../api.js';
import { store } from '../store.js';
import { desktopApi } from '../platform/desktopApi.js';
import EChart from '../components/EChart.vue';
import { useSeqLoad } from '../composables/useSeqLoad.js';
import { exportExcel } from '../utils/exportExcel.js';

// 每个数据域独立计数器，避免并发 load 相互作废
const examsSeq = useSeqLoad();
const studentsSeq = useSeqLoad();

const COMMON_SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '道德与法治', '信息技术', '体育', '音乐', '美术', '科学', '劳动', '心理健康'];

const exams = ref([]);
const currentExam = ref(null);
const loading = ref(false);
const tab = ref('entry');

const scoreMatrix = ref({});   // { studentId: { subject: score } }
const scoreRows = ref([]);     // [{id, name}] 显示用
const scoreDirty = ref(false);

const subjectStats = ref([]);
const ranking = ref([]);
const allStudents = ref([]);
const trendStudentId = ref(null);
const trendPoints = ref([]);

const examDialogVisible = ref(false);
const examForm = ref({ id: null, name: '', date: '', subjects: [] });
const demoLoading = ref(false);
const selectedSubjectTemplate = ref('');
const subjectTemplates = ref([]);

async function loadSubjectTemplates() {
  if (!store.currentClassId) { subjectTemplates.value = []; return; }
  try { subjectTemplates.value = await api.classes.subjectTemplates(store.currentClassId); }
  catch (error) { ElMessage.error('科目模板加载失败：' + error.message); }
}

function applySubjectTemplate(name) {
  const template = subjectTemplates.value.find(item => item.name === name);
  if (template) examForm.value.subjects = [...template.subjects];
}

async function saveSubjectTemplate() {
  const subjects = [...new Set(examForm.value.subjects.map(subject => String(subject).trim()).filter(Boolean))];
  if (!subjects.length) return ElMessage.warning('请先添加科目，再保存模板');
  const { value } = await ElMessageBox.prompt('给科目模板起个名字：', '保存科目模板', {
    inputValue: selectedSubjectTemplate.value || '',
    inputPattern: /\S+/,
    inputErrorMessage: '模板名称不能为空',
  }).catch(() => ({ value: '' }));
  const name = String(value || '').trim();
  if (!name) return;
  const existing = subjectTemplates.value.find(item => item.name === name);
  const next = await api.classes.saveSubjectTemplate(store.currentClassId, { name, subjects }, existing?.id || null);
  const index = subjectTemplates.value.findIndex(item => item.id === next.id);
  if (index >= 0) subjectTemplates.value.splice(index, 1, next);
  else subjectTemplates.value.push(next);
  selectedSubjectTemplate.value = name;
  ElMessage.success(`科目模板「${name}」已保存`);
}

/* ---------- 成绩 Excel 导入 ---------- */
const scoreFileInput = ref(null);
const scoreImportVisible = ref(false);
const scoreImporting = ref(false);
const scoreImportRows = ref([]);   // [{studentId, subject, score, note, student_name}]

function openScoreImport() {
  if (!currentExam.value) return ElMessage.warning('请先选择或创建考试');
  scoreFileInput.value?.click();
}

async function onScoreFileChange(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!currentExam.value) return ElMessage.warning('请先选择考试');
  try {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws || ws.rowCount < 2) return ElMessage.warning('Excel 中没有数据');
    // 表头：第 1 行；按名称定位学号/姓名列与科目列
    const header = [];
    ws.getRow(1).eachCell((cell, col) => { header[col - 1] = String(cell.text ?? '').trim(); });
    const stuMap = new Map(allStudents.value.map(s => [String(s.school_no || ''), s]));
    const nameMap = new Map(allStudents.value.map(s => [s.name, s]));
    const ID_HEADERS = ['学号', '姓名', '名字', '学生', 'number', 'name', '姓名学号'];
    let noCol = -1, nameCol = -1;
    const subIdx = new Map(); // 科目名 -> 列号（1-based）
    header.forEach((h, i) => {
      const col = i + 1;
      if (!h) return;
      if (h === '学号' || h.toLowerCase() === 'number' || h.toLowerCase() === 'no') noCol = col;
      else if (h === '姓名' || h === '名字' || h === '学生' || h.toLowerCase() === 'name') nameCol = col;
      else if (!ID_HEADERS.includes(h)) subIdx.set(h, col);
    });
    if (noCol === -1 && nameCol === -1) return ElMessage.warning('未找到学号/姓名列（表头请包含「学号」或「姓名」）');
    if (!subIdx.size) return ElMessage.warning('未找到科目列（请把各科成绩放在学号/姓名右侧的列中）');
    const rows = [];
    ws.eachRow((row, rn) => {
      if (rn === 1) return;
      const no = String(row.getCell(noCol).text ?? row.getCell(noCol).value ?? '').trim();
      const nm = String(row.getCell(nameCol).text ?? row.getCell(nameCol).value ?? '').trim();
      const stu = (noCol !== -1 && stuMap.get(no)) || (nm ? nameMap.get(nm) : null);
      const label = no || nm || `第${rn}行`;
      for (const [sub, col] of subIdx) {
        const cell = row.getCell(col);
        const v = cell.value;
        if (v === undefined || v === null || v === '') continue;
        const n = Number(v);
        if (!Number.isFinite(n)) {
          rows.push({ studentId: stu?.id ?? null, subject: sub, score: null, student_name: stu?.name || label, note: `「${v}」非数字` });
          continue;
        }
        rows.push({ studentId: stu?.id ?? null, subject: sub, score: n, student_name: stu?.name || label, note: stu ? '' : '未匹配到学生' });
      }
    });
    if (!rows.length) return ElMessage.warning('未解析到有效成绩');
    scoreImportRows.value = rows;
    scoreImportVisible.value = true;
  } catch (err) {
    ElMessage.error('文件解析失败：' + err.message);
  }
}

async function doScoreImport() {
  if (!currentExam.value) return;
  const valid = scoreImportRows.value.filter(r => r.studentId != null && r.score != null);
  if (!valid.length) return ElMessage.warning('没有可导入的有效成绩（请检查学号/姓名匹配）');
  scoreImporting.value = true;
  try {
    const r = await api.scores.save({ examId: currentExam.value.id, rows: valid.map(x => ({ studentId: x.studentId, subject: x.subject, score: x.score })) });
    if (r.skipped?.length) {
      ElMessage.warning(`已导入 ${r.count} 条成绩，跳过 ${r.skipped.length} 条：${r.skipped[0].reason}`);
    } else {
      ElMessage.success(`已导入 ${r.count} 条成绩` + (valid.length !== scoreImportRows.value.length ? `，跳过 ${scoreImportRows.value.length - valid.length} 条无效` : ''));
    }
    scoreImportVisible.value = false;
    selectExam(currentExam.value); // 刷新录入矩阵与统计
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    scoreImporting.value = false;
  }
}

/* ---------- 载入示例成绩：一键生成预设考试+全班成绩，方便查看效果 ---------- */
const DEMO_EXAM_NAME = '示例·期中考试';
const DEMO_SUBJECTS = ['语文', '数学', '英语', '物理', '化学'];

async function loadDemoScores() {
  if (!store.currentClassId) return ElMessage.warning('请先创建班级');
  // 切班级时 exams 可能还是旧班数据（loadExams 异步未完成），按 class_id 过滤当前班的示例考试
  const demo = exams.value.find(e => e.name === DEMO_EXAM_NAME && e.class_id === store.currentClassId);
  if (demo) {
    const ok = await selectExam(demo);
    if (!ok) return;
    tab.value = 'analysis';
    return ElMessage.info('示例考试已存在，已为你切换到「排名与统计」');
  }
  if (!allStudents.value.length) await loadStudents();
  const students = allStudents.value;
  if (!students.length) return ElMessage.warning('班级里还没有学生，请先到「学生管理」添加或导入');
  demoLoading.value = true;
  try {
    // 1) 创建示例考试（本地日期，避免 UTC 差一天）
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const r = await api.scores.createExam({
      class_id: store.currentClassId,
      name: DEMO_EXAM_NAME,
      date: localDate,
      subjects: DEMO_SUBJECTS,
    });
    // 2) 每个学生一个固定“能力值”，各科成绩 = 能力分 + 科目偏移 + 小波动
    const rows = [];
    const base = 100; // 满分
    for (const s of students) {
      const ability = 0.5 + ((s.id * 37) % 45) / 100; // 0.50 ~ 0.94，伪随机但稳定
      for (const sub of DEMO_SUBJECTS) {
        const offset = sub === '数学' ? 0 : sub === '英语' ? -3 : sub === '物理' ? 2 : 5;
        const noise = ((s.id * 13 + DEMO_SUBJECTS.indexOf(sub) * 7) % 11) - 5; // -5 ~ 5
        const score = Math.round(Math.min(base, Math.max(30, ability * base + offset + noise)));
        rows.push({ studentId: s.id, subject: sub, score });
      }
    }
    await api.scores.save({ examId: r.id, rows });
    ElMessage.success(`已生成示例考试「${DEMO_EXAM_NAME}」：${students.length} 名学生 × ${DEMO_SUBJECTS.length} 科`);
    await loadExams();
    const exam = exams.value.find(e => e.name === DEMO_EXAM_NAME && e.class_id === store.currentClassId);
    if (exam) {
      await selectExam(exam);
      tab.value = 'analysis';
    }
  } catch (e) {
    ElMessage.error('示例成绩生成失败：' + e.message);
  } finally {
    demoLoading.value = false;
  }
}

// 回滚标志：取消切班回滚时抑制二次确认
let restoringClass = false;

watch(() => store.currentClassId, async (newId, oldId) => {
  if (restoringClass) { restoringClass = false; return; }
  // 切班级：未保存成绩先确认（P0-1），确认后重置状态 + 重载
  if (scoreDirty.value && oldId != null) {
    const ok = await ElMessageBox.confirm('当前考试有未保存的成绩，切换班级将丢失。确定切换吗？', '未保存提示', { type: 'warning' }).catch(() => false);
    if (!ok) {
      // 取消：回滚班级选择（不重复弹确认）
      restoringClass = true;
      store.currentClassId = oldId;
      return;
    }
  }
  currentExam.value = null;
  tab.value = 'entry';
  scoreMatrix.value = {};
  scoreRows.value = [];
  subjectStats.value = [];
  ranking.value = [];
  trendStudentId.value = null;
  trendPoints.value = [];
  allStudents.value = [];
  scoreDirty.value = false;
  loadExams();
  loadStudents();
  loadSubjectTemplates();
}, { immediate: true });

// 离开页面（路由切换）前拦截未保存成绩
onBeforeRouteLeave(async () => {
  if (!scoreDirty.value) return true;
  const ok = await ElMessageBox.confirm('当前考试有未保存的成绩，离开将丢失。确定离开吗？', '未保存提示', { type: 'warning' }).catch(() => false);
  return ok;
});
// 刷新/关闭浏览器前兜底
function beforeUnloadGuard(e) {
  if (scoreDirty.value) { e.preventDefault(); e.returnValue = ''; }
}
if (!desktopApi.isTauri()) {
  window.addEventListener('beforeunload', beforeUnloadGuard);
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnloadGuard));
}

async function loadExams() {
  if (!store.currentClassId) { exams.value = []; currentExam.value = null; return; }
  const mySeq = examsSeq.seq();
  loading.value = true;
  try {
    const data = await api.scores.exams(store.currentClassId);
    if (examsSeq.isStale(mySeq)) return;
    exams.value = data;
    if (exams.value.length && !currentExam.value) selectExam(exams.value[0]);
  } catch (e) {
    ElMessage.error('考试列表加载失败：' + e.message);
  } finally {
    if (!examsSeq.isStale(mySeq)) loading.value = false;
  }
}
async function loadStudents() {
  if (!store.currentClassId) { allStudents.value = []; return; }
  const mySeq = studentsSeq.seq();
  try {
    const data = await api.students.list({ class_id: store.currentClassId, status: '在读' });
    if (studentsSeq.isStale(mySeq)) return;
    allStudents.value = data;
    // 切班竞态修复：考试先返回、学生后返回时，selectExam 用空学生构建了矩阵，这里补建
    if (currentExam.value && !scoreRows.value.length && allStudents.value.length) {
      rebuildMatrix(currentExam.value);
      await fillScores(currentExam.value);
    }
  } catch (e) {
    ElMessage.error('学生列表加载失败：' + e.message);
  }
}

// 用当前学生列表构建录入矩阵（行=学生，列=科目）
function rebuildMatrix(e) {
  scoreMatrix.value = {};
  scoreRows.value = allStudents.value.map(s => ({ id: s.id, name: s.name }));
  for (const s of allStudents.value) {
    scoreMatrix.value[s.id] = {};
    for (const sub of e.subjects) scoreMatrix.value[s.id][sub] = null;
  }
}

// 拉取已保存成绩并填充矩阵 + 统计
async function fillScores(e) {
  try {
    const rows = await api.scores.list(e.id);
    if (currentExam.value?.id !== e.id) return;
    for (const r of rows) {
      if (scoreMatrix.value[r.student_id]) scoreMatrix.value[r.student_id][r.subject] = r.score;
    }
    const an = await api.scores.analysis(e.id);
    if (currentExam.value?.id !== e.id) return;
    subjectStats.value = an.subjectStats;
    ranking.value = an.ranking;
  } catch (err) {
    ElMessage.error(err.message);
  }
}

async function selectExam(e) {
  // 未保存成绩切换确认（P1-7）
  if (scoreDirty.value) {
    const ok = await ElMessageBox.confirm('当前考试有未保存的成绩，切换将丢失。确定切换吗？', '未保存提示', { type: 'warning' }).catch(() => false);
    if (!ok) return false;
  }
  currentExam.value = e;
  tab.value = 'entry';
  scoreDirty.value = false;
  // 初始化矩阵
  rebuildMatrix(e);
  await fillScores(e);
  return true;
}

async function saveScores() {
  if (!currentExam.value) return;
  const rows = [];
  for (const [sid, subs] of Object.entries(scoreMatrix.value)) {
    for (const [sub, score] of Object.entries(subs)) {
      if (score !== null && score !== '') rows.push({ studentId: Number(sid), subject: sub, score });
    }
  }
  if (!rows.length) return ElMessage.info('还没有录入成绩');
  try {
    const result = await api.scores.save({ examId: currentExam.value.id, rows });
    if (result.skipped?.length) {
      ElMessage.warning(`已保存 ${result.count} 条成绩，跳过 ${result.skipped.length} 条：${result.skipped[0].reason}`);
    } else {
      ElMessage.success(`已保存 ${result.count ?? rows.length} 条成绩`);
    }
    scoreDirty.value = false;
    selectExam(currentExam.value); // 刷新统计
  } catch (e) {
    ElMessage.error(e.message);
  }
}

/* ---------- 考试弹窗 ---------- */
function openExamDialog(e) {
  // B3：支持编辑（原 openExamDialog 不接收参数 → 考试编辑是死代码）
  examForm.value = e
    ? { id: e.id, name: e.name, date: e.date || '', subjects: [...(e.subjects || [])], remark: e.remark || '' }
    : { id: null, name: '', date: '', subjects: [], remark: '' };
  selectedSubjectTemplate.value = '';
  examDialogVisible.value = true;
}
async function saveExam() {
  if (!examForm.value.name.trim()) return ElMessage.warning('请填写考试名称');
  if (!examForm.value.subjects.length) return ElMessage.warning('请添加至少一个科目');
  try {
    if (examForm.value.id) {
      await api.scores.updateExam(examForm.value.id, examForm.value);
    } else {
      const r = await api.scores.createExam({ class_id: store.currentClassId, ...examForm.value });
      examForm.value.id = r.id;
    }
    ElMessage.success('已保存');
    examDialogVisible.value = false;
    await loadExams();
  } catch (e) {
    ElMessage.error(e.message);
  }
}
async function removeExam(e) {
  const ok = await ElMessageBox.confirm(`删除「${e.name}」及其全部成绩？`, '删除考试', { type: 'warning' }).catch(() => false);
  if (!ok) return;
  try {
    await api.scores.removeExam(e.id);
    if (currentExam.value?.id === e.id) currentExam.value = null;
    loadExams();
  } catch (err) {
    ElMessage.error('删除失败：' + err.message);
  }
}

/* ---------- 导出（B2） ---------- */
// 导出当前考试成绩表（行=学生，列=科目，数据来自 scoreMatrix）
async function exportScores() {
  const e = currentExam.value;
  if (!e) return ElMessage.warning('请先选择考试');
  try {
    const result = await exportExcel(
      '成绩表', `成绩表-${e.name}`,
      [
        { title: '姓名', key: 'name', width: 14 },
        { title: '学号', key: 'schoolNo', width: 16 },
        ...e.subjects.map(s => ({ title: s, render: r => r.scores?.[s] ?? '', width: 10 })),
      ],
      scoreRows.value.map(r => ({
        name: r.name,
        schoolNo: r.school_no || r.schoolNo || '',
        scores: scoreMatrix.value[r.id] || {},
      }))
    );
    if (result.saved) ElMessage.success('成绩表已保存');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
// 导出排名统计表
async function exportRanking() {
  const e = currentExam.value;
  if (!e) return ElMessage.warning('请先选择考试');
  if (!ranking.value.length) return ElMessage.info('当前考试还没有可导出的排名数据');
  try {
    const result = await exportExcel(
      '排名统计', `排名统计-${e.name}`,
      [
        { title: '排名', key: 'rank', width: 8 },
        { title: '姓名', key: 'name', width: 14 },
        { title: '学号', key: 'schoolNo', width: 16 },
        ...e.subjects.map(s => ({ title: s, render: r => r.scores?.[s] ?? '', width: 10 })),
        { title: '总分', key: 'total', width: 10 },
      ],
      ranking.value
    );
    if (result.saved) ElMessage.success('排名统计已保存');
  } catch (err) {
    ElMessage.error(err.message);
  }
}

/* ---------- 趋势 ---------- */
const trendSeq = useSeqLoad();async function loadTrend() {
  if (!trendStudentId.value) return;
  const mySeq = trendSeq.seq();
  try {
    const d = await api.scores.trend(store.currentClassId, trendStudentId.value);
    if (trendSeq.isStale(mySeq)) return; // 快速切换学生时丢弃过期响应
    trendPoints.value = d;
  } catch (e) {
    ElMessage.error(e.message);
  }
}
const trendOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 44, right: 20, top: 24, bottom: 30 },
  xAxis: { type: 'category', data: trendPoints.value.map(p => p.name), axisLabel: { interval: 0 } },
  yAxis: { type: 'value', name: '总分' },
  series: [{
    type: 'line', data: trendPoints.value.map(p => p.total), smooth: true,
    lineStyle: { width: 3, color: '#f35b3f' }, itemStyle: { color: '#f35b3f' },
    areaStyle: { color: 'rgba(243,91,63,.15)' },
    markPoint: {
      data: trendPoints.value.length
        ? [{ type: 'max', name: '最高' }, { type: 'min', name: '最低' }]
        : [],
    },
  }],
}));
</script>

<style scoped>
.scores-workspace { display: flex; gap: 14px; align-items: flex-start; }
.exam-list {
  width: 230px; flex-shrink: 0;
  background: var(--paper-soft); border: 3px solid var(--ink); border-radius: 16px; padding: 10px;
  display: flex; flex-direction: column; gap: 8px;
  box-shadow: var(--shadow-sm);
}
.exam-item {
  border: 3px solid transparent; border-radius: 12px; padding: 10px 12px; cursor: pointer;
  transition: all .15s; background: #fff;
}
.exam-item:hover { border-color: var(--tomato); transform: translateX(2px); }
.exam-item.active { border-color: var(--ink); background: var(--mustard); box-shadow: var(--shadow-xs); }
.exam-name { font-weight: 900; font-size: 14px; color: var(--ink); }
.exam-head { display: flex; justify-content: space-between; align-items: center; }
.exam-meta { font-size: 11px; color: var(--muted); margin-top: 3px; }
.exam-content { flex: 1; min-width: 0; }
.stat-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 14px; }
.stat-card {
  background: #fff;
  border: 3px solid var(--ink); border-radius: 14px; padding: 10px 14px;
  box-shadow: var(--shadow-xs);
}
    .sc-subject { font-weight: 900; color: var(--tomato); margin-bottom: 4px; }
    .sc-row { font-size: 12px; color: var(--muted); }
    .subject-template-row { display: flex; gap: 8px; width: 100%; margin-top: 8px; }

/* ---------- 响应式：窄屏考试列表置顶 ---------- */
@media (max-width: 900px) {
  .scores-workspace { flex-direction: column; }
  .exam-list {
    width: 100%; flex-shrink: 1;
    flex-direction: row; flex-wrap: wrap;
    align-items: center;
  }
  .exam-item { flex: 1 1 200px; }
}
</style>
