<template>
  <div class="page-card">
    <div class="page-head">
      <div>
        <h2 class="page-head-title">⚙️ 班级设置</h2>
        <p class="page-head-desc">管理班级信息、座位网格尺寸与教室布局</p>
      </div>
      <div class="page-head-actions">
        <el-button type="primary" :icon="Plus" @click="openEdit()">新建班级</el-button>
      </div>
    </div>

    <el-table :data="store.classes" stripe>
      <el-table-column prop="name" label="班级名称" width="150">
        <template #default="{ row }">
          {{ row.name }}
          <el-tag v-if="row.id === store.currentClassId" size="small" type="success" round style="margin-left:6px">当前</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="academic_year" label="学年" width="110" />
      <el-table-column prop="term" label="学期" width="70" />
      <el-table-column label="座位布局" width="150">
        <template #default="{ row }">{{ row.seat_rows }} 行 × {{ row.seat_cols }} 列 · {{ aisleLabel(row.aisle_mode) }}</template>
      </el-table-column>
      <el-table-column prop="head_teacher" label="班主任" width="100" />
      <el-table-column label="学生数" width="80">
        <template #default="{ row }">{{ row.student_count }}</template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" show-overflow-tooltip />
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button v-if="row.id !== store.currentClassId" link @click="switchClass(row)">切换</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-alert type="info" :closable="false" style="margin-top:14px"
              title="提示：切换班级后，学生/座位/值日页面会显示对应班级的数据。删除班级会连带删除其学生与座位记录，请谨慎操作。" />

    <el-dialog v-model="editVisible" :title="form.id ? '编辑班级' : '新建班级'" width="460px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="班级名称" required><el-input v-model="form.name" placeholder="如 2025级1班" /></el-form-item>
        <el-form-item label="学年"><el-input v-model="form.academic_year" placeholder="如 2025-2026" /></el-form-item>
        <el-form-item label="学期">
          <el-radio-group v-model="form.term"><el-radio value="上">上</el-radio><el-radio value="下">下</el-radio></el-radio-group>
        </el-form-item>
        <el-form-item label="座位行数"><el-input-number v-model="form.seat_rows" :min="1" :max="15" /></el-form-item>
        <el-form-item label="座位列数"><el-input-number v-model="form.seat_cols" :min="1" :max="15" /></el-form-item>
        <el-form-item label="教室布局">
          <el-radio-group v-model="form.aisle_mode">
            <el-radio :value="0">均分无走道</el-radio>
            <el-radio :value="1">中间走道</el-radio>
            <el-radio :value="2">双走道</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="班主任"><el-input v-model="form.head_teacher" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { api } from '../api.js';
import { store, loadClasses } from '../store.js';

const editVisible = ref(false);
const form = ref({ id: null, name: '', academic_year: '', term: '上', seat_rows: 6, seat_cols: 8, aisle_mode: 1, head_teacher: '', remark: '' });

function aisleLabel(m) {
  return { 0: '均分无走道', 1: '中间走道', 2: '双走道' }[m] ?? '中间走道';
}

function openEdit(row) {
  form.value = row
    ? { ...row }
    : { id: null, name: '', academic_year: '', term: '上', seat_rows: 6, seat_cols: 8, aisle_mode: 1, head_teacher: '', remark: '' };
  editVisible.value = true;
}

async function save() {
  if (!form.value.name || !form.value.name.trim()) return ElMessage.warning('请填写班级名称');
  const f = {
    name: form.value.name.trim(),
    academic_year: form.value.academic_year || '',
    term: form.value.term || '上',
    seat_rows: form.value.seat_rows,
    seat_cols: form.value.seat_cols,
    aisle_mode: form.value.aisle_mode ?? 1,
    head_teacher: form.value.head_teacher || '',
    remark: form.value.remark || '',
  };
  try {
    if (form.value.id) {
      await api.classes.update(form.value.id, f);
    } else {
      const r = await api.classes.create(f);
      store.currentClassId = r.id; // 新建后直接切换到新班级
    }
    ElMessage.success('已保存');
    editVisible.value = false;
    await loadClasses();
  } catch (e) { ElMessage.error(e.message); }
}

function switchClass(row) {
  store.currentClassId = row.id;
  ElMessage.success(`已切换到「${row.name}」`);
}

async function remove(row) {
  const isCurrent = row.id === store.currentClassId;
  const ok = await ElMessageBox.confirm(
    `确定删除「${row.name}」？${isCurrent ? '这是当前使用的班级！' : ''}将连带删除该班所有学生、座位与历史布局，不可恢复！`,
    '删除班级', { type: 'error', confirmButtonText: '删除', cancelButtonText: '取消' }
  ).catch(() => false);
  if (!ok) return;
  await api.classes.remove(row.id);
  ElMessage.success('已删除');
  await loadClasses();
}
</script>
