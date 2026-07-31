<template>
  <div class="page-card">
    <div class="page-head">
      <div>
        <h2 class="page-head-title">请假管理</h2>
        <p class="page-head-desc">学生请假台账（事假/病假），支持销假与今日请假查看</p>
      </div>
      <div class="page-head-actions">
        <el-button type="primary" :icon="Plus" @click="openForm()">登记请假</el-button>
      </div>
    </div>

    <!-- 今日请假概览 -->
    <div class="today-bar" v-if="todayLeaves.length">
      <el-tag type="warning" size="large" round>今日请假 {{ todayLeaves.length }} 人</el-tag>
      <span class="today-names">{{ todayLeaves.map(l => l.student_name).join('、') }}</span>
    </div>

    <div class="toolbar">
      <el-date-picker v-model="query.month" type="month" value-format="YYYY-MM" :clearable="true"
                      placeholder="按月份筛选" style="width:140px" @change="load" />
      <el-select v-model="query.student_id" filterable clearable placeholder="按学生筛选" style="width:180px" @change="load">
        <el-option v-for="s in students" :key="s.id" :value="s.id" :label="`${s.name}（${s.school_no}）`" />
      </el-select>
      <el-select v-model="query.type" clearable placeholder="请假类型" style="width:110px" @change="load">
        <el-option label="事假" value="事假" /><el-option label="病假" value="病假" />
        <el-option label="其他" value="其他" />
      </el-select>
      <el-select v-model="query.status" clearable placeholder="状态" style="width:110px" @change="load">
        <el-option label="已批准" value="已批准" /><el-option label="待批准" value="待批准" />
        <el-option label="已销假" value="已销假" />
      </el-select>
      <div class="spacer"></div>
      <el-button :icon="Download" :disabled="!list.length" @click="exportLeaves">导出请假台账</el-button>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>

    <!-- 逾期未销假提醒（B6） -->
    <div class="today-bar overdue-bar" v-if="overdueLeaves.length">
      <el-tag type="danger" size="large" round>逾期未销假 {{ overdueLeaves.length }} 条</el-tag>
      <span class="today-names">{{ overdueLeaves.slice(0, 6).map(l => `${l.student_name}(${l.end_date})`).join('、') }}</span>
      <span v-if="overdueLeaves.length > 6" class="text-muted">等 {{ overdueLeaves.length }} 条</span>
    </div>

    <el-table :data="list" stripe v-loading="loading" :row-class-name="overdueRowClass">
      <template #empty><el-empty description="暂无请假记录，点右上角「登记请假」" :image-size="60" /></template>
      <el-table-column prop="student_name" label="学生" min-width="110">
        <template #default="{ row }"><b>{{ row.student_name }}</b><span class="text-muted" v-if="row.school_no">（{{ row.school_no }}）</span></template>
      </el-table-column>
      <el-table-column prop="type" label="类型" width="80">
        <template #default="{ row }">
          <el-tag :type="row.type === '病假' ? 'danger' : 'warning'" effect="light" round>{{ row.type }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="起止日期" min-width="150">
        <template #default="{ row }">{{ row.start_date }} ~ {{ row.end_date }}</template>
      </el-table-column>
      <el-table-column prop="days" label="天数" width="70" align="center" />
      <el-table-column prop="reason" label="事由" min-width="150" show-overflow-tooltip />
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" round>{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
      <el-table-column label="操作" min-width="210" fixed="right" header-align="center">
        <template #default="{ row }">
          <div class="op-group">
            <el-button class="row-btn" size="small" @click="openForm(row)">编辑</el-button>
            <el-button v-if="row.status !== '已销假'" class="row-btn" size="small" @click="setStatus(row, '已销假')">销假</el-button>
            <el-button class="row-btn row-btn-del" size="small" @click="removeOne(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
    <div class="text-muted" style="margin-top:8px">共 {{ list.length }} 条请假记录</div>

    <!-- 登记/编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="form.id ? '编辑请假' : '登记请假'" width="460px">
      <el-form label-width="70px">
        <el-form-item label="学生" required>
          <el-select v-model="form.student_id" filterable style="width:100%" placeholder="选择学生">
            <el-option v-for="s in students" :key="s.id" :value="s.id" :label="`${s.name}（${s.school_no}）`" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="form.type">
            <el-radio value="事假">事假</el-radio><el-radio value="病假">病假</el-radio>
            <el-radio value="其他">其他</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="起止日期" required>
          <el-date-picker v-model="form.dateRange" type="daterange" value-format="YYYY-MM-DD"
                          start-placeholder="开始" end-placeholder="结束" style="width:100%"
                          @change="onRangeChange" />
        </el-form-item>
        <el-form-item label="天数">
          <el-input-number v-model="form.days" :min="0.5" :max="60" :step="0.5" />
        </el-form-item>
        <el-form-item label="事由"><el-input v-model="form.reason" placeholder="请假原因" /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width:130px">
            <el-option label="已批准" value="已批准" /><el-option label="待批准" value="待批准" />
            <el-option label="已销假" value="已销假" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" @click="saveForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh, Download } from '@element-plus/icons-vue';
import { api } from '../api.js';
import { store } from '../store.js';
import { useSeqLoad } from '../composables/useSeqLoad.js';
import { exportExcel } from '../utils/exportExcel.js';

// 每个数据域独立计数器，避免并发 load 相互作废
const mainSeq = useSeqLoad();
const studentsSeq = useSeqLoad();

const list = ref([]);
const todayLeaves = ref([]);
const students = ref([]);
const loading = ref(false);
const query = reactive({ month: '', student_id: null, type: '', status: '' });

const formVisible = ref(false);
const form = ref(emptyForm());

function emptyForm() {
  return { id: null, student_id: null, type: '事假', dateRange: [], days: 1, reason: '', status: '已批准', remark: '' };
}

// B6：逾期未销假 = 已过 end_date 且状态不是「已销假」；用本地日期（UTC 在东八区 0-8 点会差一天）
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const today = localToday();
const overdueLeaves = computed(() => list.value.filter(l =>
  l.status !== '已销假' && l.end_date && l.end_date < today
));
function overdueRowClass({ row }) {
  return row.status !== '已销假' && row.end_date && row.end_date < today ? 'row-overdue' : '';
}

// 切班：重置筛选条件 + 关闭编辑弹窗，防止旧班筛选残留导致列表恒空
watch(() => store.currentClassId, () => {
  query.month = '';
  query.student_id = null;
  query.type = '';
  query.status = '';
  formVisible.value = false;
  load();
  loadStudents();
});
onMounted(() => { load(); loadStudents(); });

async function loadStudents() {
  if (!store.currentClassId) { students.value = []; return; }
  const mySeq = studentsSeq.seq();
  try {
    const data = await api.students.list({ class_id: store.currentClassId, status: '在读' });
    if (studentsSeq.isStale(mySeq)) return;
    students.value = data;
  } catch (e) { ElMessage.error('学生列表加载失败：' + e.message); }
}

async function load() {
  if (!store.currentClassId) { list.value = []; todayLeaves.value = []; return; }
  const mySeq = mainSeq.seq();
  loading.value = true;
  try {
    const q = { class_id: store.currentClassId };
    if (query.month) q.month = query.month;
    if (query.student_id) q.student_id = query.student_id;
    if (query.type) q.type = query.type;
    if (query.status) q.status = query.status;
    // 双请求并行，各自独立落值：单请求失败不拖垮主数据（P1）
    const [dataRes, tdRes] = await Promise.allSettled([
      api.leaves.list(q),
      api.leaves.today(store.currentClassId),
    ]);
    if (mainSeq.isStale(mySeq)) return;
    if (dataRes.status === 'fulfilled') list.value = dataRes.value;
    else ElMessage.error('请假记录加载失败：' + dataRes.reason?.message);
    if (tdRes.status === 'fulfilled') todayLeaves.value = tdRes.value;
  } catch (e) {
    ElMessage.error('请假记录加载失败：' + e.message);
  } finally {
    if (!mainSeq.isStale(mySeq)) loading.value = false;
  }
}

// 导出请假台账（B2）
async function exportLeaves() {
  try {
    await exportExcel(
      '请假台账', '请假台账',
      [
        { title: '学生', key: 'student_name', width: 12 },
        { title: '学号', key: 'school_no', width: 14 },
        { title: '类型', key: 'type', width: 8 },
        { title: '开始日期', key: 'start_date', width: 14 },
        { title: '结束日期', key: 'end_date', width: 14 },
        { title: '天数', key: 'days', width: 8 },
        { title: '事由', key: 'reason', width: 24 },
        { title: '状态', key: 'status', width: 10 },
        { title: '备注', key: 'remark', width: 18 },
      ],
      list.value
    );
    ElMessage.success('请假台账已导出');
  } catch (e) {
    ElMessage.error(e.message);
  }
}

function onRangeChange(range) {
  if (range && range.length === 2) {
    const [s, e] = range;
    const d1 = new Date(s), d2 = new Date(e);
    form.value.days = Math.round((d2 - d1) / 86400000) + 1;
  }
}

function openForm(row) {
  form.value = row
    ? {
        id: row.id, student_id: row.student_id, type: row.type,
        dateRange: [row.start_date, row.end_date],
        days: row.days, reason: row.reason, status: row.status, remark: row.remark,
      }
    : emptyForm();
  formVisible.value = true;
}

async function saveForm() {
  if (!form.value.student_id) return ElMessage.warning('请选择学生');
  if (!form.value.dateRange || form.value.dateRange.length !== 2) return ElMessage.warning('请选择起止日期');
  const payload = {
    student_id: form.value.student_id,
    type: form.value.type,
    start_date: form.value.dateRange[0],
    end_date: form.value.dateRange[1],
    days: form.value.days,
    reason: form.value.reason,
    status: form.value.status,
    remark: form.value.remark,
  };
  try {
    if (form.value.id) await api.leaves.update(form.value.id, payload);
    else await api.leaves.create({ class_id: store.currentClassId, ...payload });
    ElMessage.success('已保存');
    formVisible.value = false;
    load();
  } catch (e) {
    ElMessage.error(e.message);
  }
}

async function setStatus(row, status) {
  try {
    await api.leaves.update(row.id, { status });
    ElMessage.success(`已标记为「${status}」`);
    load();
  } catch (e) {
    ElMessage.error('操作失败：' + e.message);
  }
}

async function removeOne(row) {
  const ok = await ElMessageBox.confirm(`删除「${row.student_name}」的请假记录？`, '确认', { type: 'warning' }).catch(() => false);
  if (!ok) return;
  try {
    await api.leaves.remove(row.id);
    ElMessage.success('已删除');
    load();
  } catch (e) {
    ElMessage.error('删除失败：' + e.message);
  }
}

function statusType(s) {
  return { 已批准: 'success', 待批准: 'warning', 已销假: 'info' }[s] || 'info';
}
</script>

<style scoped>
/* 今日请假条 */
.today-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  background: var(--paper-soft);
  border: 3px solid var(--ink);
  border-radius: 14px;
  padding: 10px 14px;
  margin-bottom: 14px;
  box-shadow: var(--shadow-xs);
}
.today-names { font-size: 13px; font-weight: 800; color: var(--ink); }
/* 逾期未销假提醒条 */
.overdue-bar { background: var(--el-color-danger-light-9); border-color: var(--el-color-danger); }
/* 逾期行高亮 */
:deep(.el-table .row-overdue td) { background: var(--el-color-danger-light-9) !important; }
:deep(.el-table .row-overdue td:first-child) { border-left: 3px solid var(--el-color-danger); }
</style>
