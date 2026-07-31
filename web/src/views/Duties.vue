<template>
  <div class="page-card" v-loading="loading">
    <div class="page-head">
      <div>
        <h2 class="page-head-title">值日管理</h2>
        <p class="page-head-desc">把学生分成若干组，按周轮换值日，可打印值日表</p>
      </div>
    </div>
    <el-tabs v-model="tab">
      <!-- ============ 值日分组 ============ -->
      <el-tab-pane label="值日分组" name="groups">
        <div class="toolbar">
          <span class="text-muted">把学生分成 N 组，每周轮换一组；<b>每人只在一个组</b>，保证周期内每周人员不重复</span>
          <div class="spacer"></div>
          <el-button type="primary" :icon="MagicStick" @click="openAutoGroup">一键自动分组</el-button>
          <el-button :icon="Plus" @click="addGroup">新增组</el-button>
          <el-button :icon="User" @click="openAddMembers()">往某组加人</el-button>
        </div>
        <el-alert v-if="!groupCount" type="info" :closable="false" title="还没有值日分组，点「新增组」开始（会打开加人弹窗，输入组号即可创建）" />
        <div v-else class="group-grid">
          <div v-for="g in groups" :key="g.no" class="group-card">
            <div class="group-head">
              <span class="group-badge">第 {{ g.no }} 组</span>
              <span class="text-muted">({{ g.members.length }} 人)</span>
              <div class="spacer"></div>
              <el-button class="grp-btn" size="small" @click="openAddMembers(g.no)">加人</el-button>
              <el-button class="grp-btn grp-btn-del" size="small" @click="removeGroup(g.no)">删组</el-button>
            </div>
            <div class="group-members">
              <el-tag v-for="m in g.members" :key="m.id" closable size="default"
                      :type="m.gender === '女' ? 'danger' : 'warning'"
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
          <div class="text-muted" style="margin-top:8px">共 {{ groupCount }} 组轮换：一个完整周期 {{ groupCount }} 周内<b>每周人员不重复</b>，第 {{ groupCount + 1 }} 周起按周期循环</div>
          <div class="text-muted" style="margin-top:4px">如需更长不重复周期，可增加组数或用「一键自动分组」重新分配</div>
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
          <el-select v-model="memberForm.student_ids" multiple filterable style="width:100%" placeholder="多选（已在其他组的会自动跳过）">
            <el-option v-for="s in students" :key="s.id" :value="s.id" :label="`${s.name}（${s.school_no}）`" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="memberVisible = false">取消</el-button>
        <el-button type="primary" @click="saveMembers">保存</el-button>
      </template>
    </el-dialog>

    <!-- 自动分组弹窗 -->
    <el-dialog v-model="autoGroupVisible" title="一键自动分组" width="440px">
      <el-alert type="info" :closable="false" style="margin-bottom:12px"
                title="按名单顺序把全班在读学生平均分成 N 组；每个学生只在一个组，组间不重复。将重置现有值日分组。" />
      <el-form label-width="80px">
        <el-form-item label="组数">
          <el-input-number v-model="autoGroupCount" :min="2" :max="10" />
          <span class="text-muted" style="margin-left:8px">组数越多，不重复周期越长</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="autoGroupVisible = false">取消</el-button>
        <el-button type="primary" :loading="autoGroupLoading" @click="runAutoGroup">生成分组</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, User, Printer, MagicStick } from '@element-plus/icons-vue';
import { api } from '../api.js';
import { store } from '../store.js';
import { useSeqLoad } from '../composables/useSeqLoad.js';

const { seq, isStale } = useSeqLoad();

const tab = ref('groups');
const duties = ref([]);
const students = ref([]);
const loading = ref(false);
const week = ref(Number(localStorage.getItem('duty-week') || 1));

const memberVisible = ref(false);
const memberForm = ref({ group_no: null, student_ids: [] });

const autoGroupVisible = ref(false);
const autoGroupCount = ref(4);
const autoGroupLoading = ref(false);

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
// 当前周对应组：按排序后的索引取（组号删除后可能不连续，不能用 (week-1)%count+1 直接当组号找）
const currentGroupNo = computed(() => groupCount.value ? ((week.value - 1) % groupCount.value) + 1 : null);
const currentGroup = computed(() => {
  const idx = currentGroupNo.value;
  return idx != null ? groups.value[idx - 1] : null;
});
const rosterRows = computed(() => {
  if (!groupCount.value) return [];
  // 完整周期：第 w 周 = 排序后第 w 组（一个周期内每周人员不重复；组号不连续时按索引对齐）
  return Array.from({ length: groupCount.value }, (_, i) => {
    const w = i + 1;
    const g = groups.value[i];
    return { week: w, groupNo: g ? g.no : w, members: g ? g.members.map(m => m.student_name).join('、') : '' };
  });
});

watch(() => store.currentClassId, load);
watch(week, v => localStorage.setItem('duty-week', String(v)));
onMounted(load);

async function load() {
  if (!store.currentClassId) { duties.value = []; return; }
  const mySeq = seq();
  loading.value = true;
  try {
    // 双请求并行，各自独立落值：学生列表失败不拖垮值日表
    const [dRes, stRes] = await Promise.allSettled([
      api.duties.list({ class_id: store.currentClassId }),
      api.students.list({ class_id: store.currentClassId, status: '在读' }),
    ]);
    if (isStale(mySeq)) return;
    if (dRes.status === 'fulfilled') duties.value = dRes.value;
    else ElMessage.error('值日数据加载失败：' + dRes.reason?.message);
    if (stRes.status === 'fulfilled') students.value = stRes.value;
  } catch (e) {
    ElMessage.error('数据加载失败：' + e.message);
  } finally {
    if (!isStale(mySeq)) loading.value = false;
  }
}

/* ---------- 值日分组 ---------- */
async function addGroup() {
  const next = groupCount.value ? Math.max(...groups.value.map(g => g.no)) + 1 : 1;
  openAddMembers(next);
}
async function removeGroup(no) {
  const ok = await ElMessageBox.confirm(`删除第 ${no} 组及其全部成员？`, '确认', { type: 'warning' }).catch(() => false);
  if (!ok) return;
  try {
    // 并行删除（P2-15）
    const list = dutyList.value.filter(d => d.group_no === no);
    await Promise.all(list.map(d => api.duties.remove(d.id)));
    ElMessage.success('已删除');
  } catch (e) {
    ElMessage.error('部分删除失败：' + e.message);
  } finally {
    load(); // 部分失败也要刷新，保持 UI 与服务器一致
  }
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
  try {
    const r = await api.duties.batch({ class_id: store.currentClassId, role: '值日生', group_no: memberForm.value.group_no, student_ids: fresh });
    if (r.skipped?.length) {
      ElMessage.warning(`已添加 ${r.count} 人；${r.skipped.length} 人已在其他组被跳过（${r.skipped.map(s => s.name).join('、')}）`);
    } else {
      ElMessage.success(`已添加 ${r.count} 人`);
    }
    memberVisible.value = false;
    load();
  } catch (e) {
    ElMessage.error(e.message);
  }
}

/* ---------- 自动分组 ---------- */
function openAutoGroup() {
  autoGroupCount.value = Math.max(4, Math.ceil(students.value.length / 6));
  autoGroupVisible.value = true;
}
async function runAutoGroup() {
  if (!store.currentClassId) return;
  autoGroupLoading.value = true;
  try {
    const r = await api.duties.autoGroup({ class_id: store.currentClassId, groupCount: autoGroupCount.value });
    autoGroupVisible.value = false;
    load();
    const brief = r.groups.map(g => `第${g.no}组${g.members.length}人`).join('，');
    ElMessage.success(`已生成 ${r.groupCount} 组，共 ${r.count} 人（${brief}）`);
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    autoGroupLoading.value = false;
  }
}
async function removeMember(m) {
  const ok = await ElMessageBox.confirm(`把「${m.student_name}」移出第 ${m.group_no} 组？`, '确认', { type: 'warning' }).catch(() => false);
  if (!ok) return;
  try {
    await api.duties.remove(m.id);
    load();
  } catch (e) {
    ElMessage.error('移出失败：' + e.message);
  }
}

/* ---------- 打印值日表 ---------- */
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function printRoster() {
  if (!groupCount.value) return;
  const cls = store.classes.find(c => c.id === store.currentClassId);
  const lines = ['<h3>值日安排表</h3>', `<p>班级：${esc(cls?.name || '')}（开学第 ${week.value} 周）</p>`];
  lines.push('<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%">');
  lines.push('<tr><th>周次</th><th>值日组</th><th>值日学生</th></tr>');
  for (const r of rosterRows.value) {
    lines.push(`<tr><td>第 ${r.week} 周</td><td>第 ${r.groupNo} 组</td><td>${esc(r.members) || '—'}</td></tr>`);
  }
  lines.push('</table>');
  for (const g of groups.value) {
    lines.push(`<p style="margin-top:10px"><b>第 ${g.no} 组名单：</b>${esc(g.members.map(m => m.student_name).join('、')) || '（空）'}</p>`);
  }
  const win = window.open('', '_blank');
  if (!win) return ElMessage.warning('弹窗被浏览器拦截，请允许弹出窗口后重试');
  win.document.write(`<html><head><meta charset="utf-8"><title>值日表</title><style>body{font-family:"Microsoft YaHei",sans-serif;padding:20px}td{text-align:center}</style></head><body>${lines.join('')}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}
</script>

<style scoped>
.group-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.group-card {
  border: 3px solid var(--ink); border-radius: 16px; padding: 14px;
  background: #fff; transition: box-shadow .15s, transform .15s;
  box-shadow: var(--shadow-sm);
}
.group-card:hover { box-shadow: var(--shadow); transform: translateY(-2px); }
.group-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.group-badge {
  background: var(--mustard); border: 3px solid var(--ink); color: var(--ink);
  border-radius: 999px; padding: 2px 14px; font-size: 13px; font-weight: 900;
  box-shadow: var(--shadow-xs);
}
/* 组卡操作按钮：清晰胶囊，不与底色融合（样式见全局 style.css） */
.group-members { display: flex; flex-wrap: wrap; gap: 6px; }
.current-group {
  padding: 14px; background: var(--paper); border-radius: 16px; border: 3px solid var(--ink);
  box-shadow: var(--shadow-sm);
}
.name-chip {
  display: inline-block; background: #fff; border: 3px solid var(--mint); color: var(--ink);
  border-radius: 999px; padding: 1px 12px; margin-left: 8px; font-size: 13px; font-weight: 800;
}
</style>
