<template>
  <div class="page-card">
    <div class="page-head">
      <div>
        <h2 class="page-head-title">🏅 班委学委</h2>
        <p class="page-head-desc">选任固定班委（班长、学委、课代表…），同一职务一人担任</p>
      </div>
      <div class="page-head-actions">
        <el-button :icon="MagicStick" @click="presetLeaders">✨ 一键预设班委</el-button>
        <el-button type="primary" :icon="Plus" @click="openLeader()">选任班委</el-button>
      </div>
    </div>

    <el-table :data="leaders" stripe>
      <el-table-column label="职务" width="150">
        <template #default="{ row }">
          <el-tag size="large" type="success" effect="light" round>{{ row.role }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="student_name" label="学生" width="140" show-overflow-tooltip>
        <template #default="{ row }"><b>{{ row.student_name }}</b></template>
      </el-table-column>
      <el-table-column prop="gender" label="性别" width="80" />
      <el-table-column prop="remark" label="备注" show-overflow-tooltip />
      <el-table-column label="操作" width="90">
        <template #default="{ row }">
          <el-button link type="danger" size="small" @click="removeDuty(row)">解除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 选任弹窗 -->
    <el-dialog v-model="leaderVisible" title="选任班委" width="440px">
      <el-form label-width="80px">
        <el-form-item label="职务">
          <el-select v-model="leaderForm.role" filterable allow-create default-first-option style="width:210px"
                     placeholder="选择或输入新职务">
            <el-option v-for="r in LEADER_ROLES" :key="r" :value="r" :label="r" />
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
        <el-button type="primary" @click="saveLeader">保存</el-button>
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

const LEADER_ROLES = ['班长', '副班长', '学习委员', '卫生委员', '体育委员', '文艺委员', '纪律委员', '生活委员', '宣传委员'];

const duties = ref([]);
const students = ref([]);
const leaderVisible = ref(false);
const leaderForm = ref({ role: '', student_id: null, remark: '' });

const leaders = computed(() => duties.value.filter(d => d.role !== '值日生'));

watch(() => store.currentClassId, load);
onMounted(load);

async function load() {
  if (!store.currentClassId) { duties.value = []; return; }
  try {
    duties.value = await api.duties.list({ class_id: store.currentClassId });
    students.value = await api.students.list({ class_id: store.currentClassId, status: '在读' });
  } catch (e) {
    ElMessage.error('数据加载失败：' + e.message);
  }
}

function openLeader() {
  leaderForm.value = { role: '', student_id: null, remark: '' };
  leaderVisible.value = true;
}

async function saveLeader() {
  if (!leaderForm.value.role) return ElMessage.warning('请选择职务');
  if (!leaderForm.value.student_id) return ElMessage.warning('请选择学生');
  try {
    await api.duties.create({ class_id: store.currentClassId, ...leaderForm.value });
    ElMessage.success('已选任');
    leaderVisible.value = false;
    load();
  } catch (e) {
    ElMessage.error(e.message);
  }
}

async function removeDuty(row) {
  const ok = await ElMessageBox.confirm(`解除「${row.student_name}」的「${row.role}」职务？`, '确认', { type: 'warning' }).catch(() => false);
  if (!ok) return;
  await api.duties.remove(row.id);
  load();
}

/** 一键预设班委：按名单顺序补齐常见职务空缺（每人最多一个职务） */
async function presetLeaders() {
  if (!store.currentClassId) return;
  const ok = await ElMessageBox.confirm(
    '将按学生名单顺序自动选任常见职务（班长/副班长/学习委员/卫生委员/体育委员/文艺委员/纪律委员/生活委员/宣传委员）。已有人担任的职务跳过，每人最多一个职务。继续？',
    '一键预设班委', { type: 'warning', confirmButtonText: '生成' }
  ).catch(() => false);
  if (!ok) return;
  try {
    const r = await api.duties.presetLeaders({ class_id: store.currentClassId });
    load();
    if (r.added.length) {
      ElMessage.success(`已选任 ${r.added.length} 个职务：${r.added.map(a => `${a.role}→${a.name}`).join('、')}`);
    } else {
      ElMessage.info('常见职务都已有合适人选，无需补充');
    }
  } catch (e) {
    ElMessage.error(e.message);
  }
}
</script>
