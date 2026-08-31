<template>
  <div class="page-card">
    <div class="page-head">
      <div>
        <h2 class="page-head-title">考勤管理</h2>
        <p class="page-head-desc">每日出勤登记与月度统计</p>
      </div>
    </div>

    <el-tabs v-model="tab">
      <!-- 按日登记 -->
      <el-tab-pane label="每日登记" name="daily">
        <div class="toolbar">
          <el-date-picker v-model="date" type="date" value-format="YYYY-MM-DD" :clearable="false"
                          style="width:160px" @change="onDateChange" />
          <span class="text-muted">共 {{ rows.length }} 人 · 已登记 {{ savedCount }} 人</span>
          <el-alert v-if="leaveRows.length" type="warning" :closable="false" class="attendance-leave-alert"
                    :title="`今日有 ${leaveRows.length} 名学生请假，已自动标记为请假，请确认后保存`" />
          <div class="spacer"></div>
          <el-button plain :disabled="!rows.length" @click="markAllPresent">一键全部出勤</el-button>
          <el-button type="success" :disabled="!dirty" @click="saveDaily">保存今日考勤</el-button>
        </div>
        <el-table :data="rows" size="small" border max-height="560" v-loading="loading">
          <el-table-column prop="schoolNo" label="学号" width="90" />
          <el-table-column prop="name" label="姓名" width="110">
            <template #default="{ row }"><b>{{ row.name }}</b></template>
          </el-table-column>
          <el-table-column label="状态" width="320">
            <template #default="{ row }">
              <el-tag v-if="row.leaveInfo" type="warning" size="small" round class="leave-tag">
                {{ row.leaveInfo.type }}
              </el-tag>
              <el-radio-group v-model="row.status" size="small" @change="dirty = true">
                <el-radio-button value="出勤">出勤</el-radio-button>
                <el-radio-button value="迟到">迟到</el-radio-button>
                <el-radio-button value="请假">请假</el-radio-button>
                <el-radio-button value="缺勤">缺勤</el-radio-button>
              </el-radio-group>
            </template>
          </el-table-column>
          <el-table-column label="备注">
            <template #default="{ row }">
              <el-input v-model="row.remark" size="small" placeholder="选填" @input="dirty = true" />
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 月度统计 -->
      <el-tab-pane label="月度统计" name="stats">
        <div class="toolbar">
          <el-date-picker v-model="month" type="month" value-format="YYYY-MM" :clearable="false"
                          style="width:150px" @change="loadStats" />
          <span class="text-muted">按登记日期统计各状态天数</span>
          <div class="spacer"></div>
          <el-button plain :disabled="!stats.length" @click="exportStats">导出月度统计</el-button>
        </div>
        <el-table :data="stats" size="small" border stripe v-loading="statsLoading">
          <el-table-column prop="school_no" label="学号" min-width="90" />
          <el-table-column prop="name" label="姓名" min-width="110" />
          <el-table-column prop="出勤" label="出勤" min-width="90" align="center" />
          <el-table-column prop="迟到" label="迟到" min-width="90" align="center">
            <template #default="{ row }"><span :class="{ 'bad': row.迟到 > 0 }">{{ row.迟到 }}</span></template>
          </el-table-column>
          <el-table-column prop="请假" label="请假" min-width="90" align="center" />
          <el-table-column prop="缺勤" label="缺勤" min-width="90" align="center">
            <template #default="{ row }"><span :class="{ 'bad': row.缺勤 > 0 }">{{ row.缺勤 }}</span></template>
          </el-table-column>
          <el-table-column prop="days" label="登记天数" min-width="90" align="center" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api.js';
import { store } from '../store.js';
import { desktopApi } from '../platform/desktopApi.js';
import { useSeqLoad } from '../composables/useSeqLoad.js';
import { exportExcel } from '../utils/exportExcel.js';

// 每个数据域独立计数器，避免并发 load 相互作废
const dailySeq = useSeqLoad();
const statsSeq = useSeqLoad();

const tab = ref('daily');
// 本地时区日期（UTC toISOString 在东八区每天 0-8 点会显示成昨天，P1）
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function localMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const date = ref(localToday());
const month = ref(localMonth());
const rows = ref([]);
const leaveRows = computed(() => rows.value.filter(row => row.leaveInfo));
const dirty = ref(false);
const loading = ref(false);
const savedCount = ref(0);
const stats = ref([]);
const statsLoading = ref(false);

// 回滚标志：取消切班/切日期时抑制二次确认
let restoring = false;

watch(() => store.currentClassId, async (newId, oldId) => {
  if (restoring) { restoring = false; return; }
  if (dirty.value && oldId != null) {
    const ok = await ElMessageBox.confirm('当前日期考勤有未保存的修改，切换班级将丢失。确定继续吗？', '未保存提示', { type: 'warning' }).catch(() => false);
    if (!ok) { restoring = true; store.currentClassId = oldId; return; }
  }
  loadDaily();
  loadStats();
});

// 切日期：取消时回滚日期，避免「新日期 + 旧数据」错配
async function onDateChange(newDate) {
  if (!dirty.value) { date.value = newDate; loadDaily(); return; }
  const prevDate = date.value;
  const ok = await ElMessageBox.confirm('当前日期考勤有未保存的修改，切换将丢失。确定继续吗？', '未保存提示', { type: 'warning' }).catch(() => false);
  if (!ok) { date.value = prevDate; return; }
  date.value = newDate;
  loadDaily();
}

// 离开页面（路由切换）前拦截
onBeforeRouteLeave(async () => {
  if (!dirty.value) return true;
  const ok = await ElMessageBox.confirm('当前日期考勤有未保存的修改，离开将丢失。确定离开吗？', '未保存提示', { type: 'warning' }).catch(() => false);
  return ok;
});
// 刷新/关闭浏览器前兜底
function beforeUnloadGuard(e) {
  if (dirty.value) { e.preventDefault(); e.returnValue = ''; }
}
if (!desktopApi.isTauri()) {
  window.addEventListener('beforeunload', beforeUnloadGuard);
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnloadGuard));
}

onMounted(() => { loadDaily(); loadStats(); });

async function loadDaily() {
  if (!store.currentClassId) { rows.value = []; return; }
  const mySeq = dailySeq.seq();
  loading.value = true;
  try {
    const d = await api.attendance.get(store.currentClassId, date.value);
    if (dailySeq.isStale(mySeq)) return;
    rows.value = d.rows;
    savedCount.value = d.registeredCount || 0;
    dirty.value = false;
  } catch (e) {
    ElMessage.error('考勤加载失败：' + e.message);
  } finally {
    if (!dailySeq.isStale(mySeq)) loading.value = false;
  }
}

async function saveDaily() {
  if (!store.currentClassId) return;
  const payload = rows.value.map(r => ({
    studentId: r.studentId, status: r.status, remark: r.remark || '',
  }));
  try {
    const result = await api.attendance.save({ classId: store.currentClassId, date: date.value, rows: payload });
    if (result.skipped?.length) {
      const details = result.skipped.slice(0, 3).map(item => item.studentId).join('、');
      ElMessage.warning(`已保存 ${result.count} 人，跳过 ${result.skipped.length} 人${details ? `（学生：${details}）` : ''}`);
    } else {
      ElMessage.success(`已保存 ${date.value} 的考勤`);
    }
    dirty.value = false;
    loadDaily();
  } catch (e) {
    ElMessage.error(e.message);
  }
}

// 一键全部出勤（B1）：全勤日不用逐行点选
function markAllPresent() {
  rows.value.forEach(r => { r.status = '出勤'; r.remark = ''; });
  dirty.value = true;
  ElMessage.success('已将全部学生设为出勤，记得保存');
}

// 导出月度统计（B2）
async function exportStats() {
  try {
    const result = await exportExcel(
      '考勤统计', `考勤统计-${month.value}`,
      [
        { title: '学号', key: 'school_no', width: 14 },
        { title: '姓名', key: 'name', width: 12 },
        { title: '出勤', key: '出勤', width: 10 },
        { title: '迟到', key: '迟到', width: 10 },
        { title: '请假', key: '请假', width: 10 },
        { title: '缺勤', key: '缺勤', width: 10 },
        { title: '登记天数', key: 'days', width: 12 },
      ],
      stats.value
    );
    if (result.saved) ElMessage.success('月度统计已保存');
  } catch (e) {
    ElMessage.error(e.message);
  }
}

async function loadStats() {
  if (!store.currentClassId) { stats.value = []; return; }
  const mySeq = statsSeq.seq();
  statsLoading.value = true;
  try {
    const data = await api.attendance.stats(store.currentClassId, month.value);
    if (statsSeq.isStale(mySeq)) return;
    stats.value = data;
  } catch (e) {
    ElMessage.error('统计加载失败：' + e.message);
  } finally {
    if (!statsSeq.isStale(mySeq)) statsLoading.value = false;
  }
}
</script>

<style scoped>
.attendance-leave-alert { width: auto; flex: 1 1 360px; min-width: 280px; padding: 6px 10px; }
.leave-tag { margin-right: 6px; vertical-align: middle; }
.bad { color: var(--el-color-danger); font-weight: 700; }
</style>
