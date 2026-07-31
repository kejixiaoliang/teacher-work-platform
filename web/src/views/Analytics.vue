<template>
  <div class="page-card" v-loading="loading">
    <div class="page-head">
      <div>
        <h2 class="page-head-title">数据分析</h2>
        <p class="page-head-desc">{{ currentClass?.name }} 班级数据统计与健康分析</p>
      </div>
    </div>

    <!-- 概览卡片 -->
    <div class="stat-cards">
      <div class="stat-card"><div class="stat-num">{{ students.length }}</div><div class="stat-label">在读人数</div></div>
      <div class="stat-card"><div class="stat-num">{{ myopiaRate }}%</div><div class="stat-label">近视率</div></div>
      <div class="stat-card"><div class="stat-num">{{ avgHeight }}cm</div><div class="stat-label">平均身高</div></div>
      <div class="stat-card"><div class="stat-num">{{ avgVision }}</div><div class="stat-label">平均视力(较差眼)</div></div>
      <div class="stat-card"><div class="stat-num">{{ boardingCount }}</div><div class="stat-label">住宿人数</div></div>
    </div>

    <!-- 图表区 -->
    <div class="chart-grid">
      <div class="chart-card chart-wide">
        <div class="chart-title">学期历史对比（来自「学期存档」快照）</div>
        <EChart v-if="historyRows.length" :option="historyOption" height="300px" />
        <el-empty v-else description="还没有学期存档数据，到首页「数据管理 → 学期存档」录入" :image-size="60" />
      </div>
      <div class="chart-card">
        <div class="chart-title">身高分布</div>
        <EChart :option="heightOption" height="280px" />
      </div>
      <div class="chart-card">
        <div class="chart-title">视力健康</div>
        <EChart :option="visionOption" height="280px" />
      </div>
      <div class="chart-card">
        <div class="chart-title">成绩等级分布</div>
        <EChart :option="gradeOption" height="280px" />
      </div>
      <div class="chart-card">
        <div class="chart-title">性别构成</div>
        <EChart :option="genderOption" height="280px" />
      </div>
      <div class="chart-card">
        <div class="chart-title">住宿情况</div>
        <EChart :option="boardingOption" height="280px" />
      </div>
    </div>

    <el-empty v-if="!students.length" description="当前班级还没有在读学生，先去「学生管理」添加或导入" :image-size="90" style="margin-top:20px" />

    <p class="text-muted" style="margin-top:12px">数据来源：学生档案当前值；身高/视力/近视率跨学期对比来自「学期存档」历史快照。</p>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api.js';
import { store, currentClass } from '../store.js';
import EChart from '../components/EChart.vue';
import { useSeqLoad } from '../composables/useSeqLoad.js';

const { seq, isStale } = useSeqLoad();

const students = ref([]);
const loading = ref(false);
const historyRows = ref([]); // 学期历史对比数据（B4）

const MINT_HEIGHT = 120, MAX_HEIGHT = 200, STEP = 10;

const heightOption = computed(() => {
  const buckets = {};
  for (let h = MINT_HEIGHT; h < MAX_HEIGHT; h += STEP) buckets[`${h}-${h + STEP - 1}`] = 0;
  let other = 0;
  for (const s of students.value) {
    const h = Number(s.height_cm);
    if (!h) continue;
    const idx = Math.floor((h - MINT_HEIGHT) / STEP);
    if (idx >= 0 && idx < (MAX_HEIGHT - MINT_HEIGHT) / STEP) buckets[`${MINT_HEIGHT + idx * STEP}-${MINT_HEIGHT + idx * STEP + STEP - 1}`]++;
    else other++;
  }
  const labels = Object.keys(buckets);
  const data = labels.map(k => buckets[k]);
  if (other) { labels.push('其他'); data.push(other); }
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 16, top: 20, bottom: 28 },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 12 } },
    yAxis: { type: 'value', minInterval: 1 },
    series: [{ type: 'bar', data, barWidth: '55%', itemStyle: { color: '#f35b3f', borderRadius: [6, 6, 0, 0] } }],
  };
});

const visionOption = computed(() => {
  const myopia = students.value.filter(s => s.is_myopia).length;
  const normal = students.value.length - myopia;
  const avg = students.value.length
    ? students.value.reduce((a, s) => a + Math.min(Number(s.vision_left) || 5, Number(s.vision_right) || 5), 0) / students.value.length
    : 0;
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 人 ({d}%)' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie', radius: ['45%', '68%'], center: ['50%', '45%'],
      label: { show: false },
      data: [
        { name: '近视', value: myopia, itemStyle: { color: '#f2c84b' } },
        { name: '未近视', value: normal, itemStyle: { color: '#8bd6af' } },
      ],
    }],
    graphic: [{ type: 'text', left: 'center', top: '38%', style: { text: `平均视力 ${avg.toFixed(1)}`, fontSize: 14, fontWeight: 700, fill: '#33403c' } }],
  };
});

const gradeOption = computed(() => {
  const map = { 优: 0, 良: 0, 中: 0, 待提高: 0, 未录入: 0 };
  for (const s of students.value) {
    const g = s.grade_level;
    if (g && g in map) map[g]++;
    else map['未录入']++;
  }
  const colors = { 优: '#8bd6af', 良: '#a9d66f', 中: '#f2c84b', 待提高: '#d64541', 未录入: '#d9cbb0' };
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 人 ({d}%)' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie', radius: '60%', center: ['50%', '45%'],
      label: { formatter: '{b}\n{d}%' },
      data: Object.entries(map).map(([name, value]) => ({ name, value, itemStyle: { color: colors[name] } })),
    }],
  };
});

const genderOption = computed(() => {
  const male = students.value.filter(s => s.gender === '男').length;
  const female = students.value.length - male;
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 人 ({d}%)' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie', radius: '60%', center: ['50%', '45%'],
      label: { formatter: '{b}\n{d}%' },
      data: [
        { name: '男生', value: male, itemStyle: { color: '#f35b3f' } },
        { name: '女生', value: female, itemStyle: { color: '#f2c84b' } },
      ],
    }],
  };
});

const boardingOption = computed(() => {
  const boarding = students.value.filter(s => s.is_boarding).length;
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 人 ({d}%)' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie', radius: '60%', center: ['50%', '45%'],
      label: { formatter: '{b}\n{d}%' },
      data: [
        { name: '住宿', value: boarding, itemStyle: { color: '#8bd6af' } },
        { name: '走读', value: students.value.length - boarding, itemStyle: { color: '#f2c84b' } },
      ],
    }],
  };
});

const myopiaRate = computed(() => students.value.length ? Math.round(students.value.filter(s => s.is_myopia).length / students.value.length * 100) : 0);

// 学期历史对比（B4）：平均身高/平均视力/近视率三条折线
const historyOption = computed(() => {
  const terms = historyRows.value.map(r => r.term);
  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    grid: { left: 44, right: 44, top: 24, bottom: 36 },
    xAxis: { type: 'category', data: terms, axisLabel: { fontSize: 12 } },
    yAxis: [
      { type: 'value', name: '身高(cm)', min: 0, splitLine: { show: true } },
      { type: 'value', name: '视力/近视率', min: 0, max: 100, splitLine: { show: false } },
    ],
    series: [
      { name: '平均身高', type: 'line', data: historyRows.value.map(r => r.avg_height ?? null), smooth: true,
        lineStyle: { width: 3, color: '#f35b3f' }, itemStyle: { color: '#f35b3f' } },
      { name: '平均视力', type: 'line', data: historyRows.value.map(r => r.avg_vision ?? null), smooth: true, yAxisIndex: 1,
        lineStyle: { width: 3, color: '#8bd6af' }, itemStyle: { color: '#8bd6af' } },
      { name: '近视率(%)', type: 'line', data: historyRows.value.map(r => r.myopia_rate ?? null), smooth: true, yAxisIndex: 1,
        lineStyle: { width: 3, type: 'dashed', color: '#f2c84b' }, itemStyle: { color: '#f2c84b' } },
    ],
  };
});const avgHeight = computed(() => {
  const hs = students.value.map(s => Number(s.height_cm)).filter(Boolean);
  return hs.length ? Math.round(hs.reduce((a, b) => a + b, 0) / hs.length) : '—';
});
// 平均视力（较差眼）：全部学生参与，不再剔除 ≥5.2 的学生（口径与卡片标题一致）
const avgVision = computed(() => {
  const vs = students.value
    .map(s => Math.min(Number(s.vision_left) || 5, Number(s.vision_right) || 5))
    .filter(v => Number.isFinite(v));
  return vs.length ? (vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(1) : '—';
});
const boardingCount = computed(() => students.value.filter(s => s.is_boarding).length);

watch(() => store.currentClassId, load);
onMounted(load);

async function load() {
  if (!store.currentClassId) { students.value = []; historyRows.value = []; return; }
  const mySeq = seq();
  loading.value = true;
  try {
    // 双请求并行：学生档案 + 学期历史对比（B4）
    const [stRes, hisRes] = await Promise.allSettled([
      api.students.list({ class_id: store.currentClassId, status: '在读' }),
      api.students.classMetrics(store.currentClassId),
    ]);
    if (isStale(mySeq)) return;
    if (stRes.status === 'fulfilled') students.value = stRes.value;
    else ElMessage.error('数据加载失败：' + stRes.reason?.message);
    if (hisRes.status === 'fulfilled') historyRows.value = hisRes.value;
  } catch (e) {
    ElMessage.error('数据加载失败：' + e.message);
  } finally {
    if (!isStale(mySeq)) loading.value = false;
  }
}
</script>

<style scoped>
.stat-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 16px; }
.stat-card {
  background: #fff;
  border: 3px solid var(--ink); border-radius: 14px; padding: 14px; text-align: center;
  box-shadow: var(--shadow-xs);
}
.stat-num { font-size: 26px; font-weight: 900; color: var(--tomato); }
.stat-label { font-size: 12px; color: var(--muted); margin-top: 4px; font-weight: 700; }
.chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 18px; }
.chart-wide { grid-column: 1 / -1; }
.chart-card {
  background: var(--paper-soft); border: 3px solid var(--ink); border-radius: 18px; padding: 14px;
  box-shadow: var(--shadow-sm);
}
.chart-title { font-size: 14px; font-weight: 900; color: var(--ink); margin-bottom: 8px; }
</style>
