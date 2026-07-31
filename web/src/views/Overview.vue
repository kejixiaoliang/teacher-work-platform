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

    <div class="cards">
      <!-- 今日概览：请假 + 家校沟通 -->
      <div class="card">
        <div class="card-title">今日概览</div>
        <div class="ov-block">
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
        <el-button plain :icon="Download" @click="exportAll">导出全部数据</el-button>
      </div>
      <p class="text-muted" style="margin:10px 0 0">
        学期存档：把全班当前身高/视力/成绩快照存入历史，供对比与回填。
        导出数据：班级/学生/座位/文档记录/值日（上传的文件本体在 data/files，完整备份请连同 data 目录复制）。
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
const currentGroup = computed(() => dutyGroups.value.find(g => (g[0]?.group_no ?? 1) === currentGroupNo.value));

watch(() => store.currentClassId, load);
watch(week, v => localStorage.setItem('duty-week', String(v)));
onMounted(load);

async function load() {
  if (!store.currentClassId) {
    seats.value = []; recentDocs.value = []; duties.value = []; students.value = [];
    todayLeaves.value = []; recentContacts.value = [];
    return;
  }
  const mySeq = seq();
  loading.value = true;
  try {
    // 竞态防护：6 请求任一失败不整体丢弃（allSettled 逐项落值）
    const [s, d, dy, st, lv, ct] = await Promise.allSettled([
      api.seats.get(store.currentClassId),
      api.documents.list({ class_id: store.currentClassId }),
      api.duties.list({ class_id: store.currentClassId }),
      api.students.list({ class_id: store.currentClassId, status: '在读' }),
      api.leaves.today(store.currentClassId),
      api.contacts.list({ class_id: store.currentClassId }),
    ]);
    if (isStale(mySeq)) return;
    if (s.status === 'fulfilled') seats.value = s.value;
    if (d.status === 'fulfilled') recentDocs.value = d.value.slice(0, 6);
    if (dy.status === 'fulfilled') duties.value = dy.value;
    if (st.status === 'fulfilled') students.value = st.value;
    if (lv.status === 'fulfilled') todayLeaves.value = lv.value;
    if (ct.status === 'fulfilled') recentContacts.value = ct.value;
  } catch (e) {
    ElMessage.error('首页数据加载失败：' + e.message);
  } finally {
    loading.value = false;
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

async function exportAll() {
  if (!store.classes.length) return ElMessage.warning('还没有班级数据');
  try {
    ElMessage.info('正在导出全部数据…');
    const [students, documents, duties] = await Promise.all([
      api.students.list({}),
      api.documents.list({}),
      api.duties.list({}),
    ]);
    const payload = {
      exportedAt: new Date().toISOString(),
      classes: store.classes, students, documents, duties,
      seats: {}, seatLayouts: {},
    };
    for (const c of store.classes) {
      payload.seats[c.id] = await api.seats.get(c.id);
      payload.seatLayouts[c.id] = await api.seats.layouts(c.id);
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `教师工作台数据-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    ElMessage.success('已导出全部数据');
    ElMessage.info('上传的文件本体在 data/files 文件夹，完整备份请连同 data 目录一起复制', 6000);
  } catch (e) {
    ElMessage.error('导出失败：' + e.message);
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
