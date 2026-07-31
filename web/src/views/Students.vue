<template>
  <div class="page-card">
    <!-- 页头 -->
    <div class="page-head">
      <div>
        <h2 class="page-head-title">学生管理</h2>
        <p class="page-head-desc">维护全班学生档案，支持 Excel 批量导入导出与回收站恢复</p>
      </div>
      <div class="page-head-actions">
        <el-button type="primary" :icon="Plus" @click="openEdit()">新增学生</el-button>
        <el-button :icon="Upload" @click="fileInput.click()">导入 Excel</el-button>
        <el-button :icon="Files" @click="exportExcel">导出 Excel</el-button>
      </div>
    </div>

    <!-- 工具栏：搜索/筛选 -->
    <div class="toolbar">
      <el-input v-model="query.keyword" placeholder="搜索姓名/学号" clearable style="width:200px"
                :prefix-icon="Search" @input="debouncedLoad" />
      <el-select v-model="query.gender" placeholder="性别" clearable style="width:100px" @change="load">
        <el-option label="男" value="男" /><el-option label="女" value="女" />
      </el-select>
      <el-select v-model="query.status" placeholder="状态" clearable style="width:110px" @change="load">
        <el-option label="在读" value="在读" /><el-option label="转出" value="转出" /><el-option label="休学" value="休学" />
      </el-select>
      <el-select v-model="query.myopia" placeholder="近视" clearable style="width:90px" @change="load">
        <el-option label="是" value="1" /><el-option label="否" value="0" />
      </el-select>
      <el-select v-model="query.boarding" placeholder="住宿" clearable style="width:90px" @change="load">
        <el-option label="是" value="1" /><el-option label="否" value="0" />
      </el-select>
      <div class="spacer"></div>
      <el-button :icon="Download" @click="downloadTemplate">下载导入模板</el-button>
      <el-button v-if="!trashed" :icon="Delete" type="danger" plain @click="batchDelete"
                 :disabled="!selected.length">批量删除</el-button>
      <el-button v-if="trashed" :icon="RefreshLeft" @click="batchRestore" :disabled="!selected.length">恢复</el-button>
      <el-button v-if="trashed" :icon="DeleteFilled" type="danger" plain @click="batchPurge"
                 :disabled="!selected.length">彻底删除</el-button>
      <el-button @click="toggleTrash">{{ trashed ? '返回列表' : '回收站' }}</el-button>
      <input ref="fileInput" type="file" accept=".xlsx,.xls" style="display:none" @change="onFileChange" />
    </div>

    <el-table :data="pagedList" stripe @selection-change="onSelection"
              @row-click="(row, column) => column.type !== 'selection' && openDetail(row)" style="cursor:pointer">
      <template #empty><el-empty description="暂无学生，点右上角「新增学生」或导入 Excel" :image-size="60" /></template>
      <el-table-column type="selection" width="40" />
      <el-table-column prop="school_no" label="学号" min-width="90" show-overflow-tooltip />
      <el-table-column prop="name" label="姓名" min-width="90" show-overflow-tooltip>
        <template #default="{ row }"><b>{{ row.name }}</b></template>
      </el-table-column>
      <el-table-column prop="gender" label="性别" width="60" />
      <el-table-column prop="height_cm" label="身高(cm)" width="85" />
      <el-table-column label="视力" width="110">
        <template #default="{ row }">
          <span :class="{ 'vision-bad': row.vision_left != null && row.vision_left < 4.8 }">{{ fmtVision(row.vision_left) }}</span>
          /
          <span :class="{ 'vision-bad': row.vision_right != null && row.vision_right < 4.8 }">{{ fmtVision(row.vision_right) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="近视" width="60">
        <template #default="{ row }"><el-tag v-if="row.is_myopia" size="small" type="warning">是</el-tag></template>
      </el-table-column>
      <el-table-column prop="grade_level" label="成绩" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.grade_level" size="small" :type="gradeType(row.grade_level)">{{ row.grade_level }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="住宿" width="60">
        <template #default="{ row }"><el-tag v-if="row.is_boarding" size="small" round>住宿</el-tag></template>
      </el-table-column>
      <el-table-column prop="parent_phone" label="家长电话" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.parent_phone || row.phone || '—' }}</template>
      </el-table-column>
      <el-table-column prop="interest_duty" label="职务/特长" min-width="110" show-overflow-tooltip>
        <template #default="{ row }">{{ row.interest_duty || '—' }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="70">
        <template #default="{ row }">
          <el-tag v-if="row.status !== '在读'" size="small" type="info">{{ row.status }}</el-tag>
          <span v-else class="text-muted">在读</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <template v-if="!trashed">
            <el-button class="row-btn" size="small" @click.stop="openDetail(row)">详情</el-button>
            <el-button class="row-btn row-btn-edit" size="small" @click.stop="openEdit(row)">编辑</el-button>
            <el-button class="row-btn row-btn-del" size="small" @click.stop="removeOne(row)">删除</el-button>
          </template>
          <template v-else>
            <el-button class="row-btn row-btn-edit" size="small" @click.stop="batchRestore([row.id])">恢复</el-button>
            <el-button class="row-btn row-btn-del" size="small" @click.stop="batchPurge([row.id])">删除</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; flex-wrap:wrap; gap:8px">
      <div class="text-muted">共 {{ list.length }} 人 · 点击行或「详情」查看档案</div>
      <el-pagination v-if="list.length > PAGE_SIZE" background layout="prev, pager, next" :total="list.length"
                     :page-size="PAGE_SIZE" :current-page="page" @current-change="p => page = p" />
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="editVisible" :title="form.id ? '编辑学生' : '新增学生'" width="640px" destroy-on-close>
      <el-form :model="form" label-width="110px">
        <el-tabs>
          <el-tab-pane label="基本信息">
            <el-form-item label="学号"><el-input v-model="form.school_no" placeholder="全校唯一学号，可留空" /></el-form-item>
            <el-form-item label="姓名" required><el-input v-model="form.name" /></el-form-item>
            <el-form-item label="性别">
              <el-radio-group v-model="form.gender"><el-radio value="男">男</el-radio><el-radio value="女">女</el-radio></el-radio-group>
            </el-form-item>
            <el-form-item label="出生日期"><el-date-picker v-model="form.birth_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
            <el-form-item label="联系电话"><el-input v-model="form.phone" /></el-form-item>
            <el-form-item label="家长电话"><el-input v-model="form.parent_phone" /></el-form-item>
            <el-form-item label="是否住宿"><el-switch v-model="form.is_boarding" /></el-form-item>
            <el-form-item label="状态">
              <el-select v-model="form.status" style="width:120px">
                <el-option label="在读" value="在读" /><el-option label="转出" value="转出" /><el-option label="休学" value="休学" />
              </el-select>
            </el-form-item>
          </el-tab-pane>
          <el-tab-pane label="健康与排座">
            <el-form-item label="身高(cm)"><el-input-number v-model="form.height_cm" :min="80" :max="230" /></el-form-item>
            <el-form-item label="左眼视力"><el-input-number v-model="form.vision_left" :min="3.0" :max="5.3" :step="0.1" :precision="1" /></el-form-item>
            <el-form-item label="右眼视力"><el-input-number v-model="form.vision_right" :min="3.0" :max="5.3" :step="0.1" :precision="1" /></el-form-item>
            <el-form-item label="是否近视"><el-switch v-model="form.is_myopia" /></el-form-item>
            <el-form-item label="成绩等级">
              <el-select v-model="form.grade_level" clearable style="width:140px">
                <el-option label="优" value="优" /><el-option label="良" value="良" />
                <el-option label="中" value="中" /><el-option label="待提高" value="待提高" />
              </el-select>
            </el-form-item>
            <el-form-item label="特殊座位需求"><el-input v-model="form.seat_note" placeholder="如：必须坐前排、避免与XX相邻" /></el-form-item>
            <el-form-item label="健康状况"><el-input v-model="form.health_note" placeholder="过敏、哮喘等" /></el-form-item>
          </el-tab-pane>
          <el-tab-pane label="其他">
            <el-form-item label="兴趣特长/职务"><el-input v-model="form.interest_duty" placeholder="班长、课代表、绘画特长…" /></el-form-item>
            <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="3" /></el-form-item>
          </el-tab-pane>
        </el-tabs>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" :title="detail.name" size="560px">
      <template v-if="detail.id">
        <!-- 健康概览：身高/视力一眼可见 -->
        <div class="health-strip">
          <div class="hs-item">
            <span class="hs-label">身高</span>
            <b class="hs-value">{{ detail.height_cm ?? '—' }}<small>cm</small></b>
          </div>
          <div class="hs-item">
            <span class="hs-label">左眼</span>
            <b class="hs-value" :class="{ 'hs-bad': detail.vision_left != null && detail.vision_left < 4.8 }">{{ fmtVision(detail.vision_left) }}</b>
          </div>
          <div class="hs-item">
            <span class="hs-label">右眼</span>
            <b class="hs-value" :class="{ 'hs-bad': detail.vision_right != null && detail.vision_right < 4.8 }">{{ fmtVision(detail.vision_right) }}</b>
          </div>
          <div class="hs-item">
            <span class="hs-label">近视</span>
            <b class="hs-value">{{ detail.is_myopia ? '是' : '否' }}</b>
          </div>
          <div class="hs-item">
            <span class="hs-label">成绩</span>
            <b class="hs-value">{{ detail.grade_level || '—' }}</b>
          </div>
        </div>

        <el-tabs v-model="detailTab">
          <el-tab-pane label="基本信息" name="info">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="学号">{{ detail.school_no || '—' }}</el-descriptions-item>
              <el-descriptions-item label="性别">{{ detail.gender }}</el-descriptions-item>
              <el-descriptions-item label="成绩">{{ detail.grade_level || '—' }}</el-descriptions-item>
              <el-descriptions-item label="状态">{{ detail.status }}</el-descriptions-item>
              <el-descriptions-item label="住宿">{{ detail.is_boarding ? '是' : '否' }}</el-descriptions-item>
              <el-descriptions-item label="近视">{{ detail.is_myopia ? '是' : '否' }}</el-descriptions-item>
              <el-descriptions-item label="出生日期">{{ detail.birth_date || '—' }}</el-descriptions-item>
              <el-descriptions-item label="联系电话">{{ detail.phone || '—' }}</el-descriptions-item>
              <el-descriptions-item label="家长电话">{{ detail.parent_phone || '—' }}</el-descriptions-item>
              <el-descriptions-item label="职务/特长">{{ detail.interest_duty || '—' }}</el-descriptions-item>
              <el-descriptions-item label="健康状况" :span="2">{{ detail.health_note || '—' }}</el-descriptions-item>
              <el-descriptions-item label="座位需求" :span="2">{{ detail.seat_note || '—' }}</el-descriptions-item>
              <el-descriptions-item label="备注" :span="2">{{ detail.remark || '—' }}</el-descriptions-item>
            </el-descriptions>
          </el-tab-pane>

          <el-tab-pane label="身高视力历史" name="metrics">
            <el-table :data="metrics" size="small" border>
              <el-table-column prop="term" label="学期" />
              <el-table-column prop="height_cm" label="身高" />
              <el-table-column label="视力">
                <template #default="{ row }">{{ fmtVision(row.vision_left) }}/{{ fmtVision(row.vision_right) }}</template>
              </el-table-column>
              <el-table-column prop="grade_level" label="成绩" />
              <el-table-column prop="recorded_at" label="记录时间" width="130">
                <template #default="{ row }">{{ (row.recorded_at || '').slice(0, 16).replace('T', ' ') }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="成长档案" name="records">
            <div class="toolbar" style="margin-bottom:8px">
              <span class="text-muted">奖励 / 批评 / 评语 / 表现记录</span>
              <div class="spacer"></div>
              <el-button size="small" type="primary" @click="openRecord()">添加记录</el-button>
            </div>
            <div v-if="records.length" class="record-list">
              <div v-for="r in records" :key="r.id" class="record-item">
                <el-tag size="small" :type="recType(r.type)" round>{{ r.type }}</el-tag>
                <div class="rec-content">{{ r.content }}</div>
                <div class="rec-meta">{{ r.date || '—' }}</div>
                <el-button class="mini-btn" size="small" @click="openRecord(r)">编</el-button>
                <el-button class="mini-btn mini-btn-del" size="small" @click="removeRecord(r)">删</el-button>
              </div>
            </div>
            <el-empty v-else description="暂无成长记录" :image-size="50" />
          </el-tab-pane>

          <el-tab-pane label="家校沟通" name="contacts">
            <div class="toolbar" style="margin-bottom:8px">
              <span class="text-muted">家访 / 电话 / 微信沟通台账</span>
              <div class="spacer"></div>
              <el-button size="small" type="primary" @click="openContact()">添加沟通</el-button>
            </div>
            <div v-if="contacts.length" class="record-list">
              <div v-for="c in contacts" :key="c.id" class="record-item">
                <el-tag size="small" type="info" round>{{ c.method || '—' }}</el-tag>
                <div class="rec-content">
                  <div><b>{{ c.topic || '（未填事由）' }}</b></div>
                  <div class="text-muted" v-if="c.result">{{ c.result }}</div>
                </div>
                <div class="rec-meta">{{ c.date || '—' }}</div>
                <el-button class="mini-btn" size="small" @click="openContact(c)">编</el-button>
                <el-button class="mini-btn mini-btn-del" size="small" @click="removeContact(c)">删</el-button>
              </div>
            </div>
            <el-empty v-else description="暂无沟通记录" :image-size="50" />
          </el-tab-pane>
        </el-tabs>
      </template>
    </el-drawer>

    <!-- 成长记录弹窗 -->
    <el-dialog v-model="recordDialogVisible" :title="recordForm.id ? '编辑成长记录' : '添加成长记录'" width="440px">
      <el-form label-width="60px">
        <el-form-item label="类型">
          <el-select v-model="recordForm.type" style="width:150px">
            <el-option label="奖励" value="奖励" /><el-option label="批评" value="批评" />
            <el-option label="评语" value="评语" /><el-option label="表现" value="表现" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容" required><el-input v-model="recordForm.content" type="textarea" :rows="3" placeholder="记录内容" /></el-form-item>
        <el-form-item label="日期"><el-date-picker v-model="recordForm.date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="recordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRecord">保存</el-button>
      </template>
    </el-dialog>

    <!-- 家校沟通弹窗 -->
    <el-dialog v-model="contactDialogVisible" :title="contactForm.id ? '编辑家校沟通' : '添加家校沟通'" width="440px">
      <el-form label-width="60px">
        <el-form-item label="方式">
          <el-select v-model="contactForm.method" style="width:150px">
            <el-option v-for="m in ['家访','电话','微信','到校面谈','其他']" :key="m" :value="m" :label="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期"><el-date-picker v-model="contactForm.date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="事由"><el-input v-model="contactForm.topic" placeholder="如：反馈期中成绩" /></el-form-item>
        <el-form-item label="结果"><el-input v-model="contactForm.result" type="textarea" :rows="2" placeholder="沟通结果/家长反馈" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="contactDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveContact">保存</el-button>
      </template>
    </el-dialog>

    <!-- 导入预览 -->
    <el-dialog v-model="importVisible" title="导入预览" width="620px">
      <el-alert type="info" :closable="false" style="margin-bottom:10px"
                :title="`解析到 ${parsed.length} 行，其中 ${parsedFail.length} 行有误（有误的行会跳过）`" />
      <el-table :data="parsed" size="small" max-height="320" border>
        <el-table-column prop="_row" label="行" width="50" />
        <el-table-column prop="school_no" label="学号" width="90" />
        <el-table-column prop="name" label="姓名" width="80" />
        <el-table-column prop="gender" label="性别" width="50" />
        <el-table-column prop="height_cm" label="身高" width="70" />
        <el-table-column prop="vision_left" label="左眼" width="60" />
        <el-table-column prop="vision_right" label="右眼" width="60" />
      </el-table>
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="doImport">确认导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Plus, Download, Upload, Files, Delete, DeleteFilled, RefreshLeft } from '@element-plus/icons-vue';
import ExcelJS from 'exceljs';
import { api } from '../api.js';
import { store } from '../store.js';
import { useSeqLoad } from '../composables/useSeqLoad.js';

// 每个数据域独立计数器，避免并发 load 相互作废
const listSeq = useSeqLoad();
const detailSeq = useSeqLoad();

const route = useRoute();

const TEMPLATE_COLS = [
  { key: 'school_no', title: '学号', width: 12 },
  { key: 'name', title: '姓名*', width: 10 },
  { key: 'gender', title: '性别(男/女)', width: 12 },
  { key: 'birth_date', title: '出生日期', width: 12 },
  { key: 'phone', title: '联系电话', width: 14 },
  { key: 'parent_phone', title: '家长电话', width: 14 },
  { key: 'is_boarding', title: '是否住宿(是/否)', width: 14 },
  { key: 'interest_duty', title: '兴趣特长/职务', width: 14 },
  { key: 'health_note', title: '健康状况/过敏史', width: 16 },
  { key: 'height_cm', title: '身高cm', width: 10 },
  { key: 'vision_left', title: '左眼视力', width: 10 },
  { key: 'vision_right', title: '右眼视力', width: 10 },
  { key: 'is_myopia', title: '是否近视(是/否)', width: 14 },
  { key: 'grade_level', title: '成绩等级(优/良/中/待提高)', width: 22 },
  { key: 'seat_note', title: '特殊座位需求', width: 16 },
  { key: 'remark', title: '备注', width: 14 },
];

const list = ref([]);
const selected = ref([]);
const trashed = ref(false);
const fileInput = ref(null);
const query = reactive({ keyword: '', gender: '', status: '', myopia: '', boarding: '' });

/* 前端分页：大列表不一次性渲染全部行 */
const PAGE_SIZE = 50;
const page = ref(1);
const pagedList = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE;
  return list.value.slice(start, start + PAGE_SIZE);
});

const editVisible = ref(false);
const form = ref(emptyForm());
const detailVisible = ref(false);
const detail = ref({});
const metrics = ref([]);
const detailTab = ref('info');
const records = ref([]);
const contacts = ref([]);
const recordDialogVisible = ref(false);
const recordForm = ref({ id: null, type: '表现', content: '', date: '', remark: '' });
const contactDialogVisible = ref(false);
const contactForm = ref({ id: null, date: '', method: '电话', topic: '', result: '', remark: '' });

const importVisible = ref(false);
const parsed = ref([]);
const parsedFail = ref([]);
const importing = ref(false);

let debounceTimer = null;
function debouncedLoad() { clearTimeout(debounceTimer); debounceTimer = setTimeout(load, 300); }
onBeforeUnmount(() => clearTimeout(debounceTimer));

function emptyForm() {
  return {
    id: null, school_no: '', name: '', gender: '男', birth_date: '', phone: '', parent_phone: '',
    is_boarding: false, interest_duty: '', health_note: '', height_cm: null, vision_left: null,
    vision_right: null, is_myopia: false, grade_level: '', seat_note: '', status: '在读', remark: '',
  };
}

async function load() {
  if (!store.currentClassId) { list.value = []; return; }
  const mySeq = listSeq.seq();
  try {
    const q = { class_id: store.currentClassId, ...query, trashed: trashed.value ? '1' : '0' };
    const data = await api.students.list(q);
    if (listSeq.isStale(mySeq)) return;
    list.value = data;
    page.value = 1; // 筛选/搜索/切班后回到第 1 页
  } catch (e) {
    ElMessage.error('学生列表加载失败：' + e.message);
  }
}

watch(() => store.currentClassId, load);
// 顶栏全局搜索跳转：读取 ?kw= 填入搜索框
watch(() => route.query.kw, kw => {
  if (kw) { query.keyword = kw; load(); }
});
onMounted(() => {
  if (route.query.kw) query.keyword = String(route.query.kw);
  load();
});

function onSelection(rows) { selected.value = rows.map(r => r.id); }
function openDetail(row) {
  detail.value = row;
  detailTab.value = 'info';
  detailVisible.value = true;
  const mySeq = detailSeq.seq();
  api.students.metrics(row.id).then(m => { if (!detailSeq.isStale(mySeq)) metrics.value = m; }).catch(() => {});
  api.records.list(row.id).then(r => { if (!detailSeq.isStale(mySeq)) records.value = r; }).catch(() => {});
  api.records.contacts(row.id).then(c => { if (!detailSeq.isStale(mySeq)) contacts.value = c; }).catch(() => {});
}
function recType(t) {
  return { 奖励: 'success', 批评: 'danger', 评语: 'primary', 表现: 'warning', 其他: 'info' }[t] || 'info';
}
/* 成长记录：新增 / 编辑（传入记录则预填） */
function openRecord(r) {
  recordForm.value = r
    ? { id: r.id, type: r.type || '表现', content: r.content || '', date: r.date || '', remark: r.remark || '' }
    : { id: null, type: '表现', content: '', date: '', remark: '' };
  recordDialogVisible.value = true;
}
async function saveRecord() {
  if (!recordForm.value.content.trim()) return ElMessage.warning('请填写记录内容');
  try {
    if (recordForm.value.id) {
      await api.records.update(detail.value.id, recordForm.value.id, recordForm.value);
    } else {
      await api.records.create(detail.value.id, recordForm.value);
    }
    ElMessage.success('已保存');
    recordDialogVisible.value = false;
    records.value = await api.records.list(detail.value.id);
  } catch (e) { ElMessage.error('保存失败：' + e.message); }
}
async function removeRecord(r) {
  const ok = await ElMessageBox.confirm('删除这条记录？', '确认', { type: 'warning' }).catch(() => false);
  if (!ok) return;
  try {
    await api.records.remove(detail.value.id, r.id);
    records.value = await api.records.list(detail.value.id);
  } catch (e) { ElMessage.error('删除失败：' + e.message); }
}
/* 家校沟通：新增 / 编辑（传入记录则预填） */
function openContact(c) {
  contactForm.value = c
    ? { id: c.id, date: c.date || '', method: c.method || '电话', topic: c.topic || '', result: c.result || '', remark: c.remark || '' }
    : { id: null, date: '', method: '电话', topic: '', result: '', remark: '' };
  contactDialogVisible.value = true;
}
async function saveContact() {
  try {
    if (contactForm.value.id) {
      await api.records.updateContact(detail.value.id, contactForm.value.id, contactForm.value);
    } else {
      await api.records.addContact(detail.value.id, contactForm.value);
    }
    ElMessage.success('已保存');
    contactDialogVisible.value = false;
    contacts.value = await api.records.contacts(detail.value.id);
  } catch (e) { ElMessage.error('保存失败：' + e.message); }
}
async function removeContact(c) {
  const ok = await ElMessageBox.confirm('删除这条沟通记录？', '确认', { type: 'warning' }).catch(() => false);
  if (!ok) return;
  try {
    await api.records.removeContact(detail.value.id, c.id);
    contacts.value = await api.records.contacts(detail.value.id);
  } catch (e) { ElMessage.error('删除失败：' + e.message); }
}
function toggleTrash() { trashed.value = !trashed.value; selected.value = []; load(); }

function openEdit(row) {
  form.value = row ? { ...row } : emptyForm();
  editVisible.value = true;
}

async function saveEdit() {
  if (!form.value.name || !form.value.name.trim()) return ElMessage.warning('请填写姓名');
  const f = { ...form.value, is_boarding: form.value.is_boarding ? 1 : 0, is_myopia: form.value.is_myopia ? 1 : 0 };
  try {
    if (f.id) await api.students.update(f.id, f);
    else await api.students.create({ ...f, class_id: store.currentClassId });
    ElMessage.success('已保存');
    editVisible.value = false;
    load();
  } catch (e) { ElMessage.error(e.message); }
}

async function removeOne(row) {
  const ok = await ElMessageBox.confirm(`确定把「${row.name}」移入回收站？`, '删除确认', { type: 'warning' }).catch(() => false);
  if (!ok) return;
  try {
    await api.students.remove(row.id);
    ElMessage.success('已移入回收站');
    load();
  } catch (e) { ElMessage.error('删除失败：' + e.message); }
}

async function batchDelete() {
  const ok = await ElMessageBox.confirm(`确定删除选中的 ${selected.value.length} 名学生？`, '批量删除', { type: 'warning' }).catch(() => false);
  if (!ok) return;
  try {
    await Promise.all(selected.value.map(id => api.students.remove(id))); // 并行（P2-15）
    ElMessage.success('已删除');
    load();
  } catch (e) { ElMessage.error('批量删除失败：' + e.message); }
}
async function batchRestore(ids) {
  const idList = ids || selected.value;
  try {
    await api.students.restore(idList);
    ElMessage.success('已恢复');
    load();
  } catch (e) { ElMessage.error('恢复失败：' + e.message); }
}
async function batchPurge(ids) {
  const idList = ids || selected.value;
  const ok = await ElMessageBox.confirm(`彻底删除 ${idList.length} 名学生？此操作不可恢复！`, '彻底删除', { type: 'error' }).catch(() => false);
  if (!ok) return;
  try {
    await api.students.purge(idList);
    ElMessage.success('已彻底删除');
    load();
  } catch (e) { ElMessage.error('删除失败：' + e.message); }
}

function fmtVision(v) { return v == null || v === '' ? '—' : Number(v).toFixed(1); }
function gradeType(g) { return { 优: 'success', 良: 'primary', 中: 'warning', 待提高: 'danger' }[g] || 'info'; }

/* ---------- Excel ---------- */
function cellStr(cell) {
  if (cell == null) return '';
  let v = cell.value;
  if (v && typeof v === 'object') v = v.text ?? v.result ?? v;
  return v == null ? '' : String(v).trim();
}
function cellNum(cell) {
  const s = cellStr(cell);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function cellBool(cell, yesValues = ['是', 'true', '1', 'y', 'yes']) {
  const s = cellStr(cell).toLowerCase();
  return s ? yesValues.includes(s) : false;
}

async function downloadTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('学生名单');
  ws.addRow(TEMPLATE_COLS.map(c => c.title));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E8F5' } };
  ws.addRow(['20251001', '示例学生', '男', '2012-01-01', '', '', '是', '', '', '150', '4.8', '4.9', '否', '良', '', '']);
  TEMPLATE_COLS.forEach((c, i) => (ws.getColumn(i + 1).width = c.width));
  const buf = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buf]), '学生导入模板.xlsx');
}

async function onFileChange(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    const rows = [];
    const fails = [];
    ws.eachRow((row, rn) => {
      if (rn === 1) return; // 表头
      const cells = n => row.getCell(n).text ?? row.getCell(n).value;
      const r = {
        _row: rn,
        school_no: cellStr(cells(1)),
        name: cellStr(cells(2)),
        gender: cellStr(cells(3)) || '男',
        birth_date: cellStr(cells(4)),
        phone: cellStr(cells(5)),
        parent_phone: cellStr(cells(6)),
        is_boarding: cellBool(cells(7)),
        interest_duty: cellStr(cells(8)),
        health_note: cellStr(cells(9)),
        height_cm: cellNum(cells(10)),
        vision_left: cellNum(cells(11)),
        vision_right: cellNum(cells(12)),
        is_myopia: cellBool(cells(13)),
        grade_level: cellStr(cells(14)),
        seat_note: cellStr(cells(15)),
        remark: cellStr(cells(16)),
      };
      if (!r.name) { fails.push({ row: rn, reason: '姓名为空' }); return; }
      rows.push(r);
    });
    parsed.value = rows;
    parsedFail.value = fails;
    importVisible.value = true;
  } catch (err) {
    ElMessage.error('文件解析失败：' + err.message);
  }
}

async function doImport() {
  if (!store.currentClassId) return ElMessage.warning('请先创建班级');
  importing.value = true;
  try {
    const r = await api.students.import({ class_id: store.currentClassId, students: parsed.value });
    const failMsgs = r.fail.map(f => `第${f.row}行${f.name ? '「' + f.name + '」' : ''}：${f.reason}`).join('；');
    ElMessage.success(`导入成功 ${r.success.length} 人` + (r.fail.length ? `，失败 ${r.fail.length} 人` : ''));
    if (r.fail.length) ElMessage.warning(failMsgs.slice(0, 200));
    importVisible.value = false;
    load();
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    importing.value = false;
  }
}

async function exportExcel() {
  if (!list.value.length) return ElMessage.info('当前没有可导出的学生');
  ElMessage.info(`将导出当前筛选结果 ${list.value.length} 人`);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('学生名单');
  ws.addRow(TEMPLATE_COLS.map(c => c.title));
  ws.getRow(1).font = { bold: true };
  for (const s of list.value) {
    ws.addRow([
      s.school_no, s.name, s.gender, s.birth_date, s.phone, s.parent_phone,
      s.is_boarding ? '是' : '否', s.interest_duty, s.health_note, s.height_cm,
      s.vision_left, s.vision_right, s.is_myopia ? '是' : '否', s.grade_level, s.seat_note, s.remark,
    ]);
  }
  TEMPLATE_COLS.forEach((c, i) => (ws.getColumn(i + 1).width = c.width));
  const buf = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buf]), `学生名单-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
</script>

<style scoped>
.vision-bad { color: var(--el-color-danger); font-weight: 600; }
:deep(.el-table__row) { cursor: pointer; }

/* 详情抽屉：信息分组排版 */
:deep(.el-drawer__body) { padding-top: 8px; }
:deep(.el-descriptions) { margin-bottom: 8px; }
:deep(.el-descriptions__label) { font-weight: 800; color: var(--muted); }

/* 健康概览条：身高/视力一眼可见 */
.health-strip {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}
.hs-item {
  background: #fff;
  border: 2px solid var(--ink);
  border-radius: 12px;
  padding: 8px 6px;
  text-align: center;
  box-shadow: 2px 2px 0 rgba(32, 27, 23, .35);
}
.hs-label { display: block; font-size: 11px; color: var(--muted); font-weight: 700; margin-bottom: 2px; }
.hs-value { font-size: 16px; font-weight: 900; color: var(--ink); }
.hs-value small { font-size: 10px; font-weight: 700; margin-left: 1px; }
.hs-bad { color: var(--tomato-deep); }
</style>
