<template>
  <div class="page-card">
    <div class="page-head">
      <div>
        <h2 class="page-head-title">📝 成绩管理</h2>
        <p class="page-head-desc">创建考试、录入成绩、查看排名统计与学生进步趋势</p>
      </div>
      <div class="page-head-actions">
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
            <el-button link type="danger" size="small" @click.stop="removeExam(e)">删</el-button>
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
                    <el-tag :type="row.rank <= 3 ? 'danger' : 'info'" round>{{ row.rank }}</el-tag>
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
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="examDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveExam">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { api } from '../api.js';
import { store } from '../store.js';
import EChart from '../components/EChart.vue';

const COMMON_SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理'];

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

watch(() => store.currentClassId, () => { loadExams(); allStudents.value = []; trendStudentId.value = null; });
onMounted(() => { loadExams(); loadStudents(); });

async function loadExams() {
  if (!store.currentClassId) { exams.value = []; currentExam.value = null; return; }
  loading.value = true;
  try {
    exams.value = await api.scores.exams(store.currentClassId);
    if (exams.value.length && !currentExam.value) selectExam(exams.value[0]);
  } catch (e) {
    ElMessage.error('考试列表加载失败：' + e.message);
  } finally {
    loading.value = false;
  }
}
async function loadStudents() {
  if (!store.currentClassId) return;
  try {
    allStudents.value = await api.students.list({ class_id: store.currentClassId, status: '在读' });
  } catch { /* 忽略 */ }
}

async function selectExam(e) {
  currentExam.value = e;
  tab.value = 'entry';
  scoreDirty.value = false;
  // 初始化矩阵
  scoreMatrix.value = {};
  scoreRows.value = allStudents.value.map(s => ({ id: s.id, name: s.name }));
  for (const s of allStudents.value) {
    scoreMatrix.value[s.id] = {};
    for (const sub of e.subjects) scoreMatrix.value[s.id][sub] = null;
  }
  try {
    const rows = await api.scores.list(e.id);
    for (const r of rows) {
      if (scoreMatrix.value[r.student_id]) scoreMatrix.value[r.student_id][r.subject] = r.score;
    }
    // 分析数据
    const an = await api.scores.analysis(e.id);
    subjectStats.value = an.subjectStats;
    ranking.value = an.ranking;
  } catch (err) {
    ElMessage.error(err.message);
  }
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
    await api.scores.save({ examId: currentExam.value.id, rows });
    ElMessage.success(`已保存 ${rows.length} 条成绩`);
    scoreDirty.value = false;
    selectExam(currentExam.value); // 刷新统计
  } catch (e) {
    ElMessage.error(e.message);
  }
}

/* ---------- 考试弹窗 ---------- */
function openExamDialog() {
  examForm.value = { id: null, name: '', date: '', subjects: [] };
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
  await api.scores.removeExam(e.id);
  if (currentExam.value?.id === e.id) currentExam.value = null;
  loadExams();
}

/* ---------- 趋势 ---------- */
async function loadTrend() {
  if (!trendStudentId.value) return;
  try {
    const d = await api.scores.trend(store.currentClassId, trendStudentId.value);
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
    lineStyle: { width: 3, color: '#3ec6a8' }, itemStyle: { color: '#3ec6a8' },
    areaStyle: { color: 'rgba(62,198,168,.15)' },
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
  background: #fbfefd; border: 1px solid #e8f5ef; border-radius: 12px; padding: 10px;
  display: flex; flex-direction: column; gap: 8px;
}
.exam-item {
  border: 1px solid #e8f5ef; border-radius: 10px; padding: 10px 12px; cursor: pointer;
  transition: all .15s; background: #fff;
}
.exam-item:hover { border-color: #3ec6a8; }
.exam-item.active { border-color: #3ec6a8; background: #e6f9f5; }
.exam-name { font-weight: 700; font-size: 14px; color: #33403c; }
.exam-head { display: flex; justify-content: space-between; align-items: center; }
.exam-meta { font-size: 11px; color: #98a6a0; margin-top: 3px; }
.exam-content { flex: 1; min-width: 0; }
.stat-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-bottom: 14px; }
.stat-card {
  background: linear-gradient(135deg, #f0faf6, #e6f9f5);
  border: 1px solid #d5f0e6; border-radius: 10px; padding: 10px 14px;
}
.sc-subject { font-weight: 700; color: #2f8f7a; margin-bottom: 4px; }
.sc-row { font-size: 12px; color: #5c6f68; }
</style>
