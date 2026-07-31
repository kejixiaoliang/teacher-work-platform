<template>
  <div class="page-card">
    <el-tabs v-model="tab">
      <!-- ============ 值日分组 ============ -->
      <el-tab-pane label="值日分组" name="groups">
        <div class="toolbar">
          <span class="text-muted">把学生分成 N 组，每周轮换一组值日</span>
          <div class="spacer"></div>
          <el-button :icon="Plus" @click="addGroup">新增组</el-button>
          <el-button type="primary" :icon="User" @click="openAddMembers()">往某组加人</el-button>
        </div>
        <el-alert v-if="!groupCount" type="info" :closable="false" title="还没有值日分组，点「新增组」开始（会打开加人弹窗，输入组号即可创建）" />
        <div v-else class="group-grid">
          <div v-for="g in groups" :key="g.no" class="group-card">
            <div class="group-head">
              <span class="group-badge">第 {{ g.no }} 组</span>
              <span class="text-muted">({{ g.members.length }} 人)</span>
              <div class="spacer"></div>
              <el-button link size="small" type="primary" @click="openAddMembers(g.no)">加人</el-button>
              <el-button link size="small" type="danger" @click="removeGroup(g.no)">删组</el-button>
            </div>
            <div class="group-members">
              <el-tag v-for="m in g.members" :key="m.id" closable size="default"
                      :type="m.gender === '女' ? 'danger' : 'primary'"
                      @close="removeMember(m)">{{ m.student_name }}</el-tag>
              <span v-if="!g.members.length" class="text-muted">空组</span>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- ============ 值日表 ============ -->
      <el-tab-pane label="值日表" name="roster">
        <div class="toolbar">
          <span>当前是开学第</span>
          <el-input-number v-model="week" :min="1" :max="25" size="default" />
          <span>周</span>
          <el-tag v-if="groupCount" type="warning" size="large" style="margin-left:10px">
            本周值日 → 第 {{ currentGroupNo }} 组
          </el-tag>
          <div class="spacer"></div>
          <el-button :icon="Printer" type="primary" @click="printRoster">打印值日表</el-button>
        </div>
        <el-alert v-if="!groupCount" type="info" :closable="false"
                  title="请先在「值日分组」页设置分组，才能生成值日表" />
        <template v-else>
          <div v-if="currentGroup" class="current-group">
            <b>本周值日名单（第 {{ currentGroupNo }} 组，第 {{ week }} 周）：</b>
            <span v-for="m in currentGroup.members" :key="m.id" class="name-chip">{{ m.student_name }}</span>
          </div>
          <el-table :data="rosterRows" size="small" border style="margin-top:14px">
            <el-table-column prop="week" label="周次" width="90" />
            <el-table-column prop="groupNo" label="值日组" width="90" />
            <el-table-column prop="members" label="值日学生" />
          </el-table>
          <div class="text-muted" style="margin-top:8px">轮换规则：按周轮换，第 N 周 = 第 ((N-1) mod 组数 + 1) 组</div>
        </template>
      </el-tab-pane>
    </el-tabs>

    <!-- 往组里加人 -->
    <el-dialog v-model="memberVisible" title="往值日组加人" width="460px">
      <el-form label-width="80px">
        <el-form-item label="值日组">
          <el-input-number v-model="memberForm.group_no" :min="1" :max="20" />
          <span class="text-muted" style="margin-left:8px">输入新组号即可创建新组</span>
        </el-form-item>
        <el-form-item label="学生">
          <el-select v-model="memberForm.student_ids" multiple filterable style="width:100%" placeholder="多选（已选中的会跳过）">
            <el-option v-for="s in students" :key="s.id" :value="s.id" :label="`${s.name}（${s.school_no}）`" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="memberVisible = false">取消</el-button>
        <el-button type="primary" @click="saveMembers">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, User, Printer } from '@element-plus/icons-vue';
import { api } from '../api.js';
import { store } from '../store.js';

const tab = ref('groups');
const duties = ref([]);
const students = ref([]);
const week = ref(Number(localStorage.getItem('duty-week') || 1));

const memberVisible = ref(false);
const memberForm = ref({ group_no: null, student_ids: [] });

const dutyList = computed(() => duties.value.filter(d => d.role === '值日生'));
const groups = computed(() => {
  const map = new Map();
  for (const d of dutyList.value) {
    const no = d.group_no ?? 1;
    if (!map.has(no)) map.set(no, { no, members: [] });
    map.get(no).members.push(d);
  }
  return [...map.values()].sort((a, b) => a.no - b.no);
});
const groupCount = computed(() => groups.value.length);
const currentGroupNo = computed(() => groupCount.value ? ((week.value - 1) % groupCount.value) + 1 : null);
const currentGroup = computed(() => groups.value.find(g => g.no === currentGroupNo.value));
const rosterRows = computed(() => {
  if (!groupCount.value) return [];
  return Array.from({ length: 20 }, (_, i) => {
    const w = i + 1;
    const no = ((w - 1) % groupCount.value) + 1;
    const g = groups.value.find(x => x.no === no);
    return { week: w, groupNo: no, members: g ? g.members.map(m => m.student_name).join('、') : '' };
  });
});

watch(() => store.currentClassId, load);
watch(week, v => localStorage.setItem('duty-week', String(v)));
onMounted(load);

async function load() {
  if (!store.currentClassId) { duties.value = []; return; }
  duties.value = await api.duties.list({ class_id: store.currentClassId });
  students.value = await api.students.list({ class_id: store.currentClassId, status: '在读' });
}

/* ---------- 值日分组 ---------- */
async function addGroup() {
  const next = groupCount.value ? Math.max(...groups.value.map(g => g.no)) + 1 : 1;
  openAddMembers(next);
}
async function removeGroup(no) {
  await ElMessageBox.confirm(`删除第 ${no} 组及其全部成员？`, '确认', { type: 'warning' });
  const list = dutyList.value.filter(d => d.group_no === no);
  for (const d of list) await api.duties.remove(d.id);
  load();
}
function openAddMembers(no) {
  memberForm.value = { group_no: no ?? null, student_ids: [] };
  memberVisible.value = true;
}
async function saveMembers() {
  if (!memberForm.value.group_no) return ElMessage.warning('请选择组');
  const ids = memberForm.value.student_ids;
  if (!ids.length) return ElMessage.warning('请选择学生');
  const existing = new Set(dutyList.value.filter(d => d.group_no === memberForm.value.group_no).map(d => d.student_id));
  const fresh = ids.filter(id => !existing.has(id));
  if (!fresh.length) return ElMessage.info('所选学生都在该组了');
  await api.duties.batch({ class_id: store.currentClassId, role: '值日生', group_no: memberForm.value.group_no, student_ids: fresh });
  ElMessage.success(`已添加 ${fresh.length} 人`);
  memberVisible.value = false;
  load();
}
async function removeMember(m) {
  await ElMessageBox.confirm(`把「${m.student_name}」移出第 ${m.group_no} 组？`, '确认', { type: 'warning' });
  await api.duties.remove(m.id);
  load();
}

/* ---------- 打印值日表 ---------- */
function printRoster() {
  if (!groupCount.value) return;
  const cls = store.classes.find(c => c.id === store.currentClassId);
  const lines = ['<h3>值日安排表</h3>', `<p>班级：${cls?.name || ''}（开学第 ${week.value} 周）</p>`];
  lines.push('<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%">');
  lines.push('<tr><th>周次</th><th>值日组</th><th>值日学生</th></tr>');
  for (const r of rosterRows.value) {
    lines.push(`<tr><td>第 ${r.week} 周</td><td>第 ${r.groupNo} 组</td><td>${r.members || '—'}</td></tr>`);
  }
  lines.push('</table>');
  for (const g of groups.value) {
    lines.push(`<p style="margin-top:10px"><b>第 ${g.no} 组名单：</b>${g.members.map(m => m.student_name).join('、') || '（空）'}</p>`);
  }
  const win = window.open('', '_blank');
  win.document.write(`<html><head><meta charset="utf-8"><title>值日表</title><style>body{font-family:"Microsoft YaHei",sans-serif;padding:20px}td{text-align:center}</style></head><body>${lines.join('')}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}
</script>

<style scoped>
.group-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.group-card {
  border: 1px solid #e0f0e9; border-radius: 12px; padding: 14px;
  background: #fbfefd; transition: box-shadow .15s;
}
.group-card:hover { box-shadow: 0 3px 12px rgba(62, 198, 168, .12); }
.group-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.group-badge {
  background: linear-gradient(90deg, #3ec6a8, #55d4b6); color: #fff;
  border-radius: 20px; padding: 3px 14px; font-size: 13px; font-weight: 600;
}
.group-members { display: flex; flex-wrap: wrap; gap: 6px; }
.current-group {
  padding: 14px; background: #f3fbf8; border-radius: 12px; border: 1px solid #c7f1e8;
}
.name-chip {
  display: inline-block; background: #fff; border: 1px solid #3ec6a8; color: #2f8f7a;
  border-radius: 20px; padding: 2px 12px; margin-left: 8px; font-size: 13px;
}
</style>
