<template>
  <div v-loading="loading">
    <!-- 欢迎横幅 -->
    <div class="hero">
      <div>
        <h2>{{ currentClass?.name || '教师工作台' }}</h2>
        <p v-if="currentClass" class="hero-sub">
          {{ currentClass.academic_year || '—' }} {{ currentClass.term }} 学期
          <template v-if="currentClass.head_teacher"> ｜ 班主任：{{ currentClass.head_teacher }}</template>
        </p>
        <p v-else class="hero-sub">请先到「班级设置」创建班级</p>
      </div>
      <div class="hero-actions">
        <el-button type="primary" size="large" :icon="Grid" @click="go('/seats')">排座位</el-button>
        <el-button size="large" :icon="Upload" @click="go('/documents')">上传文档</el-button>
        <el-button size="large" :icon="Calendar" @click="go('/duties')">值日安排</el-button>
        <el-button size="large" :icon="UserFilled" @click="go('/leaders')">班委学委</el-button>
      </div>
    </div>

    <!-- 班级概况：一眼看班 -->
    <div class="stats-bar" v-if="students.length">
      <div class="stat-chip"><b class="stat-num">{{ students.length }}</b><span class="stat-lbl">学生</span></div>
      <div class="stat-chip"><b class="stat-num">{{ boys }}</b><span class="stat-lbl">男生</span></div>
      <div class="stat-chip"><b class="stat-num">{{ girls }}</b><span class="stat-lbl">女生</span></div>
      <div class="stat-chip"><b class="stat-num">{{ myopiaCount }}</b><span class="stat-lbl">近视</span></div>
      <div class="stat-chip"><b class="stat-num">{{ boardingCount }}</b><span class="stat-lbl">住宿</span></div>
      <div class="stat-chip"><b class="stat-num">{{ avgHeight }}</b><span class="stat-lbl">平均身高</span></div>
    </div>

    <!-- 智能预警中心（方向 4） -->
    <div class="alert-panel" v-if="alerts.total" style="margin-bottom:16px">
      <div class="alert-panel-head">
        <span class="alert-panel-title">⚠️ 预警中心</span>
        <span class="text-muted">
          <template v-if="alerts.danger"><el-tag type="danger" size="small" round>{{ alerts.danger }} 高优先</el-tag></template>
          <template v-if="alerts.warning"><el-tag type="warning" size="small" round>{{ alerts.warning }} 提醒</el-tag></template>
          <template v-if="alerts.info"><el-tag type="info" size="small" round>{{ alerts.info }} 生日</el-tag></template>
        </span>
      </div>
      <div class="alert-list">
        <div v-for="(a, i) in alerts.alerts.slice(0, 12)" :key="i" class="alert-item" :class="'alert-' + a.level" @click="goStudentAlert(a)">
          <el-tag :type="a.level === 'danger' ? 'danger' : a.level === 'warning' ? 'warning' : 'info'" size="small" round>
            {{ a.type === 'absent' ? '缺勤' : a.type === 'overdue' ? '逾期假条' : a.type === 'noContact' ? '未沟通' : a.type === 'vision' ? '视力' : a.type === 'myopia' ? '近视' : a.type === 'followUp' ? '跟进' : '生日' }}
          </el-tag>
          <b>{{ a.studentName }}</b>
          <span class="text-muted">{{ a.text }}</span>
        </div>
      </div>
    </div>

    <div class="cards">
      <!-- 今日概览：考勤 + 请假 + 家校沟通 -->
      <div class="card">
        <div class="card-title">今日概览</div>
        <div class="ov-block">
          <div class="ov-head">
            <span class="ov-label">今日考勤</span>
            <el-button link size="small" @click="go('/attendance')">登记</el-button>
          </div>
          <div v-if="todayAttendance" class="ov-chips">
            <el-tag v-if="todayAttendance.出勤 > 0" type="success" round>出勤 {{ todayAttendance.出勤 }}</el-tag>
            <el-tag v-if="todayAttendance.迟到 > 0" type="warning" round>迟到 {{ todayAttendance.迟到 }}</el-tag>
            <el-tag v-if="todayAttendance.请假 > 0" type="danger" round>请假 {{ todayAttendance.请假 }}</el-tag>
            <el-tag v-if="todayAttendance.缺勤 > 0" type="danger" effect="dark" round>缺勤 {{ todayAttendance.缺勤 }}</el-tag>
            <el-tag v-if="!todayAttendance.total" round>尚未登记</el-tag>
          </div>
          <div v-else class="text-muted">加载中…</div>
        </div>
        <div class="ov-block" style="margin-top:12px">
          <div class="ov-head">
            <span class="ov-label">今日请假</span>
            <el-button link size="small" @click="go('/leaves')">管理</el-button>
          </div>
          <div v-if="todayLeaves.length" class="ov-chips">
            <el-tag v-for="l in todayLeaves" :key="l.id" :type="l.type === '病假' ? 'danger' : 'warning'" round>
              {{ l.student_name }}（{{ l.type }}）
            </el-tag>
          </div>
          <div v-else class="text-muted">今日无人请假 🎉</div>
        </div>
        <div class="ov-block" style="margin-top:12px">
          <div class="ov-head">
            <span class="ov-label">最近家校沟通</span>
            <el-button link size="small" @click="go('/contacts')">管理</el-button>
          </div>
          <div v-if="recentContacts.length" class="ov-list">
            <div v-for="c in recentContacts.slice(0, 4)" :key="c.id" class="ov-item">
              <b>{{ c.student_name }}</b>
              <span class="text-muted">{{ c.method }} · {{ (c.date || '').slice(5) }}</span>
            </div>
          </div>
          <div v-else class="text-muted">暂无沟通记录</div>
        </div>
      </div>

      <!-- 最近考试概况 -->
      <div class="card" v-if="latestExam">
        <div class="card-title">最近考试 <el-button link @click="go('/scores')">详情</el-button></div>
        <div class="ov-block">
          <div class="exam-badge">{{ latestExam.name }}</div>
          <div class="chips" style="margin-top:8px">
            <el-tag v-for="s in latestExam.subjectStats" :key="s.subject" size="large" type="warning" effect="light">
              {{ s.subject }} 平均 {{ s.avg }}
            </el-tag>
          </div>
          <div class="text-muted" style="margin-top:8px">
            {{ latestExam.date || '未定日期' }} · {{ latestExam.count }} 人参与
          </div>
        </div>
      </div>

      <!-- 班委一览：只看不编辑 -->
      <div class="card" v-if="leaderList.length">
        <div class="card-title">班委 <el-button link @click="go('/leaders')">管理</el-button></div>
        <div class="leader-grid">
          <div v-for="l in leaderList" :key="l.id" class="leader-item">
            <span class="leader-role">{{ l.role }}</span>
            <b class="leader-name">{{ l.student_name }}</b>
          </div>
        </div>
      </div>

      <!-- 课代表一览：只看不编辑 -->
      <div class="card" v-if="subjectLeaderList.length">
        <div class="card-title">课代表 <el-button link @click="go('/subject-leaders')">管理</el-button></div>
        <div class="leader-grid">
          <div v-for="l in subjectLeaderList" :key="l.id" class="leader-item">
            <span class="leader-role">{{ l.role.replace('课代表', '') }}</span>
            <b class="leader-name">{{ l.student_name }}</b>
          </div>
        </div>
      </div>

      <!-- 今日值日 -->
      <div class="card">
        <div class="card-title">今日值日</div>
        <template v-if="currentGroup">
          <div class="duty-badge">第 {{ currentGroupNo }} 组 ｜ 开学第 {{ week }} 周</div>
          <div class="chips">
            <el-tag v-for="m in currentGroup.members" :key="m.id" size="large"
                    :type="m.gender === '女' ? 'danger' : 'warning'">
              {{ m.student_name }}
            </el-tag>
          </div>
          <div class="text-muted" style="margin-top:10px">
            <el-input-number v-model="week" :min="1" :max="25" size="small" /> 周 <el-button link @click="go('/duties')">调整分组</el-button>
          </div>
        </template>
        <el-empty v-else description="还没设置值日分组" :image-size="60">
          <el-button type="primary" size="small" @click="go('/duties')">去设置</el-button>
        </el-empty>
      </div>

      <!-- 座位缩略图 -->
      <div class="card">
        <div class="card-title">当前座位表 <el-button link @click="go('/seats')">管理</el-button></div>
        <div v-if="unseatedCount > 0" class="unseated-bar">
          <el-tag type="warning" round>还有 {{ unseatedCount }} 人未入座</el-tag>
        </div>
        <div v-if="seatRows" class="mini-grid" :style="{ gridTemplateColumns: `repeat(${seatCols}, 1fr)` }">
          <div v-for="r in seatRows" :key="r" class="mini-row">
            <div v-for="c in seatCols" :key="c" class="mini-seat"
                 :class="{ 'mini-empty': !miniName(r, c) }">{{ miniName(r, c) }}</div>
          </div>
        </div>
        <el-empty v-else description="还没有排座位" :image-size="60">
          <el-button type="primary" size="small" @click="go('/seats')">去排座</el-button>
        </el-empty>
      </div>

      <!-- 最近文档 -->
      <div class="card">
        <div class="card-title">最近文档 <el-button link @click="go('/documents')">全部</el-button></div>
        <div v-if="recentDocs.length" class="doc-list">
          <div v-for="d in recentDocs" :key="d.id" class="doc-item" @click="go('/documents')">
            <el-icon class="doc-icon" :size="16"><component :is="iconOf(d.category)" /></el-icon>
            <span class="doc-name" :title="d.original_name">{{ d.original_name }}</span>
            <span class="text-muted">{{ (d.uploaded_at || '').slice(5, 10) }}</span>
          </div>
        </div>
        <el-empty v-else description="暂无文档" :image-size="60">
          <el-button type="primary" size="small" @click="go('/documents')">去上传</el-button>
        </el-empty>
      </div>
    </div>

    <!-- 数据管理区 -->
    <div class="card" style="margin-top:16px">
      <div class="card-title">数据管理</div>
      <div style="display:flex; gap:10px; flex-wrap:wrap">
        <el-button type="primary" plain :icon="Camera" @click="archiveMetrics">学期存档</el-button>
        <el-button type="primary" :icon="Download" @click="backupAll" :loading="backupLoading">完整备份（下载）</el-button>
        <el-button type="warning" plain :icon="Upload" @click="restoreTrigger" :loading="restoreLoading">从备份恢复</el-button>
        <input ref="restoreInput" type="file" accept=".zip,.json" style="display:none" @change="restorePick" />
      </div>
      <p class="text-muted" style="margin:10px 0 0">
        学期存档：把全班当前身高/视力/成绩快照存入历史，供对比与回填。
        完整备份：下载包含数据库和 data/files 上传文件的 ZIP 文件；
        从备份恢复：支持新版 ZIP 和旧版 JSON，可完整还原数据（恢复前会先自动快照当前库到 data/backups/）。
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Grid, Upload, Calendar, UserFilled, Camera, Download, Picture, Document, DocumentCopy, DataAnalysis, VideoCamera, Memo, Box } from '@element-plus/icons-vue';
import { api } from '../api.js';
import { store, currentClass } from '../store.js';
import { useSeqLoad } from '../composables/useSeqLoad.js';

const { seq, isStale } = useSeqLoad();

const router = useRouter();
const loading = ref(false);
const seats = ref([]);
const recentDocs = ref([]);
const duties = ref([]);
const students = ref([]);
const todayLeaves = ref([]);
const recentContacts = ref([]);
const todayAttendance = ref(null); // 今日考勤简况（B5）
const latestExam = ref(null);     // 最近一次考试概况（B5）
const alerts = ref({ total: 0, danger: 0, warning: 0, info: 0, alerts: [] }); // 预警中心（方向 4）
const week = ref(Number(localStorage.getItem('duty-week') || 1));

/* 班级概况统计 */
const boys = computed(() => students.value.filter(s => s.gender === '男').length);
const girls = computed(() => students.value.filter(s => s.gender === '女').length);
const myopiaCount = computed(() => students.value.filter(s => s.is_myopia).length);
const boardingCount = computed(() => students.value.filter(s => s.is_boarding).length);
const avgHeight = computed(() => {
  const hs = students.value.map(s => Number(s.height_cm)).filter(Boolean);
  return hs.length ? Math.round(hs.reduce((a, b) => a + b, 0) / hs.length) : '—';
});
/* 班委一览（role != 值日生 且 非课代表） */
const leaderList = computed(() => duties.value.filter(d => d.role !== '值日生' && !d.role.endsWith('课代表')));
const subjectLeaderList = computed(() => duties.value.filter(d => d.role.endsWith('课代表')));

const seatRows = computed(() => currentClass.value?.seat_rows || 0);
const seatCols = computed(() => currentClass.value?.seat_cols || 0);
// 未入座提醒：在读学生数 - 已占座数（B5）
const unseatedCount = computed(() => {
  if (!students.value.length) return 0;
  const seated = new Set(seats.value.filter(s => s.studentId != null).map(s => s.studentId));
  return students.value.filter(s => !seated.has(s.id)).length;
});

const seatMap = computed(() => {
  const m = {};
  for (const s of seats.value) m[`${s.row},${s.col}`] = s.name || '';
  return m;
});
const dutyGroups = computed(() => {
  const map = new Map();
  for (const d of duties.value.filter(d => d.role === '值日生')) {
    const no = d.group_no ?? 1;
    if (!map.has(no)) map.set(no, []);
    map.get(no).push(d);
  }
  return [...map.values()].sort((a, b) => (a[0]?.group_no ?? 0) - (b[0]?.group_no ?? 0));
});
const groupCount = computed(() => dutyGroups.value.length);
const currentGroupNo = computed(() => groupCount.value ? ((week.value - 1) % groupCount.value) + 1 : null);
// 组号删除后可能不连续，按排序索引取组（P1）
const currentGroup = computed(() => {
  const idx = currentGroupNo.value;
  return idx != null ? dutyGroups.value[idx - 1] : null;
});

watch(() => store.currentClassId, load);
watch(week, v => localStorage.setItem('duty-week', String(v)));
onMounted(load);

async function load() {
  if (!store.currentClassId) {
    seats.value = []; recentDocs.value = []; duties.value = []; students.value = [];
    todayLeaves.value = []; recentContacts.value = []; todayAttendance.value = null; latestExam.value = null;
    return;
  }
  const mySeq = seq();
  loading.value = true;
  try {
    // 今日本地日期（与考勤页一致，避免 UTC 差一天）
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    // 竞态防护：多请求任一失败不整体丢弃（allSettled 逐项落值）
    const [s, d2, dy, st, lv, ct, at, ex, al] = await Promise.allSettled([
      api.seats.get(store.currentClassId),
      api.documents.list({ class_id: store.currentClassId }),
      api.duties.list({ class_id: store.currentClassId }),
      api.students.list({ class_id: store.currentClassId, status: '在读' }),
      api.leaves.today(store.currentClassId),
      api.contacts.list({ class_id: store.currentClassId }),
      api.attendance.get(store.currentClassId, today),
      api.scores.exams(store.currentClassId),
      api.overview.alerts(store.currentClassId),
    ]);
    if (isStale(mySeq)) return;
    if (s.status === 'fulfilled') seats.value = s.value;
    if (d2.status === 'fulfilled') recentDocs.value = d2.value.slice(0, 6);
    if (dy.status === 'fulfilled') duties.value = dy.value;
    if (st.status === 'fulfilled') students.value = st.value;
    if (lv.status === 'fulfilled') todayLeaves.value = lv.value;
    if (ct.status === 'fulfilled') recentContacts.value = ct.value;
    // 预警中心
    if (al.status === 'fulfilled') alerts.value = al.value;
    // 今日考勤简况
    if (at.status === 'fulfilled') {
      const rows = at.value.rows || [];
      todayAttendance.value = {
        total: rows.length,
        出勤: rows.filter(r => r.status === '出勤').length,
        迟到: rows.filter(r => r.status === '迟到').length,
        请假: rows.filter(r => r.status === '请假').length,
        缺勤: rows.filter(r => r.status === '缺勤').length,
      };
    }
    // 最近一次考试概况
    if (ex.status === 'fulfilled' && ex.value.length) {
      const first = ex.value[0];
      const an = await api.scores.analysis(first.id).catch(() => null);
      if (isStale(mySeq)) return;
      latestExam.value = {
        name: first.name, date: first.date,
        count: an?.ranking?.length ?? 0,
        subjectStats: an?.subjectStats ?? [],
      };
    } else {
      latestExam.value = null;
    }
  } catch (e) {
    ElMessage.error('首页数据加载失败：' + e.message);
  } finally {
    if (!isStale(mySeq)) loading.value = false;
  }
}

function miniName(r, c) { return seatMap.value[`${r - 1},${c - 1}`] || ''; }
function iconOf(c) {
  return {
    图片: Picture, PDF: Document, 文档: DocumentCopy,
    表格: DataAnalysis, 演示: VideoCamera, 文本: Memo, 其他: Box,
  }[c] || Box;
}
function go(p) { router.push(p); }
function goStudentAlert(alert) {
  if (alert?.studentName) router.push({ path: '/students', query: { kw: alert.studentName } });
}

/* ---------- 数据管理 ---------- */
async function archiveMetrics() {
  if (!store.currentClassId) return ElMessage.warning('请先创建班级');
  const { value } = await ElMessageBox.prompt('输入存档学期（如 2025-2026 上）：', '学期存档', {
    inputValue: '2025-2026 上',
  }).catch(() => ({ value: null }));
  if (!value) return;
  try {
    const r = await api.students.archive({ class_id: store.currentClassId, term: value });
    ElMessage.success(`已存档 ${r.count} 名学生的身高/视力/成绩`);
  } catch (e) {
    ElMessage.error(e.message);
  }
}

/* ---------- 完整备份 / 恢复（阶段一） ---------- */
const backupLoading = ref(false);
const restoreLoading = ref(false);
const restoreInput = ref(null);

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// 完整备份：走服务端统一导出（含全部 13 张业务表）
async function backupAll() {
  if (!store.classes.length) return ElMessage.warning('还没有班级数据');
  backupLoading.value = true;
  try {
    const blob = await api.backup.export();
    downloadBlob(blob, `教师工作台完整备份-${new Date().toISOString().slice(0, 10)}.zip`);
    ElMessage.success('完整备份已下载（含数据库和上传文件）');
  } catch (e) {
    ElMessage.error('备份失败：' + e.message);
  } finally {
    backupLoading.value = false;
  }
}

function restoreTrigger() { restoreInput.value?.click(); }

async function restorePick(e) {
  const file = e.target.files?.[0];
  e.target.value = ''; // 允许再次选择同一文件
  if (!file) return;
  // 先校验文件基本格式，再提示确认
  let payload = null;
  const isZip = file.name.toLowerCase().endsWith('.zip');
  if (!isZip) {
    try { payload = JSON.parse(await file.text()); } catch { return ElMessage.error('备份文件不是有效的 JSON 或 ZIP'); }
    if (!payload || payload.app !== 'teacher-work' || !Array.isArray(payload.tables)) {
      return ElMessage.error('不是本应用的备份文件（缺少 tables 字段）');
    }
  }
  const clsCount = isZip ? 'ZIP' : (payload.tables.find(t => t.table === 'classes')?.rows?.length ?? 0);
  const ok = await ElMessageBox.confirm(
    `将用该备份覆盖当前全部数据（${clsCount} 个班级/归档）。恢复前会先自动快照当前库到 data/backups/，确定继续吗？`,
    '从备份恢复', { type: 'warning', confirmButtonText: '恢复', cancelButtonText: '取消' }
  ).catch(() => false);
  if (!ok) return;
  restoreLoading.value = true;
  try {
    const r = isZip ? await api.backup.importFile(file) : await api.backup.import(payload);
    ElMessage.success(`恢复成功：${r.classes} 个班级`);
    await store.loadClasses();
    load(); // 恢复后强制刷新首页（classId 可能未变，watch 不会触发）
  } catch (err) {
    ElMessage.error('恢复失败：' + err.message);
  } finally {
    restoreLoading.value = false;
  }
}
</script>

<style scoped>
.hero {
  background: var(--paper-soft);
  border: 4px solid var(--ink);
  border-radius: var(--radius-lg);
  color: var(--ink);
  padding: 24px 28px;
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px;
  box-shadow: var(--shadow);
  position: relative;
}
.hero::after {
  content: "班级实验本";
  position: absolute; top: -18px; right: 22px;
  background: var(--tomato-deep);
  color: #fff;
  border: 3px solid var(--ink);
  border-radius: 999px;
  padding: 3px 14px;
  font-size: 12px; font-weight: 900;
  box-shadow: var(--shadow-xs);
  letter-spacing: .5px;
}
.hero h2 { margin: 0 0 8px; font-size: 24px; font-weight: 900; }
.hero-sub {
  margin: 0; color: var(--muted); font-size: 14px; font-weight: 700;
  display: inline-block;
  background: var(--mint);
  border: 3px solid var(--ink);
  border-radius: 999px;
  padding: 4px 14px;
  box-shadow: var(--shadow-xs);
}
.hero-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.hero-actions .el-button--primary {
  background: var(--tomato-deep); border-color: var(--ink); color: #fff; font-weight: 900;
  box-shadow: var(--shadow-xs);
}
.hero-actions .el-button--primary:hover { background: #b53a36; color: #fff; }
.hero-actions .el-button {
  background: #fff; border: 2px solid var(--ink); color: var(--ink); font-weight: 800;
  box-shadow: var(--shadow-xs);
}
.hero-actions .el-button:hover { background: var(--mustard); transform: translateY(-2px); color: var(--ink); }

/* ---------- 班级概况条 ---------- */
.stats-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 18px;
}
.stat-chip {
  background: #fff;
  border: 3px solid var(--ink);
  border-radius: 14px;
  box-shadow: var(--shadow-xs);
  padding: 8px 18px;
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  min-width: 96px;
  justify-content: center;
}
.stat-num { font-size: 20px; font-weight: 900; color: var(--tomato-deep); }
.stat-lbl { font-size: 12px; color: var(--muted); font-weight: 800; }

/* ---------- 班委/课代表一览 ---------- */
.leader-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }

/* ---------- 今日概览 ---------- */
.ov-block { padding: 8px; background: var(--paper); border: 2px solid var(--ink); border-radius: 10px; }
.ov-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.ov-label { font-size: 12px; color: var(--muted); font-weight: 800; letter-spacing: .5px; }
.ov-chips { display: flex; flex-wrap: wrap; gap: 6px; }
/* 最近考试概况（B5） */
.exam-badge {
  display: inline-block; background: var(--mustard); border: 2px solid var(--ink);
  border-radius: 8px; padding: 3px 10px; font-weight: 900; font-size: 13px;
  box-shadow: 2px 2px 0 rgba(32, 27, 23, .35); transform: rotate(-1deg);
}
/* 未入座提醒（B5） */
.unseated-bar { margin-bottom: 8px; }
/* 预警中心（方向 4） */
.alert-panel {
  background: var(--paper-soft); border: 3px solid var(--ink); border-radius: 16px;
  padding: 12px 16px; box-shadow: var(--shadow-sm);
}
.alert-panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 10px; flex-wrap: wrap; }
.alert-panel-title { font-size: 15px; font-weight: 900; color: var(--ink); }
.alert-list { display: flex; flex-direction: column; gap: 5px; max-height: 220px; overflow-y: auto; }
.alert-item { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 4px 8px; border-radius: 8px; cursor: pointer; }
.alert-danger { background: var(--el-color-danger-light-9); }
.alert-warning { background: var(--el-color-warning-light-9); }
.alert-info { background: var(--el-color-info-light-9); }
.ov-list { display: flex; flex-direction: column; gap: 4px; }
.ov-item {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; padding: 2px 0;
}
.leader-item {
  display: flex; flex-direction: column; gap: 2px;
  background: var(--paper);
  border: 2px solid var(--ink);
  border-radius: 10px;
  padding: 6px 10px;
  box-shadow: 2px 2px 0 rgba(32, 27, 23, .3);
}
.leader-role { font-size: 11px; color: var(--muted); font-weight: 800; }
.leader-name { font-size: 13px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
.card {
  background: #fff;
  border: 4px solid var(--ink);
  border-radius: 20px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
}
.card:hover { transform: translateY(-3px); transition: transform .15s; }
.card-title { font-size: 15px; font-weight: 900; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
.duty-badge {
  background: var(--mustard); color: var(--ink); border: 3px solid var(--ink);
  border-radius: 10px; padding: 5px 10px; font-size: 13px; margin-bottom: 10px; display: inline-block;
  box-shadow: var(--shadow-xs);
  font-weight: 800;
}
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.mini-grid { display: flex; flex-direction: column; gap: 3px; }
.mini-row { display: flex; gap: 3px; }
.mini-seat {
  flex: 1; font-size: 11px; text-align: center; padding: 4px 0; border-radius: 6px;
  background: var(--mint); color: var(--ink); overflow: hidden; white-space: nowrap;
  margin: 0 1px;
  border: 2px solid var(--ink);
}
.mini-seat.mini-empty { background: #f3ead6; color: #b0a48d; border-style: dashed; }
.doc-list { display: flex; flex-direction: column; }
.doc-icon { color: var(--tomato); }
.doc-item {
  display: flex; align-items: center; gap: 8px; padding: 7px 4px; border-radius: 8px; cursor: pointer;
}
.doc-item:hover { background: var(--mustard); }
.doc-name { flex: 1; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
