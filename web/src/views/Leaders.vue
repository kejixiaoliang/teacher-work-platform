<template>
  <div class="page-card">
    <div class="page-head">
      <div>
        <h2 class="page-head-title">班委学委</h2>
        <p class="page-head-desc">选任固定班委（班长、学委、课代表…），同一职务一人担任</p>
      </div>
      <div class="page-head-actions">
        <el-button :icon="MagicStick" @click="presetLeaders">一键预设班委</el-button>
        <el-button type="primary" :icon="Plus" @click="openLeader()">选任班委</el-button>
      </div>
    </div>

    <el-tabs v-model="tab">
      <!-- 班委 -->
      <el-tab-pane label="班委" name="leaders">
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
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button class="row-btn" size="small" @click="openLeader(row)">编辑</el-button>
              <el-button class="row-btn row-btn-del" size="small" @click="removeDuty(row)">解除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!leaders.length" description="还没有设置班委，点右上角「选任班委」" :image-size="60" />
      </el-tab-pane>

      <!-- 课代表 -->
      <el-tab-pane label="课代表" name="subjects">
        <div class="toolbar">
          <span class="text-muted">每个科目选一位课代表（同一科目仅一人）</span>
          <div class="spacer"></div>
          <el-button type="primary" :icon="Plus" @click="openSubject()">选任课代表</el-button>
        </div>
        <el-table :data="subjectLeaders" stripe>
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
        <el-empty v-if="!subjectLeaders.length" description="还没有选任课代表，点右上角「选任课代表」" :image-size="60" />
      </el-tab-pane>
    </el-tabs>

    <!-- 选任弹窗（班委/课代表共用） -->
    <el-dialog v-model="leaderVisible" :title="leaderForm.id ? '编辑' : '选任'" width="440px">
      <el-form label-width="80px">
        <el-form-item v-if="leaderForm.kind === '班委'" label="职务">
          <el-select v-model="leaderForm.role" filterable allow-create default-first-option style="width:210px"
                     placeholder="选择或输入新职务">
            <el-option v-for="r in LEADER_ROLES" :key="r" :value="r" :label="r" />
          </el-select>
        </el-form-item>
        <el-form-item v-else label="科目">
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
        <el-button type="primary" @click="saveLeader">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, MagicStick } from '@element-plus/icons-vue';
import { api } from '../api.js';
import { store } from '../store.js';

const LEADER_ROLES = ['班长', '副班长', '学习委员', '卫生委员', '体育委员', '文艺委员', '纪律委员', '生活委员', '宣传委员'];
const SUBJECT_ROLES = ['语文课代表', '数学课代表', '英语课代表', '物理课代表', '化学课代表', '生物课代表', '政治课代表', '历史课代表', '地理课代表'];

const route = useRoute();
const tab = ref(route.query.tab === 'subjects' ? 'subjects' : 'leaders');
const duties = ref([]);
const students = ref([]);
const leaderVisible = ref(false);
const leaderForm = ref({ id: null, kind: '班委', role: '', student_id: null, remark: '' });

const leaders = computed(() => duties.value.filter(d => d.role !== '值日生' && !d.role.endsWith('课代表')));
const subjectLeaders = computed(() => duties.value.filter(d => d.role.endsWith('课代表')));

// 菜单「课代表选择」点击时（组件已复用，query 变化）同步 tab
watch(() => route.query.tab, t => {
  tab.value = t === 'subjects' ? 'subjects' : 'leaders';
});

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

function openLeader(row) {
  leaderForm.value = row
    ? { id: row.id, kind: '班委', role: row.role, student_id: row.student_id, remark: row.remark || '' }
    : { id: null, kind: '班委', role: '', student_id: null, remark: '' };
  leaderVisible.value = true;
}

function openSubject(row) {
  leaderForm.value = row
    ? { id: row.id, kind: '课代表', role: row.role, student_id: row.student_id, remark: row.remark || '' }
    : { id: null, kind: '课代表', role: '', student_id: null, remark: '' };
  leaderVisible.value = true;
}

async function saveLeader() {
  if (!leaderForm.value.role) return ElMessage.warning('请选择职务/科目');
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

<style scoped>
/* 行内操作按钮：横向小胶囊（与学生管理一致） */
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
