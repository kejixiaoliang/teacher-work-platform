<template>
  <el-container class="layout">
    <el-aside width="210px" class="sidebar no-print">
      <div class="logo">
        <span class="logo-emoji"><el-icon :size="24"><Notebook /></el-icon></span>
        <div class="logo-text">
          <b>教师工作台</b>
          <small>班主任的好帮手</small>
        </div>
        <span class="logo-pin">班级实验本</span>
      </div>
      <el-menu ref="menuRef" :default-active="$route.path" router class="nav-menu">
        <el-menu-item-group title="常用">
          <el-menu-item index="/overview">
            <el-icon><HomeFilled /></el-icon><span>概览首页</span>
          </el-menu-item>
          <el-menu-item index="/students">
            <el-icon><User /></el-icon><span>学生管理</span>
          </el-menu-item>
          <el-menu-item index="/seats">
            <el-icon><Grid /></el-icon><span>座位管理</span>
          </el-menu-item>
        </el-menu-item-group>
        <el-menu-item-group title="学习分析">
          <el-menu-item index="/analytics">
            <el-icon><TrendCharts /></el-icon><span>数据分析</span>
          </el-menu-item>
          <el-menu-item index="/scores">
            <el-icon><DocumentChecked /></el-icon><span>成绩管理</span>
          </el-menu-item>
          <el-menu-item index="/attendance">
            <el-icon><Finished /></el-icon><span>考勤管理</span>
          </el-menu-item>
        </el-menu-item-group>
        <el-menu-item-group title="班级事务">
          <el-menu-item index="/documents">
            <el-icon><FolderOpened /></el-icon><span>文档管理</span>
          </el-menu-item>
          <el-menu-item index="/duties">
            <el-icon><Calendar /></el-icon><span>值日管理</span>
          </el-menu-item>
          <el-menu-item index="/leaders">
            <el-icon><UserFilled /></el-icon><span>班委学委</span>
          </el-menu-item>
          <el-menu-item index="/subject-leaders">
            <el-icon><Reading /></el-icon><span>课代表选择</span>
          </el-menu-item>
          <el-menu-item index="/leaves">
            <el-icon><Clock /></el-icon><span>请假管理</span>
          </el-menu-item>
          <el-menu-item index="/contacts">
            <el-icon><ChatDotRound /></el-icon><span>家校沟通</span>
          </el-menu-item>
        </el-menu-item-group>
        <el-menu-item index="/classes" class="menu-bottom">
          <el-icon><Setting /></el-icon><span>班级设置</span>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer">数据仅存本机</div>
    </el-aside>

    <el-container>
      <el-header class="topbar no-print">
        <div class="page-title">
          <span class="title-dot"></span>{{ $route.meta.title }}
        </div>
        <div class="topbar-right">
          <el-input v-model="globalKw" placeholder="搜索：学生/文档/请假/沟通" clearable style="width:230px"
                    :prefix-icon="Search" @keyup.enter="openGlobalSearch" @clear="openGlobalSearch" @focus="openGlobalSearch" />
          <template v-if="store.classes.length > 1">
            <span class="text-muted">班级：</span>
            <el-select :model-value="store.currentClassId" style="width:150px" @update:model-value="onClassChange">
              <el-option v-for="c in store.classes" :key="c.id" :value="c.id" :label="c.name"
                         :title="c.name" />
            </el-select>
          </template>
          <span v-else-if="currentClass" class="class-tag">{{ currentClass.name }}</span>
        </div>
      </el-header>

      <el-main class="main-area">
        <div class="main-area-inner">
          <router-view />
        </div>
      </el-main>
    </el-container>

    <!-- 全局搜索弹窗（B7）：聚合学生/文档/请假/沟通 -->
    <el-dialog v-model="searchVisible" title="全局搜索" width="560px" :show-close="true" append-to-body>
      <el-input v-model="searchKw" placeholder="输入关键词搜索学生、文档、请假、沟通记录…" clearable
                size="large" :prefix-icon="Search" @keyup.enter="doGlobalSearch" />
      <div style="margin-top:12px" v-loading="searchLoading">
        <template v-if="searchResults.students?.length">
          <div class="gs-group">
            <div class="gs-title">学生（{{ searchResults.students.length }}）</div>
            <div v-for="s in searchResults.students.slice(0, 8)" :key="'s' + s.id" class="gs-item" @click="goStudent(s)">
              <b>{{ s.name }}</b>
              <span class="text-muted">{{ s.school_no || '无学号' }} · {{ s.class_name }}</span>
            </div>
          </div>
        </template>
        <template v-if="searchResults.documents?.length">
          <div class="gs-group">
            <div class="gs-title">文档（{{ searchResults.documents.length }}）</div>
            <div v-for="d in searchResults.documents.slice(0, 8)" :key="'d' + d.id" class="gs-item" @click="go('/documents')">
              <b>{{ d.original_name }}</b>
              <span class="text-muted">{{ d.category }} · {{ d.class_name }}</span>
            </div>
          </div>
        </template>
        <template v-if="searchResults.leaves?.length">
          <div class="gs-group">
            <div class="gs-title">请假（{{ searchResults.leaves.length }}）</div>
            <div v-for="l in searchResults.leaves.slice(0, 8)" :key="'l' + l.id" class="gs-item" @click="go('/leaves')">
              <b>{{ l.student_name }}</b>
              <span class="text-muted">{{ l.type }} · {{ l.start_date }}~{{ l.end_date }} · {{ l.reason }}</span>
            </div>
          </div>
        </template>
        <template v-if="searchResults.contacts?.length">
          <div class="gs-group">
            <div class="gs-title">沟通记录（{{ searchResults.contacts.length }}）</div>
            <div v-for="c in searchResults.contacts.slice(0, 8)" :key="'c' + c.id" class="gs-item" @click="go('/contacts')">
              <b>{{ c.student_name }}</b>
              <span class="text-muted">{{ c.method }} · {{ c.date }} · {{ c.topic }}</span>
            </div>
          </div>
        </template>
        <el-empty v-if="searched && !searchLoading && !totalHits" description="没有找到匹配结果" :image-size="60" />
      </div>
      <template #footer>
        <el-button @click="searchVisible = false">关闭</el-button>
        <el-button type="primary" @click="go('/students')">前往学生管理</el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Search, Notebook, Reading, Clock, ChatDotRound, HomeFilled, User, Grid,
  TrendCharts, DocumentChecked, Finished, FolderOpened, Calendar, UserFilled, Setting,
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from './api.js';
import { store, currentClass, loadClasses } from './store.js';

const route = useRoute();
const router = useRouter();
const menuRef = ref(null);
const globalKw = ref('');

onMounted(loadClasses);

// 非菜单导航（如首页快捷入口）后，菜单高亮跟随路由
watch(() => route.path, p => {
  if (menuRef.value) menuRef.value.activeIndex = p;
});

// 全局搜索（B7）：聚合学生/文档/请假/沟通
const searchVisible = ref(false);
const searchKw = ref('');
const searchLoading = ref(false);
const searched = ref(false);
const searchResults = ref({ students: [], documents: [], leaves: [], contacts: [] });
let searchSeq = 0; // 全局搜索竞态计数器（B7）
const totalHits = computed(() =>
  (searchResults.value.students?.length || 0) + (searchResults.value.documents?.length || 0)
  + (searchResults.value.leaves?.length || 0) + (searchResults.value.contacts?.length || 0)
);

function openGlobalSearch() {
  searchKw.value = globalKw.value.trim();
  searchVisible.value = true;
  searched.value = false;
  if (searchKw.value) doGlobalSearch();
}
async function doGlobalSearch() {
  const kw = searchKw.value.trim();
  if (!kw) { searchResults.value = { students: [], documents: [], leaves: [], contacts: [] }; searched.value = true; return; }
  // 竞态防护：快速连续输入时只采纳最后一次的结果
  const mySeq = ++searchSeq;
  searchLoading.value = true;
  searched.value = true;
  try {
    // 跨班搜索：不带 class_id；各请求独立失败不影响其他
    const [st, doc, lv, ct] = await Promise.allSettled([
      api.students.list({ keyword: kw }),
      api.documents.list({ keyword: kw }),
      api.leaves.list({ keyword: kw }),
      api.contacts.list({ keyword: kw }),
    ]);
    if (mySeq !== searchSeq) return; // 已发起更新的搜索，丢弃过期结果
    searchResults.value = {
      students: st.status === 'fulfilled' ? st.value : [],
      documents: doc.status === 'fulfilled' ? doc.value : [],
      leaves: lv.status === 'fulfilled' ? lv.value : [],
      contacts: ct.status === 'fulfilled' ? ct.value : [],
    };
  } catch (e) {
    ElMessage.error('搜索失败：' + e.message);
  } finally {
    if (mySeq === searchSeq) searchLoading.value = false;
  }
}
function goStudent(s) {
  searchVisible.value = false;
  store.currentClassId = s.class_id;
  router.push({ path: '/students', query: { kw: s.name } });
}
function go(p) {
  searchVisible.value = false;
  router.push(p);
}

// 切班级：座位页有未保存修改时先确认（P1-1）
async function onClassChange(id) {
  if (store.seatsDirty && route.path === '/seats') {
    const ok = await ElMessageBox.confirm(
      '当前座位有未保存的修改，切换班级将丢失。确定切换吗？',
      '未保存提示', { type: 'warning', confirmButtonText: '仍要切换', cancelButtonText: '取消' }
    ).catch(() => false);
    if (!ok) return;
  }
  store.currentClassId = id;
}
</script>

<style scoped>
/* ---------- 全局搜索弹窗（B7） ---------- */
.gs-group { margin-bottom: 10px; }
.gs-title { font-size: 12px; color: var(--muted); font-weight: 800; letter-spacing: .5px; margin-bottom: 4px; }
.gs-item {
  display: flex; gap: 10px; align-items: baseline;
  padding: 6px 8px; border-radius: 8px; cursor: pointer; font-size: 13px;
}
.gs-item:hover { background: var(--paper-soft); }
.gs-item .text-muted { font-size: 12px; }

.layout { height: 100vh; }

/* ---------- 侧边栏：奶油纸 + 墨线 ---------- */
.sidebar {
  background: var(--paper-soft);
  display: flex;
  flex-direction: column;
  border-right: 3px solid var(--ink);
}
.logo {
  position: relative;
  display: flex; align-items: center; gap: 10px;
  padding: 16px 14px 14px;
  margin: 14px 12px 6px;
  background: #fff;
  border: 4px solid var(--ink);
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
}
.logo-emoji {
  font-size: 26px; line-height: 1;
  background: var(--mustard);
  border: 3px solid var(--ink);
  border-radius: 12px;
  width: 44px; height: 44px;
  display: grid; place-items: center;
  box-shadow: 2px 2px 0 var(--ink);
}
.logo-text b { display: block; font-size: 16px; color: var(--ink); letter-spacing: .5px; }
.logo-text small { font-size: 11px; color: var(--muted); }
.logo-pin {
  position: absolute; right: -10px; top: -12px;
  background: var(--tomato-deep);
  color: #fff;
  border: 3px solid var(--ink);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 11px; font-weight: 900;
  box-shadow: 2px 2px 0 var(--ink);
  letter-spacing: .5px;
}

.nav-menu { border-right: none; padding: 0 10px; background: transparent; }
.nav-menu :deep(.el-menu-item) {
  height: 42px;
  line-height: 42px;
  border-radius: 12px;
  margin: 4px 0;
  color: #403932;
  font-size: 14px;
  font-weight: 700;
}
.nav-menu :deep(.el-menu-item:hover) { background: #fff; color: var(--tomato); }
.nav-menu :deep(.el-menu-item.is-active) {
  background: var(--mustard);
  color: var(--ink);
  border: 3px solid var(--ink);
  font-weight: 900;
  box-shadow: 3px 3px 0 var(--ink);
}
.nav-menu :deep(.el-menu-item.is-active .el-icon) { color: var(--tomato); }
.nav-menu :deep(.el-menu-item .el-icon) { font-size: 18px; }
.nav-menu :deep(.menu-bottom) {
  margin-top: 8px;
  border-top: 3px dashed #d9cbb0;
  border-radius: 0 0 12px 12px;
}
.nav-menu :deep(.el-menu-item-group__title) {
  font-size: 11px; color: var(--muted);
  padding: 14px 12px 4px;
  letter-spacing: 1.5px;
  font-weight: 800;
}

.sidebar-footer {
  margin-top: auto;
  padding: 12px;
  font-size: 11px;
  color: var(--muted);
  text-align: center;
  border-top: 3px dashed #d9cbb0;
  font-weight: 700;
}

/* ---------- 顶栏：白纸 + 墨线 ---------- */
.topbar {
  background: var(--paper-soft);
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; row-gap: 8px;
  min-height: 60px; height: auto !important;
  padding: 8px 18px;
  border-bottom: 3px solid var(--ink);
  z-index: 5;
}
.page-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 17px; font-weight: 900; color: var(--ink);
}
.title-dot {
  width: 14px; height: 14px; border-radius: 5px;
  background: var(--tomato);
  border: 3px solid var(--ink);
  transform: rotate(12deg);
  box-shadow: 2px 2px 0 var(--ink);
}
.topbar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.class-tag {
  background: var(--mint); color: var(--ink);
  border: 3px solid var(--ink);
  border-radius: 999px; padding: 3px 14px; font-size: 13px; font-weight: 900;
  box-shadow: 2px 2px 0 var(--ink);
}

/* ---------- 主区：奶油纸网格 ---------- */
.main-area {
  background-color: var(--paper);
  background-image:
    linear-gradient(rgba(32, 27, 23, .05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(32, 27, 23, .045) 1px, transparent 1px);
  background-size: 30px 30px;
  padding: 20px;
  overflow: auto;
}

/* ---------- 响应式：窄屏侧栏折叠为图标栏 ---------- */
@media (max-width: 900px) {
  .layout { flex-direction: row; }
  .sidebar { width: 64px !important; }
  .sidebar :deep(.el-aside) { width: 64px !important; }
  .logo { margin: 10px 8px 4px; padding: 10px 8px; flex-direction: column; gap: 2px; }
  .logo-text, .logo-pin { display: none; }
  .nav-menu { padding: 0 6px; }
  .nav-menu :deep(.el-menu-item) {
    justify-content: center;
    padding: 0 !important;
    margin: 6px 0;
  }
  .nav-menu :deep(.el-menu-item span) { display: none; }
  .nav-menu :deep(.el-menu-item .el-icon) { margin: 0 !important; font-size: 20px; }
  .nav-menu :deep(.el-menu-item-group__title) { text-align: center; padding: 10px 4px 4px; font-size: 10px; }
  .sidebar-footer { font-size: 10px; padding: 8px 4px; }
  .main-area { padding: 12px; }
}
</style>
