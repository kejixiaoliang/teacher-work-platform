<template>
  <div class="page-card">
    <div class="page-head">
      <div>
        <h2 class="page-head-title">班级设置</h2>
        <p class="page-head-desc">管理班级信息、座位网格尺寸与教室布局</p>
      </div>
      <div class="page-head-actions">
        <el-button type="primary" :icon="Plus" @click="openEdit()">新建班级</el-button>
      </div>
    </div>

    <el-card class="privacy-panel" shadow="never">
      <template #header>
        <div class="privacy-head">
          <div>
            <b>隐私与访问控制</b>
            <p>设置班级电脑可使用的模块。教师模式闲置 30 分钟后会自动回到班级模式。</p>
          </div>
          <el-tag :type="accessState.mode === 'teacher' ? 'success' : 'warning'">
            {{ accessState.mode === 'teacher' ? '教师模式' : '班级模式' }}
          </el-tag>
        </div>
      </template>
      <div class="privacy-actions">
      <el-button size="small" @click="passwordDialogVisible = true">修改教师主密码</el-button>
      <el-button size="small" text @click="recoveryDialogVisible = true">忘记密码</el-button>
        <span class="text-muted">班级模式开放模块</span>
      </div>
      <el-checkbox-group v-model="openModules" class="module-checks">
        <el-checkbox v-for="item in configurableModules" :key="item.key" :label="item.key">{{ item.label }}</el-checkbox>
      </el-checkbox-group>
      <div class="privacy-footer">
        <span class="text-muted">自动回锁：30 分钟无操作</span>
        <el-button type="primary" size="small" :loading="policySaving" @click="savePolicies">保存隐私设置</el-button>
      </div>
    </el-card>

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
      <el-table-column label="操作" width="270">
        <template #default="{ row }">
          <el-button class="row-btn" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button v-if="row.id !== store.currentClassId" class="row-btn" size="small" @click="switchClass(row)">切换</el-button>
          <el-button class="row-btn" size="small" @click="exportClassBackup(row)">备份</el-button>
          <el-button class="row-btn row-btn-del" size="small" @click="remove(row)">删除</el-button>
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

    <el-dialog v-model="passwordDialogVisible" title="修改教师主密码" width="420px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="旧密码"><el-input v-model="passwordForm.oldPassword" type="password" show-password /></el-form-item>
        <el-form-item label="新密码"><el-input v-model="passwordForm.newPassword" type="password" show-password /></el-form-item>
        <el-form-item label="确认密码"><el-input v-model="passwordForm.confirmPassword" type="password" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="passwordSaving" @click="changePassword">保存密码</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="recoveryDialogVisible" title="使用恢复密钥重置密码" width="420px" destroy-on-close>
      <p class="text-muted">恢复密码不会删除班级、学生和其他业务数据。重置成功后会生成新的恢复密钥，请妥善保存。</p>
      <el-form label-width="100px">
        <el-form-item label="恢复密钥"><el-input v-model="recoveryForm.recoveryKey" placeholder="输入 32 位恢复密钥" /></el-form-item>
        <el-form-item label="新密码"><el-input v-model="recoveryForm.nextPassword" type="password" show-password /></el-form-item>
        <el-form-item label="确认密码"><el-input v-model="recoveryForm.confirmPassword" type="password" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="recoveryDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="recoverySaving" @click="resetPassword">重置密码</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { api } from '../api.js';
import { store, loadClasses } from '../store.js';
import { accessState, refreshAccessStatus, setPolicies } from '../accessControl.js';
import { saveFileContent } from '../utils/saveFile.js';

const editVisible = ref(false);
const passwordDialogVisible = ref(false);
const recoveryDialogVisible = ref(false);
const passwordSaving = ref(false);
const recoverySaving = ref(false);
const policySaving = ref(false);
const passwordForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' });
const recoveryForm = ref({ recoveryKey: '', nextPassword: '', confirmPassword: '' });
const configurableModules = [
  { key: 'documents', label: '文档管理' },
  { key: 'leaves', label: '请假管理' },
  { key: 'duties', label: '值日管理' },
  { key: 'leaders', label: '班委学委' },
  { key: 'subject-leaders', label: '课代表选择' },
];
const openModules = ref([]);
const form = ref({ id: null, name: '', academic_year: '', term: '上', seat_rows: 6, seat_cols: 8, aisle_mode: 1, head_teacher: '', remark: '' });

onMounted(async () => {
  const status = await refreshAccessStatus();
  openModules.value = configurableModules.filter(item => status.policies[item.key] === 'open').map(item => item.key);
});

async function savePolicies() {
  policySaving.value = true;
  try {
    const open = new Set(openModules.value);
    const policies = { ...accessState.policies };
    configurableModules.forEach(item => { policies[item.key] = open.has(item.key) ? 'open' : 'protected'; });
    await setPolicies(policies);
    ElMessage.success('隐私设置已保存');
  } catch (e) { ElMessage.error(e.message); }
  finally { policySaving.value = false; }
}

async function changePassword() {
  if (!passwordForm.value.oldPassword || !passwordForm.value.newPassword) return ElMessage.warning('请填写旧密码和新密码');
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) return ElMessage.warning('两次输入的新密码不一致');
  passwordSaving.value = true;
  try {
    const status = await api.access.changePassword(passwordForm.value.oldPassword, passwordForm.value.newPassword);
    Object.assign(accessState, status);
    passwordDialogVisible.value = false;
    passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' };
    ElMessage.success('教师主密码已修改，当前已回到班级公开模式');
  } catch (e) { ElMessage.error(e.message); }
  finally { passwordSaving.value = false; }
}

async function resetPassword() {
  if (!recoveryForm.value.recoveryKey || !recoveryForm.value.nextPassword) return ElMessage.warning('请填写恢复密钥和新密码');
  if (recoveryForm.value.nextPassword !== recoveryForm.value.confirmPassword) return ElMessage.warning('两次输入的新密码不一致');
  recoverySaving.value = true;
  try {
    const status = await api.access.resetPassword(recoveryForm.value.recoveryKey, recoveryForm.value.nextPassword);
    Object.assign(accessState, status);
    recoveryDialogVisible.value = false;
    recoveryForm.value = { recoveryKey: '', nextPassword: '', confirmPassword: '' };
    if (status.recoveryKey) await ElMessageBox.alert(`新的恢复密钥：\n${status.recoveryKey}\n\n请立即保存，旧恢复密钥已经失效。`, '密码已重置', { confirmButtonText: '我已保存' });
  } catch (e) { ElMessage.error(e.message); }
  finally { recoverySaving.value = false; }
}

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

async function exportClassBackup(row) {
  try {
    const blob = await api.backup.exportClass(row.id);
    const result = await saveFileContent(blob, `班级备份-${row.name}-${new Date().toISOString().slice(0, 10)}.zip`);
    if (result.saved) ElMessage.success(`已保存「${row.name}」班级备份`);
  } catch (e) {
    ElMessage.error('班级备份失败：' + e.message);
  }
}

async function remove(row) {
  const isCurrent = row.id === store.currentClassId;
  const ok = await ElMessageBox.confirm(
    `确定删除「${row.name}」？${isCurrent ? '这是当前使用的班级！' : ''}将连带删除该班所有学生、座位与历史布局。删除前会先下载该班完整数据备份，确定继续吗？`,
    '删除班级', { type: 'error', confirmButtonText: '删除并备份', cancelButtonText: '取消' }
  ).catch(() => false);
  if (!ok) return;
  // A3：删除前自动导出该班全部数据（兜底，防误删后无法找回）
  let backupOk = true;
  try {
    const blob = await api.backup.exportClass(row.id);
    const result = await saveFileContent(blob, `班级备份-${row.name}-${new Date().toISOString().slice(0, 10)}.zip`);
    if (result.saved) ElMessage.success('已保存该班数据备份');
    else backupOk = false;
  } catch (e) {
    backupOk = false;
    ElMessage.warning('该班数据备份下载失败，仍将尝试删除');
  }
  try {
    await api.classes.remove(row.id);
    ElMessage.success('已删除');
    await loadClasses();
  } catch (e) {
    ElMessage.error('删除失败：' + e.message);
  }
}
</script>
