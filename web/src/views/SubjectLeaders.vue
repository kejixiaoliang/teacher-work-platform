<template>
  <div class="page-card">
    <div class="page-head">
      <div>
        <h2 class="page-head-title">课代表选择</h2>
        <p class="page-head-desc">为各科选任课代表（同一科目仅一人，可与班委兼任）</p>
      </div>
      <div class="page-head-actions">
        <el-button :icon="MagicStick" @click="presetSubjectLeaders">一键预设课代表</el-button>
        <el-button type="primary" :icon="Plus" @click="openSubject()">选任课代表</el-button>
      </div>
    </div>

    <el-table :data="subjectLeaders" stripe v-loading="loading">
      <el-table-column label="科目" width="160">
        <template #default="{ row }">
          <el-tag size="large" type="warning" effect="light" round>{{ row.role.replace('课代表', '') }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="student_name" label="课代表" width="140" show-overflow-tooltip>
        <template #default="{ row }"><b>{{ row.student_name }}</b></template>
      </el-table-column>
      <el-table-column prop="gender" label="性别" width="80" />
      <el-table-column prop="remark" label="备注" show-overflow-tooltip />
      <el-table-column label="操作" width="140">
        <template #default="{ row }">
          <el-button class="row-btn" size="small" @click="openSubject(row)">编辑</el-button>
          <el-button class="row-btn row-btn-del" size="small" @click="removeDuty(row)">解除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!subjectLeaders.length" description="还没有选任课代表，点右上角「选任课代表」或「一键预设课代表」" :image-size="60" />

    <!-- 选任弹窗 -->
    <el-dialog v-model="leaderVisible" :title="leaderForm.id ? '编辑课代表' : '选任课代表'" width="440px">
      <el-form label-width="80px">
        <el-form-item label="科目">
          <el-select v-model="leaderForm.role" style="width:210px" placeholder="选择科目">
            <el-option v-for="r in SUBJECT_ROLES" :key="r" :value="r" :label="r" />
          </el-select>
        </el-form-item>
        <el-form-item label="学生">
          <el-select v-model="leaderForm.student_id" filterable style="width:210px" placeholder="选择学生">
            <el-option v-for="s in students" :key="s.id" :value="s.id" :label="`${s.name}（${s.school_no}）`" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="leaderForm.remark" placeholder="如：负责收作业" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="leaderVisible = false">取消</el-button>
        <el-button type="primary" @click="saveSubject">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, MagicStick } from '@element-plus/icons-vue';
import { api } from '../api.js';
import { store } from '../store.js';
import { useSeqLoad } from '../composables/useSeqLoad.js';

const { seq, isStale } = useSeqLoad();

const SUBJECT_ROLES = ['语文课代表', '数学课代表', '英语课代表', '物理课代表', '化学课代表', '生物课代表', '政治课代表', '历史课代表', '地理课代表'];

const duties = ref([]);
const students = ref([]);
const loading = ref(false);
const leaderVisible = ref(false);
const leaderForm = ref({ id: null, role: '', student_id: null, remark: '' });

const subjectLeaders = computed(() => duties.value.filter(d => d.role.endsWith('课代表')));

watch(() => store.currentClassId, load);
onMounted(load);

async function load() {
  if (!store.currentClassId) { duties.value = []; return; }
  const mySeq = seq();
  loading.value = true;
  try {
    const d = await api.duties.list({ class_id: store.currentClassId });
    const st = await api.students.list({ class_id: store.currentClassId, status: '在读' });
    if (isStale(mySeq)) return;
    duties.value = d;
    students.value = st;
  } catch (e) {
    ElMessage.error('数据加载失败：' + e.message);
  } finally {
    loading.value = false;
  }
}

function openSubject(row) {
  leaderForm.value = row
    ? { id: row.id, role: row.role, student_id: row.student_id, remark: row.remark || '' }
    : { id: null, role: '', student_id: null, remark: '' };
  leaderVisible.value = true;
}

async function saveSubject() {
  if (!leaderForm.value.role) return ElMessage.warning('请选择科目');
  if (!leaderForm.value.student_id) return ElMessage.warning('请选择学生');
  try {
    if (leaderForm.value.id) {
      await api.duties.update(leaderForm.value.id, { role: leaderForm.value.role, student_id: leaderForm.value.student_id, remark: leaderForm.value.remark });
    } else {
      await api.duties.create({ class_id: store.currentClassId, role: leaderForm.value.role, student_id: leaderForm.value.student_id, remark: leaderForm.value.remark });
    }
    ElMessage.success('已保存');
    leaderVisible.value = false;
    load();
  } catch (e) {
    ElMessage.error(e.message);
  }
}

async function removeDuty(row) {
  const ok = await ElMessageBox.confirm(`解除「${row.student_name}」的「${row.role}」职务？`, '确认', { type: 'warning' }).catch(() => false);
  if (!ok) return;
  try {
    await api.duties.remove(row.id);
    load();
  } catch (e) {
    ElMessage.error('解除失败：' + e.message);
  }
}

/** 一键预设课代表：按名单顺序为各科补齐课代表（可兼任班委） */
async function presetSubjectLeaders() {
  if (!store.currentClassId) return;
  const ok = await ElMessageBox.confirm(
    '将为语文/数学/英语/物理/化学/生物/政治/历史/地理各选一位课代表（按名单顺序分配，同一科目仅一人，可与班委兼任）。已有课代表的科目跳过。继续？',
    '一键预设课代表', { type: 'warning', confirmButtonText: '生成' }
  ).catch(() => false);
  if (!ok) return;
  try {
    const r = await api.duties.presetSubjectLeaders({ class_id: store.currentClassId });
    load();
    if (r.added.length) {
      ElMessage.success(`已选任 ${r.added.length} 个课代表：${r.added.map(a => `${a.role}→${a.name}`).join('、')}`);
    } else {
      ElMessage.info('各科课代表都已有人选，无需补充');
    }
  } catch (e) {
    ElMessage.error(e.message);
  }
}
</script>
