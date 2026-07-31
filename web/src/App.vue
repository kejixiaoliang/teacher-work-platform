<template>
  <el-container class="layout">
    <el-aside width="210px" class="sidebar no-print">
      <div class="logo">
        <span class="logo-emoji">🌿</span>
        <div class="logo-text">
          <b>教师工作台</b>
          <small>班主任的好帮手</small>
        </div>
      </div>
      <el-menu :default-active="$route.path" router class="nav-menu">
        <el-menu-item index="/overview">
          <el-icon><HomeFilled /></el-icon><span>概览首页</span>
        </el-menu-item>
        <el-menu-item index="/students">
          <el-icon><User /></el-icon><span>学生管理</span>
        </el-menu-item>
        <el-menu-item index="/seats">
          <el-icon><Grid /></el-icon><span>座位管理</span>
        </el-menu-item>
        <el-menu-item index="/documents">
          <el-icon><FolderOpened /></el-icon><span>文档管理</span>
        </el-menu-item>
        <el-menu-item index="/duties">
          <el-icon><Calendar /></el-icon><span>值日管理</span>
        </el-menu-item>
        <el-menu-item index="/leaders">
          <el-icon><UserFilled /></el-icon><span>班委学委</span>
        </el-menu-item>
        <el-menu-item index="/classes">
          <el-icon><House /></el-icon><span>班级管理</span>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer">数据仅存本机 🔒</div>
    </el-aside>

    <el-container>
      <el-header class="topbar no-print">
        <div class="page-title">
          <span class="title-dot"></span>{{ $route.meta.title }}
        </div>
        <div class="topbar-right">
          <template v-if="store.classes.length > 1">
            <span class="text-muted">当前班级：</span>
            <el-select v-model="store.currentClassId" size="small" style="width:150px">
              <el-option v-for="c in store.classes" :key="c.id" :value="c.id" :label="c.name" />
            </el-select>
          </template>
          <span v-else-if="currentClass" class="class-tag">🏫 {{ currentClass.name }}</span>
          <el-button size="small" type="primary" plain @click="archiveMetrics">📸 学期存档</el-button>
          <el-button size="small" plain @click="exportAll">💾 备份数据</el-button>
        </div>
      </el-header>

      <el-main class="main-area">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from './api.js';
import { store, currentClass, loadClasses } from './store.js';

onMounted(loadClasses);

async function archiveMetrics() {
  if (!store.currentClassId) return ElMessage.warning('请先创建班级');
  const { value } = await ElMessageBox.prompt('输入存档学期（如 2025-2026 上）：', '学期存档', {
    inputValue: '2025-2026 上',
  }).catch(() => ({ value: null }));
  if (!value) return;
  try {
    const r = await api.students.archive({ class_id: store.currentClassId, term: value });
    ElMessage.success(`已存档 ${r.count} 名学生的身高/视力/成绩`);
  } catch (e) {
    ElMessage.error(e.message);
  }
}

async function exportAll() {
  const data = JSON.stringify({ classes: store.classes, exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `班级数据备份-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  ElMessage.success('已导出备份文件（含班级基础信息）');
}
</script>

<style scoped>
.layout { height: 100vh; }

/* ---------- 侧边栏：白底 + 薄荷绿胶囊菜单 ---------- */
.sidebar {
  background: #fff;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e6f4ee;
  box-shadow: 2px 0 12px rgba(62, 198, 168, .05);
}
.logo {
  display: flex; align-items: center; gap: 10px;
  padding: 18px 16px 16px;
}
.logo-emoji { font-size: 30px; line-height: 1; }
.logo-text b { display: block; font-size: 17px; color: #2f8f7a; letter-spacing: .5px; }
.logo-text small { font-size: 11px; color: #9dbcb1; }

.nav-menu { border-right: none; padding: 0 10px; }
.nav-menu :deep(.el-menu-item) {
  height: 44px;
  line-height: 44px;
  border-radius: 10px;
  margin: 4px 0;
  color: #5c6f68;
  font-size: 14px;
}
.nav-menu :deep(.el-menu-item:hover) {
  background: #f0faf6;
  color: #2f8f7a;
}
.nav-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(90deg, #3ec6a8, #55d4b6);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 3px 8px rgba(62, 198, 168, .35);
}
.nav-menu :deep(.el-menu-item.is-active .el-icon) { color: #fff; }
.nav-menu :deep(.el-menu-item .el-icon) { font-size: 18px; }

.sidebar-footer {
  margin-top: auto;
  padding: 14px;
  font-size: 11px;
  color: #a8c3b9;
  text-align: center;
  border-top: 1px dashed #e0f0e9;
}

/* ---------- 顶栏 ---------- */
.topbar {
  background: #fff;
  display: flex; align-items: center; justify-content: space-between;
  box-shadow: 0 2px 8px rgba(62, 198, 168, .06);
  z-index: 5;
}
.page-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 17px; font-weight: 700; color: #2f3e39;
}
.title-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: linear-gradient(135deg, #3ec6a8, #7ee0c8);
  box-shadow: 0 0 6px rgba(62, 198, 168, .5);
}
.topbar-right { display: flex; align-items: center; gap: 10px; }
.class-tag {
  background: #e6f9f5; color: #2f8f7a;
  border-radius: 20px; padding: 4px 14px; font-size: 13px; font-weight: 600;
}

/* ---------- 主区 ---------- */
.main-area {
  background:
    radial-gradient(circle at 85% 10%, rgba(62, 198, 168, .08), transparent 40%),
    radial-gradient(circle at 10% 90%, rgba(126, 224, 200, .06), transparent 40%),
    #effaf5;
  padding: 18px;
  overflow: auto;
}
</style>
