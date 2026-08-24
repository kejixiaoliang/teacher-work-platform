import { createRouter, createWebHashHistory } from 'vue-router';
import { accessState, isModuleAvailable, refreshAccessStatus } from './accessControl.js';

// 路由懒加载：按需加载页面 JS，显著缩小首屏体积
const Overview = () => import('./views/Overview.vue');
const Students = () => import('./views/Students.vue');
const Seats = () => import('./views/Seats.vue');
const Analytics = () => import('./views/Analytics.vue');
const Scores = () => import('./views/Scores.vue');
const Attendance = () => import('./views/Attendance.vue');
const Assessment = () => import('./views/Assessment.vue');
const Documents = () => import('./views/Documents.vue');
const Duties = () => import('./views/Duties.vue');
const Leaders = () => import('./views/Leaders.vue');
const SubjectLeaders = () => import('./views/SubjectLeaders.vue');
const Leaves = () => import('./views/Leaves.vue');
const Contacts = () => import('./views/Contacts.vue');
const Classes = () => import('./views/Classes.vue');
const Guide = () => import('./views/Guide.vue');
const Changelog = () => import('./views/Changelog.vue');
const AccessLocked = () => import('./views/AccessLocked.vue');

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/overview' },
    { path: '/access-locked', component: AccessLocked, meta: { title: '模块已保护' } },
    { path: '/overview', component: Overview, meta: { title: '概览首页' } },
    { path: '/students', component: Students, meta: { title: '学生管理', module: 'students' } },
    { path: '/seats', component: Seats, meta: { title: '座位管理' } },
    { path: '/analytics', component: Analytics, meta: { title: '数据分析', module: 'analytics' } },
    { path: '/scores', component: Scores, meta: { title: '成绩管理', module: 'scores' } },
    { path: '/attendance', component: Attendance, meta: { title: '考勤管理' } },
    { path: '/assessment', component: Assessment, meta: { title: '表现量化' } },
    { path: '/documents', component: Documents, meta: { title: '文档管理', module: 'documents' } },
    { path: '/duties', component: Duties, meta: { title: '值日管理' } },
    { path: '/leaders', component: Leaders, meta: { title: '班委学委' } },
    { path: '/subject-leaders', component: SubjectLeaders, meta: { title: '课代表选择' } },
    { path: '/leaves', component: Leaves, meta: { title: '请假管理', module: 'leaves' } },
    { path: '/contacts', component: Contacts, meta: { title: '家校沟通', module: 'contacts' } },
    { path: '/classes', component: Classes, meta: { title: '班级设置', module: 'classes' } },
    { path: '/guide', component: Guide, meta: { title: '使用指南' } },
    { path: '/changelog', component: Changelog, meta: { title: '版本更新' } },
  ],
});

router.beforeEach(async to => {
  if (!to.meta.module) return true;
  if (!accessState.configured) {
    try { await refreshAccessStatus(); } catch { return true; }
  }
  if (isModuleAvailable(to.meta.module)) return true;
  return { path: '/access-locked', query: { module: to.meta.module } };
});

export default router;
