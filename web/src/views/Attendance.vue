<template>
  <div class="page-card">
    <div class="page-head">
      <div>
        <h2 class="page-head-title">✅ 考勤管理</h2>
        <p class="page-head-desc">每日出勤登记与月度统计</p>
      </div>
    </div>

    <el-tabs v-model="tab">
      <!-- 按日登记 -->
      <el-tab-pane label="每日登记" name="daily">
        <div class="toolbar">
          <el-date-picker v-model="date" type="date" value-format="YYYY-MM-DD" :clearable="false"
                          style="width:160px" @change="loadDaily" />
          <span class="text-muted">共 {{ rows.length }} 人 · 已登记 {{ savedCount }} 人</span>
          <div class="spacer"></div>
          <el-button type="success" :disabled="!dirty" @click="saveDaily">保存今日考勤</el-button>
        </div>
        <el-table :data="rows" size="small" border max-height="560" v-loading="loading">
          <el-table-column prop="schoolNo" label="学号" width="90" />
          <el-table-column prop="name" label="姓名" width="110">
            <template #default="{ row }"><b>{{ row.name }}</b></template>
          </el-table-column>
          <el-table-column label="状态" width="320">
            <template #default="{ row }">
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
        </div>
        <el-table :data="stats" size="small" border stripe v-loading="statsLoading">          <el-table-column prop="school_no" label="学号" width="90" />
          <el-table-column prop="name" label="姓名" width="110" />
          <el-table-column prop="出勤" label="出勤" width="80" />
          <el-table-column prop="迟到" label="迟到" width="80">
            <template #default="{ row }"><span :class="{ 'bad': row.迟到 > 0 }">{{ row.迟到 }}</span></template>
          </el-table-column>
          <el-table-column prop="请假" label="请假" width="80" />
          <el-table-column prop="缺勤" label="缺勤" width="80">
            <template #default="{ row }"><span :class="{ 'bad': row.缺勤 > 0 }">{{ row.缺勤 }}</span></template>
          </el-table-column>
          <el-table-column prop="days" label="登记天数" width="90" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api.js';
import { store } from '../store.js';

const tab = ref('daily');
const date = ref(new Date().toISOString().slice(0, 10));
const month = ref(new Date().toISOString().slice(0, 7));
const rows = ref([]);
const dirty = ref(false);
const loading = ref(false);
const savedCount = ref(0);
const stats = ref([]);
const statsLoading = ref(false);

watch(() => store.currentClassId, () => { loadDaily(); loadStats(); });
onMounted(() => { loadDaily(); loadStats(); });

async function loadDaily() {
  // 未保存考勤切换确认（P1-7）
  if (dirty.value) {
    const ok = await ElMessageBox.confirm('当前日期考勤有未保存的修改，切换将丢失。确定继续吗？', '未保存提示', { type: 'warning' }).catch(() => false);
    if (!ok) return;
  }
  if (!store.currentClassId) { rows.value = []; return; }
  loading.value = true;
  try {
    const d = await api.attendance.get(store.currentClassId, date.value);
    rows.value = d.rows;
    savedCount.value = d.registeredCount || 0;
    dirty.value = false;
  } catch (e) {
    ElMessage.error('考勤加载失败：' + e.message);
  } finally {
    loading.value = false;
  }
}

async function saveDaily() {
  if (!store.currentClassId) return;
  const payload = rows.value.map(r => ({
    studentId: r.studentId, status: r.status, remark: r.remark || '',
  }));
  try {
    await api.attendance.save({ classId: store.currentClassId, date: date.value, rows: payload });
    ElMessage.success(`已保存 ${date.value} 的考勤`);
    dirty.value = false;
    loadDaily();
  } catch (e) {
    ElMessage.error(e.message);
  }
}

async function loadStats() {
  if (!store.currentClassId) { stats.value = []; return; }
  statsLoading.value = true;
  try {
    stats.value = await api.attendance.stats(store.currentClassId, month.value);
  } catch (e) {
    ElMessage.error('统计加载失败：' + e.message);
  } finally {
    statsLoading.value = false;
  }
}
</script>

<style scoped>
.bad { color: #f56c6c; font-weight: 700; }
</style>
