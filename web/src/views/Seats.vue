<template>
  <div class="page-card">
    <!-- 工具栏 -->
    <div class="toolbar no-print">
      <el-radio-group v-model="mode" size="large">
        <el-radio-button value="manual">🖐 手动调整</el-radio-button>
        <el-radio-button value="auto">🤖 自动排座</el-radio-button>
      </el-radio-group>
      <el-button :icon="Refresh" @click="shiftDialog = true">平移轮换</el-button>
      <el-button :icon="Printer" @click="print">打印座位表</el-button>
      <el-button :icon="Clock" @click="openHistory">历史布局</el-button>
      <div class="spacer"></div>
      <el-tag v-if="dirty" type="warning" size="large" effect="dark">有未保存修改</el-tag>
      <el-button v-if="dirty" type="success" size="large" :icon="Check" @click="saveLayout">保存布局</el-button>
    </div>

    <!-- 模式面板：手动 = 操作提示；自动 = 规则设置 + 开始按钮 -->
    <div v-if="mode === 'manual'" class="mode-panel no-print">
      <span class="panel-title">🖐 手动调整</span>
      <span class="text-muted">拖拽两个座位可互换 · 点击选中座位，用右键菜单或右侧按钮操作 · 锁定座位不参与自动排座</span>
      <div class="spacer"></div>
      <template v-if="curSeat() && curSeat().studentId">
        <el-tag type="info" round>已选：{{ curSeat().name }}</el-tag>
        <el-button size="small" @click="toggleLock">{{ curSeat().locked ? '🔓 解锁' : '🔒 锁定' }}</el-button>
        <el-button size="small" type="danger" plain @click="clearSeat">设为空座</el-button>
      </template>
    </div>
    <div v-else class="mode-panel auto-panel no-print">
      <span class="panel-title">🤖 自动排座</span>
      <span class="text-muted">规则优先级：锁定/特殊需求 ＞ 身高 ＞ 视力 ＞ 男女/互助（冲突会提示）</span>
      <div class="auto-opts">
        <el-switch v-model="autoOpts.myopiaCenter" active-text="近视坐中间" />
        <el-switch v-model="autoOpts.mixedGender" active-text="男女搭配" />
        <el-switch v-model="autoOpts.peerHelp" active-text="成绩互助" />
      </div>
      <el-button type="primary" size="large" :loading="autoLoading" :icon="MagicStick" @click="runAuto">
        开始自动排座
      </el-button>
    </div>

    <!-- 提示横幅 -->
    <el-alert v-if="previewing" type="warning" :closable="false" class="no-print" style="margin-bottom:10px"
              title="当前为预览结果，未保存。确认无误后点击右上角「保存布局」。" />
    <el-alert v-if="conflicts.length" type="info" :closable="true" class="no-print" style="margin-bottom:10px"
              :title="`自动排座提示 ${conflicts.length} 条，可在手动模式下微调`">
      <ul style="margin:6px 0 0;padding-left:18px">
        <li v-for="(c, i) in conflicts" :key="i">{{ c.message }}</li>
      </ul>
    </el-alert>
    <el-alert v-if="unplaced.length" type="error" :closable="false" class="no-print" style="margin-bottom:10px"
              :title="`${unplaced.length} 人未入座（座位不足）：${unplaced.join('、')}`" />

    <!-- 座位网格 -->
    <div class="seat-area">
      <div class="podium">🎓 讲 台</div>
      <div class="seat-grid">
        <div v-for="r in rows" :key="r" class="row">
          <div v-for="c in cols" :key="c" class="seat-wrap" :class="{ aisle: isAisle(c) }">
            <div class="seat"
                 :class="{ locked: seat(r, c).locked, empty: !seat(r, c).studentId,
                           selected: selectedKey === keyOf(r, c), 'drag-over': dragOver === keyOf(r, c),
                           girl: seat(r, c).gender === '女', boy: seat(r, c).gender === '男' }"
                 :draggable="mode === 'manual' && !seat(r, c).locked && !!seat(r, c).studentId"
                 @dragstart="onDragStart($event, r, c)"
                 @dragover.prevent="dragOver = keyOf(r, c)"
                 @dragleave="dragOver = null"
                 @drop.prevent="onDrop(r, c)"
                 @click="selectSeat(r, c)"
                 @contextmenu.prevent="openMenu($event, r, c)">
              <template v-if="seat(r, c).studentId">
                <div class="s-name">{{ seat(r, c).name }}</div>
                <div class="s-meta">
                  <span v-if="seat(r, c).height_cm" class="chip">{{ seat(r, c).height_cm }}cm</span>
                  <span v-if="seat(r, c).vision_left" class="chip">视 {{ fmtV(seat(r, c).vision_left) }}</span>
                  <span v-if="seat(r, c).is_myopia" class="chip chip-warn">近视</span>
                  <span v-if="seat(r, c).locked" class="chip chip-lock">🔒 锁定</span>
                </div>
              </template>
              <div v-else class="s-name empty-text">空</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右键/选中菜单 -->
    <div v-if="menuVisible" class="ctx-menu no-print" :style="{ left: menu.x + 'px', top: menu.y + 'px' }">
      <div v-if="curSeat() && curSeat().studentId" class="ctx-title">{{ curSeat().name }}</div>
      <div class="ctx-item" @click="toggleLock">🔒 {{ curSeat() && curSeat().locked ? '解锁' : '锁定座位' }}</div>
      <div v-if="curSeat() && curSeat().studentId" class="ctx-item" @click="clearSeat">🗑 设为空座</div>
      <div class="ctx-item" @click="menuVisible = false">✕ 关闭</div>
    </div>

    <!-- 自动排座设置（已并入模式面板） -->


    <!-- 平移轮换 -->
    <el-dialog v-model="shiftDialog" title="平移轮换" width="400px">
      <p class="text-muted" style="margin-top:0">全班整体平移（按行/列取模，锁定座位不动）。常用于每学期滚动换位。</p>
      <el-form label-width="80px">
        <el-form-item label="向下移"><el-input-number v-model="shiftDr" :min="-10" :max="10" /></el-form-item>
        <el-form-item label="向右移"><el-input-number v-model="shiftDc" :min="-10" :max="10" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shiftDialog = false">取消</el-button>
        <el-button type="primary" :loading="shiftLoading" @click="runShift">预览平移</el-button>
      </template>
    </el-dialog>

    <!-- 历史布局 -->
    <el-dialog v-model="historyVisible" title="历史布局" width="560px">
      <el-table :data="layouts" size="small" border>
        <el-table-column prop="remark" label="说明" />
        <el-table-column prop="student_count" label="人数" width="60" />
        <el-table-column prop="created_at" label="保存时间" width="130" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewLayout(row)">查看/恢复</el-button>
            <el-button link type="danger" size="small" @click="deleteLayout(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 历史布局详情 -->
    <el-dialog v-model="historyDetailVisible" :title="'历史布局：' + (histDetail.remark || '')" width="720px">
      <div class="seat-area" style="padding:10px">
        <div class="podium" style="margin-bottom:8px">讲 台</div>
        <div class="seat-grid">
          <div v-for="r in rows" :key="r" class="row">
            <div v-for="c in cols" :key="c" class="seat-wrap" :class="{ aisle: isAisle(c) }">
              <div class="seat" :class="{ empty: !histName(r, c) }">
                <div class="s-name">{{ histName(r, c) || '空' }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="historyDetailVisible = false">关闭</el-button>
        <el-button type="primary" @click="applyHistory">应用到当前布局</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { MagicStick, Refresh, Printer, Clock, Check } from '@element-plus/icons-vue';
import { api } from '../api.js';
import { store, currentClass } from '../store.js';

const mode = ref('manual');       // manual | auto
const rows = computed(() => currentClass.value?.seat_rows || 6);
const cols = computed(() => currentClass.value?.seat_cols || 8);

const grid = reactive({});        // "r,c" -> seat
const dirty = ref(false);
const previewing = ref(false);
const conflicts = ref([]);
const unplaced = ref([]);

const selectedKey = ref(null);
const dragOver = ref(null);
const menuVisible = ref(false);
const menu = reactive({ x: 0, y: 0 });
const menuKey = ref(null);

const autoLoading = ref(false);
const autoOpts = reactive({ myopiaCenter: true, mixedGender: false, peerHelp: true });

const shiftDialog = ref(false);
const shiftLoading = ref(false);
const shiftDr = ref(1);
const shiftDc = ref(0);

const historyVisible = ref(false);
const historyDetailVisible = ref(false);
const layouts = ref([]);
const histDetail = ref({ seats: [], names: {} });

const keyOf = (r, c) => `${r},${c}`;

function seat(r, c) {
  const k = keyOf(r, c);
  if (!grid[k]) grid[k] = { studentId: null, row: r - 1, col: c - 1, locked: false };
  return grid[k];
}

function emptySeat(r, c) {
  return { studentId: null, row: r, col: c, locked: false };
}

async function loadSeats() {
  Object.keys(grid).forEach(k => delete grid[k]);
  conflicts.value = [];
  unplaced.value = [];
  dirty.value = false;
  previewing.value = false;
  if (!store.currentClassId) return;
  try {
    const seats = await api.seats.get(store.currentClassId);
    for (const s of seats) {
      grid[keyOf(s.row + 1, s.col + 1)] = { ...s };
    }
  } catch (e) {
    ElMessage.error('座位布局加载失败：' + e.message);
  }
}

watch(() => store.currentClassId, loadSeats);
onMounted(loadSeats);

function fmtV(v) { return v == null ? '' : Number(v).toFixed(1); }

/** 走道判定：0=无走道，1=中间走道，2=双走道（1/3 与 2/3 处） */
function isAisle(c) {
  const m = currentClass.value?.aisle_mode ?? 1;
  if (m === 0) return false;
  if (m === 2) return c === Math.ceil(cols.value / 3) || c === Math.ceil(cols.value * 2 / 3);
  return c === Math.ceil(cols.value / 2);
}

/* ---------- 选择/右键 ---------- */
function selectSeat(r, c) {
  selectedKey.value = keyOf(r, c);
}
function curSeat() { return grid[selectedKey.value] || grid[menuKey.value] || null; }
function openMenu(e, r, c) {
  menuKey.value = keyOf(r, c);
  if (!grid[menuKey.value]) grid[menuKey.value] = emptySeat(r - 1, c - 1);
  menu.x = e.clientX;
  menu.y = e.clientY;
  menuVisible.value = true;
}
function toggleLock() {
  const k = menuKey.value || selectedKey.value;
  if (!k || !grid[k]) return;
  grid[k].locked = !grid[k].locked;
  menuVisible.value = false;
  dirty.value = true;
}
function clearSeat() {
  const k = menuKey.value || selectedKey.value;
  if (!k || !grid[k]) return;
  grid[k].studentId = null;
  grid[k].name = '';
  grid[k].gender = '';
  grid[k].height_cm = null;
  grid[k].vision_left = null;
  grid[k].vision_right = null;
  grid[k].is_myopia = false;
  grid[k].grade_level = '';
  menuVisible.value = false;
  dirty.value = true;
}

/* ---------- 拖拽交换 ---------- */
function onDragStart(e, r, c) {
  e.dataTransfer.setData('text/plain', keyOf(r, c));
  e.dataTransfer.effectAllowed = 'move';
}
function onDrop(e, r, c) {
  dragOver.value = null;
  const sourceKey = e.dataTransfer.getData('text/plain');
  const targetKey = keyOf(r, c);
  if (!sourceKey || sourceKey === targetKey) return;
  const a = grid[sourceKey];
  const b = grid[targetKey];
  if (!a || !b) return;
  if (a.locked || b.locked) return ElMessage.warning('锁定座位不可拖拽/拖入');
  // 只交换学生相关字段（座位坐标、锁定状态不变）
  const fields = ['studentId', 'name', 'gender', 'height_cm', 'vision_left', 'vision_right', 'is_myopia', 'grade_level'];
  for (const f of fields) {
    const t = a[f]; a[f] = b[f]; b[f] = t;
  }
  dirty.value = true;
}

/* ---------- 自动排座 ---------- */
async function runAuto() {
  if (!store.currentClassId) return ElMessage.warning('请先创建班级');
  autoLoading.value = true;
  try {
    const r = await api.seats.auto({ classId: store.currentClassId, options: { ...autoOpts } });
    Object.keys(grid).forEach(k => delete grid[k]);
    for (const s of r.seats) {
      grid[keyOf(s.row + 1, s.col + 1)] = { ...s, studentId: s.studentId };
    }
    conflicts.value = r.conflicts || [];
    unplaced.value = r.unplaced || [];
    previewing.value = true;
    dirty.value = true;
    if (!r.conflicts.length) {
      ElMessage.success(`自动排座完成，${r.seats.length} 人全部入座！点右上角「保存布局」生效`);
    } else {
      ElMessage.warning(`自动排座完成，有 ${r.conflicts.length} 条冲突提示，可在下方查看并手动微调`);
    }
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    autoLoading.value = false;
  }
}

/* ---------- 平移 ---------- */
async function runShift() {
  if (!store.currentClassId) return ElMessage.warning('请先创建班级');
  shiftLoading.value = true;
  try {
    const r = await api.seats.shift({ classId: store.currentClassId, dr: shiftDr.value, dc: shiftDc.value });
    Object.keys(grid).forEach(k => delete grid[k]);
    for (const s of r.seats) {
      grid[keyOf(s.row + 1, s.col + 1)] = { ...s, studentId: s.studentId };
    }
    previewing.value = true;
    dirty.value = true;
    shiftDialog.value = false;
    if (r.warnings.length) ElMessage.warning('部分位置因锁定座位就近调整：' + r.warnings[0]);
    else ElMessage.success('已生成平移预览，确认后保存');
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    shiftLoading.value = false;
  }
}

/* ---------- 保存 ---------- */
async function saveLayout() {
  if (!store.currentClassId) return;
  const seats = [];
  for (const [k, s] of Object.entries(grid)) {
    if (s.studentId != null) {
      const [r, c] = k.split(',').map(Number);
      seats.push({ studentId: s.studentId, row: r - 1, col: c - 1, locked: !!s.locked });
    }
  }
  try {
    const remark = previewing.value ? '自动排座/轮换' : '';
    await api.seats.save({ classId: store.currentClassId, seats, remark });
    ElMessage.success(`已保存布局（${seats.length} 人）`);
    dirty.value = false;
    previewing.value = false;
    conflicts.value = [];
    unplaced.value = [];
    loadSeats();
  } catch (e) {
    ElMessage.error(e.message);
  }
}

/* ---------- 历史 ---------- */
async function openHistory() {
  if (!store.currentClassId) return;
  layouts.value = await api.seats.layouts(store.currentClassId);
  historyVisible.value = true;
}
async function viewLayout(row) {
  const d = await api.seats.layoutDetail(row.id);
  histDetail.value = d;
  historyVisible.value = false;
  historyDetailVisible.value = true;
}
function histName(r, c) {
  const k = keyOf(r, c);
  const s = (histDetail.value.seats || []).find(x => x.row === r - 1 && x.col === c - 1);
  return s && s.studentId != null ? histDetail.value.names[s.studentId] || '?' : '';
}
async function applyHistory() {
  Object.keys(grid).forEach(k => delete grid[k]);
  for (const s of histDetail.value.seats) {
    grid[keyOf(s.row + 1, s.col + 1)] = {
      studentId: s.studentId, row: s.row, col: s.col, locked: !!s.locked,
      name: s.studentId != null ? histDetail.value.names[s.studentId] || '' : '',
    };
  }
  historyDetailVisible.value = false;
  previewing.value = true;
  dirty.value = true;
  ElMessage.info('已载入历史布局，可修改后保存');
}
async function deleteLayout(row) {
  await ElMessageBox.confirm('删除这条历史记录？', '确认', { type: 'warning' });
  await api.seats.removeLayout(row.id);
  layouts.value = layouts.value.filter(l => l.id !== row.id);
}

function print() {
  window.print();
}
</script>

<style scoped>
/* ---------- 模式面板 ---------- */
.mode-panel {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  background: linear-gradient(90deg, #f0faf6, #f7fdfb);
  border: 1px solid #d5f0e6; border-radius: 12px;
  padding: 12px 16px; margin-bottom: 14px;
}
.panel-title { font-weight: 700; color: #2f8f7a; white-space: nowrap; }
.auto-opts { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.auto-panel { background: linear-gradient(90deg, #e6f9f5, #f2fcf9); }

/* ---------- 座位网格：校园薄荷风 + 中间走道 ---------- */
.seat-area { padding: 22px 8px 10px; overflow-x: auto; }
.podium {
  width: 250px; margin: 0 auto 18px; text-align: center;
  background: linear-gradient(90deg, #3ec6a8, #57d4bc);
  color: #fff; font-weight: 700; font-size: 15px; letter-spacing: 6px;
  border-radius: 999px; padding: 10px 0;
  box-shadow: 0 4px 12px rgba(62, 198, 168, .35);
}
.seat-grid { display: flex; flex-direction: column; gap: 10px; align-items: center; }
.row { display: flex; gap: 10px; }
.seat-wrap { flex: 0 0 clamp(84px, 11.5vw, 118px); }
.seat-wrap.aisle { margin-left: 30px; }

.seat {
  border: 2px solid #e2eee8; border-radius: 12px; padding: 8px 4px 7px;
  text-align: center; cursor: pointer; background: #fff;
  transition: transform .12s, box-shadow .12s, border-color .12s;
  user-select: none; min-height: 64px;
  display: flex; flex-direction: column; justify-content: center; gap: 3px;
}
.seat:hover { transform: translateY(-2px); box-shadow: 0 5px 14px rgba(62, 198, 168, .2); }
.seat.boy { background: #f0fbf7; border-color: #bfe8da; }
.seat.girl { background: #fdf3f4; border-color: #f3c9ce; }
.seat.locked { border-color: #f0b95c; background: #fffaf0; }
.seat.empty {
  border-style: dashed; border-color: #d8e7e0; background: #f7fbf9;
}
.seat.empty:hover { transform: none; box-shadow: none; cursor: default; }
.seat.selected { outline: 3px solid #3ec6a8; outline-offset: 1px; }
.seat.drag-over { background: #d9f5ee !important; border-color: #3ec6a8; outline: 2px dashed #3ec6a8; }

.s-name {
  font-weight: 700; font-size: 15px; line-height: 1.3; color: #33403c;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.s-meta { display: flex; gap: 4px; justify-content: center; align-items: center; flex-wrap: wrap; min-height: 20px; }
.chip {
  font-size: 11px; color: #3f6b5e; background: #e6f9f5;
  border-radius: 999px; padding: 1px 8px; line-height: 1.6; white-space: nowrap;
}
.chip-warn { background: #fff3e0; color: #c77700; }
.chip-lock { background: #fff7e6; color: #b8822e; }
.empty-text { color: #b9ccc3; font-weight: 400; font-size: 13px; }

/* 打印：卡片定宽、去装饰 */
@media print {
  .seat-wrap { flex-basis: 92px; }
  .seat-wrap.aisle { margin-left: 20px; }
  .seat { border-width: 1px; min-height: 52px; }
  .seat.boy, .seat.girl, .seat.locked { background: #fff; }
  .podium { box-shadow: none; background: #eee; color: #333; }
}

/* ---------- 右键菜单 ---------- */
.ctx-menu {
  position: fixed; z-index: 3000; background: #fff; border-radius: 10px;
  box-shadow: 0 6px 20px rgba(31, 80, 66, .16); padding: 4px 0; min-width: 150px;
  border: 1px solid #e0f0e9;
}
.ctx-title { padding: 8px 16px; font-weight: 700; font-size: 13px; border-bottom: 1px solid #eef7f3; color: #2f8f7a; }
.ctx-item { padding: 9px 16px; font-size: 13px; cursor: pointer; }
.ctx-item:hover { background: #f0faf6; color: #2f8f7a; }
</style>
