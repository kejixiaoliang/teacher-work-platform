<template>
  <section class="page-shell assessment-page" v-loading="loading">
    <div class="page-head">
      <div><h2 class="page-head-title">学生表现量化</h2><p class="page-head-desc">按日记录行为表现，按月统计、按学期累计；修改记录会保留修正历史。</p></div>
      <el-button :icon="Refresh" @click="reloadAll">刷新</el-button>
    </div>

    <div class="metric-row">
      <div class="metric-card"><b>{{ overview.positive }}</b><span>本月加分</span></div>
      <div class="metric-card metric-negative"><b>{{ overview.negative }}</b><span>本月扣分</span></div>
      <div class="metric-card metric-net"><b>{{ overview.net }}</b><span>本月净分</span></div>
      <div class="metric-card"><b>{{ overview.studentCount }}</b><span>已记录学生</span></div>
    </div>

    <el-tabs v-model="activeTab" class="assessment-tabs">
      <el-tab-pane label="日常记分" name="records">
        <div class="assessment-grid">
          <el-card shadow="never" class="score-card">
            <template #header><div class="card-title"><b>记录一次表现</b><span class="muted">固定分值，不可临时修改</span></div></template>
            <el-form label-position="top" class="score-form">
              <div class="form-two">
                <el-form-item label="行为日期"><el-date-picker v-model="scoreForm.date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
                <el-form-item label="记分范围"><el-select v-model="targetMode" style="width:100%"><el-option label="手动多选" value="manual" /><el-option label="全班" value="all" /><el-option label="值日组" value="duty" /><el-option label="班委组" value="leaders" /></el-select></el-form-item>
              </div>
              <div v-if="targetMode === 'duty'" class="target-scope-note">
                <el-icon><CollectionTag /></el-icon>
                <span>先选具体值日组，系统只会带入这一组的成员。</span>
                <el-select v-model="selectedDutyGroup" placeholder="选择值日组" size="small" class="duty-group-select">
                  <el-option v-for="group in dutyGroups" :key="group.no" :label="`第 ${group.no} 组（${group.studentIds.length} 人）`" :value="group.no" />
                </el-select>
              </div>
              <el-form-item label="行为分类"><el-select v-model="selectedCategoryId" style="width:100%" placeholder="选择分类"><el-option v-for="category in activeCategories" :key="category.id" :label="category.name" :value="category.id" /></el-select></el-form-item>
              <el-form-item label="行为项目"><el-select v-model="scoreForm.itemId" style="width:100%" placeholder="选择行为项目"><el-option v-for="item in selectedItems" :key="item.id" :label="item.name" :value="item.id"><span>{{ item.name }}</span><span class="option-score" :class="item.score < 0 ? 'negative' : ''">{{ item.score > 0 ? '+' : '' }}{{ item.score }} 分</span></el-option></el-select></el-form-item>
              <div v-if="selectedItem" class="rule-hint"><b>固定分值：{{ selectedItem.score > 0 ? '+' : '' }}{{ selectedItem.score }} 分</b><span>{{ selectedItem.allowDailyRepeat ? '允许当天重复记录' : '同一学生当天只能记录一次' }}</span></div>
              <el-form-item v-if="targetMode === 'manual'" label="选择学生"><el-select v-model="scoreForm.studentIds" multiple filterable collapse-tags style="width:100%" placeholder="选择学生"><el-option v-for="student in students" :key="student.id" :label="student.name" :value="student.id" /></el-select></el-form-item>
              <el-form-item v-else label="实际记分学生"><div class="target-preview"><el-tag v-for="id in targetStudentIds.slice(0, 8)" :key="id" size="small">{{ studentName(id) }}</el-tag><span v-if="targetStudentIds.length > 8" class="muted">另有 {{ targetStudentIds.length - 8 }} 人</span><span v-if="!targetStudentIds.length" class="muted">当前范围没有在读学生</span></div></el-form-item>
              <el-form-item label="备注（可选）"><el-input v-model="scoreForm.remark" type="textarea" :rows="2" maxlength="500" show-word-limit placeholder="记录具体表现，方便日后回看" /></el-form-item>
              <div class="submit-line"><span class="muted">将为 {{ targetStudentIds.length }} 名学生各记 {{ selectedItem?.score ?? 0 }} 分</span><el-button type="primary" :disabled="!canSave" @click="saveRecord">保存记分</el-button></div>
              <div v-if="batchResult" class="batch-result"><b>本次结果：成功 {{ batchResult.count }} 条<span v-if="batchResult.skipped?.length">，跳过 {{ batchResult.skipped.length }} 条</span></b><div v-for="(detail, index) in batchResult.skipped" :key="`${detail.studentId}-${index}`">{{ detail.name || `学生 ${detail.studentId}` }}：{{ detail.reason }}</div></div>
            </el-form>
          </el-card>

          <el-card shadow="never" class="stream-card">
            <template #header><div class="card-title"><b>记分流水</b><el-button text type="primary" @click="loadRecords">刷新流水</el-button></div></template>
            <div class="filter-line"><el-date-picker v-model="recordMonth" type="month" value-format="YYYY-MM" placeholder="筛选月份" clearable @change="loadRecords" /><el-checkbox v-model="includeVoided" @change="loadRecords">包含已撤销</el-checkbox></div>
            <div class="assessment-table-scroll">
              <div class="assessment-grid-table record-grid-table">
                <div class="grid-head">日期</div><div class="grid-head">学生</div><div class="grid-head">行为</div><div class="grid-head center">分值</div><div class="grid-head">状态</div><div class="grid-head">操作</div>
                <template v-for="row in records" :key="row.id">
                  <div class="grid-cell">{{ row.behaviorDate }}</div><div class="grid-cell">{{ row.student_name }}</div><div class="grid-cell">{{ row.itemName }}</div><div class="grid-cell center"><span :class="row.score_snapshot < 0 ? 'negative' : 'positive'">{{ row.score_snapshot > 0 ? '+' : '' }}{{ row.score_snapshot }}</span></div><div class="grid-cell"><el-tag v-if="row.status === 'voided'" type="info" size="small">已撤销</el-tag><span v-else>有效</span></div><div class="grid-cell action-cell"><div class="assessment-actions"><el-button class="row-btn row-btn-edit" :icon="EditPen" @click="openEdit(row)">编辑</el-button><el-button class="row-btn" :icon="Clock" @click="showRevisions(row)">历史</el-button><el-button v-if="row.status === 'active'" class="row-btn row-btn-del" :icon="CircleClose" @click="voidRecord(row)">撤销</el-button><el-button v-else class="row-btn row-btn-restore" :icon="CircleCheck" @click="restoreRecord(row)">恢复</el-button></div></div>
                </template>
              </div>
            </div>
            <el-empty v-if="!records.length" description="当前筛选下暂无记分记录" :image-size="70" />
          </el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane label="统计视图" name="stats">
        <div class="stats-toolbar"><span><el-radio-group v-model="statsPeriod" @change="loadStats"><el-radio-button label="monthly">月度统计</el-radio-button><el-radio-button label="term">学期累计</el-radio-button></el-radio-group><el-date-picker v-if="statsPeriod === 'monthly'" v-model="statsMonth" type="month" value-format="YYYY-MM" @change="loadStats" /><span v-else class="term-label">{{ currentClass?.academic_year || '当前学年' }} · {{ currentClass?.term || '当前学期' }}</span></span><span><el-button @click="exportCurrent('excel')">导出 Excel</el-button><el-button @click="exportCurrent('csv')">导出 CSV</el-button><el-button @click="exportCurrent('json')">导出 JSON</el-button></span></div>
        <div class="stats-chart-grid">
          <el-card shadow="never" class="visual-card"><template #header><div class="card-title"><b><el-icon><TrendCharts /></el-icon> 学生净分走势</b><span class="muted">前 10 名</span></div></template><EChart v-if="hasStatsData" :option="rankingChartOption" height="280px" /><el-empty v-else description="本周期还没有记分记录" :image-size="70" /></el-card>
          <el-card shadow="never" class="visual-card"><template #header><div class="card-title"><b>分类贡献分布</b><span class="muted">净分</span></div></template><EChart v-if="hasStatsData" :option="categoryChartOption" height="280px" /><el-empty v-else description="本周期还没有分类数据" :image-size="70" /></el-card>
        </div>
        <div class="stats-grid">
          <el-card shadow="never"><template #header><b>{{ statsPeriod === 'monthly' ? '学生月度排名' : '学生学期排名' }}</b></template><el-table class="ranking-table" :data="stats.ranking" size="small" border><el-table-column prop="rank" label="排名" width="62" align="center" /><el-table-column prop="name" label="学生" min-width="110" /><el-table-column prop="positive" label="加分" width="82" align="center" /><el-table-column prop="negative" label="扣分" width="82" align="center" /><el-table-column prop="net" label="净分" width="82" align="center" /><el-table-column prop="recordCount" label="记录数" width="82" align="center" /><el-table-column label="操作" width="112" align="center"><template #default="{ row }"><el-button class="detail-button" @click="openStudentDetails(row)">查看明细</el-button></template></el-table-column></el-table></el-card>
          <el-card shadow="never"><template #header><b>行为分类贡献</b></template><el-table :data="stats.categories" size="small" border><el-table-column prop="categoryName" label="分类" /><el-table-column prop="recordCount" label="次数" /><el-table-column prop="positive" label="加分" /><el-table-column prop="negative" label="扣分" /><el-table-column prop="net" label="净分" /></el-table></el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane label="规则管理" name="rules">
        <div class="rules-toolbar"><span class="muted">全班级共用一套规则；修改只影响以后新记录，历史记录保留快照。</span><span><el-button type="primary" @click="openItemDialog()">新增行为项目</el-button><el-button @click="openCategoryDialog()">新增分类</el-button></span></div>
        <el-card v-for="category in categories" :key="category.id" shadow="never" class="rule-card">
          <template #header><div class="card-title"><div class="rule-title"><b>{{ category.name }}</b><span class="status-sticker" :class="category.isActive ? 'is-on' : 'is-off'">{{ category.isActive ? '启用中' : '已停用' }}</span></div><div class="rule-actions"><el-button class="row-btn row-btn-edit" :icon="EditPen" @click="openCategoryDialog(category)">编辑</el-button><el-button v-if="category.isActive" class="row-btn row-btn-del" :icon="CircleClose" @click="toggleCategory(category)">停用</el-button><el-button v-else class="row-btn row-btn-restore" :icon="CircleCheck" @click="toggleCategory(category)">启用</el-button><el-button class="row-btn row-btn-delete" :icon="Delete" @click="deleteCategory(category)">删除</el-button></div></div></template>
          <div class="assessment-table-scroll rule-table-scroll">
            <div class="assessment-grid-table rule-grid-table">
              <div class="grid-head">行为项目</div><div class="grid-head">说明</div><div class="grid-head">固定分值</div><div class="grid-head">重复规则</div><div class="grid-head">操作</div>
              <template v-for="item in category.items" :key="item.id">
                <div class="grid-cell">{{ item.name }}</div><div class="grid-cell">{{ item.description }}</div><div class="grid-cell"><span :class="item.score < 0 ? 'negative' : 'positive'">{{ item.score > 0 ? '+' : '' }}{{ item.score }}</span></div><div class="grid-cell">{{ item.allowDailyRepeat ? '允许当天重复' : '每天一次' }}</div><div class="grid-cell action-cell"><div class="assessment-actions"><el-button class="row-btn row-btn-edit" :icon="EditPen" @click="openItemDialog(item, category.id)">编辑</el-button><el-button v-if="item.isActive" class="row-btn row-btn-del" :icon="CircleClose" @click="toggleItem(item)">停用</el-button><el-button v-else class="row-btn row-btn-restore" :icon="CircleCheck" @click="toggleItem(item)">启用</el-button><el-button class="row-btn row-btn-delete" :icon="Delete" @click="deleteItem(item)">删除</el-button></div></div>
              </template>
            </div>
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="editVisible" title="编辑记分记录" width="480px"><el-form label-position="top"><el-form-item label="学生"><el-select v-model="editForm.studentId" style="width:100%"><el-option v-for="student in students" :key="student.id" :label="student.name" :value="student.id" /></el-select></el-form-item><el-form-item label="行为项目"><el-select v-model="editForm.itemId" style="width:100%"><el-option v-for="item in allItems" :key="item.id" :label="`${item.name}（${item.score > 0 ? '+' : ''}${item.score}）`" :value="item.id" /></el-select></el-form-item><el-form-item label="行为日期"><el-date-picker v-model="editForm.behaviorDate" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item><el-form-item label="备注"><el-input v-model="editForm.remark" type="textarea" /></el-form-item><el-form-item label="修正原因"><el-input v-model="editForm.reason" placeholder="修改学生、行为或日期时必填" /></el-form-item></el-form><template #footer><el-button @click="editVisible = false">取消</el-button><el-button type="primary" @click="saveEdit">保存修正</el-button></template></el-dialog>
    <el-dialog v-model="itemDialogVisible" :title="itemForm.id ? '编辑行为项目' : '新增行为项目'" width="460px"><el-form label-position="top"><el-form-item label="所属分类"><el-select v-model="itemForm.categoryId" style="width:100%"><el-option v-for="category in categories" :key="category.id" :label="category.name" :value="category.id" /></el-select></el-form-item><el-form-item label="行为名称"><el-input v-model="itemForm.name" /></el-form-item><el-form-item label="固定分值"><el-input-number v-model="itemForm.score" :min="-100" :max="100" :step="1" /></el-form-item><el-form-item label="说明"><el-input v-model="itemForm.description" /></el-form-item><el-checkbox v-model="itemForm.allowDailyRepeat">允许当天重复</el-checkbox></el-form><template #footer><el-button @click="itemDialogVisible = false">取消</el-button><el-button type="primary" @click="saveItem">保存</el-button></template></el-dialog>
    <el-dialog v-model="categoryDialogVisible" :title="categoryForm.id ? '编辑分类' : '新增分类'" width="420px"><el-form label-position="top"><el-form-item label="分类名称"><el-input v-model="categoryForm.name" /></el-form-item><el-checkbox v-model="categoryForm.isActive">启用</el-checkbox></el-form><template #footer><el-button @click="categoryDialogVisible = false">取消</el-button><el-button type="primary" @click="saveCategory">保存</el-button></template></el-dialog>
    <el-dialog v-model="historyVisible" title="查看修正历史" width="680px"><el-timeline><el-timeline-item v-for="revision in revisions" :key="revision.id" :timestamp="revision.createdAt" placement="top"><div class="revision-head"><b>{{ revision.action === 'edit' ? '编辑' : revision.action === 'void' ? '撤销' : '恢复' }}</b><el-tag size="small" :type="revision.action === 'void' ? 'danger' : revision.action === 'restore' ? 'success' : 'warning'">{{ revision.action === 'edit' ? '字段修正' : revision.action === 'void' ? '记录撤销' : '记录恢复' }}</el-tag></div><p class="revision-reason">修正原因：{{ revision.reason || '未填写' }}</p><div v-if="revision.action === 'edit'" class="revision-diff"><div v-for="change in revisionChanges(revision)" :key="change.key" class="revision-change"><span class="revision-field">{{ change.label }}</span><span class="revision-before">{{ change.before }}</span><span class="revision-arrow">→</span><span class="revision-after">{{ change.after }}</span></div></div><div v-else class="revision-status-note">状态已从「{{ revision.before?.status === 'voided' ? '已撤销' : '有效' }}」变更为「{{ revision.after?.status === 'voided' ? '已撤销' : '有效' }}」</div></el-timeline-item></el-timeline><el-empty v-if="!revisions.length" description="暂无修正历史" /></el-dialog>
    <el-drawer v-model="detailVisible" :title="`${detailStudent?.name || '学生'}的表现明细`" size="min(620px, 92vw)"><div v-loading="detailLoading" class="student-detail-drawer"><div class="detail-period">{{ statsPeriod === 'monthly' ? `${statsMonth} 月度统计` : `${currentClass?.academic_year || ''} · ${currentClass?.term || ''} 学期累计` }}</div><div class="detail-summary"><div><b class="positive">{{ studentDetail.summary.positive }}</b><span>加分</span></div><div><b class="negative">{{ studentDetail.summary.negative }}</b><span>扣分</span></div><div><b>{{ studentDetail.summary.net }}</b><span>净分</span></div><div><b>{{ studentDetail.summary.recordCount }}</b><span>记录数</span></div></div><el-empty v-if="!detailLoading && !studentDetail.records.length" description="当前统计周期暂无明细" /><div v-else class="student-detail-list"><div v-for="record in studentDetail.records" :key="record.id" class="student-detail-row"><div><b>{{ record.itemName }}</b><span>{{ record.categoryName }} · {{ record.behaviorDate }}</span><small v-if="record.remark">备注：{{ record.remark }}</small></div><strong :class="record.scoreSnapshot < 0 ? 'negative' : 'positive'">{{ record.scoreSnapshot > 0 ? '+' : '' }}{{ record.scoreSnapshot }}</strong></div></div></div></el-drawer>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh, EditPen, Clock, CircleClose, CircleCheck, CollectionTag, TrendCharts, Delete } from '@element-plus/icons-vue';
import { api } from '../api.js';
import { currentClass, store } from '../store.js';
import { downloadAssessmentCsv, downloadAssessmentExcel, downloadAssessmentJson } from '../utils/exportAssessment.js';
import EChart from '../components/EChart.vue';

const loading = ref(false); const activeTab = ref('records'); const categories = ref([]); const students = ref([]); const duties = ref([]); const records = ref([]); const overviewRecords = ref([]); const stats = ref({ ranking: [], categories: [] });
const selectedCategoryId = ref(null); const targetMode = ref('manual'); const selectedDutyGroup = ref(null); const recordMonth = ref(''); const includeVoided = ref(false); const statsPeriod = ref('monthly'); const statsMonth = ref(localMonth());
const editVisible = ref(false); const historyVisible = ref(false); const detailVisible = ref(false); const detailLoading = ref(false); const itemDialogVisible = ref(false); const categoryDialogVisible = ref(false); const revisions = ref([]); const batchResult = ref(null); const detailStudent = ref(null); const studentDetail = ref({ records: [], summary: { positive: 0, negative: 0, net: 0, recordCount: 0 } });
const scoreForm = ref({ date: localToday(), itemId: null, studentIds: [], remark: '' }); const editForm = ref({ id: null, studentId: null, itemId: null, behaviorDate: '', remark: '', reason: '' });
const itemForm = ref({ id: null, categoryId: null, name: '', score: 1, description: '', allowDailyRepeat: false }); const categoryForm = ref({ id: null, name: '', isActive: true });
const activeCategories = computed(() => categories.value.filter(category => category.isActive)); const selectedCategory = computed(() => categories.value.find(category => category.id === selectedCategoryId.value)); const selectedItems = computed(() => selectedCategory.value?.items?.filter(item => item.isActive) || []); const allItems = computed(() => categories.value.flatMap(category => category.items || []).filter(item => item.isActive)); const selectedItem = computed(() => allItems.value.find(item => item.id === scoreForm.value.itemId)); const currentClassId = computed(() => store.currentClassId);
const overview = computed(() => { const rows = overviewRecords.value.filter(row => row.status === 'active'); return { positive: rows.filter(row => row.score_snapshot > 0).reduce((sum, row) => sum + row.score_snapshot, 0), negative: rows.filter(row => row.score_snapshot < 0).reduce((sum, row) => sum + row.score_snapshot, 0), net: rows.reduce((sum, row) => sum + row.score_snapshot, 0), studentCount: new Set(rows.map(row => row.student_id)).size }; });
const dutyGroups = computed(() => [...new Set(duties.value.filter(row => row.role === '值日生' && row.group_no != null).map(row => Number(row.group_no)))].sort((a, b) => a - b).map(no => ({ no, studentIds: duties.value.filter(row => row.role === '值日生' && Number(row.group_no) === no).map(row => row.student_id) })));
const groupTargets = computed(() => targetMode.value === 'all' ? students.value.map(student => student.id) : targetMode.value === 'leaders' ? [...new Set(duties.value.filter(row => row.role !== '值日生').map(row => row.student_id))] : targetMode.value === 'duty' ? (dutyGroups.value.find(group => group.no === selectedDutyGroup.value)?.studentIds || []) : scoreForm.value.studentIds);
const targetStudentIds = computed(() => targetMode.value === 'manual' ? scoreForm.value.studentIds : groupTargets.value); const canSave = computed(() => Boolean(currentClassId.value && scoreForm.value.itemId && scoreForm.value.date && targetStudentIds.value.length));
const rankingRows = computed(() => (stats.value.ranking || []).filter(row => Number(row.recordCount) > 0).slice(0, 10));
const categoryRows = computed(() => (stats.value.categories || []).filter(row => Number(row.recordCount) > 0));
const hasStatsData = computed(() => rankingRows.value.length > 0 || categoryRows.value.length > 0);
const rankingChartOption = computed(() => ({ tooltip: { trigger: 'axis' }, grid: { left: 42, right: 18, top: 18, bottom: 42 }, xAxis: { type: 'category', data: rankingRows.value.map(row => row.name), axisLabel: { interval: 0, rotate: rankingRows.value.length > 6 ? 25 : 0, color: '#685f55' } }, yAxis: { type: 'value', minInterval: 1 }, series: [{ type: 'bar', data: rankingRows.value.map(row => ({ value: row.net, itemStyle: { color: row.net >= 0 ? '#8bd6af' : '#f35b3f', borderRadius: [5, 5, 0, 0] } })) }] }));
const categoryChartOption = computed(() => ({ tooltip: { trigger: 'axis' }, legend: { bottom: 0, textStyle: { color: '#685f55' } }, grid: { left: 46, right: 18, top: 18, bottom: 54 }, xAxis: { type: 'category', data: categoryRows.value.map(row => row.categoryName), axisLabel: { interval: 0, rotate: categoryRows.value.length > 4 ? 25 : 0, color: '#685f55' } }, yAxis: { type: 'value', minInterval: 1 }, series: [{ name: '加分', type: 'bar', data: categoryRows.value.map(row => row.positive), itemStyle: { color: '#8bd6af', borderRadius: [5, 5, 0, 0] } }, { name: '扣分', type: 'bar', data: categoryRows.value.map(row => row.negative), itemStyle: { color: '#f35b3f', borderRadius: [5, 5, 0, 0] } }] }));
function localToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; } function localMonth() { return localToday().slice(0, 7); } function studentName(id) { return students.value.find(student => student.id === id)?.name || `学生 ${id}`; }
const revisionFieldLabels = { studentId: '学生', itemId: '行为项目 ID', categoryNameSnapshot: '分类快照', itemNameSnapshot: '行为名称快照', scoreSnapshot: '分值快照', behaviorDate: '行为日期', remark: '备注' };
function revisionValue(key, value) { if (key === 'studentId') return studentName(value); if (value === '' || value == null) return '（空）'; return String(value); }
function revisionChanges(revision) { return (revision.changedFields || []).map(key => ({ key, label: revisionFieldLabels[key] || key, before: revisionValue(key, revision.before?.[key]), after: revisionValue(key, revision.after?.[key]) })); }
function resetTableScroll() {
  const page = document.querySelector('.assessment-page');
  page?.scrollTo({ left: 0, behavior: 'auto' });
  page?.closest('.main-area')?.scrollTo({ left: 0, behavior: 'auto' });
  page?.querySelectorAll('.assessment-table-scroll').forEach(element => { element.scrollLeft = 0; });
}
function handleViewportResize() { requestAnimationFrame(resetTableScroll); }
async function loadCategories() { categories.value = await api.assessment.categories.list(true); if (!selectedCategoryId.value || !categories.value.some(category => category.id === selectedCategoryId.value)) selectedCategoryId.value = activeCategories.value[0]?.id || null; if (!scoreForm.value.itemId || !allItems.value.some(item => item.id === scoreForm.value.itemId)) scoreForm.value.itemId = selectedItems.value[0]?.id || null; }
async function loadStudents() { students.value = await api.students.list({ class_id: currentClassId.value, status: '在读' }); } async function loadGroups() { duties.value = await api.duties.list({ class_id: currentClassId.value }); if (!dutyGroups.value.some(group => group.no === selectedDutyGroup.value)) selectedDutyGroup.value = dutyGroups.value[0]?.no || null; } async function loadRecords() { if (!currentClassId.value) return; records.value = await api.assessment.records.list({ class_id: currentClassId.value, month: recordMonth.value || undefined, include_voided: includeVoided.value ? '1' : undefined }); }
async function loadOverview() { if (!currentClassId.value) return; overviewRecords.value = await api.assessment.records.list({ class_id: currentClassId.value, month: localMonth() }); }
async function loadStats() { if (!currentClassId.value) return; stats.value = statsPeriod.value === 'monthly' ? await api.assessment.stats.monthly({ class_id: currentClassId.value, month: statsMonth.value }) : await api.assessment.stats.term({ class_id: currentClassId.value, academic_year: currentClass.value?.academic_year, term: currentClass.value?.term }); }
async function openStudentDetails(row) {
  detailStudent.value = row;
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    const filters = statsPeriod.value === 'monthly'
      ? { class_id: currentClassId.value, month: statsMonth.value }
      : { class_id: currentClassId.value, academic_year: currentClass.value?.academic_year, term: currentClass.value?.term };
    studentDetail.value = await api.assessment.stats.student(row.studentId, filters);
  } catch (error) {
    detailVisible.value = false;
    ElMessage.error(error.message);
  } finally { detailLoading.value = false; }
}
async function exportCurrent(format) {
  const filters = statsPeriod.value === 'monthly' ? { classId: currentClassId.value, month: statsMonth.value } : { classId: currentClassId.value, academicYear: currentClass.value?.academic_year, term: currentClass.value?.term };
  const columns = ['behaviorDate', 'student_name', 'categoryName', 'itemName', 'score_snapshot', 'status', 'remark'];
  try {
    const detailFilters = statsPeriod.value === 'monthly'
      ? { class_id: currentClassId.value, month: statsMonth.value }
      : { class_id: currentClassId.value, academic_year: currentClass.value?.academic_year, term: currentClass.value?.term };
    const exportRecords = await api.assessment.records.list(detailFilters);
    if (format === 'csv') downloadAssessmentCsv(exportRecords, columns);
    else if (format === 'json') downloadAssessmentJson(filters, stats.value, exportRecords, stats.value.categories);
    else await downloadAssessmentExcel({ summary: stats.value, records: exportRecords, categories: stats.value.categories });
    ElMessage.success('导出已开始');
  } catch (error) { ElMessage.error('导出失败：' + error.message); }
}
async function reloadAll() { loading.value = true; try { await Promise.all([loadCategories(), loadStudents(), loadGroups(), loadRecords(), loadOverview(), loadStats()]); } catch (error) { ElMessage.error(error.message); } finally { loading.value = false; } }
async function saveRecord() { try { const result = await api.assessment.records.batchCreate({ classId: currentClassId.value, date: scoreForm.value.date, itemId: scoreForm.value.itemId, studentIds: targetStudentIds.value, remark: scoreForm.value.remark }); batchResult.value = result; if (result.skipped?.length) ElMessage.warning(`已保存 ${result.count} 条，跳过 ${result.skipped.length} 条`); else ElMessage.success(`已为 ${result.count} 名学生记分`); scoreForm.value.studentIds = []; scoreForm.value.remark = ''; await Promise.all([loadRecords(), loadOverview(), loadStats()]); } catch (error) { ElMessage.error(error.message); } }
function openEdit(row) { editForm.value = { id: row.id, studentId: row.student_id, itemId: row.item_id, behaviorDate: row.behavior_date, remark: row.remark || '', reason: '' }; editVisible.value = true; } async function saveEdit() { try { await api.assessment.records.update(editForm.value.id, editForm.value); ElMessage.success('记分记录已修正'); editVisible.value = false; await Promise.all([loadRecords(), loadOverview(), loadStats()]); } catch (error) { ElMessage.error(error.message); } }
async function voidRecord(row) { const reason = await askReason('撤销记录', '请输入撤销原因'); if (reason === null) return; try { await api.assessment.records.void(row.id, reason); ElMessage.success('记录已撤销'); await Promise.all([loadRecords(), loadOverview(), loadStats()]); } catch (error) { ElMessage.error(error.message); } } async function restoreRecord(row) { const reason = await askReason('恢复记录', '请输入恢复原因'); if (reason === null) return; try { await api.assessment.records.restore(row.id, reason); ElMessage.success('记录已恢复'); await Promise.all([loadRecords(), loadOverview(), loadStats()]); } catch (error) { ElMessage.error(error.message); } }
async function askReason(title, message) { try { const { value } = await ElMessageBox.prompt(message, title, { inputPlaceholder: '修正原因', inputValidator: value => value?.trim() ? true : '请填写原因' }); return value; } catch { return null; } } async function showRevisions(row) { try { revisions.value = await api.assessment.records.revisions(row.id); historyVisible.value = true; } catch (error) { ElMessage.error(error.message); } }
function openItemDialog(item = null, categoryId = null) { itemForm.value = item ? { id: item.id, categoryId: item.categoryId, name: item.name, score: item.score, description: item.description || '', allowDailyRepeat: item.allowDailyRepeat } : { id: null, categoryId: categoryId || selectedCategoryId.value || activeCategories.value[0]?.id, name: '', score: 1, description: '', allowDailyRepeat: false }; itemDialogVisible.value = true; }
async function saveItem() { try { if (!itemForm.value.name.trim()) return ElMessage.warning('请填写行为名称'); if (itemForm.value.id) await api.assessment.items.update(itemForm.value.id, itemForm.value); else await api.assessment.items.create(itemForm.value); ElMessage.success('行为项目已保存'); itemDialogVisible.value = false; await loadCategories(); } catch (error) { ElMessage.error(error.message); } }
async function toggleItem(item) { try { const nextActive = !item.isActive; if (!nextActive) await ElMessageBox.confirm(`停用「${item.name}」？历史记录会保留。`, '确认停用', { type: 'warning' }); await api.assessment.items.update(item.id, { isActive: nextActive }); await loadCategories(); ElMessage.success(nextActive ? '行为项目已启用' : '行为项目已停用'); } catch { /* 取消 */ } }
async function deleteItem(item) { try { await ElMessageBox.confirm(`删除「${item.name}」？没有记分记录的项目才允许删除。`, '确认删除', { type: 'warning' }); await api.assessment.items.remove(item.id); await loadCategories(); ElMessage.success('行为项目已删除'); } catch (error) { if (error?.message) ElMessage.error(error.message); } }
function openCategoryDialog(category = null) { categoryForm.value = category ? { id: category.id, name: category.name, isActive: category.isActive } : { id: null, name: '', isActive: true }; categoryDialogVisible.value = true; }
async function saveCategory() { try { if (!categoryForm.value.name.trim()) return ElMessage.warning('请填写分类名称'); if (categoryForm.value.id) await api.assessment.categories.update(categoryForm.value.id, categoryForm.value); else await api.assessment.categories.create(categoryForm.value); ElMessage.success('分类已保存'); categoryDialogVisible.value = false; await loadCategories(); } catch (error) { ElMessage.error(error.message); } }
async function toggleCategory(category) { try { const nextActive = !category.isActive; if (!nextActive) await ElMessageBox.confirm(`停用分类「${category.name}」？历史记录会保留。`, '确认停用', { type: 'warning' }); await api.assessment.categories.update(category.id, { name: category.name, isActive: nextActive }); await loadCategories(); ElMessage.success(nextActive ? '分类已启用' : '分类已停用'); } catch { /* 取消 */ } }
async function deleteCategory(category) { try { await ElMessageBox.confirm(`删除分类「${category.name}」？请确认它下面没有行为项目。`, '确认删除', { type: 'warning' }); await api.assessment.categories.remove(category.id); await loadCategories(); ElMessage.success('分类已删除'); } catch (error) { if (error?.message) ElMessage.error(error.message); } }
watch(selectedCategoryId, () => { if (!selectedItems.value.some(item => item.id === scoreForm.value.itemId)) scoreForm.value.itemId = selectedItems.value[0]?.id || null; }); watch(targetMode, mode => { if (mode === 'duty' && !selectedDutyGroup.value) selectedDutyGroup.value = dutyGroups.value[0]?.no || null; }); watch([records, categories, activeTab], () => nextTick(resetTableScroll), { deep: true }); watch(() => store.currentClassId, reloadAll); onMounted(() => { reloadAll(); nextTick(resetTableScroll); window.addEventListener('resize', handleViewportResize); }); onBeforeUnmount(() => window.removeEventListener('resize', handleViewportResize));
</script>

<style scoped>
.assessment-page{width:100%;max-width:1440px;min-width:0;margin:0 auto;overflow:clip;box-sizing:border-box}.assessment-page :deep(.el-tabs),.assessment-page :deep(.el-tab-pane){min-width:0}.head-actions,.card-title,.filter-line,.stats-toolbar,.rules-toolbar,.submit-line{display:flex;align-items:center;gap:10px}.head-actions{margin-left:auto}.metric-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0}.metric-card{padding:14px 16px;background:#fff;border:1px solid #eadfce;border-radius:12px;box-shadow:0 3px 0 rgba(32,27,23,.05)}.metric-card b{display:block;font-size:24px;color:var(--ink)}.metric-card span{color:var(--muted);font-size:12px}.metric-card.metric-negative b,.negative{color:#d95045}.metric-card.metric-net b,.positive{color:#249b69}.assessment-grid,.stats-grid{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.5fr);gap:14px;align-items:start;min-width:0}.stats-grid{grid-template-columns:1.4fr 1fr;margin-top:14px}.card-title{justify-content:space-between;flex-wrap:wrap;min-width:0}.card-title > *{min-width:0}.muted,.term-label{color:var(--muted);font-size:12px}.form-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.option-score{float:right;color:#249b69;font-weight:700}.option-score.negative{color:#d95045}.rule-hint{display:flex;justify-content:space-between;gap:8px;padding:10px 12px;margin:-4px 0 12px;background:#fff8df;border:1px solid #f1df9c;border-radius:8px;font-size:12px}.target-preview{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-height:32px}.submit-line{justify-content:space-between;margin-top:4px}.filter-line{margin-bottom:10px;flex-wrap:wrap}.filter-line .el-date-editor{width:150px}.stats-toolbar,.rules-toolbar{justify-content:space-between;margin-bottom:14px;flex-wrap:wrap}.rule-card{margin-bottom:12px;min-width:0}pre{max-height:180px;overflow:auto;padding:8px;background:#f8f6f1;font-size:11px}@media (max-width:980px){.assessment-grid,.stats-grid{grid-template-columns:1fr}}@media (max-width:640px){.metric-row{grid-template-columns:repeat(2,1fr)}.form-two{grid-template-columns:1fr}.stats-toolbar,.rules-toolbar{align-items:flex-start;flex-direction:column}}
/* Xiaoliang content-lab polish: compact, tactile controls instead of stacked links. */
.assessment-page :deep(.el-card) { border: 3px solid var(--ink); border-radius: 20px; background: var(--paper-soft); box-shadow: var(--shadow-xs); }
.assessment-page :deep(.el-card__header) { border-bottom: 2px solid var(--ink); background: #fff1bf; }
.assessment-page :deep(.el-tabs__item) { font-weight: 900; }
.assessment-page :deep(.el-tabs__active-bar) { background: var(--tomato); height: 4px; }
.batch-result { display:grid; gap:4px; margin-top:10px; padding:9px 11px; background:#fff8df; border:2px solid var(--ink); border-radius:10px; font-size:12px; line-height:1.45; }
.target-scope-note { display:flex; align-items:center; gap:8px; padding:10px 12px; margin:-2px 0 14px; color:var(--ink); background:#e7f7ea; border:2px solid var(--ink); border-radius:14px; box-shadow:3px 3px 0 var(--ink); font-size:12px; font-weight:800; }
.target-scope-note .el-icon { color:var(--tomato); font-size:17px; }
.duty-group-select { width:180px; margin-left:auto; }
.assessment-actions, .rule-actions { display:flex; flex-wrap:nowrap; align-items:center; gap:5px; white-space:nowrap; }
.assessment-actions .row-btn, .rule-actions .row-btn { flex:0 0 82px !important; width:82px !important; min-width:82px !important; justify-content:center; margin:0 !important; padding:3px 2px !important; min-height:27px; border:2px solid var(--ink); border-radius:999px; box-shadow:2px 2px 0 var(--ink); background:#fffdf4; font-size:11px; }
.assessment-actions .row-btn:hover, .rule-actions .row-btn:hover { transform:translateY(-1px); background:var(--mustard); color:var(--ink); }
.assessment-actions .row-btn:active, .rule-actions .row-btn:active { transform:translateY(2px); box-shadow:none; }
.assessment-actions .row-btn-edit, .rule-actions .row-btn-edit { border-color:#4d9d79; color:#2e6b55; }
.assessment-actions .row-btn-del, .rule-actions .row-btn-del { border-color:var(--tomato); color:var(--tomato-deep); }
.assessment-actions .row-btn-restore, .rule-actions .row-btn-restore { border-color:#4d9d79; color:#2e6b55; background:#e7f7ea; }
.assessment-actions .row-btn-delete, .rule-actions .row-btn-delete { border-color:#8f6b55; color:#8f4c2d; background:#fff1e6; }
.stats-chart-grid { display:grid; grid-template-columns:1.35fr 1fr; gap:14px; margin:14px 0; }
.visual-card { min-width:0; }
.ranking-table { width:100%; }
.ranking-table :deep(.el-table__cell) { padding:8px 6px; }
.ranking-table :deep(.cell) { line-height:1.35; }
.detail-button { min-width:86px; height:28px; padding:3px 10px; border:2px solid var(--tomato); border-radius:999px; background:#fffdf4; box-shadow:2px 2px 0 var(--ink); color:var(--tomato-deep); font-size:12px; font-weight:900; }
.detail-button:hover { color:var(--ink); background:var(--mustard); border-color:var(--ink); transform:translateY(-1px); }
.detail-button:active { transform:translateY(2px); box-shadow:none; }
.student-detail-drawer { display:grid; gap:16px; }
.detail-period { padding:8px 10px; color:var(--muted); background:#fff8df; border-radius:9px; font-size:12px; }
.detail-summary { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.detail-summary > div { display:grid; gap:3px; padding:10px 8px; text-align:center; border:1px solid #eadfce; border-radius:10px; background:#fffdf4; }
.detail-summary b { font-size:20px; }
.detail-summary span { color:var(--muted); font-size:12px; }
.student-detail-list { display:grid; gap:8px; }
.student-detail-row { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:11px 12px; border:2px solid #eadfce; border-radius:12px; background:#fffdf4; }
.student-detail-row > div { display:grid; gap:4px; min-width:0; }
.student-detail-row span, .student-detail-row small { color:var(--muted); font-size:12px; }
.student-detail-row small { overflow-wrap:anywhere; }
.student-detail-row strong { flex:0 0 auto; font-size:18px; }
.visual-card :deep(.el-card__body) { padding:10px 14px 12px; }
.visual-card .el-icon { color:var(--tomato); vertical-align:-2px; margin-right:4px; }
.rule-title { display:flex; align-items:center; gap:10px; }
.status-sticker { padding:4px 9px; border:2px solid var(--ink); border-radius:999px; font-size:11px; font-weight:900; }
.status-sticker.is-on { background:var(--mint); }
.status-sticker.is-off { background:#ffe0d6; color:var(--tomato-deep); }
.rule-card :deep(.el-table) { box-shadow:none; border-width:2px; }
.assessment-actions .el-button .el-icon, .rule-actions .el-button .el-icon { margin-right:3px; }
.assessment-record-table, .assessment-rule-table { width:100%; min-width:0; }
.assessment-record-table :deep(.el-table__header-wrapper table), .assessment-record-table :deep(.el-table__body-wrapper table) { min-width:704px; }
.assessment-rule-table :deep(.el-table__header-wrapper table), .assessment-rule-table :deep(.el-table__body-wrapper table) { min-width:950px; }
.stream-card :deep(.el-table__body-wrapper), .rule-card :deep(.el-table__body-wrapper) { overflow-x:auto; }
.assessment-table-scroll { width:100%; overflow-x:auto; overflow-y:hidden; border:2px solid var(--ink); border-radius:14px; background:#fffdf4; }
.assessment-grid-table { display:grid; width:100%; color:var(--ink); font-size:12px; }
.record-grid-table { min-width:704px; grid-template-columns:96px 78px 118px 58px 64px minmax(270px,1fr); }
.rule-grid-table { min-width:930px; grid-template-columns:180px 250px 100px 130px minmax(270px,1fr); }
.assessment-grid-table > * { min-width:0; border-bottom:1px solid #e8dcc3; }
.assessment-grid-table .grid-head { padding:8px 8px; background:var(--mustard); border-bottom:2px solid var(--ink); font-weight:900; }
.assessment-grid-table .grid-cell { min-height:38px; display:flex; align-items:center; padding:6px 8px; background:#fffdf4; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.assessment-grid-table .grid-cell.center, .assessment-grid-table .grid-head.center { justify-content:center; text-align:center; }
.assessment-grid-table .grid-cell.action-cell { overflow:visible; }
.assessment-grid-table .grid-cell.action-cell .assessment-actions { width:100%; }
.assessment-grid-table .grid-cell.action-cell .assessment-actions .row-btn { flex:1 1 0 !important; width:auto !important; min-width:0 !important; }
.record-grid-table > :nth-child(6n), .rule-grid-table > :nth-child(5n) { position:sticky; right:0; z-index:2; background:#fffdf4; box-shadow:-3px 0 0 rgba(32,27,23,.12); }
.record-grid-table > .grid-head:nth-child(6n), .rule-grid-table > .grid-head:nth-child(5n) { z-index:3; background:var(--mustard); }
.assessment-grid-table .grid-cell:nth-child(12n + 1), .assessment-grid-table .grid-cell:nth-child(12n + 2), .assessment-grid-table .grid-cell:nth-child(12n + 3), .assessment-grid-table .grid-cell:nth-child(12n + 4), .assessment-grid-table .grid-cell:nth-child(12n + 5), .assessment-grid-table .grid-cell:nth-child(12n + 6) { background:#fffdf4; }
.rule-grid-table .grid-cell { min-height:38px; }
.revision-head { display:flex; align-items:center; gap:8px; }
.revision-reason { margin:8px 0; color:var(--muted); font-size:12px; }
.revision-diff { display:grid; gap:6px; padding:10px 12px; background:#fffaf0; border:2px solid #ead9b9; border-radius:12px; }
.revision-change { display:grid; grid-template-columns:76px minmax(0,1fr) 22px minmax(0,1fr); align-items:center; gap:8px; font-size:12px; }
.revision-field { color:var(--muted); font-weight:900; }
.revision-before, .revision-after { min-width:0; padding:6px 8px; border-radius:8px; overflow-wrap:anywhere; }
.revision-before { background:#ffe8df; color:#995044; }
.revision-after { background:#e5f6e8; color:#356c4e; }
.revision-arrow { text-align:center; color:var(--tomato); font-weight:900; }
.revision-status-note { padding:10px 12px; background:#fff1bf; border:2px solid var(--ink); border-radius:10px; font-size:12px; font-weight:800; }
@media (max-width:980px) { .stats-chart-grid { grid-template-columns:1fr; } }
@media (max-width:640px) { .target-scope-note { align-items:flex-start; flex-wrap:wrap; } .duty-group-select { width:100%; margin-left:0; } .assessment-actions, .rule-actions { gap:4px; } .revision-change { grid-template-columns:64px minmax(0,1fr); } .revision-arrow { display:none; } .revision-after { grid-column:2; } }
</style>
