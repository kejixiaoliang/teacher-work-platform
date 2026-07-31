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
          <el-input v-model="globalKw" placeholder="搜索学生（姓名/学号）" clearable style="width:210px"
                    :prefix-icon="Search" @keyup.enter="goSearch" @clear="goSearch" />
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
  </el-container>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Search, Notebook, Reading, Clock, ChatDotRound } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
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

// 全局搜索学生：跳转学生页并带关键词
function goSearch() {
  const kw = globalKw.value.trim();
  router.push({ path: '/students', query: kw ? { kw } : {} });
  if (kw) ElMessage({ type: 'info', message: `已搜索「${kw}」`, duration: 1200 });
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
</style>
