<template>
  <div class="page-card" v-loading="loading">
    <div class="page-head">
      <div>
        <h2 class="page-head-title">📈 数据分析</h2>
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
      <div class="chart-card">
        <div class="chart-title">📏 身高分布</div>
        <EChart :option="heightOption" height="280px" />
      </div>
      <div class="chart-card">
        <div class="chart-title">👁 视力健康</div>
        <EChart :option="visionOption" height="280px" />
      </div>
      <div class="chart-card">
        <div class="chart-title">📚 成绩等级分布</div>
        <EChart :option="gradeOption" height="280px" />
      </div>
      <div class="chart-card">
        <div class="chart-title">👥 性别构成</div>
        <EChart :option="genderOption" height="280px" />
      </div>
      <div class="chart-card">
        <div class="chart-title">🏠 住宿情况</div>
        <EChart :option="boardingOption" height="280px" />
      </div>
    </div>

    <el-empty v-if="!students.length" description="当前班级还没有在读学生，先去「学生管理」添加或导入" :image-size="90" style="margin-top:20px" />

    <p class="text-muted" style="margin-top:12px">数据来源：学生档案当前值。身高/视力可随「学期存档」对比历史。</p>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api.js';
import { store, currentClass } from '../store.js';
import EChart from '../components/EChart.vue';

const students = ref([]);
const loading = ref(false);

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
    series: [{ type: 'bar', data, barWidth: '55%', itemStyle: { color: '#3ec6a8', borderRadius: [6, 6, 0, 0] } }],
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
        { name: '近视', value: myopia, itemStyle: { color: '#f5a623' } },
        { name: '未近视', value: normal, itemStyle: { color: '#3ec6a8' } },
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
  const colors = { 优: '#3ec6a8', 良: '#67c23a', 中: '#f5a623', 待提高: '#f56c6c', 未录入: '#c0c4cc' };
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
        { name: '男生', value: male, itemStyle: { color: '#55b3f0' } },
        { name: '女生', value: female, itemStyle: { color: '#f58b9f' } },
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
        { name: '住宿', value: boarding, itemStyle: { color: '#9b8cf5' } },
        { name: '走读', value: students.value.length - boarding, itemStyle: { color: '#f0c46c' } },
      ],
    }],
  };
});

const myopiaRate = computed(() => students.value.length ? Math.round(students.value.filter(s => s.is_myopia).length / students.value.length * 100) : 0);
const avgHeight = computed(() => {
  const hs = students.value.map(s => Number(s.height_cm)).filter(Boolean);
  return hs.length ? Math.round(hs.reduce((a, b) => a + b, 0) / hs.length) : 0;
});
const avgVision = computed(() => {
  const vs = students.value.map(s => Math.min(Number(s.vision_left) || 5, Number(s.vision_right) || 5)).filter(v => v < 5.2);
  return vs.length ? (vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(1) : '—';
});
const boardingCount = computed(() => students.value.filter(s => s.is_boarding).length);

watch(() => store.currentClassId, load);
onMounted(load);

async function load() {
  if (!store.currentClassId) { students.value = []; return; }
  loading.value = true;
  try {
    students.value = await api.students.list({ class_id: store.currentClassId, status: '在读' });
  } catch (e) {
    ElMessage.error('数据加载失败：' + e.message);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.stat-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 16px; }
.stat-card {
  background: linear-gradient(135deg, #f0faf6, #e6f9f5);
  border: 1px solid #d5f0e6; border-radius: 12px; padding: 14px; text-align: center;
}
.stat-num { font-size: 26px; font-weight: 800; color: #2f8f7a; }
.stat-label { font-size: 12px; color: #6b8a7e; margin-top: 4px; }
.chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 14px; }
.chart-card {
  background: #fff; border: 1px solid #eef7f3; border-radius: 12px; padding: 14px;
}
.chart-title { font-size: 14px; font-weight: 700; color: #33403c; margin-bottom: 8px; }
</style>
