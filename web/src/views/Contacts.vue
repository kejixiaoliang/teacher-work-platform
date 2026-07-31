<template>
  <div class="page-card">
    <div class="page-head">
      <div>
        <h2 class="page-head-title">家校沟通</h2>
        <p class="page-head-desc">家访 / 电话 / 微信沟通台账，按学生汇总</p>
      </div>
      <div class="page-head-actions">
        <el-button type="primary" :icon="Plus" @click="openForm()">记录沟通</el-button>
      </div>
    </div>

    <!-- 月度统计 -->
    <div class="stat-bar" v-if="stats">
      <div class="stat-chip"><b>{{ stats.total }}</b><span>本月沟通</span></div>
      <div class="stat-chip"><b>{{ stats.students }}</b><span>涉及学生</span></div>
      <div class="stat-chip"><b>{{ stats.visits }}</b><span>家访</span></div>
      <div class="stat-chip"><b>{{ stats.phones }}</b><span>电话</span></div>
    </div>

    <div class="toolbar">
      <el-date-picker v-model="query.month" type="month" value-format="YYYY-MM" :clearable="true"
                      placeholder="按月份筛选" style="width:140px" @change="load" />
      <el-select v-model="query.student_id" filterable clearable placeholder="按学生筛选" style="width:180px" @change="load">
        <el-option v-for="s in students" :key="s.id" :value="s.id" :label="`${s.name}（${s.school_no}）`" />
      </el-select>
      <div class="spacer"></div>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>

    <el-table :data="list" stripe v-loading="loading">
      <el-table-column prop="student_name" label="学生" min-width="110">
        <template #default="{ row }"><b>{{ row.student_name }}</b><span class="text-muted" v-if="row.school_no">（{{ row.school_no }}）</span></template>
      </el-table-column>
      <el-table-column prop="method" label="方式" width="90">
        <template #default="{ row }">
          <el-tag :type="methodType(row.method)" effect="light" round>{{ row.method || '—' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="date" label="日期" width="110" />
      <el-table-column prop="topic" label="事由" min-width="160" show-overflow-tooltip />
      <el-table-column prop="result" label="结果/反馈" min-width="200" show-overflow-tooltip>
        <template #default="{ row }"><span class="text-muted">{{ row.result || '—' }}</span></template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button class="row-btn" size="small" @click="openForm(row)">编辑</el-button>
          <el-button class="row-btn row-btn-del" size="small" @click="removeOne(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="text-muted" style="margin-top:8px">共 {{ list.length }} 条沟通记录</div>

    <!-- 记录/编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="form.id ? '编辑沟通记录' : '记录沟通'" width="480px">
      <el-form label-width="60px">
        <el-form-item label="学生" required>
          <el-select v-model="form.student_id" filterable style="width:100%" placeholder="选择学生">
            <el-option v-for="s in students" :key="s.id" :value="s.id" :label="`${s.name}（${s.school_no}）`" />
          </el-select>
        </el-form-item>
        <el-form-item label="方式">
          <el-select v-model="form.method" style="width:150px">
            <el-option v-for="m in ['家访', '电话', '微信', '到校面谈', '其他']" :key="m" :value="m" :label="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期"><el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="事由"><el-input v-model="form.topic" placeholder="如：反馈期中成绩" /></el-form-item>
        <el-form-item label="结果"><el-input v-model="form.result" type="textarea" :rows="2" placeholder="沟通结果/家长反馈" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" @click="saveForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh } from '@element-plus/icons-vue';
import { api } from '../api.js';
import { store } from '../store.js';

const list = ref([]);
const stats = ref(null);
const students = ref([]);
const loading = ref(false);
const query = reactive({ month: '', student_id: null });

const formVisible = ref(false);
const form = ref(emptyForm());

function emptyForm() {
  return { id: null, student_id: null, method: '电话', date: '', topic: '', result: '' };
}

watch(() => store.currentClassId, () => { load(); loadStudents(); });
onMounted(() => { load(); loadStudents(); });

async function loadStudents() {
  if (!store.currentClassId) { students.value = []; return; }
  try {
    students.value = await api.students.list({ class_id: store.currentClassId, status: '在读' });
  } catch (e) { ElMessage.error('学生列表加载失败：' + e.message); }
}

async function load() {
  if (!store.currentClassId) { list.value = []; stats.value = null; return; }
  loading.value = true;
  try {
    const q = { class_id: store.currentClassId };
    if (query.month) q.month = query.month;
    if (query.student_id) q.student_id = query.student_id;
    list.value = await api.contacts.list(q);
    stats.value = await api.contacts.stats({ class_id: store.currentClassId, month: query.month || undefined });
  } catch (e) {
    ElMessage.error('沟通记录加载失败：' + e.message);
  } finally {
    loading.value = false;
  }
}

function openForm(row) {
  form.value = row
    ? { id: row.id, student_id: row.student_id, method: row.method || '电话', date: row.date || '', topic: row.topic || '', result: row.result || '' }
    : emptyForm();
  formVisible.value = true;
}

async function saveForm() {
  if (!form.value.student_id) return ElMessage.warning('请选择学生');
  if (!form.value.topic && !form.value.result) return ElMessage.warning('请填写事由或结果');
  try {
    if (form.value.id) {
      await api.contacts.update(form.value.id, form.value);
    } else {
      await api.contacts.create(form.value);
    }
    ElMessage.success('已保存');
    formVisible.value = false;
    load();
  } catch (e) {
    ElMessage.error(e.message);
  }
}

async function removeOne(row) {
  const ok = await ElMessageBox.confirm(`删除与「${row.student_name}」的沟通记录？`, '确认', { type: 'warning' }).catch(() => false);
  if (!ok) return;
  await api.contacts.remove(row.id);
  ElMessage.success('已删除');
  load();
}

function methodType(m) {
  return { 家访: 'danger', 电话: 'primary', 微信: 'success', 到校面谈: 'warning', 其他: 'info' }[m] || 'info';
}
</script>

<style scoped>
/* 统计条 */
.stat-bar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
.stat-chip {
  background: #fff;
  border: 3px solid var(--ink);
  border-radius: 14px;
  box-shadow: var(--shadow-xs);
  padding: 8px 18px;
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
}
.stat-chip b { font-size: 20px; font-weight: 900; color: var(--tomato-deep); }
.stat-chip span { font-size: 12px; color: var(--muted); font-weight: 800; }

/* 行内操作按钮（与学生管理一致） */
.row-btn {
  margin: 0 4px 0 0 !important;
  border-radius: 999px;
  border: 2px solid var(--ink);
  background: #fff;
  color: var(--ink);
  font-weight: 800;
  padding: 4px 12px;
  height: auto;
}
.row-btn:hover { background: var(--mustard); color: var(--ink); }
.row-btn-del { border-color: var(--tomato); color: var(--tomato); }
.row-btn-del:hover { background: var(--tomato); color: #fff; }
</style>
