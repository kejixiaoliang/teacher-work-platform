<template>
  <div class="doc-layout">
    <!-- 左侧分类树 -->
    <div class="doc-sidebar">
      <div class="side-item" :class="{ active: !filter.category && !filter.tag && !trashed }"
           @click="selectCategory('')">全部文件</div>
      <div v-for="c in categories" :key="c" class="side-item"
           :class="{ active: filter.category === c && !trashed }" @click="selectCategory(c)">
        <el-icon style="vertical-align:-2px;margin-right:4px"><component :is="cateIcon(c)" /></el-icon>{{ c }}
      </div>
      <div class="side-title">预设标签</div>
      <div v-for="t in PRESET_TAGS" :key="'p' + t" class="side-item preset-tag"
           :class="{ active: filter.tag === t && !trashed }" @click="selectTag(t)"># {{ t }}</div>
      <div class="side-title">全部标签</div>
      <div v-for="t in tags" :key="t" class="side-item"
           :class="{ active: filter.tag === t && !trashed }" @click="selectTag(t)"># {{ t }}</div>
    </div>

    <!-- 右侧主区 -->
    <div class="page-card doc-main">
      <div class="page-head">
        <div>
          <h2 class="page-head-title">文档管理</h2>
          <p class="page-head-desc">上传、分类、预览班级文件（图片/PDF/Office/文本）</p>
        </div>
        <div class="page-head-actions">
          <el-button v-if="!trashed" type="primary" :icon="Upload" @click="uploadVisible = true">上传文件</el-button>
          <el-button @click="toggleTrash">{{ trashed ? '返回文件列表' : '回收站' }}</el-button>
        </div>
      </div>
      <div class="toolbar">
        <el-input v-model="filter.keyword" placeholder="搜索文件名" clearable style="width:200px"
                  :prefix-icon="Search" @input="debouncedLoad" />
      </div>

      <!-- 拖拽上传提示区（回收站视图隐藏） -->
      <div v-if="!trashed" class="drop-zone" :class="{ dragging: dragging }"
           @click="uploadVisible = true"
           @dragover.prevent="dragging = true" @dragleave="dragging = false">
        <el-icon :size="28"><UploadFilled /></el-icon>
        <span>点击或拖拽文件到此处上传（图片 / PDF / Office / 文本，单个 ≤200MB）</span>
      </div>

      <!-- 文件网格 -->
      <div v-if="!list.length" class="empty">
        <el-empty :description="trashed ? '回收站为空' : '暂无文件，拖拽或点击上传'" />
      </div>
      <div v-else class="file-grid">
        <div v-for="f in list" :key="f.id" class="file-card" @dblclick="preview(f)">
          <div class="file-icon"><el-icon :size="30"><component :is="cateIcon(f.category)" /></el-icon></div>
          <div class="file-name" :title="f.original_name">{{ f.original_name }}</div>
          <div class="file-meta">
            {{ formatSize(f.size) }} · {{ (f.uploaded_at || '').slice(0, 10) }}
            <el-tag v-if="f.tag" size="small" type="info">{{ f.tag }}</el-tag>
          </div>
          <div class="file-ops">
            <template v-if="!trashed">
              <el-button link size="small" type="primary" @click.stop="preview(f)">预览</el-button>
              <el-button link size="small" @click.stop="download(f)">下载</el-button>
              <el-button link size="small" @click.stop="openRename(f)">重命名</el-button>
              <el-button link size="small" type="danger" @click.stop="remove(f)">删除</el-button>
            </template>
            <template v-else>
              <el-button link size="small" type="primary" @click.stop="restore([f.id])">恢复</el-button>
              <el-button link size="small" type="danger" @click.stop="purge([f.id])">彻底删除</el-button>
            </template>
          </div>
        </div>
      </div>
      <div class="text-muted" style="margin-top:10px">共 {{ list.length }} 个文件</div>
    </div>

    <!-- 上传弹窗 -->
    <el-dialog v-model="uploadVisible" title="上传文件" width="480px">
      <input ref="fileInput" type="file" multiple style="display:none" @change="onFilesSelected" />
      <div class="drop-zone" style="border-style:dashed" @click="fileInput.click()"
           @dragover.prevent="dragging = true" @dragleave="dragging = false">
        <el-icon :size="28"><UploadFilled /></el-icon>
        <span>点击选择 或 拖拽文件到此处</span>
      </div>
      <el-form label-width="70px" style="margin-top:14px">
        <el-form-item label="标签">
          <el-input v-model="uploadTag" placeholder="可选，多个标签用逗号分隔，如：家长会,通知" />
        </el-form-item>
      </el-form>
      <div v-if="uploadQueue.length" class="upload-list">
        <div v-for="(u, i) in uploadQueue" :key="i" class="upload-item">
          <span>{{ u.name }}</span>
          <el-tag v-if="u.ok === true" type="success" size="small">成功</el-tag>
          <el-tag v-else-if="u.ok === false" type="danger" size="small">{{ u.error }}</el-tag>
          <el-tag v-else type="info" size="small">上传中…</el-tag>
        </div>
      </div>
      <template #footer>
        <el-button @click="uploadVisible = false; uploadQueue = []">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 预览弹窗 -->
    <el-dialog v-model="previewVisible" :title="current?.original_name" width="80%" top="4vh">
      <div v-if="current" class="preview-body">
        <img v-if="current.category === '图片'" :src="api.documents.fileUrl(current.id)"
             style="max-width:100%; max-height:72vh" />
        <iframe v-else-if="current.category === 'PDF'" :src="api.documents.fileUrl(current.id)"
                style="width:100%; height:72vh; border:none" />
        <pre v-else-if="current.category === '文本'" class="text-preview">{{ textContent }}</pre>
        <div v-else class="no-preview">
          <p>该类型暂不支持在线预览</p>
          <el-button type="primary" @click="download(current)">下载查看</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 重命名/标签 -->
    <el-dialog v-model="renameVisible" title="重命名 / 编辑标签" width="420px">
      <el-form label-width="60px">
        <el-form-item label="文件名"><el-input v-model="renameForm.name" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="renameForm.tag" placeholder="逗号分隔多个标签" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="renameVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRename">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onBeforeUnmount } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Upload, UploadFilled } from '@element-plus/icons-vue';
import { api } from '../api.js';
import { store } from '../store.js';

const categories = ['图片', 'PDF', '文档', '表格', '演示', '文本', '其他'];
/* 标签预设模板：上传/筛选时快速选用 */
const PRESET_TAGS = ['教案', '试卷', '课件', '通知', '家长信', '表格模板', '制度', '其他'];
const filter = reactive({ category: '', tag: '', keyword: '' });
const trashed = ref(false);
const list = ref([]);
const tags = ref([]);
const dragging = ref(false);

const uploadVisible = ref(false);
const uploadTag = ref('');
const uploadQueue = ref([]);
const fileInput = ref(null);

const previewVisible = ref(false);
const current = ref(null);
const textContent = ref('');
const renameVisible = ref(false);
const renameForm = ref({ id: null, name: '', tag: '' });

let debounceTimer = null;
function debouncedLoad() { clearTimeout(debounceTimer); debounceTimer = setTimeout(load, 300); }

function cateIcon(c) {
  return {
    图片: 'Picture', PDF: 'Document', 文档: 'DocumentCopy',
    表格: 'DataAnalysis', 演示: 'VideoCamera', 文本: 'Memo', 其他: 'Box',
  }[c] || 'Box';
}
function formatSize(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

async function load() {
  if (!store.currentClassId) { list.value = []; return; }
  try {
    const q = { class_id: store.currentClassId, trashed: trashed.value ? '1' : '0', ...filter };
    list.value = await api.documents.list(q);
    // 收集标签（并行，P2-14）
    const [all] = await Promise.all([api.documents.list({ class_id: store.currentClassId })]);
    const tagSet = new Set();
    for (const f of all) {
      for (const t of String(f.tag || '').split(/[,，]/)) if (t.trim()) tagSet.add(t.trim());
    }
    tags.value = [...tagSet];
  } catch (e) {
    ElMessage.error('文档列表加载失败：' + e.message);
  }
}
watch(() => store.currentClassId, load);
onMounted(load);

function selectCategory(c) { filter.category = c; filter.tag = ''; trashed.value = false; load(); }
function selectTag(t) { filter.tag = t; filter.category = ''; trashed.value = false; load(); }
function toggleTrash() { trashed.value = !trashed.value; load(); }

/* ---------- 上传 ---------- */
async function doUpload(files) {
  if (!store.currentClassId) return ElMessage.warning('请先创建班级');
  for (const file of files) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('class_id', store.currentClassId);
    if (uploadTag.value) fd.append('tag', uploadTag.value);
    const item = { name: file.name, ok: null, error: '' };
    uploadQueue.value.push(item);
    try {
      await api.documents.upload(fd);
      item.ok = true;
    } catch (e) {
      item.ok = false;
      item.error = e.message;
    }
  }
  load();
}
function onFilesSelected(e) {
  doUpload([...e.target.files]);
  e.target.value = '';
}

/* ---------- 预览 / 下载 ---------- */
async function preview(f) {
  current.value = f;
  previewVisible.value = true;
  textContent.value = '';
  if (f.category === '文本') {
    try {
      const r = await fetch(api.documents.fileUrl(f.id));
      textContent.value = await r.text();
    } catch { textContent.value = '（读取失败）'; }
  }
}
function download(f) {
  const a = document.createElement('a');
  a.href = api.documents.fileDl(f.id);
  a.download = f.original_name;
  a.click();
}

/* ---------- 重命名 / 删除 ---------- */
function openRename(f) {
  renameForm.value = { id: f.id, name: f.original_name, tag: f.tag || '' };
  renameVisible.value = true;
}
async function saveRename() {
  if (!renameForm.value.name.trim()) return ElMessage.warning('文件名不能为空');
  await api.documents.update(renameForm.value.id, { name: renameForm.value.name.trim(), tag: renameForm.value.tag });
  renameVisible.value = false;
  ElMessage.success('已保存');
  load();
}
async function remove(f) {
  const ok = await ElMessageBox.confirm(`把「${f.original_name}」移入回收站？`, '删除', { type: 'warning' }).catch(() => false);
  if (!ok) return;
  await api.documents.remove(f.id);
  load();
}
async function restore(ids) {
  await api.documents.restore(ids);
  ElMessage.success('已恢复');
  load();
}
async function purge(ids) {
  const ok = await ElMessageBox.confirm(`彻底删除 ${ids.length} 个文件？物理文件将一并删除，不可恢复！`, '彻底删除', { type: 'error' }).catch(() => false);
  if (!ok) return;
  await api.documents.purge(ids);
  ElMessage.success('已彻底删除');
  load();
}

// 页面级拖拽上传：任何位置拖入文件都触发上传（回收站视图禁用）
function onPageDrop(e) {
  e.preventDefault();
  if (trashed.value) return;
  const files = e.dataTransfer?.files;
  if (files && files.length) {
    if (!uploadVisible.value) uploadVisible.value = true;
    dragging.value = false;
    doUpload([...files]);
  }
}
onMounted(() => {
  window.addEventListener('dragover', onPageDrop);
  window.addEventListener('drop', onPageDrop);
});
onBeforeUnmount(() => {
  window.removeEventListener('dragover', onPageDrop);
  window.removeEventListener('drop', onPageDrop);
});
</script>

<style scoped>
.doc-layout { display: flex; gap: 14px; }
.doc-sidebar {
  width: 170px; background: var(--paper-soft); border: 3px solid var(--ink); border-radius: 16px; padding: 10px 6px;
  box-shadow: var(--shadow-sm); flex-shrink: 0; height: fit-content;
}
.side-item {
  padding: 8px 12px; border-radius: 10px; cursor: pointer; font-size: 14px; color: var(--muted);
  font-weight: 700;
}
.side-item:hover { background: #fff; color: var(--tomato); }
.side-item.active { background: var(--mustard); color: var(--ink); font-weight: 900; border: 3px solid var(--ink); box-shadow: var(--shadow-xs); }
.preset-tag { background: var(--paper); color: var(--muted); }
.side-title { padding: 12px 12px 4px; font-size: 12px; color: var(--muted); }
.doc-main { flex: 1; min-width: 0; }
.drop-zone {
  border: 3px dashed var(--ink); border-radius: 16px; padding: 18px; text-align: center;
  color: var(--muted); display: flex; align-items: center; justify-content: center; gap: 8px;
  margin-bottom: 14px; cursor: pointer; transition: all .2s;
  background: rgba(255, 249, 234, .7);
  font-weight: 700;
}
.drop-zone.dragging { border-color: var(--tomato); background: var(--paper); color: var(--tomato); }
.file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.file-card {
  border: 3px solid var(--ink); border-radius: 14px; padding: 12px; cursor: pointer;
  transition: box-shadow .15s, transform .15s; background: #fff;
  box-shadow: var(--shadow-sm);
}
.file-card:hover { box-shadow: var(--shadow); transform: translateY(-2px) rotate(-.3deg); }
.file-icon { text-align: center; color: var(--tomato); }
.file-name {
  font-size: 13px; font-weight: 900; margin: 8px 0 4px; text-align: center; color: var(--ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.file-meta { font-size: 11px; color: var(--muted); text-align: center; display: flex; gap: 4px; justify-content: center; align-items: center; flex-wrap: wrap; }
.file-ops { display: flex; justify-content: center; gap: 2px; margin-top: 6px; flex-wrap: wrap; }
.empty { padding: 30px 0; }
.upload-list { margin-top: 10px; max-height: 180px; overflow: auto; }
.upload-item { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 13px; }
.preview-body { text-align: center; }
.text-preview {
  text-align: left; background: var(--paper); border-radius: 6px; padding: 14px;
  max-height: 72vh; overflow: auto; white-space: pre-wrap; font-size: 13px;
}
.no-preview { padding: 60px 0; color: var(--el-text-color-secondary); }
</style>
