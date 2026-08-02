<template>
  <div class="page-card seats-workspace">
    <!-- 页头：与其他页面一致 -->
    <div class="page-head no-print">
      <div>
        <h2 class="page-head-title">座位管理</h2>
        <p class="page-head-desc">拖拽换座 · 自动排座（身高/视力/男女/互助）· 平移轮换 · 历史回看</p>
      </div>
    </div>
    <!-- 顶部：模式切换 + 状态 -->
    <div class="ws-top no-print">
      <el-radio-group v-model="mode" size="large">
        <el-radio-button value="manual">手动调整</el-radio-button>
        <el-radio-button value="auto">自动排座</el-radio-button>
      </el-radio-group>
      <div class="ws-status">
        <span class="text-muted">已入座 <b class="stat-num">{{ seatedCount }}</b> / {{ rows * cols }} 人 · 空座 {{ emptyCount }}</span>
        <el-tag v-if="dirty" type="warning" size="large" effect="dark">有未保存修改</el-tag>
        <el-button v-if="dirty" type="success" size="large" :icon="Check" @click="saveLayout">保存布局</el-button>
      </div>
    </div>

    <div class="ws-body">
      <!-- ===== 左侧控制面板 ===== -->
      <aside class="ws-panel no-print">
        <!-- 教室布局 -->
        <section class="panel-sec">
          <div class="panel-sec-title">教室布局</div>
          <el-radio-group v-model="layoutMode" size="small" @change="saveLayoutMode">
            <el-radio-button :value="0">均分</el-radio-button>
            <el-radio-button :value="1">中间走道</el-radio-button>
            <el-radio-button :value="2">双走道</el-radio-button>
          </el-radio-group>
          <div class="panel-row col">
            <div class="size-field">
              <span class="size-label">行数</span>
              <el-input-number v-model="layoutRows" :min="1" :max="15" size="small" @change="saveLayoutSize" />
            </div>
            <div class="size-field">
              <span class="size-label">列数</span>
              <el-input-number v-model="layoutCols" :min="1" :max="15" size="small" @change="saveLayoutSize" />
            </div>
          </div>
        </section>

        <!-- 自动排座规则 -->
        <section v-if="mode === 'auto'" class="panel-sec">
          <div class="panel-sec-title">排座规则</div>
          <div class="panel-row col">
            <el-switch v-model="autoOpts.myopiaCenter" active-text="近视坐中间" />
            <el-switch v-model="autoOpts.mixedGender" active-text="男女搭配" />
            <el-switch v-model="autoOpts.peerHelp" active-text="成绩互助" />
          </div>
          <el-button type="primary" class="panel-main-btn" size="large" :loading="autoLoading" :icon="MagicStick" @click="runAuto">
            开始自动排座
          </el-button>
        </section>

        <!-- 手动操作 -->
        <section v-else class="panel-sec">
          <div class="panel-sec-title">手动操作</div>
          <p class="text-muted" style="margin:0 0 8px">点击座位可安排学生 · 拖拽换座/移动 · 右键快捷操作</p>
          <template v-if="curSeat() && curSeat().studentId">
            <div class="panel-row">
              <el-tag type="info" round>已选：{{ curSeat().name }}</el-tag>
              <el-button size="small" :icon="curSeat().locked ? Unlock : Lock" @click="toggleLock">{{ curSeat().locked ? '解锁' : '锁定' }}</el-button>
            </div>
            <el-button size="small" type="danger" plain class="panel-main-btn" @click="clearSeat">设为空座</el-button>
          </template>
          <span v-else class="text-muted">尚未选中座位</span>
        </section>

        <!-- 常用操作 -->
        <section class="panel-sec">
          <div class="panel-sec-title">常用操作</div>
          <div class="panel-ops">
            <el-button :icon="Refresh" @click="shiftDialog = true">平移轮换</el-button>
            <el-button :icon="Clock" @click="openHistory">历史布局</el-button>
            <el-button :icon="Printer" @click="print">打印座位表</el-button>
          </div>
        </section>
      </aside>

      <!-- ===== 右侧画布 ===== -->
      <div class="ws-canvas">
        <!-- 提示横幅 -->
        <el-alert v-if="previewing" type="warning" :closable="false" class="no-print canvas-alert"
                  title="当前为预览结果，未保存。确认后点左上「保存布局」。" />
        <el-alert v-if="conflicts.length" type="info" :closable="true" class="no-print canvas-alert"
                  :title="`自动排座提示 ${conflicts.length} 条，可在手动模式微调`">
          <ul style="margin:6px 0 0;padding-left:18px">
            <li v-for="(c, i) in conflicts" :key="i">{{ c.message }}</li>
          </ul>
        </el-alert>
        <el-alert v-if="unplaced.length" type="error" :closable="false" class="no-print canvas-alert"
                  :title="`${unplaced.length} 人未入座（座位不足）：${unplaced.join('、')}`" />

        <div class="podium">讲 台</div>
        <!-- 图例：座位颜色含义 -->
        <div class="seat-legend no-print">
          <span class="lg-item"><i class="lg-dot lg-boy"></i>男生</span>
          <span class="lg-item"><i class="lg-dot lg-girl"></i>女生</span>
          <span class="lg-item"><i class="lg-dot lg-lock"></i>锁定</span>
          <span class="lg-item"><i class="lg-dot lg-empty"></i>空座</span>
        </div>
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
                    <span v-else-if="seat(r, c).vision_left" class="chip chip-ok">不近视</span>
                    <span v-if="seat(r, c).locked" class="chip chip-lock">锁定</span>
                  </div>
                </template>
                <div v-else class="s-name empty-text"><span class="empty-ph">空</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 座位安排弹窗 -->
    <el-dialog v-model="seatDialogVisible" title="座位安排" width="460px">
      <template v-if="seatDlg.key && grid[seatDlg.key]">
        <div class="seat-dlg-info">
          <b>第 {{ seatDlg.row }} 行 · 第 {{ seatDlg.col }} 列</b>
          <el-tag v-if="grid[seatDlg.key].studentId" type="success" size="large" round style="margin-left:10px">
            {{ grid[seatDlg.key].name }}（{{ grid[seatDlg.key].gender }}）
          </el-tag>
          <el-tag v-else type="info" size="large" round style="margin-left:10px">空座</el-tag>
          <div class="spacer"></div>
          <el-button v-if="grid[seatDlg.key].studentId" size="small" :icon="grid[seatDlg.key].locked ? Unlock : Lock" @click="toggleLockDlg">
            {{ grid[seatDlg.key].locked ? '解锁' : '锁定' }}
          </el-button>
          <el-button v-if="grid[seatDlg.key].studentId" size="small" type="danger" plain @click="removeFromSeat">移出座位</el-button>
        </div>
        <el-divider content-position="left">安排学生</el-divider>
        <div class="seat-dlg-place">
          <el-select v-model="seatDlg.studentId" filterable placeholder="选择未入座的学生" style="flex:1">
            <el-option v-for="s in unseatedStudents" :key="s.id" :value="s.id"
                       :label="`${s.name}（${s.school_no}，${s.height_cm ?? '?'}cm）`" />
          </el-select>
          <el-button type="primary" :disabled="!seatDlg.studentId" @click="placeStudent">放入此座</el-button>
        </div>
        <p v-if="!unseatedStudents.length" class="text-muted">所有在读学生都已入座；如需新学生，请先到「学生管理」添加</p>
        <p class="text-muted">小提示：拖拽有人的座位到空座 = 移动；拖到有人的座位 = 交换</p>
      </template>
    </el-dialog>

    <!-- 右键/选中菜单 -->
    <div v-if="menuVisible" class="ctx-menu no-print" :style="{ left: menu.x + 'px', top: menu.y + 'px' }">
      <div v-if="curSeat() && curSeat().studentId" class="ctx-title">{{ curSeat().name }}</div>
      <div class="ctx-item" @click="toggleLock"><el-icon style="vertical-align:-2px;margin-right:6px"><Lock /></el-icon>{{ curSeat() && curSeat().locked ? '解锁座位' : '锁定座位' }}</div>
      <div v-if="curSeat() && curSeat().studentId" class="ctx-item" @click="confirmClearSeat"><el-icon style="vertical-align:-2px;margin-right:6px"><Delete /></el-icon>设为空座</div>
      <div class="ctx-item" @click="menuVisible = false">关闭</div>
    </div>

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
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button class="mini-btn" size="small" @click="viewLayout(row)">查看/恢复</el-button>
            <el-button class="mini-btn mini-btn-del" size="small" @click="deleteLayout(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 历史布局详情 -->
    <el-dialog v-model="historyDetailVisible" :title="'历史布局：' + (histDetail.remark || '')" width="720px">
      <div class="seat-area" style="padding:10px">
        <div class="podium" style="margin-bottom:8px">讲 台</div>
        <div class="seat-grid">
          <div v-for="r in histRows" :key="r" class="row">
            <div v-for="c in histCols" :key="c" class="seat-wrap hist-wrap" :class="{ aisle: isAisle(c) }">
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
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { MagicStick, Refresh, Printer, Clock, Check, Lock, Unlock, Delete } from '@element-plus/icons-vue';
import { api } from '../api.js';
import { store, currentClass } from '../store.js';

const mode = ref('manual');       // manual | auto
const rows = computed(() => currentClass.value?.seat_rows || 6);
const cols = computed(() => currentClass.value?.seat_cols || 8);

const grid = reactive({});        // "r,c" -> seat
const students = ref([]);         // 在读学生（用于手动安排）
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

/* 教室布局设置（直接改班级配置） */
const layoutMode = ref(currentClass.value?.aisle_mode ?? 1);
const layoutRows = ref(currentClass.value?.seat_rows ?? 6);
const layoutCols = ref(currentClass.value?.seat_cols ?? 8);
watch(() => currentClass.value, (c) => {
  if (!c) return;
  layoutMode.value = c.aisle_mode ?? 1;
  layoutRows.value = c.seat_rows ?? 6;
  layoutCols.value = c.seat_cols ?? 8;
});
async function saveLayoutMode() {
  const m = layoutMode.value;
  if (!currentClass.value) return;
  try {
    await api.classes.update(currentClass.value.id, { ...currentClass.value, aisle_mode: m });
    currentClass.value.aisle_mode = m;
    ElMessage.success('教室布局已更新');
  } catch (e) {
    ElMessage.error(e.message);
    layoutMode.value = currentClass.value?.aisle_mode ?? 1;
  }
}
async function saveLayoutSize() {
  if (!currentClass.value) return;
  const r = layoutRows.value, c = layoutCols.value;
  const ok = await ElMessageBox.confirm(
    `将教室网格调整为 ${r} 行 × ${c} 列？当前未保存的排座会被清空（已保存的布局仍可在「历史布局」查看）。`,
    '调整教室布局', { type: 'warning' }
  ).catch(() => false);
  if (!ok) { layoutRows.value = currentClass.value.seat_rows; layoutCols.value = currentClass.value.seat_cols; return; }
  try {
    await api.classes.update(currentClass.value.id, {
      ...currentClass.value, seat_rows: r, seat_cols: c,
    });
    currentClass.value.seat_rows = r;
    currentClass.value.seat_cols = c;
    Object.keys(grid).forEach(k => delete grid[k]);
    initGrid();
    conflicts.value = [];
    unplaced.value = [];
    dirty.value = false;
    previewing.value = false;
    ElMessage.info('网格已调整，请重新排座（旧布局可在「历史布局」中查看）');
  } catch (e) {
    ElMessage.error(e.message);
  }
}

const shiftDialog = ref(false);
const shiftLoading = ref(false);
const shiftDr = ref(1);
const shiftDc = ref(0);

const historyVisible = ref(false);
const historyDetailVisible = ref(false);
const layouts = ref([]);
const histDetail = ref({ seats: [], names: {}, rows: 6, cols: 8 });
const histRows = computed(() => histDetail.value.rows || 6);
const histCols = computed(() => histDetail.value.cols || 8);

const seatDialogVisible = ref(false);
const seatDlg = ref({ row: 1, col: 1, key: null, studentId: null });

let loadSeq = 0; // 竞态防护（P1-13）

const keyOf = (r, c) => `${r},${c}`;

function seat(r, c) { return grid[keyOf(r, c)] || { studentId: null, row: r - 1, col: c - 1, locked: false }; }

/** 预初始化整个网格的空座（消除模板渲染副作用，P2-17） */
function initGrid() {
  for (let r = 1; r <= rows.value; r++) {
    for (let c = 1; c <= cols.value; c++) {
      const k = keyOf(r, c);
      if (!grid[k]) grid[k] = { studentId: null, row: r - 1, col: c - 1, locked: false };
    }
  }
}

function emptySeat(r, c) {
  return { studentId: null, row: r, col: c, locked: false };
}

async function loadSeats() {
  const seq = ++loadSeq;
  Object.keys(grid).forEach(k => delete grid[k]);
  conflicts.value = [];
  unplaced.value = [];
  dirty.value = false;
  previewing.value = false;
  if (!store.currentClassId) return;
  try {
    const [seats, stu] = await Promise.all([
      api.seats.get(store.currentClassId),
      api.students.list({ class_id: store.currentClassId, status: '在读' }),
    ]);
    if (seq !== loadSeq) return; // 过期响应丢弃
    students.value = stu;
    for (const s of seats) {
      grid[keyOf(s.row + 1, s.col + 1)] = { ...s, studentId: s.studentId ?? s.student_id };
    }
    initGrid();
  } catch (e) {
    if (seq === loadSeq) ElMessage.error('座位布局加载失败：' + e.message);
  }
}

watch(() => store.currentClassId, loadSeats);
onMounted(loadSeats);
// 同步未保存状态到全局（供顶栏切班级拦截，P1-1）
watch(dirty, v => { store.seatsDirty = v; });
onMounted(() => { store.seatsDirty = dirty.value; });

function fmtV(v) { return v == null ? '' : Number(v).toFixed(1); }

/** 走道判定：0=无走道，1=中间走道，2=双走道（1/3 与 2/3 处） */
function isAisle(c) {
  const m = currentClass.value?.aisle_mode ?? 1;
  if (m === 0) return false;
  if (m === 2) return c === Math.ceil(cols.value / 3) || c === Math.ceil(cols.value * 2 / 3);
  return c === Math.ceil(cols.value / 2);
}

/** 当前网格内的入座/空座统计 */
const seatedCount = computed(() => {
  let n = 0;
  for (const [k, s] of Object.entries(grid)) {
    const [r, c] = k.split(',').map(Number);
    if (r <= rows.value && c <= cols.value && s.studentId != null) n++;
  }
  return n;
});
const emptyCount = computed(() => rows.value * cols.value - seatedCount.value);

/* ---------- 选择/右键 ---------- */
const seatedIds = computed(() => new Set(Object.values(grid).map(s => s.studentId).filter(Boolean)));
const unseatedStudents = computed(() => students.value.filter(s => !seatedIds.value.has(s.id)));

function selectSeat(r, c) {
  const targetKey = keyOf(r, c);
  if (mode.value !== 'manual') { selectedKey.value = targetKey; return; }
  const sourceKey = selectedKey.value;
  const source = sourceKey ? grid[sourceKey] : null;
  const target = grid[targetKey];
  if (sourceKey && sourceKey !== targetKey && source?.studentId) {
    moveSeat(sourceKey, targetKey);
    return;
  }
  selectedKey.value = targetKey;
  if (!target?.studentId) {
    seatDlg.value = { row: r, col: c, key: targetKey, studentId: null };
    seatDialogVisible.value = true;
  } else {
    ElMessage.info('已选中该学生，请点击目标座位完成移动或交换');
  }
}
function placeStudent() {
  const k = seatDlg.value.key;
  const stu = students.value.find(s => s.id === seatDlg.value.studentId);
  if (!k || !grid[k] || !stu) return;
  const g = grid[k];
  if (g.studentId && g.studentId !== stu.id) {
    ElMessage.warning(`已把「${g.name}」换为「${stu.name}」`);
  }
  Object.assign(g, {
    studentId: stu.id, name: stu.name, gender: stu.gender,
    height_cm: stu.height_cm, vision_left: stu.vision_left, vision_right: stu.vision_right,
    is_myopia: stu.is_myopia, grade_level: stu.grade_level,
  });
  seatDlg.value.studentId = null;
  dirty.value = true;
  ElMessage.success(`已安排 ${stu.name} 到第 ${seatDlg.value.row} 行第 ${seatDlg.value.col} 列`);
}
function removeFromSeat() {
  const k = seatDlg.value.key;
  if (!k || !grid[k]) return;
  const g = grid[k];
  g.studentId = null; g.name = ''; g.gender = ''; g.height_cm = null;
  g.vision_left = null; g.vision_right = null; g.is_myopia = false; g.grade_level = '';
  dirty.value = true;
  ElMessage.success('已移出座位');
}
function toggleLockDlg() {
  const k = seatDlg.value.key;
  if (k && grid[k]) grid[k].locked = !grid[k].locked;
  dirty.value = true;
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
async function confirmClearSeat() {
  const k = menuKey.value || selectedKey.value;
  const s = grid[k];
  if (!k || !s || !s.studentId) return;
  const ok = await ElMessageBox.confirm(`把「${s.name}」设为空座？`, '设为空座', { type: 'warning' }).catch(() => false);
  if (!ok) return;
  clearSeat();
}

/* ---------- 拖拽交换 ---------- */
function onDragStart(e, r, c) {
  e.dataTransfer.setData('text/plain', keyOf(r, c));
  e.dataTransfer.effectAllowed = 'move';
}
function moveSeat(sourceKey, targetKey) {
  const source = grid[sourceKey];
  const target = grid[targetKey];
  if (!source || !target || !source.studentId || sourceKey === targetKey) return;
  if (source.locked || target.locked) return ElMessage.warning('锁定座位不可拖拽/拖入');
  const targetWasEmpty = !target.studentId;
  const fields = ['studentId', 'name', 'gender', 'height_cm', 'vision_left', 'vision_right', 'is_myopia', 'grade_level'];
  for (const field of fields) [source[field], target[field]] = [target[field], source[field]];
  selectedKey.value = targetKey;
  dirty.value = true;
  ElMessage.success(targetWasEmpty ? '已移动到空座，记得保存布局' : '已交换座位，记得保存布局');
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
  moveSeat(sourceKey, targetKey);
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
    initGrid();
    conflicts.value = r.conflicts || [];
    unplaced.value = r.unplaced || [];
    previewing.value = true;
    dirty.value = true;
    if (!r.conflicts.length) {
      ElMessage.success(`自动排座完成，${r.seats.length} 人全部入座！点左上角「保存布局」生效`);
    } else {
      ElMessage.warning(`自动排座完成，有 ${r.conflicts.length} 条冲突提示，可手动微调`);
    }
    nextTick(() => document.querySelector('.ws-canvas')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
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
    initGrid();
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
    if (s.studentId != null || s.locked) {
      const [r, c] = k.split(',').map(Number);
      seats.push({ studentId: s.studentId ?? null, row: r - 1, col: c - 1, locked: !!s.locked });
    }
  }
  try {
    // C 组：区分排座来源，rule_snapshot 记录真实规则
    const rule = previewing.value
      ? { auto: true, options: { ...autoOpts } }
      : { manual: true };
    const remark = previewing.value ? '自动排座/轮换' : '';
    await api.seats.save({ classId: store.currentClassId, seats, remark, rule });
    ElMessage.success(`已保存布局（${seats.filter(x => x.studentId != null).length} 人）`);
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
  try {
    layouts.value = await api.seats.layouts(store.currentClassId);
    historyVisible.value = true;
  } catch (e) {
    ElMessage.error('历史布局加载失败：' + e.message);
  }
}
async function viewLayout(row) {
  try {
    const d = await api.seats.layoutDetail(row.id);
    const hs = d.seats || [];
    const hRows = hs.length ? Math.max(...hs.map(s => s.row)) + 1 : rows.value;
    const hCols = hs.length ? Math.max(...hs.map(s => s.col)) + 1 : cols.value;
    histDetail.value = { ...d, rows: hRows, cols: hCols };
    historyVisible.value = false;
    historyDetailVisible.value = true;
  } catch (e) {
    ElMessage.error(e.message);
  }
}
function histName(r, c) {
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
  initGrid();
  historyDetailVisible.value = false;
  previewing.value = true;
  dirty.value = true;
  ElMessage.info('已载入历史布局，可修改后保存');
}
async function deleteLayout(row) {
  const ok = await ElMessageBox.confirm('删除这条历史记录？', '确认', { type: 'warning' }).catch(() => false);
  if (!ok) return;
  try {
    await api.seats.removeLayout(row.id);
    layouts.value = layouts.value.filter(l => l.id !== row.id);
  } catch (e) {
    ElMessage.error(e.message);
  }
}

function print() {
  window.print();
}

/* ---------- 右键菜单：点击外部关闭（P1-8） ---------- */
function onDocClick() { menuVisible.value = false; }
onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));

/* ---------- 离开拦截：未保存修改时提醒 ---------- */
onBeforeRouteLeave(async () => {
  if (!dirty.value) return true;
  try {
    await ElMessageBox.confirm('当前座位有未保存的修改，确定离开吗？', '未保存提示', {
      type: 'warning', confirmButtonText: '仍要离开', cancelButtonText: '留下',
    });
    return true;
  } catch {
    return false;
  }
});
</script>

<style scoped>
/* ============ 工作台布局 ============ */
.seats-workspace { padding: 0; display: flex; flex-direction: column; }
.ws-top {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px; border-bottom: 3px dashed #d9cbb0; flex-wrap: wrap; gap: 10px;
}
.ws-status { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.stat-num { color: var(--tomato); font-size: 16px; font-weight: 900; }
.ws-body { display: flex; min-height: 72vh; }

/* 左侧面板 */
.ws-panel {
  width: 250px; flex-shrink: 0;
  border-right: 3px dashed #d9cbb0;
  padding: 14px; display: flex; flex-direction: column; gap: 12px;
  background: var(--paper-soft); overflow-y: auto; max-height: calc(100vh - 120px);
  position: sticky; top: 0;
}
.panel-sec {
  background: #fff; border: 3px solid var(--ink); border-radius: 14px; padding: 12px;
  box-shadow: var(--shadow-xs);
}
.panel-sec-title { font-size: 13px; font-weight: 900; color: var(--tomato); margin-bottom: 10px; }
.size-field { display: flex; align-items: center; gap: 10px; width: 100%; }
.size-label { width: 34px; font-size: 13px; color: var(--muted); font-weight: 700; flex-shrink: 0; }
.size-field .el-input-number { width: 130px; }
.panel-row { display: flex; gap: 8px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
.panel-row.col { flex-direction: column; align-items: flex-start; gap: 10px; }
.panel-main-btn { width: 100%; margin-top: 12px; }
.panel-ops { display: flex; flex-direction: column; gap: 8px; }
.panel-ops .el-button { margin-left: 0; }

/* 右侧画布 */
.ws-canvas {
  flex: 1; padding: 22px 16px 30px; overflow: auto;
  display: flex; flex-direction: column; align-items: center;
}
.canvas-alert { width: 100%; max-width: 900px; margin-bottom: 10px; }

/* ============ 座位网格 ============ */
.podium {
  width: 250px; margin: 4px auto 18px; text-align: center;
  background: var(--mustard);
  border: 3px solid var(--ink);
  color: var(--ink); font-weight: 900; font-size: 15px; letter-spacing: 6px;
  border-radius: 999px; padding: 6px 0;
  box-shadow: var(--shadow-sm);
}
.seat-grid { display: flex; flex-direction: column; gap: 10px; align-items: center; }
.row { display: flex; gap: 10px; }
.seat-wrap { flex: 0 0 clamp(76px, 9.5vw, 104px); }
.seat-wrap.aisle { margin-left: 30px; }
/* 历史弹窗内限宽，避免溢出（P1-9） */
.seat-wrap.hist-wrap { flex-basis: 84px; }
.hist-wrap.aisle { margin-left: 18px; }

.seat {
  border: 2px solid var(--ink); border-radius: 12px; padding: 8px 4px 7px;
  text-align: center; cursor: pointer; background: #fff;
  transition: transform .12s, box-shadow .12s, border-color .12s;
  user-select: none; min-height: 78px;
  display: flex; flex-direction: column; justify-content: center; gap: 3px;
}
.seat:hover { transform: translateY(-2px); box-shadow: var(--shadow-xs); }
.seat.boy { background: #e7f8f3; border-color: var(--mint); }
.seat.girl { background: #fdeeea; border-color: var(--tomato); }
.seat.locked { border-color: var(--mustard); background: var(--paper); }
.seat.empty {
  border-style: dashed; border-color: #b0a48d; background: #f6efe1;
}
.seat.empty:hover { transform: none; box-shadow: none; cursor: default; }
.seat.selected { outline: 3px solid var(--tomato); outline-offset: 1px; }
.seat.drag-over { background: var(--mustard) !important; border-color: var(--mustard); outline: 3px dashed var(--tomato); }

.s-name {
  font-weight: 800; font-size: 15px; line-height: 1.3; color: var(--ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.s-meta { display: flex; gap: 4px; justify-content: center; align-items: center; flex-wrap: wrap; min-height: 20px; }
.chip {
  font-size: 11px; color: var(--ink); background: var(--mint);
  border: 2px solid var(--ink);
  border-radius: 999px; padding: 1px 8px; line-height: 1.6; white-space: nowrap;
  font-weight: 800;
}
.chip-warn { background: var(--mustard); color: var(--ink); }
.chip-ok { background: var(--mint); color: var(--ink); }
.chip-lock { background: var(--mustard); color: var(--ink); }
.empty-text { color: #b0a48d; font-weight: 400; font-size: 13px; }
.empty-ph { display: block; padding: 14px 0; }

/* 图例 */
.seat-legend {
  display: flex; justify-content: center; gap: 18px;
  margin: 2px auto 12px;
  padding: 6px 14px;
  background: rgba(255, 249, 234, .85);
  border: 2px dashed var(--ink);
  border-radius: 999px;
  flex-wrap: wrap;
}
.lg-item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; color: var(--muted); }
.lg-dot { width: 16px; height: 16px; border-radius: 5px; border: 2px solid var(--ink); display: inline-block; }
.lg-boy { background: #e7f8f3; }
.lg-girl { background: #fdeeea; }
.lg-lock { background: var(--mustard); }
.lg-empty { background: #f6efe1; border-style: dashed; }

/* 打印：卡片定宽、去装饰 */
@media print {
  .ws-panel, .no-print { display: none !important; }
  .ws-canvas { padding: 0; }
  .seat-wrap { flex-basis: 92px; }
  .seat-wrap.aisle { margin-left: 20px; }
  .seat { border-width: 1px; min-height: 52px; }
  .seat.boy, .seat.girl, .seat.locked { background: #fff; }
  .seat.empty .s-name { display: none; } /* 打印不显示"空"字（P2-8） */
  .podium { box-shadow: none; background: #eee; color: #333; }
}

/* ---------- 座位安排弹窗 / 右键菜单 ---------- */
.seat-dlg-info { display: flex; align-items: center; }
.seat-dlg-place { display: flex; gap: 10px; align-items: center; }
.ctx-menu {
  position: fixed; z-index: 3000; background: #fff; border-radius: 14px;
  box-shadow: var(--shadow-sm); padding: 4px 0; min-width: 150px;
  border: 3px solid var(--ink);
}
.ctx-title { padding: 8px 16px; font-weight: 900; font-size: 13px; border-bottom: 3px dashed #d9cbb0; color: var(--tomato); }
.ctx-item { padding: 9px 16px; font-size: 13px; cursor: pointer; font-weight: 700; }
.ctx-item:hover { background: var(--mustard); color: var(--ink); }

/* ---------- 响应式：窄屏面板置顶横排 ---------- */
@media (max-width: 900px) {
  .ws-body { flex-direction: column; }
  .ws-panel {
    width: 100%; flex-shrink: 1;
    border-right: none; border-bottom: 3px dashed #d9cbb0;
    max-height: none; position: static;
    flex-direction: row; flex-wrap: wrap;
    align-items: flex-start;
  }
  .panel-sec { flex: 1 1 200px; }
  .seat-wrap { flex-basis: clamp(64px, 12vw, 90px); }
  .seat-wrap.aisle { margin-left: 12px; }
}
</style>
