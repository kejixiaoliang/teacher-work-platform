<template>
  <div>
    <!-- 欢迎横幅 -->
    <div class="hero">
      <div>
        <h2>{{ currentClass?.name || '教师工作台' }}</h2>
        <p v-if="currentClass" class="hero-sub">
          {{ currentClass.academic_year || '—' }} {{ currentClass.term }} 学期
          <template v-if="currentClass.head_teacher"> ｜ 班主任：{{ currentClass.head_teacher }}</template>
        </p>
        <p v-else class="hero-sub">请先到「班级管理」创建班级</p>
      </div>
      <div class="hero-actions">
        <el-button type="primary" size="large" @click="go('/seats')">💺 排座位</el-button>
        <el-button size="large" @click="go('/documents')">📁 上传文档</el-button>
        <el-button size="large" @click="go('/duties')">🧹 值日安排</el-button>
        <el-button size="large" @click="go('/leaders')">🏅 班委学委</el-button>
      </div>
    </div>

    <div class="cards">
      <!-- 今日值日 -->
      <div class="card">
        <div class="card-title">🧹 今日值日</div>
        <template v-if="currentGroup">
          <div class="duty-badge">第 {{ currentGroupNo }} 组 ｜ 开学第 {{ week }} 周</div>
          <div class="chips">
            <el-tag v-for="m in currentGroup.members" :key="m.id" size="large"
                    :type="m.gender === '女' ? 'danger' : 'primary'" effect="plain">
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
        <div class="card-title">💺 当前座位表 <el-button link @click="go('/seats')">管理</el-button></div>
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
        <div class="card-title">📁 最近文档 <el-button link @click="go('/documents')">全部</el-button></div>
        <div v-if="recentDocs.length" class="doc-list">
          <div v-for="d in recentDocs" :key="d.id" class="doc-item" @click="go('/documents')">
            <span class="doc-icon">{{ iconOf(d.category) }}</span>
            <span class="doc-name" :title="d.original_name">{{ d.original_name }}</span>
            <span class="text-muted">{{ (d.uploaded_at || '').slice(5, 10) }}</span>
          </div>
        </div>
        <el-empty v-else description="暂无文档" :image-size="60">
          <el-button type="primary" size="small" @click="go('/documents')">去上传</el-button>
        </el-empty>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api.js';
import { store, currentClass } from '../store.js';

const router = useRouter();
const seats = ref([]);
const recentDocs = ref([]);
const duties = ref([]);
const week = ref(Number(localStorage.getItem('duty-week') || 1));

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
  if (!store.currentClassId) return;
  const [s, d, dy] = await Promise.all([
    api.seats.get(store.currentClassId),
    api.documents.list({ class_id: store.currentClassId }),
    api.duties.list({ class_id: store.currentClassId }),
  ]);
  seats.value = s;
  recentDocs.value = d.slice(0, 6);
  duties.value = dy;
}

function miniName(r, c) { return seatMap.value[`${r - 1},${c - 1}`] || ''; }
function iconOf(c) {
  return { 图片: '🖼', PDF: '📕', 文档: '📄', 表格: '📊', 演示: '📽', 文本: '📝', 其他: '📦' }[c] || '📦';
}
function go(p) { router.push(p); }
</script>

<style scoped>
.hero {
  background: linear-gradient(135deg, #3ec6a8, #2fae90 55%, #57d4bc);
  border-radius: 14px; color: #fff; padding: 22px 26px;
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
  box-shadow: 0 4px 14px rgba(62, 198, 168, .3);
}
.hero h2 { margin: 0 0 6px; font-size: 22px; }
.hero-sub { margin: 0; opacity: .85; font-size: 14px; }
.hero-actions { display: flex; gap: 10px; }
.hero-actions .el-button { background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.3); color: #fff; }
.hero-actions .el-button:hover { background: rgba(255,255,255,.26); }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
.card { background: #fff; border-radius: 10px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.card-title { font-size: 15px; font-weight: 700; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
.duty-badge {
  background: #fdf6ec; color: #b88230; border: 1px solid #f5dab1;
  border-radius: 6px; padding: 6px 10px; font-size: 13px; margin-bottom: 10px; display: inline-block;
}
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.mini-grid { display: flex; flex-direction: column; gap: 3px; }
.mini-row { display: flex; gap: 3px; }
.mini-seat {
  flex: 1; font-size: 11px; text-align: center; padding: 4px 0; border-radius: 5px;
  background: #e6f9f5; color: #2f8f7a; overflow: hidden; white-space: nowrap;
  margin: 0 1px;
}
.mini-seat.mini-empty { background: #f2f7f5; color: #c0d4cc; }
.doc-list { display: flex; flex-direction: column; }
.doc-item {
  display: flex; align-items: center; gap: 8px; padding: 7px 4px; border-radius: 6px; cursor: pointer;
}
.doc-item:hover { background: #f5f7fa; }
.doc-name { flex: 1; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
